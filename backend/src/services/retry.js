function retryDelay(attempt, baseMs = Number(process.env.PROCESSOR_RETRY_BASE_MS || 30_000)) {
  const exponent = Math.max(0, Number(attempt || 1) - 1);
  const deterministic = Math.min(baseMs * 2 ** exponent, 60 * 60 * 1000);
  return deterministic;
}

function nextRetryAt(attempt, now = Date.now()) {
  return new Date(now + retryDelay(attempt));
}

module.exports = { retryDelay, nextRetryAt };
