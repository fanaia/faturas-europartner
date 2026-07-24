const axios = require("axios");
const { readOmieCredentials } = require("../../lib/secrets");
const { OperationalError, normalizeError } = require("../../lib/error");

const client = axios.create({
  baseURL: process.env.OMIE_API_URL || "https://app.omie.com.br/api/v1/",
  timeout: Number(process.env.OMIE_TIMEOUT_MS || 20_000),
  headers: { "Content-Type": "application/json" },
});

async function callOmie(empresa, endpoint, call, param) {
  const credentials = readOmieCredentials(empresa.secretRef);
  try {
    const response = await client.post(endpoint, {
      call,
      app_key: credentials.appKey,
      app_secret: credentials.appSecret,
      param: Array.isArray(param) ? param : [param],
    });
    if (response.data?.faultstring) {
      throw new OperationalError(response.data.faultstring, { code: response.data.faultcode || "OMIE_FAULT" });
    }
    return response.data;
  } catch (error) {
    const fault = error?.response?.data?.faultstring;
    if (fault) {
      throw new OperationalError(`Omie/${call}: ${fault}`, {
        code: error.response.data.faultcode || "OMIE_BUSINESS_FAULT",
        statusCode: 422,
        transient: false,
        details: { endpoint, call },
      });
    }
    const normalized = normalizeError(error);
    throw new OperationalError(`Omie/${call}: ${normalized.message}`, {
      code: normalized.code,
      statusCode: normalized.status,
      transient: normalized.transient,
      details: { endpoint, call },
    });
  }
}

module.exports = { callOmie };
