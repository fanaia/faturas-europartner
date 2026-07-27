const axios = require("axios");
const archiver = require("archiver");
const { PassThrough } = require("node:stream");
const { callOmie } = require("./client");
const { md5 } = require("../../lib/hash");
const { getCentralConfiguration } = require("../../services/configurationService");

async function consultarOS(empresa, codigoOS) {
  return callOmie(empresa, "servicos/os/", "ConsultarOS", { nCodOS: Number(codigoOS) || codigoOS });
}

async function consultarCliente(empresa, codigoCliente) {
  return callOmie(empresa, "geral/clientes/", "ConsultarCliente", { codigo_cliente_omie: codigoCliente });
}

async function consultarPais(empresa, codigoPais) {
  if (String(codigoPais) === "1058") return { cCodigo: "1058", cCodigoISO: "BR", cDescricao: "Brasil" };
  const response = await callOmie(empresa, "geral/paises/", "ListarPaises", { filtrar_por_codigo: codigoPais });
  return response.lista_paises?.[0] || null;
}

function zipBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    const chunks = [];
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("data", (chunk) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.append(buffer, { name: filename });
    archive.finalize();
  });
}

async function incluirAnexoFatura(empresa, codigoOS, filename, pdfBuffer, externalCode) {
  const zipped = await zipBuffer(pdfBuffer, filename);
  const base64 = zipped.toString("base64");
  return callOmie(empresa, "geral/anexo/", "IncluirAnexo", {
    cCodIntAnexo: externalCode,
    cTabela: "ordem-servico",
    nId: Number(codigoOS) || codigoOS,
    cNomeArquivo: filename,
    cTipoArquivo: "pdf",
    cArquivo: base64,
    cMd5: md5(base64),
  });
}

async function listarAnexos(empresa, codigoOS) {
  const response = await callOmie(empresa, "geral/anexo/", "ListarAnexo", {
    nPagina: 1,
    nRegPorPagina: 100,
    nId: Number(codigoOS) || codigoOS,
    cTabela: "ordem-servico",
  });
  return response.listaAnexos || [];
}

async function obterAnexo(empresa, item) {
  const [response, configuration] = await Promise.all([
    callOmie(empresa, "geral/anexo/", "ObterAnexo", {
      cTabela: item.cTabela || "ordem-servico",
      nId: item.nId,
      nIdAnexo: item.nIdAnexo,
    }),
    getCentralConfiguration(),
  ]);
  const download = await axios.get(response.cLinkDownload, {
    responseType: "arraybuffer",
    timeout: Number(configuration.omieTimeoutMs || 20000),
  });
  return {
    filename: response.cNomeArquivo || item.cNomeArquivo,
    fileBuffer: Buffer.from(download.data),
    size: Buffer.byteLength(download.data),
    omieId: item.nIdAnexo,
  };
}

const { isAdvanceAlreadyApplied, buildAdvancePayload } = require("../../services/advance");

async function gerarAdiantamento(empresa, os, options) {
  if (isAdvanceAlreadyApplied(os)) return { alreadyApplied: true };
  return callOmie(empresa, "servicos/os/", "AlterarOS", buildAdvancePayload(os, options));
}

async function alterarEtapaOS(empresa, codigoOS, etapa, observacao) {
  return callOmie(empresa, "servicos/os/", "AlterarOS", {
    Cabecalho: { nCodOS: Number(codigoOS) || codigoOS, cEtapa: etapa },
    Observacoes: { cObsOS: observacao || "" },
  });
}

module.exports = {
  consultarOS,
  consultarCliente,
  consultarPais,
  incluirAnexoFatura,
  listarAnexos,
  obterAnexo,
  isAdvanceAlreadyApplied,
  buildAdvancePayload,
  gerarAdiantamento,
  alterarEtapaOS,
};
