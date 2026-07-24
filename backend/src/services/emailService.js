const sgMail = require("@sendgrid/mail");
const { readSecret } = require("../lib/secrets");
const { normalizeEmails } = require("../lib/list");
const { OperationalError } = require("../lib/error");

async function sendInvoiceEmail({ empresa, profile, fatura, clientEmail, osEmail, subject, html, pdfBuffer, extraAttachments = [] }) {
  const to = normalizeEmails([clientEmail, osEmail, profile.destinatariosAdicionais]);
  const cc = normalizeEmails([empresa.emailCopiaPadrao, profile.copias]).filter((email) => !to.includes(email));
  if (!to.length) {
    throw new OperationalError("Nenhum destinatário válido foi encontrado.", { code: "EMAIL_RECIPIENT_REQUIRED" });
  }
  const apiKey = readSecret(empresa.emailProviderSecretRef || "SENDGRID_API_KEY");
  sgMail.setApiKey(apiKey);
  const attachments = [
    {
      content: pdfBuffer.toString("base64"),
      filename: fatura.nomeArquivo,
      type: "application/pdf",
      disposition: "attachment",
    },
    ...extraAttachments.map((item) => ({
      content: item.fileBuffer.toString("base64"),
      filename: item.filename,
      disposition: "attachment",
    })),
  ];
  const [response] = await sgMail.send({
    to,
    cc: cc.length ? cc : undefined,
    from: { email: empresa.emailRemetente, name: empresa.nomeRemetente },
    subject,
    html,
    attachments,
    customArgs: { faturaId: String(fatura._id), codigoOS: String(fatura.codigoOS) },
  });
  return { to, cc, messageId: response?.headers?.["x-message-id"] || response?.headers?.["X-Message-Id"] || "" };
}

module.exports = { sendInvoiceEmail };
