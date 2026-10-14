# Feature Specification: Gestão de Incidentes e Gestão de Problemas

**Feature Branch**: `008-incidents-problems`

**Created**: 2026-09-11

**Status**: Draft

**Input**: CLAUDE.md §17, item 13 ("Ordem seguinte, orientada por dependência arquitetural") —
Gestão de Incidentes e Gestão de Problemas, condicionada à convergência de `Action`
(`specs/007-implementation-remediation`, concluída e provada contra dado real). Coordenador (Claude
Opus): "escreva do jeito que a especificação de remediação aceita foi escrita, no mesmo estilo de
casa e em português, sob um novo diretório de fase", com seis exigências explícitas — relações
declaradas com toda contraparte GRC, consumo das capacidades compartilhadas de Ação e Evidência sem
inventar conceito próprio, os dois mecanismos sancionados de relacionamento e nenhum terceiro,
estado derivado calculado por um único componente, interface em pt-BR estendendo o Design System
com critérios de aceitação explícitos, e as perguntas de produto genuinamente abertas trazidas para
decisão — não respondidas em silêncio.

**Pré-requisito, verificado antes de esta especificação começar**: a convergência de `Action`
(`specs/007-implementation-remediation`, User Story 1) está concluída e comitada —
`RiskTreatmentAction` não guarda mais os seis campos de trabalho, `Action` é a única autoridade de
escrita, e a migração foi provada contra dado real (contagens antes/depois idênticas). É exatamente
a condição que `docs/architecture/grc-roadmap.md` §1 registrou como pré-requisito para começar esta
fase: "Incidentes é o segundo consumidor real de `Action` além de Riscos, e começar Incidentes sem
fechar [a convergência] duplicaria o problema por um terceiro caminho." Verificado aqui, não
presumido: `apps/api/src/grc/action/` é a única fonte de campos de trabalho hoje; nenhuma tabela de
módulo de negócio guarda título, responsável, prazo ou status de tarefa em paralelo.

---

## Contexto medido, não presumido

Este projeto já registrou três causas plausíveis, escritas com confiança e **erradas**
(`specs/005-audit-findings/STATE.md` §6) — cada uma dispensou o leitor seguinte de conferir. A
tabela abaixo é o que existe hoje, verificado antes desta especificação ser escrita.

| Fato | Como foi verificado | Resultado |
|---|---|---|
| Nem Incidente nem Problema têm módulo, tabela ou contrato hoje | `ls apps/api/src/modules/`, busca por `model Incident`/`model Problem` em `schema.prisma` | nenhum dos dois existe em código |
| `Action.originType` é um registro fechado, hoje com três valores | `schema.prisma`, `enum ActionOriginType` | `RISK_TREATMENT \| FINDING \| CONTROL_ASSESSMENT` — nem `INCIDENT` nem `PROBLEM` |
| `EvidenceSubjectType` é um registro fechado, hoje com cinco valores | `schema.prisma`, `enum EvidenceSubjectType` | `RISK \| RISK_TREATMENT_DECISION \| FINDING \| ACTION \| CONTROL` |
| O roteiro já antecipa as relações, sem tê-las ratificado como decisão de especificação | `docs/architecture/grc-roadmap.md` §2, Fase 6 | "Incidente↔Risco, Incidente↔Ativo, Incidente↔Processo, Incidente→Action, Problema↔Incidente" — texto de planejamento, não FR aprovado |
| A Constituição do produto lista quatro relações envolvendo Risco, apresentadas como exemplos | CLAUDE.md §10 | a seção abre com "Exemplos:" antes de enumerar os pares — lista ilustrativa, não exaustiva |
| O blueprint de domínio já registra uma dependência de Problema sobre Incidente, sem definir a forma | `docs/history/grc-domain-blueprint.md` §2 | "Problemas: não iniciado, depende de: plataforma, Action, **Incidentes**" |
| O benchmark já recomenda o vínculo Risco↔Incidente como N:M explícito | `docs/history/probo-benchmark.md` §29 | "incidente materializa risco" |
| `FindingRiskLink` é o precedente mais recente de vínculo N:M nomeado entre um registro operacional e Risco | `schema.prisma:2833`, migração `20260908110300` | tabela de ligação explícita, com `linkedByUser`/`unlinkedByUser`, sem soft-delete de linha |

**Correção, 2026-09-11 (coordenador)**: uma versão anterior desta seção registrava uma "tensão" entre
o roteiro/blueprint (que anteciparam Incidente↔Problema) e CLAUDE.md §10 (que não lista esse par).
**Não havia contradição** — §10 introduz sua lista com a palavra "Exemplos:", antes de enumerar os
pares: é explicitamente ilustrativa, nunca afirmou cobrir todo relacionamento possível. O roteiro e o
blueprint anteciparem um vínculo que a lista de exemplos não menciona não é uma tensão entre
documentos — é exatamente o espaço que uma lista de exemplos deixa aberto por desenho. O que
resolveu Incidente↔Problema (seção "Decisões do coordenador", abaixo) não foi reconciliar dois
documentos em desacordo; foi decidir a pergunta de produto que nenhum dos dois documentos, sozinho,
respondia — ver research.md, seção de correção que acompanha D-13 a D-15.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Registrar e conduzir um incidente até o fechamento (Priority: P1)

Um usuário operacional relata que algo parou de funcionar como deveria — um serviço fora do ar, um
processo interrompido, um ativo comprometido. Alguém assume a condução, investiga, mitiga, e o
incidente é fechado com um resumo do que aconteceu e do que foi feito.

**Why this priority**: é o núcleo do módulo. Sem isto, nenhum dos outros cenários tem o que
referenciar, e o módulo não existe de fato.

**Independent Test**: registrar um incidente, movê-lo por cada transição de estado até o
fechamento, e confirmar que cada transição foi auditada com o valor anterior e o posterior.

**Acceptance Scenarios**:

