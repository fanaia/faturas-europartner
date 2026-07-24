const { model } = require("../lib/model");
const { normalizeError, OperationalError } = require("../lib/error");
const log = require("../lib/log");
const { nextRetryAt } = require("./retry");
const { ensureInvoice, prepareInvoice, loadPrepared } = require("./invoicePreparation");
const { processEffects } = require("./invoiceEffects");
const {
  quoteReferenceDate,
  templateVariables,
  resolveProfile,
  resolvePublishedVersion,
} = require("./invoiceContext");

async function handleFailure(fatura, error) {
  const normalized = error.normalized || normalizeError(error);
  const canRetry = normalized.transient && fatura.tentativas < Number(process.env.PROCESSOR_MAX_ATTEMPTS || 5);
  fatura.status = canRetry ? "aguardando_retry" : "falha";
  fatura.etapaAtual = canRetry ? "aguardando_retry" : "falha_operacional";
  fatura.proximaTentativaEm = canRetry ? nextRetryAt(fatura.tentativas) : undefined;
  fatura.ultimoErroCodigo = normalized.code;
  fatura.ultimoErroMensagem = normalized.message;
  fatura.acaoRecomendada = canRetry ? "Aguardar o retry automático ou executar novamente." : "Corrigir dados/configuração e reprocessar a etapa.";
  fatura.lockUntil = undefined;
  fatura.lockedBy = undefined;
  await fatura.save();
  log.error("Falha no processamento da fatura", { faturaId: fatura._id, codigoOS: fatura.codigoOS, error: normalized });
}

async function processInvoiceById(id) {
  const Fatura = model("Fatura");
  const lockUntil = new Date(Date.now() + Number(process.env.PROCESSOR_LOCK_MS || 300_000));
  const instance = process.env.INSTANCE_ID || `pid-${process.pid}`;
  const fatura = await Fatura.findOneAndUpdate(
    {
      _id: id,
      status: { $in: ["pendente", "aguardando_retry", "falha"] },
      $or: [{ lockUntil: null }, { lockUntil: { $exists: false } }, { lockUntil: { $lt: new Date() } }],
    },
    { $set: { status: "em_processamento", lockUntil, lockedBy: instance, iniciadaEm: new Date() }, $inc: { tentativas: 1 } },
    { new: true }
  );
  if (!fatura) return null;
  try {
    const prepared = await loadPrepared(fatura);
    if (!prepared.empresa || !prepared.profile || !prepared.version || !prepared.quote) {
      throw new OperationalError("Fatura não possui preparação completa.", { code: "INVOICE_NOT_PREPARED" });
    }
    await processEffects(fatura, prepared);
    return fatura;
  } catch (error) {
    await handleFailure(fatura, error);
    return fatura;
  }
}

async function processEventById(id) {
  const Evento = model("EventoWebhook");
  const Empresa = model("EmpresaOmie");
  const lockUntil = new Date(Date.now() + Number(process.env.PROCESSOR_LOCK_MS || 300_000));
  const instance = process.env.INSTANCE_ID || `pid-${process.pid}`;
  const event = await Evento.findOneAndUpdate(
    {
      _id: id,
      status: "aceito",
      $or: [{ lockUntil: null }, { lockUntil: { $exists: false } }, { lockUntil: { $lt: new Date() } }],
    },
    { $set: { lockUntil, lockedBy: instance }, $inc: { tentativas: 1 } },
    { new: true }
  );
  if (!event) return null;
  const empresa = await Empresa.findById(event.empresaOmie);
  try {
    if (!empresa) throw new OperationalError("Empresa do evento não encontrada.", { code: "COMPANY_NOT_FOUND" });
    const defaultStage = String(empresa.etapaEntradaPadrao || "");
    const profileStageExists = await model("PerfilFaturamento").exists({ empresaOmie: empresa._id, etapaEntrada: event.etapa, status: "ativo" });
    if (String(event.etapa) !== defaultStage && !profileStageExists) {
      event.status = "ignorado";
      event.motivo = `Etapa ${event.etapa} não configurada para faturamento.`;
      event.lockUntil = undefined;
      event.lockedBy = undefined;
      event.proximaTentativaEm = undefined;
      await event.save();
      return event;
    }
    if (!event.codigoOS) throw new OperationalError("Código da OS ausente no evento.", { code: "OS_ID_REQUIRED" });
    const fatura = await ensureInvoice(event, empresa);
    event.fatura = fatura._id;
    await event.save();
    fatura.etapaAtual = "carregando_os_cliente";
    await fatura.save();
    const prepared = await prepareInvoice(event, empresa, fatura);
    if (prepared.duplicate) {
      event.lockUntil = undefined;
      event.lockedBy = undefined;
      event.proximaTentativaEm = undefined;
      await event.save();
      return event;
    }
    event.status = "processado";
    event.motivo = "Evento preparado e vinculado à fatura.";
    event.lockUntil = undefined;
    event.lockedBy = undefined;
    event.proximaTentativaEm = undefined;
    await event.save();
    await processInvoiceById(fatura._id);
    return event;
  } catch (error) {
    const normalized = normalizeError(error);
    event.status = normalized.transient ? "aceito" : "falha_validacao";
    event.motivo = normalized.message;
    event.proximaTentativaEm = normalized.transient ? nextRetryAt(event.tentativas) : undefined;
    event.lockUntil = undefined;
    event.lockedBy = undefined;
    await event.save();
    if (event.fatura) {
      const fatura = await model("Fatura").findById(event.fatura);
      if (fatura) await handleFailure(fatura, error);
    }
    return event;
  }
}

