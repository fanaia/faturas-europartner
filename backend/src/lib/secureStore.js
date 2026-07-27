const crypto = require("node:crypto");
const { model } = require("./model");

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function encryptWithKey(value, keyBuffer) {
  const text = String(value || "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptWithKey(value, keyBuffer) {
  const text = String(value || "");
  if (!text) return "";
  const [version, ivBase64, tagBase64, encryptedBase64] = text.split(":");
  if (version !== VERSION || !ivBase64 || !tagBase64 || !encryptedBase64) {
    const error = new Error("Segredo armazenado em formato inválido.");
    error.code = "INVALID_ENCRYPTED_SECRET";
    throw error;
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedBase64, "base64")), decipher.final()]).toString("utf8");
}

async function getEncryptionKey() {
  const Configuracao = model("ConfiguracaoCentral");
  const config = await Configuracao.findOneAndUpdate(
    { codigo: "principal" },
    {
      $setOnInsert: {
        codigo: "principal",
        publicBackendUrl: "https://faturas-europartner.central.oondemand.online",
        omieApiUrl: "https://app.omie.com.br/api/v1/",
        omieTimeoutMs: 20000,
        bacenPtaxUrl: "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata",
        bacenTimeoutMs: 15000,
        bacenMaxLookbackDays: 30,
        processorEnabled: false,
        processorPollIntervalMs: 5000,
        processorBatchSize: 10,
        processorLockMs: 300000,
        processorMaxAttempts: 5,
        processorRetryBaseMs: 30000,
        webhookRateLimitPerMinute: 120,
        pdfRenderTimeoutMs: 30000,
        emailMaxAttachmentsBytes: 20000000,
        sendgridConfigured: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select("+encryptionKeyMaterial");

  if (!config.encryptionKeyMaterial) {
    config.encryptionKeyMaterial = crypto.randomBytes(32).toString("base64");
    await config.save();
  }
  return Buffer.from(config.encryptionKeyMaterial, "base64");
}

async function encryptSecret(value) {
  return encryptWithKey(value, await getEncryptionKey());
}

async function decryptSecret(value) {
  return decryptWithKey(value, await getEncryptionKey());
}

function maskSecret(value, visible = 4) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= visible) return "*".repeat(text.length);
  return `${"*".repeat(Math.max(8, text.length - visible))}${text.slice(-visible)}`;
}

module.exports = {
  encryptWithKey,
  decryptWithKey,
  getEncryptionKey,
  encryptSecret,
  decryptSecret,
  maskSecret,
};
