const { defineModel, fields } = require("@oondemand/oon-core-back");
const { withOptions } = require("../lib/model");

const entry = defineModel({
  name: "ConfiguracaoCentral",
  singular: "configuracao-central",
  basePath: "/configuracoes-central",
  schema: {
    codigo: withOptions(fields.string({ required: true, label: "Código" }), { unique: true }),
    publicBackendUrl: fields.string({ required: true, label: "URL Pública do Backend" }),
    omieApiUrl: fields.string({ required: true, label: "URL da API Omie" }),
    omieTimeoutMs: fields.number({ required: true, label: "Timeout Omie (ms)", default: 20000 }),
    bacenPtaxUrl: fields.string({ required: true, label: "URL PTAX BACEN" }),
    bacenTimeoutMs: fields.number({ required: true, label: "Timeout BACEN (ms)", default: 15000 }),
    bacenMaxLookbackDays: fields.number({ required: true, label: "Busca retroativa PTAX (dias)", default: 30 }),
    processorEnabled: fields.boolean({ required: true, label: "Processamento automático", default: false }),
    processorPollIntervalMs: fields.number({ required: true, label: "Intervalo do worker (ms)", default: 5000 }),
    processorBatchSize: fields.number({ required: true, label: "Tamanho do lote", default: 10 }),
    processorLockMs: fields.number({ required: true, label: "Tempo de lock (ms)", default: 300000 }),
    processorMaxAttempts: fields.number({ required: true, label: "Máximo de tentativas", default: 5 }),
    processorRetryBaseMs: fields.number({ required: true, label: "Base de retry (ms)", default: 30000 }),
    webhookRateLimitPerMinute: fields.number({ required: true, label: "Limite de webhooks por minuto", default: 120 }),
    pdfRenderTimeoutMs: fields.number({ required: true, label: "Timeout de geração do PDF (ms)", default: 30000 }),
    emailMaxAttachmentsBytes: fields.number({ required: true, label: "Limite total de anexos (bytes)", default: 20000000 }),
    sendgridApiKeyMasked: fields.string({ label: "Chave SendGrid", searchable: false }),
    sendgridConfigured: fields.boolean({ label: "SendGrid configurado", default: false }),
    atualizadoEm: fields.date({ label: "Atualizado em" }),
    atualizadoPor: fields.string({ label: "Atualizado por" }),
  },
  crud: { enabled: false, roles: { read: ["administrador"], write: ["administrador"] } },
});

entry.mongooseModel.schema.add({
  encryptionKeyMaterial: { type: String, select: false },
  sendgridApiKeyEncrypted: { type: String, select: false },
});

module.exports = entry;