async function reprocessInvoice(id, { resetType } = {}) {
  const Fatura = model("Fatura");
  const Execucao = model("ExecucaoIntegracao");
  const fatura = await Fatura.findById(id);
  if (!fatura) throw new OperationalError("Fatura não encontrada.", { code: "INVOICE_NOT_FOUND", statusCode: 404 });
  if (fatura.status === "cancelada") throw new OperationalError("Fatura cancelada precisa ser reaberta antes do reprocessamento.", { code: "INVOICE_CANCELLED" });
  if (resetType) {
    await Execucao.deleteMany({ fatura: fatura._id, tipo: resetType });
    if (resetType === "gerar_pdf") {
      fatura.pdfBase64 = undefined;
      fatura.pdfHash = undefined;
      fatura.nomeArquivo = undefined;
    }
    if (resetType === "anexar_documento") fatura.anexoOmieId = undefined;
    if (resetType === "enviar_email") fatura.providerMessageId = undefined;
    if (resetType === "gerar_adiantamento") fatura.adiantamentoConfirmado = false;
  }
  fatura.status = "pendente";
  fatura.proximaTentativaEm = new Date();
  fatura.lockUntil = undefined;
  fatura.lockedBy = undefined;
  fatura.ultimoErroCodigo = undefined;
  fatura.ultimoErroMensagem = undefined;
  await fatura.save();
  return processInvoiceById(fatura._id);
}

async function reprocessEvent(id) {
  const Evento = model("EventoWebhook");
  const event = await Evento.findById(id);
  if (!event) throw new OperationalError("Evento não encontrado.", { code: "EVENT_NOT_FOUND", statusCode: 404 });
  if (["ignorado", "duplicado"].includes(event.status)) {
    throw new OperationalError("Eventos ignorados ou duplicados não podem ser reprocessados.", { code: "EVENT_NOT_REPROCESSABLE", statusCode: 409 });
  }
  event.status = "aceito";
  event.motivo = "Reprocessamento solicitado por usuário autorizado.";
  event.proximaTentativaEm = new Date();
  event.lockUntil = undefined;
  event.lockedBy = undefined;
  await event.save();

  let fatura = event.fatura ? await model("Fatura").findById(event.fatura) : null;
  if (!fatura) {
    fatura = await model("Fatura").findOne({ eventoWebhook: event._id }).sort({ createdAt: 1 });
    if (fatura) {
      event.fatura = fatura._id;
      await event.save();
    }
  }
  if (fatura) {
    if (fatura.status === "cancelada") {
      throw new OperationalError("Fatura cancelada não pode ter a preparação reprocessada.", { code: "INVOICE_CANCELLED", statusCode: 409 });
    }
    if (fatura.pdfHash || fatura.anexoOmieId || fatura.providerMessageId || fatura.adiantamentoConfirmado) {
      throw new OperationalError("A preparação não pode ser refeita após efeitos externos. Use o reprocessamento seletivo.", {
        code: "PREPARATION_ALREADY_EFFECTIVE",
        statusCode: 409,
      });
    }
    fatura.status = "pendente";
    fatura.etapaAtual = "carregando_os_cliente";
    fatura.proximaTentativaEm = new Date();
    fatura.lockUntil = undefined;
    fatura.lockedBy = undefined;
    fatura.ultimoErroCodigo = undefined;
    fatura.ultimoErroMensagem = undefined;
    fatura.acaoRecomendada = undefined;
    await fatura.save();
  }
  return processEventById(event._id);
}

module.exports = {
  quoteReferenceDate,
  templateVariables,
  resolveProfile,
  resolvePublishedVersion,
  processEventById,
  processInvoiceById,
  reprocessInvoice,
  reprocessEvent,
};