1. **Given** um usuário com `incident:create`, **When** registra um incidente informando título,
   descrição, severidade e unidade organizacional, **Then** o incidente passa a existir com um
   código gerado pelo sistema, situação `OPEN`, e aparece na listagem de incidentes daquela unidade.
2. **Given** um incidente `OPEN`, **When** um usuário com `incident:transition` o move para
   `IN_PROGRESS`, **Then** a transição é aceita e um responsável fica associado a ela.
3. **Given** um incidente `IN_PROGRESS`, **When** um usuário tenta movê-lo para `RESOLVED` sem
   informar um resumo de resolução, **Then** a operação é recusada — o resumo é obrigatório para
   esta transição, assim como a justificativa de fechamento já é obrigatória para `Finding` (FR-004
   espelha o precedente de `closureJustification`).
4. **Given** um incidente `RESOLVED` com resumo informado, **When** movido para `CLOSED`, **Then** a
   transição é aceita e o incidente passa a ser somente leitura para os campos descritivos.
5. **Given** um incidente registrado por engano ou duplicado, **When** um usuário com
   `incident:transition` o cancela, informando o motivo, **Then** o incidente vai para `CANCELLED`
   — um estado terminal distinto de `CLOSED`, para que métricas de tempo de resolução não contem um
   registro que nunca foi um incidente real.
6. **Given** qualquer transição de estado, **Then** a transição ilegal (por exemplo, `CLOSED` para
   `OPEN`, ou pular de `OPEN` direto para `CLOSED`) é recusada com `422`, e a tabela de transições
   legais é a única fonte de verdade — nenhuma checagem duplicada em outro lugar.

---

### User Story 2 — Registrar e conduzir um problema até a causa raiz (Priority: P1)

Um analista suspeita, ou já sabe, que existe uma causa estrutural por trás de uma falha — algo que,
se não for corrigido na raiz, vai continuar produzindo consequências. Ele registra um problema,
investiga, documenta a causa raiz, e o fecha quando a correção definitiva existe.

**Why this priority**: mesmo nível da US1 — é o segundo dos dois domínios que esta fase entrega, e
nenhum dos dois é o "principal" em relação ao outro nesta especificação (a relação entre eles é
exatamente a pergunta em aberto, não uma hierarquia presumida).

**Independent Test**: registrar um problema, documentar a causa raiz, vinculá-lo a uma ação
corretiva através de `Action`, e fechá-lo somente depois que essa ação estiver concluída.

**Acceptance Scenarios**:

1. **Given** um usuário com `problem:create`, **When** registra um problema informando título,
   descrição, severidade e unidade organizacional, **Then** o problema passa a existir com um código
   gerado pelo sistema, situação `OPEN`.
2. **Given** um problema `OPEN`, **When** um usuário com `problem:transition` o move para
   `IN_ANALYSIS`, **Then** a transição é aceita.
3. **Given** um problema `IN_ANALYSIS`, **When** um usuário tenta movê-lo para `RESOLVED` sem
   informar a causa raiz, **Then** a operação é recusada — `rootCause` é obrigatório para esta
   transição.
4. **Given** um problema `RESOLVED` cuja causa raiz está documentada, **When** um usuário tenta
   fechá-lo **sem** nenhuma `Action` de origem `PROBLEM` no estado `COMPLETED`, **Then** a operação
   é recusada — fechar um problema exige que a correção definitiva já exista como trabalho
   concluído, não apenas como intenção escrita em texto.
5. **Given** as condições do cenário 4 satisfeitas, **When** o problema é fechado, **Then** a
   transição exige que quem fecha seja diferente de quem concluiu a ação corretiva — a mesma
   segregação de funções que `Finding` já aplica ao fechamento de um achado (research.md D-7).
6. **Given** um problema cancelado por não se confirmar como causa raiz real, **Then** vai para
   `CANCELLED`, terminal, distinto de `CLOSED`.

---

### User Story 3 — Vincular incidente a risco, ativo, processo, e problema a risco e a incidente (Priority: P1)

Um incidente raramente existe isolado: ele costuma materializar um risco já registrado, costuma
afetar um ativo ou um processo específico, e pode ter mais de uma causa contribuinte já registrada
como problema. Um problema, por sua vez, pode explicar vários incidentes de uma vez — falha composta
é o caso comum, não o exótico. Um usuário precisa declarar essas relações, dos dois lados, para que
consultar o risco, o ativo, o processo ou o problema já mostre os incidentes que os afetam, e
vice-versa.

**Why this priority**: é a relação que o benchmark já recomenda como N:M explícito ("incidente
materializa risco") e que a Constituição exemplifica nos dois sentidos (`Risco -> Incidente`,
`Incidente -> Risco`). O vínculo Problema↔Incidente é decisão do coordenador (research.md D-13 a
D-15): N:M, opcional dos dois lados, informativo e auditável, nunca uma trava de ciclo de vida — ver
"Decisões do coordenador", abaixo. Sem os cinco vínculos, um incidente e um problema são ilhas, e o
valor de correlacionar ocorrência, causa e risco registrado não existe.

**Independent Test**: vincular um incidente a um risco, a um ativo, a um processo e a um problema;
confirmar que a tela de detalhe de cada um agora lista o incidente (e o incidente lista o problema);
tentar vincular contra um alvo fora do escopo organizacional do ator e confirmar recusa idêntica a um
alvo inexistente; fechar um problema com um incidente vinculado ainda `OPEN` e confirmar que a
transição é aceita normalmente (D-15 — nenhum acoplamento).

**Acceptance Scenarios**:

1. **Given** um incidente e um risco, ambos dentro do escopo do ator, **When** o ator com
   `incident:link` **e** `risk:view` os vincula, **Then** o vínculo é criado, visível a partir dos
   dois lados (detalhe do incidente lista o risco; detalhe do risco lista o incidente).
