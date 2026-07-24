const { defineRoutes } = require("@oondemand/oon-core-back");
const { model } = require("../lib/model");
const { reprocessInvoice, reprocessEvent } = require("../services/faturaProcessor");
const { OperationalError } = require("../lib/error");

const roles = ["administrador", "gestor_faturamento", "operacao_faturamento"];

defineRoutes("/api/faturas", (router) => {
  router.private.post("/:id/reprocessar-preparacao", { roles, audit: { action: "fatura.reprocessar-preparacao" } }, async (req, res) => {
    const fatura = await model("Fatura").findById(req.params.id);
    if (!fatura) throw new OperationalError("Fatura não encontrada.", { code: "INVOICE_NOT_FOUND", statusCode: 404 });
    const result = await reprocessEvent(fatura.eventoWebhook);
    res.json({ message: "Preparação da fatura reprocessada.", status: result?.status });
  });
  router.private.post("/:id/reprocessar", { roles, audit: { action: "fatura.reprocessar" } }, async (req, res) => {
    const result = await reprocessInvoice(req.params.id);
    res.json({ message: "Reprocessamento executado.", status: result?.status });
  });
  router.private.post("/:id/reenviar-email", { roles, audit: { action: "fatura.reenviar-email" } }, async (req, res) => {
    const result = await reprocessInvoice(req.params.id, { resetType: "enviar_email" });
    res.json({ message: "Reenvio de e-mail executado.", status: result?.status });
  });
  router.private.post("/:id/reanexar", { roles, audit: { action: "fatura.reanexar" } }, async (req, res) => {
    const result = await reprocessInvoice(req.params.id, { resetType: "anexar_documento" });
    res.json({ message: "Reanexação executada.", status: result?.status });
  });
  router.private.post("/:id/reprocessar-adiantamento", { roles: ["administrador", "gestor_faturamento"], audit: { action: "fatura.reprocessar-adiantamento" } }, async (req, res) => {
    const result = await reprocessInvoice(req.params.id, { resetType: "gerar_adiantamento" });
    res.json({ message: "Reprocessamento do adiantamento executado.", status: result?.status });
  });
  router.private.post("/:id/cancelar", { roles: ["administrador", "gestor_faturamento"], audit: { action: "fatura.cancelar" } }, async (req, res) => {
    const reason = String(req.body?.motivo || "").trim();
    if (!reason) throw new OperationalError("Motivo do cancelamento é obrigatório.", { code: "CANCELLATION_REASON_REQUIRED", statusCode: 400 });
    const fatura = await model("Fatura").findByIdAndUpdate(req.params.id, {
      $set: { status: "cancelada", etapaAtual: "cancelada", motivoCancelamento: reason, lockUntil: null, lockedBy: null },
    }, { new: true });
    if (!fatura) throw new OperationalError("Fatura não encontrada.", { code: "INVOICE_NOT_FOUND", statusCode: 404 });
    res.json({ message: "Fatura cancelada.", id: fatura._id });
  });
  router.private.get("/:id/pdf", { roles: ["administrador", "gestor_faturamento", "operacao_faturamento", "auditoria_consulta"] }, async (req, res) => {
    const fatura = await model("Fatura").findById(req.params.id);
    if (!fatura?.pdfBase64) throw new OperationalError("PDF não encontrado.", { code: "PDF_NOT_FOUND", statusCode: 404 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fatura.nomeArquivo || "fatura.pdf"}"`);
    res.send(Buffer.from(fatura.pdfBase64, "base64"));
  });
});
