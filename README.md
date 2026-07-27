# Central Faturas Europartner

Central Oon exclusiva para a Europartner, construída sobre o `oonCore` a partir do artefato `fatura-europartner.central.blueprint.json`.

## Manual de configuração

O roteiro completo de ambiente, empresas Omie, segredos, modelos, perfis, webhooks, homologação e entrada em produção está em:

- [Manual de Configuração da Central Faturas Europartner](docs/MANUAL_CONFIGURACAO.md)

## Fluxo operacional

1. O Omie envia `OrdemServico.EtapaAlterada` para o webhook da empresa.
2. O evento é autenticado, sanitizado, persistido e deduplicado.
3. Um worker durável consulta a OS, o cliente e o país no Omie.
4. A Central resolve o perfil de faturamento e congela a versão publicada do modelo.
5. BRL usa cotação 1; USD/EUR usam Fechamento PTAX do BACEN com fallback para o último dia publicado.
6. O PDF é gerado, anexado à OS, enviado por e-mail, aplicado o adiantamento e atualizada a etapa da OS.
7. Cada efeito possui execução própria, chave de idempotência, retry e auditoria operacional.

## Estrutura

- `backend/`: domínio, validações, rotas, worker e conectores.
- `frontend/`: manifesto declarativo do OonCore Front.
- `fatura-europartner.central.blueprint.json`: fonte de verdade funcional e arquitetural.

## Desenvolvimento

```bash
npm install
npm run ooncore:docs

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

npm run dev:backend
npm run dev:frontend
```

## Validação

```bash
npm test
npm run check
```

## Segredos

Credenciais não são persistidas nas coleções. `EmpresaOmie.secretRef`, `webhookTokenRef` e `emailProviderSecretRef` guardam apenas o nome de uma variável de ambiente.

Exemplo:

```env
OMIE_EUROPARTNER_BRASIL={"appKey":"...","appSecret":"..."}
WEBHOOK_EUROPARTNER_BRASIL=token-forte
SENDGRID_API_KEY=SG.xxx
```

## Estado do MVP

A base técnica e funcional está implementada. Antes da ativação produtiva ainda é necessário cadastrar as sete empresas, perfis, etapas Omie, modelos homologados, remetentes e referências de segredos descritos nas questões abertas do blueprint.

## Ativação inicial

Após instalar as dependências e configurar o MongoDB, execute:

```bash
npm run activate --prefix backend
```

A ativação cria apenas o modelo seguro `invoice-padrao` em rascunho. Empresas, credenciais, etapas e perfis não recebem valores fictícios e precisam ser configurados com os dados homologados da Europartner.

## Webhook Omie

Cada empresa usa um endpoint e token próprios:

```text
POST /api/integrations/omie/webhooks/ordem-servico/{codigoInterno}
X-Webhook-Token: <token configurado em webhookTokenRef>
```

O endpoint responde `202` depois de persistir e deduplicar o evento. O processamento externo é executado pelo worker configurado por `PROCESSOR_*`.

## Modelos seguros

O motor `template-seguro` aceita variáveis declaradas e os blocos controlados:

```html
{{cliente.razao_social}}
{{#if cliente.pais}}{{cliente.pais}}{{/if}}
{{#each servicos}}{{this.cDescricao}}{{/each}}
```

Não há execução de JavaScript ou EJS. A publicação ocorre pela ação **Publicar**, registra hash, usuário e data, substitui a versão anterior do mesmo idioma e torna o conteúdo imutável.
