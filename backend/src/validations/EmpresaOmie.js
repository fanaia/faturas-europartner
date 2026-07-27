const { defineValidation } = require("@oondemand/oon-core-back");
const { validateCnpj } = require("../services/cnpj");

defineValidation("EmpresaOmie", async (dados) => {
  if (!validateCnpj(dados.cnpj)) throw new Error("CNPJ inválido.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(dados.codigoInterno || ""))) {
    throw new Error("Código interno deve usar kebab-case.");
  }
});
