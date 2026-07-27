# Manual de Configuração — Central Faturas Europartner

**Versão do documento:** 1.0  
**Escopo:** configuração técnica, cadastros funcionais, integração Omie, modelos de fatura, e-mail, cotação, adiantamento e homologação do MVP.

> Este manual descreve a configuração disponível na versão atual da Central. Credenciais, códigos de clientes, etapas, contas, categorias e modelos devem ser homologados com a Europartner antes da ativação em produção.

---

## 1. Objetivo da Central

A Central Faturas Europartner processa automaticamente uma Ordem de Serviço quando o Omie informa a alteração para uma etapa configurada.

Fluxo resumido:

1. o Omie envia o evento `OrdemServico.EtapaAlterada`;
2. a Central autentica, sanitiza, persiste e deduplica o evento;
3. o worker consulta a OS, o cliente e o país no Omie;
4. a Central localiza o perfil de faturamento vigente;
5. resolve a versão publicada do modelo e a cotação aplicável;
6. gera o PDF da fatura;
7. anexa o PDF na OS;
8. envia o e-mail;
9. gera o adiantamento, quando habilitado;
10. altera a etapa da OS após concluir os efeitos obrigatórios.

Cada efeito possui execução independente, auditoria, tentativas e retomada sem repetir automaticamente os efeitos já concluídos.

---

## 2. Ordem recomendada de configuração

Execute a configuração nesta ordem:

1. preparar Node.js, MongoDB e dependências;
2. criar os arquivos `.env` do backend e do frontend;
3. iniciar backend e frontend;
4. executar a ativação inicial;
5. cadastrar os segredos no ambiente;
6. cadastrar as Empresas Omie;
7. testar as credenciais;
8. cadastrar e publicar os modelos de documento;
9. cadastrar os perfis de faturamento;
10. configurar os webhooks no Omie;
11. homologar uma OS por empresa e moeda;
12. ativar o processamento produtivo.

Não configure o webhook produtivo antes de existir uma empresa, um modelo publicado e exatamente um perfil ativo compatível com o cliente e a etapa.

---

# Parte I — Configuração técnica

## 3. Pré-requisitos

### 3.1 Software

- Node.js 20 ou superior;
- npm 10 ou superior;
- MongoDB acessível pela Central;
- Git;
- acesso aos pacotes `@oondemand` no npm;
- acesso à API do Omie;
- conta e chave do SendGrid para envio de e-mails;
- acesso externo HTTPS ao backend para receber webhooks em produção.

Para conferir as versões:

```powershell
node --version
npm --version
git --version
```

### 3.2 Portas locais padrão

| Serviço | Porta |
|---|---:|
| Backend | 4000 |
| Frontend | 5173 |
| MongoDB local | 27017 |

---

## 4. Instalação local

Na raiz do repositório:

```powershell
git checkout agent/implementar-central-faturas-europartner
git pull origin agent/implementar-central-faturas-europartner

npm install
npm install --prefix backend
npm install --prefix frontend
```

Crie os arquivos de ambiente:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Valide o projeto:

```powershell
npm run check
npm test
npm run build --prefix frontend
```

---

## 5. Configuração do backend

Arquivo:

```text
backend/.env
```

### 5.1 Identidade e execução

```env
SERVICE_NAME=faturas-europartner
SERVICE_VERSION=0.1.0
PORT=4000
NODE_ENV=development
```

Em produção, use:

```env
NODE_ENV=production
```

### 5.2 MongoDB

Ambiente local:

```env
MONGO_URI=mongodb://localhost:27017/faturas-europartner
```

Produção, exemplo conceitual:

```env
MONGO_URI=mongodb+srv://USUARIO:SENHA@CLUSTER/faturas-europartner
```

Não versione a URI real. Armazene-a no provedor de segredos do ambiente.

### 5.3 Ecossistema e ativação

```env
CENTRAL_ATIVACAO_URL=https://central-ativacao.central.oondemand.online
CENTRAL_ATIVACAO_API_URL=https://central-ativacao.central.oondemand.online/api/
APP_CODE=faturas-europartner
APP_ENVIRONMENT=desenvolvimento
PUBLIC_APP_URL=http://localhost:5173
AUTH_PROVIDER_TIMEOUT_MS=10000
INSTANCE_CREDENTIAL_ENCRYPTION_KEY=
```

Em produção:

- ajuste `APP_ENVIRONMENT` para o ambiente publicado;
- ajuste `PUBLIC_APP_URL` para a URL pública do frontend;
- configure `INSTANCE_CREDENTIAL_ENCRYPTION_KEY` com uma chave forte fornecida pelo ambiente;
- não reutilize chaves entre ambientes.

### 5.4 Autenticação local