2. **Given** o mesmo par, **When** um ator tenta vincular sem `risk:view` (só `incident:link`),
   **Then** é recusado — autorização exigida dos dois lados, o padrão que ADR-020 parte 5 já
   estabeleceu para todo par Controle↔Ativo/Processo.
3. **Given** um incidente e um ativo fora do escopo organizacional do ator, **When** o ator tenta
   vinculá-los, **Then** a recusa é **idêntica**, byte a byte, à de um ativo inexistente (ADR-020
   parte 4).
4. **Given** um vínculo desfeito, **When** o mesmo par é vinculado de novo, **Then** o vínculo
   anterior permanece na trilha (nunca apagado), e um novo vínculo é criado — o mesmo padrão que
   `FindingRiskLink`/`ControlAssetLink` já seguem.
5. **Given** um problema e um risco, **When** vinculados, **Then** o mesmo padrão dos cenários 1-4
   se aplica — Problema↔Risco usa o mesmo mecanismo, a mesma exigência de autorização dos dois
   lados, e a mesma trilha.
6. **Given** um problema e um incidente, ambos dentro do escopo do ator, **When** o ator com
   `problem:link` **e** `incident:view` os vincula por `POST /problems/{problemId}/incidents`,
   **Then** o vínculo é criado, visível a partir dos dois lados (detalhe do problema lista o
   incidente; `GET /incidents/{incidentId}/problems` lista o problema).
7. **Given** o mesmo par, **When** um ator tenta vincular sem `incident:view` (só `problem:link`),
   **Then** é recusado — a mesma dupla exigência dos cenários 2 e 5, decidida como requisito de
   partida para este par (research.md D-14).
8. **Given** um problema já vinculado a dois incidentes distintos, **Then** os dois vínculos
   coexistem — o mecanismo é N:M, nunca um único incidente por problema nem um único problema por
   incidente.
9. **Given** um problema `CLOSED` cujo incidente vinculado ainda está `OPEN`, e um incidente
   `RESOLVED` cujo problema vinculado ainda está `IN_ANALYSIS`, **Then** as duas transições foram e
   permanecem legítimas — nenhuma das duas máquinas de estado consulta o estado da outra através do
   vínculo (research.md D-15; data-model.md L2).

---

### User Story 4 — Consumir Ação e Evidência já existentes, sem inventar um segundo conceito (Priority: P1)

Um responsável por um incidente ou por um problema precisa registrar o trabalho corretivo
(mitigação, correção definitiva) e a prova do que foi feito ou do que aconteceu — usando os
mecanismos que a plataforma já tem para isso, não um sistema de tarefas ou de anexos próprio do
módulo.

**Why this priority**: é a exigência explícita do coordenador e a razão registrada em
`docs/architecture/grc-roadmap.md` §1 para esta fase vir depois da convergência de `Action`: "cinco
sistemas independentes de tarefa é o defeito que esta ordem existe para evitar." Sem isto, a fase
reproduziria, num terceiro caminho, exatamente o problema que a Fase 007 acabou de fechar no
segundo.

**Independent Test**: criar uma ação de origem `INCIDENT`/`PROBLEM` por `POST /actions`, confirmar
que ela aparece na tela "Minhas ações" já existente; anexar evidência a um incidente e a um problema
e confirmar que o painel de evidências já existente a exibe, sem nenhuma tela nova de anexos.

**Acceptance Scenarios**:

1. **Given** um incidente `IN_PROGRESS`, **When** um usuário cria uma ação corretiva com origem
   `INCIDENT` e o `id` do incidente, **Then** a ação existe em `grc/action`, aparece em "Minhas
   ações", e sua transição de estado obedece à mesma tabela de legalidade que toda outra ação já
   obedece — nenhuma regra de transição própria do incidente.
2. **Given** um problema `IN_ANALYSIS`, **When** um usuário cria a ação corretiva com origem
   `PROBLEM`, **Then** o mesmo se aplica, e é essa ação — concluída — que a US2, cenário 4, exige
   para permitir o fechamento do problema.
3. **Given** um incidente ou um problema, **When** um usuário anexa um arquivo ou registra uma
   evidência por URL/observação, **Then** ela é criada com `subjectType` `INCIDENT`/`PROBLEM` em
   `grc/evidence`, e aparece no painel de evidências já existente — nenhum componente de anexo novo
   por módulo.
4. **Given** um incidente ou um problema, **When** um usuário comenta ou anexa um arquivo bruto
   (fora do fluxo formal de evidência), **Then** o registro correspondente em `CommentableEntityType`/
   `AttachableEntityType` aceita `INCIDENT`/`PROBLEM` — os mesmos painéis de comentários e anexos que
   toda outra tela de detalhe já usa.
5. **Given** os dois módulos, **Then** nenhum deles declara uma tabela própria de tarefa, de arquivo
   ou de aprovação — verificável por busca estrutural sobre o schema (SC-004).

---

### User Story 5 — Interface consistente com os módulos existentes (Priority: P2)

Um usuário abre as telas de Incidentes e de Problemas e reconhece o mesmo produto: mesma hierarquia
visual, mesmos padrões de tabela, formulário, badge de estado e vínculo que Riscos, Controles e
Achados já estabeleceram.

**Why this priority**: P2 porque depende das US1-US4 existirem primeiro para ter o que renderizar,
mas é obrigatória por CLAUDE.md §18 antes de a fase ser considerada concluída — não é polimento
final opcional.

**Independent Test**: capturar as telas novas nos dois temas (claro/escuro), varrer com axe, e
responder ao portão do §18.11 olhando a aplicação renderizada, não o código.

**Acceptance Scenarios**:

1. **Given** o catálogo de incidentes e o catálogo de problemas, **Then** ambos reusam os
   primitivos de tabela, filtro, indicador e paginação já usados por Riscos/Controles/Achados —
   nenhuma tabela nem paginação implementada localmente.
