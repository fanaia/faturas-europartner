const SECRET_REF_PATTERN = /^[A-Z][A-Z0-9_]{2,127}$/;

function assertSecretRef(ref, label = "Referência de segredo") {
  const normalized = String(ref || "").trim();
  if (!SECRET_REF_PATTERN.test(normalized)) {
    const error = new Error(`${label} deve ser o nome de uma variável de ambiente.`);
    error.code = "INVALID_SECRET_REF";
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function readSecret(ref, { required = true } = {}) {
  const name = assertSecretRef(ref);
  const value = process.env[name];
  if (!value && required) {
    const error = new Error(`Segredo ${name} não está configurado no ambiente.`);
    error.code = "SECRET_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function readJsonSecret(ref) {
  const raw = readSecret(ref);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("objeto esperado");
    return parsed;
  } catch (error) {
    const wrapped = new Error(`Segredo ${ref} deve conter JSON válido.`);
    wrapped.code = "INVALID_SECRET_FORMAT";
    wrapped.statusCode = 503;
    throw wrapped;
  }
}

function readOmieCredentials(ref) {
  const parsed = readJsonSecret(ref);
  const appKey = String(parsed.appKey || parsed.app_key || "").trim();
  const appSecret = String(parsed.appSecret || parsed.app_secret || "").trim();
  if (!appKey || !appSecret) {
    const error = new Error(`Segredo ${ref} precisa conter appKey e appSecret.`);
    error.code = "INVALID_OMIE_CREDENTIALS";
    error.statusCode = 503;
    throw error;
  }
  return { appKey, appSecret };
}

function mask(value, visible = 4) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= visible) return "*".repeat(text.length);
  return `${"*".repeat(Math.max(4, text.length - visible))}${text.slice(-visible)}`;
}

module.exports = { assertSecretRef, readSecret, readJsonSecret, readOmieCredentials, mask };