Para desenvolvimento:

```env
DEV_TOKEN=dev-local
```

O usuário local é tratado como administrador apenas quando:

```env
NODE_ENV=development
```

Em produção, não configure `DEV_TOKEN`. A autenticação deve ser fornecida pelo ecossistema Oon.

### 5.5 Integrações externas

```env
OMIE_API_URL=https://app.omie.com.br/api/v1/
BACEN_PTAX_URL=https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata
SENDGRID_API_KEY=SG.SUBSTITUIR
```

`SENDGRID_API_KEY` é o segredo padrão de envio. Também é possível configurar uma referência diferente em cada Empresa Omie.

### 5.6 Worker e tentativas

```env
PROCESSOR_ENABLED=true
PROCESSOR_POLL_INTERVAL_MS=5000
PROCESSOR_BATCH_SIZE=10
PROCESSOR_LOCK_MS=300000
PROCESSOR_MAX_ATTEMPTS=5
PROCESSOR_RETRY_BASE_MS=30000
INSTANCE_ID=local-dev
```

Descrição:

| Variável | Função |
|---|---|
| `PROCESSOR_ENABLED` | Liga ou desliga o processamento automático. |
| `PROCESSOR_POLL_INTERVAL_MS` | Intervalo de busca por trabalhos pendentes. |
| `PROCESSOR_BATCH_SIZE` | Quantidade máxima processada por ciclo. |
| `PROCESSOR_LOCK_MS` | Tempo de bloqueio de uma execução em processamento. |
| `PROCESSOR_MAX_ATTEMPTS` | Máximo de tentativas automáticas. |
| `PROCESSOR_RETRY_BASE_MS` | Base do backoff entre tentativas. |
| `INSTANCE_ID` | Identifica a instância do worker. Deve ser única quando houver mais de uma réplica. |

Durante a configuração inicial, pode-se usar:

```env
PROCESSOR_ENABLED=false
```

Ative o worker somente depois de concluir empresas, modelos, perfis e webhooks.

### 5.7 Segurança e limites

```env
WEBHOOK_RATE_LIMIT_PER_MINUTE=120
PDF_RENDER_TIMEOUT_MS=30000
EMAIL_MAX_ATTACHMENTS_BYTES=20000000
BACEN_MAX_LOOKBACK_DAYS=30
LOG_LEVEL=info
```

- `WEBHOOK_RATE_LIMIT_PER_MINUTE`: limite por código de empresa;
- `PDF_RENDER_TIMEOUT_MS`: tempo máximo para renderizar o PDF;
- `EMAIL_MAX_ATTACHMENTS_BYTES`: soma máxima dos anexos do e-mail;
- `BACEN_MAX_LOOKBACK_DAYS`: quantidade máxima de dias anteriores pesquisados quando não há PTAX na data solicitada;
- `LOG_LEVEL`: nível de detalhe dos logs.

---

## 6. Configuração do frontend

Arquivo:

```text
frontend/.env
```

Ambiente local:

```env
VITE_API_URL=http://localhost:4000
VITE_DEV_TOKEN=dev-local
```

Produção:

```env
VITE_API_URL=https://URL-PUBLICA-DO-BACKEND
```

Não configure `VITE_DEV_TOKEN` em produção.

Quando aplicável, configure a URL do portal de aplicações:

```env
VITE_MEUS_APPS_URL=https://URL-DO-PORTAL
```

---

## 7. Inicialização

Abra dois terminais.

### Terminal 1 — backend

```powershell
cd backend
npm run start
```

Durante desenvolvimento, também é possível usar:

```powershell
npm run dev
```

### Terminal 2 — frontend

```powershell
cd frontend
npm run dev
```

Acesse:

```text
http://localhost:5173
```

---

## 8. Ativação inicial

Com o MongoDB e o backend configurados:

```powershell
npm run activate --prefix backend
```

A ativação cria:

- o modelo `invoice-padrao`;
- a versão `1.0.0`, em português;
- conteúdo HTML e CSS iniciais;
- status da versão como `rascunho`.

A ativação não cria empresas, credenciais, perfis, códigos Omie, etapas ou remetentes fictícios.

A operação é idempotente: uma nova execução não deve duplicar o modelo inicial existente.

---

# Parte II — Segredos e credenciais

## 9. Conceito de referência de segredo

A Central não guarda `appSecret`, token de webhook ou chave de e-mail nos cadastros.

Os campos de referência armazenam apenas o nome de uma variável de ambiente, por exemplo:

```text
OMIE_EUROPARTNER_BRASIL
WEBHOOK_EUROPARTNER_BRASIL
SENDGRID_API_KEY
```

Uma referência válida:

