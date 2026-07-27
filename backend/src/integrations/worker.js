const { model } = require("../lib/model");
const { processEventById, processInvoiceById } = require("../services/faturaProcessor");
const { getCentralConfiguration } = require("../services/configurationService");
const log = require("../lib/log");

let running = false;

async function tick(configurationOverride) {
  const configuration = configurationOverride || (await getCentralConfiguration());
  if (running || !configuration.processorEnabled) return configuration;
  running = true;
  try {
    const now = new Date();
    const batch = Number(configuration.processorBatchSize || 10);
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
  return configuration;
}

async function scheduleNext() {
  let interval = 5000;
  try {
    const configuration = await getCentralConfiguration();
    interval = Number(configuration.processorPollIntervalMs || 5000);
    await tick(configuration);
  } catch (error) {
    log.error("Não foi possível carregar a configuração do worker", { error: { message: error.message, code: error.code } });
  } finally {
    const timer = setTimeout(scheduleNext, interval);
    timer.unref?.();
  }
}

const initial = setTimeout(scheduleNext, 2500);
initial.unref?.();

module.exports = { tick };
