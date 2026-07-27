const { defineModel, fields } = require("@oondemand/oon-core-back");
const { withOptions } = require("../lib/model");

const entry = defineModel({
  name: "CotacaoMoeda",
  singular: "cotacao-moeda",
  basePath: "/cotacoes-moeda",
  schema: {
    chaveCotacao: withOptions(fields.string({ required: true, label: "Chave" }), { unique: true }),
    moeda: fields.enum(["BRL", "USD", "EUR"], { required: true, label: "Moeda" }),
    dataSolicitada: fields.date({ required: true, label: "Data Solicitada" }),
    dataEfetiva: fields.date({ required: true, label: "Data Efetiva" }),
    tipoBoletim: fields.string({ required: true, label: "Tipo de Boletim" }),
    cotacaoCompra: fields.number({ required: true, label: "Cotação de Compra" }),
    cotacaoVenda: fields.number({ required: true, label: "Cotação de Venda" }),
    paridadeCompra: fields.number({ label: "Paridade de Compra" }),
    paridadeVenda: fields.number({ label: "Paridade de Venda" }),
    origem: fields.enum(["bacen_ptax", "brl_fixo", "ajuste_manual"], { required: true, label: "Origem" }),
    consultadaEm: fields.date({ required: true, label: "Consultada Em", default: Date.now }),
    respostaNormalizadaJson: fields.string({ label: "Resposta Normalizada", searchable: false }),
    status: fields.enum(["disponivel", "indisponivel", "substituida"], {
      required: true,
      default: "disponivel",
      label: "Status",
    }),
  },
  crud: { enabled: true, roles: { write: ["administrador", "gestor_faturamento"] } },
});

entry.mongooseModel.schema.index({ moeda: 1, dataSolicitada: 1, dataEfetiva: 1 });
module.exports = entry;
