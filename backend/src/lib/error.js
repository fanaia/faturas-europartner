class OperationalError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "OperationalError";
    this.code = options.code || "OPERATIONAL_ERROR";
    this.statusCode = options.statusCode || 422;
    this.transient = Boolean(options.transient);
    this.details = options.details;
  }
}

function normalizeError(error) {
  const status = error?.response?.status || error?.statusCode;
  const code = error?.code || error?.response?.data?.faultcode || "UNEXPECTED_ERROR";
  const message =
    error?.response?.data?.faultstring ||
    error?.response?.data?.message ||
    error?.message ||
    "Erro inesperado.";
  const transient =
    Boolean(error?.transient) ||
    [408, 425, 429, 500, 502, 503, 504].includes(Number(status)) ||
    ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"].includes(error?.code);

  return {
    code: String(code),
    message: String(message),
    status: Number(status) || 500,
    transient,
  };
}

module.exports = { OperationalError, normalizeError };