2. **Given** a badge de severidade e a badge de situação, **Then** nenhuma delas comunica seu
   significado só por cor — ícone ou texto sempre acompanha (§18.8).
3. **Given** as duas entradas de navegação, **Then** deixam de aparecer como "planejado" no registro
   de navegação (mesma correção que Controles recebeu em F-55 quando o módulo ficou real) e passam a
   `status: 'implemented'`.
4. **Given** as telas novas, **Then** funcionam em teclado, têm nome acessível, e passam a varredura
   de acessibilidade automatizada nos dois temas, com conteúdo real renderizado — não o esqueleto.
5. **Given** o texto voltado ao usuário em qualquer uma das telas novas, **Then** vem exclusivamente
   dos catálogos centralizados pt-BR (`apps/api/src/shared/messages/`,
   `apps/web/src/lib/messages/`) — nenhuma string nova embutida em componente.

---

### Edge Cases

- **Um incidente sem nenhum vínculo**: legítimo. Nem todo incidente materializa um risco já
  registrado ou afeta um ativo/processo cadastrado — a US3 declara os vínculos como opcionais, 0..N.
- **Um problema sem nenhuma ação corretiva ainda**: legítimo em `OPEN`/`IN_ANALYSIS` — a exigência
  de uma `Action` `COMPLETED` só se aplica à transição para `CLOSED` (US2, cenário 4).
- **Uma ação de origem `INCIDENT`/`PROBLEM` criada diretamente por `POST /actions`, sem que o
  incidente/problema a liste de volta**: mesma classe de caso que `Action.originType = RISK_TREATMENT`
  já tem hoje sem `RiskTreatmentAction` correspondente — resolvido pelo mesmo mecanismo (o
  `ActionOriginResolverPort` de cada módulo lista por `originId`, não por uma FK própria).
- **Tentativa de vincular um incidente a um ativo/processo/risco já vinculado e depois
  desvinculado**: permitida — revincular é um fato novo, o vínculo anterior permanece na trilha
  (mesmo padrão de todo vínculo ADR-020 já em produção).
- **Um incidente `CANCELLED` que alguém tenta reabrir**: fora do escopo desta especificação —
  nenhuma acceptance scenario pede reabertura de um incidente cancelado, e nenhum requisito a
  introduz. Se isso se revelar necessário, é uma decisão de produto nova, não uma correção.

---

## Relações declaradas (obrigatório por CLAUDE.md §19.2)

"Não se relaciona" é resposta válida, mas precisa ser escrita — nunca resultar de esquecimento.
Tabela em duas partes, uma por domínio, porque as duas respostas divergem em mais de um par.

### Incidente

| Contraparte | Relação | Mecanismo | Justificativa |
|---|---|---|---|
| Unidade Organizacional | **Sim**, obrigatória | coluna própria, não anulável | igual a `Risk`/`Finding` — Incidente é entidade de fluxo de trabalho, não registro de referência (research.md D-10) |
| Risco | **Sim** — N:M | tabela de ligação nomeada, `IncidentRiskLink` | CLAUDE.md §10 declara `Risco -> Incidente` e `Incidente -> Risco`; docs/history/probo-benchmark.md §29: "incidente materializa risco" |
| Ativo | **Sim** — N:M | tabela de ligação nomeada, `IncidentAssetLink` | roteiro (`grc-roadmap.md` Fase 6) declara `Incidente↔Ativo`; mesmo mecanismo que `RiskAssetLink`/`ControlAssetLink` já provaram |
| Processo | **Sim** — N:M | tabela de ligação nomeada, `IncidentProcessLink` | idem, `Incidente↔Processo` |
| Controle | **Não nesta fase** | — | nenhum requisito desta especificação pede o vínculo direto; um controle relacionado é alcançável indiretamente pelo risco/ativo/processo já vinculado. Registrada como candidata futura, não construída sem consumidor real (§19.10) |
| Evidência | **Sim** | registro de tipo fechado, `EvidenceSubjectType += INCIDENT` | US4 — prova do que aconteceu ou do que foi feito |
| Ação | **Sim** | registro de tipo fechado, `ActionOriginType += INCIDENT` | US4 — trabalho corretivo/mitigador, sem conceito próprio de tarefa |
| Achado | **Indireto** | — | um achado aponta para risco ou controle, que por sua vez podem apontar para o incidente através do risco vinculado. Nenhum requisito pede vínculo direto — mesmo padrão que 006 já registrou para Ativo/Processo→Achado |
| Auditoria (engajamento) | **Não** | — | o escopo de um engajamento é framework, requisito ou controle; nenhum requisito pede incidente no escopo |
| Trilha de auditoria | **Sim** | capacidade transversal | toda criação, transição e vínculo é evento auditado |
| Problema | **Sim** — N:M, opcional dos dois lados | tabela de ligação nomeada, `ProblemIncidentLink` (propriedade de Problemas — ver a tabela de Problema, abaixo, e research.md D-14) | decisão do coordenador (D-13 a D-15): informativo e auditável, nunca uma trava de ciclo de vida |

### Problema

