# Manual do Usuário — Central Faturas Europartner

**Versão:** 2.0  
**Público:** consultores, administradores e usuários responsáveis pela implantação e operação.  
**Ponto de partida:** Central publicada, ativada e acessível pelo navegador.

> Toda a configuração da operação é realizada pela interface. O usuário não precisa acessar servidor, código, arquivo `.env`, banco de dados ou ambiente de desenvolvimento.

---

## 1. Objetivo da Central

A Central Faturas Europartner automatiza o processamento de faturas a partir da mudança de etapa de uma Ordem de Serviço no Omie.

O fluxo executado é:

1. o Omie envia o evento de alteração da etapa da OS;
2. a Central identifica a Empresa Omie e valida o token do webhook;
3. consulta a OS, o cliente e o país;
4. encontra o perfil de faturamento vigente para a empresa, cliente e etapa;
5. seleciona o modelo publicado e a moeda do perfil;
6. consulta a PTAX quando a moeda for USD ou EUR;
7. gera o PDF da fatura;
8. anexa o PDF na OS do Omie;
9. envia o e-mail pelo SendGrid;
10. gera o adiantamento, quando habilitado;
11. altera a OS para a etapa de sucesso.

Cada etapa é registrada separadamente. Em caso de falha, a Central permite retomar somente o efeito necessário, evitando duplicar anexos, e-mails ou adiantamentos.

---

## 2. Perfis de acesso

### Administrador

Pode:

- acessar a página **Configurações**;
- cadastrar Empresas Omie;
- informar credenciais e tokens;
- configurar URLs e parâmetros operacionais;
- criar, publicar e substituir modelos;
- cadastrar perfis de faturamento;
- testar conexões e reprocessar operações.

### Gestor de faturamento

Pode operar faturas, perfis e modelos conforme as permissões concedidas, mas não altera os segredos gerais da Central.

### Operação de faturamento

Pode acompanhar e reprocessar faturas e eventos permitidos, sem acesso às credenciais.

---

## 3. Ordem recomendada da configuração

Faça a implantação nesta sequência:

1. revisar as configurações gerais;
2. cadastrar a chave única do SendGrid;
3. cadastrar as Empresas Omie;
4. cadastrar as credenciais Omie e os tokens de webhook;
5. testar a conexão de cada empresa;
6. criar ou revisar os modelos de documento;
7. publicar uma versão por idioma utilizado;
8. cadastrar os perfis de faturamento;
9. copiar a URL e o token do webhook para o Omie;
10. homologar uma OS completa;
11. habilitar o processamento automático;
12. repetir a homologação para as demais empresas, clientes e moedas.

Durante a implantação inicial, mantenha as empresas com status **Homologação** e o processamento automático desabilitado até concluir os cadastros mínimos.

---

# Parte I — Configurações gerais

## 4. Acessar a página Configurações

No menu lateral, abra:

**Configurações > Configurações**

A página é dividida em:

- URLs e integrações;
- SendGrid;
- processamento e limites;
- credenciais das Empresas Omie.

Somente usuários administradores podem alterar essa página.

---

## 5. URLs e integrações

### URL pública do backend

Informe o endereço público do backend da Central publicado pela OonDemand.

Exemplo:

```text
https://faturas-europartner.central.oondemand.online
```

Essa URL é utilizada para montar automaticamente o endereço do webhook de cada Empresa Omie.

Não inclua o caminho do webhook e não finalize com parâmetros adicionais.

### URL da API Omie

Valor padrão:

```text
https://app.omie.com.br/api/v1/
```

Altere somente quando a OonDemand ou o Omie orientar o uso de outro endpoint.

### Timeout Omie

Tempo máximo de espera por uma resposta da API do Omie.

Valor inicial recomendado:

```text
20000 ms
```

### URL PTAX BACEN

Valor padrão:

```text
https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata
```

É utilizada para consultar o Fechamento PTAX das moedas USD e EUR.

### Timeout BACEN

Valor inicial recomendado:

```text
15000 ms
```

### Busca retroativa PTAX

Quantidade máxima de dias anteriores que a Central pesquisará quando não houver Fechamento PTAX na data solicitada, como finais de semana e feriados.

Valor inicial recomendado:

```text
30 dias
```

Depois de revisar os campos, clique em **Salvar configurações gerais**.

---

## 6. Configurar o SendGrid

A Central utiliza **uma única conta SendGrid** para todas as Empresas Omie.

No bloco **SendGrid**:

