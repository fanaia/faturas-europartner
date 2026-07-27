const { defineOmieMapping } = require("@oondemand/oon-core-back");

defineOmieMapping("OrdemServicoFatura", {
  resource: "servicos/os/",
  externalId: "Cabecalho.nCodOS",
  model: "Fatura",
  direction: "inbound-triggered",
  map: {
    codigoOS: "Cabecalho.nCodOS",
    numeroOS: "Cabecalho.cNumOS",
    codigoClienteOmie: "Cabecalho.nCodCli",
    etapaOrigem: "Cabecalho.cEtapa",
  },
});
