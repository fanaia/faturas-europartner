const { registry } = require("@oondemand/oon-core-back");

registry.registerIntegration("Omie", {
  name: "Omie",
  direction: "bidirectional",
  resources: ["servicos/os", "geral/clientes", "geral/paises", "geral/anexo"],
  trackingModel: "ExecucaoIntegracao",
  secrets: "EmpresaOmie.secretRef",
});

registry.registerIntegration("BACEN PTAX", {
  name: "BACEN PTAX",
  direction: "inbound",
  resource: "CotacaoMoedaDia",
  trackingModel: "ExecucaoIntegracao",
});

registry.registerIntegration("SendGrid", {
  name: "SendGrid",
  direction: "outbound",
  trackingModel: "ExecucaoIntegracao",
  secrets: "EmpresaOmie.emailProviderSecretRef",
});

registry.registerIntegration("Renderizador PDF", {
  name: "Renderizador PDF",
  direction: "internal",
  trackingModel: "ExecucaoIntegracao",
});
