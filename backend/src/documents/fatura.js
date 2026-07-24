const { defineDocument } = require("@oondemand/oon-core-back");

defineDocument("FaturaPersonalizada", {
  model: "Fatura",
  versionModel: "VersaoModeloDocumento",
  fileField: "pdfBase64",
  hashField: "pdfHash",
  filenameField: "nomeArquivo",
  approval: false,
  attachments: true,
  immutableWhen: { status: "concluida" },
});
