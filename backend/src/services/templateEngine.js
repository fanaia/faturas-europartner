const { OperationalError } = require("../lib/error");

const TOKEN = /{{\s*([a-zA-Z0-9_@.]+)\s*}}/g;
const EACH_BLOCK = /{{#each\s+([a-zA-Z0-9_.]+)\s*}}([\s\S]*?){{\/each}}/g;
const IF_BLOCK = /{{#if\s+([a-zA-Z0-9_@.]+)\s*}}([\s\S]*?){{\/if}}/g;

function getPath(source, path) {
  if (path === "this") return source?.this;
  return String(path || "")
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseAllowed(value) {
  return new Set(
    String(value || "")
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function isAllowed(path, allowed, localRoot) {
  if (!allowed.size) return true;
  if (path === "@index") return Boolean(localRoot);
  if (path === "this" || path.startsWith("this.")) return Boolean(localRoot) && isAllowed(localRoot, allowed);
  return allowed.has(path) || [...allowed].some((prefix) => path.startsWith(`${prefix}.`));
}

function assertAllowed(path, allowed, localRoot) {
  if (!isAllowed(path, allowed, localRoot)) {
    throw new OperationalError(`Variável não autorizada no modelo: ${path}.`, {
      code: "TEMPLATE_VARIABLE_NOT_ALLOWED",
    });
  }
}

function renderValue(value, escape) {
  const normalized = typeof value === "object" ? JSON.stringify(value) : value;
  return escape ? escapeHtml(normalized) : String(normalized ?? "");
}

function renderInternal(template, variables, options, scope = {}) {
  const { allowed, escape, strict, missing } = options;
  let output = String(template || "");

  // Blocos são intencionalmente simples e sem execução de JavaScript. O loop
  // é repetido para suportar blocos aninhados de forma determinística.
  let previous;
  do {
    previous = output;
    output = output.replace(EACH_BLOCK, (_, path, body) => {
      assertAllowed(path, allowed, scope.localRoot);
      const items = getPath(variables, path);
      if (items == null) {
        if (strict) missing.push(path);
        return "";
      }
      if (!Array.isArray(items)) {
        throw new OperationalError(`A variável ${path} precisa ser uma lista para #each.`, {
          code: "TEMPLATE_EACH_REQUIRES_ARRAY",
        });
      }
      return items
        .map((item, index) =>
          renderInternal(
            body,
            { ...variables, this: item, "@index": index },
            options,
            { localRoot: path }
          )
        )
        .join("");
    });
  } while (output !== previous && EACH_BLOCK.test(output));
  EACH_BLOCK.lastIndex = 0;

  do {
    previous = output;
    output = output.replace(IF_BLOCK, (_, path, body) => {
      assertAllowed(path, allowed, scope.localRoot);
      const value = getPath(variables, path);
      return value ? renderInternal(body, variables, options, scope) : "";
    });
  } while (output !== previous && IF_BLOCK.test(output));
  IF_BLOCK.lastIndex = 0;

  return output.replace(TOKEN, (_, path) => {
    assertAllowed(path, allowed, scope.localRoot);
    const value = getPath(variables, path);
    if (value === undefined || value === null) {
      missing.push(scope.localRoot && path.startsWith("this") ? `${scope.localRoot}.${path.replace(/^this\.?/, "")}` : path);
      return "";
    }
    return renderValue(value, escape);
  });
}

function render(template, variables, { allowedVariables, escape = true, strict = true } = {}) {
  const allowed = allowedVariables instanceof Set ? allowedVariables : parseAllowed(allowedVariables);
  const missing = [];
  const output = renderInternal(
    template,
    variables || {},
    { allowed, escape, strict, missing },
    {}
  );
  if (strict && missing.length) {
    const unique = [...new Set(missing.filter(Boolean))];
    throw new OperationalError(`Variáveis sem valor: ${unique.join(", ")}.`, {
      code: "TEMPLATE_VARIABLE_MISSING",
      details: { missing: unique },
    });
  }
  return output;
}

module.exports = { getPath, escapeHtml, parseAllowed, isAllowed, render };
