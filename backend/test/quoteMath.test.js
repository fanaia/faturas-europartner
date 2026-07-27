const test = require("node:test");
const assert = require("node:assert/strict");
const { applyQuoteAdjustment, chooseQuote } = require("../src/services/quoteMath");

test("aplica ajuste percentual", () => assert.equal(applyQuoteAdjustment(5, "percentual", 10), 5.5));
test("aplica ajuste fixo", () => assert.equal(applyQuoteAdjustment(5, "valor_fixo", 0.2), 5.2));
test("seleciona cotação de venda", () => assert.equal(chooseQuote({ cotacaoCompra: 5, cotacaoVenda: 5.1 }, "venda"), 5.1));
