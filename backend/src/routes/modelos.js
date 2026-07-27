const { defineRoutes } = require("@oondemand/oon-core-back");
const { model } = require("../lib/model");
const { renderPdf } = require("../services/documentService");
const { consultarOS, consultarCliente, consultarPais } = require("../integrations/omie/service");
const { OperationalError } = require("../lib/error");
const { quoteReferenceDate, templateVariables } = require("../services/faturaProcessor");
const { getOrFetchQuote } = require("../integrations/bacen/service");
const { chooseQuote, applyQuoteAdjustment } = require("../services/quoteMath");
const { sha256 } = require("../lib/hash");

const roles = ["administrador", "gestor_faturamento"];

function templateHash(version) {
  return sha256([
    version.motor,
    version.conteudoDocumento,
    version.estilos,
    version.assuntoEmail,
    version.corpoEmail,
    version.variaveisPermitidas,
  ].join("\n---\n"));
}

defineRoutes("/api/modelos", (router) => {
  router.private.post("/versoes/:id/publicar", { roles, audit: { action: "modelo.publicar" } }, async (req, res) => {
    const Version = model("VersaoModeloDocumento");
    const version = await Version.findById(req.params.id);
    if (!version) throw new OperationalError("Versão não encontrada.", { code: "TEMPLATE_VERSION_NOT_FOUND", statusCode: 404 });
    if (version.motor !== "template-seguro") {
      throw new OperationalError("Somente versões do motor seguro podem ser publicadas.", { code: "UNSAFE_TEMPLATE_ENGINE", statusCode: 400 });
    }
    if (version.status === "publicado") {
      return res.json({ message: "Versão já estava publicada.", id: version._id, hash: version.hashConteudo });
    }
    if (!["rascunho", "homologacao"].includes(version.status)) {
      throw new OperationalError("Somente versões em rascunho ou homologação podem ser publicadas.", { code: "TEMPLATE_STATUS_NOT_PUBLISHABLE", statusCode: 409 });
    }

    version.status = "publicado";
    version.publicadoEm = new Date();
    version.publicadoPor = req.usuario?.email || req.usuario?.nome || "usuário autenticado";
    version.hashConteudo = templateHash(version);
    await version.save();

    res.json({ message: "Versão publicada.", id: version._id, hash: version.hashConteudo });
  });

  router.private.post("/versoes/:id/preview", { roles, audit: { action: "modelo.preview" } }, async (req, res) => {
    const version = await model("VersaoModeloDocumento").findById(req.params.id);
    const empresa = await model("EmpresaOmie").findById(req.body?.empresaOmieId);
    const profile = await model("PerfilFaturamento").findById(req.body?.perfilFaturamentoId);
    if (!version || !empresa || !profile) throw new OperationalError("Versão, empresa e perfil são obrigatórios.", { code: "PREVIEW_CONTEXT_REQUIRED", statusCode: 400 });
    const os = await consultarOS(empresa, req.body?.codigoOS);
    const cliente = await consultarCliente(empresa, os.Cabecalho.nCodCli);
    const pais = cliente.codigo_pais ? await consultarPais(empresa, cliente.codigo_pais) : null;
    const referenceDate = quoteReferenceDate(profile, os);
    const quote = await getOrFetchQuote(profile.moeda, referenceDate);
    const official = chooseQuote(quote, profile.campoCotacao);
    const effective = applyQuoteAdjustment(official, profile.tipoAjusteCotacao, profile.valorAjusteCotacao);
    const variables = templateVariables({ empresa, profile, os, cliente, pais, quote: quote.toObject(), effectiveQuote: effective });
    const { pdf } = await renderPdf(version, variables, { watermark: "HOMOLOGAÇÃO", strict: false });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview-${req.body.codigoOS}.pdf"`);
    res.send(pdf);
  });
});
