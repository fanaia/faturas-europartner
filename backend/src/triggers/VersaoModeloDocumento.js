const { defineTrigger } = require("@oondemand/oon-core-back");
const { sha256 } = require("../lib/hash");

defineTrigger("VersaoModeloDocumento", {
  before: async (doc) => {
    doc.hashConteudo = sha256([
      doc.motor,
      doc.conteudoDocumento,
      doc.estilos,
      doc.assuntoEmail,
      doc.corpoEmail,
      doc.variaveisPermitidas,
    ].join("\n---\n"));
    if (doc.status === "publicado" && !doc.publicadoEm) doc.publicadoEm = new Date();
  },
  after: async (doc) => {
    if (doc.status !== "publicado") return;
    const { model } = require("../lib/model");
    const ModeloDocumento = model("ModeloDocumento");
    await ModeloDocumento.updateOne(
      { _id: doc.modeloDocumento },
      { $set: { versaoPublicada: doc._id, status: "ativo" } }
    );
    await model("VersaoModeloDocumento").updateMany(
      { modeloDocumento: doc.modeloDocumento, idioma: doc.idioma, _id: { $ne: doc._id }, status: "publicado" },
      { $set: { status: "substituido" } }
    );
  },
});