| Contraparte | Relação | Mecanismo | Justificativa |
|---|---|---|---|
| Unidade Organizacional | **Sim**, obrigatória | coluna própria, não anulável | mesma razão de Incidente |
| Risco | **Sim** — N:M | tabela de ligação nomeada, `ProblemRiskLink` | CLAUDE.md §10 declara `Risco -> Problema` e `Problema -> Risco` |
| Ativo | **Não nesta fase** | — | nem CLAUDE.md §10 nem o roteiro declaram este par para Problema (só para Incidente); nenhum requisito desta especificação o pede. Um ativo relacionado é alcançável pelo incidente vinculado, se o vínculo Incidente↔Problema existir |
| Processo | **Não nesta fase** | — | mesma razão |
| Controle | **Não nesta fase** | — | mesma razão que para Incidente |
| Evidência | **Sim** | registro de tipo fechado, `EvidenceSubjectType += PROBLEM` | prova da causa raiz e da análise |
| Ação | **Sim** | registro de tipo fechado, `ActionOriginType += PROBLEM` | US2/US4 — a correção definitiva é uma `Action`, nunca um campo de texto que afirma tê-la feito |
| Achado | **Indireto** | — | mesmo padrão de Incidente |
| Auditoria (engajamento) | **Não** | — | mesma razão de Incidente |
| Trilha de auditoria | **Sim** | capacidade transversal | idem |
| Incidente | **Sim** — N:M, opcional dos dois lados | tabela de ligação nomeada, `ProblemIncidentLink` — escrita (`POST`/`DELETE /problems/{problemId}/incidents`) pertence a Problemas, que resolve o incidente-alvo via `IncidentDirectoryPort` (`shared/grc-ports/`), nunca importando `modules/incidents` (ADR-011) | decisão do coordenador: um problema explica muitos incidentes, e um incidente pode ter mais de uma causa contribuinte (D-14). Autorização exigida dos dois lados: `problem:link` **e** `incident:view` |

### Capacidades transversais consumidas, sem relação própria a declarar

Comentários (`CommentableEntityType`) e anexos brutos (`AttachableEntityType`) são capacidades já
genéricas (§19.4) — Incidente e Problema entram nos dois registros fechados, como todo outro
registro operacional (Risco, Controle, Achado, Evidência) já faz. Notificação não tem registro
próprio: reusa `CommentableEntityType` (mesmo mecanismo que a correção do Finding D de
`docs/deferred-findings.md` F-53 já documentou para `platform.openapi.yaml`). Aprovação
(`ApprovableEntityType`) **não** é estendida nesta fase — nenhum requisito pede sign-off formal no
fechamento de um incidente ou de um problema; se isso se revelar necessário, é acrescentar um valor
de enum e um caso de uso (§19.4), não construir um motor novo.

---

## Decisões do coordenador

**Autoridade**: as três decisões abaixo (Q1-Q3) foram tomadas pelo coordenador desta fase (Claude
Opus), em 2026-09-11, registradas em `research.md` D-13 a D-15 com a razão de cada uma. São decisões
do coordenador desta fase, não decisões históricas do usuário do produto, e não devem ser citadas
como tal em nenhum documento futuro — a mesma distinção de autoridade que
`007-implementation-remediation/spec.md` já registrou para D-R1 a D-R14.

### Q1 — Um problema pode existir sem nenhum incidente de origem

**Decidido: sim.** Exigir origem em incidente proibiria a gestão proativa de problema — uma prática
real que esta plataforma já alimenta por outras portas (achado de auditoria, análise de risco,
tendência). Tornar a origem obrigatória forçaria um usuário a inventar um incidente falso só para
poder registrar um problema real, e um registro que precisa ser falsificado para existir é pior do
que um relacionamento anulável. O custo de deixar opcional é zero; o custo de tornar obrigatório é um
registro corrompido. Ver research.md D-13.

### Q2 — O vínculo Incidente↔Problema é N:M, tabela nomeada, propriedade de Problemas

**Decidido.** Um problema explica muitos incidentes, e um incidente genuinamente pode ter mais de
uma causa contribuinte — falha composta é o caso comum, não o exótico. Começar em 1:N forçaria uma
migração na primeira vez que a realidade discordasse. O vínculo segue o padrão que Risco→Controle já
estabeleceu: a escrita pertence a Problemas (`POST`/`DELETE /problems/{problemId}/incidents`), que
resolve o incidente-alvo através de `IncidentDirectoryPort` (`shared/grc-ports/`) — nenhum dos dois
módulos novos importa o outro. A autorização exigida é dupla desde a primeira linha:
`problem:link` **e** `incident:view` — este projeto já teve que fechar essa lacuna duas vezes
(F-46/F-49, `docs/deferred-findings.md`) por ela não ter sido exigida na primeira implementação de um
vínculo novo. Ver research.md D-14, data-model.md §2/§6.

### Q3 — Nenhum acoplamento rígido entre os dois fechamentos

**Decidido: nenhum.** Fechar um problema não exige que seus incidentes vinculados estejam
resolvidos; resolver um incidente não exige nem cria um problema. As duas máquinas de estado
respondem perguntas diferentes — um incidente é uma ocorrência sendo tratada, um problema é uma
causa estrutural sendo removida — e qualquer um dos dois pode legitimamente terminar primeiro.
Acoplar os dois deixaria um registro preso pelo outro domínio permanentemente, a mesma forma de
defeito que este projeto já sofreu uma vez. O vínculo é **informativo e auditável**, nunca uma trava
de transição, em nenhuma das duas direções (data-model.md, invariante L2).

Se uma organização quiser condicionar um fechamento ao outro, isso é política e relatório, não
restrição de banco — registrado como pergunta em aberto na cauda da Fase 7 (Indicadores e
Relatórios) de `docs/architecture/grc-roadmap.md`, com esta razão anexada, para quando aquela fase
for desenhada. Ver research.md D-15.

---

## Requirements *(mandatory)*

### Funcionais — Incidente (US1)

- **FR-001**: DEVE existir `Incident` (`grc/... ou modules/incidents`, decisão de estrutura em
  plan.md) com `id`, `code` (`INC-AAAA-NNNN`, R-008), `orgUnitId` (não anulável), `title`,
  `description`, `severity` (`IncidentSeverity`: `CRITICAL | HIGH | MEDIUM | LOW`), `reportedByUserId`,
  `ownerUserId`, `reportedOn` (data), `status` (`IncidentStatus`), `createdAt`, `updatedAt`.
