function mask(value, visible = 4) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= visible) return "*".repeat(text.length);
  return `${"*".repeat(Math.max(4, text.length - visible))}${text.slice(-visible)}`;
}

module.exports = { mask };
