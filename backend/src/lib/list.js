function splitList(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEmails(values) {
  return unique(values.flatMap(splitList).map((email) => email.toLowerCase())).filter((email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

module.exports = { splitList, unique, normalizeEmails };
