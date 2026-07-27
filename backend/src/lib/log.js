const REDACT_KEYS = new Set([
  "app_secret",
  "appSecret",
  "app_key",
  "appKey",
  "authorization",
  "token",
  "password",
  "apiKey",
  "cArquivo",
  "fileBase64",
]);

function redact(value, depth = 0) {
  if (depth > 8) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, current]) => {
      acc[key] = REDACT_KEYS.has(key) ? "[REDACTED]" : redact(current, depth + 1);
      return acc;
    }, {});
  }
  return value;
}

function write(level, message, context = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME || "faturas-europartner",
    message,
    ...redact(context),
  };
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  method(JSON.stringify(record));
}

module.exports = {
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
  redact,
};
