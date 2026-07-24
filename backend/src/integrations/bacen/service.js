const axios = require("axios");
const { model } = require("../../lib/model");
const { formatBacenDate, startOfUtcDay, addUtcDays } = require("../../lib/date");
const { OperationalError, normalizeError } = require("../../lib/error");

const client = axios.create({
  baseURL: process.env.BACEN_PTAX_URL || "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata",
  timeout: Number(process.env.BACEN_TIMEOUT_MS || 15_000),
});

async function queryDay(currency, date) {
  const formatted = formatBacenDate(date);
  try {
    const response = await client.get("/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)", {
      params: {
        "@moeda": `'${currency}'`,
        "@dataCotacao": `'${formatted}'`,
        "$format": "json",
        "$top": 100,
      },
    });
    const values = response.data?.value || [];
    return values.find((item) => item.tipoBoletim === "Fechamento PTAX") || null;
  } catch (error) {
    const normalized = normalizeError(error);
    throw new OperationalError(`BACEN/PTAX: ${normalized.message}`, {
      code: normalized.code,
      statusCode: normalized.status,
      transient: normalized.transient,
    });
  }
}

async function getOrFetchQuote(currency, requestedDate) {
  const CotacaoMoeda = model("CotacaoMoeda");
  const requested = startOfUtcDay(requestedDate);
  const keyPrefix = `${currency}:${requested.toISOString().slice(0, 10)}:fechamento`;
  const cached = await CotacaoMoeda.findOne({ chaveCotacao: keyPrefix, status: "disponivel" });
  if (cached) return cached;

  if (currency === "BRL") {
    return CotacaoMoeda.findOneAndUpdate(
      { chaveCotacao: keyPrefix },
      {
        $setOnInsert: {
          chaveCotacao: keyPrefix,
          moeda: "BRL",
          dataSolicitada: requested,
          dataEfetiva: requested,
          tipoBoletim: "BRL fixo",
          cotacaoCompra: 1,
          cotacaoVenda: 1,
          origem: "brl_fixo",
          consultadaEm: new Date(),
          status: "disponivel",
        },
      },
      { upsert: true, new: true }
    );
  }

  const maxLookback = Number(process.env.BACEN_MAX_LOOKBACK_DAYS || 30);
  for (let offset = 0; offset <= maxLookback; offset += 1) {
    const effectiveDate = addUtcDays(requested, -offset);
    const quote = await queryDay(currency, effectiveDate);
    if (!quote) continue;
    return CotacaoMoeda.findOneAndUpdate(
      { chaveCotacao: keyPrefix },
      {
        $setOnInsert: {
          chaveCotacao: keyPrefix,
          moeda: currency,
          dataSolicitada: requested,
          dataEfetiva: effectiveDate,
          tipoBoletim: quote.tipoBoletim,
          cotacaoCompra: quote.cotacaoCompra,
          cotacaoVenda: quote.cotacaoVenda,
          paridadeCompra: quote.paridadeCompra,
          paridadeVenda: quote.paridadeVenda,
          origem: "bacen_ptax",
          consultadaEm: new Date(),
          respostaNormalizadaJson: JSON.stringify({
            moeda: currency,
            dataHoraCotacao: quote.dataHoraCotacao,
            tipoBoletim: quote.tipoBoletim,
            cotacaoCompra: quote.cotacaoCompra,
            cotacaoVenda: quote.cotacaoVenda,
            paridadeCompra: quote.paridadeCompra,
            paridadeVenda: quote.paridadeVenda,
          }),
          status: "disponivel",
        },
      },
      { upsert: true, new: true }
    );
  }

  throw new OperationalError(`Cotação ${currency} indisponível nos ${maxLookback} dias anteriores.`, {
    code: "PTAX_NOT_FOUND",
    transient: false,
  });
}

module.exports = { getOrFetchQuote, queryDay };
