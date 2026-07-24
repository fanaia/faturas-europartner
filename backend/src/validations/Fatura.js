const { defineValidation } = require("@oondemand/oon-core-back");

const SYSTEM_FIELDS = new Set([
  "chaveIdempotencia", "empresaOmie", "eventoWebhook", "codigoOS", "numeroOS", "etapaOrigem",
  "codigoClienteOmie", "nomeCliente", "emailCliente", "paisCliente", "perfilFaturamento",
  "modeloDocumento", "versaoModelo", "idioma", "moeda", "dataReferenciaCotacao", "cotacaoMoeda",
  "cotacaoOficial", "tipoAjusteCotacao", "valorAjusteCotacao", "cotacaoEfetiva", "dadosOsSnapshotJson",
  "pdfBase64", "pdfHash", "nomeArquivo", "anexoOmieId", "destinatarios", "copias", "providerMessageId",
  "adiantamentoSolicitado", "adiantamentoConfirmado", "etapaAtual", "status", "tentativas",
  "proximaTentativaEm", "ultimoErroCodigo", "ultimoErroMensagem", "acaoRecomendada", "iniciadaEm",
  "concluidaEm", "tempoProcessamentoMs", "lockUntil", "lockedBy"
]);

defineValidation("Fatura", async (dados, contexto) => {
  if (contexto?.op === "create") throw new Error("Faturas são criadas somente pelo processamento do webhook.");
  const changes = Object.keys(contexto?.changes || {});
  const forbidden = changes.filter((field) => SYSTEM_FIELDS.has(field));
  if (forbidden.length) throw new Error(`Campos controlados pelo processo não podem ser alterados: ${forbidden.join(", ")}.`);
  if (dados.status === "cancelada" && !String(dados.motivoCancelamento || "").trim()) {
    throw new Error("Informe o motivo do cancelamento.");
  }
});