- começa com letra maiúscula;
- usa somente letras maiúsculas, números e `_`;
- possui pelo menos três caracteres.

Não use:

```text
omie-europartner-brasil
MinhaChave
SG.xxxxx
```

O último exemplo é o valor do segredo, e não o nome da variável.

---

## 10. Credencial Omie por empresa

Crie uma variável por base/CNPJ:

```env
OMIE_EUROPARTNER_BRASIL={"appKey":"APP_KEY_REAL","appSecret":"APP_SECRET_REAL"}
```

Também são aceitas as chaves `app_key` e `app_secret`, mas o padrão recomendado é:

```json
{
  "appKey": "...",
  "appSecret": "..."
}
```

O conteúdo precisa ser JSON válido em uma única variável de ambiente.

Exemplos para múltiplas empresas:

```env
OMIE_EUROPARTNER_BRASIL={"appKey":"...","appSecret":"..."}
OMIE_EUROPARTNER_EUA={"appKey":"...","appSecret":"..."}
OMIE_EUROPARTNER_EUROPA={"appKey":"...","appSecret":"..."}
```

---

## 11. Token de webhook por empresa

Crie um token forte e diferente para cada empresa:

```env
WEBHOOK_EUROPARTNER_BRASIL=TOKEN_LONGO_ALEATORIO
```

Recomendações:

- mínimo de 32 caracteres aleatórios;
- não usar appKey ou appSecret como token;
- não reutilizar entre empresas;
- rotacionar em caso de suspeita de exposição.

O token pode chegar ao webhook por:

```http
X-Webhook-Token: TOKEN
```

ou:

```http
Authorization: Bearer TOKEN
```

---

## 12. Chave de e-mail

Padrão global:

```env
SENDGRID_API_KEY=SG.CHAVE_REAL
```

No cadastro da Empresa Omie, o campo **Referência do Segredo de E-mail** deve conter:

```text
SENDGRID_API_KEY
```

Pode-se usar uma chave diferente por empresa:

```env
SENDGRID_EUROPARTNER_BRASIL=SG.CHAVE_REAL
```

Nesse caso, cadastre `SENDGRID_EUROPARTNER_BRASIL` na empresa correspondente.

---

# Parte III — Configuração funcional

## 13. Perfis e permissões

### Administrador

Pode:

- cadastrar Empresas Omie;
- testar configuração;
- cadastrar modelos e versões;
- publicar modelos;
- cadastrar perfis;
- reprocessar faturas, eventos e adiantamentos;
- acompanhar toda a operação.

### Gestor de faturamento

Pode:

- manter modelos e versões;
- publicar versões;
- manter perfis de faturamento;
- acompanhar e reprocessar a operação.

### Operação de faturamento

Pode:

- acompanhar faturas, eventos e integrações;
- manter perfis, conforme RBAC atual;
- reprocessar eventos e fluxos autorizados;
- não pode testar credenciais da empresa nem publicar versões.

---

## 14. Cadastro de Empresas Omie

Menu:

```text
Configurações > Empresas Omie
```

Comece sempre com o status **Homologação**.

### 14.1 Campos

| Campo | Obrigatório | Orientação |
|---|---:|---|
| Nome | Sim | Nome curto apresentado na Central. Ex.: `Europartner Brasil`. |
| Razão Social | Sim | Razão social oficial do CNPJ. |
| CNPJ | Sim | CNPJ válido e exclusivo. |
| Código Interno | Sim | Identificador exclusivo em kebab-case. Ex.: `europartner-brasil`. |
| App Key | Não preencher manualmente | É mascarada e atualizada pelo teste de configuração. |
| Referência do Segredo Omie | Sim | Nome da variável com o JSON `appKey/appSecret`. |
| Referência do Token do Webhook | Sim | Nome da variável com o token do webhook. |
| Referência do Segredo de E-mail | Não | Padrão: `SENDGRID_API_KEY`. |
| Etapa de Entrada | Sim | Etapa padrão que dispara o processamento. |
| Etapa de Sucesso | Sim | Etapa aplicada após conclusão. |
| Etapa de Erro | Sim | Etapa usada conforme a política operacional de erro. |
| Categoria de Adiantamento | Condicional | Necessária quando o perfil gera adiantamento. |
| Conta Corrente de Adiantamento | Condicional | Necessária quando o perfil gera adiantamento. |
| E-mail Remetente | Sim | Remetente autorizado no SendGrid. |
| Nome do Remetente | Sim | Nome exibido no e-mail. |
| Cópias Padrão | Não | E-mails separados por vírgula, ponto e vírgula ou nova linha. |
| Status | Sim | `homologacao`, `ativa`, `inativa` ou `arquivada`. |

### 14.2 Código interno

O código interno precisa estar em kebab-case:

