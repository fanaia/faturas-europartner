function parseOmieDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00.000Z`);
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function formatBacenDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

function startOfUtcDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(date, days) {
  const d = startOfUtcDay(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

module.exports = { parseOmieDate, formatBacenDate, startOfUtcDay, addUtcDays };
