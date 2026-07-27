const { defineModel, fields } = require("@oondemand/oon-core-back");
const { withOptions } = require("../lib/model");

const entry = defineModel({
  name: "ModeloDocumento",
  singular: "modelo-documento",
  basePath: "/modelos-documento",
  schema: {
    codigo: withOptions(fields.string({ required: true, label: "Código" }), { unique: true }),
    nome: fields.string({ required: true, label: "Nome" }),
    descricao: fields.string({ label: "Descrição" }),
    idiomasSuportados: fields.string({ required: true, label: "Idiomas Suportados", default: "pt-BR" }),
    versaoPublicada: fields.ref("VersaoModeloDocumento", { label: "Versão Publicada" }),
    status: fields.enum(["ativo", "inativo", "arquivado"], {
      required: true,
      default: "ativo",
      label: "Status",
    }),
  },
  crud: { enabled: true, roles: { write: ["administrador", "gestor_faturamento"] } },
});

module.exports = entry;
