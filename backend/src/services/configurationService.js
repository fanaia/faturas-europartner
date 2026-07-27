const crypto = require("node:crypto");
const { model } = require("../lib/model");
const { getEncryptionKey, encryptSecret, decryptSecret, maskSecret } = require("../lib/secureStore");
const { OperationalError } = require("../lib/error");

const NUMBER_RULES = {
  omieTimeoutMs: [1000, 120000],
  bacenTimeoutMs: [1000, 120000],
  bacenMaxLookbackDays: [0, 365],
  processorPollIntervalMs: [1000, 3600000],
  processorBatchSize: [1, 500],
  processorLockMs: [1000, 3600000],
  processorMaxAttempts: [1, 50],
  processorRetryBaseMs: [1000, 3600000],
  webhookRateLimitPerMinute: [1, 100000],
  pdfRenderTimeoutMs: [1000, 300000],
  emailMaxAttachmentsBytes: [1024, 100000000],
};

function normalizeUrl(value, label, { trailingSlash = false } = {}) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new OperationalError(`${label} deve conter uma URL válida.`, { code: "INVALID_CONFIGURATION_URL", statusCode: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new OperationalError(`${label} deve usar HTTP ou HTTPS.`, { code: "INVALID_CONFIGURATION_URL", statusCode: 400 });
  }
  const normalized = url.toString();
  return trailingSlash ? `${normalized.replace(/\/+$/, "")}/` : normalized.replace(/\/+$/, "");
}

function numberValue(payload, key, fallback) {
  if (payload[key] === undefined || payload[key] === null || payload[key] === "") return fallback;
  const value = Number(payload[key]);
  const [min, max] = NUMBER_RULES[key];
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new OperationalError(`${key} deve estar entre ${min} e ${max}.`, { code: "INVALID_CONFIGURATION_NUMBER", statusCode: 400 });
  }
  return value;
}

async function getConfigDocument({ secrets = false } = {}) {
  await getEncryptionKey();
  const selection = secrets ? "+sendgridApiKeyEncrypted +encryptionKeyMaterial" : "";
  return model("ConfiguracaoCentral").findOne({ codigo: "principal" }).select(selection);
}

function serializeConfiguration(config) {
  const object = config?.toObject ? config.toObject() : { ...config };
  delete object.encryptionKeyMaterial;
  delete object.sendgridApiKeyEncrypted;
  return object;
}

async function getCentralConfiguration() {
  return serializeConfiguration(await getConfigDocument());
}

async function saveCentralConfiguration(payload, user) {
  const config = await getConfigDocument({ secrets: true });
  config.publicBackendUrl = normalizeUrl(payload.publicBackendUrl ?? config.publicBackendUrl, "URL pública do backend");
  config.omieApiUrl = normalizeUrl(payload.omieApiUrl ?? config.omieApiUrl, "URL da API Omie", { trailingSlash: true });
  config.bacenPtaxUrl = normalizeUrl(payload.bacenPtaxUrl ?? config.bacenPtaxUrl, "URL PTAX BACEN");

  for (const key of Object.keys(NUMBER_RULES)) config[key] = numberValue(payload, key, config[key]);
  if (payload.processorEnabled !== undefined) config.processorEnabled = Boolean(payload.processorEnabled);

  const sendgridApiKey = String(payload.sendgridApiKey || "").trim();
  if (sendgridApiKey) {
    if (!sendgridApiKey.startsWith("SG.")) {
      throw new OperationalError("A chave do SendGrid deve iniciar com SG.", { code: "INVALID_SENDGRID_KEY", statusCode: 400 });
    }
    config.sendgridApiKeyEncrypted = await encryptSecret(sendgridApiKey);
    config.sendgridApiKeyMasked = maskSecret(sendgridApiKey);
    config.sendgridConfigured = true;
  } else if (payload.clearSendgridApiKey === true) {
    config.sendgridApiKeyEncrypted = undefined;
    config.sendgridApiKeyMasked = undefined;
    config.sendgridConfigured = false;
  }

  config.atualizadoEm = new Date();
  config.atualizadoPor = user?.email || user?.nome || "usuário autenticado";
  await config.save();
  return serializeConfiguration(config);
}

async function getSendgridApiKey() {
  const config = await getConfigDocument({ secrets: true });
  if (!config.sendgridApiKeyEncrypted) {
    throw new OperationalError("SendGrid ainda não foi configurado na página Configurações.", {
      code: "SENDGRID_NOT_CONFIGURED",
      statusCode: 503,
    });
  }
  return decryptSecret(config.sendgridApiKeyEncrypted);
}

