const { defineModel, fields } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "VersaoModeloDocumento",
  singular: "versao-modelo-documento",
  basePath: "/versoes-modelo-documento",
  schema: {
    modeloDocumento: fields.ref("ModeloDocumento", { required: true, label: "Modelo" }),
    versao: fields.string({ required: true, label: "Versão" }),
    idioma: fields.enum(["pt-BR", "en-US", "es-ES"], { required: true, default: "pt-BR", label: "Idioma" }),
    motor: fields.enum(["template-seguro", "ejs-legado-somente-leitura"], {
      required: true,
      default: "template-seguro",
      label: "Motor",
    }),
    conteudoDocumento: fields.string({ required: true, label: "HTML do Documento", searchable: false }),
    estilos: fields.string({ label: "CSS", searchable: false }),
    assuntoEmail: fields.string({ required: true, label: "Assunto do E-mail", searchable: false }),
    corpoEmail: fields.string({ required: true, label: "Corpo do E-mail", searchable: false }),
    variaveisPermitidas: fields.string({ label: "Variáveis Permitidas", searchable: false }),
    hashConteudo: fields.string({ label: "Hash do Conteúdo", searchable: false }),
    status: fields.enum(["rascunho", "homologacao", "publicado", "substituido", "arquivado"], {
      required: true,
      default: "rascunho",
      label: "Status",
    }),
    publicadoEm: fields.date({ label: "Publicado Em" }),
    publicadoPor: fields.string({ label: "Publicado Por" }),
    modeloLegadoId: fields.string({ label: "ID Legado" }),
  },
  crud: { enabled: true, roles: { write: ["administrador", "gestor_faturamento"] } },
});

entry.mongooseModel.schema.index({ modeloDocumento: 1, versao: 1, idioma: 1 }, { unique: true });
module.exports = entry;
