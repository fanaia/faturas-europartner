const { defineModel, fields } = require("@oondemand/oon-core-back");
const { withOptions } = require("../lib/model");

const entry = defineModel({
  name: "EventoWebhook",
  singular: "evento-webhook",
  basePath: "/eventos-webhook",
  schema: {
    eventId: withOptions(fields.string({ required: true, label: "ID do Evento" }), { unique: true }),
    empresaOmie: fields.ref("EmpresaOmie", { required: true, label: "Empresa Omie" }),
    topic: fields.string({ required: true, label: "Tópico" }),
    codigoOS: fields.string({ label: "Código da OS" }),
    numeroOS: fields.string({ label: "Número da OS" }),
    etapa: fields.string({ label: "Etapa Recebida" }),
    payloadSanitizadoJson: fields.string({ required: true, label: "Payload Sanitizado", searchable: false }),
    payloadHash: fields.string({ required: true, label: "Hash do Payload", searchable: false }),
    recebidoEm: fields.date({ required: true, label: "Recebido Em", default: Date.now }),
    status: fields.enum(["recebido", "ignorado", "duplicado", "aceito", "processado", "falha_validacao"], {
      required: true,
      default: "recebido",
      label: "Status",
    }),
    motivo: fields.string({ label: "Motivo" }),
    fatura: fields.ref("Fatura", { label: "Fatura" }),
    duplicadoDe: fields.ref("EventoWebhook", { label: "Duplicado De" }),
    tentativas: fields.number({ label: "Tentativas", default: 0 }),
    proximaTentativaEm: fields.date({ label: "Próxima Tentativa" }),
    lockUntil: fields.date({ label: "Lock Até" }),
    lockedBy: fields.string({ label: "Lock Por" }),
  },
  crud: { enabled: true, roles: { write: ["administrador"] } },
});

entry.mongooseModel.schema.index({ status: 1, proximaTentativaEm: 1, lockUntil: 1 });
module.exports = entry;
