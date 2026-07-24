const { defineValidation } = require("@oondemand/oon-core-back");
const { assertSecretRef } = require("../lib/secrets");
const { validateCnpj } = require("../services/cnpj");

defineValidation("EmpresaOmie", async (dados) => {
  if (!validateCnpj(dados.cnpj)) throw new Error("CNPJ inválido.");
  assertSecretRef(dados.secretRef, "Referência do segredo Omie");
  assertSecretRef(dados.webhookTokenRef, "Referência do token do webhook");
  assertSecretRef(dados.emailProviderSecretRef || "SENDGRID_API_KEY", "Referência do segredo de e-mail");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(dados.codigoInterno || ""))) {
    throw new Error("Código interno deve usar kebab-case.");
  }
});
