const { defineModel, fields } = require("@oondemand/oon-core-back");
const { withOptions } = require("../lib/model");

const entry = defineModel({
  name: "ExecucaoIntegracao",
  singular: "execucao-integracao",
  basePath: "/execucoes-integracao",
  schema: {
    fatura: fields.ref("Fatura", { required: true, label: "Fatura" }),
    empresaOmie: fields.ref("EmpresaOmie", { required: true, label: "Empresa Omie" }),
    tipo: fields.enum([
      "consultar_os",
      "consultar_cliente",
      "consultar_pais",
      "obter_cotacao",
      "gerar_pdf",
      "anexar_documento",
      "listar_anexos",
      "obter_anexo",
      "enviar_email",
      "gerar_adiantamento",
      "alterar_etapa_os",
    ], { required: true, label: "Tipo" }),
    sistema: fields.enum(["omie", "bacen", "sendgrid", "renderizador"], { required: true, label: "Sistema" }),
    direcao: fields.enum(["inbound", "outbound", "internal"], { required: true, label: "Direção" }),
    chaveIdempotencia: withOptions(fields.string({ required: true, label: "Chave de Idempotência" }), { unique: true }),
    status: fields.enum(["pendente", "em_processamento", "concluida", "falha_transitoria", "aguardando_retry", "falha_definitiva", "cancelada"], {
      required: true,
      default: "pendente",
      label: "Status",
    }),
    tentativaAtual: fields.number({ label: "Tentativa", default: 0 }),
    maxTentativas: fields.number({ label: "Máximo de Tentativas", default: 5 }),
    proximaTentativaEm: fields.date({ label: "Próxima Tentativa" }),
    requestResumoJson: fields.string({ label: "Requisição Resumida", searchable: false }),
    responseResumoJson: fields.string({ label: "Resposta Resumida", searchable: false }),
    erroCodigo: fields.string({ label: "Código do Erro" }),
    erroMensagem: fields.string({ label: "Mensagem de Erro" }),
    erroDetalhesTecnicosRef: fields.string({ label: "Referência Técnica" }),
    iniciadaEm: fields.date({ label: "Iniciada Em" }),
    finalizadaEm: fields.date({ label: "Finalizada Em" }),
    duracaoMs: fields.number({ label: "Duração (ms)" }),
    executadaPor: fields.string({ required: true, label: "Executada Por", default: "processo_sistema" }),
  },
  crud: { enabled: true, roles: { write: ["administrador"] } },
});

entry.mongooseModel.schema.index({ fatura: 1, tipo: 1 });
entry.mongooseModel.schema.index({ status: 1, proximaTentativaEm: 1 });
module.exports = entry;
