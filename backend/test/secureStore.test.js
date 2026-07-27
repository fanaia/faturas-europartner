const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { encryptWithKey, decryptWithKey, maskSecret } = require("../src/lib/secureStore");

test("criptografa e descriptografa segredo com AES-256-GCM", () => {
  const key = crypto.randomBytes(32);
  const encrypted = encryptWithKey("SG.segredo-de-teste", key);
  assert.notEqual(encrypted, "SG.segredo-de-teste");
  assert.match(encrypted, /^v1:/);
  assert.equal(decryptWithKey(encrypted, key), "SG.segredo-de-teste");
});

test("rejeita descriptografia com chave diferente", () => {
  const encrypted = encryptWithKey("app-secret", crypto.randomBytes(32));
  assert.throws(() => decryptWithKey(encrypted, crypto.randomBytes(32)));
});

test("mascara segredo sem expor o conteúdo completo", () => {
  assert.equal(maskSecret("1234567890", 4), "********7890");
});
