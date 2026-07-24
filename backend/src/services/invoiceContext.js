const { model } = require("../lib/model");
const { parseOmieDate } = require("../lib/date");
const { OperationalError } = require("../lib/error");
const { chooseQuote } = require("./quoteMath");

function toObject(doc) {
  return doc?.toObject ? doc.toObject({ virtuals: false }) : doc;
}

function getOsHeader(os) {
  return os?.Cabecalho || os?.cabecalho || {};
}

function quoteReferenceDate(profile, os) {
  const header = getOsHeader(os);
  if (profile.dataReferenciaCotacao === "previsao_os") return parseOmieDate(header.dDtPrevisao) || new Date();
  if (profile.dataReferenciaCotacao === "data_os") return parseOmieDate(header.dDtInc) || parseOmieDate(header.dDtPrevisao) || new Date();
  return new Date();
}

function templateVariables({ empresa, profile, os, cliente, pais, quote, effectiveQuote }) {
  return {
    empresa: {
      nome: empresa.nome,
      razaoSocial: empresa.razaoSocial,
      cnpj: empresa.cnpj,
    },
    cliente: { ...cliente, pais: pais?.cDescricao || cliente?.pais || "" },
    ordemServico: os,
    servicos: os?.ServicosPrestados || os?.Servicos || [],
    parcelas: os?.Parcelas || [],
    impostos: profile.regraImpostosJson ? JSON.parse(profile.regraImpostosJson) : {},
    moeda: profile.moeda,
    cotacao: {
      oficial: chooseQuote(quote, profile.campoCotacao),
      efetiva: effectiveQuote,
      dataSolicitada: quote.dataSolicitada,
      dataEfetiva: quote.dataEfetiva,
      origem: quote.origem,
    },
    datas: {
      processamento: new Date(),
      previsaoOS: parseOmieDate(getOsHeader(os).dDtPrevisao),
    },
    configuracoesPublicas: {
      idioma: profile.idioma,
      gerarAdiantamento: profile.gerarAdiantamento,
    },
  };
}

async function resolveProfile(empresaId, clientCode, stage, when = new Date()) {
  const Profile = model("PerfilFaturamento");
  const profiles = await Profile.find({
    empresaOmie: empresaId,
    codigoClienteOmie: String(clientCode),
    status: "ativo",
    vigenteDesde: { $lte: when },
    $or: [{ vigenteAte: null }, { vigenteAte: { $exists: false } }, { vigenteAte: { $gte: when } }],
  }).sort({ vigenteDesde: -1 });
  const compatible = profiles.filter((profile) => !profile.etapaEntrada || String(profile.etapaEntrada) === String(stage));
  if (compatible.length !== 1) {
    throw new OperationalError(
      compatible.length ? "Mais de um perfil de faturamento vigente foi encontrado." : "Perfil de faturamento ativo não encontrado.",
      { code: compatible.length ? "MULTIPLE_BILLING_PROFILES" : "BILLING_PROFILE_NOT_FOUND" }
    );
  }
  return compatible[0];
}

async function resolvePublishedVersion(profile) {
  const Modelo = model("ModeloDocumento");
  const Version = model("VersaoModeloDocumento");
  const template = await Modelo.findById(profile.modeloDocumento);
  if (!template || template.status !== "ativo") throw new OperationalError("Modelo de documento não está ativo.", { code: "DOCUMENT_MODEL_INACTIVE" });
  const version = await Version.findOne({
    modeloDocumento: template._id,
    idioma: profile.idioma,
    status: "publicado",
    motor: "template-seguro",
  }).sort({ publicadoEm: -1, createdAt: -1 });
  if (!version) throw new OperationalError("Não existe versão publicada para o idioma do perfil.", { code: "PUBLISHED_TEMPLATE_NOT_FOUND" });
  return { template, version };
}

module.exports = {
  toObject,
  getOsHeader,
  quoteReferenceDate,
  templateVariables,
  resolveProfile,
  resolvePublishedVersion,
};
