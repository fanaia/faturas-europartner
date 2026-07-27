import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useOonApi } from "@oondemand/oon-core-front";

type CentralConfiguration = {
  publicBackendUrl: string;
  omieApiUrl: string;
  omieTimeoutMs: number;
  bacenPtaxUrl: string;
  bacenTimeoutMs: number;
  bacenMaxLookbackDays: number;
  processorEnabled: boolean;
  processorPollIntervalMs: number;
  processorBatchSize: number;
  processorLockMs: number;
  processorMaxAttempts: number;
  processorRetryBaseMs: number;
  webhookRateLimitPerMinute: number;
  pdfRenderTimeoutMs: number;
  emailMaxAttachmentsBytes: number;
  sendgridApiKeyMasked?: string;
  sendgridConfigured: boolean;
  atualizadoEm?: string;
  atualizadoPor?: string;
};

type CompanyConfiguration = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  codigoInterno: string;
  status: string;
  appKeyMasked: string;
  omieCredentialsConfigured: boolean;
  webhookTokenConfigured: boolean;
  webhookUrl: string;
  ultimaComunicacaoSucessoEm?: string;
  ultimoErroComunicacao?: string;
};

type ConfigurationResponse = {
  configuration: CentralConfiguration;
  companies: CompanyConfiguration[];
  message?: string;
};

type CompanyDraft = {
  appKey: string;
  appSecret: string;
  webhookToken: string;
  codigoOS: string;
};

type Notice = { tone: "success" | "error" | "info"; text: string };

const emptyDraft: CompanyDraft = { appKey: "", appSecret: "", webhookToken: "", codigoOS: "" };

const pageStyle: CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "24px" };
const cardStyle: CSSProperties = { background: "white", border: "1px solid #d9e2e8", borderRadius: 12, padding: 20, marginBottom: 20 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 };
const fieldStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const inputStyle: CSSProperties = { border: "1px solid #b8c5ce", borderRadius: 8, padding: "10px 12px", width: "100%", background: "white" };
const buttonStyle: CSSProperties = { border: 0, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 600 };
const primaryButtonStyle: CSSProperties = { ...buttonStyle, background: "#1677a8", color: "white" };
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, background: "#edf3f6", color: "#17313b" };

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { response?: { data?: { message?: string; error?: { message?: string } } }; message?: string };
    return candidate.response?.data?.error?.message || candidate.response?.data?.message || candidate.message || "Falha inesperada.";
  }
  return String(error || "Falha inesperada.");
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 700,
        background: ok ? "#dff4e7" : "#f7e7e7",
        color: ok ? "#17683a" : "#983333",
      }}
    >
      {label}: {ok ? "configurado" : "pendente"}
    </span>
  );
}

