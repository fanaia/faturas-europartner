const test = require("node:test");
const assert = require("node:assert/strict");
const { selectAttachments } = require("../src/services/attachmentPolicy");

test("exclui anexos internos e extensões não permitidas", () => {
  const result = selectAttachments([
    { filename: "documento-cliente.pdf", size: 10 },
    { filename: "interno-custos.pdf", size: 10 },
    { filename: "script.exe", size: 10 },
  ], {
    politicaAnexos: "fatura_e_permitidos",
    tiposAnexoPermitidos: "pdf,xml",
    padroesNomeAnexoExcluidos: "interno",
  }, 100);
  assert.deepEqual(result.map((item) => item.filename), ["documento-cliente.pdf"]);
});

test("somente fatura não seleciona anexos da OS", () => {
  assert.deepEqual(selectAttachments([{ filename: "a.pdf", size: 1 }], { politicaAnexos: "somente_fatura" }), []);
});
