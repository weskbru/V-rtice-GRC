# Estado do trabalho — retomada a partir do repositório

> **Documento histórico — registro de fechamento da fase 008 (Incidentes e Problemas).** Não
> descreve necessariamente o estado atual do produto. Fonte vigente:
> [`docs/STATE.md`](../../docs/STATE.md) e
> [`docs/modules/incidents-problems.md`](../../docs/modules/incidents-problems.md).

Este arquivo existe para que outro contexto possa continuar **sem depender de nenhuma conversa
anterior**. Ele registra o que está feito, o que falta, as decisões que não podem ser reabertas e o
próximo passo exato.

**Última atualização**: 2026-09-11, reconciliando contra o commit `795343b`, numa sessão nova aberta
depois que a árvore de trabalho local anterior foi perdida e o repositório foi recuperado do GitHub.
**Método desta segunda reconciliação**: leitura direta de código e `grep` pelo coordenador (Claude
Opus), arquivo por arquivo, sem execução de suíte alguma — nenhum teste foi rodado nesta sessão, e
nada abaixo que dependa de teste está marcado como verificado por execução. Cinco commits posteriores
a `501c7ad` fecharam quase tudo que a reconciliação original (abaixo) registrou como pendente; o
texto original de §1-§10 foi preservado e cada item recebeu uma marca de estado atual, seguindo o
mesmo padrão que este documento já usa em §5/§6 para corrigir afirmação anterior sem apagá-la.

**Registro original, preservado — como este documento foi produzido na primeira reconciliação**: a
reconciliação de `501c7ad` (1 de 79 tarefas marcadas em `tasks.md` contra o código real) verificou
cada afirmação por leitura direta do código, por `grep` exaustivo, ou por log de CI real
(`gh run view --log`), nunca por confiança no texto de `tasks.md` ou nas mensagens de commit
isoladamente. Onde uma mensagem de commit afirmava algo que o código não sustentava, o código venceu
— ver §3. Este arquivo não existia antes daquela reconciliação — foi o primeiro `STATE.md` desta
fase.

---

## 1. Onde o produto está

**Tabela atualizada em 2026-09-11 contra `795343b`** — a coluna Estado reflete hoje, não o momento da
reconciliação original. Onde o estado mudou, a linha diz por qual commit.

| Item | Estado | Evidência |
|---|---|---|
| Schema, migrações, permissões, portes de diretório | entregue | `apps/api/prisma/schema.prisma` L2947-3202; migrações `20260911020000_incidents_problems_foundation_baseline`, `20260911030000_action_origin_type_add_incidents_problems` |
| Ciclo de vida de Incidente (5 estados) e Problema (5 estados, com P1/P2/P3) | entregue | `domain/incident.entity.ts`, `domain/problem.entity.ts`, `domain/problem-lifecycle.ts`; `test/contract/{incidents,problems}.spec.ts` (662+560 linhas) |
| CRUD + transição, os dois módulos, registrados em `AppModule` | entregue | `app.module.ts` L133-134 |
| Incidente pode ser dono de uma `Action` compartilhada; Problema idem (FR-010 alcançável) | entregue | `test/contract/actions.spec.ts` L951-1011; `test/integration/incident-problem-action-origin.spec.ts` |
| Quatro vínculos (Incidente→Risco/Ativo/Processo, Problema→Risco) + o N:M Problema↔Incidente | **entregue dos dois lados agora** — ver §2.4 | `test/integration/incident-problem-relationship-links.spec.ts`; leitura reversa por `2a39b52` |
| Vínculo visível também a partir de Risco/Ativo/Processo | **FECHADO por `2a39b52`** | ver §2.4 |
| Painel de Evidência/Comentário/Anexo nas telas de Incidente/Problema | **FECHADO por `4b18978`** | ver §2.2/§2.3 |
| Papéis "Incident Manager"/"Problem Manager" | entregue | commit `18e9351` |
| Telas: registro, formulário, detalhe, ações de ciclo de vida, corretiva | entregue | `apps/web/src/features/{incidents,problems}/`, `apps/web/src/app/(app)/{incidents,problems}/` |
| Correção "corrective actions" (a affordance que faltava para FR-010 na interface) | entregue | commit `501c7ad` |
| Navegação `implemented`, dashboard sem placeholder obsoleto | entregue | commit `cffb553`, `navigation-registry.ts` L116-132 |
| E2E das duas jornadas completas + 17 varreduras axe | entregue, com ressalva de P3 (§4) | `e2e/{incidents,problems}.spec.ts`; commit `c284ea8` |
| E2E de escopo organizacional para os cinco vínculos | **PARCIAL — ver nota abaixo e §2.5** | integração fechada por `7674efb`; navegador ainda aberto |
| `incidents.openapi.yaml`/`problems.openapi.yaml` no portão `contract-coverage.spec.ts` | **FECHADO por `2a39b52`** | ver §2.1 |
| Acessor Attachable/Commentable para `INCIDENT`/`PROBLEM` | **FECHADO por `4b18978`** | ver §2.2 |

**Nota sobre a linha de escopo organizacional**: o commit `7674efb` acrescentou
`apps/api/test/integration/incident-problem-links-source-scope.spec.ts` (629 linhas), que prova o
escopo do LADO DE ORIGEM dos cinco pares de vínculo — mas é teste de integração de API, não de
navegador. `apps/web/e2e/` continua sem `incidents-scope.spec.ts`/`problems-scope.spec.ts`
equivalente a `assets-processes-scope.spec.ts`/`audit-engagement-scope.spec.ts`. A lacuna que F-55
nomeia está fechada na API e continua ABERTA no nível de navegador. Ver §2.5 e a nova §11.

Contagens de CI acima são **históricas**, do run `34608398835` (commit `501c7ad`, `push`,
**sucesso**) —
`API unit 485 · contrato 712 · integração 207 · web unit 571 · E2E Chromium 100/100`.
`typecheck`, `lint`, `audit`, `openapi:check`, `format:check`, `api-types:check` e `build` limpos
nesse mesmo run. `test-e2e-firefox`/`test-e2e-webkit` reportam `skipped` naquele run porque foi
`push`, não `workflow_dispatch` — ver §5. **NÃO VERIFICADO NESTA SESSÃO**: nenhuma suíte foi
executada durante esta reconciliação de 2026-09-11 contra `795343b`; não há número de CI mais recente
para citar, e nada nesta atualização afirma teste executado agora.