export default function ConfiguracoesCentral() {
  const { http } = useOonApi();
  const [configuration, setConfiguration] = useState<CentralConfiguration | null>(null);
  const [companies, setCompanies] = useState<CompanyConfiguration[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CompanyDraft>>({});
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get<ConfigurationResponse>("/api/configuracoes-central/");
      setConfiguration(response.data.configuration);
      setCompanies(response.data.companies || []);
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [http]);

  useEffect(() => {
    void load();
  }, [load]);

  const noticeStyle = useMemo<CSSProperties>(() => {
    if (!notice) return { display: "none" };
    const palette = notice.tone === "success"
      ? { background: "#e4f6ea", color: "#175f35" }
      : notice.tone === "error"
        ? { background: "#fdeaea", color: "#922f2f" }
        : { background: "#e9f3f8", color: "#23566f" };
    return { ...palette, borderRadius: 8, padding: 12, marginBottom: 16 };
  }, [notice]);

  function setConfig<K extends keyof CentralConfiguration>(key: K, value: CentralConfiguration[K]) {
    setConfiguration((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateDraft(companyId: string, patch: Partial<CompanyDraft>) {
    setDrafts((current) => ({
      ...current,
      [companyId]: { ...(current[companyId] || emptyDraft), ...patch },
    }));
  }

  async function saveGlobal(event: FormEvent) {
    event.preventDefault();
    if (!configuration) return;
    setSaving(true);
    try {
      const response = await http.put<ConfigurationResponse>("/api/configuracoes-central/", {
        ...configuration,
        sendgridApiKey,
      });
      setConfiguration(response.data.configuration);
      setCompanies(response.data.companies || companies);
      setSendgridApiKey("");
      setNotice({ tone: "success", text: response.data.message || "Configurações atualizadas." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function saveCompany(company: CompanyConfiguration) {
    const draft = drafts[company.id] || emptyDraft;
    setSaving(true);
    try {
      const response = await http.put<{ message: string; company: CompanyConfiguration }>(
        `/api/configuracoes-central/empresas/${company.id}/credenciais`,
        draft,
      );
      setCompanies((current) => current.map((item) => (item.id === company.id ? response.data.company : item)));
      setDrafts((current) => ({ ...current, [company.id]: emptyDraft }));
      setNotice({ tone: "success", text: response.data.message });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function generateToken(company: CompanyConfiguration) {
    setSaving(true);
    try {
      const response = await http.post<{ message: string; token: string }>(
        `/api/configuracoes-central/empresas/${company.id}/gerar-token-webhook`,
      );
      updateDraft(company.id, { webhookToken: response.data.token });
      setCompanies((current) => current.map((item) => (
        item.id === company.id ? { ...item, webhookTokenConfigured: true } : item
      )));
      setNotice({ tone: "info", text: response.data.message });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function testCompany(company: CompanyConfiguration) {
    const draft = drafts[company.id] || emptyDraft;
    setSaving(true);
    try {
      const response = await http.post<{ message: string }>(`/api/empresas-omie/${company.id}/testar-conexao`, {
        codigoOS: draft.codigoOS || undefined,
      });
      setNotice({ tone: "success", text: response.data.message });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setNotice({ tone: "success", text: message });
  }

  if (loading) return <main style={pageStyle}>Carregando configurações…</main>;
  if (!configuration) return <main style={pageStyle}><div style={noticeStyle}>{notice?.text || "Configuração indisponível."}</div></main>;

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 6 }}>Configurações</h1>
        <p style={{ margin: 0, color: "#52656f" }}>
          Cadastre aqui as integrações e parâmetros da Central após a publicação e ativação.
        </p>
      </header>

      {notice ? <div style={noticeStyle}>{notice.text}</div> : null}

      <form onSubmit={saveGlobal}>
        <section style={cardStyle}>
          <h2>URLs e integrações</h2>
          <div style={gridStyle}>
            <label style={fieldStyle}>
              <span>URL pública do backend</span>
              <input style={inputStyle} value={configuration.publicBackendUrl} onChange={(e) => setConfig("publicBackendUrl", e.target.value)} required />
            </label>
            <label style={fieldStyle}>
              <span>URL da API Omie</span>
              <input style={inputStyle} value={configuration.omieApiUrl} onChange={(e) => setConfig("omieApiUrl", e.target.value)} required />
            </label>
            <label style={fieldStyle}>
              <span>Timeout Omie (ms)</span>
              <input type="number" style={inputStyle} value={configuration.omieTimeoutMs} onChange={(e) => setConfig("omieTimeoutMs", Number(e.target.value))} required />
            </label>
            <label style={fieldStyle}>
              <span>URL PTAX BACEN</span>
              <input style={inputStyle} value={configuration.bacenPtaxUrl} onChange={(e) => setConfig("bacenPtaxUrl", e.target.value)} required />
            </label>
            <label style={fieldStyle}>
              <span>Timeout BACEN (ms)</span>
              <input type="number" style={inputStyle} value={configuration.bacenTimeoutMs} onChange={(e) => setConfig("bacenTimeoutMs", Number(e.target.value))} required />
            </label>
            <label style={fieldStyle}>
              <span>Busca retroativa PTAX (dias)</span>
              <input type="number" style={inputStyle} value={configuration.bacenMaxLookbackDays} onChange={(e) => setConfig("bacenMaxLookbackDays", Number(e.target.value))} required />
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>SendGrid</h2>
              <p style={{ margin: 0, color: "#52656f" }}>A Central utiliza uma única conta SendGrid para todas as empresas.</p>
            </div>
            <StatusBadge ok={configuration.sendgridConfigured} label="SendGrid" />
          </div>
          <div style={{ ...gridStyle, marginTop: 16 }}>
            <label style={fieldStyle}>
              <span>Nova API Key</span>
              <input
                type="password"
                autoComplete="new-password"
                style={inputStyle}
                value={sendgridApiKey}
                placeholder={configuration.sendgridConfigured ? `Manter ${configuration.sendgridApiKeyMasked || "chave atual"}` : "SG.xxxxx"}
                onChange={(e) => setSendgridApiKey(e.target.value)}
              />
              <small>Deixe em branco para manter a chave atual.</small>
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <h2>Processamento e limites</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input type="checkbox" checked={configuration.processorEnabled} onChange={(e) => setConfig("processorEnabled", e.target.checked)} />
            <span>Processamento automático habilitado</span>
          </label>
          <div style={gridStyle}>
            {([
              ["processorPollIntervalMs", "Intervalo do worker (ms)"],
              ["processorBatchSize", "Tamanho do lote"],
              ["processorLockMs", "Tempo de lock (ms)"],
              ["processorMaxAttempts", "Máximo de tentativas"],
              ["processorRetryBaseMs", "Base de retry (ms)"],
              ["webhookRateLimitPerMinute", "Webhooks por minuto"],
              ["pdfRenderTimeoutMs", "Timeout do PDF (ms)"],
              ["emailMaxAttachmentsBytes", "Limite de anexos (bytes)"],
            ] as Array<[keyof CentralConfiguration, string]>).map(([key, label]) => (
              <label style={fieldStyle} key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  style={inputStyle}
                  value={Number(configuration[key])}
                  onChange={(e) => setConfig(key, Number(e.target.value) as never)}
                  required
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <button type="submit" style={primaryButtonStyle} disabled={saving}>{saving ? "Salvando…" : "Salvar configurações gerais"}</button>
          </div>
        </section>
      </form>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Credenciais das Empresas Omie</h2>
            <p style={{ margin: 0, color: "#52656f" }}>Cadastre primeiro os dados funcionais em <a href="/empresas">Empresas Omie</a> e depois informe os segredos abaixo.</p>
          </div>
          <button type="button" style={secondaryButtonStyle} onClick={() => void load()}>Atualizar lista</button>
        </div>

        {!companies.length ? <p>Nenhuma Empresa Omie cadastrada.</p> : null}
        <div style={{ marginTop: 18 }}>
          {companies.map((company) => {
            const draft = drafts[company.id] || emptyDraft;
            return (
              <article key={company.id} style={{ borderTop: "1px solid #d9e2e8", padding: "20px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{company.nome}</h3>
                    <small>{company.cnpj} · {company.codigoInterno} · {company.status}</small>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <StatusBadge ok={company.omieCredentialsConfigured} label="Omie" />
                    <StatusBadge ok={company.webhookTokenConfigured} label="Webhook" />
                  </div>
                </div>

                <div style={{ ...gridStyle, marginTop: 16 }}>
                  <label style={fieldStyle}>
                    <span>App Key</span>
                    <input style={inputStyle} autoComplete="off" value={draft.appKey} placeholder={company.appKeyMasked || "Informe a App Key"} onChange={(e) => updateDraft(company.id, { appKey: e.target.value })} />
                  </label>
                  <label style={fieldStyle}>
                    <span>App Secret</span>
                    <input type="password" style={inputStyle} autoComplete="new-password" value={draft.appSecret} placeholder={company.omieCredentialsConfigured ? "Manter segredo atual" : "Informe o App Secret"} onChange={(e) => updateDraft(company.id, { appSecret: e.target.value })} />
                  </label>
                  <label style={fieldStyle}>
                    <span>Token do webhook</span>
                    <input type="password" style={inputStyle} autoComplete="new-password" value={draft.webhookToken} placeholder={company.webhookTokenConfigured ? "Manter token atual" : "Informe ou gere um token"} onChange={(e) => updateDraft(company.id, { webhookToken: e.target.value })} />
                  </label>
                  <label style={fieldStyle}>
                    <span>Código de OS para teste (opcional)</span>
                    <input style={inputStyle} value={draft.codigoOS} onChange={(e) => updateDraft(company.id, { codigoOS: e.target.value })} />
                  </label>
                </div>

                <div style={{ marginTop: 14, padding: 12, background: "#f4f7f9", borderRadius: 8 }}>
                  <strong>URL do webhook</strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                    <code style={{ overflowWrap: "anywhere" }}>{company.webhookUrl}</code>
                    <button type="button" style={secondaryButtonStyle} onClick={() => void copy(company.webhookUrl, "URL copiada.")}>Copiar URL</button>
                  </div>
                  {draft.webhookToken ? (
                    <div style={{ marginTop: 10 }}>
                      <strong>Token disponível nesta sessão:</strong>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                        <code style={{ overflowWrap: "anywhere" }}>{draft.webhookToken}</code>
                        <button type="button" style={secondaryButtonStyle} onClick={() => void copy(draft.webhookToken, "Token copiado.")}>Copiar token</button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button type="button" style={secondaryButtonStyle} disabled={saving} onClick={() => void generateToken(company)}>Gerar novo token</button>
                  <button type="button" style={primaryButtonStyle} disabled={saving} onClick={() => void saveCompany(company)}>Salvar credenciais</button>
                  <button type="button" style={secondaryButtonStyle} disabled={saving || !company.omieCredentialsConfigured} onClick={() => void testCompany(company)}>Testar conexão</button>
                </div>
                {company.ultimoErroComunicacao ? <p style={{ color: "#922f2f" }}>Último erro: {company.ultimoErroComunicacao}</p> : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
