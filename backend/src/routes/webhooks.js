const { defineRoutes } = require("@oondemand/oon-core-back");
const { receiveWebhook } = require("../services/webhookService");

function tokenFrom(req) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return req.headers["x-webhook-token"] || bearer;
}

defineRoutes("/api/integrations/omie/webhooks", (router) => {
  router.public.post("/ordem-servico/:empresaCode", async (req, res) => {
    const result = await receiveWebhook({
      empresaCode: req.params.empresaCode,
      token: tokenFrom(req),
      payload: req.body,
    });
    if (result.ping) return res.status(200).json({ message: "pong" });
    return res.status(202).json({
      message: result.duplicate ? "Evento já recebido." : "Evento persistido para processamento.",
      duplicate: Boolean(result.duplicate),
      eventId: result.event.eventId,
      status: result.event.status,
    });
  });
});