```text
europartner-brasil
europartner-miami
europartner-espanha
```

Não use espaços, `_`, letras maiúsculas ou acentos.

Esse código compõe a URL pública do webhook e não deve ser alterado depois de configurado no Omie sem atualizar o webhook.

### 14.3 Etapas do Omie

Cadastre o valor exato recebido no evento do Omie.

O perfil pode substituir as etapas padrão da empresa. Quando o perfil não informa uma etapa específica, são usados os valores da Empresa Omie.

Registre para cada empresa:

| Finalidade | Valor homologado |
|---|---|
| Entrada | A confirmar |
| Sucesso | A confirmar |
| Erro | A confirmar |

### 14.4 Status

- `homologacao`: aceita webhooks, mas indica que a base ainda está em testes;
- `ativa`: operação produtiva;
- `inativa`: webhooks são recusados;
- `arquivada`: registro histórico fora de uso.

---

## 15. Teste da Empresa Omie

Na listagem de empresas, use:

```text
Testar configuração
```

O teste padrão valida:

- existência da variável de ambiente informada em `secretRef`;
- JSON válido;
- presença de `appKey` e `appSecret`;
- gravação mascarada da appKey;
- atualização de data e erro de comunicação.

Para testar também uma consulta real de OS, a API aceita `codigoOS`:

```http
POST /api/empresas-omie/{ID_DA_EMPRESA}/testar-conexao
Authorization: Bearer TOKEN_DE_USUARIO
Content-Type: application/json

{
  "codigoOS": "CODIGO_INTERNO_DA_OS"
}
```

Após o teste, confira:

- **App Key** mascarada;
- **Última Comunicação** preenchida;
- **Último Erro** vazio.

---

## 16. Modelos de documento

Menu:

```text
Documentos > Modelos
```

Um modelo representa uma família de documentos, como:

- Invoice padrão BRL;
- Invoice internacional USD;
- Invoice internacional EUR;
- Invoice específica de cliente.

### Campos

| Campo | Orientação |
|---|---|
| Código | Identificador único em formato estável. Ex.: `invoice-internacional`. |
| Nome | Nome funcional. |
| Descrição | Finalidade e clientes atendidos. |
| Idiomas Suportados | Lista como `pt-BR,en-US,es-ES`. |
| Status | Use `ativo` para permitir resolução pelo perfil. |

O perfil aponta para o modelo, mas o processamento usa uma **versão publicada** no idioma do perfil.

---

## 17. Versões de modelo

Menu:

```text
Documentos > Versões de Modelos
```

### 17.1 Campos

| Campo | Orientação |
|---|---|
| Modelo | Modelo pai. |
| Versão | Identificador exclusivo por modelo e idioma. Ex.: `1.0.0`. |
| Idioma | `pt-BR`, `en-US` ou `es-ES`. |
| Motor | Use `template-seguro`. |
| HTML do Documento | Estrutura do PDF. |
| CSS | Estilos do documento. |
| Assunto do E-mail | Assunto parametrizado. |
| Corpo do E-mail | HTML do e-mail. |
| Variáveis Permitidas | Raízes autorizadas, uma por linha. |
| Status | Inicie em `rascunho`. |

### 17.2 Estados

- `rascunho`: em edição;
- `homologacao`: pronto para testes funcionais;
- `publicado`: disponível para novos processamentos;
- `substituido`: havia sido publicado, mas outra versão do mesmo idioma assumiu;
- `arquivado`: fora de uso.

### 17.3 Publicação

Use a ação:

```text
Publicar
```

Ao publicar:

- o conteúdo recebe hash;
- usuário e data são registrados;
- a versão se torna imutável;
- uma versão publicada anterior do mesmo modelo/idioma é substituída;
- novos processamentos passam a usar a nova versão;
- faturas já preparadas preservam o snapshot anterior.

Nunca edite diretamente uma versão publicada. Crie uma nova versão.

---

## 18. Motor de template seguro

O motor não executa JavaScript nem EJS.

### 18.1 Variáveis padrão

```text
empresa
cliente
ordemServico
servicos
parcelas
impostos
moeda
cotacao
datas
configuracoesPublicas
```

### 18.2 Exemplos

Valor simples:

```html
{{empresa.razaoSocial}}
{{cliente.razao_social}}
{{ordemServico.Cabecalho.cNumOS}}
{{moeda}}
{{cotacao.efetiva}}
```

Condição:

```html
{{#if cliente.pais}}
<p>País: {{cliente.pais}}</p>
{{/if}}
```

Lista:

```html
{{#each servicos}}
<tr>
  <td>{{@index}}</td>
  <td>{{this.cDescricao}}</td>
  <td>{{this.nQtde}}</td>
  <td>{{this.nValUnit}}</td>
</tr>
{{/each}}
```

