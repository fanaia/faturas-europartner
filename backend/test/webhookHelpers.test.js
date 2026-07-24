const test = require("node:test");
const assert = require("node:assert/strict");
const { extractEvent, sanitizePayload, secureEqual } = require("../src/services/webhookPayload");

test("extrai evento de OS no formato legado", () => {
  assert.deepEqual(extractEvent({ topic: "OrdemServico.EtapaAlterada", event: { idOrdemServico: 123, etapa: "30" } }), {
    topic: "OrdemServico.EtapaAlterada", codigoOS: 123, numeroOS: "", etapa: "30",
  });
});

test("sanitiza credenciais do payload", () => {
  assert.equal(sanitizePayload({ appSecret: "secret", event: { id: 1 } }).appSecret, "[REDACTED]");
});

test("comparação de token é constante para tamanhos iguais", () => {
  assert.equal(secureEqual("abc", "abc"), true);
  assert.equal(secureEqual("abc", "abd"), false);
  assert.equal(secureEqual("abc", "abcd"), false);
});