1. informe a API Key;
2. confirme que a chave começa com `SG.`;
3. clique em **Salvar configurações gerais**;
4. verifique se o indicador passou para **SendGrid: configurado**.

Depois de salva:

- a chave não é exibida novamente;
- a interface mostra apenas uma versão mascarada;
- deixar o campo em branco mantém a chave atual;
- informar uma nova chave substitui a anterior.

Os remetentes não precisam ser iguais para todas as empresas. O endereço e o nome do remetente são cadastrados em cada **Empresa Omie**, mas todos os envios usam a mesma conta SendGrid.

Antes da homologação, confirme no SendGrid que os remetentes utilizados estão autorizados.

---

## 7. Processamento e limites

### Processamento automático habilitado

Quando marcado, o worker pesquisa eventos e faturas pendentes automaticamente.

Recomendação:

- **desmarcado** durante a configuração inicial;
- **marcado** depois da homologação do fluxo completo.

### Intervalo do worker

Tempo entre as verificações automáticas.

Valor inicial recomendado:

```text
5000 ms
```

### Tamanho do lote

Quantidade máxima de eventos e faturas processados em cada ciclo.

Valor inicial recomendado:

```text
10
```

### Tempo de lock

Prazo durante o qual um processamento fica reservado para uma instância da Central, evitando execução concorrente.

Valor inicial recomendado:

```text
300000 ms
```

### Máximo de tentativas

Quantidade máxima de tentativas automáticas para falhas transitórias.

Valor inicial recomendado:

```text
5
```

### Base de retry

Intervalo inicial usado no cálculo das novas tentativas. O tempo aumenta progressivamente em falhas consecutivas.

Valor inicial recomendado:

```text
30000 ms
```

### Webhooks por minuto

Limite de eventos aceitos por Empresa Omie em um minuto.

Valor inicial recomendado:

```text
120
```

### Timeout do PDF

Tempo máximo para renderizar o documento.

Valor inicial recomendado:

```text
30000 ms
```

### Limite de anexos

Tamanho total máximo dos anexos adicionais enviados por e-mail.

Valor inicial recomendado:

```text
20000000 bytes
```

Depois de alterar qualquer parâmetro, clique em **Salvar configurações gerais**.

---

# Parte II — Empresas Omie

## 8. Cadastrar uma Empresa Omie

Abra:

**Configurações > Empresas Omie**

Cadastre uma empresa para cada base do Omie utilizada pela Europartner.

### Campos principais

| Campo | Orientação |
|---|---|
| Nome | Nome curto exibido na Central |
| Razão Social | Razão social da empresa |
| CNPJ | CNPJ válido e exclusivo |
| Código Interno | Identificador em letras minúsculas e hífens, por exemplo `europartner-brasil` |
| Etapa de Entrada | Etapa padrão do Omie que inicia o faturamento |
| Etapa de Sucesso | Etapa aplicada após a conclusão |
| Etapa de Erro | Etapa prevista para tratamento de falhas, quando utilizada |
| Categoria de Adiantamento | Código da categoria usada no Omie |
| Conta Corrente de Adiantamento | Código da conta corrente usada no Omie |
| E-mail Remetente | Remetente autorizado no SendGrid |
| Nome do Remetente | Nome apresentado ao destinatário |
| Cópias Padrão | E-mails copiados em todos os envios dessa empresa |
| Status | Use Homologação durante os testes e Ativa após a aprovação |

O campo **Código Interno** fará parte da URL do webhook. Evite acentos, espaços, barras e caracteres especiais.

Exemplos válidos:

```text
europartner-brasil
europartner-argentina
europartner-mexico
```

---

## 9. Informar as credenciais Omie

Depois de salvar a Empresa Omie, volte para:

**Configurações > Configurações**

No bloco **Credenciais das Empresas Omie**, localize a empresa e informe:

- App Key;
- App Secret;
- token do webhook.

### Gerar o token do webhook

Para gerar um token seguro:

1. clique em **Gerar novo token**;
2. copie o token exibido;
3. guarde-o temporariamente para configurar o webhook no Omie;
4. informe App Key e App Secret;
5. clique em **Salvar credenciais**.

O token gerado é exibido apenas durante a sessão atual. Depois de sair ou atualizar a página, a Central mostrará somente que o token está configurado.

Gerar um novo token invalida o token anterior. Depois da troca, atualize imediatamente o webhook no Omie.

### Atualizar uma credencial

- deixe o campo em branco para manter o valor atual;
- informe um novo valor para substituir somente aquela credencial;
- clique em **Salvar credenciais**.

