const { sha256 } = require("../lib/hash");
const { OperationalError } = require("../lib/error");
const omie = require("../integrations/omie/service");
const { templateVariables } = require("./invoiceContext");
const { renderPdf, renderEmail } = require("./documentService");
const { selectAttachments } = require("./attachmentPolicy");
const { sendInvoiceEmail } = require("./emailService");
const { runStep } = require("./executionService");
const { getCentralConfiguration } = require("./configurationService");

async function processEffects(fatura, prepared) {
  const { empresa, profile, version, quote, os, cliente, pais } = prepared;
  const configuration = await getCentralConfiguration();
  const maxAttachmentsBytes = Number(configuration.emailMaxAttachmentsBytes || 20000000);
  const variables = templateVariables({ empresa, profile, os, cliente, pais, quote, effectiveQuote: fatura.cotacaoEfetiva });

  fatura.etapaAtual = "gerando_documento";
  await fatura.save();
  const documentStep = await runStep({
    fatura, empresa, type: "gerar_pdf", system: "renderizador", direction: "internal",
    key: `${fatura._id}:pdf:${version.hashConteudo}:${sha256(fatura.dadosOsSnapshotJson)}`,
    requestSummary: { versionId: version._id, versionHash: version.hashConteudo },
    fn: async () => {
      const { pdf, hash } = await renderPdf(version, variables);
      const filename = `invoice-${fatura.numeroOS}-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
      fatura.pdfBase64 = pdf.toString("base64");
      fatura.pdfHash = hash;
      fatura.nomeArquivo = filename;
      await fatura.save();
      return { hash, filename };
    },
  });
  if (documentStep.skipped && !fatura.pdfBase64) throw new OperationalError("Execução de PDF concluída sem arquivo persistido.", { code: "PDF_MISSING" });
  const pdfBuffer = Buffer.from(fatura.pdfBase64, "base64");

  fatura.etapaAtual = "anexando_omie";
  await fatura.save();
  const attachmentStep = await runStep({
    fatura, empresa, type: "anexar_documento", system: "omie",
    key: `${fatura._id}:anexo:${fatura.pdfHash}`,
    requestSummary: { codigoOS: fatura.codigoOS, filename: fatura.nomeArquivo, pdfHash: fatura.pdfHash },
    fn: async () => {
      const result = await omie.incluirAnexoFatura(empresa, fatura.codigoOS, fatura.nomeArquivo, pdfBuffer, `fatura-${fatura._id}`);
      fatura.anexoOmieId = String(result.nIdAnexo || result.cCodIntAnexo || result.codigo_status || fatura.pdfHash);
      await fatura.save();
      return { anexoOmieId: fatura.anexoOmieId };
    },
  });
  if (attachmentStep.skipped && !fatura.anexoOmieId) fatura.anexoOmieId = fatura.pdfHash;

  fatura.etapaAtual = "enviando_email";
  await fatura.save();
  const emailStep = await runStep({
    fatura, empresa, type: "enviar_email", system: "sendgrid",
    key: `${fatura._id}:email:${fatura.pdfHash}`,
    requestSummary: { codigoOS: fatura.codigoOS, profile: profile._id },
    fn: async () => {
      const email = renderEmail(version, variables);
      let extras = [];
      if (profile.politicaAnexos === "fatura_e_permitidos") {
        const list = await omie.listarAnexos(empresa, fatura.codigoOS);
        const candidates = list.filter((item) => String(item.cNomeArquivo || "") !== fatura.nomeArquivo);
        const selectedMetadata = selectAttachments(
          candidates.map((item) => ({ ...item, filename: item.cNomeArquivo, size: item.nTamanhoArquivo || 0 })),
          profile,
          maxAttachmentsBytes
        );
        extras = await Promise.all(selectedMetadata.map((item) => omie.obterAnexo(empresa, item)));
        extras = selectAttachments(extras, profile, maxAttachmentsBytes);
      }
      const osEmail = os?.Email?.cEnviarPara || os?.email?.cEnviarPara || "";
      const result = await sendInvoiceEmail({ empresa, profile, fatura, clientEmail: cliente.email, osEmail, subject: email.subject, html: email.html, pdfBuffer, extraAttachments: extras });
      fatura.destinatarios = result.to.join(", ");
      fatura.copias = result.cc.join(", ");
      fatura.providerMessageId = result.messageId;
      await fatura.save();
      return { to: result.to, cc: result.cc, messageId: result.messageId, attachments: extras.map((item) => item.filename) };
    },
  });
  if (emailStep.skipped && !fatura.providerMessageId) fatura.providerMessageId = "idempotent-completed";

  fatura.etapaAtual = "gerando_adiantamento";
  await fatura.save();
  if (profile.gerarAdiantamento) {
    await runStep({
      fatura, empresa, type: "gerar_adiantamento", system: "omie",
      key: `${fatura._id}:adiantamento`,
      requestSummary: { codigoOS: fatura.codigoOS, categoria: empresa.categoriaAdiantamento, conta: empresa.contaCorrenteAdiantamento },
      fn: async () => {
        const currentOs = await omie.consultarOS(empresa, fatura.codigoOS);
        const result = await omie.gerarAdiantamento(empresa, currentOs, {
          categoria: empresa.categoriaAdiantamento,
          contaCorrente: empresa.contaCorrenteAdiantamento,
          observacao: `Fatura ${fatura.nomeArquivo} processada pela Central Faturas Europartner.`,
        });
        fatura.adiantamentoConfirmado = true;
        await fatura.save();
        return result;
      },
    });
  } else {
    fatura.adiantamentoConfirmado = false;
  }

  fatura.etapaAtual = "atualizando_etapa_omie";
  await fatura.save();
  const successStage = profile.etapaSucesso || empresa.etapaSucessoPadrao;
  await runStep({
    fatura, empresa, type: "alterar_etapa_os", system: "omie",
    key: `${fatura._id}:etapa-sucesso:${successStage}`,
    requestSummary: { codigoOS: fatura.codigoOS, etapa: successStage },
    fn: () => omie.alterarEtapaOS(empresa, fatura.codigoOS, successStage, `Invoice ${fatura.nomeArquivo} enviada para ${fatura.destinatarios} em ${new Date().toLocaleString("pt-BR")}.`),
  });

  fatura.status = "concluida";
  fatura.etapaAtual = "concluida";
  fatura.concluidaEm = new Date();
  fatura.tempoProcessamentoMs = fatura.iniciadaEm ? Date.now() - new Date(fatura.iniciadaEm).getTime() : undefined;
  fatura.proximaTentativaEm = undefined;
  fatura.ultimoErroCodigo = undefined;
  fatura.ultimoErroMensagem = undefined;
  fatura.acaoRecomendada = undefined;
  fatura.lockUntil = undefined;
  fatura.lockedBy = undefined;
  await fatura.save();
}

module.exports = { processEffects };
