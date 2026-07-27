function applyQuoteAdjustment(official, type, value) {
  const base = Number(official);
  const adjustment = Number(value || 0);
  if (!Number.isFinite(base) || base <= 0) throw new Error("Cotação oficial inválida.");
  if (type === "percentual") return Number((base * (1 + adjustment / 100)).toFixed(8));
  if (type === "valor_fixo") return Number((base + adjustment).toFixed(8));
  return Number(base.toFixed(8));
}

function chooseQuote(record, field = "compra") {
  const value = field === "venda" ? record.cotacaoVenda : record.cotacaoCompra;
  if (!Number.isFinite(Number(value))) throw new Error(`Cotação de ${field} indisponível.`);
  return Number(value);
}

module.exports = { applyQuoteAdjustment, chooseQuote };
