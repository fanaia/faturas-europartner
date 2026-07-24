const test = require("node:test");
const assert = require("node:assert/strict");
const { retryDelay } = require("../src/services/retry");

test("retry usa backoff exponencial com teto", () => {
  assert.equal(retryDelay(1, 1000), 1000);
  assert.equal(retryDelay(2, 1000), 2000);
  assert.equal(retryDelay(20, 1000), 3600000);
});
