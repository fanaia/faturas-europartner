const { definePipeline } = require("@oondemand/oon-core-back");

definePipeline("ProcessamentoFatura", {
  model: "Fatura",
  stageField: "etapaAtual",
  stages: [
    "recebida", "validando_evento", "carregando_os_cliente", "identificando_perfil", "obtendo_cotacao",
    "gerando_documento", "anexando_omie", "enviando_email", "gerando_adiantamento",
    "atualizando_etapa_omie", "aguardando_retry", "falha_operacional", "concluida", "cancelada",
  ],
  terminalStages: ["concluida", "cancelada"],
  audit: true,
});
