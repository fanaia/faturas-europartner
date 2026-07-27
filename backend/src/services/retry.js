function retryDelay(attempt, baseMs = 30000) {
  const exponent = Math.max(0, Number(attempt || 1) - 1);
  const deterministic = Math.min(Number(baseMs || 30000) * 2 ** exponent, 60 * 60 * 1000);
  return deterministic;
}

function nextRetryAt(attempt, now = Date.now(), baseMs = 30000) {
  return new Date(now + retryDelay(attempt, baseMs));
}

module.exports = { retryDelay, nextRetryAt };
