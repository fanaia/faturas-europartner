const test = require("node:test");
const assert = require("node:assert/strict");
const { isAdvanceAlreadyApplied, buildAdvancePayload } = require("../src/services/advance");

test("reconhece adiantamento já aplicado em todas as parcelas", () => {
  assert.equal(isAdvanceAlreadyApplied({ Parcelas: [{ parcela_adiantamento: "S" }, { parcela_adiantamento: "S" }] }), true);
  assert.equal(isAdvanceAlreadyApplied({ Parcelas: [{ parcela_adiantamento: "S" }, { parcela_adiantamento: "N" }] }), false);
});

test("monta alteração de OS preservando parcelas e aplicando parâmetros", () => {
  const payload = buildAdvancePayload(
    {
      Cabecalho: { nCodOS: 10, dDtPrevisao: "24/07/2026" },
      Observacoes: { cObsOS: "Original" },
      Parcelas: [{ nParcela: 1, nValor: 100 }],
    },
    { categoria: "1.01", contaCorrente: "123", observacao: "Central" }
  );
  assert.equal(payload.Cabecalho.cCodParc, "999");
  assert.equal(payload.Parcelas[0].parcela_adiantamento, "S");
  assert.equal(payload.Parcelas[0].categoria_adiantamento, "1.01");
  assert.equal(payload.Parcelas[0].conta_corrente_adiantamento, "123");
  assert.equal(payload.Observacoes.cObsOS, "Central\nOriginal");
});