### 18.3 Variáveis de cotação

```text
cotacao.oficial
cotacao.efetiva
cotacao.dataSolicitada
cotacao.dataEfetiva
cotacao.origem
```

### 18.4 Boas práticas

- declare todas as raízes usadas em **Variáveis Permitidas**;
- homologue campos reais retornados pelo Omie;
- não dependa de HTML ou JavaScript vindo do cliente;
- evite imagens externas instáveis;
- use CSS apropriado para A4;
- crie uma nova versão para cada alteração homologada.

---

## 19. Perfis de faturamento

Menu:

```text
Configurações > Perfis de Faturamento
```

O perfil é a regra que liga:

```text
Empresa Omie + Cliente Omie + Etapa + Vigência
```

à configuração:

```text
Modelo + Idioma + Moeda + Cotação + E-mail + Anexos + Adiantamento
```

### 19.1 Regra crítica de unicidade

Para cada evento deve existir **exatamente um perfil ativo e vigente** compatível com:

- empresa;
- código do cliente Omie;
- data atual;
- etapa de entrada, quando informada no perfil.

Nenhum perfil gera `BILLING_PROFILE_NOT_FOUND`.

Mais de um perfil compatível gera `MULTIPLE_BILLING_PROFILES`.

Evite vigências sobrepostas para o mesmo cliente, empresa e etapa.

### 19.2 Identificação

| Campo | Orientação |
|---|---|
| Nome | Nome claro, incluindo cliente, moeda e finalidade. |
| Empresa Omie | Base que receberá o evento. |
| Código do Cliente Omie | Código interno do cliente na base Omie. Não é CNPJ. |
| Cliente | Nome para consulta operacional. |
| Modelo de Documento | Modelo ativo que possui versão publicada no idioma escolhido. |
| Idioma | `pt-BR`, `en-US` ou `es-ES`. |

Padrão recomendado para o nome:

```text
Cliente XPTO — USD — Invoice internacional
```

### 19.3 Moeda e PTAX

| Campo | Opções | Comportamento |
|---|---|---|
| Moeda | BRL, USD, EUR | BRL usa fator 1; USD/EUR consultam PTAX. |
| Data de Referência | data da OS, previsão da OS, processamento | Define a data solicitada ao BACEN. |
| Campo PTAX | compra, venda | Seleciona qual cotação oficial será usada. |
| Tipo de Ajuste | nenhum, percentual, valor fixo | Aplica ajuste sobre a cotação oficial. |
| Ajuste | número | Percentual entre -100 e 100, ou valor fixo. |

Cálculo percentual:

```text
cotação efetiva = cotação oficial × (1 + percentual ÷ 100)
```

Cálculo por valor fixo:

```text
cotação efetiva = cotação oficial + ajuste
```

Quando não há PTAX publicada na data solicitada, a Central procura a última data disponível dentro do limite `BACEN_MAX_LOOKBACK_DAYS`.

### 19.4 Impostos

O campo **Regra de Impostos (JSON)** disponibiliza um objeto para o template na variável:

```text
impostos
```

Exemplo:

```json
{
  "descricao": "Withholding tax",
  "percentual": 2.5,
  "observacao": "Aplicável conforme contrato"
}
```

A Central valida o JSON, mas a apresentação e os cálculos desejados precisam estar expressos no modelo homologado.

### 19.5 Destinatários e cópias

| Campo | Uso |
|---|---|
| Destinatários Adicionais | Endereços adicionados ao destinatário obtido do cliente/OS. |
| Cópias | Cópias específicas do perfil. |
| Cópias Padrão da Empresa | Cópias aplicadas pela configuração da empresa. |

Use endereços separados por vírgula, ponto e vírgula ou nova linha.

### 19.6 Política de anexos

Opções:

- `somente_fatura`: envia apenas o PDF gerado;
- `fatura_e_permitidos`: inclui anexos da OS conforme allowlist;
- `selecao_manual`: reservada para operação assistida.

A política `selecao_manual` não pode ser ativada no processamento automático atual.

Para `fatura_e_permitidos`, configure:

```text
Extensões Permitidas: pdf,xml,xlsx,docx,jpg,png
```

Opcionalmente:

- padrões de nome incluídos;
- padrões de nome excluídos.

Comece com `somente_fatura` durante a homologação.

### 19.7 Adiantamento

Campo:

```text
Gerar Adiantamento
```

Quando habilitado, confirme na Empresa Omie:

- categoria de adiantamento;
- conta corrente de adiantamento;
- permissões e configuração da base Omie;
- regra esperada para a OS.

O processamento usa idempotência para evitar duplicação automática, mas a homologação deve confirmar o comportamento real da API e da base.