A API nunca devolve App Secret, token ou chave SendGrid em texto aberto.

---

## 10. Testar a conexão Omie

No mesmo cartão da empresa:

1. opcionalmente informe o código de uma OS existente;
2. clique em **Testar conexão**;
3. aguarde a mensagem de sucesso.

Sem código de OS, o teste valida se as credenciais estão cadastradas. Com uma OS, também valida uma consulta real na base do Omie.

O cartão apresenta:

- última comunicação bem-sucedida;
- App Key mascarada;
- último erro de comunicação, quando houver.

Não avance para o webhook enquanto a conexão não estiver validada.

---

## 11. Configurar o webhook no Omie

A página **Configurações** monta a URL específica de cada empresa.

Exemplo:

```text
https://faturas-europartner.central.oondemand.online/api/integrations/omie/webhooks/ordem-servico/europartner-brasil
```

Copie a URL pelo botão **Copiar URL**.

No Omie, configure o evento:

```text
OrdemServico.EtapaAlterada
```

Informe também o token gerado pela Central conforme o mecanismo disponível no cadastro do webhook:

```text
X-Webhook-Token: TOKEN_GERADO
```

ou, quando a ferramenta utilizar autorização Bearer:

```text
Authorization: Bearer TOKEN_GERADO
```

A Central aceita os dois formatos.

### Teste de disponibilidade

Depois de configurar o webhook, envie um teste ou ping pelo Omie. O endpoint deve responder com sucesso.

Em seguida, consulte:

**Operação > Eventos Omie**

Um evento real deve aparecer como:

- **aceito**, quando está aguardando processamento;
- **processado**, quando originou ou atualizou uma fatura;
- **ignorado**, quando o tópico ou a etapa não pertencem ao fluxo;
- **duplicado**, quando o mesmo evento já havia sido recebido.

---

# Parte III — Modelos de documento

## 12. Criar um modelo

Abra:

**Documentos > Modelos**

A ativação pode criar o modelo inicial `invoice-padrao`. Ele serve como ponto de partida e deve ser revisado antes da publicação.

Campos principais:

- Código;
- Nome;
- Descrição;
- Idiomas suportados;
- Status.

Um modelo precisa estar **Ativo** para ser utilizado.

---

## 13. Criar uma versão do modelo

Abra:

**Documentos > Versões de Modelos**

Cadastre:

- modelo relacionado;
- versão, por exemplo `1.0.0`;
- idioma;
- motor `template-seguro`;
- HTML do documento;
- CSS;
- assunto do e-mail;
- corpo do e-mail;
- variáveis permitidas.

Idiomas disponíveis:

- `pt-BR`;
- `en-US`;
- `es-ES`.

### Variáveis principais

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

Exemplos:

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

Lista de serviços:

```html
{{#each servicos}}
  <p>{{this.cDescricao}} — {{this.nQtde}} — {{this.nValUnit}}</p>
{{/each}}
```

O motor não executa JavaScript ou EJS.

---

## 14. Publicar uma versão

Depois de revisar e homologar o conteúdo:

1. localize a versão;
2. clique em **Publicar**;
3. confirme a operação.

Ao publicar:

- a versão recebe hash, data e usuário;
- fica imutável;
- passa a ser usada em novos processamentos daquele modelo e idioma;
- a versão publicada anteriormente para o mesmo idioma é substituída.

Para alterar um documento publicado, crie uma nova versão. Não tente editar a versão já publicada.

Deve existir pelo menos uma versão publicada para cada idioma utilizado nos perfis.

---

# Parte IV — Perfis de faturamento

## 15. Criar um perfil

Abra:

**Configurações > Perfis de Faturamento**

O perfil liga:

- Empresa Omie;
- cliente do Omie;
- etapa de entrada;
- modelo e idioma;
- moeda e regra de cotação;
- e-mail e anexos;
- geração de adiantamento.

### Identificação

| Campo | Orientação |
|---|---|
| Nome | Nome claro do perfil |
| Empresa Omie | Base responsável pela OS |
| Código do Cliente Omie | Código exato do cliente na base |
| Cliente | Nome para identificação visual |
| Modelo de Documento | Modelo ativo e homologado |
| Idioma | Deve possuir versão publicada |
| Status | Use Rascunho durante a configuração e Ativo após homologar |

### Regra de vigência

Informe:

- Vigente Desde;
- Vigente Até, quando houver.

Para uma mesma empresa, cliente, etapa e data, deve existir **exatamente um perfil ativo compatível**.

Perfis sobrepostos podem gerar o erro:

```text
MULTIPLE_BILLING_PROFILES
```

A ausência de perfil gera:

```text
BILLING_PROFILE_NOT_FOUND
```

---

## 16. Configurar moeda e cotação

### BRL

A Central utiliza fator fixo:

```text
1
```

### USD e EUR

A Central consulta o Fechamento PTAX no BACEN.

Escolha a data de referência:

- Data da OS;
- Previsão da OS;
- Data do processamento.

Escolha o campo PTAX:

- Compra;
- Venda.

### Ajuste de cotação

Opções:

- Nenhum;
- Percentual;
- Valor fixo.

Exemplo percentual:

```text
Cotação oficial: 5,00000000
Ajuste: 2%
Cotação efetiva: 5,10000000
```

Exemplo de valor fixo:

```text
Cotação oficial: 5,00000000
Ajuste: 0,15000000
Cotação efetiva: 5,15000000
```

O ajuste percentual deve permanecer entre -100% e 100%.

---

## 17. Destinatários e cópias

A Central combina:

- e-mail do cliente no Omie;
- e-mail informado na OS;
- destinatários adicionais do perfil;
- cópias padrão da Empresa Omie;
- cópias do perfil.

Separe múltiplos e-mails por vírgula, ponto e vírgula ou nova linha.

A fatura não é enviada quando nenhum destinatário válido é encontrado.

---

## 18. Política de anexos

Opções:

### Somente fatura

Envia apenas o PDF gerado pela Central.

### Fatura e permitidos

Além do PDF, pesquisa anexos da OS e aplica:

- extensões permitidas;
- padrões de nome incluídos;
- padrões de nome excluídos;
- limite total definido nas configurações gerais.

Extensões iniciais sugeridas:

```text
pdf,xml,xlsx,docx,jpg,png
```

### Seleção manual

Ainda não deve ser ativada para processamento automático.

---

## 19. Adiantamento

Marque **Gerar Adiantamento** quando o perfil exigir esse efeito.

Antes de ativar, confirme na Empresa Omie:

- categoria de adiantamento;
- conta corrente de adiantamento.

A Central consulta novamente a OS antes de gerar o adiantamento e utiliza controle de idempotência para evitar duplicações durante retries.

---

# Parte V — Homologação

## 20. Checklist antes do primeiro teste

Confirme:

- [ ] URLs gerais revisadas;
- [ ] chave única do SendGrid configurada;
- [ ] remetente autorizado no SendGrid;
- [ ] Empresa Omie em Homologação;
- [ ] App Key e App Secret configurados;
- [ ] token de webhook configurado;
- [ ] teste de conexão concluído;
- [ ] etapas de entrada, sucesso e erro confirmadas;
- [ ] modelo ativo;
- [ ] versão publicada no idioma do perfil;
- [ ] perfil ativo e vigente para o cliente;
- [ ] moeda e cotação revisadas;
- [ ] destinatários revisados;
- [ ] categoria e conta do adiantamento revisadas;
- [ ] processamento automático inicialmente desabilitado.

---

## 21. Executar a homologação ponta a ponta

Use uma OS exclusiva de teste.

1. confirme o cliente e os e-mails no Omie;
2. confirme a etapa atual da OS;
3. mova a OS para a etapa de entrada configurada;
4. abra **Operação > Eventos Omie**;
5. confirme o recebimento do evento;
6. abra **Operação > Faturas** ou **Operação > Esteira de Faturas**;
7. acompanhe as etapas;
8. valide o PDF gerado;
9. confirme o anexo na OS;
10. confirme o recebimento do e-mail;
11. confirme o adiantamento, quando habilitado;
12. confirme a mudança da OS para a etapa de sucesso;
13. revise as Execuções de Integração.

### Evidências mínimas

Guarde:

- número e código da OS;
- empresa e cliente;
- modelo, versão e idioma;
- moeda, data e cotação;
- hash e nome do PDF;
- ID do anexo no Omie;
- destinatários e cópias;
- ID da mensagem do SendGrid;
- situação do adiantamento;
- etapa final da OS;
- data e responsável pela homologação.

---

## 22. Entrada em produção

Após aprovar a homologação:

1. altere a Empresa Omie de **Homologação** para **Ativa**;
2. confirme os perfis ativos;
3. abra **Configurações**;
4. habilite **Processamento automático**;
5. clique em **Salvar configurações gerais**;
6. acompanhe os primeiros eventos e faturas.

Faça o rollout uma empresa por vez. Não ative as sete bases simultaneamente sem validar o comportamento da primeira.