- **FR-002**: `IncidentStatus` DEVE ser `OPEN | IN_PROGRESS | RESOLVED | CLOSED | CANCELLED`, com a
  tabela de transições legais como única fonte de verdade (research.md D-4): `OPEN -> IN_PROGRESS`,
  `OPEN -> CANCELLED`, `IN_PROGRESS -> RESOLVED`, `IN_PROGRESS -> CANCELLED`,
  `RESOLVED -> CLOSED`, `RESOLVED -> IN_PROGRESS` (reabertura, ver FR-003). Nenhuma outra transição
  é legal.
- **FR-003**: Reabrir um incidente `RESOLVED` de volta para `IN_PROGRESS` DEVE exigir um motivo —
  mesmo padrão que `Action`/`FindingStatus` já exigem para reabertura.
- **FR-004**: A transição para `RESOLVED` DEVE exigir `resolutionSummary` (texto não vazio). A
  transição para `CANCELLED` DEVE exigir `cancellationReason`.
- **FR-005**: `IncidentAssignedResponsibleUserId`/`ownerUserId` DEVE poder ser reatribuído por um
  usuário com `incident:edit`, com o valor anterior preservado na trilha de auditoria.
- **FR-006**: Fechar (`CLOSED`) um incidente **não** exige segregação de funções entre quem resolveu
  e quem fecha (research.md D-6 — decisão explícita, com alternativa rejeitada registrada).

### Funcionais — Problema (US2)

- **FR-007**: DEVE existir `Problem` com `id`, `code` (`PRB-AAAA-NNNN`), `orgUnitId` (não anulável),
  `title`, `description`, `severity` (`ProblemSeverity`: `CRITICAL | HIGH | MEDIUM | LOW`),
  `ownerUserId`, `identifiedOn` (data), `rootCause` (texto, anulável até a resolução), `status`
  (`ProblemStatus`), `createdAt`, `updatedAt`.
- **FR-008**: `ProblemStatus` DEVE ser `OPEN | IN_ANALYSIS | RESOLVED | CLOSED | CANCELLED`, com
  tabela de transições legais própria (research.md D-5): `OPEN -> IN_ANALYSIS`,
  `OPEN -> CANCELLED`, `IN_ANALYSIS -> RESOLVED`, `IN_ANALYSIS -> CANCELLED`,
  `RESOLVED -> CLOSED`, `RESOLVED -> IN_ANALYSIS` (reabertura, com motivo).
- **FR-009**: A transição para `RESOLVED` DEVE exigir `rootCause` preenchido (não vazio).
- **FR-010**: A transição para `CLOSED` DEVE exigir ao menos uma `Action` com `originType = PROBLEM`,
  `originId` igual ao problema, em estado `COMPLETED` — verificado no momento da transição, não
  apenas na criação. Sem isso, a operação é recusada com `422` e uma mensagem que nomeia a exigência.
- **FR-011**: A transição para `CLOSED` DEVE exigir segregação de funções: o usuário que fecha o
  problema DEVE ser diferente do usuário que concluiu a `Action` que satisfaz o FR-010 (research.md
  D-7 — mesmo padrão que `Finding` já aplica ao seu próprio fechamento).

### Funcionais — vínculos (US3)

- **FR-012**: DEVE existir `IncidentRiskLink`, `IncidentAssetLink`, `IncidentProcessLink` e
  `ProblemRiskLink`, cada uma no formato já estabelecido por `FindingRiskLink`/`ControlAssetLink`:
  tabela de ligação nomeada, `linkedByUserId`/`unlinkedByUserId`, sem soft-delete de linha
  (desvincular marca `unlinkedAt`, nunca apaga).
- **FR-013**: Criar qualquer um dos quatro vínculos DEVE exigir autorização dos dois lados —
  `incident:link`/`problem:link` **e** a autoridade de leitura do alvo (`risk:view`, `asset:view`,
  `process:view`) — o padrão que ADR-020 parte 5 já estabelece.
- **FR-014**: Criar qualquer um dos quatro vínculos contra um alvo fora do escopo organizacional do
  ator DEVE responder de forma **idêntica**, byte a byte, a um alvo inexistente (ADR-020 parte 4) —
  nenhuma linha é gravada.
- **FR-015**: O detalhe de Risco, Ativo e Processo DEVE listar os incidentes/problemas vinculados a
  ele — visibilidade dos dois lados, o mesmo padrão que todo vínculo ADR-020 já garante.
- **FR-015a** *(decisão do coordenador, Q1-Q3 — research.md D-13 a D-15)*: DEVE existir
  `ProblemIncidentLink`, N:M, opcional dos dois lados, na mesma forma das quatro tabelas de FR-012.
  A escrita (`POST`/`DELETE /problems/{problemId}/incidents`) pertence ao módulo de Problemas, que
  resolve o incidente-alvo através de `IncidentDirectoryPort` (`shared/grc-ports/`) — nenhum dos
  dois módulos importa o outro (ADR-011). `GET /incidents/{incidentId}/problems` no contrato de
  Incidentes lê a mesma tabela diretamente, sem depender de código de `modules/problems`.
- **FR-015b**: Criar o vínculo Problema↔Incidente DEVE exigir `problem:link` **e** `incident:view` —
  a mesma dupla exigência de FR-013, aplicada a este par desde a primeira implementação.
- **FR-015c**: Nenhuma invariante de transição de `Incident` ou `Problem` PODE consultar
  `ProblemIncidentLink` ou o estado de um registro vinculado através dele. O vínculo é informativo e
  auditável — fechar um problema nunca verifica o estado dos incidentes vinculados, e resolver um
  incidente nunca verifica nem cria um problema (research.md D-15).

### Funcionais — capacidades compartilhadas, sem conceito próprio (US4)

