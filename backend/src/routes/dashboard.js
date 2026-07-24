const { defineRoutes } = require("@oondemand/oon-core-back");
const { model } = require("../lib/model");

const roles = ["administrador", "gestor_faturamento", "operacao_faturamento", "auditoria_consulta"];

defineRoutes("/api/dashboard", (router) => {
  router.private.get("/faturas", { roles }, async (req, res) => {
    const Fatura = model("Fatura");
    const match = {};
    if (req.query.empresaOmie) match.empresaOmie = req.query.empresaOmie;
    if (req.query.inicio || req.query.fim) {
      match.createdAt = {};
      if (req.query.inicio) match.createdAt.$gte = new Date(req.query.inicio);
      if (req.query.fim) match.createdAt.$lte = new Date(req.query.fim);
    }
    const [byStatus, byCompany, byCurrency, avgTime] = await Promise.all([
      Fatura.aggregate([{ $match: match }, { $group: { _id: "$status", total: { $sum: 1 } } }]),
      Fatura.aggregate([{ $match: match }, { $group: { _id: "$empresaOmie", total: { $sum: 1 } } }]),
      Fatura.aggregate([{ $match: match }, { $group: { _id: "$moeda", total: { $sum: 1 } } }]),
      Fatura.aggregate([{ $match: { ...match, tempoProcessamentoMs: { $gt: 0 } } }, { $group: { _id: null, value: { $avg: "$tempoProcessamentoMs" } } }]),
    ]);
    res.json({ byStatus, byCompany, byCurrency, averageProcessingMs: avgTime[0]?.value || 0 });
  });
});