---

# Parte VI — Operação diária

## 23. Visão Geral

A página inicial apresenta:

- indicadores da operação;
- faturas por etapa;
- falhas e retries;
- acesso aos detalhes.

Use os filtros por:

- empresa;
- status;
- moeda;
- cliente.

---

## 24. Detalhes da fatura

No detalhe da fatura estão disponíveis as abas:

- Resumo;
- OS / Cliente;
- Documento;
- Cotação;
- E-mail;
- Adiantamento;
- Integrações;
- Operação.

Antes de reprocessar, identifique exatamente qual etapa falhou.

---

## 25. Ações de reprocessamento

### Reprocessar preparação

Use somente quando a preparação falhou antes de ocorrer qualquer efeito externo.

Não utilize depois de existir PDF, anexo, e-mail ou adiantamento confirmado.

### Reprocessar

Retoma o fluxo preservando etapas já concluídas.

### Reanexar no Omie

Reenvia o PDF já preservado para a OS.

### Reenviar e-mail

Envia novamente o e-mail sem gerar novo PDF, novo anexo ou novo adiantamento.

### Reprocessar adiantamento

Consulta o estado atual da OS e tenta novamente somente o adiantamento.

### Reprocessar evento

Disponível em **Operação > Eventos Omie** para eventos com falha corrigível.

Eventos ignorados ou duplicados não devem ser reprocessados.

---

## 26. Erros comuns

| Código ou mensagem | Ação recomendada |
|---|---|
| `SENDGRID_NOT_CONFIGURED` | Abrir Configurações e cadastrar a API Key única do SendGrid |
| `OMIE_CREDENTIALS_NOT_CONFIGURED` | Informar App Key e App Secret da Empresa Omie |
| `WEBHOOK_TOKEN_NOT_CONFIGURED` | Gerar ou informar o token do webhook |
| `INVALID_WEBHOOK_TOKEN` | Atualizar o token no Omie ou gerar um novo token |
| `WEBHOOK_APP_MISMATCH` | Confirmar se o webhook aponta para a empresa correta |
| `BILLING_PROFILE_NOT_FOUND` | Criar ou ativar o perfil para empresa, cliente e etapa |
| `MULTIPLE_BILLING_PROFILES` | Encerrar a sobreposição de perfis vigentes |
| `PUBLISHED_TEMPLATE_NOT_FOUND` | Publicar uma versão no idioma do perfil |
| `DOCUMENT_MODEL_INACTIVE` | Ativar o modelo do perfil |
| `PTAX_NOT_FOUND` | Revisar URL do BACEN, data e busca retroativa |
| `EMAIL_RECIPIENT_REQUIRED` | Corrigir os e-mails do cliente, OS ou perfil |
| `PREPARATION_ALREADY_EFFECTIVE` | Usar reprocessamento seletivo em vez de refazer a preparação |
| `RATE_LIMIT` | Revisar volume de eventos ou limite de webhooks por minuto |

---

## 27. Troca de credenciais

### App Key ou App Secret

1. abra **Configurações**;
2. localize a Empresa Omie;
3. informe apenas os novos valores;
4. salve;
5. teste a conexão.

### Token do webhook

1. gere um novo token;
2. copie-o imediatamente;
3. atualize o webhook no Omie;
4. salve as credenciais;
5. faça um teste de evento.

### Chave SendGrid

1. informe a nova API Key no bloco SendGrid;
2. salve as configurações gerais;
3. execute uma homologação de envio.

---

## 28. Checklist periódico

Semanalmente:

- [ ] revisar faturas em falha;
- [ ] revisar eventos ignorados;
- [ ] revisar retries pendentes;
- [ ] verificar erros de conexão Omie;
- [ ] confirmar envio pelo SendGrid.

Mensalmente:

- [ ] revisar perfis vigentes;
- [ ] revisar clientes e etapas;
- [ ] revisar remetentes autorizados;
- [ ] revisar modelos publicados;
- [ ] revisar limites e volume da operação.

Quando houver mudança no processo:

- [ ] criar nova versão do modelo;
- [ ] homologar antes de publicar;
- [ ] evitar editar regras vigentes sem data de corte;
- [ ] registrar a decisão e o responsável.

---

## 29. Regra de segurança operacional

Nunca envie App Secret, token de webhook ou chave SendGrid por e-mail, planilha, chamado público ou mensagem sem proteção.

Cadastre os valores diretamente na página **Configurações**. Depois de salvos, os segredos não são exibidos novamente pela Central.
