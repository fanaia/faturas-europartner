const { defineRoutes } = require("@oondemand/oon-core-back");
const { reprocessEvent } = require("../services/faturaProcessor");

const roles = ["administrador", "gestor_faturamento", "operacao_faturamento"];

defineRoutes("/api/eventos", (router) => {
  router.private.post("/:id/reprocessar", { roles, audit: { action: "evento.reprocessar" } }, async (req, res) => {
    const result = await reprocessEvent(req.params.id);
    res.json({ message: "Evento reenviado para preparação.", status: result?.status });
  });
});