### 19.8 Etapas específicas

O perfil pode sobrescrever:

- etapa de entrada;
- etapa de sucesso;
- etapa de erro.

Deixe em branco para usar os valores padrão da Empresa Omie.

A etapa de entrada do perfil também participa da seleção do perfil. O valor precisa ser igual ao recebido no webhook.

### 19.9 Vigência e status

- `Vigente Desde`: obrigatório;
- `Vigente Até`: opcional;
- a data final não pode ser anterior à inicial;
- use `rascunho` enquanto configura;
- use `ativo` somente depois de publicar o modelo e homologar os dados;
- use `inativo` para interromper novas resoluções;
- use `arquivado` para histórico.

---

# Parte IV — Webhook Omie

## 20. URL por empresa

Formato:

```text
POST https://BACKEND/api/integrations/omie/webhooks/ordem-servico/{codigoInterno}
```

Exemplo:

```text
POST https://faturas-europartner-api.exemplo.com/api/integrations/omie/webhooks/ordem-servico/europartner-brasil
```

Cabeçalho recomendado:

```http
X-Webhook-Token: TOKEN_DA_EMPRESA
Content-Type: application/json
```

### Evento aceito

```text
OrdemServico.EtapaAlterada
```

Outros tópicos são persistidos como ignorados e não seguem para faturamento.

### Validações realizadas

- empresa existente;
- status `ativa` ou `homologacao`;
- token válido;
- rate limit;
- appKey do evento correspondente à credencial da empresa, quando enviada;
- deduplicação por `eventId` ou hash;
- sanitização antes da persistência.

---

## 21. Teste de disponibilidade do webhook

No PowerShell:

```powershell
$headers = @{
  "X-Webhook-Token" = "TOKEN_DA_EMPRESA"
  "Content-Type" = "application/json"
}

$body = '{"ping":"omie"}'

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:4000/api/integrations/omie/webhooks/ordem-servico/europartner-brasil" `
  -Headers $headers `
  -Body $body
```

Resposta esperada:

```json
{
  "message": "pong"
}
```

Esse teste valida URL, empresa e token. Ele não cria uma fatura.

---

## 22. Configuração no Omie

Para cada base Omie:

1. abra a configuração de webhooks da aplicação;
2. cadastre a URL correspondente ao `codigoInterno` da empresa;
3. selecione o evento de alteração de etapa da Ordem de Serviço;
4. configure o token no cabeçalho suportado pela integração;
5. salve;
6. execute um teste controlado;
7. confira o evento em **Operação > Eventos Omie**.

Registre em inventário:

| Empresa | Código interno | URL do webhook | Evento | Token ref | Situação |
|---|---|---|---|---|---|
| A preencher | A preencher | A preencher | OrdemServico.EtapaAlterada | A preencher | Homologação |

---

# Parte V — Homologação ponta a ponta

## 23. Preparação do caso de teste

Escolha inicialmente:

- uma Empresa Omie;
- um cliente;
- uma OS sem efeitos produtivos críticos;
- um perfil BRL sem adiantamento;
- política `somente_fatura`;
- remetente e destinatário de homologação;
- modelo simples e publicado.

Confirme que:

- a empresa está em `homologacao`;
- o perfil está `ativo` e vigente;
- existe somente um perfil compatível;
- há uma versão `publicado` no idioma do perfil;
- o modelo está `ativo`;
- o worker está ligado;
- o webhook responde ao ping;
- o SendGrid aceita o remetente.

---

## 24. Execução do teste

1. mova a OS para a etapa de entrada;
2. aguarde o webhook;
3. abra **Operação > Eventos Omie**;
4. confirme que o evento aparece como aceito;
5. abra **Operação > Faturas** ou a **Esteira de Faturas**;
6. acompanhe as etapas;
7. abra o detalhe da fatura;
8. confira as abas de OS/Cliente, Documento, Cotação, E-mail, Adiantamento, Integrações e Operação.

Valide:

- empresa e OS corretas;
- cliente correto;
- perfil correto;
- moeda e cotação;
- versão do modelo;
- nome e hash do PDF;
- anexo no Omie;
- destinatários e cópias;
- recebimento do e-mail;
- adiantamento, quando habilitado;
- etapa final da OS;
- execuções independentes sem duplicação.

---

## 25. Cenários mínimos de homologação

### Empresa e segurança

- token correto;
- token incorreto;
- empresa inativa;
- appKey incompatível;
- evento duplicado;
- tópico fora do escopo.

### Perfil

- perfil inexistente;
- dois perfis ativos sobrepostos;
- vigência futura;
- etapa incompatível;
- modelo inativo;
- versão não publicada no idioma.

### Documento

