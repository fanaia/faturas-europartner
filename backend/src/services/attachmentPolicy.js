const path = require("node:path");
const { splitList } = require("../lib/list");

function normalizePattern(value) {
  return value.toLowerCase().trim();
}

function selectAttachments(attachments, profile, maxBytes = Number(process.env.EMAIL_MAX_ATTACHMENTS_BYTES || 20_000_000)) {
  if (profile.politicaAnexos === "somente_fatura") return [];
  if (profile.politicaAnexos === "selecao_manual") {
    throw new Error("Seleção manual de anexos não é compatível com o processamento automático.");
  }

  const allowedExtensions = new Set(splitList(profile.tiposAnexoPermitidos).map((item) => item.replace(/^\./, "").toLowerCase()));
  const includes = splitList(profile.padroesNomeAnexoIncluidos).map(normalizePattern);
  const excludes = splitList(profile.padroesNomeAnexoExcluidos).map(normalizePattern);
  let total = 0;

  return attachments.filter((attachment) => {
    const name = String(attachment.filename || attachment.cNomeArquivo || "");
    const lower = name.toLowerCase();
    const extension = path.extname(lower).replace(/^\./, "");
    const size = Number(attachment.size || attachment.fileBuffer?.length || 0);
    if (!name || !allowedExtensions.has(extension)) return false;
    if (excludes.some((pattern) => lower.includes(pattern))) return false;
    if (includes.length && !includes.some((pattern) => lower.includes(pattern))) return false;
    if (total + size > maxBytes) return false;
    total += size;
    return true;
  });
}

module.exports = { selectAttachments };
