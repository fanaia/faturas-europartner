const { model } = require("../lib/model");
const { processEventById, processInvoiceById } = require("../services/faturaProcessor");
const log = require("../lib/log");

let running = false;

async function tick() {
  if (running || process.env.PROCESSOR_ENABLED === "false") return;
  running = true;
  try {
    const now = new Date();
    const batch = Number(process.env.PROCESSOR_BATCH_SIZE || 10);
    const Evento = model("EventoWebhook");
    const Fatura = model("Fatura");
    const events = await Evento.find({
      status: "aceito",
      $and: [
        { $or: [{ proximaTentativaEm: null }, { proximaTentativaEm: { $exists: false } }, { proximaTentativaEm: { $lte: now } }] },
        { $or: [{ lockUntil: null }, { lockUntil: { $exists: false } }, { lockUntil: { $lt: now } }] },
      ],
    }).sort({ recebidoEm: 1 }).limit(batch).select("_id");
    for (const event of events) await processEventById(event._id);

    const remaining = Math.max(0, batch - events.length);
    if (remaining) {
      const invoices = await Fatura.find({
        status: { $in: ["pendente", "aguardando_retry"] },
        perfilFaturamento: { $exists: true, $ne: null },
        $and: [
          { $or: [{ proximaTentativaEm: null }, { proximaTentativaEm: { $exists: false } }, { proximaTentativaEm: { $lte: now } }] },
          { $or: [{ lockUntil: null }, { lockUntil: { $exists: false } }, { lockUntil: { $lt: now } }] },
        ],
      }).sort({ createdAt: 1 }).limit(remaining).select("_id");
      for (const invoice of invoices) await processInvoiceById(invoice._id);
    }
  } catch (error) {
    // Mongo pode ainda estar conectando no primeiro tick; o próximo ciclo retoma.
    log.error("Worker de faturas falhou", { error: { message: error.message, code: error.code } });
  } finally {
    running = false;
  }
}

if (process.env.PROCESSOR_ENABLED !== "false") {
  const initial = setTimeout(tick, 2500);
  initial.unref?.();
  const interval = setInterval(tick, Number(process.env.PROCESSOR_POLL_INTERVAL_MS || 5000));
  interval.unref?.();
}

module.exports = { tick };
