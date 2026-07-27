const { defineRoutes } = require("@oondemand/oon-core-back");
const { model } = require("../lib/model");
const { getCompanyCredentials } = require("../services/configurationService");
const { mask } = require("../lib/secrets");
const { consultarOS } = require("../integrations/omie/service");
const { OperationalError } = require("../lib/error");

const roles = ["administrador"];

defineRoutes("/api/empresas-omie", (router) => {
  router.private.post("/:id/testar-conexao", { roles, audit: { action: "empresa-omie.testar-conexao" } }, async (req, res) => {
    const empresa = await model("EmpresaOmie").findById(req.params.id);
    if (!empresa) throw new OperationalError("Empresa não encontrada.", { code: "COMPANY_NOT_FOUND", statusCode: 404 });
    const credentials = await getCompanyCredentials(empresa);
    try {
      if (req.body?.codigoOS) await consultarOS(empresa, req.body.codigoOS);
      empresa.appKeyMasked = mask(credentials.appKey);
      empresa.ultimaComunicacaoSucessoEm = new Date();
      empresa.ultimoErroComunicacao = undefined;
      await empresa.save();
      res.json({ message: "Credencial configurada e comunicação validada.", appKey: empresa.appKeyMasked });
    } catch (error) {
      empresa.ultimoErroComunicacao = error.message;
      await empresa.save();
      throw error;
    }
  });
});
