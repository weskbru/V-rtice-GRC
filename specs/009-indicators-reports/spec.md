# Feature Specification: Gestão de Indicadores e Gestão de Relatórios

**Feature Branch**: `009-indicators-reports`

**Created**: 2026-09-11

**Status**: Draft

**Input**: CLAUDE.md §17, item 14 ("Ordem seguinte, orientada por dependência arquitetural") —
Gestão de Indicadores e Gestão de Relatórios, a última fase do roteiro atual
(`docs/architecture/grc-roadmap.md` Fase 7: "Depende de: todas as anteriores. Somente leitura,
atravessando os domínios. A razão de vir por último não é prioridade, e sim que o valor depende de
existir grafo para atravessar."). Coordenador (Claude Opus): escrever o conjunto de especificação
completo — `spec.md`, `research.md`, `data-model.md`, `contracts/*.openapi.yaml`, `plan.md`,
`tasks.md` — no mesmo estilo de casa de `specs/008-incidents-problems/`, medindo cada afirmação
sobre o código contra o repositório real em vez de presumir, e decidindo (não deixando em aberto)
as perguntas de produto listadas na tarefa: o que é um Indicador, o que é um Relatório, formatos de
exportação, e quais domínios entram como fonte na v1.

**Sem implementação nesta fase.** Este diretório contém somente especificação. Nenhum arquivo fora
de `specs/009-indicators-reports/` foi tocado para produzi-lo.

---

## Contexto medido, não presumido

Este projeto já registrou causas escritas com confiança e erradas
(`specs/005-audit-findings/STATE.md` §3/§6; `specs/006-assets-processes/STATE.md` §2.4/§2.5) — cada
uma dispensou o leitor seguinte de conferir. A tabela abaixo é o que existe hoje, verificado antes
desta especificação ser escrita — nunca por leitura de outro documento de planejamento.

| Fato | Como foi verificado | Resultado |
|---|---|---|
| Nem Indicador nem Relatório têm módulo, tabela ou contrato hoje | `ls apps/api/src/modules/`; busca por `model Indicator`/`model Report` em `schema.prisma` | nenhum dos dois existe em código |
| Os nove domínios de negócio candidatos a fonte já existem, com dado real | `ls apps/api/src/modules/` + `schema.prisma` | `risk` (`model Risk`, `schema.prisma:986`), `controls` (`model Control:1451`), `compliance` (`model Framework`/`FrameworkVersion`/`Requirement:2580`), `audit-engagements` (`model AuditEngagement:2766`) + `model Finding:2396` (núcleo GRC, não `modules/`), `assets` (`model Asset:1669`), `processes` (`model Process:1647`), `grc/action` (`model Action:2285`), `modules/incidents` (`model Incident:2999`), `modules/problems` (`model Problem:3057`) — todos com `status: 'implemented'` em `apps/web/src/components/shell/navigation-registry.ts`, exceto Action (entrada `my-actions`, também `implemented`) |
| A entrada de navegação para os dois módulos desta fase já existe, planejada | `apps/web/src/components/shell/navigation-registry.ts:195-204` | `id: 'indicators'` (ícone `Gauge`) e `id: 'reports'` (ícone `FileBarChart`), ambas `status: 'planned'`, sem `requiredPermission` nem `href` ainda — dois módulos, não um, já antecipados pela própria navegação |
| Os rótulos pt-BR dos dois já estão reservados no catálogo | `apps/web/src/lib/messages/shell.ts:57-58` | `indicators: 'Indicadores'`, `reports: 'Relatórios'` |
| O Dashboard existente é hoje, na prática, só de Risco | `apps/api/src/modules/risk/application/get-dashboard.usecase.ts` inteiro | as cinco áreas (`risks`, `pendingApprovals`, `overdueActions`, `itemsRequiringReview`, `treatmentActions`) são todas gated por `risk:view`/`risk:approve`; nenhuma lê Controle, Conformidade, Auditoria, Ativo, Processo, Incidente ou Problema |
| O Dashboard já tem um mecanismo de "área planejada" — e ele está desatualizado | `apps/api/src/core/dashboard/domain/default-planned-areas.ts` | registra `PROBLEMS` e `INCIDENTS` como `PLANNED`, mas os dois são módulos reais e entregues desde `008-incidents-problems` (schema, módulo, navegação `implemented`) — o mesmo defeito que o próprio arquivo corrigiu para `CONTROLS` em 2026-09-11 ("anunciar como planejado uma capacidade já em produção"), não corrigido ainda para os outros dois. Achado durante esta pesquisa, não presumido — ver "Achados fora do escopo desta especificação", abaixo. **Correção de 2026-09-11**: esta medição valia no momento em que foi feita; o commit `cffb553`, posterior a ela, corrigiu o mecanismo — `registerDefaultPlannedAreas()` não registra nenhuma área hoje. Ver o achado 1 corrigido, abaixo |
| Nem todo domínio de negócio é hoje comentável/anexável | `schema.prisma`, `enum AttachableEntityType:426-450`, `enum CommentableEntityType:457-470` | contêm somente `RISK`, `EVIDENCE` (só anexável), `INCIDENT`, `PROBLEM`, `PROBE_RECORD` — Controle, Conformidade, Auditoria, Achado, Ativo, Processo e Ação **não** participam de nenhum dos dois hoje |
| `Requirement`/Conformidade não tem coluna de escopo organizacional | `schema.prisma:2580` (`model Requirement`), confirmado por ausência de `orgUnitId` no modelo inteiro, e por `apps/api/src/modules/compliance/application/compliance-summary/get-framework-version-compliance-summary.usecase.ts` não conter nenhuma referência a `scope`/`Scope` | o estado de conformidade é, por desenho, organização inteira — não filtrável por unidade, porque a tabela que o sustenta não tem a coluna |
| Não existe infraestrutura de agendamento/cron no backend | `apps/api/package.json`; busca por `@nestjs/schedule`, `bullmq`, `node-cron`, `@Cron(` em `apps/api/src` | nenhuma ocorrência — qualquer computação periódica automática seria uma dependência nova, não uma extensão de algo existente |
| Não existe biblioteca de exportação (CSV/PDF/XLSX) hoje | busca por `csv`, `xlsx`, `pdf`, `exceljs`, `papaparse`, `json2csv` em `apps/api/package.json`/`apps/web/package.json`/código-fonte | nenhuma ocorrência real (os únicos acertos são `magic-bytes.ts`, detecção de tipo de arquivo enviado pelo usuário, e nomes de query DTO — nada de exportação) |
| `NotificationService` existe, mas nunca foi chamado por nenhum produtor real | `apps/api/src/core/notifications/application/notification.service.ts:1-9`; `docs/history/grc-domain-blueprint.md:59` ("Notificações \| infraestrutura pronta, sem produtor") | capacidade construída, zero chamadores em `modules/**`/`grc/**` |
| Existe hoje exatamente um calculador de estado derivado por conceito, nunca dois | `apps/api/src/modules/risk/domain/risk-scoring.service.ts:1-6` (nível de risco); `apps/api/src/modules/compliance/domain/requirement-compliance.service.ts:1-10` (estado de conformidade); `apps/api/src/grc/shared/domain/overdue.service.ts:1-9` (`isActionOverdue`, atraso de Ação através de toda origem) | três precedentes diretos de CLAUDE.md §19.7, um por domínio, todos funções puras sem I/O |
| Nenhum papel semeado tem qualquer permissão `incident:*`/`problem:*` | `grep -rn "incident:\|problem:" apps/api/prisma/seed/*.ts` | zero ocorrências — achado fora do escopo desta especificação, ver abaixo. **Correção de 2026-09-11**: esta medição valia no momento em que foi feita; o commit `18e9351`, posterior a ela, concedeu `incident:view`/`problem:view` aos papéis de leitura e o conjunto completo aos papéis "Incident Manager"/"Problem Manager". Ver o achado 3 corrigido, abaixo |

---

## Achados fora do escopo desta especificação

Registrados aqui porque o processo pede ("três defeitos deste projeto já foram achados exatamente
assim, lendo código adjacente por outra razão") — nenhum é corrigido por este documento, que é
somente especificação, e nenhum bloqueia esta fase.

**Correção de 2026-09-11 — os quatro achados abaixo já estão corrigidos.** Este `spec.md` foi escrito
antes de uma sequência de commits que fechou exatamente os quatro achados registrados nesta seção. O
repositório foi recuperado do GitHub numa sessão nova (working tree local anterior perdida), e cada
achado foi reverificado por leitura direta do código e por `grep`, não por confiança no texto abaixo.
Nenhum foi corrigido por este documento nem por esta fase — todos foram corrigidos antes dela, por
commits de `008-incidents-problems`/`007-implementation-remediation`. Consequência direta: a T064 de
`tasks.md` (que pede o mesmo trabalho do achado 1) está obsoleta antes de começar — ver a marca nesse
arquivo. A descrição original de cada achado permanece abaixo, íntegra, com a marca de correção no
próprio item.

1. **`default-planned-areas.ts` desatualizado** — **CORRIGIDO pelo commit `cffb553`, verificado em
   2026-09-11.** `registerDefaultPlannedAreas()` não registra área nenhuma hoje; o próprio comentário
   do arquivo explica por quê. Descrição original, preservada: (`apps/api/src/core/dashboard/domain/
   default-planned-areas.ts`): registra `PROBLEMS`/`INCIDENTS` como área planejada do dashboard
   embora os dois módulos estejam entregues. É a mesma classe de defeito que o próprio arquivo
   corrigiu para `CONTROLS`, com o comentário do commit explicando a razão ("anunciar como
   planejado uma capacidade já em produção") — a correção nunca foi estendida aos outros dois. Esta
   especificação propõe, em `plan.md`/`tasks.md`, retirar completamente o mecanismo de área
   planejada como parte desta fase (ver "Relação com o Dashboard", abaixo) — não como correção
   avulsa, mas como conclusão do próprio ciclo de vida que o comentário original do arquivo já
   previa ("a partir do momento em que um módulo planejado ganha dado real, ele contribui seu
   próprio cartão, ou o mecanismo que substitui o placeholder"). **Nota**: como o achado já estava
   corrigido antes desta fase começar, a proposta de "retirar completamente o mecanismo... como parte
   desta fase" também já está satisfeita — sem trabalho desta fase ter sido necessário. FR-038,
   abaixo, e T064 de `tasks.md` continuam descrevendo essa proposta tal como escritas; T064 foi
   marcada obsoleta em `tasks.md` para não ser executada como se ainda estivesse pendente.
2. **`shared/messages/dashboard.ts`** — **CORRIGIDO pelo mesmo commit `cffb553`, verificado em
   2026-09-11.** `plannedAreaLabels` é hoje `{}`. Descrição original, preservada: ainda declara
   `plannedAreaLabels.CONTROLS` (`'Gestão de
   Controles'`) mesmo depois de `CONTROLS` ter sido removido do registro de áreas planejadas — uma
   constante órfã, inofensiva, mas mais um sinal do mesmo mecanismo não ter sido totalmente
   limpo.
3. **Nenhum papel semeado concede qualquer permissão de Incidente ou Problema.** — **CORRIGIDO pelo
   commit `18e9351`, verificado em 2026-09-11.** `apps/api/prisma/seed/platform.seed.ts` concede
   `incident:view`/`problem:view` a papéis de leitura (linhas ~406-407 e ~439-440) e o conjunto
   completo aos papéis "Incident Manager" (linhas ~513-517) e "Problem Manager" (linhas ~569-573).
   Descrição original, preservada:
   `apps/api/prisma/seed/platform.seed.ts` não contém `incident:view`, `incident:create`,
   `problem:view`, nem nenhuma das outras oito permissões que `008-incidents-problems/spec.md`
   FR-021 define. O papel "Read Only" também não as tem — nem `control:view`, `compliance:view`,
   `audit-engagement:view`, `asset:view` (ok, este está presente), `process:view` (presente). Na
   prática, **nenhum usuário semeado hoje consegue abrir as telas de Incidentes ou de Problemas**,
   apesar de as duas existirem e estarem marcadas `status: 'implemented'` na navegação. É a mesma
   forma do defeito que `specs/005-audit-findings/STATE.md` §5 registrou para o papel "Audit Lead"
   (escreve mas não lê) — aqui é mais grave: nenhum papel tem sequer a leitura.
4. **`tasks.md` de `008-incidents-problems` não reflete o estado real do código.** — **CORRIGIDO pelo
   commit `424d312`, verificado em 2026-09-11.** `tasks.md` de `008` está hoje com 59 de 79 tarefas
   marcadas `[x]` (as 20 restantes `[ ]` com razão registrada em cada uma), e existe
   `specs/008-incidents-problems/STATE.md`. Descrição original, preservada, valia na data em que foi
   medida: 78 das 79
   tarefas seguem `[ ]` (não marcadas), incluindo tarefas de fundação cujo resultado (schema,
   módulos, contratos, navegação `implemented`) já existe e está commitado
   (`git log --oneline -- apps/api/src/modules/incidents apps/api/src/modules/problems` mostra
   cinco commits `feat(incidents,problems): ...`). Não há `STATE.md` para `008` ainda. Esta
   especificação trata o **código**, não `tasks.md`, como a fonte de verdade sobre o que está
   implementado — a mesma disciplina que `specs/005-audit-findings/STATE.md` §3/§6 exige.

---

## Relação com o Dashboard existente (obrigatório pelo enunciado desta tarefa)

**Indicadores generaliza o mecanismo de agregação do Dashboard; não o substitui, e retira o
placeholder que ele deixou obsoleto.**

**Correção de 2026-09-11**: a retirada do placeholder está descrita abaixo, na "Decisão", como
entrega desta fase. O commit `cffb553`, anterior ao início desta fase, já entregou essa retirada —
ver o achado 1 corrigido em "Achados fora do escopo desta especificação", acima, e FR-038, abaixo,
também marcado. O raciocínio abaixo sobre por que retirar o mecanismo (em vez de expandir o
contrato do Dashboard a cada módulo novo) permanece válido e não foi reescrito; a marca está
apenas nos pontos que tratavam essa retirada como trabalho ainda pendente desta fase.

Evidência lida antes de decidir:

- `GetDashboardUseCase` (`apps/api/src/modules/risk/application/get-dashboard.usecase.ts`) já prova
  o padrão que esta fase generaliza: resolve escopo uma vez (`ScopeResolverService.resolveScope`),
  filtra cada área por permissão (`risk:view`/`risk:approve`), e devolve números **sempre
  computados na hora**, nunca armazenados — nenhuma tabela de "resultado de dashboard" existe.
  `DashboardQueryService` (`apps/api/src/modules/risk/infrastructure/dashboard-query.service.ts`)
  agrega **no banco** (`COUNT(*) FILTER`), nunca busca linhas para contar em TypeScript, com um
  fragmento de escopo parametrizado (`org_unit_id = ANY(...)`) — o padrão que toda leitura
  agregada desta fase segue (research.md D-3).
- O Dashboard hoje é **estruturalmente de um domínio só**: as cinco áreas do contrato
  (`risks`, `pendingApprovals`, `overdueActions`, `itemsRequiringReview`, `treatmentActions`) são
  todas gated por `risk:view`. Não há área de Controle, Conformidade, Auditoria, Ativo, Processo,
  Incidente ou Problema — nem estrutura para adicionar uma sem crescer o contrato do Dashboard a
  cada novo domínio.
- `core/dashboard/domain/planned-area-registry.ts` já é, por desenho, um registro fechado que
  qualquer módulo popula a partir de sua própria raiz de composição — e o próprio comentário do
  arquivo já prevê o fim do seu ciclo de vida: "a partir do momento em que um módulo planejado
  ganha dado real, [...] contribui seu próprio cartão, ou o mecanismo que substitui o placeholder".

**Decisão**: esta fase não expande o contrato de `GET /dashboard` com uma sexta, sétima, oitava
área — isso o tornaria uma segunda implementação de Indicadores, dentro de Indicadores, com um
contrato que cresce a cada módulo futuro (o problema exato que motivou o registro de área
planejada existir, e que `default-planned-areas.ts` já documenta como history). Em vez disso:

1. `Indicator` reaproveita as mesmas primitivas de agregação (`ScopeFilter`, agregação no banco,
   escopo como predicado obrigatório) para servir uma coleção **nomeada e navegável** de métricas
   por domínio, sob seu próprio módulo (`modules/indicators`) e sua própria tela — não mais uma
   lista fixa de cinco tiles.
2. O mecanismo de área planejada é **desativado nesta fase**, e não substituído por um sexto/sétimo
   registrante: uma vez que `PROBLEMS`/`INCIDENTS` também sejam retirados (FR-038, corrigindo o
   Achado 1 acima) e `CONTROLS` já tenha saído, `getPlannedAreas()` devolve sempre `[]`. O contrato
   mantém o campo `plannedAreas` (não é uma mudança de contrato que quebra o cliente — um array
   vazio é uma resposta válida do mesmo shape), mas nenhum módulo GRC de negócio se registra nele
   nunca mais: a divulgação de "módulo ainda não construído" passa a ser tarefa da própria
   navegação (`status: 'planned'` em `navigation-registry.ts`, que já existe e já é a fonte de
   verdade que a interface usa para desenhar a barra lateral), não do payload do Dashboard.
   **Correção de 2026-09-11**: "desativado nesta fase" e "uma vez que ... também sejam retirados"
   descreviam a retirada como um passo desta fase. O commit `cffb553` já desativou o mecanismo por
   completo antes de esta fase começar — `getPlannedAreas()` já devolve `[]` hoje, sem depender de
   FR-038 ser executado por esta fase. O restante do ponto — o contrato mantém `plannedAreas`, e a
   navegação assume sozinha o papel de anunciar módulo futuro — continua descrevendo o estado atual
   corretamente.
3. `GET /dashboard` continua existindo, sem mudança de contrato além da lista de áreas planejadas
   ficar vazia — ele é a "visão geral" de Risco que já é hoje; `Indicators`/`Reports` é a segunda,
   mais ampla, tela para quem quer atravessar domínios.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consultar o valor atual de um indicador, dentro do próprio escopo (Priority: P1)

Um gestor abre a tela de Indicadores e vê, para cada métrica publicada pela plataforma (total de
riscos por nível, ações em atraso, achados abertos, incidentes abertos por severidade,
percentual de conformidade, e outras), o valor calculado agora, restrito ao que sua unidade
organizacional autoriza — exatamente como o Dashboard já faz para Risco, generalizado aos outros
oito domínios já implementados.

**Why this priority**: sem um valor atual, correto e escopado corretamente, nenhuma das
capacidades seguintes (histórico, limiar, relatório) tem o que exibir. É o núcleo da fase.

**Independent Test**: como um usuário com `indicator:view` restrito a uma unidade, consultar
`GET /indicators/{key}/current` para uma métrica de Risco e confirmar que o número bate com uma
contagem manual filtrada pela mesma unidade; repetir como um usuário de escopo global e confirmar
um número maior ou igual.

**Acceptance Scenarios**:

1. **Given** um usuário com `indicator:view` e `risk:view`, **When** consulta o valor atual do
   indicador `RISK_TOTAL_BY_LEVEL`, **Then** recebe a mesma contagem, por nível, que
   `RiskProfileRecord` já calcula para o Dashboard (`DashboardQueryPort.getRiskProfile`) — nenhuma
   segunda regra de contagem.
2. **Given** o mesmo usuário, mas sem `risk:view`, **When** consulta o mesmo indicador, **Then** a
   operação é recusada com `403` — um indicador cuja fonte o usuário não pode ver não aparece
   zerado nem parcialmente, ele simplesmente não é servido (diferente do Dashboard, que zera a área
   em vez de recusar; aqui a operação é por indicador individual, então a resposta é o `403`
   padrão do restante da API, FR-006).
3. **Given** um usuário cujo escopo organizacional é uma única unidade, **When** consulta
   `INCIDENT_OPEN_COUNT_BY_SEVERITY`, **Then** o número reflete somente incidentes cujo
   `orgUnitId` está dentro do escopo resolvido — nunca a contagem organização inteira.
4. **Given** um usuário com `compliance:view`, **When** consulta `COMPLIANCE_PERCENTAGE` para uma
   versão de framework publicada, **Then** o número é o mesmo que
   `GetFrameworkVersionComplianceSummaryUseCase` já calcula, e **não** varia por unidade
   organizacional — porque `Requirement` não tem essa coluna (Contexto medido, linha 7). A resposta
   do indicador documenta essa característica em vez de fingir um escopo que a fonte não tem
   (FR-009).
5. **Given** uma chave de indicador que não existe no catálogo fechado, **When** consultada,
   **Then** a operação responde `404` — o catálogo de métricas é um registro fechado
   (`IndicatorMetricKey`), nunca uma string livre aceita do cliente (research.md D-4).

---

### User Story 2 — Acompanhar a tendência organização inteira de um indicador ao longo do tempo (Priority: P1)

Um gestor com visão de toda a organização quer saber se o total de riscos altos está subindo ou
descendo nos últimos meses, não só o número de agora. Ele consulta o histórico de um indicador e
vê uma série de pontos, cada um imutável, gravado no momento em que alguém com visão da organização
inteira pediu explicitamente que aquele ponto fosse registrado.

**Why this priority**: é a segunda pergunta que a tarefa pede para decidir explicitamente ("tem
histórico? o que torna um ponto imutável?") e o valor que distingue um Indicador de uma simples
extensão do Dashboard (que nunca guarda nada). P1 porque, sem isso, a palavra "histórico" na visão
do produto (CLAUDE.md §9, "o modelo deve permitir avaliações históricas") não tem equivalente para
Indicadores.

**Independent Test**: com um usuário de escopo global, registrar dois pontos de medição do mesmo
indicador em momentos diferentes; confirmar que o histórico lista os dois, em ordem, e que nenhuma
operação da API permite editar ou apagar um ponto já gravado.

**Acceptance Scenarios**:

1. **Given** um usuário com `indicator:edit` **e** escopo resolvido `GLOBAL` (research.md D-6),
   **When** aciona `POST /indicators/{key}/measurements`, **Then** um novo `IndicatorMeasurement`
   é gravado com o valor calculado nesse instante pelo mesmo `IndicatorCalculationService` que
   serve US1, o autor, e o instante — sem nenhum campo aceito do corpo da requisição além da
   identificação do indicador (o valor nunca é digitado, sempre calculado, FR-011).
2. **Given** o mesmo usuário, mas com escopo resolvido `UNIT` (não `GLOBAL`), **When** tenta a
   mesma operação, **Then** é recusado com `403` — histórico é sempre organização inteira
   (research.md D-6), nunca um recorte por unidade, para não fragmentar a série em uma tendência
   por espectador (US2, cenário 5).
3. **Given** dois pontos já gravados para o mesmo indicador, **When** consultados por
   `GET /indicators/{key}/measurements`, **Then** vêm em ordem cronológica, cada um com seu próprio
   `id`, `computedAt` e `computedByUserId` — nenhuma operação de atualização ou remoção existe para
   este recurso (mesmo padrão de imutabilidade que `RiskAssessment` já estabelece para avaliação
   histórica de risco, CLAUDE.md §9).
4. **Given** um usuário com escopo `UNIT`, **When** consulta o histórico do mesmo indicador,
   **Then** recebe `403` — só quem pode ver a organização inteira vê uma série que representa a
   organização inteira (mesma regra do cenário 2, aplicada à leitura).
5. **Given** dois pontos de medição do mesmo indicador em datas diferentes, **Then** cada um
   preserva o valor que tinha no momento em que foi calculado, mesmo que o dado subjacente (por
   exemplo, o total de riscos) tenha mudado depois — o mesmo princípio de imutabilidade histórica
   que `RiskAssessment` já aplica à reavaliação de um risco.

---

### User Story 3 — Ser avisado quando um indicador rompe o limiar configurado (Priority: P1)

Um responsável configura um limiar-alvo para um indicador (por exemplo, "total de riscos críticos
não deve passar de 5"). Quando um ponto de medição registrado rompe esse limiar, o responsável
recebe uma notificação — usando a capacidade de notificação que a plataforma já tem pronta, mas
que hoje não tem nenhum produtor real.

**Why this priority**: é a terceira pergunta que a tarefa pede para decidir explicitamente. P1
porque, sem consequência nenhuma, um limiar configurável é um campo de formulário sem efeito — o
tipo de "ponto de extensão que nunca foi exercitado" que CLAUDE.md §19.10 proíbe contar como
capacidade.

**Independent Test**: configurar um indicador com limiar `>= 5`; registrar um ponto de medição cujo
valor calculado é `7`; confirmar que uma notificação aparece para o responsável do indicador via
`GET /notifications` (a tela "Minhas notificações" já existente) e que nenhuma notificação é
criada quando o valor calculado é `3`.

**Acceptance Scenarios**:

1. **Given** um `IndicatorDefinition` com `thresholdComparator: GTE` e `thresholdValue: 5`,
   **When** um ponto de medição calcula `7`, **Then** `NotificationService.notify` é chamado uma
   vez, endereçado ao `ownerUserId` do indicador, com `entityType: CommentableEntityType.RISK`... —
   não: com o tipo fechado que esta fase registra para Indicador (FR-018) — e o corpo nomeia o
   indicador e o valor.
2. **Given** o mesmo `IndicatorDefinition`, **When** um ponto de medição calcula `3`, **Then**
   nenhuma notificação é criada.
3. **Given** um `IndicatorDefinition` sem limiar configurado (`thresholdComparator`/`thresholdValue`
   nulos), **When** um ponto de medição é registrado, **Then** nenhuma verificação de limiar é
   sequer avaliada — limiar é opcional, e sua ausência nunca produz um falso rompimento.
4. **Given** um limiar rompido, **Then** nenhuma `Action` é criada automaticamente — a notificação é
   o único efeito automático (research.md D-7); um responsável que decidir que o rompimento exige
   trabalho corretivo cria a `Action` manualmente (US4), exatamente como toda outra origem de
   `Action` já funciona nesta plataforma.

---

### User Story 4 — Criar uma ação corretiva a partir de um indicador, sem inventar conceito próprio de tarefa (Priority: P2)

Um responsável que vê um indicador rompido decide que aquilo exige trabalho de correção. Ele cria
uma `Action` referenciando o indicador como origem — usando o mecanismo que a plataforma já tem
para isso, não um campo de acompanhamento próprio do módulo de Indicadores.

**Why this priority**: é a exigência de reuso do §19.4/§19.6 aplicada a esta fase, e a razão pela
qual o roteiro deixou Indicadores por último — "o valor depende de existir grafo para atravessar",
e o grafo inclui `Action` como o mecanismo universal de trabalho corretivo. P2 porque depende de
US1-US3 já existirem para ter o que referenciar, e porque nenhuma US anterior fica bloqueada sem
ela — é aditiva.

**Independent Test**: a partir de um indicador com um ponto de medição rompido, criar uma `Action`
por `POST /actions` com `originType: INDICATOR` e `originId` igual ao id do indicador; confirmar
que ela aparece em "Minhas ações" (a tela já existente) e obedece à mesma tabela de transição de
estado que toda outra `Action`.

**Acceptance Scenarios**:

1. **Given** um `IndicatorDefinition` existente, **When** um usuário com `action:create` cria uma
   `Action` com `originType: INDICATOR`, `originId` igual ao indicador, **Then** ela existe em
   `grc/action`, aparece em "Minhas ações", e sua transição de estado obedece à mesma tabela de
   legalidade de toda outra `Action` — nenhuma regra de transição própria de Indicador.
2. **Given** os dois módulos, **Then** nenhum deles declara uma tabela própria de tarefa, arquivo
   ou aprovação — verificável por busca estrutural sobre o schema (SC-005, mesmo padrão de SC-004
   de `008-incidents-problems`).

---

### User Story 5 — Compor e executar um relatório que atravessa domínios (Priority: P1)

Um usuário de conformidade quer uma única tela que mostre, lado a lado, o percentual de
conformidade por framework, o total de achados abertos por severidade, e o total de riscos por
nível — dentro do seu próprio escopo — sem ter de abrir cinco telas separadas e sem que a
plataforma construa um motor de consulta genérico para isso.

**Why this priority**: é a segunda metade da fase, e a resposta à pergunta "o que é um Relatório"
que a tarefa pede para decidir. P1 porque, sem ela, a palavra "Relatórios" do título da fase não
tem nenhuma capacidade correspondente — só Indicadores existiria.

**Independent Test**: criar uma definição de relatório referenciando três indicadores de domínios
diferentes; executá-la (`GET /reports/{id}/run`) e confirmar que a resposta traz os três valores,
cada um respeitando o escopo do chamador e a característica de escopo de sua própria fonte
(unidade para Risco/Achado, organização inteira para Conformidade).

**Acceptance Scenarios**:

1. **Given** um usuário com `report:create`, **When** cria uma `ReportDefinition` referenciando uma
   lista de `IndicatorMetricKey`, **Then** ela é salva com um `id` e um `code` gerado
   (`RPT-2026-0001`, reusando o alocador compartilhado — research.md D-9).
2. **Given** essa definição, **When** um usuário com `report:view` executa
   `GET /reports/{id}/run`, **Then** a resposta traz o valor atual de cada indicador referenciado,
   cada um computado sob o escopo do chamador exatamente como em US1 — nunca um valor
   pré-calculado e armazenado (research.md D-2, mesma regra de CLAUDE.md §19.7 aplicada à
   composição).
3. **Given** um indicador referenciado por uma `ReportDefinition` cuja fonte o chamador não pode
   ver (falta de permissão), **When** o relatório é executado, **Then** aquele indicador aparece na
   resposta marcado como não disponível para o chamador (`available: false`), e os demais
   indicadores da mesma execução continuam presentes — a indisponibilidade de um não derruba o
   relatório inteiro.
4. **Given** uma `ReportDefinition` executada, **When** o usuário pede a exportação,
   **Then** recebe um arquivo `text/csv` com uma linha por indicador executado e suas colunas
   (chave, rótulo, valor, unidade/nível quando aplicável, indisponível/disponível) — nenhum outro
   formato existe nesta fase (FR-030, decisão explícita).
5. **Given** dois usuários com escopos organizacionais diferentes, **When** executam o mesmo
   relatório, **Then** cada um recebe os valores computados sob o **próprio** escopo — a definição
   do relatório é compartilhada (como um `Framework`), a execução nunca é.

---

### User Story 6 — Interface consistente com os módulos existentes (Priority: P2)

Um usuário abre as telas de Indicadores e de Relatórios e reconhece o mesmo produto: mesma
hierarquia visual, mesmos padrões de tabela, cartão de métrica e badge de nível que Riscos,
Controles, Achados, Incidentes e Problemas já estabeleceram.

**Why this priority**: P2 porque depende de US1-US5 existirem primeiro para ter o que renderizar,
mas é obrigatória por CLAUDE.md §18 antes de a fase ser considerada concluída — não é polimento
final opcional.

**Independent Test**: capturar as telas novas nos dois temas (claro/escuro) com
`apps/web/scripts/ui-capture.mjs`, varrer com axe, e responder ao portão do §18.11 olhando a
aplicação renderizada, não o código.

**Acceptance Scenarios**:

1. **Given** a tela de Indicadores, **Then** reusa os cartões de métrica e badges de nível de risco
   já existentes (`packages/design-system`, o mesmo componente que o Dashboard já usa para
   `byResidualLevel`) — nenhuma implementação visual local de "cartão de número".
2. **Given** a tela de Relatórios, **Then** reusa os primitivos de tabela, filtro e paginação já
   usados por Riscos/Controles/Achados/Incidentes/Problemas.
3. **Given** qualquer indicador de nível/severidade exibido, **Then** nenhum comunica seu
   significado só por cor — ícone ou texto sempre acompanha (§18.8).
4. **Given** as duas entradas de navegação já existentes (`id: 'indicators'`, `id: 'reports'`, hoje
   `status: 'planned'`), **Then** ganham `requiredPermission` e `href` e passam a
   `status: 'implemented'` na mesma tarefa que entrega a tela correspondente — nunca antes.
5. **Given** as telas novas, **Then** funcionam em teclado, têm nome acessível, e passam a
   varredura de acessibilidade automatizada nos dois temas, com conteúdo real renderizado — não o
   esqueleto (lição de F-28, já paga uma vez).
6. **Given** o texto voltado ao usuário em qualquer uma das telas novas, **Then** vem
   exclusivamente dos catálogos centralizados pt-BR (`apps/api/src/shared/messages/`,
   `apps/web/src/lib/messages/`) — nenhuma string nova embutida em componente.

---

### Edge Cases

- **Um indicador cuja fonte não tem nenhum dado ainda** (por exemplo, `COMPLIANCE_PERCENTAGE` antes
  de qualquer `FrameworkVersion` publicada): o valor atual é `null`/indisponível, nunca `0` (que
  afirmaria conformidade zero) nem `100` — o mesmo cuidado que
  `get-framework-version-compliance-summary.usecase.ts` já documenta para
  `compliancePercentage` ("`null`, quando esse denominador é zero").
- **Um ponto de medição histórico cujo dado subjacente foi apagado depois** (por exemplo, um
  `Risk` arquivado após a medição): o ponto de medição permanece — ele é uma fotografia imutável de
  um momento, não uma consulta viva. Nenhuma operação de recomputar-no-lugar existe.
- **Um relatório referenciando um indicador que deixou de existir** (cenário hipotético — o
  catálogo é fechado e não permite exclusão de chave em uso; nenhuma migração desta fase remove uma
  chave já publicada): fora do escopo — o catálogo cresce apenas por adição (ADR-008), nunca por
  remoção, então este caso é estruturalmente impossível na v1.
- **Dois usuários de unidades diferentes comparando o "mesmo" indicador de Conformidade**: veem o
  mesmo número — Conformidade não tem coluna de escopo (Contexto medido, linha 7), então o valor é
  sempre organização inteira, para todo mundo com `compliance:view`, independentemente do próprio
  escopo de Risco/Incidente do usuário. Isto é documentado, nunca escondido, na resposta do
  indicador (FR-009).
- **Um usuário com escopo `GLOBAL` que nunca teve essa concessão revogada, mas cuja unidade
  primária mudou**: como em todo outro domínio já existente, o escopo é resolvido a cada chamada
  (`ScopeResolverService.resolveScope`, chamado de novo a cada requisição) — nunca herdado do
  momento da concessão.

---

## Relações declaradas (obrigatório por CLAUDE.md §19.2)

"Não se relaciona" é resposta válida, mas precisa ser escrita — nunca resultar de esquecimento.
Indicador e Relatório têm o mesmo padrão de relação com quase toda contraparte (leitura, nunca
vínculo de posse), então uma tabela cobre os dois, com a única divergência anotada.

| Contraparte | Relação | Mecanismo | Justificativa |
|---|---|---|---|
| Unidade Organizacional | **Indireta** — nunca coluna própria em `IndicatorDefinition`/`ReportDefinition` | `ScopeFilter` resolvido do chamador, aplicado à consulta de cada fonte, na própria coluna de escopo daquela fonte (Risco, Ativo, Processo, Controle, Ação, Incidente, Problema, Achado); Conformidade não tem coluna, e o indicador documenta isso (research.md D-8) | um Indicador é uma **definição compartilhada** (como `Framework`), não um registro por unidade; a execução, sim, é escopada — ver US1/US5 |
| Risco | **Sim** — leitura agregada | nenhuma tabela nova; `IndicatorMetricKey` lê `RiskQueryPort`/`DashboardQueryPort` já existentes | fonte de métrica, US1 |
| Controle | **Sim** — leitura agregada | idem, via consulta própria do módulo de Controles | fonte de métrica |
| Conformidade | **Sim** — leitura agregada, sem escopo por unidade | idem, via `RequirementComplianceReaderService`/resumo já existente | fonte de métrica; única sem coluna de escopo (research.md D-8) |
| Auditoria (engajamento) | **Sim** — leitura agregada | idem, via consulta própria do módulo | fonte de métrica |
| Achado | **Sim** — leitura agregada | idem, via consulta própria do núcleo GRC (`grc/finding`) | fonte de métrica |
| Ativo | **Sim** — leitura agregada | idem, via consulta própria do módulo de Ativos | fonte de métrica |
| Processo | **Sim** — leitura agregada | idem, via consulta própria do módulo de Processos | fonte de métrica |
| Incidente | **Sim** — leitura agregada | idem, via consulta própria do módulo de Incidentes | fonte de métrica |
| Problema | **Sim** — leitura agregada | idem, via consulta própria do módulo de Problemas | fonte de métrica |
| Ação | **Sim**, dos dois jeitos | (a) fonte de métrica (`OVERDUE_ACTIONS_COUNT`, via `isActionOverdue`); (b) **destino** — `ActionOriginType += INDICATOR`, registro de tipo fechado | US1 (fonte) e US4 (destino) |
| Evidência | **Não** | — | um indicador é calculado, não comprovado por anexo; nenhum requisito pede evidenciar um número calculado |
| Notificação | **Sim** — produtor | `NotificationService.notify` já existente, primeiro produtor real (research.md D-7) | US3 |
| Trilha de auditoria | **Sim** | capacidade transversal | criação/edição de definição e cada ponto de medição gravado são eventos auditados (FR-013/FR-024) |
| Comentários/Anexos brutos | **Não, nesta fase** | — | `CommentableEntityType`/`AttachableEntityType` hoje cobrem só `RISK`/`INCIDENT`/`PROBLEM` (+`EVIDENCE` para anexo) — nem Controle, Conformidade, Auditoria, Achado, Ativo, Processo ou Ação têm essa capacidade ainda; estender o registro fechado por um quinto/sexto participante sem nenhum requisito que o peça repetiria §19.10 |
| Aprovação | **Não** | — | nenhum requisito pede sign-off na criação de um indicador ou relatório; `ApprovableEntityType` continua `RISK`/`CONTROL_ASSESSMENT` |

### Indicador → Relatório

`ReportDefinition` referencia N `IndicatorMetricKey` (nunca o inverso) — um relatório é uma
composição nomeada de indicadores já existentes, nunca uma segunda definição de métrica. Este não é
um dos dois mecanismos de §19.3 (não é entre domínios GRC, é entre uma definição e o catálogo
fechado que ela consome) — é simplesmente uma coluna de array de chaves validada contra o registro
fechado, o mesmo tipo de validação que `IndicatorDefinition.thresholdComparator` já usa contra um
enum.

---

## Decisões do coordenador (perguntas de escopo desta tarefa)

**Autoridade**: as sete decisões abaixo foram tomadas pelo agente de implementação desta fase
(Sonnet), sob a mesma autoridade e o mesmo dever de registro que
`008-incidents-problems/spec.md` já atribuiu às suas próprias decisões de coordenador — decisões
desta fase de especificação, não decisões históricas do usuário do produto. Ver research.md D-1 a
D-13 para a justificativa completa de cada uma, com citação de arquivo e linha.

### Q1 — O que é um Indicador

**Decidido**: os dois — uma definição salva (`IndicatorDefinition`, metadado editável: nome,
métrica-fonte, limiar) e um valor computado (nunca ambos misturados no mesmo registro). O valor
"atual" nunca é armazenado (é sempre recalculado, por escopo do chamador, no mesmo padrão do
Dashboard). O histórico é armazenado, mas só na granularidade organização inteira, e só como
consequência de uma ação explícita de um usuário com escopo `GLOBAL` — nunca automático (não há
agendador nesta plataforma, e introduzir um seria dependência nova sem justificativa aprovada, ver
Q4). Ver research.md D-1, D-2, D-6.

### Q2 — Tem histórico? O que torna um ponto imutável?

**Decidido**: sim, `IndicatorMeasurement` — append-only, sem operação de atualização ou remoção no
contrato. Imutabilidade é estrutural (nenhum verbo HTTP que edite existe), o mesmo mecanismo que já
torna `RiskAssessment` imutável. Ver research.md D-2.

### Q3 — Limiar/alvo existe? Rompê-lo produz o quê?

**Decidido**: sim, limiar opcional por indicador. Rompê-lo produz uma notificação (primeiro
produtor real de `NotificationService`, capacidade "pronta, sem produtor" desde o blueprint —
`docs/history/grc-domain-blueprint.md:59`). **Não** cria uma `Action` automaticamente — isso
seria automação não pedida por nenhum requisito (CLAUDE.md §2). Uma `Action` de origem `INDICATOR`
existe, mas sempre por decisão manual de um usuário (US4). Ver research.md D-7.

### Q4 — O que é um Relatório? O que entra na v1?

**Decidido**: uma composição nomeada e salva de indicadores já existentes (`ReportDefinition`),
executada sob demanda, sob o escopo de quem executa. **Não** é: um construtor de consulta genérico
(proibido por §19.3 se abrisse a porta a filtro arbitrário sobre qualquer tabela), um documento
gerado (PDF), nem uma exportação agendada (exigiria um agendador que não existe — Q_export). Ver
research.md D-1, D-9.

### Q5 — Formatos de exportação

**Decidido**: CSV apenas, gerado por código próprio (sem biblioteca nova — nenhuma existe hoje no
projeto para isso, e CSV não exige uma: é texto delimitado). PDF/XLSX ficam de fora, registrados
como extensão candidata: exigiriam uma dependência nova (um gerador de PDF, uma biblioteca de
planilha) que CLAUDE.md §2 pede para justificar, e nenhum requisito desta fase justifica o custo
ainda. Ver research.md D-10.

### Q6 — Quais domínios entram como fonte na v1

**Decidido**: os nove domínios de negócio hoje implementados — Risco, Controle, Conformidade,
Auditoria (engajamento + Achado), Ativo, Processo, Ação, Incidente, Problema — todos verificados
como existentes em código antes desta especificação ser escrita (Contexto medido, acima). Nenhum
domínio "planejado mas não construído" (Planos de Ação não é módulo, CLAUDE.md §17) entra como
fonte. Ver research.md D-3.

### Q7 — Relação com o Dashboard existente

**Decidido**: Indicadores generaliza o mecanismo de agregação do Dashboard e absorve o papel do seu
registro de "área planejada" (que se torna permanentemente vazio, nunca removido do contrato, só
esvaziado — ver seção "Relação com o Dashboard", acima). O Dashboard em si **não** é substituído:
continua sendo a tela de Risco "de relance" que já é. Ver research.md D-11, D-12.

---

## Requirements *(mandatory)*

### Funcionais — definição de indicador (US1)

- **FR-001**: DEVE existir `IndicatorDefinition` (`modules/indicators`) com `id`, `code`
  (`IND-AAAA-NNNN`, reusando `GrcCodeSequence`, research.md D-9), `metricKey`
  (`IndicatorMetricKey`, registro fechado — FR-002, **único** — no máximo uma definição por chave,
  data-model.md §1), `name`, `description`, `ownerUserId`, `thresholdComparator`
  (`GTE | GT | LTE | LT`, anulável), `thresholdValue` (numérico, anulável — os dois campos de
  limiar são preenchidos juntos ou nenhum, nunca um só), `createdAt`, `updatedAt`. Uma chave do
  catálogo (FR-002) sem `IndicatorDefinition` continua consultável por US1 — a definição é
  configuração opcional (nome, responsável, limiar), nunca um pré-requisito para ver o valor
  calculado.
- **FR-002**: `IndicatorMetricKey` DEVE ser um registro fechado (enum verificado em compilação),
  cobrindo ao menos uma métrica por domínio listado em Q6, cada uma implementada por reuso de um
  serviço/porta de consulta já existente daquele domínio (research.md D-4) — nunca uma consulta
  genérica parametrizável pelo cliente. O catálogo inicial da v1 está em `data-model.md` §3.
- **FR-003**: Criar/editar um `IndicatorDefinition` DEVE exigir `indicator:create`/`indicator:edit`.
  Não existe operação de exclusão — um indicador que deixa de ser relevante é desativado
  (`isActive: false`), nunca apagado, o mesmo padrão que `Asset`/`Process`/`Control` já seguem para
  registro de referência.
- **FR-004**: `IndicatorDefinition` **não** tem coluna de unidade organizacional própria — é uma
  definição compartilhada, visível a qualquer usuário com `indicator:view`, exatamente como
  `Framework` é visível a qualquer usuário com `compliance:view` independente de unidade
  (research.md D-8).

### Funcionais — valor atual (US1)

- **FR-005**: `GET /indicators/{metricKey}/current` DEVE devolver o valor calculado por
  `IndicatorCalculationService` (único calculador — FR-020) no momento da chamada, sob o
  `ScopeFilter` resolvido do chamador — nunca um valor armazenado.
- **FR-006**: A operação DEVE exigir `indicator:view` **e** a permissão de leitura própria do
  domínio-fonte daquela chave (`risk:view` para métricas de Risco, `compliance:view` para métricas
  de Conformidade, e assim por diante) — o mesmo padrão de dupla exigência que
  `008-incidents-problems` FR-013 já estabelece para vínculo, aplicado aqui a leitura de métrica.
  Faltando a segunda, a operação responde `403`.
- **FR-007**: Uma métrica cuja fonte tem coluna de escopo organizacional própria DEVE aplicar o
  `ScopeFilter` do chamador na consulta daquela fonte, na coluna própria da fonte — nunca por junção
  com outra tabela para inferir escopo (a regra que `specs/006-assets-processes/STATE.md` §3
  registra como um dos dois vazamentos que aquela fase fechou, aplicada aqui pela primeira vez a
  leitura cross-domínio).
- **FR-008**: Uma métrica cuja fonte não tem coluna de escopo organizacional (Conformidade — FR-009)
  DEVE ser servida idêntica para todo chamador com a permissão de leitura da fonte, e a resposta
  DEVE indicar explicitamente essa característica (`scopeApplicability: 'ORGANIZATION_WIDE'` vs.
  `'ORGANIZATIONAL_UNIT'`) — nunca fingir um filtro que a fonte não pode sustentar.
- **FR-009**: `IndicatorMetricKey` de Conformidade DEVE ser servido sem predicado de unidade
  organizacional, refletindo que `Requirement` não tem essa coluna (`schema.prisma:2580`).
- **FR-010**: Uma chave de métrica desconhecida DEVE responder `404` — `IndicatorMetricKey` nunca
  aceita valor livre do cliente.

### Funcionais — histórico (US2)

- **FR-011**: DEVE existir `IndicatorMeasurement`, imutável, com `id`, `metricKey` (a chave do
  catálogo — FR-002 — nunca uma FK para o `id` de uma `IndicatorDefinition` específica, data-model.md
  §2/§6, para que um ponto continue gravável mesmo sem definição registrada para a chave),
  `value` (numérico) **ou** `valueByBucket` (JSON, para métricas por nível/severidade —
  data-model.md §2), `breached` (booleano, calculado no momento do registro), `computedAt`,
  `computedByUserId`. Nenhuma coluna aceita edição — não existe `PATCH`/`PUT` para este recurso.
- **FR-012**: Criar um `IndicatorMeasurement` DEVE exigir `indicator:edit` **e** o `ScopeFilter`
  resolvido do chamador ser `{ kind: 'GLOBAL' }` — nunca `UNIT`, mesmo que o `UNIT` cubra toda a
  árvore de unidades hoje existente (a checagem é do **tipo** de concessão, não da cobertura
  efetiva, para não depender da topologia atual da árvore permanecer igual — research.md D-6).
- **FR-013**: Toda criação de `IndicatorMeasurement` DEVE ser auditada (`AuditEntityType +=
  INDICATOR_MEASUREMENT`), com o valor calculado registrado como o "valor posterior" (não há
  "valor anterior" — é uma criação, nunca uma edição).
- **FR-014**: `GET /indicators/{metricKey}/measurements` DEVE exigir `indicator:view` **e**
  `ScopeFilter` resolvido `GLOBAL` — a mesma dupla exigência de escrita (FR-012), aplicada à
  leitura, porque o histórico é sempre organização inteira.
- **FR-015**: `IndicatorMeasurement` DEVE ser ordenável por `computedAt`, paginado, com o mesmo
  contrato de página (`page`/`pageSize`/`total`/`totalPages`) que todo outro catálogo desta
  plataforma já usa.

### Funcionais — limiar e notificação (US3)

- **FR-016**: `IndicatorCalculationService` DEVE avaliar `breached` comparando o valor calculado
  contra `thresholdComparator`/`thresholdValue` do `IndicatorDefinition`, sempre no mesmo instante
  em que calcula o valor — nunca uma segunda passada, nunca uma regra duplicada em outro serviço
  (CLAUDE.md §19.7).
- **FR-017**: Quando um `IndicatorMeasurement` recém-criado tiver `breached: true`,
  `NotificationService.notify` DEVE ser chamado uma vez, com `recipientUserId` igual ao
  `ownerUserId` do `IndicatorDefinition`.
- **FR-018**: `CommentableEntityType` (reusado por `Notification.entityType`, o mesmo mecanismo que
  `008-incidents-problems` já documentou para si mesmo) DEVE ganhar `INDICATOR` para que a
  notificação de rompimento carregue um link profundo válido para o indicador.
- **FR-019**: Um `IndicatorDefinition` sem `thresholdComparator`/`thresholdValue` preenchidos NUNCA
  aciona `breached`, e portanto nunca produz notificação.

### Funcionais — Ação como destino (US4)

- **FR-020**: `ActionOriginType` DEVE ganhar `INDICATOR` por migração aditiva revisada (ADR-008),
  acompanhada por um `IndicatorActionOriginAccessor` com os quatro métodos que
  `test/unit/action-model-convergence-guard.spec.ts` já exige de todo valor do enum
  (`resolveEditableOrigin`/`resolveViewableOrigin`/`resolveOriginScope`/`listOriginIdsInScope`) —
  o mesmo par migração+acessor que toda fase anterior já entrega junto (research.md D-5). Nenhuma
  tabela de tarefa própria de Indicador é criada.
- **FR-021**: `resolveOriginScope`/`listOriginIdsInScope` de `IndicatorActionOriginAccessor` DEVEM
  tratar todo `IndicatorDefinition` como visível a qualquer chamador com `indicator:view` — a
  mesma característica "organização inteira" de FR-004, refletida no acessor de origem de Ação.

### Funcionais — definição e execução de relatório (US5)

- **FR-022**: DEVE existir `ReportDefinition` (`modules/reports`) com `id`, `code`
  (`RPT-AAAA-NNNN`), `name`, `description`, `metricKeys` (array de `IndicatorMetricKey`, não
  vazio), `createdByUserId`, `createdAt`, `updatedAt`.
- **FR-023**: Criar/editar uma `ReportDefinition` DEVE exigir `report:create`/`report:edit`. Sem
  exclusão — desativação (`isActive: false`), mesmo padrão de FR-003.
- **FR-024**: Toda criação/edição de `ReportDefinition` DEVE ser auditada (`AuditEntityType +=
  REPORT`).
- **FR-025**: `GET /reports/{id}/run` DEVE exigir `report:view`, e DEVE devolver, para cada
  `metricKey` referenciado, o mesmo valor que `GET /indicators/{metricKey}/current` devolveria para
  o mesmo chamador — nunca uma segunda implementação de cálculo (FR-005 é a única fonte).
- **FR-026**: Quando o chamador não tiver a permissão de leitura da fonte de um `metricKey`
  referenciado, a execução DEVE marcar aquele item como `available: false` **sem** derrubar os
  demais itens da mesma execução (US5, cenário 3) — diferente de FR-006 (indicador avulso), onde a
  falta da permissão da fonte responde `403` porque não há "os demais itens" a preservar.
- **FR-027**: A execução de um relatório NUNCA é armazenada — cada chamada recalcula tudo, sob o
  escopo de quem chama, exatamente como o Dashboard já faz (FR-005 aplicado por composição).
- **FR-028**: `GET /reports/{id}/measurements` (histórico agregado do relatório) **não existe**
  nesta fase — um relatório não tem série histórica própria; quem quiser tendência consulta o
  histórico do indicador individual (US2). Registrado como extensão candidata, não construído
  (§19.10).

### Funcionais — exportação (US5)

- **FR-029**: `GET /reports/{id}/run` DEVE aceitar `Accept: text/csv` (ou um parâmetro `format=csv`
  equivalente — decisão de contrato em `contracts/reports.openapi.yaml`) e, nesse caso, devolver
  `text/csv` com uma linha de cabeçalho e uma linha por `metricKey` executado.
- **FR-030**: Nenhum outro formato de exportação (PDF, XLSX) existe nesta fase (Q5). Registrado como
  extensão candidata, não construída.

### Funcionais — capacidades compartilhadas e registros fechados

- **FR-031**: `EntityCodePrefix` DEVE ganhar `'IND'` e `'RPT'`, reusando `GrcCodeSequence` — nenhuma
  tabela de sequência nova (research.md D-9).
- **FR-032**: `AuditEntityType` DEVE ganhar `INDICATOR`, `INDICATOR_MEASUREMENT`, `REPORT` por
  migração aditiva revisada.
- **FR-033**: `ActionOriginType` DEVE ganhar `INDICATOR` (FR-020). `CommentableEntityType` DEVE
  ganhar `INDICATOR` (FR-018), e **somente** `INDICATOR` — `REPORT` não entra em
  `CommentableEntityType`/`AttachableEntityType` nesta fase, porque nenhum requisito pede
  notificação ou comentário endereçado a um relatório.

### Funcionais — autorização

- **FR-034**: DEVEM existir as permissões `indicator:view`, `indicator:create`, `indicator:edit`,
  `report:view`, `report:create`, `report:edit` — seis permissões, todas reusando valores já
  existentes de `PermissionAction` (`VIEW`, `CREATE`, `EDIT`). Nenhum valor novo de
  `PermissionAction` é necessário.
- **FR-035**: O papel semeado "Read Only" DEVE ganhar `indicator:view`/`report:view` — a mesma regra
  geral que `specs/005-audit-findings/STATE.md` §5 registrou ("todo papel semeado que ESCREVE um
  recurso consegue LÊ-lo"), aplicada aqui na direção inversa e mais simples: um papel cujo próprio
  propósito é "ver tudo dentro do escopo" precisa nomear as duas novas permissões de leitura, ou
  deixa de cumprir a própria descrição pela mesma classe de motivo que deixou "Audit Lead"
  incompleto.

### Funcionais — interface (US6)

- **FR-036**: As telas novas DEVEM reusar os primitivos de cartão de métrica, badge de nível,
  tabela, filtro e paginação já existentes em `packages/design-system` — nenhuma implementação
  local por módulo (§18.3/§18.12).
- **FR-037**: Nível/severidade/rompimento de limiar DEVEM ser comunicados por ícone ou texto além de
  cor (§18.8).
- **FR-038**: `core/dashboard/domain/default-planned-areas.ts` DEVE parar de registrar `PROBLEMS` e
  `INCIDENTS` (Achado 1) na mesma tarefa em que `Indicators` ganha suas próprias telas — corrigindo
  o defeito medido nesta especificação, não deixando-o para uma fase futura não nomeada.
  **Já satisfeito na chegada — correção de 2026-09-11**: o commit `cffb553`, anterior ao início
  desta fase, já entregou a parte deste requisito que é **remoção** —
  `registerDefaultPlannedAreas()` não registra nenhuma área hoje. Essa parte deixou de ser trabalho
  pendente; T064 de `tasks.md` está marcada obsoleta pela mesma razão. O que **não** deixou de valer
  é a parte deste requisito que é **garantia a preservar**: o registro de área planejada precisa
  continuar vazio e `GET /dashboard` precisa continuar devolvendo `plannedAreas: []` — exatamente o
  que SC-009, abaixo, exige. Essa garantia já tem verificação própria em
  `apps/api/test/contract/dashboard.spec.ts:325` (`expect(body.plannedAreas).toEqual([])`), que
  continua fazendo parte da suíte de regressão que SC-007/T067 desta fase precisa manter passando —
  nenhuma tarefa nova precisa criá-la. A distinção importa: o requisito deixou de pedir a remoção,
  não deixou de pedir que a remoção permaneça verificada.
- **FR-039**: As duas entradas de navegação (`id: 'indicators'`, `id: 'reports'`) DEVEM sair de
  `status: 'planned'` para `status: 'implemented'`, ganhando `requiredPermission`/`href`, na mesma
  tarefa que entrega a tela correspondente.
- **FR-040**: Todo texto voltado ao usuário DEVE vir de
  `apps/api/src/shared/messages/indicators.ts`/`reports.ts` e
  `apps/web/src/lib/messages/indicators.ts`/`reports.ts` — nenhuma string nova embutida em
  componente ou DTO (§11.1).
- **FR-041**: As telas novas DEVEM passar varredura de acessibilidade automatizada (axe) nos dois
  temas, com conteúdo real renderizado — não o esqueleto (lição de F-28, já paga uma vez).

---

## Success Criteria *(mandatory)*

- **SC-001**: Para cada domínio listado em Q6, existe ao menos um `IndicatorMetricKey` cujo valor
  atual, para um usuário de escopo `UNIT`, é idêntico a uma contagem manual filtrada pela mesma
  unidade contra o banco — verificável por teste de integração, um por domínio.
- **SC-002**: Nenhum `IndicatorMeasurement` pode ser editado ou removido por nenhuma rota do
  contrato — verificável por busca estrutural sobre `contracts/indicators.openapi.yaml` (nenhum
  `PATCH`/`PUT`/`DELETE` sobre `/measurements`).
- **SC-003**: Registrar um `IndicatorMeasurement` cujo valor rompe o limiar configurado produz
  exatamente uma notificação para o `ownerUserId` do indicador; registrar um que não rompe produz
  zero — verificável tentando os dois casos e contando linhas em `notifications`.
- **SC-004**: Uma tentativa de registrar ou ler o histórico de um indicador sob escopo `UNIT`
  responde `403` de forma idêntica para todo `IndicatorMetricKey`, independentemente do domínio de
  origem.
- **SC-005**: Busca estrutural automatizada confirma que nem `IndicatorDefinition`,
  `IndicatorMeasurement`, `ReportDefinition` — nem nenhuma tabela nova desta fase — declara campo de
  tarefa, arquivo ou aprovação em paralelo ao que `Action`/`Evidence`/`AttachableEntityType`/
  `ApprovableEntityType` já fornecem (mesmo padrão de SC-004 de `008-incidents-problems`).
- **SC-006**: Um relatório com três indicadores de domínios diferentes, executado por um usuário
  sem permissão para um deles, devolve os outros dois normalmente e marca o terceiro
  `available: false` — nunca um erro que descarte a resposta inteira.
- **SC-007**: As suítes de Risco, Controles, Conformidade, Auditoria, Ativos, Processos, Incidentes,
  Problemas e do núcleo GRC compartilhado continuam passando com a mesma contagem de testes de
  antes desta fase, exceto onde um teste precisou mudar para refletir esta fase — e cada teste
  alterado cita o FR correspondente.
- **SC-008**: As telas novas passam varredura de acessibilidade automatizada nos dois temas, com
  conteúdo real renderizado, e são verificadas contra o portão do §18.11 olhando a aplicação
  renderizada.
- **SC-009**: Depois desta fase, `GET /dashboard` devolve `plannedAreas: []` para todo chamador —
  verificável diretamente, fechando o Achado 1 registrado nesta especificação.

---

## Assumptions

- **A-1 — Dois módulos, não um**: `Indicator` e `Report` são domínios distintos na lista da própria
  Constituição (CLAUDE.md §1: "Indicadores", "Relatórios", nomes separados) e a própria navegação
  já os antecipa como duas entradas (`navigation-registry.ts:195-204`). Espelha a decisão A-1 de
  `008-incidents-problems` pela mesma razão.
- **A-2 — Nenhum agendador é introduzido nesta fase**: o histórico organização inteira (US2) nasce
  de ação humana explícita, nunca de temporizador — porque nenhuma infraestrutura de agendamento
  existe hoje (Contexto medido, linha 9), e introduzi-la sem justificativa aprovada violaria
  CLAUDE.md §2. Um agendador fica registrado como extensão candidata futura.
- **A-3 — Nenhuma exportação além de CSV**: pela mesma razão de A-2, aplicada a bibliotecas de
  geração de documento em vez de agendamento (Contexto medido, linha 10).
- **A-4 — `IndicatorMetricKey` é fechado e curado, nunca uma consulta genérica**: um construtor de
  relatório livre (escolher qualquer campo, qualquer filtro, qualquer agregação) seria
  estruturalmente o mesmo risco que CLAUDE.md §19.3 já nomeia para relacionamento genérico,
  aplicado a leitura em vez de escrita — um `WHERE` livre sobre qualquer tabela é tão perigoso para
  vazamento de escopo quanto um `related_entity(type, id)` livre é para integridade relacional.
  Cada chave nova é uma decisão revisada, não um parâmetro aberto ao cliente.
- **A-5 — `ReportDefinition` não tem coluna de unidade organizacional**, pela mesma razão de FR-004:
  é uma composição compartilhada, a execução é que carrega o escopo de quem chama.

---

## Checklist de qualidade

- [x] Toda contraparte de CLAUDE.md §19.2 tem linha própria na tabela de relação, com "não se
  relaciona" escrito e justificado onde é a resposta.
- [x] Nenhum mecanismo de relacionamento além dos dois de §19.3 aparece em qualquer requisito —
  `Indicator`/`Report` não introduzem um terceiro mecanismo; leem através dos dois já existentes e
  de consultas próprias de cada domínio-fonte.
- [x] As sete perguntas de escopo desta tarefa foram decididas, com alternativas e custo registrados
  em research.md, nunca deixadas em aberto.
- [x] A relação com o Dashboard existente foi extraída do código (`get-dashboard.usecase.ts`,
  `dashboard-query.service.ts`, `planned-area-registry.ts`) antes de ser decidida, não presumida.
- [x] Estado derivado (valor de indicador, `breached`) é sempre calculado por um único serviço
  (`IndicatorCalculationService`), nunca armazenado como campo editável em paralelo (CLAUDE.md
  §19.7).
- [x] Achados fora do escopo desta especificação (mecanismo de área planejada desatualizado,
  ausência de permissões semeadas para Incidente/Problema, `tasks.md` de 008 dessincronizado do
  código) foram registrados, não escondidos, com a distinção clara de que nenhum é corrigido por
  este documento. **Correção de 2026-09-11**: os quatro já estão corrigidos por commits anteriores
  a esta fase (`cffb553`, `18e9351`, `424d312`) — ver "Achados fora do escopo desta especificação",
  acima, para a evidência de cada um.
