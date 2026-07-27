const { defineValidation } = require("@oondemand/oon-core-back");

const LOCKED_FIELDS = [
  "modeloDocumento",
  "versao",
  "idioma",
  "motor",
  "conteudoDocumento",
  "estilos",
  "assuntoEmail",
  "corpoEmail",
  "variaveisPermitidas",
];

defineValidation("VersaoModeloDocumento", async (dados, contexto) => {
  if (contexto?.changes?.status === "publicado") {
    throw new Error("Use a ação Publicar para publicar uma versão de modelo.");
  }
  if (dados.motor === "ejs-legado-somente-leitura" && contexto?.op === "create") {
    // Permitido somente para inventário/migração. Nunca será executado pelo motor novo.
  }
  if (contexto?.current?.status === "publicado") {
    const alterado = LOCKED_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(contexto.changes || {}, field));
    if (alterado) throw new Error("Versão publicada é imutável. Crie uma nova versão.");
    if (!["publicado", "substituido"].includes(dados.status)) {
      throw new Error("Versão publicada só pode ser marcada como substituída.");
    }
  }
  if (dados.status === "publicado" && dados.motor !== "template-seguro") {
    throw new Error("Somente o motor template-seguro pode ser publicado para processamento automático.");
  }
  if (!String(dados.conteudoDocumento || "").trim()) throw new Error("Conteúdo do documento é obrigatório.");
  if (!String(dados.assuntoEmail || "").trim()) throw new Error("Assunto do e-mail é obrigatório.");
});
