const { model } = require("../lib/model");
const { sha256 } = require("../lib/hash");
const { OperationalError } = require("../lib/error");
const omie = require("../integrations/omie/service");
const bacen = require("../integrations/bacen/service");
const { applyQuoteAdjustment, chooseQuote } = require("./quoteMath");
const { runStep } = require("./executionService");
const {
  toObject,
  getOsHeader,
  quoteReferenceDate,
  resolveProfile,
  resolvePublishedVersion,
} = require("./invoiceContext");

async function ensureInvoice(event, empresa) {
  const Fatura = model("Fatura");
  const preliminaryKey = sha256([empresa._id, event.codigoOS, event.etapa].join(":"));
  return Fatura.findOneAndUpdate(
    { chaveIdempotencia: preliminaryKey },
    {
      $setOnInsert: {
        chaveIdempotencia: preliminaryKey,
        empresaOmie: empresa._id,
        eventoWebhook: event._id,
        codigoOS: event.codigoOS,
        numeroOS: event.numeroOS,
        etapaOrigem: event.etapa,
        etapaAtual: "recebida",
        status: "pendente",
        adiantamentoSolicitado: false,
        adiantamentoConfirmado: false,
        tentativas: 0,
      },
    },
    { upsert: true, new: true }
  );
}

async function prepareInvoice(event, empresa, fatura) {
  const osResult = await runStep({
    fatura, empresa, type: "consultar_os", system: "omie", key: `${fatura._id}:consultar-os`,
    requestSummary: { codigoOS: event.codigoOS }, fn: () => omie.consultarOS(empresa, event.codigoOS),
  });
  const os = osResult.result;
  const header = getOsHeader(os);
  const clientCode = header.nCodCli;
  if (!clientCode) throw new OperationalError("A OS não possui cliente.", { code: "OS_CLIENT_REQUIRED" });

  const clientResult = await runStep({
    fatura, empresa, type: "consultar_cliente", system: "omie", key: `${fatura._id}:consultar-cliente:${clientCode}`,
    requestSummary: { codigoCliente: clientCode }, fn: () => omie.consultarCliente(empresa, clientCode),
  });
  const cliente = clientResult.result;
  let pais = null;
  if (cliente.codigo_pais) {
    const countryResult = await runStep({
      fatura, empresa, type: "consultar_pais", system: "omie", key: `${fatura._id}:consultar-pais:${cliente.codigo_pais}`,
      requestSummary: { codigoPais: cliente.codigo_pais }, fn: () => omie.consultarPais(empresa, cliente.codigo_pais),
    });
    pais = countryResult.result;
  }

  const profile = await resolveProfile(empresa._id, clientCode, event.etapa);
  const { template, version } = await resolvePublishedVersion(profile);
  const referenceDate = quoteReferenceDate(profile, os);
  const quoteResult = await runStep({
    fatura, empresa, type: "obter_cotacao", system: "bacen", direction: "inbound",
    key: `${fatura._id}:cotacao:${profile.moeda}:${referenceDate.toISOString().slice(0, 10)}`,
    requestSummary: { moeda: profile.moeda, data: referenceDate },
    fn: async () => toObject(await bacen.getOrFetchQuote(profile.moeda, referenceDate)),
  });
  const quote = quoteResult.result;
  const official = chooseQuote(quote, profile.campoCotacao);
  const effective = applyQuoteAdjustment(official, profile.tipoAjusteCotacao, profile.valorAjusteCotacao);
  const finalKey = sha256([empresa._id, event.codigoOS, event.etapa, profile._id, version._id].join(":"));

  const duplicate = await model("Fatura").findOne({ chaveIdempotencia: finalKey, _id: { $ne: fatura._id } });
  if (duplicate) {
    event.status = "duplicado";
    event.duplicadoDe = duplicate.eventoWebhook;
    event.fatura = duplicate._id;
    event.motivo = "Já existe fatura para a mesma empresa, OS, etapa, perfil e versão.";
    await event.save();
    fatura.status = "ignorada";
    fatura.etapaAtual = "cancelada";
    fatura.motivoCancelamento = "Duplicada por chave funcional.";
    await fatura.save();
    return { duplicate };
  }

  fatura.chaveIdempotencia = finalKey;
  fatura.numeroOS = header.cNumOS || event.numeroOS || String(event.codigoOS);
  fatura.codigoClienteOmie = String(clientCode);
  fatura.nomeCliente = cliente.razao_social || cliente.nome_fantasia || cliente.nome || String(clientCode);
  fatura.emailCliente = cliente.email || "";
  fatura.paisCliente = pais?.cDescricao || "";
  fatura.perfilFaturamento = profile._id;
  fatura.modeloDocumento = template._id;
  fatura.versaoModelo = version._id;
  fatura.idioma = profile.idioma;
  fatura.moeda = profile.moeda;
  fatura.dataReferenciaCotacao = referenceDate;
  fatura.cotacaoMoeda = quote._id;
  fatura.cotacaoOficial = official;
  fatura.tipoAjusteCotacao = profile.tipoAjusteCotacao;
  fatura.valorAjusteCotacao = profile.valorAjusteCotacao || 0;
  fatura.cotacaoEfetiva = effective;
  fatura.adiantamentoSolicitado = Boolean(profile.gerarAdiantamento);
  fatura.dadosOsSnapshotJson = JSON.stringify({ os, cliente, pais, profile: toObject(profile), template: toObject(template), version: { _id: version._id, versao: version.versao, hashConteudo: version.hashConteudo } });
  await fatura.save();
  event.fatura = fatura._id;
  await event.save();
  return { os, cliente, pais, profile, template, version, quote, effective };
}

async function loadPrepared(fatura) {
  const [empresa, profile, template, version, quote] = await Promise.all([
    model("EmpresaOmie").findById(fatura.empresaOmie),
    model("PerfilFaturamento").findById(fatura.perfilFaturamento),
    model("ModeloDocumento").findById(fatura.modeloDocumento),
    model("VersaoModeloDocumento").findById(fatura.versaoModelo),
    model("CotacaoMoeda").findById(fatura.cotacaoMoeda),
  ]);
  const snapshot = JSON.parse(fatura.dadosOsSnapshotJson || "{}");
  return { empresa, profile, template, version, quote: toObject(quote), os: snapshot.os, cliente: snapshot.cliente, pais: snapshot.pais };
}

module.exports = { ensureInvoice, prepareInvoice, loadPrepared };
