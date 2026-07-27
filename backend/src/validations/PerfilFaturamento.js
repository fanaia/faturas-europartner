const { defineValidation } = require("@oondemand/oon-core-back");

function parseJson(value, label) {
  if (!value) return;
  try {
    JSON.parse(value);
  } catch {
    throw new Error(`${label} deve conter JSON válido.`);
  }
}

defineValidation("PerfilFaturamento", async (dados) => {
  if (dados.vigenteAte && new Date(dados.vigenteAte) < new Date(dados.vigenteDesde)) {
    throw new Error("Vigente até não pode ser anterior a vigente desde.");
  }
  if (dados.tipoAjusteCotacao === "percentual" && Math.abs(Number(dados.valorAjusteCotacao || 0)) > 100) {
    throw new Error("Ajuste percentual deve estar entre -100 e 100.");
  }
  if (dados.politicaAnexos === "selecao_manual" && dados.status === "ativo") {
    throw new Error("Seleção manual de anexos ainda não pode ser ativada no processamento automático.");
  }
  parseJson(dados.regraImpostosJson, "Regra de impostos");
});
