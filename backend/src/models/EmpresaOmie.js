const { defineModel, fields } = require("@oondemand/oon-core-back");
const { withOptions } = require("../lib/model");

const entry = defineModel({
  name: "EmpresaOmie",
  singular: "empresa-omie",
  basePath: "/empresas-omie",
  schema: {
    nome: fields.string({ required: true, label: "Nome" }),
    razaoSocial: fields.string({ required: true, label: "Razão Social" }),
    cnpj: withOptions(fields.string({ required: true, label: "CNPJ" }), { unique: true }),
    codigoInterno: withOptions(fields.string({ required: true, label: "Código Interno" }), { unique: true }),
    appKeyMasked: fields.string({ label: "App Key", searchable: false }),
    etapaEntradaPadrao: fields.string({ required: true, label: "Etapa de Entrada" }),
    etapaSucessoPadrao: fields.string({ required: true, label: "Etapa de Sucesso" }),
    etapaErroPadrao: fields.string({ required: true, label: "Etapa de Erro" }),
    categoriaAdiantamento: fields.string({ label: "Categoria de Adiantamento" }),
    contaCorrenteAdiantamento: fields.string({ label: "Conta Corrente de Adiantamento" }),
    emailRemetente: fields.string({ required: true, label: "E-mail Remetente" }),
    nomeRemetente: fields.string({ required: true, label: "Nome do Remetente" }),
    emailCopiaPadrao: fields.string({ label: "Cópias Padrão" }),
    status: fields.enum(["ativa", "inativa", "homologacao", "arquivada"], {
      required: true,
      default: "homologacao",
      label: "Status",
    }),
    ultimaComunicacaoSucessoEm: fields.date({ label: "Última Comunicação" }),
    ultimoErroComunicacao: fields.string({ label: "Último Erro", searchable: false }),
  },
  crud: { enabled: true, roles: { write: ["administrador"] } },
});

entry.mongooseModel.schema.add({
  appKeyEncrypted: { type: String, select: false },
  appSecretEncrypted: { type: String, select: false },
  webhookTokenEncrypted: { type: String, select: false },
});
entry.mongooseModel.schema.index({ status: 1, codigoInterno: 1 });
module.exports = entry;
