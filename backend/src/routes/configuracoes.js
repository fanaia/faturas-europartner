const { defineRoutes } = require("@oondemand/oon-core-back");
const {
  getCentralConfiguration,
  saveCentralConfiguration,
  listCompanyConfigurations,
  saveCompanyCredentials,
  generateCompanyWebhookToken,
} = require("../services/configurationService");

const roles = ["administrador"];

defineRoutes("/api/configuracoes-central", (router) => {
  router.private.get("/", { roles }, async (_req, res) => {
    const [configuration, companies] = await Promise.all([
      getCentralConfiguration(),
      listCompanyConfigurations(),
    ]);
    res.json({ configuration, companies });
  });

  router.private.put(
    "/",
    { roles, audit: { action: "configuracao-central.atualizar" } },
    async (req, res) => {
      const configuration = await saveCentralConfiguration(req.body || {}, req.usuario || req.user);
      const companies = await listCompanyConfigurations();
      res.json({ message: "Configurações atualizadas.", configuration, companies });
    }
  );

  router.private.put(
    "/empresas/:id/credenciais",
    { roles, audit: { action: "empresa-omie.atualizar-credenciais" } },
    async (req, res) => {
      const company = await saveCompanyCredentials(req.params.id, req.body || {});
      res.json({ message: "Credenciais da empresa atualizadas.", company });
    }
  );

  router.private.post(
    "/empresas/:id/gerar-token-webhook",
    { roles, audit: { action: "empresa-omie.gerar-token-webhook" } },
    async (req, res) => {
      const result = await generateCompanyWebhookToken(req.params.id);
      res.json({
        message: "Novo token gerado. Copie agora; ele não será exibido novamente.",
        token: result.token,
      });
    }
  );
});
