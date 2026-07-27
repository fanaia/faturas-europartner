const axios = require("axios");
const { getCompanyCredentials, getCentralConfiguration } = require("../../services/configurationService");
const { OperationalError, normalizeError } = require("../../lib/error");

async function callOmie(empresa, endpoint, call, param) {
  const [credentials, configuration] = await Promise.all([
    getCompanyCredentials(empresa),
    getCentralConfiguration(),
  ]);
  const url = new URL(String(endpoint || "").replace(/^\/+/, ""), configuration.omieApiUrl).toString();
  try {
    const response = await axios.post(
      url,
      {
        call,
        app_key: credentials.appKey,
        app_secret: credentials.appSecret,
        param: Array.isArray(param) ? param : [param],
      },
      {
        timeout: Number(configuration.omieTimeoutMs || 20000),
        headers: { "Content-Type": "application/json" },
      }
    );
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
