# Central Faturas Europartner

Central Oon exclusiva para a Europartner, construída sobre o `oonCore` a partir do artefato `fatura-europartner.central.blueprint.json`.

## Manual do usuário

O manual parte da Central já publicada e ativada e orienta o consultor ou usuário administrador na configuração pela interface:

- [Manual do Usuário — Configuração e Operação](docs/MANUAL_CONFIGURACAO.md)

Credenciais Omie, tokens de webhook, chave única do SendGrid, URLs de integração, timeouts, limites e parâmetros de processamento são cadastrados no menu **Configurações**. Não é necessário editar arquivos, variáveis de ambiente ou código para configurar a operação.

## Fluxo operacional

1. O Omie envia `OrdemServico.EtapaAlterada` para o webhook da empresa.
2. O evento é autenticado, sanitizado, persistido e deduplicado.
3. Um worker durável consulta a OS, o cliente e o país no Omie.
4. A Central resolve o perfil de faturamento e congela a versão publicada do modelo.
5. BRL usa cotação 1; USD/EUR usam Fechamento PTAX do BACEN com fallback para o último dia publicado.
6. O PDF é gerado, anexado à OS, enviado por e-mail, aplicado o adiantamento e atualizada a etapa da OS.
7. Cada efeito possui execução própria, chave de idempotência, retry e auditoria operacional.

## Configuração pós-publicação

A configuração funcional é realizada nesta ordem:

1. abrir **Configurações** e revisar URLs, SendGrid e parâmetros operacionais;
2. cadastrar as Empresas Omie;
3. cadastrar, pela página **Configurações**, App Key, App Secret e token de webhook de cada empresa;
4. testar a conexão;
5. criar e publicar os modelos de documento;
6. criar os perfis de faturamento;
7. configurar os webhooks no Omie;
8. homologar uma OS antes de ativar o processamento produtivo.

A Central utiliza apenas uma conta SendGrid. Os remetentes e cópias podem continuar sendo definidos por Empresa Omie e por perfil de faturamento.

## Segurança dos segredos

Os campos secretos são enviados por uma rota administrativa, armazenados de forma criptografada e nunca retornam em texto aberto. Depois de salvos, a interface apresenta somente o estado de configuração e valores mascarados. Um token de webhook gerado pela Central é exibido apenas no momento da geração para que seja copiado para o Omie.

## Estrutura técnica

- `backend/`: domínio, validações, rotas, worker e conectores;
- `frontend/`: manifesto declarativo e página de configurações;
- `fatura-europartner.central.blueprint.json`: fonte de verdade funcional e arquitetural.

## Desenvolvimento local

```bash
npm install
npm run ooncore:docs
npm run dev:backend
npm run dev:frontend
```

## Validação

```bash
npm test
npm run check
```