- BRL;
- USD;
- EUR;
- campos ausentes no template;
- variável não autorizada;
- lista de serviços;
- condição por país;
- publicação de nova versão.

### Efeitos

- falha ao anexar;
- falha ao enviar e-mail;
- reenvio de e-mail;
- reanexação;
- falha no adiantamento;
- reprocessamento do adiantamento;
- retomada após retry;
- confirmação de que efeitos concluídos não foram repetidos.

---

## 26. Ações operacionais

Na listagem de faturas estão disponíveis, conforme perfil de acesso:

- **Reprocessar preparação**: refaz a preparação somente quando ainda é seguro substituir snapshots;
- **Reprocessar**: retoma o fluxo pendente/falho;
- **Reanexar no Omie**: envia novamente o PDF preservado;
- **Reenviar e-mail**: reenvia sem refazer automaticamente os demais efeitos;
- **Reprocessar adiantamento**: consulta o estado atual antes da nova tentativa.

Em **Eventos Omie**:

- **Reprocessar evento**: retoma eventos elegíveis;
- eventos ignorados ou duplicados não podem ser reprocessados pela ação padrão.

Antes de usar qualquer ação, leia a aba **Integrações** para identificar quais efeitos já foram concluídos.

---

# Parte VI — Produção

## 27. Checklist de entrada em produção

### Infraestrutura

- [ ] domínio e HTTPS configurados;
- [ ] MongoDB produtivo e backup configurados;
- [ ] segredos provisionados fora do repositório;
- [ ] `NODE_ENV=production`;
- [ ] `DEV_TOKEN` removido;
- [ ] frontend sem `VITE_DEV_TOKEN`;
- [ ] autenticação e RBAC produtivos validados;
- [ ] logs e monitoramento configurados;
- [ ] `INSTANCE_ID` único por réplica;
- [ ] política de retenção e LGPD validada.

### Empresas

- [ ] todos os CNPJs conferidos;
- [ ] credencial Omie testada;
- [ ] token exclusivo por empresa;
- [ ] etapas confirmadas;
- [ ] remetentes verificados;
- [ ] categoria e conta de adiantamento homologadas;
- [ ] status alterado de `homologacao` para `ativa`.

### Modelos

- [ ] HTML revisado;
- [ ] CSS revisado;
- [ ] assunto e corpo do e-mail aprovados;
- [ ] variáveis permitidas revisadas;
- [ ] uma versão publicada por idioma utilizado;
- [ ] PDFs aprovados pela Europartner.

### Perfis

- [ ] códigos de cliente conferidos;
- [ ] vigências sem sobreposição;
- [ ] moedas e PTAX aprovadas;
- [ ] destinatários e cópias aprovados;
- [ ] anexos aprovados;
- [ ] adiantamento aprovado;
- [ ] exatamente um perfil ativo por cenário.

### Webhooks

- [ ] URL produtiva cadastrada por empresa;
- [ ] token configurado;
- [ ] ping validado;
- [ ] evento real recebido;
- [ ] deduplicação validada;
- [ ] rate limit compatível com o volume.

### Operação

- [ ] piloto realizado em uma empresa;
- [ ] piloto realizado em BRL;
- [ ] piloto realizado em USD e EUR, quando aplicável;
- [ ] procedimento de retry treinado;
- [ ] responsáveis por N1/N2/N3 definidos;
- [ ] plano de rollback definido.

---

## 28. Estratégia recomendada de rollout

1. homologar uma base e um cliente BRL;
2. ativar sem adiantamento;
3. validar anexação e e-mail;
4. ativar adiantamento;
5. homologar USD;
6. homologar EUR;
7. adicionar os demais clientes da primeira empresa;
8. monitorar por alguns dias;
9. repetir por empresa;
10. somente depois ativar todos os webhooks produtivos.

Evite ativar simultaneamente as sete empresas antes de concluir o piloto.

---

# Parte VII — Diagnóstico

## 29. Erros comuns

