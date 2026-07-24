const crypto = require("node:crypto");
const { redact } = require("../lib/log");

function secureEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sanitizePayload(payload) {
  return redact(payload || {});
}

function extractEvent(payload) {
  const event = payload?.event || {};
  return {
    topic: payload?.topic || "",
    codigoOS: event.idOrdemServico || event.nCodOS || event.codigoOS || "",
    numeroOS: event.numeroOrdemServico || event.cNumOS || "",
    etapa: event.etapa || event.cEtapa || "",
  };
}

module.exports = { secureEqual, sanitizePayload, extractEvent };