async function loadCompanyWithSecrets(companyOrId) {
  const id = companyOrId?._id || companyOrId;
  const company = await model("EmpresaOmie")
    .findById(id)
    .select("+appKeyEncrypted +appSecretEncrypted +webhookTokenEncrypted");
  if (!company) throw new OperationalError("Empresa Omie não encontrada.", { code: "COMPANY_NOT_FOUND", statusCode: 404 });
  return company;
}

function companyConfigurationSummary(company, publicBackendUrl) {
  const base = String(publicBackendUrl || "").replace(/\/+$/, "");
  return {
    id: String(company._id),
    nome: company.nome,
    razaoSocial: company.razaoSocial,
    cnpj: company.cnpj,
    codigoInterno: company.codigoInterno,
    status: company.status,
    appKeyMasked: company.appKeyMasked || "",
    omieCredentialsConfigured: Boolean(company.appKeyEncrypted && company.appSecretEncrypted),
    webhookTokenConfigured: Boolean(company.webhookTokenEncrypted),
    webhookUrl: `${base}/api/integrations/omie/webhooks/ordem-servico/${company.codigoInterno}`,
    ultimaComunicacaoSucessoEm: company.ultimaComunicacaoSucessoEm,
    ultimoErroComunicacao: company.ultimoErroComunicacao,
  };
}

async function listCompanyConfigurations() {
  const config = await getCentralConfiguration();
  const companies = await model("EmpresaOmie")
    .find({})
    .sort({ nome: 1 })
    .select("+appKeyEncrypted +appSecretEncrypted +webhookTokenEncrypted");
  return companies.map((company) => companyConfigurationSummary(company, config.publicBackendUrl));
}

async function saveCompanyCredentials(companyId, payload) {
  const company = await loadCompanyWithSecrets(companyId);
  const appKey = String(payload.appKey || "").trim();
  const appSecret = String(payload.appSecret || "").trim();
  const webhookToken = String(payload.webhookToken || "").trim();

  if (appKey) {
    company.appKeyEncrypted = await encryptSecret(appKey);
    company.appKeyMasked = maskSecret(appKey);
  }
  if (appSecret) company.appSecretEncrypted = await encryptSecret(appSecret);
  if (webhookToken) company.webhookTokenEncrypted = await encryptSecret(webhookToken);

  if (!company.appKeyEncrypted || !company.appSecretEncrypted) {
    throw new OperationalError("Informe App Key e App Secret para concluir a configuração Omie.", {
      code: "OMIE_CREDENTIALS_REQUIRED",
      statusCode: 400,
    });
  }
  if (!company.webhookTokenEncrypted) {
    throw new OperationalError("Informe ou gere o token do webhook.", { code: "WEBHOOK_TOKEN_REQUIRED", statusCode: 400 });
  }

  await company.save();
  const config = await getCentralConfiguration();
  return companyConfigurationSummary(company, config.publicBackendUrl);
}

async function generateCompanyWebhookToken(companyId) {
  const company = await loadCompanyWithSecrets(companyId);
  const token = crypto.randomBytes(32).toString("base64url");
  company.webhookTokenEncrypted = await encryptSecret(token);
  await company.save();
  return { token };
}

async function getCompanyCredentials(companyOrId) {
  const company = await loadCompanyWithSecrets(companyOrId);
  if (!company.appKeyEncrypted || !company.appSecretEncrypted) {
    throw new OperationalError("Credenciais Omie não configuradas para a empresa.", {
      code: "OMIE_CREDENTIALS_NOT_CONFIGURED",
      statusCode: 503,
    });
  }
  return {
    appKey: await decryptSecret(company.appKeyEncrypted),
    appSecret: await decryptSecret(company.appSecretEncrypted),
  };
}

async function getCompanyWebhookToken(companyOrId) {
  const company = await loadCompanyWithSecrets(companyOrId);
  if (!company.webhookTokenEncrypted) {
    throw new OperationalError("Token do webhook não configurado para a empresa.", {
      code: "WEBHOOK_TOKEN_NOT_CONFIGURED",
      statusCode: 503,
    });
  }
  return decryptSecret(company.webhookTokenEncrypted);
}

module.exports = {
  getCentralConfiguration,
  saveCentralConfiguration,
  getSendgridApiKey,
  listCompanyConfigurations,
  saveCompanyCredentials,
  generateCompanyWebhookToken,
  getCompanyCredentials,
  getCompanyWebhookToken,
};
