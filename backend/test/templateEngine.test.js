const test = require("node:test");
const assert = require("node:assert/strict");
const { render } = require("../src/services/templateEngine");

test("renderiza somente variáveis permitidas e escapa HTML", () => {
  const output = render("Olá {{cliente.nome}}", { cliente: { nome: "<ACME>" } }, { allowedVariables: "cliente" });
  assert.equal(output, "Olá &lt;ACME&gt;");
});

test("rejeita variável fora do contrato", () => {
  assert.throws(() => render("{{segredo}}", { segredo: "x" }, { allowedVariables: "cliente" }), /não autorizada/);
});

test("modo estrito identifica variável ausente", () => {
  assert.throws(() => render("{{cliente.nome}}", { cliente: {} }, { allowedVariables: "cliente" }), /sem valor/);
});

test("renderiza lista com each sem executar JavaScript", () => {
  const output = render(
    "{{#each servicos}}[{{@index}}:{{this.nome}}]{{/each}}",
    { servicos: [{ nome: "A" }, { nome: "B" }] },
    { allowedVariables: "servicos" }
  );
  assert.equal(output, "[0:A][1:B]");
});

test("renderiza bloco if somente quando valor existe", () => {
  assert.equal(render("{{#if cliente.pais}}{{cliente.pais}}{{/if}}", { cliente: { pais: "Brasil" } }, { allowedVariables: "cliente" }), "Brasil");
  assert.equal(render("{{#if cliente.pais}}x{{/if}}", { cliente: {} }, { allowedVariables: "cliente" }), "");
});

test("each exige uma lista", () => {
  assert.throws(() => render("{{#each servicos}}x{{/each}}", { servicos: {} }, { allowedVariables: "servicos" }), /precisa ser uma lista/);
});
