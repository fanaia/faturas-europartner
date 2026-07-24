const { registry } = require("@oondemand/oon-core-back");

function model(name) {
  const entry = registry.getModel(name);
  if (!entry?.mongooseModel) {
    throw new Error(`Model ${name} ainda não foi registrada no OonCore.`);
  }
  return entry.mongooseModel;
}

function withOptions(descriptor, options = {}) {
  return { ...descriptor, ...options };
}

module.exports = { model, withOptions };