- **FR-016**: `ActionOriginType` DEVE ganhar `INCIDENT` e `PROBLEM` por migração aditiva revisada
  (ADR-008). Nenhuma tabela de tarefa própria de Incidente ou de Problema é criada.
  > **Adiado, 2026-09-11, na implementação da fundação — decisão do coordenador, e o que isso
  > realmente bloqueia, dito sem eufemismo.** `test/unit/action-model-convergence-guard.spec.ts` já
  > impõe, medido e não presumido, uma regra 1:1 entre todo valor de `ActionOriginType` e um
  > `ActionOriginAccessor` real de quatro métodos registrado (`resolveEditableOrigin`/
  > `resolveViewableOrigin`/`resolveOriginScope`/`listOriginIdsInScope`, o último exigindo uma
  > consulta de repositório filtrada por escopo). Construir isso sob a pressão de tempo desta mesma
  > sessão e sem cobertura de teste dedicada era exatamente o risco de "integração apressada nas
  > últimas horas" que o coordenador já havia nomeado para o vínculo Incidente↔Problema — a decisão
  > do coordenador foi aplicar o mesmo padrão aqui e adiar. `ActionOriginType` **não** foi estendido
  > nesta passagem; fica para a Fase 6 (US4), junto com o acessor que o torna real, o mesmo par que
  > toda fase anterior já entregou junto (`CONTROL_ASSESSMENT` incluso).
  >
  > **O que isto adia não é um detalhe — é uma parte substancial da razão de esta fase existir**:
  > enquanto `ActionOriginType` não ganhar `INCIDENT`/`PROBLEM` junto com o acessor,
  > **nem Incidente nem Problema podem ser dono de uma `Action` de forma alguma** —
  > `POST /actions` com `originType: INCIDENT`/`PROBLEM` não tem como resolver a origem, e US2's
  > próprio requisito de fechamento (FR-010: um problema só fecha com uma `Action` `COMPLETED` de
  > origem `PROBLEM`) não é alcançável até essa peça existir. Não é um FR isolado que ficou para
  > depois: é o pré-requisito de US2 inteira e de metade de US4. `EvidenceSubjectType` (FR-017) tem a
  > mesma regra, mas exige só um método (`resolveViewableSubject`) — esse foi construído de verdade
  > nesta passagem, então US1/US2 podem anexar evidência desde já.
  >
  > **Consequência física, já registrada em `docs/local-environment.md` D-19**: a migração desta
  > fase chegou a estender `ActionOriginType` antes de esta decisão existir, e foi aplicada — por
  > engano de variável de conexão (D-18) — tanto ao banco de teste quanto ao de desenvolvimento antes
  > de ser corrigida. `schema.prisma` e a migração já commitada não declaram mais os dois valores;
  > os dois bancos já migrados carregam um valor inerte que o Postgres não permite remover
  > (`ALTER TYPE ... DROP VALUE` não existe). Inofensivo — nenhum código escreve esse valor — mas é
  > drift real entre o que o schema declara e o que esses dois bancos especificamente contêm.
  >
  > **Resolvido, 2026-09-11, mesma noite.** `IncidentActionOriginAccessor`/
  > `ProblemActionOriginAccessor` foram construídos com os quatro métodos, testados (recusa,
  > escopo ao vivo por realocação de registro entre unidades, e o guard confirmado falhando sem o
  > registro — `test/integration/incident-problem-action-origin.spec.ts`), e `ActionOriginType`
  > ganhou `INCIDENT`/`PROBLEM` de volta numa migração **separada**
  > (`20260911030000_action_origin_type_add_incidents_problems`, `ADD VALUE IF NOT EXISTS`,
  > verificada contra `vertice_grc_test` — que já carregava os dois valores pelo acidente descrito
  > acima — aplicando sem erro). US2 fecha; `POST /actions` com `originType: INCIDENT`/`PROBLEM`
  > resolve. O bloqueio que este FR descrevia não existe mais.
- **FR-017**: `EvidenceSubjectType` DEVE ganhar `INCIDENT` e `PROBLEM` pelo mesmo mecanismo. Nenhuma
  tabela de anexo própria é criada.
- **FR-018**: `AttachableEntityType` e `CommentableEntityType` DEVEM ganhar `INCIDENT` e `PROBLEM`.
  Notificação reusa `CommentableEntityType` — nenhum registro próprio.
- **FR-019**: `EntityCodePrefix` DEVE ganhar `'INC'` e `'PRB'`, reusando `GrcCodeSequence` — nenhuma
  tabela de sequência nova.
- **FR-020**: `AuditEntityType` DEVE ganhar `INCIDENT`, `PROBLEM`, `INCIDENT_RISK_LINK`,
  `INCIDENT_ASSET_LINK`, `INCIDENT_PROCESS_LINK`, `PROBLEM_RISK_LINK` por migração aditiva revisada.

### Funcionais — autorização

- **FR-021**: DEVEM existir as permissões `incident:view`, `incident:create`, `incident:edit`,
  `incident:transition`, `incident:link`, `problem:view`, `problem:create`, `problem:edit`,
  `problem:transition`, `problem:link` — dez permissões, todas reusando valores já existentes de
  `PermissionAction` (`VIEW`, `CREATE`, `EDIT`, `TRANSITION`, `LINK`). Nenhum valor novo de
  `PermissionAction` é necessário.
- **FR-022**: Toda leitura e escrita DEVE resolver escopo organizacional pela unidade do próprio
  registro (`orgUnitId` de `Incident`/`Problem`), nunca por herança de um vínculo.

### Funcionais — interface (US5)

- **FR-023**: As telas novas DEVEM reusar os primitivos de tabela, filtro, formulário, badge de
  estado e seção de vínculo já existentes em `packages/design-system` — nenhuma implementação local
  por módulo (§18.3/§18.12).
- **FR-024**: Severidade e situação DEVEM ser comunicadas por ícone ou texto além de cor (§18.8).
- **FR-025**: As duas entradas de navegação DEVEM sair de `status: 'planned'` para
  `status: 'implemented'` em `navigation-registry.ts` na mesma tarefa que entrega a tela
  correspondente — nunca antes (repetiria a classe de defeito que F-55 nomeou para Controles/
  Compliance, na direção oposta: anunciar pronto o que não está).
