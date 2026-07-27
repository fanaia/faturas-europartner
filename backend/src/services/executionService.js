const { model } = require("../lib/model");
const { normalizeError } = require("../lib/error");
const { nextRetryAt } = require("./retry");
const { getCentralConfiguration } = require("./configurationService");

function safeParse(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

async function runStep({
  fatura,
  empresa,
  type,
  system,
  direction = "outbound",
  key,
  requestSummary,
  summarizeResult,
  fn,
}) {
  const Execucao = model("ExecucaoIntegracao");
  const configuration = await getCentralConfiguration();
  const maxAttempts = Number(configuration.processorMaxAttempts || 5);
  const retryBaseMs = Number(configuration.processorRetryBaseMs || 30000);
  let execution = await Execucao.findOne({ chaveIdempotencia: key });
  if (execution?.status === "concluida") {
    return { skipped: true, execution, result: safeParse(execution.responseResumoJson) };
  }
  if (!execution) {
    execution = await Execucao.create({
      fatura: fatura._id,
      empresaOmie: empresa._id,
      tipo: type,
      sistema: system,
      direcao: direction,
      chaveIdempotencia: key,
      status: "pendente",
      tentativaAtual: 0,
      maxTentativas: maxAttempts,
      requestResumoJson: JSON.stringify(requestSummary || {}),
      executadaPor: "processo_sistema",
    });
  }

  execution.status = "em_processamento";
  execution.tentativaAtual += 1;
  execution.iniciadaEm = new Date();
  execution.erroCodigo = undefined;
  execution.erroMensagem = undefined;
  await execution.save();

  const started = Date.now();
  try {
    const result = await fn(execution);
    const summary = summarizeResult ? summarizeResult(result) : result;
    execution.status = "concluida";
    execution.responseResumoJson = JSON.stringify(summary || {});
    execution.finalizadaEm = new Date();
    execution.duracaoMs = Date.now() - started;
    execution.proximaTentativaEm = undefined;
    await execution.save();
    return { skipped: false, execution, result };
  } catch (error) {
    const normalized = normalizeError(error);
    const canRetry = normalized.transient && execution.tentativaAtual < execution.maxTentativas;
    execution.status = canRetry ? "aguardando_retry" : "falha_definitiva";
    execution.erroCodigo = normalized.code;
    execution.erroMensagem = normalized.message;
    execution.finalizadaEm = new Date();
    execution.duracaoMs = Date.now() - started;
    execution.proximaTentativaEm = canRetry
      ? nextRetryAt(execution.tentativaAtual, Date.now(), retryBaseMs)
      : undefined;
    await execution.save();
    error.execution = execution;
    error.normalized = normalized;
    throw error;
  }
}

module.exports = { runStep, safeParse };
