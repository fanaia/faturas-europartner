import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "central.ui.json"), "utf8"));
if (manifest.schemaVersion !== 2) throw new Error("central.ui.json deve usar schemaVersion 2.");
if (!Array.isArray(manifest.collections) || !manifest.collections.length) throw new Error("Nenhuma coleção declarada.");
if (!Array.isArray(manifest.pipelines) || !manifest.pipelines.length) throw new Error("Nenhuma esteira declarada.");
const models = new Set(manifest.collections.map((item) => item.model));
for (const required of ["Fatura", "EmpresaOmie", "PerfilFaturamento", "ModeloDocumento", "ExecucaoIntegracao"]) {
  if (!models.has(required)) throw new Error(`Coleção obrigatória ausente: ${required}`);
}
const main = fs.readFileSync(path.join(root, "src", "main.tsx"), "utf8");
if (!main.includes('path: "/configuracoes"') || !main.includes("ConfiguracoesCentral")) {
  throw new Error("Página Configurações não registrada no menu final.");
}
console.log(`OK: manifesto com ${manifest.collections.length} coleções, ${manifest.pipelines.length} esteiras e ${manifest.documents.length} documento(s).`);
