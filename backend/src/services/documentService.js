const sanitizeHtml = require("sanitize-html");
const puppeteer = require("puppeteer");
const { render, parseAllowed } = require("./templateEngine");
const { sha256 } = require("../lib/hash");
const { OperationalError } = require("../lib/error");

const ALLOWED_TAGS = [
  "html", "head", "body", "meta", "style", "div", "section", "article", "header", "footer",
  "h1", "h2", "h3", "h4", "p", "span", "strong", "em", "small", "br", "hr", "table", "thead",
  "tbody", "tfoot", "tr", "th", "td", "ul", "ol", "li", "img",
];

function sanitizeTemplate(html) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["class", "style", "colspan", "rowspan"],
      img: ["src", "alt", "width", "height", "style"],
      meta: ["charset", "name", "content"],
    },
    allowedSchemes: ["data", "https"],
    allowVulnerableTags: true,
  });
}

function composeHtml(version, variables, { strict = true, watermark } = {}) {
  if (version.motor !== "template-seguro") {
    throw new OperationalError("Modelo legado EJS é somente leitura e precisa ser convertido antes do uso.", {
      code: "LEGACY_TEMPLATE_NOT_EXECUTABLE",
    });
  }
  const allowed = parseAllowed(version.variaveisPermitidas);
  const body = render(version.conteudoDocumento, variables, { allowedVariables: allowed, escape: true, strict });
  const css = sanitizeHtml(String(version.estilos || ""), { allowedTags: [], allowedAttributes: {} });
  const mark = watermark
    ? `<div style="position:fixed;inset:40% 0 auto 0;text-align:center;transform:rotate(-25deg);font-size:72px;color:rgba(120,120,120,.18);z-index:9999">${watermark}</div>`
    : "";
  return sanitizeTemplate(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${mark}${body}</body></html>`);
}

async function renderPdf(version, variables, options = {}) {
  const html = composeHtml(version, variables, options);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: Number(process.env.PDF_RENDER_TIMEOUT_MS || 30_000) });
    const pdf = Buffer.from(await page.pdf({ format: "A4", printBackground: true, margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" } }));
    return { pdf, hash: sha256(pdf), htmlHash: sha256(html) };
  } finally {
    await browser.close();
  }
}

function renderEmail(version, variables) {
  const allowed = parseAllowed(version.variaveisPermitidas);
  return {
    subject: render(version.assuntoEmail, variables, { allowedVariables: allowed, escape: false, strict: true }),
    html: sanitizeTemplate(render(version.corpoEmail, variables, { allowedVariables: allowed, escape: true, strict: true })),
  };
}

module.exports = { sanitizeTemplate, composeHtml, renderPdf, renderEmail };
