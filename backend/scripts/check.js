const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
}
walk(path.join(root, "src"));
walk(path.join(root, "test"));
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  const content = fs.readFileSync(file, "utf8");
  if (/\b(secretRef|webhookTokenRef|emailProviderSecretRef)\b/.test(content)) {
    throw new Error(`Referência legada de segredo encontrada em ${path.relative(root, file)}.`);
  }
}
JSON.parse(fs.readFileSync(path.join(root, "central.manifest.json"), "utf8"));
console.log(`OK: ${files.length} arquivos JavaScript e central.manifest.json validados.`);