**59 de 79 tarefas seguem marcadas `[x]` em `tasks.md`, 20 seguem `[ ]`, com a razão original
registrada em cada uma — a contagem de checkbox não mudou desde a reconciliação anterior, apesar de
o código ter avançado.** Verificado por `grep` nesta sessão: `tasks.md` continua com exatamente 59
`[x]`/20 `[ ]`, embora os itens correspondentes a §2.1, §2.2, §2.3 e §2.4 abaixo estejam hoje
FECHADOS no código. Ninguém marcou as caixas correspondentes quando os commits `2a39b52`/`4b18978`
fecharam essas lacunas — `tasks.md` desta fase está, ele mesmo, desatualizado em relação ao código,
do mesmo jeito que `specs/009-indicators-reports/spec.md` já registrou sobre esta mesma fase (achado
4 daquela especificação, anterior a esta reconciliação). Corrigir os checkboxes de `tasks.md` está
fora do escopo desta atualização de `STATE.md`. Isto não muda a leitura de fundo: várias das lacunas
originais eram de superfície inteira (painel de evidência/comentário/anexo, visibilidade a partir de
Risco/Ativo/Processo, E2E de escopo em navegador), não detalhes de acabamento — mas a maioria delas
já foi fechada; ver §2 para o estado item a item e §11 para o que ainda falta.

---

## 2. Defeitos e lacunas encontrados por esta reconciliação — não estavam em nenhum registro anterior

Nenhum destes cinco itens aparecia em nenhum commit, nenhum comentário de código lido como "pendência
conhecida", nem em nenhuma lista prévia. Todos verificados por leitura direta e `grep`, não por
inferência.

### 2.1 — O contrato desta fase nunca entrou no portão que existe exatamente para pegar isto

