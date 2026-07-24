const { model } = require("../lib/model");
const { stableStringify, sha256 } = require("../lib/hash");
const { readSecret, readOmieCredentials } = require("../lib/secrets");
const { OperationalError } = require("../lib/error");
const { secureEqual, sanitizePayload, extractEvent } = require("./webhookPayload");

const buckets = new Map();

function rateLimit(key) {
  const limit = Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || 120);
  const minute = Math.floor(Date.now() / 60_000);
  const bucketKey = `${key}:${minute}`;
  const value = (buckets.get(bucketKey) || 0) + 1;
  buckets.set(bucketKey, value);
  if (buckets.size > 5000) {
    for (const current of buckets.keys()) if (!current.endsWith(`:${minute}`)) buckets.delete(current);
  }
  if (value > limit) throw new OperationalError("Limite de webhooks excedido.", { code: "RATE_LIMIT", statusCode: 429, transient: true });
}

async function receiveWebhook({ empresaCode, token, payload }) {
  rateLimit(empresaCode);
  const Empresa = model("EmpresaOmie");
  const Evento = model("EventoWebhook");
  const empresa = await Empresa.findOne({ codigoInterno: empresaCode });
  if (!empresa || !["ativa", "homologacao"].includes(empresa.status)) {
    throw new OperationalError("Empresa Omie não encontrada ou inativa.", { code: "COMPANY_NOT_AVAILABLE", statusCode: 404 });
  }
  const expectedToken = readSecret(empresa.webhookTokenRef);
  if (!secureEqual(token, expectedToken)) {
    throw new OperationalError("Token do webhook inválido.", { code: "INVALID_WEBHOOK_TOKEN", statusCode: 401 });
  }
  if (payload?.ping === "omie") return { ping: true, empresa };

  const credentials = readOmieCredentials(empresa.secretRef);
  if (payload?.appKey && !secureEqual(payload.appKey, credentials.appKey)) {
    throw new OperationalError("App Key do evento não corresponde à empresa.", { code: "WEBHOOK_APP_MISMATCH", statusCode: 401 });
  }

  const extracted = extractEvent(payload);
  const sanitized = sanitizePayload(payload);
  const payloadHash = sha256(stableStringify(sanitized));
  const eventId = String(payload?.eventId || payload?.id || payload?.event?.id || `${empresa._id}:${payloadHash}`);
  const existing = await Evento.findOne({ eventId });
  if (existing) return { duplicate: true, event: existing, empresa };

  const acceptedTopic = extracted.topic === "OrdemServico.EtapaAlterada";
  const status = acceptedTopic ? "aceito" : "ignorado";
  const event = await Evento.create({
    eventId,
    empresaOmie: empresa._id,
    topic: extracted.topic || "desconhecido",
    codigoOS: String(extracted.codigoOS || ""),
    numeroOS: String(extracted.numeroOS || ""),
    etapa: String(extracted.etapa || ""),
    payloadSanitizadoJson: stableStringify(sanitized),
    payloadHash,
    recebidoEm: new Date(),
    status,
    motivo: acceptedTopic ? "Evento aceito para processamento." : "Tópico fora do escopo do MVP.",
  });
  return { duplicate: false, event, empresa };
}

module.exports = { receiveWebhook };