| Código/mensagem | Causa provável | Correção |
|---|---|---|
| `SECRET_NOT_CONFIGURED` | A variável informada na referência não existe. | Criar o segredo no ambiente e reiniciar o backend. |
| `INVALID_SECRET_FORMAT` | O segredo Omie não contém JSON válido. | Corrigir aspas, chaves e formato JSON. |
| `INVALID_OMIE_CREDENTIALS` | Não há `appKey` ou `appSecret`. | Corrigir o JSON da credencial. |
| `INVALID_WEBHOOK_TOKEN` | Token ausente ou diferente. | Conferir cabeçalho e variável indicada por `webhookTokenRef`. |
| `WEBHOOK_APP_MISMATCH` | appKey do evento não pertence à empresa. | Corrigir URL, empresa ou credencial do webhook. |
| `COMPANY_NOT_AVAILABLE` | Empresa não existe, está inativa ou arquivada. | Conferir `codigoInterno` e status. |
| `RATE_LIMIT` | Excesso de eventos no minuto. | Investigar repetição e ajustar limite com cautela. |
| `BILLING_PROFILE_NOT_FOUND` | Nenhum perfil ativo/vigente compatível. | Conferir empresa, código de cliente, etapa, vigência e status. |
| `MULTIPLE_BILLING_PROFILES` | Mais de um perfil compatível. | Encerrar sobreposição ou desativar perfil duplicado. |
| `DOCUMENT_MODEL_INACTIVE` | Modelo do perfil não está ativo. | Ativar o modelo ou trocar o perfil. |
| `PUBLISHED_TEMPLATE_NOT_FOUND` | Não há versão publicada no idioma. | Criar/homologar/publicar a versão correta. |
| `TEMPLATE_VARIABLE_NOT_ALLOWED` | Template usa variável não declarada. | Adicionar a raiz autorizada ou remover a variável. |
| `TEMPLATE_VARIABLE_MISSING` | Campo esperado não veio no contexto. | Conferir campo Omie e tornar o bloco condicional quando apropriado. |
| Cotação indisponível | PTAX não encontrada no período de fallback. | Conferir moeda, data e `BACEN_MAX_LOOKBACK_DAYS`. |
| Falha de PDF | HTML/CSS inválido, timeout ou navegador indisponível. | Simplificar modelo, conferir Puppeteer e aumentar timeout somente após diagnóstico. |
| E-mail não enviado | Chave, remetente, destinatário ou limite de anexo. | Conferir SendGrid, remetente verificado e tamanho total. |

---

## 30. Onde acompanhar cada problema

| Tela | Uso |
|---|---|
| Visão Geral | KPIs e resumo da esteira. |
| Eventos Omie | Recepção, deduplicação, tópico, etapa e motivo. |
| Faturas | Estado consolidado e ações operacionais. |
| Esteira de Faturas | Acompanhamento visual por etapa. |
| Execuções de Integração | Tentativas, sistema, erro, duração e próxima tentativa. |
| Cotações | Data solicitada/efetiva e valores do BACEN. |
| Documentos de Fatura | Documentos e anexos preservados. |
| Empresas Omie | Última comunicação e último erro. |

---

## 31. Comandos úteis

### Verificar dependências

```powershell
npm run check:dependencies --prefix backend
npm ls --prefix backend
npm ls --prefix frontend
```

### Validar código e configuração

```powershell
npm run check
npm test
npm run build --prefix frontend
```

### Reinstalação limpa do backend

```powershell
Remove-Item backend\node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item backend\package-lock.json -Force -ErrorAction SilentlyContinue
npm install --prefix backend
```

### Reinstalação limpa do frontend

```powershell
Remove-Item frontend\node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item frontend\package-lock.json -Force -ErrorAction SilentlyContinue
npm install --prefix frontend
```

Não execute `npm audit fix --force` sem revisão técnica, porque o comando pode instalar versões incompatíveis.

---

# Anexo A — Inventário de configuração

Preencha uma linha para cada Empresa Omie.

| Empresa | CNPJ | Código interno | Secret ref Omie | Webhook token ref | E-mail secret ref | Entrada | Sucesso | Erro | Categoria adiantamento | Conta adiantamento | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | |

---

# Anexo B — Inventário de perfis

| Empresa | Cliente | Código cliente Omie | Etapa | Modelo | Versão/idioma | Moeda | PTAX | Ajuste | Anexos | Adiantamento | Vigência | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | |

---

# Anexo C — Evidências de homologação

Para cada caso testado, preserve:

- número e código interno da OS;
- ID do evento;
- ID da fatura;
- empresa e perfil resolvidos;
- versão e hash do modelo;
- data e valor da cotação;
- hash do PDF;
- ID do anexo no Omie;
- ID da mensagem do provedor de e-mail;
- confirmação do adiantamento;
- etapa final da OS;
- resultado e observações do homologador.

---

## 32. Critério de conclusão da configuração

A configuração é considerada concluída quando, para cada empresa ativada:

1. o webhook está autenticado;
2. a credencial Omie foi validada;
3. existe exatamente um perfil para cada cliente/etapa atendido;
4. o modelo correto está publicado no idioma necessário;
5. BRL, USD e EUR foram homologados quando aplicáveis;
6. o PDF foi gerado e anexado;
7. o e-mail foi recebido pelos destinatários corretos;
8. o adiantamento foi criado quando previsto;
9. a etapa da OS foi atualizada corretamente;
10. retries e ações manuais foram testados sem duplicação de efeitos.
