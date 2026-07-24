const { defineModel, fields } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "PerfilFaturamento",
  singular: "perfil-faturamento",
  basePath: "/perfis-faturamento",
  schema: {
    nome: fields.string({ required: true, label: "Nome" }),
    empresaOmie: fields.ref("EmpresaOmie", { required: true, label: "Empresa Omie" }),
    codigoClienteOmie: fields.string({ required: true, label: "Código do Cliente Omie" }),
    nomeCliente: fields.string({ required: true, label: "Cliente" }),
    modeloDocumento: fields.ref("ModeloDocumento", { required: true, label: "Modelo de Documento" }),
    idioma: fields.enum(["pt-BR", "en-US", "es-ES"], { required: true, default: "pt-BR", label: "Idioma" }),
    moeda: fields.enum(["BRL", "USD", "EUR"], { required: true, default: "BRL", label: "Moeda" }),
    dataReferenciaCotacao: fields.enum(["data_os", "previsao_os", "processamento"], {
      required: true,
      default: "data_os",
      label: "Data de Referência da Cotação",
    }),
    campoCotacao: fields.enum(["compra", "venda"], { required: true, default: "compra", label: "Campo PTAX" }),
    tipoAjusteCotacao: fields.enum(["nenhum", "percentual", "valor_fixo"], {
      required: true,
      default: "nenhum",
      label: "Tipo de Ajuste",
    }),
    valorAjusteCotacao: fields.number({ label: "Ajuste da Cotação", default: 0 }),
    regraImpostosJson: fields.string({ label: "Regra de Impostos (JSON)", searchable: false }),
    destinatariosAdicionais: fields.string({ label: "Destinatários Adicionais" }),
    copias: fields.string({ label: "Cópias" }),
    politicaAnexos: fields.enum(["somente_fatura", "fatura_e_permitidos", "selecao_manual"], {
      required: true,
      default: "somente_fatura",
      label: "Política de Anexos",
    }),
    tiposAnexoPermitidos: fields.string({ label: "Extensões Permitidas", default: "pdf,xml,xlsx,docx,jpg,png" }),
    padroesNomeAnexoIncluidos: fields.string({ label: "Padrões de Nome Incluídos" }),
    padroesNomeAnexoExcluidos: fields.string({ label: "Padrões de Nome Excluídos" }),
    gerarAdiantamento: fields.boolean({ label: "Gerar Adiantamento", default: true }),
    etapaEntrada: fields.string({ label: "Etapa de Entrada Específica" }),
    etapaSucesso: fields.string({ label: "Etapa de Sucesso Específica" }),
    etapaErro: fields.string({ label: "Etapa de Erro Específica" }),
    vigenteDesde: fields.date({ required: true, label: "Vigente Desde", default: Date.now }),
    vigenteAte: fields.date({ label: "Vigente Até" }),
    status: fields.enum(["rascunho", "ativo", "inativo", "arquivado"], {
      required: true,
      default: "rascunho",
      label: "Status",
    }),
  },
  crud: { enabled: true, roles: { write: ["administrador", "gestor_faturamento", "operacao_faturamento"] } },
});

entry.mongooseModel.schema.index({ empresaOmie: 1, codigoClienteOmie: 1, status: 1, vigenteDesde: -1 });
module.exports = entry;
