const { definePipeline } = require("@oondemand/oon-core-back");

definePipeline("PublicacaoModelo", {
  model: "VersaoModeloDocumento",
  stageField: "status",
  stages: ["rascunho", "homologacao", "publicado", "substituido", "arquivado"],
  terminalStages: ["substituido", "arquivado"],
  audit: true,
});
