function isAdvanceAlreadyApplied(os) {
  const parcels = Array.isArray(os?.Parcelas) ? os.Parcelas : [];
  return parcels.length > 0 && parcels.every((item) => item.parcela_adiantamento === "S");
}

function buildAdvancePayload(os, { categoria, contaCorrente, observacao }) {
  if (!Array.isArray(os?.Parcelas) || !os.Parcelas.length) throw new Error("A OS não possui parcelas para adiantamento.");
  if (!categoria || !contaCorrente) throw new Error("Categoria e conta corrente de adiantamento são obrigatórias.");
  if (!os?.Cabecalho?.nCodOS) throw new Error("Código da OS é obrigatório para gerar o adiantamento.");

  return {
    Cabecalho: {
      nCodOS: os.Cabecalho.nCodOS,
      dDtPrevisao: os.Cabecalho.dDtPrevisao,
      cCodParc: "999",
    },
    Observacoes: {
      cObsOS: [observacao, os.Observacoes?.cObsOS].filter(Boolean).join("\n"),
    },
    Parcelas: os.Parcelas.map((parcela) => ({
      ...parcela,
      parcela_adiantamento: "S",
      categoria_adiantamento: categoria,
      conta_corrente_adiantamento: contaCorrente,
    })),
  };
}

module.exports = { isAdvanceAlreadyApplied, buildAdvancePayload };
