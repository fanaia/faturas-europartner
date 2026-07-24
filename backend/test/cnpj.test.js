const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCnpj } = require("../src/services/cnpj");

test("valida CNPJ com e sem máscara", () => {
  assert.equal(validateCnpj("11.222.333/0001-81"), true);
  assert.equal(validateCnpj("11222333000181"), true);
});

test("rejeita CNPJ inválido ou repetido", () => {
  assert.equal(validateCnpj("11.222.333/0001-82"), false);
  assert.equal(validateCnpj("00.000.000/0000-00"), false);
});
