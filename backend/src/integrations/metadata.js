const { registry } = require("@oondemand/oon-core-back");

registry.registerIntegration("Omie", {
  name: "Omie",
  direction: "bidirectional",
  resources: ["servicos/os", "geral/clientes", "geral/paises", "geral/anexo"],
  trackingModel: "ExecucaoIntegracao",
  configuration: "Configurações > Empresas Omie",
});

registry.registerIntegration("BACEN PTAX", {
  name: "BACEN PTAX",
  direction: "inbound",
  resource: "CotacaoMoedaDia",
  trackingModel: "ExecucaoIntegracao",
  configuration: "Configurações > Configurações",
});

registry.registerIntegration("SendGrid", {
  name: "SendGrid",
  direction: "outbound",
  trackingModel: "ExecucaoIntegracao",
  configuration: "Configurações > Configurações",
});

registry.registerIntegration("Renderizador PDF", {
  name: "Renderizador PDF",
  direction: "internal",
  trackingModel: "ExecucaoIntegracao",
});