**FECHADO pelo commit `2a39b52`.** `CONTRACT_SOURCES` em
`apps/api/test/contract/contract-coverage.spec.ts` agora lista `incidents.openapi.yaml` e
`problems.openapi.yaml` (linhas 236-237), sob o rótulo de frente de trabalho
`013-incidents-problems-reverse-links` que o próprio cabeçalho do arquivo usa para nomear esta
mudança (ver a nova §11 sobre esse identificador — não é uma especificação). O comentário do arquivo
registra explicitamente que esta era a **terceira recorrência** de F-31 (linha 126: "F-31 recurring a
THIRD time"). O total de sanidade do portão subiu de 168 para 198. A descrição original abaixo
permanece como registro do defeito tal como encontrado.

`apps/api/test/contract/contract-coverage.spec.ts` (T093/F-31) é o gate que compara toda operação
declarada nos contratos `*.openapi.yaml` contra `apps/api/openapi.json` — o mesmo gate cujo próprio
cabeçalho narra que ele já foi adicionado tarde demais uma vez (`005-audit-findings`, onde duas
operações contratadas e nunca implementadas passaram uma fase inteira sem detecção, e a versão
anterior deste próprio `STATE.md` de `005` documenta esse episódio em detalhe, no §3 que a tarefa
mandou ler antes de começar). `CONTRACT_SOURCES` (linha 175-204) lista oito contratos, terminando em
`assets.openapi.yaml`/`processes.openapi.yaml` (006). **`incidents.openapi.yaml` e
`problems.openapi.yaml` não estão na lista.** Confirmado por `grep` direto no arquivo: nenhuma
ocorrência de `008-incidents-problems`, `incidents.openapi` nem `problems.openapi`.

Isto não significa necessariamente que exista hoje uma operação contratada e não implementada — a
cobertura de contrato desta fase (712 testes) e a varredura de disclosure (`a6365c2`, que valida as
26 operações contra o `openapi.json` real) sugerem fortemente que tudo que está no contrato está
implementado. O que falta é a **rede de segurança** contra uma FUTURA divergência — exatamente a
mesma omissão, na mesma forma, que já se provou capaz de esconder uma lacuna real por uma fase
inteira. T026 e T040 pediam explicitamente "acrescentar a `CONTRACT_SOURCES` **nesta mesma tarefa**";
nenhuma das duas fez isso.

**Correção recomendada quando escrita, aplicada desde então pelo commit `2a39b52`** (ver a marca de
FECHADO no início desta subseção): as duas entradas foram adicionadas a `CONTRACT_SOURCES`.

### 2.2 — Nenhum acessor de Comentário/Anexo foi registrado para Incidente/Problema, apesar do enum aceitar os dois valores

**FECHADO pelo commit `4b18978`.** `apps/api/src/modules/incidents/incidents.module.ts` (linhas
173-174) agora chama `registerAttachableEntityType('INCIDENT', ...)` e
`registerCommentableEntityType('INCIDENT', ...)`; `problems.module.ts` (linhas 147-148) faz o mesmo
para `'PROBLEM'`. Os dois acessores novos são `incident-parent-record-accessor.ts` e
`problem-parent-record-accessor.ts`. A descrição original abaixo, incluindo o risco de
`EntityTypeNotRegisteredError` em runtime, permanece como registro do defeito tal como encontrado —
ele não ocorre mais porque os acessores estão registrados.

`AttachableEntityType`/`CommentableEntityType` ganharam `INCIDENT`/`PROBLEM` na migração de fundação
(T003, confirmado no schema). Mas o mecanismo que torna esses valores utilizáveis —
`registerAttachableEntityType`/`registerCommentableEntityType`
(`core/comments/domain/entity-registry.ts`) — **nunca é chamado** para nenhum dos dois, em nenhum
lugar do código de produção. `grep` exaustivo confirma: só `RiskModule` (`'RISK'`) e `EvidenceModule`
(`'EVIDENCE'`) chamam essas duas funções.

A consequência é verificável no próprio código do registro (`entity-registry.ts` L146-191):
`getAttachableEntityAccessor`/`getCommentableEntityAccessor` lançam `EntityTypeNotRegisteredError` —
um `Error` comum, não um erro de domínio conhecido pelo filtro de exceções — quando um tipo de enum
válido não tem acessor registrado. Isto significa que uma tentativa real de comentar ou anexar um
arquivo bruto a um Incidente ou Problema, hoje, resultaria num erro não tratado (provavelmente 500),
não numa recusa de permissão nem num 404. Nenhum teste tenta isso — nem para provar que funciona, nem
para provar que falha — então este comportamento não está coberto por CI em nenhuma direção.

Doc comment de `entity-registry.ts` (linhas 34-67) usa `Problem`/Incidente" como o próprio EXEMPLO
hipotético de "o que um módulo futuro faz" — o exemplo nunca foi seguido pelo módulo real que o
tornou não-hipotético.

### 2.3 — Nenhuma tela de Incidente/Problema tem painel de Evidência, Comentário ou Anexo

**FECHADO pelo commit `4b18978`** (o mesmo commit de §2.2). `incident-detail-view.tsx` importa
`EvidencePanel`, `IncidentAttachmentsSection` e `IncidentCommentsSection`; `problem-detail-view.tsx`
tem os equivalentes. Existem testes de componente para as seções novas, e o mesmo commit acrescentou
`apps/api/test/integration/incident-problem-collaboration.spec.ts` e
`apps/web/e2e/incident-problem-collaboration.spec.ts`. A descrição original abaixo, incluindo o risco
combinado com §2.2 (comentário/anexo bruto quebrando em runtime), permanece como registro do defeito
tal como encontrado — o registro do acessor de §2.2 e o painel desta subseção foram fechados juntos,
então o risco combinado não existe mais.

`EvidencePanel` (o componente compartilhado que Risco, Controle, Achado e Engajamento de Auditoria já
usam) não é importado por nenhum arquivo de `apps/web/src/features/incidents/` nem
`apps/web/src/features/problems/`. `incident-detail-view.tsx` tem seis abas: overview, risks, assets,
processes, problems, corrective-actions. `problem-detail-view.tsx` tem quatro: overview, risks,
incidents, corrective-actions. Nenhuma se chama evidências, comentários ou anexos.

O acessor de Evidência (`IncidentEvidenceSubjectAccessor`/`ProblemEvidenceSubjectAccessor`) **está**
registrado (`registerEvidenceSubjectResolver`, confirmado nos dois `*.module.ts`) e o mecanismo em si
é consumido por casos de uso reais do módulo de Evidência (`link-evidence.usecase.ts`,
`list-evidence.usecase.ts`) — não é um acessor morto. Mas nenhum teste em todo o repositório cria
evidência com `subjectType: 'INCIDENT'`/`'PROBLEM'`, e não existe superfície nenhuma na interface para
um usuário fazer isso. Isto é exatamente o padrão que CLAUDE.md §19.10 nomeia — "mecanismo de
extensão que compila mas nunca foi chamado não é capacidade, é intenção" — desta vez pego antes de
alguém precisar dele em produção, não depois.

Combinado com §2.2: mesmo que alguém construísse o painel amanhã, comentário e anexo bruto
quebrariam em runtime até a lacuna do registro ser corrigida primeiro.

### 2.4 — O vínculo com Risco/Ativo/Processo só é visível a partir do lado de Incidente/Problema

**FECHADO pelo commit `2a39b52`.** Quatro endpoints GET somente-leitura novos, cada um atrás da
permissão de leitura que já existia (`risk:view`, `asset:view`, `process:view`), nenhuma permissão
inventada. Portas de fronteira em `apps/api/src/shared/grc-ports/`
(`incident-risk-link-read.port.ts`, `problem-risk-link-read.port.ts`,
`incident-asset-link-read.port.ts`, `incident-process-link-read.port.ts`), casos de uso em
`modules/risk/application/links/list-risk-incident-problem-links.usecase.ts`,
`modules/assets/application/list-asset-incident-links.usecase.ts` e
`modules/processes/application/list-process-incident-links.usecase.ts`. Este é o mesmo commit que
introduziu o rótulo de frente de trabalho `013-incidents-problems-reverse-links` citado nos
comentários de código — ver a nova §11 sobre por que esse identificador não corresponde a nenhum
diretório de especificação. A descrição original abaixo, incluindo a busca exaustiva que não
encontrava nada, permanece como registro do defeito tal como encontrado.

`tasks.md` original prometia (T051/T052/T053, e o checkpoint da Fase 5) que o detalhe de um Risco, de
um Ativo ou de um Processo passaria a listar os incidentes e problemas vinculados a ele — o mesmo
padrão de duas mãos que todo vínculo anterior deste projeto já estabeleceu (Risco↔Controle,
Achado↔Controle, etc.). **Isto não foi construído.**

Busca exaustiva: `grep -rln "Incident\|incident" apps/api/src/modules/{risk,assets,processes}` não
encontra nenhuma referência real — as duas únicas ocorrências em `modules/risk` são um comentário que
usa a palavra "coincidentally" e um comentário genérico citando "Problems, Incidents" como exemplo de
módulo futuro em `audit.controller.ts`. `risk-detail-view.tsx`, `asset-detail-view.tsx` e
`process-detail-view.tsx` não têm nenhuma aba, seção ou import relacionado a Incidente/Problema.

O que **existe** é a direção oposta: o detalhe do Incidente lista os riscos/ativos/processos
vinculados a ele (`incident-relationships-section.tsx`), e o detalhe do Problema lista os riscos e
incidentes vinculados a ele. A escrita do vínculo, a verificação de escopo do alvo e a auditoria — a
parte que `ADR-020` realmente exige — estão corretas e comprovadas (§2.1 da suíte de integração). O
que falta é só a leitura reversa, que a especificação original também pedia e que nenhum commit desta
fase entregou nem mencionou como adiada.

### 2.5 — Nenhum E2E de escopo organizacional para os cinco vínculos desta fase

**PARCIALMENTE FECHADO, e a distinção importa.** O commit `7674efb` acrescentou
`apps/api/test/integration/incident-problem-links-source-scope.spec.ts` (629 linhas), que prova o
escopo do LADO DE ORIGEM dos cinco pares — mas é teste de integração de API, não de navegador.
`apps/web/e2e/` continua sem qualquer spec de escopo de Incidente/Problema: existem
`assets-processes-scope.spec.ts` e `audit-engagement-scope.spec.ts`, não há equivalente de
Incidente/Problema (confirmado por listagem do diretório nesta reconciliação). A lacuna que F-55
nomeia continua ABERTA no nível de navegador. A descrição original abaixo, que registra a ausência
completa como estava em `501c7ad`, permanece — hoje é preciso ler "nenhum equivalente" como "nenhum
equivalente em navegador"; a cobertura de API existe desde `7674efb`.

`tasks.md` (T067) e o checkpoint da Fase 7 afirmam fechar "a mesma classe de lacuna que F-55 já
registrou" — a ausência de E2E de escopo organizacional para vínculos entre domínios, que
`006-assets-processes` corrigiu com `assets-processes-scope.spec.ts` e `005-audit-findings` com
`audit-engagement-scope.spec.ts`. Não existe equivalente para esta fase: nenhum arquivo
`incidents-scope.spec.ts`/`problems-scope.spec.ts`, e as únicas menções de `orgUnit`/escopo dentro de
`e2e/incidents.spec.ts`/`e2e/problems.spec.ts` são a seleção da unidade organizacional no formulário
de criação — nunca um ator restrito a uma unidade tentando ler ou escrever um vínculo fora dela pela
interface real. A classe de lacuna que F-55 nomeou continua aberta para esta fase especificamente.

---

## 3. Os seis defeitos que a implementação e a verificação desta fase encontraram e corrigiram

Todos confirmados por leitura do código-fonte no commit que os corrigiu — não apenas pela mensagem do
commit.

1. **`GET /incidents`/`GET /problems` devolviam as linhas sob `items`, o único par de endpoints
   paginados da plataforma a fazer isso** — os outros vinte e três usam `data`. A causa era o mapper
   de apresentação repassando o nome interno da porta do repositório direto para o limite HTTP, em
   vez de mapeá-lo como todo outro controller já faz. Corrigido no commit `13949a1`. **Não era um
   descuido não notado**: `features/incidents/types.ts` carregava um comentário que via a
   inconsistência e a defendia como deliberada ("kept exactly as written rather than silently
   normalized"), citando corretamente a regra de não normalizar contrato em silêncio — mas aplicando
   essa regra a um acidente, não a uma divergência real, porque nenhum documento de especificação
   jamais defendeu `items`. Confirmado hoje: `apps/api/src/modules/incidents/presentation/dto/
   incident-response.mapper.ts` e o equivalente de `problems` usam `data` (verificado por leitura
   direta, não apenas pela mensagem do commit).
2. **Só um administrador completo conseguia abrir Incidentes ou Problemas.** O papel de administrador
   é semeado a partir de todo o catálogo de permissões e ganha permissão nova automaticamente; todo
   papel específico precisa ser estendido à mão, e nenhum tinha sido. Corrigido pelo commit `18e9351`
   com os papéis "Incident Manager"/"Problem Manager", cada um também carregando as permissões de
   leitura pareada que ADR-020 parte 5 exige do lado referenciado (risco/ativo/processo para Incident
   Manager; risco/incidente para Problem Manager).
3. **O dashboard anunciava os dois módulos já entregues como ainda não construídos** — junto com
   `CONTROLS`, órfão desde `007-implementation-remediation`. Corrigido pelo commit `cffb553`;
   `registerDefaultPlannedAreas()` agora registra zero áreas, e `GET /dashboard` devolve
   `plannedAreas: []`.
4. **Violação de ordem de heading** em `problem-relationships-section.tsx` — um `<h4>` dentro de um
   painel de aba cuja página só renderiza um `<h1>` — herdada de `finding-links-section.tsx`, o
   arquivo que serviu de modelo e carregava o mesmo defeito primeiro. Corrigido pelo commit `9658789`
   nos dois arquivos, não só no novo.
5. **Duas strings em inglês da biblioteca de notificação alcançavam o usuário**: o `<Toaster>` do
   `sonner` usa `closeButtonAriaLabel: "Close toast"` e `containerAriaLabel: "Notifications"` como
   padrão, nunca sobrescritos. Corrigido no mesmo commit `9658789`, uma vez no `<Toaster>` de
   `FeedbackProvider`, cobrindo todo `feedback.*` do produto.
6. **Nenhum lugar no produto conseguia criar a ação corretiva que fechar um problema exige.** O
   acessor de origem de Ação, o valor `PROBLEM` em `ActionOriginType` e a checagem de permissão do
   servidor já existiam prontos (desde os commits `aa7dac2`/`f3c5b94`) — nada em produção jamais
   chamava `POST /actions` com eles. A regra de destaque da fase (FR-010/Invariante P2) era
   insatisfazível por um usuário real enquanto o backend que a implementa ficava completo e
   inalcançável. Corrigido pelo commit `501c7ad`: `IncidentCorrectiveActions`/
   `ProblemCorrectiveActions`, uma nova aba de detalhe nos dois módulos, reusando
   `features/actions/api.ts` diretamente — sem tabela de tarefa própria.

---

## 4. Limitação registrada, não escondida: a regra de segregação de Problema tem o caminho satisfeito
   testado e o de recusa testado só em parte

**Correção sobre a formulação original desta observação**: a alegação de que "o caminho de recusa
está sem teste" precisa de nuance — ela é verdadeira num nível e falsa no outro.

- **No teste de contrato** (`apps/api/test/contract/problems.spec.ts`, linha 497, "the user who
  completed the corrective Action may not close the problem — 403 (Invariant P3, segregation of
  duties)"): a recusa **está** testada, diretamente contra a rota HTTP real.
- **No E2E** (`apps/web/e2e/problems.spec.ts`): a jornada satisfaz P2 (recusa sem ação completada,
  depois sucesso com ação completada) e satisfaz P3 completando a ação com um SEGUNDO usuário
  genuinamente diferente antes de fechar com sucesso — mas **nunca tenta fechar com o MESMO usuário**
  que completou a ação para confirmar que o navegador real recebe o 403. O comentário do próprio
  arquivo (linhas 18-52) descreve exatamente essa escolha: P2 é pré-verificado no cliente (uma
  leitura barata), P3 é deixado inteiramente ao 403 honesto do servidor "porque não há sinal
  confiável do lado do cliente para 'quem completou'" — mas isso explica por que o diálogo não
  pré-verifica P3, não por que o caminho de recusa de P3 nunca é exercitado por nenhum teste em
  navegador.

Registro correto: **P3 tem prova de recusa real, mas só na camada de API — nunca em navegador.**

---

## 5. O achado de cross-browser é maior do que esta fase, e uma parte do que me foi reportado sobre
   ele não resistiu à checagem

**O que me foi dito**: que o job de Firefox/WebKit só roda por despacho manual e não era despachado
desde 7 de setembro, quando falhou. **Isto está parcialmente errado**, verificado com
`gh run list --json ... | filtro para event=workflow_dispatch`:

| Run | Data (UTC) | Commit | Resultado |
|---|---|---|---|
| `34077942039` | 2026-09-07T02:56:22Z | `b57ab39c` | falha |
| `34594939253` | 2026-09-11T11:37:36Z | `e99d9789` | falha |
| `34603016921` | 2026-09-11T13:12:39Z | `f3b48560` | falha |

O job **foi despachado mais duas vezes na própria noite de 11/09**, não ficou parado desde 7/09. As
duas dispensas de 11/09 falharam por razões diferentes, cada uma diagnosticada contra o log real da
run, não por hipótese:

1. **Run `34594939253`**: toda instância de teste (`worker`) se autenticava através de UMA conta
   administradora compartilhada. Toda conta semeada nasce com `mustChangePassword = true`; o primeiro
   worker a entrar completa a troca obrigatória, rotaciona a senha da conta permanentemente, e uma
   troca de senha bem-sucedida revoga toda sessão daquela conta (FR-017). Qualquer worker já
   autenticado como a mesma conta perdia a sessão no instante em que outro worker rotacionava a
   senha. O próprio log prova isso, não apenas sugere: cinco falhas de autenticação em treze segundos
   no início do job, e uma rejeição de troca de senha por "A senha atual informada está incorreta" —
   uma senha atual desatualizada, que nenhum teste envia deliberadamente. Corrigido pelo commit
   `5690866`: `global-setup.ts` faz a única rotação necessária, uma vez, antes de qualquer worker
   existir; nenhum worker chama a troca de senha de novo contra essas contas.
2. **Run `34603016921`** (já rodando o código do item 1 acima): sessenta e quatro timeouts "no
   response was ever received", quase todos na metade final do job, enquanto o job Chromium (mesma
   sessão, mesmo código de conta rotacionada) não teve nenhum. Diagnóstico: Firefox e WebKit
   compartilhavam um job, um backend, um Postgres e um Redis por mais de vinte minutos de tráfego
   combinado — capacidade, não código. Corrigido pelo commit `22021d2`: `test-e2e-cross-browser`
   dividido em `test-e2e-firefox`/`test-e2e-webkit`, cada um com seu próprio Postgres/Redis/backend.

**O que ainda não aconteceu, e que devo registrar com honestidade**: a correção do item 2
(`22021d2`) **nunca foi verificada por uma dispensa manual real**. O run mais recente após esse
commit (`34608398835`) foi disparado por `push`, não por `workflow_dispatch` — `test-e2e-firefox`/
`test-e2e-webkit` reportam `skipped` nele, porque os dois jobs são condicionados a
`github.event_name == 'workflow_dispatch'` (`ci.yml` linhas 894, 1057). O próprio commit `5690866`
já dizia isto sobre a correção anterior ("Unverified against a live backend... The real test is the
cross-browser run the coordinator will dispatch after this push"), e a mesma ressalva vale para
`22021d2`: a divisão de job é lógica sã e a hipótese de capacidade é bem argumentada a partir do log,
mas **ninguém ainda viu Firefox e WebKit passarem** sob a nova forma.

**Registro correto sobre o cross-browser**: dois defeitos reais, cada um estabelecido pelo log da
própria pipeline (não por argumento) e cada um corrigido; a alegação de "sem despacho desde 7/09" era
falsa (dois despachos a mais aconteceram, ambos em 11/09, ambos falhando pelas razões acima); e a
correção mais recente (divisão de job) permanece **não verificada por execução** até a próxima
`workflow_dispatch`.

---

## 6. Correção de atribuição: o defeito de contraste é dos toasts, não do `SearchablePicker`

**FECHADO pelo commit `d1bc2cb`.** A mensagem do commit confirma o registro correto abaixo: toda
severidade de toast (sucesso, aviso, erro, informação) reprovava AA em tema claro, produto inteiro,
porque `richColors` do `sonner` lê variáveis `--success-*`/`--warning-*`/`--error-*`/`--info-*` que
`ui/sonner.tsx` nunca definia — só `--normal-*` estava configurado. Medido antes da correção com
`@axe-core/playwright` direto contra um toast renderizado: 4.25:1/3.07:1/4.34:1/4.35:1, todos abaixo
do limiar de 4.5:1. Corrigido apontando as oito variáveis (quatro severidades × fundo/borda/texto)
para os tokens `--status-*` do próprio design system. A hipótese de causa registrada abaixo
(`richColors` aplicando paleta própria do `sonner`) estava correta.

Fui informado inicialmente de que um defeito de contraste no design system havia sido encontrado no
`SearchablePicker` (o combobox pesquisável usado nas seções de vínculo). **Essa atribuição estava
errada e foi corrigida pelo coordenador antes deste registro, com verificação direta dos dois
pacotes.**

Os seletores da violação relatada — `div[data-title=""]` e
`li[data-index="0"] > div[data-content=""] > div[data-title=""]` — são emitidos pela biblioteca de
**toast** (`sonner`), não pela biblioteca de combobox (`cmdk`, usada por `SearchablePicker`): a
primeira gera `data-title`/`data-content`/`data-index` em seu próprio HTML; a segunda marca seus itens
com um atributo de nome inteiramente diferente e nunca emite `data-title`. O que aconteceu: o popover
do picker disparou um toast quando uma busca resolveu, e a varredura de acessibilidade capturou o
toast que apareceu na tela, não o popover que o causou — uma conclusão plausível e errada por parte
de quem relatou o achado original.

**Registro correto**: violação de contraste de cor, severidade "serious", nos **toasts de notificação
da aplicação** — afeta todo toast do produto, não os consumidores de um componente específico.
Verificação própria de apoio, não a causa confirmada: `apps/web/src/components/shell/
feedback-provider.tsx` linha 39 configura o `<Toaster>` com a prop `richColors`, que aplica as
paletas de status **da própria biblioteca `sonner`**, não os tokens do design system — a hipótese
mais provável de causa, mas não confirmada como tal por esta reconciliação nem pelo coordenador; é a
primeira coisa a investigar quando alguém for corrigir isto, não a explicação final.

Vale registrar a forma deste episódio, não só o conteúdo: uma atribuição plausível foi escrita com
confiança e precisou ser checada antes de virar permanente — a mesma forma de pelo menos três outros
achados desta fase (§2.1-§2.5), onde ler o comentário ou a mensagem de commit não bastou; foi preciso
ler o código.

---

## 7. Decisões que **não** devem ser reabertas

- **O vínculo Problema↔Incidente é N:M, opcional dos dois lados, propriedade de Problemas, sem
  acoplamento de ciclo de vida** (research.md D-13 a D-15, spec.md "Decisões do coordenador"). A
  ausência de consulta ao vínculo dentro das pré-condições de transição de qualquer um dos dois
  domínios está confirmada por leitura de `transition-{incident,problem}.usecase.ts` (§2.5 registra
  que falta um teste automatizado nomeado para esta negativa especificamente, não que a garantia em
  si esteja em dúvida).
- **Incidente não tem segregação de papéis para fechar** (FR-006) — por isso "Incident Manager" cobre
  o ciclo inteiro sozinho, diferente de "Problem Manager", cuja segregação de fechamento é aplicada
  pelo domínio por usuário, não pelo papel.
- **`ActionOriginType` só ganhou `INCIDENT`/`PROBLEM` numa migração separada da fundação**, de
  propósito — CLAUDE.md §19.10 é citado explicitamente no commit `064c9d1` como a razão de não
  estender o enum antes do acessor existir de verdade.
- **Nem Incidente nem Problema se relacionam com Ativo/Processo além do que já está implementado**:
  Problema não tem relação com Ativo/Processo nesta fase (a própria tabela de relações de spec.md
  marca "Não nesta fase" para os dois) — `asset:view`/`process:view` deliberadamente NÃO fazem parte
  do papel "Problem Manager", e o guard `asset-process-write-implies-read.spec.ts` ganhou uma exceção
  nomeada para este papel especificamente (commit `18e9351`), documentada ao lado do próprio guard,
  não como escape geral.

---

## 8. Como verificar sem se enganar

**NÃO VERIFICADO NESTA SESSÃO**: nem a reconciliação original nem a atualização de 2026-09-11 contra
`795343b` rodaram suíte alguma localmente — a primeira por restrição explícita da tarefa de não tocar
banco de dados, a segunda pela mesma restrição desta rodada de documentação. Os números abaixo vêm do
run de CI real mais recente conhecido, contra o commit `501c7ad` (não contra `795343b`):

```
pnpm --filter @vertice/api run typecheck && pnpm --filter @vertice/api run lint
pnpm --filter @vertice/api run test:unit          # 485
pnpm --filter @vertice/api run test:contract      # 712
pnpm --filter @vertice/api run test:integration   # 207
pnpm --filter @vertice/web  run test:unit         # 571
pnpm --filter @vertice/web  exec playwright test --project=chromium   # 100
pnpm --filter @vertice/api run openapi:check
pnpm run format:check
```

`test-e2e-firefox`/`test-e2e-webkit` só rodam em `workflow_dispatch` manual — ver §5 antes de
presumir que "CI verde" cobre os dois motores não-Chromium.

**Antes de confiar em qualquer contagem futura**: o `test:unit` da API caiu de 490 (baseline de
`006-assets-processes`) para 485 já no primeiro commit desta fase (`064c9d1`), sem nenhuma explicação
nos commits de `008`. A queda é anterior a esta fase (aconteceu em `007-implementation-remediation`,
entre as duas), mas ninguém a documentou explicitamente em lugar nenhum que eu tenha encontrado — se
alguém investigar, comece por `007-implementation-remediation`, não por `008`.

---

## 9. Traps para quem continuar — riscos verificados no ambiente local, não no código da fase

Nenhum destes bloqueia a fase; todos são propriedades do ambiente que já causaram ou podem causar
confusão a quem rodar isto localmente.

- **O banco de dados nativo local (porta 5432) é compartilhado e cresce para sempre.** `vertice_grc`
  (desenvolvimento) nunca é truncado — só `vertice_grc_test` é, pela própria suíte de teste (D-4,
  `docs/local-environment.md`). E2E local roda contra os servidores de desenvolvimento reais, logo
  contra `vertice_grc`, que acumula usuários, papéis e registros de toda sessão de trabalho já feita
  neste repositório. Isto já causou um defeito real: dois pontos de login do E2E buscavam só a
  PRIMEIRA página de `GET /admin/roles` e paravam — corretos só enquanto o papel procurado
  aparecesse nos cem primeiros resultados, coisa que uma base "carregando anos de fixtures
  acumuladas" deixa de garantir (comentário `D-20`, `apps/web/e2e/support/admin-session.ts` linha
  490). **Já corrigido** (pelo commit `22021d2`, pagina até achar ou esgotar de verdade), mas a
  condição de fundo — rodar E2E local contra uma base nativa que só cresce — continua, e qualquer
  helper futuro que assuma "primeira página"/"primeiros N" está sujeito ao mesmo defeito de novo.
- **`docker-compose.test.yml` tem `name: vertice-grc-test` fixo** — e isto é ao mesmo tempo a correção
  de um problema e a fonte de um novo. O nome fixo existe para impedir que este stack de teste
  substitua os containers do `docker-compose.yml` de desenvolvimento quando os dois rodam do mesmo
  diretório (o comentário do próprio arquivo, linhas 16-24, narra esse incidente). Mas o MESMO nome
  fixo, mais as MESMAS portas fixas (`5434`/`6380`), significa que **dois agentes** rodando
  `docker compose -f docker-compose.test.yml up` ao mesmo tempo — cada um pensando ter seu próprio
  stack isolado — na verdade competem pelo mesmo projeto e pelas mesmas portas, e um `down -v` de um
  agente derruba o stack do outro. Isto não é hipotético: é a consequência direta e verificável da
  configuração como está escrita hoje.
- **Não há hook de pre-commit local nenhum** — confirmado: sem `.husky/`, sem `simple-git-hooks`,
  sem script `prepare` em `package.json`, e `.git/hooks/` só tem os arquivos `.sample` padrão do Git.
  Formatação chega à esteira sem filtro nenhum antes — e o histórico de commits desta própria fase
  confirma o custo: pelo menos quatro commits somente de formatação (`85cdc11`, `f3b4856`,
  `2e43049`, `4c1b7aa`) existem só para corrigir arquivos que o `prettier` teria pego antes do
  commit, se houvesse um hook.

---

## 10. Pendências, com dono

**Tabela reescrita em 2026-09-11 contra `795343b`.** Três blocos: o que saiu (fechado por commit
desde a reconciliação original), o que ficou (registrado antes, ainda sem reavaliação de código
nesta sessão — não presumido fechado nem reaberto), e o que entrou (achados novos desta segunda
reconciliação, detalhados na nova §11).

**Saiu — fechado por commit, verificado por leitura direta nesta reconciliação:**

| Item | Onde | Situação |
|---|---|---|
| T010/T057 — acessor Attachable/Commentable ausente para Incidente/Problema | `core/comments/domain/entity-registry.ts`; `{incidents,problems}.module.ts` | **FECHADO por `4b18978`** — ver §2.2 |
| T047/T051/T052/T053 (metade) — vínculo invisível a partir de Risco/Ativo/Processo | `modules/{risk,assets,processes}` | **FECHADO por `2a39b52`** — ver §2.4 |
| T056/T059 — Evidência nunca exercitada para Incidente/Problema; sem painel na interface | `IncidentEvidenceSubjectAccessor`/`ProblemEvidenceSubjectAccessor`; telas de detalhe | **FECHADO por `4b18978`** — ver §2.3 |
| Contrato desta fase fora de `contract-coverage.spec.ts` | `apps/api/test/contract/contract-coverage.spec.ts` | **FECHADO por `2a39b52`** — ver §2.1 |
| Contraste "serious" nos toasts (rich-colour mode) | `feedback-provider.tsx`/`ui/sonner.tsx` | **FECHADO por `d1bc2cb`** — ver §6 |

**Ficou — registrado na reconciliação original, sem reavaliação de código nesta sessão (não
presumir fechado nem reaberto sem verificar):**

| Item | Onde | Situação |
|---|---|---|
| T012/T013 — sem teste de unidade de exaustividade da tabela de transição | `domain/incident.entity.ts`, `domain/problem-lifecycle.ts` | Não reavaliado nesta sessão |
| T030/T043/T062 — cobertura de teste de componente esparsa | `features/{incidents,problems}/components/*.tsx` | Não reavaliado nesta sessão |
| T046/T053b — revínculo (unlink + relink do mesmo par) não comprovado | suíte de integração de relacionamento | Não reavaliado nesta sessão |
| T053c — N:M genuíno (dois vínculos simultâneos por lado) não exercitado por teste | integração/contrato | Não reavaliado nesta sessão |
| T060 — sem busca estrutural automatizada para SC-004 | (nenhum arquivo) | Não reavaliado nesta sessão |
| T067 (parte navegador) — sem E2E de escopo organizacional em navegador para os cinco vínculos | `apps/web/e2e/` | **ABERTO, confirmado nesta sessão** — API fechada por `7674efb`, navegador não. Ver §2.5 |
| T068/T070 — sem registro explícito de baseline de testes nem revisão arquivo a arquivo | (nenhum documento) | Não reavaliado nesta sessão |
| Divisão de job cross-browser (`22021d2`) | `.github/workflows/ci.yml` | **ABERTO, confirmado nesta sessão** — nenhum `workflow_dispatch` novo verificado desde a reconciliação original. Ver §5 |
| Queda de 490→485 no `test:unit` da API, sem explicação registrada | entre `006` e `008` | Não reavaliado nesta sessão; fora de escopo desde a origem |

**Entrou — achados novos desta reconciliação de 2026-09-11 (detalhes na §11):**

| Item | Onde | Situação |
|---|---|---|
| Flag diagnóstica temporária de worker único para WebKit | `.github/workflows/ci.yml` | **ABERTO** — introduzida pelo commit `44e1e04`, nunca revertida |
| F-56 — o padrão `Controller` do formulário compartilhado perde valor digitado antes da hidratação | `docs/deferred-findings.md`; corrigido só no login | **ABERTO** — decisão de produto/arquitetura pendente sobre os demais formulários, commit `19d73f7` corrigiu só o login |
| Identificador de fase `013-incidents-problems-reverse-links` sem diretório de especificação correspondente | ~20 arquivos de produção e `contract-coverage.spec.ts` | **RESOLVIDO por decisão do coordenador, registrada em §11** — não é uma lacuna a fechar, é uma atribuição de rótulo |

---

## 11. Achados novos desta reconciliação de 2026-09-11 — não fechados por nenhum dos cinco commits acima

Três itens, encontrados nesta segunda reconciliação (contra `795343b`), que não apareciam em nenhum
registro anterior deste documento.

### 11.1 — Flag diagnóstica temporária de worker único para WebKit, ainda em `ci.yml`

O commit `44e1e04` acrescentou a `.github/workflows/ci.yml` uma flag diagnóstica de **worker único**
para o job WebKit, com o objetivo explícito de isolar uma queda no meio da execução. A mensagem do
próprio commit marca a flag como temporária. Ela **não foi revertida** até `795343b`. Continua sendo
diagnóstico ativo, não configuração permanente pretendida — deve ser revisitada quando a causa da
queda for encontrada, para decidir se volta a múltiplos workers ou se a redução se justifica de
forma permanente (o que exigiria registro explícito, não silêncio).

### 11.2 — F-56: o padrão `Controller` do formulário compartilhado perde valor digitado antes da hidratação

Registrada em `docs/deferred-findings.md` pelo commit `19d73f7`. O formulário de login descartava
silenciosamente um valor digitado pelo usuário antes da hidratação do React completar — corrigido
para o login por esse mesmo commit. O achado é mais amplo: o padrão `Controller` do formulário
compartilhado que causou o defeito é usado por, provavelmente, todo formulário do produto que o
consome, não só o de login. Se o mesmo padrão causa o mesmo defeito em outros formulários é algo
ainda não determinado por esta reconciliação. A decisão sobre corrigir (ou não) os demais formulários
é de produto/arquitetura, não uma correção mecânica — permanece **ABERTA**, propositalmente não
decidida por este documento.

### 11.3 — O identificador `013-incidents-problems-reverse-links` não corresponde a nenhuma especificação, e não vai passar a corresponder

Cerca de vinte arquivos de código de produção e o cabeçalho de
`apps/api/test/contract/contract-coverage.spec.ts` citam o identificador de fase
`013-incidents-problems-reverse-links` — em `modules/risk`, `modules/assets`, `modules/processes`,
`modules/incidents`, `modules/problems` e `shared/grc-ports/`. **Este diretório de especificação NÃO
existe e NUNCA existiu neste repositório**: `specs/` vai de `001` a `009`, e
`git log --all --diff-filter=A -- 'specs/*'` confirma que nenhum diretório `010` a `013` jamais foi
adicionado em nenhum commit de nenhum branch. É um rótulo de frente de trabalho que o commit
`2a39b52` usou para nomear a mudança que ele introduziu (a leitura reversa dos quatro vínculos
Incidente/Problema, §2.4 acima) — não uma especificação real, e não uma referência quebrada a
corrigir às pressas.

**Resolução decidida pelo coordenador, registrada aqui para que um `grep` por
`013-incidents-problems-reverse-links` encontre resposta**: o rótulo pertence a esta fase,
`008-incidents-problems`. Não existe nem existirá um diretório `specs/013-...`. Os comentários de
código que citam o rótulo **não serão reescritos em massa** — o custo de tocar ~20 arquivos de
produção só para trocar um comentário não se justifica, e o próprio texto do comentário continua
tecnicamente correto sobre o que a mudança fez. Quem procurar por esse identificador no futuro — por
`grep`, por dúvida, ou por não encontrar o diretório que o nome sugere — encontra a resposta neste
parágrafo: o trabalho é real, está descrito em §2.1/§2.4 acima, e pertence a `008-incidents-problems`,
não a uma spec numerada `013`.

### 11.4 — CI remota bloqueada por billing do GitHub, não por defeito de código

**BLOQUEADO (externo).** `gh run list` e a API de anotações do GitHub mostram que as três runs mais
recentes falharam todas com a MESMA anotação literal, no job `install (pnpm cache)`, em 1 a 2
segundos, com todos os demais jobs `skipped`: "The job was not started because recent account
payments have failed or your spending limit needs to be increased."

| Run | Commit | Evento | Resultado |
|---|---|---|---|
| `34632387285` | `795343b` | push | falha por billing |
| `34629248303` | `2a39b52` | push | falha por billing |
| `34621583173` | `44e1e04` | push | falha por billing |

A última run verde conhecida é `34615908956`, commit `4b18978`. **Consequência**: os commits
`d1bc2cb`, `44e1e04`, `19d73f7`, `6267cff`, `2a39b52` e `795343b` nunca foram verificados por CI. É
bloqueio externo — exige ação humana na conta de billing do GitHub — e não é defeito desta fase nem
autoriza parar o trabalho; a bateria local de §11.5 é a evidência substituta enquanto o bloqueio
persistir. Registrado também em `docs/deferred-findings.md` F-58.

### 11.5 — Bateria local realmente executada nesta sessão (2026-09-11, contra `795343b`)

Números reais de execução, não inferidos, obtidos pelo coordenador nesta mesma sessão de
documentação:

| Portão | Comando | Resultado |
|---|---|---|
| audit | `pnpm audit --audit-level=high --ignore-registry-errors` | VERIFICADO, passa (2 vulnerabilidades moderadas, abaixo do limiar — `docs/deferred-findings.md` F-57) |
| format:check | `pnpm run format:check` | VERIFICADO, passa |
| typecheck | `pnpm run typecheck` | VERIFICADO, passa (4 projetos) |
| lint | `pnpm run lint` | VERIFICADO, passa (4 projetos) |
| API unit | `pnpm --filter @vertice/api run test:unit` | VERIFICADO, 48 arquivos, 485/485 |
| web unit | `pnpm --filter @vertice/web run test:unit` | VERIFICADO, 110 arquivos, 596/596 |
| openapi:check | `pnpm --filter @vertice/api run openapi:check` | VERIFICADO, `openapi.json` atualizado |
| api-types:check | `pnpm --filter @vertice/api-types run generate` (árvore limpa, sem alteração) + `build`/`typecheck` do pacote | VERIFICADO, passa |
| contrato | `pnpm --filter @vertice/api run test:contract` | VERIFICADO, 53 arquivos, 728/728. A primeira execução desta sessão encontrou 727 passando e 1 falha; o número subiu para 728 porque a correção de §11.6 fez o teste de exaustividade passar — não porque um teste novo foi acrescentado à contagem, o teste já existia e estava falhando. Ver §11.6 |
| integração | `pnpm --filter @vertice/api run test:integration` | VERIFICADO, 45 arquivos, 235/235 |
| build | `pnpm --filter @vertice/api run build` (`nest build`); `packages/api-types`/`packages/design-system` build | VERIFICADO, passam. `pnpm --filter @vertice/web run build` (`next build`) só passa com `API_INTERNAL_URL`/`APP_ORIGIN` definidas — ver `docs/local-environment.md` D-22, Trap 3 — VERIFICADO com essas variáveis na linha de comando |
| E2E | — | NÃO VERIFICADO — não executado nesta sessão |

Estes números substituem, para esta sessão específica, a tabela de CI histórica citada em §1/§8
(commit `501c7ad`) como a evidência mais recente disponível — a CI não roda desde então (§11.4).

### 11.6 — Regressão real na varredura exaustiva de disclosure: quatro operações de leitura reversa ausentes — encontrada nesta sessão, CORRIGIDA e VERIFICADA

`apps/api/test/contract/information-disclosure.spec.ts`, teste "swept every operation
apps/api/openapi.json declares — exhaustiveness, not a sample", falhava: `openapi.json` declara 198
operações e a varredura exercitava apenas 194. As quatro ausentes eram exatamente as quatro operações de
leitura reversa que o commit `2a39b52` acrescentou (§2.4 acima):
`RiskRelationshipController_listIncidentLinks`, `RiskRelationshipController_listProblemLinks`,
`AssetController_listIncidentLinks`, `ProcessController_listIncidentLinks`.

**Causa**: o próprio commit `2a39b52` registrou honestamente que seus testes novos não foram
executados localmente ("the local database engine did not respond in time to wait on"), e a CI que
os teria pego estava bloqueada por billing desde aquele mesmo push (§11.4) — um commit não verificado
somado a uma CI indisponível.

**Correção, VERIFICADA pelo coordenador nesta mesma sessão**: aplicada a
`apps/api/test/contract/information-disclosure.spec.ts`, e **somente** a esse arquivo — quatro
chamadas `sweep(...)` novas, 28 linhas acrescentadas, nada removido, nenhuma asserção enfraquecida.
As quatro operações agora varridas: `RiskRelationshipController_listIncidentLinks`
(`GET /api/v1/risks/{riskId}/incidents`), `RiskRelationshipController_listProblemLinks`
(`GET /api/v1/risks/{riskId}/problems`), `AssetController_listIncidentLinks`
(`GET /api/v1/assets/{assetId}/incidents`) e `ProcessController_listIncidentLinks`
(`GET /api/v1/processes/{processId}/incidents`).

Detalhe que vale registrar, porque é o que torna a varredura não-vácua: cada chamada foi colocada
DEPOIS de o vínculo correspondente ser criado e ANTES de ele ser desfeito, de modo que a leitura
reversa devolve dado real em vez de lista vazia. Uma varredura posicionada depois do `unlink` teria
passado igualmente e não teria varrido conteúdo nenhum. Nenhuma fixture nova foi criada — as quatro
reusam `riskId`, `assetId`, `processId`, `incidentId` e `problemId` já existentes no arquivo.

As três asserções de conteúdo do arquivo (nenhum corpo de resposta HTTP, nenhum log operacional e
nenhuma linha de `audit_event` contendo segredo, token, id de sessão, stack trace ou identificador
interno) continuam passando e agora varrem também as quatro respostas novas — nenhuma delas expôs
nada. Isto é resultado de segurança, não só de contagem.

**Resultado real, medido pelo coordenador**: o arquivo isolado passa 6/6; a suíte de contrato
inteira passa 53 arquivos, 728 testes, 728 passando; `lint`, `typecheck` e `format:check` da API
passam. A regressão foi encontrada nesta sessão, e esta mesma sessão a corrigiu e verificou.
