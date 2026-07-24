/**
 * Central Faturas Europartner — domínio exclusivo, single-tenant e multiempresa.
 * Infraestrutura, autenticação, RBAC, CRUD e auditoria permanecem no OonCore.
 */
const devAuth =
  process.env.NODE_ENV === "development" && process.env.DEV_TOKEN
    ? {
        verifyToken: async (token) => {
          if (token !== process.env.DEV_TOKEN) {
            const err = new Error("Token inválido.");
            err.statusCode = 401;
            throw err;
          }
          return {
            tipo: "administrador",
            nome: "Dev Local",
            email: "dev@local",
            capabilities: ["*"],
          };
        },
      }
    : undefined;

const DEFAULT_ALLOWED_VARIABLES = [
  "empresa",
  "cliente",
  "ordemServico",
  "servicos",
  "parcelas",
  "impostos",
  "moeda",
  "cotacao",
  "datas",
  "configuracoesPublicas",
].join("\n");

const DEFAULT_DOCUMENT = `
<section class="invoice">
  <header>
    <h1>INVOICE</h1>
    <p><strong>{{empresa.razaoSocial}}</strong></p>
    <p>CNPJ: {{empresa.cnpj}}</p>
  </header>
  <div class="grid">
    <div><strong>Cliente</strong><br>{{cliente.razao_social}}</div>
    <div><strong>Ordem de Serviço</strong><br>{{ordemServico.Cabecalho.cNumOS}}</div>
    <div><strong>Moeda</strong><br>{{moeda}}</div>
    <div><strong>Cotação</strong><br>{{cotacao.efetiva}}</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Serviço</th><th>Quantidade</th><th>Valor</th></tr></thead>
    <tbody>
      {{#each servicos}}
      <tr>
        <td>{{@index}}</td>
        <td>{{this.cDescricao}}</td>
        <td>{{this.nQtde}}</td>
        <td>{{this.nValUnit}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{#if cliente.pais}}<p>País do cliente: {{cliente.pais}}</p>{{/if}}
</section>`;

const DEFAULT_STYLES = `
@page { size: A4; margin: 18mm; }
body { font-family: Arial, sans-serif; color: #17212b; font-size: 12px; }
h1 { margin: 0 0 12px; font-size: 24px; }
header { border-bottom: 2px solid #0474af; margin-bottom: 20px; padding-bottom: 12px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #d6dce2; padding: 8px; text-align: left; }
th { background: #f0f4f7; }
`;

async function activateDefaults({ registry }) {
  const modelEntry = registry.getModel("ModeloDocumento");
  const versionEntry = registry.getModel("VersaoModeloDocumento");
  if (!modelEntry || !versionEntry) return;

  const Modelo = modelEntry.mongooseModel;
  const Versao = versionEntry.mongooseModel;
  let modelo = await Modelo.findOne({ codigo: "invoice-padrao" });
  if (!modelo) {
    modelo = await Modelo.create({
      codigo: "invoice-padrao",
      nome: "Invoice Padrão Europartner",
      descricao: "Modelo inicial seguro para homologação. Deve ser versionado por perfil/cliente quando necessário.",
      idiomasSuportados: "pt-BR,en-US,es-ES",
      status: "ativo",
    });
  }

  const exists = await Versao.findOne({ modeloDocumento: modelo._id, versao: "1.0.0", idioma: "pt-BR" });
  if (!exists) {
    await Versao.create({
      modeloDocumento: modelo._id,
      versao: "1.0.0",
      idioma: "pt-BR",
      motor: "template-seguro",
      conteudoDocumento: DEFAULT_DOCUMENT,
      estilos: DEFAULT_STYLES,
      assuntoEmail: "Invoice {{ordemServico.Cabecalho.cNumOS}} — {{empresa.nome}}",
      corpoEmail: "<p>Olá,</p><p>Segue a invoice referente à Ordem de Serviço <strong>{{ordemServico.Cabecalho.cNumOS}}</strong>.</p>",
      variaveisPermitidas: DEFAULT_ALLOWED_VARIABLES,
      status: "rascunho",
    });
  }
}

module.exports = {
  ecosystem: { role: "member" },
  activation: {
    enabled: true,
    configurationVersion: 1,
    fields: [
      {
        name: "instanceLabel",
        label: "Identificação da instância",
        type: "string",
        required: true,
        default: "Europartner",
      },
    ],
  },
  name: "Central Faturas Europartner",
  slug: "faturas-europartner",
  auth: devAuth,
  activate: activateDefaults,
  modules: {
    collections: true,
    documents: true,
    pipelines: true,
    integrations: true,
    omie: true,
    assistants: false,
    currencies: true,
  },
  domain: {
    models: "src/models",
    validations: "src/validations",
    triggers: "src/triggers",
    hooks: "src/hooks",
    mappings: "src/mappings",
    documents: "src/documents",
    pipelines: "src/pipelines",
    integrations: "src/integrations",
    routes: "src/routes",
  },
};