- **FR-026**: Todo texto voltado ao usuário DEVE vir de `apps/api/src/shared/messages/incidents.ts`/
  `problems.ts` e `apps/web/src/lib/messages/incidents.ts`/`problems.ts` — nenhuma string nova
  embutida em componente ou DTO (§11.1).
- **FR-027**: As telas novas DEVEM passar varredura de acessibilidade automatizada (axe) nos dois
  temas, com conteúdo real renderizado — não o esqueleto (lição de F-28, já paga uma vez).

---

## Success Criteria *(mandatory)*

- **SC-001**: Um usuário consegue registrar um incidente e um problema, conduzir cada um por sua
  própria máquina de estados até o fechamento, pela interface, sem nenhuma inserção manual no banco.
- **SC-002**: Nenhum problema fecha sem uma `Action` de origem `PROBLEM` concluída e sem causa raiz
  documentada — verificável tentando fechar sem cada uma das duas condições e observando recusa.
- **SC-003**: Para os quatro pares de vínculo (Incidente↔Risco, Incidente↔Ativo, Incidente↔Processo,
  Problema↔Risco), uma tentativa contra um alvo fora do escopo do ator responde exatamente como
  contra um alvo inexistente, e nenhuma linha é gravada.
- **SC-004**: Busca estrutural automatizada confirma que nem `Incident` nem `Problem` — nem nenhuma
  tabela nova desta fase — declara campo de tarefa, de arquivo ou de aprovação em paralelo ao que
  `Action`/`Evidence`/`AttachableEntityType`/`ApprovableEntityType` já fornecem.
- **SC-005**: As suítes de Risco, Ativos, Processos e do núcleo GRC compartilhado continuam passando
  com a mesma contagem de testes de antes desta fase, exceto onde um teste precisou mudar para
  refletir esta fase — e cada teste alterado por essa razão cita o FR correspondente.
- **SC-006**: As telas novas passam varredura de acessibilidade automatizada nos dois temas, com
  conteúdo real renderizado, e são verificadas contra o portão do §18.11 olhando a aplicação
  renderizada.
- **SC-007**: `ProblemIncidentLink` existe, é N:M, e não participa de nenhuma invariante de transição
  de `Incident` ou `Problem` — verificável fechando um problema com um incidente vinculado ainda
  aberto (aceito) e resolvendo um incidente sem nenhum problema vinculado (aceito), nos dois
  sentidos (research.md D-15).

---

## Assumptions

- **A-1 — Dois módulos, não um**: `Incident` e `Problem` são domínios distintos na lista da própria
  Constituição (CLAUDE.md §1: "Gestão de Problemas... Gestão de Incidentes", nomes separados).
  Espelha exatamente a decisão D-1 de `006-assets-processes` para Ativo/Processo, pela mesma razão:
  um módulo único "de ocorrências" seria a caixa genérica que CLAUDE.md §19.3 proíbe.
- **A-2 — Severidade é campo próprio de cada domínio, não compartilhado**: `IncidentSeverity` e
  `ProblemSeverity` são dois enums distintos, com os mesmos quatro rótulos por coincidência de
  vocabulário, não por serem a mesma coisa — o mesmo padrão que `Finding` já tem `FindingSeverity`
  própria, distinta dos níveis de `Risk`. Nenhuma fase anterior compartilhou um enum de severidade
  entre domínios, e inventar o primeiro caso aqui seria abstração prematura sem consumidor que a
  peça (§19.10).
- **A-3 — `orgUnitId` obrigatório na coluna, não seguindo o precedente de `Asset`/`Process`**:
  Incidente e Problema são entidades de fluxo de trabalho (nascem, transitam, fecham), como `Risk` e
  `Finding` — não registros de referência como `Asset`/`Process`. Seguem o precedente de `Risk`
  (`orgUnitId String`, não anulável), não o de `Control`/`Asset`/`Process` (research.md D-10).
- **A-4 — Nenhuma categoria além de severidade nesta fase**: `Finding` distingue categoria, origem,
  severidade e prioridade; esta especificação não introduz um `IncidentCategory`/`ProblemCategory`
  próprio porque nenhum requisito o pede — mais um enum sem consumidor real repetiria §19.10.
  Registrado como extensão candidata, não construído.
- **A-5 — Q1-Q3 estão decididas (research.md D-13 a D-15) e não bloqueiam mais nada nesta fase**:
  eram, até a decisão do coordenador, a única parte desta especificação que dependia de uma resposta
  de produto. Com a resposta registrada, toda a fase — os dois domínios, seus ciclos de vida, os
  cinco vínculos, o consumo de Ação/Evidência, a interface — pode prosseguir a `tasks.md` sem
  nenhuma tarefa bloqueada.

---

## Checklist de qualidade

- [x] Toda contraparte de CLAUDE.md §19.2 tem linha própria nas duas tabelas de relação, com
  "não se relaciona" escrito e justificado onde é a resposta.
- [x] Nenhum mecanismo de relacionamento além dos dois de §19.3 aparece em qualquer requisito.
- [x] Nenhum estado de `IncidentStatus`/`ProblemStatus` existe sem uma transição alcançável e uma
  consequência observável (FR-002/FR-008, seguindo o padrão que T025 de `003-controls-management`
  já testou).
- [x] As três perguntas genuinamente abertas foram trazidas ao coordenador com as opções e o custo
  de cada uma antes de qualquer resposta ser fixada em requisito, modelo de dados ou contrato.
- [x] Decisão do coordenador sobre Q1-Q3 — registrada em 2026-09-11, com a razão anexada
  (research.md D-13 a D-15), dobrada em `spec.md` (relações, US3, FR-015a-c, SC-007),
  `data-model.md` §2/§4/§6 e `tasks.md` (marco desbloqueado).
