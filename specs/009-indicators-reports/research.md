# Research — Gestão de Indicadores e Gestão de Relatórios

**Feature**: `009-indicators-reports` · **Spec**: [spec.md](./spec.md) · **Date**: 2026-09-11

Cada decisão abaixo foi tomada contra o repositório real (schema, código, documentos de arquitetura
já existentes), nunca contra a intuição de como o projeto "provavelmente" resolveria a pergunta —
a mesma disciplina que `006-assets-processes/research.md` e `008-incidents-problems/research.md`
já registraram, pela mesma razão: este projeto já pagou várias vezes por uma causa escrita com
confiança e errada (`specs/005-audit-findings/STATE.md` §3/§6).

As sete perguntas genuinamente de produto que a tarefa desta fase pediu para decidir — o que é um
Indicador, se tem histórico e o que o torna imutável, se limiar existe e o que ele produz, o que é
um Relatório e o que entra na v1, formatos de exportação, quais domínios entram como fonte, e a
relação com o Dashboard existente — são D-1, D-2, D-3, D-6, D-7, D-9/D-10 e D-11/D-12 abaixo,
respectivamente.

---

## D-1 — Dois módulos, não um "módulo de análise"

**Decisão**: `apps/api/src/modules/indicators/` e `apps/api/src/modules/reports/`, separados, com a
mesma forma interna de `modules/incidents`/`modules/problems` (domain/application/infrastructure/
presentation).

**Razão**: CLAUDE.md §1 nomeia os dois como itens distintos da lista de módulos planejados
("Indicadores", "Relatórios", nomes separados), e a própria navegação do produto já os antecipa
como duas entradas distintas, não uma (`apps/web/src/components/shell/navigation-registry.ts:195-204`
— `id: 'indicators'` com ícone `Gauge` e `id: 'reports'` com ícone `FileBarChart`, ambos
`status: 'planned'` hoje). `docs/history/grc-domain-blueprint.md:125` também os lista como uma
única linha na tabela de módulos ("Indicadores e Relatórios"), mas isso é o nome da **fase**, não
prova que sejam um módulo técnico só — a mesma distinção que `008-incidents-problems/research.md`
D-1 já fez para "Gestão de Incidentes e Gestão de Problemas" ser uma fase com dois módulos.

Os dois módulos são mais interdependentes entre si do que Incidente/Problema eram: `Report` só
existe para compor `Indicator`s já definidos (§19.2, seção "Indicador → Relatório" de `spec.md`).
Isso não os torna um módulo único — é a mesma relação de dependência de leitura que `Problem` já
tem com `Incident` (via `IncidentDirectoryPort`), sem que os dois deixem de ser módulos distintos.

**Alternativas rejeitadas**:
- *Um módulo `analytics/` com os dois dentro* — junta dois nomes que a navegação e a Constituição
  já tratam como distintos, e obrigaria um consumidor futuro que precise só de `Indicator` (por
  exemplo, um card de indicador embutido numa tela de domínio) a depender do par.
- *Relatório como sub-recurso de Indicador* (`/indicators/{id}/reports`) — inverteria a direção real
  da dependência: um relatório referencia N indicadores, nunca o contrário, então a rota natural
  é a própria (`/reports`), não aninhada sob um indicador específico.

---

## D-2 — Indicador é dois objetos, nunca um: definição editável + série imutável, valor "atual" nunca armazenado

**Decisão**: `IndicatorDefinition` é a única parte editável (nome, métrica-fonte, limiar,
responsável) — nunca um campo de valor. O "valor atual" de um indicador (US1) é sempre computado no
momento da chamada por `IndicatorCalculationService`, com o mesmo padrão que
`GetDashboardUseCase`/`DashboardQueryService` já provam para Risco: nenhuma tabela guarda "o valor
atual de X". O histórico (US2) é uma segunda tabela, `IndicatorMeasurement` — append-only, sem
`PATCH`/`PUT`/`DELETE` no contrato (`spec.md` SC-002) — cada linha uma fotografia imutável do valor
no instante em que foi calculada.

**Razão**: é a aplicação direta de CLAUDE.md §19.7 ("estado derivado é calculado, com um calculador
único... Não armazenar como campo editável em paralelo ao que o sustenta") ao próprio conceito de
Indicador — que é, por definição, estado derivado. Os dois precedentes diretos já existem no
repositório:

1. `apps/api/src/modules/risk/domain/risk-scoring.service.ts:1-6` — "T122 — `RiskScoringService`
   (ADR-006, FR-062, FR-063). The ONLY place a risk score or level is ever computed... a future
   dashboard aggregates all call `.score()` and never re-derive a level any other way." O próprio
   comentário já nomeia "future dashboard aggregates" como consumidor esperado — este é
   exatamente esse consumidor, chegando cinco fases depois.
2. `apps/api/src/modules/compliance/domain/requirement-compliance.service.ts:1-10` — "the single
   calculator of `RequirementComplianceState`" — o mesmo padrão, para um domínio diferente.

Mas um valor **histórico** — diferente de um valor atual — tem precedente de ser **armazenado**
imutavelmente, não recalculado sempre: `RiskAssessment` (CLAUDE.md §9: "o modelo deve permitir
avaliações históricas... não sobrescrever informações históricas relevantes sem preservar o estado
anterior"). A diferença entre os dois casos não é arbitrária: um "valor atual" recalculado a cada
leitura nunca diverge do dado que o sustenta (é sempre a verdade de agora); um "ponto histórico"
existe precisamente para **não** ser recalculado — ele representa "o que era verdade em tal data",
mesmo que o dado subjacente mude depois. Misturar os dois (por exemplo, um `IndicatorDefinition`
com um campo `currentValue` que alguém atualiza) seria o defeito exato que §19.7 proíbe: um valor
editável em paralelo ao que o sustenta, que pode ficar desatualizado sem nenhum mecanismo o
impedindo.

**Nota complementar — `metric_key` é `UNIQUE` em `indicator_definitions`**: no máximo uma
definição existe por chave do catálogo fechado (data-model.md §1). Isso evita uma segunda pergunta
em aberto que uma cardinalidade N:1 introduziria sem necessidade — "qual das várias definições
concorrentes decide o limiar de um ponto de medição, e quem é notificado?" — e mantém
`IndicatorDefinition` fiel ao que ela é (configuração opcional de uma chave que já existe e já é
consultável sem ela, data-model.md §1) em vez de um registro por usuário/time para a mesma métrica.
`IndicatorMeasurement.metric_key` referencia a chave diretamente (não o `id` de uma definição),
precisamente para que um ponto continue gravável mesmo quando nenhuma definição existe ainda para
aquela chave (data-model.md §2/§6).

**Alternativas rejeitadas**:
- *Um único registro por indicador, com um campo `value` atualizado a cada leitura* — é
  precisamente o "campo editável em paralelo" que §19.7 proíbe; e uma leitura (GET) escrevendo no
  banco a cada chamada seria uma superfície de escrita disfarçada de leitura, sem autorização de
  escrita nem trilha de auditoria coerente com o resto da plataforma (toda escrita desta plataforma
  é uma ação nomeada com sua própria permissão — ver FR-012).
- *Recalcular também o histórico a cada leitura, sem armazenar nada* — perderia a garantia de
  imutabilidade que uma série histórica precisa: se o valor de um ponto passado mudasse porque o
  dado subjacente mudou, não haveria mais "tendência ao longo do tempo", apenas "o mesmo número de
  agora, repetido para datas diferentes" — inútil como série.

---

## D-3 — Nove domínios de negócio já implementados entram como fonte; nenhum planejado entra

**Decisão**: `IndicatorMetricKey` (FR-002) cobre, na v1, ao menos uma métrica de cada um dos nove
domínios de negócio hoje implementados: Risco, Controle, Conformidade, Auditoria (engajamento),
Achado, Ativo, Processo, Ação, Incidente, Problema (dez nomes, porque Auditoria/Achado é uma fase
só mas duas tabelas-fonte distintas — `AuditEngagement` e `Finding`).

**Razão**: cada um foi verificado como implementado, não presumido, contra `schema.prisma` e
`apps/web/src/components/shell/navigation-registry.ts` antes de entrar nesta lista:

| Domínio | Modelo/linha | Módulo | `status` na navegação |
|---|---|---|---|
| Risco | `model Risk`, `schema.prisma:986` | `modules/risk` | `implemented` (`navigation-registry.ts:91-95`) |
| Controle | `model Control`, `schema.prisma:1451` | `modules/controls` | `implemented` (`:137-141`) |
| Conformidade | `model Framework`/`FrameworkVersion`/`Requirement`, `schema.prisma:2580` | `modules/compliance` | `implemented` (`:176-180`) |
| Auditoria (engajamento) | `model AuditEngagement`, `schema.prisma:2766` | `modules/audit-engagements` | `implemented` (`:187-191`) |
| Achado | `model Finding`, `schema.prisma:2396` | `grc/finding` (núcleo GRC, não `modules/`) | consumido via Auditoria/Risco/Controle na navegação |
| Ativo | `model Asset`, `schema.prisma:1669` | `modules/assets` | `implemented` (`:145-152`) |
| Processo | `model Process`, `schema.prisma:1647` | `modules/processes` | `implemented` (`:154-162`) |
| Ação | `model Action`, `schema.prisma:2285` | `grc/action` | `implemented`, entrada `my-actions` (`:104-110`) |
| Incidente | `model Incident`, `schema.prisma:2999` | `modules/incidents` | `implemented` (`:124-131`) |
| Problema | `model Problem`, `schema.prisma:3057` | `modules/problems` | `implemented` (`:113-121`) |

Nenhum domínio "planejado mas não construído" entra: Planos de Ação deixou de ser módulo
(CLAUDE.md §17, "decisão registrada em §17") e não tem tabela própria — a métrica equivalente
("ações em atraso") já está coberta pela linha "Ação" acima, através de `grc/action`, exatamente
como a Constituição já determina que Planos de Ação seja consumido, não recriado.

**Alternativa rejeitada**: cobrir só um subconjunto "principal" (por exemplo, só Risco e
Conformidade) e deixar os outros para uma fase futura — rejeitada porque o próprio roteiro
(`docs/architecture/grc-roadmap.md:212-216`) declara esta fase como a última do grafo, dependente
de **todas** as anteriores ("Depende de: todas as anteriores"), exatamente porque o valor da fase é
atravessar o grafo inteiro. Deixar domínios de fora sem razão técnica contrariaria a própria
justificativa de a fase vir por último.

---

## D-4 — Catálogo de métricas é um registro fechado, reusando um calculador por domínio; nunca uma consulta genérica

**Decisão**: `IndicatorMetricKey` é um enum verificado em compilação (o mesmo padrão de
`EvidenceSubjectType`/`ActionOriginType`/`AttachableEntityType`). Cada valor é implementado por um
`IndicatorMetricProvider` que **reusa** um serviço/porta de consulta já existente daquele domínio —
nunca uma consulta livre parametrizável (campo, filtro, agregação) vinda do cliente. O catálogo
inicial (`data-model.md` §3) tem uma métrica por domínio de D-3, no mínimo:

| `IndicatorMetricKey` | Domínio | Reusa |
|---|---|---|
| `RISK_TOTAL_BY_LEVEL` | Risco | `DashboardQueryPort.getRiskProfile` (`dashboard-query.port.ts:90`) |
| `RISK_TREATMENT_OVERDUE_COUNT` | Risco | `DashboardQueryPort.getTreatmentActionsSummary` (`:111`) |
| `CONTROL_INACTIVE_COUNT` | Controle | consulta própria de `modules/controls` sobre `ControlStatus` (`schema.prisma:1389`) |
| `COMPLIANCE_PERCENTAGE` | Conformidade | `GetFrameworkVersionComplianceSummaryUseCase` (`compliance-summary/get-framework-version-compliance-summary.usecase.ts`) |
| `AUDIT_ENGAGEMENT_OPEN_COUNT` | Auditoria | consulta própria de `modules/audit-engagements` sobre `AuditEngagementStatus` |
| `FINDING_OPEN_COUNT_BY_SEVERITY` | Achado | consulta própria de `grc/finding` sobre `FindingStatus`/`FindingSeverity` (`schema.prisma:2372`/enum severidade) |
| `ASSET_INACTIVE_COUNT` | Ativo | consulta própria de `modules/assets` sobre `isActive` (`schema.prisma:893`, padrão já usado por Categoria/Tipo/Origem) |
| `PROCESS_INACTIVE_COUNT` | Processo | idem, `modules/processes` |
| `ACTION_OVERDUE_COUNT` | Ação | `isActionOverdue`, `apps/api/src/grc/shared/domain/overdue.service.ts` — "the ONE 'is this action overdue' computation for the entire platform" |
| `INCIDENT_OPEN_COUNT_BY_SEVERITY` | Incidente | consulta própria de `modules/incidents` sobre `IncidentStatus`/`IncidentSeverity` (`schema.prisma:2959`) |
| `PROBLEM_OPEN_COUNT_BY_SEVERITY` | Problema | idem, `modules/problems` (`schema.prisma:2979`) |

**Razão**: é a mesma proibição de CLAUDE.md §19.3 (mecanismo genérico) aplicada a leitura em vez de
escrita, e a mesma razão que `spec.md` A-4 registra: um construtor de relatório livre é, para
vazamento de escopo, tão perigoso quanto um `related_entity(type, id)` livre é para integridade
relacional — os dois abrem uma superfície onde o autor de uma consulta arbitrária pode, por
acidente ou não, ler através de uma coluna sem predicado de escopo. Fechar o catálogo por chave
verificada em compilação, cada uma implementada por revisão humana explícita, é o mesmo raciocínio
que já rege `EvidenceSubjectType`/`ActionOriginType`: "closed platform enums grow by reviewed
migration" (ADR-008).

**Alternativas rejeitadas**:
- *Uma linguagem de consulta genérica* (campo + operador + valor, no estilo de um filtro de BI) —
  rejeitada por §19.3 e pelo argumento de A-4 acima: caminho direto para vazamento de escopo, e o
  tipo de abstração especulativa que CLAUDE.md §2 já proíbe por nome ("não criar abstrações
  prematuras").
- *Views SQL materializadas por domínio, recalculadas por trigger* — introduziria um segundo lugar
  onde a regra de negócio (por exemplo, o que conta como "risco crítico") pode divergir do
  calculador de domínio (`RiskScoringService`), exatamente o "duas autoridades para o mesmo fato"
  que este projeto já corrigiu duas vezes (Ação, Incidente/Problema).

---

## D-5 — `ActionOriginType += INDICATOR` segue o par migração+acessor que toda fase anterior já entrega junto

**Decisão**: `ActionOriginType` ganha `INDICATOR` numa única migração aditiva revisada,
acompanhada, na mesma tarefa, por `IndicatorActionOriginAccessor` com os quatro métodos que
`test/unit/action-model-convergence-guard.spec.ts` exige (`resolveEditableOrigin`/
`resolveViewableOrigin`/`resolveOriginScope`/`listOriginIdsInScope`).

**Razão**: `008-incidents-problems/spec.md` FR-016 registra, em detalhe verificado por teste real
(não por leitura), o custo exato de separar as duas coisas: adicionar o valor de enum sem o
acessor deixa `POST /actions` com aquele `originType` **irresolúvel** — a origem nunca existe de
fato, mesmo que o valor "exista" no schema. A correção final daquela mesma fase (`research.md` D-2
de `008`, seção "Resolvido, 2026-09-11, mesma noite") já prova que o par precisa ser entregue junto,
nunca em duas tarefas separadas por um intervalo onde o valor existe sem acessor. Esta fase aplica
a mesma disciplina desde o início, em vez de repetir o erro e corrigi-lo depois.

**Alternativa rejeitada**: não estender `ActionOriginType` nesta fase, deixando "criar Ação a partir
de um Indicador" para uma fase futura — rejeitada porque US4 (spec.md) é a aplicação direta de
CLAUDE.md §19.4/§19.6 a esta fase, e adiá-la a esmo repetiria o padrão que o roteiro já nomeia como
o defeito que a ordem do roteiro existe para evitar ("cinco sistemas independentes de tarefa").

---

## D-6 — Histórico é organização inteira, gated por `ScopeFilter.kind === 'GLOBAL'`, nunca por unidade

**Decisão**: criar ou ler um `IndicatorMeasurement` exige que o `ScopeFilter` resolvido do chamador
seja `{ kind: 'GLOBAL' }` — nunca `UNIT`, mesmo que o conjunto de unidades cubra hoje toda a árvore
organizacional. O valor "atual" (US1), ao contrário, é sempre computado sob o escopo real do
chamador, `UNIT` incluso.

**Razão**: um ponto de medição histórico é uma fotografia gravada, com um `id` e um `computedAt`
próprios — se dois pontos com o mesmo `indicatorDefinitionId` pudessem existir, um computado sob
escopo `UNIT` de uma unidade e outro sob outra unidade, a "série ao longo do tempo" deixaria de
significar uma coisa: seria uma mistura de números que não são comparáveis entre si (o total de uma
unidade num mês, o total de outra unidade no mês seguinte). Fixar todo ponto histórico em
"organização inteira" garante que a série signifique sempre a mesma população subjacente, ao custo
de restringir quem pode criá-la/lê-la a quem já tem a concessão mais ampla que a plataforma já
define (`OrgScopeGrant`, produzindo `{ kind: 'GLOBAL' }` — `apps/api/src/shared/persistence/
scope-filter.ts:16-19`: "`{ kind: 'GLOBAL' }` is the ONLY representation of 'unrestricted', and it
is never the default — `ScopeResolverService` only ever produces it from an explicit, audited
`OrgScopeGrant` row").

A checagem é do **tipo** da concessão (`GLOBAL`), nunca de "o conjunto de unidades do chamador
cobre toda a árvore hoje" — porque a segunda forma dependeria da topologia da árvore de unidades
permanecer igual para continuar correta; a primeira não depende de nada além do próprio tipo de
concessão, a mesma garantia estrutural que `ScopeFilter` já documenta para si mesmo ("there is no
way to construct a value of this type that means 'I don't know / skip the check'").

**Alternativas rejeitadas**:
- *Histórico por unidade, uma série por unidade* — multiplicaria o número de séries por indicador
  pelo número de unidades, sem nenhum requisito que peça granularidade por unidade no histórico
  (US2 só pede "a tendência organização inteira"), e sem agendador para popular todas elas de forma
  consistente (D-2's próprio motivo de o histórico ser sempre uma ação humana explícita).
- *Qualquer usuário com `indicator:edit` pode criar um ponto, e ele herda o escopo de quem criou* —
  produziria exatamente a mistura de populações não comparáveis que a Decisão evita; foi
  descartada, não esquecida.

---

## D-7 — Limiar rompido produz notificação, nunca `Action` automática

**Decisão**: `IndicatorCalculationService` avalia `breached` no mesmo instante em que calcula o
valor de um `IndicatorMeasurement` recém-criado; quando `true`, `NotificationService.notify` é
chamado uma vez, endereçado ao `ownerUserId` do `IndicatorDefinition`. Nenhuma `Action` é criada
automaticamente.

**Razão**: `NotificationService` já existe, mas nunca teve um produtor real —
`apps/api/src/core/notifications/application/notification.service.ts:1-9` descreve a si mesmo como
"the notification PORT ADR-011/F-7 describe as 'designed but not built'... No call site exists yet
in this release", e `docs/history/grc-domain-blueprint.md:59` confirma, na tabela de
capacidades de plataforma: "Notificações | infraestrutura pronta, sem produtor". CLAUDE.md §19.10
("ponto de extensão só conta depois de executado") torna esta fase o primeiro lugar legítimo para
exercitá-la de verdade — e uma notificação, por desenho do próprio `NotificationService`
("a best-effort courtesy message, not part of the audit trail"), é exatamente o tipo de efeito
colateral leve e não-transacional que um evento derivado (não uma decisão de negócio) deveria
produzir.

Criar uma `Action` automaticamente, em vez disso, seria decidir por conta própria — sem nenhum
requisito de produto que peça isso — que todo rompimento de limiar exige necessariamente trabalho
corretivo formal e rastreado. CLAUDE.md §2 é direto sobre isso: "não implementar funcionalidades que
não estejam especificadas ou aprovadas". Um usuário que julgar que um rompimento específico exige
correção continua livre de criar a `Action` manualmente (US4, D-5) — a mesma forma como toda outra
origem de `Action` desta plataforma já funciona: nenhuma é criada automaticamente por evento de
domínio, todas nascem de uma decisão humana explícita (`POST /actions`).

**Alternativas rejeitadas**:
- *Criar `Action` automaticamente no rompimento* — automação não pedida (CLAUDE.md §2), e a
  primeira exceção, nesta plataforma, à regra "toda `Action` nasce de decisão humana explícita" —
  uma exceção que exigiria sua própria especificação e aprovação, não uma decisão desta fase.
- *Nenhum efeito automático nenhum, nem notificação* — deixaria o limiar como "ponto de extensão que
  compila mas nunca foi chamado" (§19.10), o mesmo defeito que este projeto já pagou sete vezes
  segundo a própria Constituição.

---

## D-8 — `IndicatorDefinition` não tem coluna de unidade organizacional; Conformidade nunca é filtrável por unidade

**Decisão**: `IndicatorDefinition` (a definição, compartilhada) não tem `orgUnitId`. A execução
(o valor atual, US1) aplica o `ScopeFilter` do chamador na consulta de **cada fonte**, na coluna
própria daquela fonte — exceto para métricas de Conformidade, que nunca aplicam predicado de
unidade, porque a fonte não tem essa coluna.

**Razão**: verificado, não presumido — `model Requirement` (`schema.prisma:2580`) não declara
`orgUnitId` em nenhum campo, e `GetFrameworkVersionComplianceSummaryUseCase`
(`apps/api/src/modules/compliance/application/compliance-summary/
get-framework-version-compliance-summary.usecase.ts`) não contém nenhuma referência a
`scope`/`Scope` — confirmado por busca textual no arquivo inteiro, zero ocorrências. Isto não é uma
lacuna a corrigir: é a modelagem correta de um framework normativo, que se aplica à organização
inteira, não a uma unidade (uma norma ISO 27001, por exemplo, não é "da unidade Financeiro" — é da
organização que a adotou). Fingir um filtro de unidade sobre uma tabela sem essa coluna produziria
um dos dois resultados errados: ou um `WHERE org_unit_id = ...` contra uma coluna que não existe
(erro de compilação/execução), ou uma junção inferida através de `Control` (nullable, N:M via
`RequirementControlLink`) para "adivinhar" uma unidade — exatamente a forma de vazamento que
`specs/006-assets-processes/STATE.md` §3 já registrou como um dos dois defeitos que aquela fase
existiu para fechar ("escopo... nunca por herança de vínculo").

**Consequência explícita no contrato**: `spec.md` FR-008 exige que a resposta de uma métrica de
Conformidade se declare `scopeApplicability: 'ORGANIZATION_WIDE'`, para que o cliente (e o usuário)
nunca presumam um filtro que não existe.

**Alternativa rejeitada**: inferir um "escopo efetivo" de Conformidade via os controles vinculados a
cada requisito (`RequirementControlLink`, N:M, com `Control.orgUnitId` nullable) — rejeitada porque
um requisito pode ter zero, um ou muitos controles vinculados, de unidades diferentes ou nenhuma
(`Control.orgUnitId` é anulável, `schema.prisma:1458`), então "a unidade deste requisito" não é uma
pergunta que tem resposta única — a mesma classe de ambiguidade que já motivou D-10 de
`006-assets-processes` a rejeitar herdar escopo de vínculo em vez de manter cada domínio dono da
própria coluna.

---

## D-9 — Códigos de `Indicator`/`Report` reusam o alocador compartilhado, dois prefixos novos

**Decisão**: `EntityCodePrefix` (`apps/api/src/grc/shared/domain/entity-code.service.ts`) ganha
`'IND'` e `'RPT'`, seguindo exatamente o padrão que `'CTL'`, `'FMK'`, `'AUD'`, `'AST'`, `'PRC'`,
`'INC'`, `'PRB'` já estabeleceram — cada um documentado, no próprio arquivo, como "reusing this
SAME allocator... rather than a Nth duplicated counter mechanism". `IndicatorDefinition.code` é
`IND-AAAA-NNNN`; `ReportDefinition.code` é `RPT-AAAA-NNNN`.

**Razão**: é a aplicação mecânica do precedente já estabelecido oito vezes no mesmo arquivo — o
próprio código já documenta a regra geral que esta fase segue ("data-model.md §1: 'duplicaria o
UPSERT ... ON CONFLICT do contador — a classe de defeito F-42'"), então introduzir um nono e décimo
prefixo é aplicar uma decisão já tomada, não tomar uma nova.

`IndicatorMeasurement` **não** ganha código próprio — como `FrameworkVersion`/`Requirement` já não
ganham (research.md D-14 de `004-compliance-management`, citado no próprio arquivo): um ponto de
medição já tem um identificador natural e estável para exibição (`indicatorDefinitionId` +
`computedAt`), e um código gerado só duplicaria essa referência.

**Alternativa rejeitada**: nenhuma — este é o único padrão que este repositório já usa para todo
identificador de negócio novo desde `003-controls-management`; propor outra coisa seria divergência
sem justificativa.

---

## D-10 — Exportação apenas em CSV, sem biblioteca nova; PDF/XLSX adiados

**Decisão**: `GET /reports/{id}/run` aceita `format=csv` e devolve `text/csv`, gerado por código
próprio (concatenação/escape manual de campos delimitados por vírgula) — sem nenhuma dependência
nova. Nenhum outro formato existe na v1.

**Razão**: verificado, não presumido — busca por `csv`, `xlsx`, `pdf`, `exceljs`, `papaparse`,
`json2csv` em `apps/api/package.json`, `apps/web/package.json` e no código-fonte de ambos os
pacotes não encontra nenhuma biblioteca de exportação real (os únicos acertos são
`apps/api/src/core/files/domain/magic-bytes.ts`, que detecta o tipo de arquivo **enviado pelo
usuário**, e nomes de campo de DTO de paginação — nenhuma relação com exportação de relatório).
CLAUDE.md §2 pede justificativa para toda dependência nova ("não introduzir dependências sem
justificativa"); CSV não precisa de nenhuma porque é texto delimitado, trivialmente gerável sem
biblioteca — não há uma dependência a justificar. PDF e XLSX, ao contrário, exigiriam introduzir
uma biblioteca de geração de documento/planilha (por exemplo, um renderizador de PDF), e nenhum
requisito desta fase pede um documento formatado — pedem uma linha por indicador, que CSV já serve
integralmente.

**Alternativas rejeitadas**:
- *PDF na v1* — exigiria escolher e justificar uma biblioteca nova sem nenhum requisito que
  demande um documento formatado (assinável, paginado, com cabeçalho institucional) em vez de dados
  tabulares.
- *XLSX na v1* — mesma razão; CSV já abre nativamente em qualquer planilha, cobrindo o caso de uso
  real ("levar os números para uma planilha") sem a dependência.
- *Nenhuma exportação na v1* — rejeitada porque US5 cenário 4 (`spec.md`) é um requisito explícito
  desta fase, e CSV custa zero dependências novas para atendê-lo.

---

## D-11 — Indicadores generaliza o Dashboard; não o absorve, não o substitui

**Decisão**: `GET /dashboard` continua existindo, sem crescer um sexto/sétimo/oitavo `area` por
domínio. `Indicators` é o novo módulo, com sua própria tela, que serve a mesma classe de números
(agregados, por escopo) de forma nomeada e navegável para os nove domínios.

**Razão**: lida diretamente no código antes de decidir — `GetDashboardUseCase`
(`apps/api/src/modules/risk/application/get-dashboard.usecase.ts`) tem exatamente cinco áreas,
todas gated por `risk:view`/`risk:approve`; nenhuma delas lê Controle, Conformidade, Auditoria,
Ativo, Processo, Incidente, Problema ou Ação por origem própria. Adicionar uma área por domínio ao
contrato do Dashboard repetiria, dentro do próprio Dashboard, o problema que motivou o registro de
"área planejada" existir (`core/dashboard/domain/planned-area-registry.ts`) — um contrato que
cresce a cada módulo novo, sem limite, e cujo teste de contrato (o "portão espelho" que
`specs/005-audit-findings/STATE.md` §3 já nomeia) precisaria ser atualizado a cada fase futura só
para o Dashboard continuar coerente.

`DashboardQueryService`
(`apps/api/src/modules/risk/infrastructure/dashboard-query.service.ts:1-40`) já prova o padrão de
agregação que `IndicatorMetricProvider` (D-4) generaliza: agregação **no banco** (`COUNT(*)
FILTER`), nunca em TypeScript, com um fragmento de escopo parametrizado por domínio
(`org_unit_id = ANY(...)`) — o mesmo padrão que `IndicatorMetricProvider` de cada domínio segue,
sem duplicar a regra de escopo em si (cada provider reusa a consulta/porta que já existe no próprio
módulo-fonte, nunca reimplementa o fragmento de escopo desse módulo).

**Alternativas rejeitadas**:
- *Expandir `GET /dashboard` com uma área por domínio novo* — o crescimento ilimitado de contrato
  já descrito acima, e uma segunda implementação completa de "Indicadores" embutida dentro do
  endpoint do Dashboard, competindo com o módulo desta própria fase.
- *`Indicators` substitui `GET /dashboard` inteiramente* — quebraria um contrato já em produção sem
  nenhum requisito que peça a remoção, e descartaria a UX já estabelecida de "abrir o app e ver
  Risco de relance" — a Constituição (CLAUDE.md §11) já define o Dashboard como "Dashboard GRC", não
  como propriedade exclusiva de Indicadores; os dois convivem, um como visão fixa de relance, outro
  como capacidade nomeada e navegável.

---

## D-12 — O mecanismo de "área planejada" do Dashboard é esvaziado nesta fase, não substituído por um novo registrante

**Decisão**: `core/dashboard/domain/default-planned-areas.ts` para de registrar `PROBLEMS` e
`INCIDENTS` (FR-038) — a mesma correção que o próprio arquivo já aplicou a `CONTROLS` em
2026-09-11. Depois desta fase, `getPlannedAreas()` devolve sempre `[]`, e nenhum módulo GRC de
negócio futuro se registra nele — a divulgação de "módulo ainda não construído" passa a ser
inteiramente responsabilidade de `navigation-registry.ts` (`status: 'planned'`), que já é a fonte
de verdade que a barra lateral usa hoje para os mesmos três nomes (`action-plans`, `indicators`,
`reports` — os três ainda `status: 'planned'` na navegação nesta data).

**Razão**: medido, não presumido — `apps/api/src/core/dashboard/domain/default-planned-areas.ts`
registra hoje `PROBLEMS` e `INCIDENTS` como `PLANNED`, mas os dois têm schema (`model Incident`,
`model Problem`), módulo (`modules/incidents`, `modules/problems`) e navegação
`status: 'implemented'` desde `008-incidents-problems` — o mesmo defeito que o comentário do
arquivo já nomeia para `CONTROLS` ("announcing it here as 'planned' told a real user a capability
already in production had not been built yet"), não corrigido ainda para os outros dois (Achado 1,
`spec.md`). O próprio arquivo já prevê, por escrito, o fim do seu ciclo de vida: "the moment one of
them gains a real module, THAT module's own composition root registers its own planned area (or,
once it has real data, contributes its own dashboard card through whatever mechanism replaces a
'planned' placeholder)". Esta fase é exatamente "o mecanismo que substitui o placeholder" — uma
tela de Indicadores nomeada e navegável é uma resposta mais completa a "este domínio tem dado real
agora" do que um sexto card fixo no Dashboard seria (D-11).

Manter o mecanismo vivo, mas vazio, em vez de removê-lo do código, é a escolha mais conservadora:
o contrato (`Dashboard.plannedAreas: PlannedArea[]`) não muda de forma, só de conteúdo — nenhum
cliente que já lê esse array quebra ao recebê-lo vazio.

**Alternativa rejeitada**: registrar `Indicators`/`Reports` como novas entradas de área planejada
até ganharem tela própria — rejeitada porque esta especificação já entrega as duas telas na mesma
fase (US1-US6); não há intervalo onde os dois precisem de um placeholder.

---

## D-13 — Seis permissões novas, todas reusando `PermissionAction` já existente

**Decisão**: `indicator:view`, `indicator:create`, `indicator:edit`, `report:view`,
`report:create`, `report:edit` — seis identificadores, todos combinando um recurso novo com um
`PermissionAction` (`VIEW`/`CREATE`/`EDIT`) que já existe desde a fundação
(`schema.prisma:111-121`). Adicionadas ao papel "Read Only" semeado (`indicator:view`/
`report:view`).

**Razão**: nenhuma operação desta fase precisa de um verbo que `PermissionAction` ainda não tenha —
não há aprovação (`APPROVE`), transição de estado (`TRANSITION` — `Indicator`/`Report` não têm
ciclo de vida com estados, só ativo/inativo, como `Asset`/`Process`), nem vínculo (`LINK` —
`Indicator` não cria vínculo com outro domínio GRC, só lê). A extensão ao papel "Read Only" segue a
regra geral que `specs/005-audit-findings/STATE.md` §5 registrou depois de encontrar "Audit Lead"
sem a própria leitura: um papel cuja descrição promete visibilidade ampla precisa nomear
explicitamente toda permissão de leitura nova, ou a promessa fica falsa silenciosamente — a mesma
lição, aplicada aqui antes de a lacuna existir, não depois de alguém a encontrar.

**Achado relacionado, fora do escopo desta especificação**: `apps/api/prisma/seed/platform.seed.ts`
não concede nenhuma permissão `incident:*`/`problem:*` a nenhum papel semeado, incluindo "Read
Only" — verificado por busca textual, zero ocorrências. É a mesma classe de lacuna que motiva esta
decisão, encontrada por já existir no repositório, não corrigida por esta especificação (que não
altera nenhum arquivo de `008-incidents-problems`). Registrada em `spec.md`, seção "Achados fora do
escopo desta especificação".

---

## D-14 — Relatório nunca calcula: delega a Indicador através de um port de fronteira, com uma fábrica na composição

**Decisão**: `ReportsModule` (`apps/api/src/modules/reports/reports.module.ts`) liga
`IndicatorCalculationPort` (`apps/api/src/shared/grc-ports/indicator-calculation.port.ts`) a um
`useFactory` que injeta o `IndicatorCalculationService` e o `INDICATOR_METRIC_CATALOG` que
`IndicatorsModule` já exporta — sem duplicar cálculo algum dentro de `modules/reports/**`.
`IndicatorsModule` é listado explicitamente no array `imports` de `ReportsModule`, nunca `@Global()`.
Nenhum arquivo de `modules/indicators/**` é editado para tornar isso possível — os dois símbolos já
eram públicos.

**Razão**: `modules/reports/**` não pode importar `modules/indicators/**` diretamente — a política de
isolamento de módulo (`apps/api/eslint.config.mjs`) proíbe um módulo de negócio de importar o
domínio/aplicação de outro diretamente — e `RunReportUseCase` precisa exatamente do valor que
`IndicatorCalculationService` já calcula (FR-025). CLAUDE.md §19.7 exige um único calculador; a única
forma de `RunReportUseCase` obter esse valor sem violar a fronteira de módulo é através de um port
definido em `shared/grc-ports/**` (o mesmo padrão que `risk-dashboard-metrics.port.ts`/
`control-metrics.port.ts` já usam para seus próprios módulos consumidores) e ligado na composição —
o único lugar (`apps/api/eslint.config.mjs`, categoria `composition`) autorizado a atravessar essa
fronteira. `IndicatorsModule` entra no array `imports` de forma explícita, não por `@Global()`,
seguindo o precedente já corrigido no commit `8135915`: aquele commit removeu `@Global()` dos oito
`*MetricsModule` de Indicadores exatamente porque uma dependência que só existe "por acaso" (visível
apenas porque algum outro módulo já importou o provedor antes) falha silenciosamente num grafo Nest
parcial que nunca importa o módulo de origem — o defeito de CLAUDE.md §19.10 que aquele commit corrige
para uma direção, e que `ReportsModule` evita repetir para a direção oposta (Relatório → Indicador)
ao declarar `IndicatorsModule` no próprio array `imports`, comentado citando o commit.

**Alternativas rejeitadas**:
- *Duplicar o cálculo dentro de `modules/reports/**`* — um segundo `RunReportUseCase` que lê os nove
  domínios-fonte por conta própria romperia CLAUDE.md §19.7 ("um único calculador") e duplicaria os
  onze provedores de métrica que `IndicatorsModule` já mantém, criando dois pontos de verdade para o
  mesmo valor computado.
- *`IndicatorsModule` como `@Global()`* — funcionaria enquanto algum outro módulo sempre importasse
  `IndicatorsModule` primeiro num grafo de teste parcial, mas é exatamente o defeito que `8135915`
  já pagou e corrigiu para os oito `*MetricsModule`; repeti-lo aqui seria reintroduzir a mesma classe
  de falha silenciosa (§19.10) na direção inversa.
- *`modules/reports/**` importar `modules/indicators/**` diretamente* — violaria a política de
  isolamento de módulo (`apps/api/eslint.config.mjs`) que já proíbe esse acoplamento direto entre
  módulos de negócio.

---

## D-15 — Chave de métrica desconhecida na criação: `422` em Indicador, `400` em Relatório

**Decisão**: `CreateIndicatorDefinitionRequestDto.metricKey`
(`apps/api/src/modules/indicators/presentation/dto/create-indicator-definition-request.dto.ts`)
valida `metricKey` só como string não vazia — nunca contra o enum fechado `IndicatorMetricKey`.
Pertencimento ao catálogo é checado dentro de `CreateIndicatorDefinitionUseCase`
(`apps/api/src/modules/indicators/application/create-indicator-definition.usecase.ts`), que responde
`422` quando a chave é desconhecida. Já `CreateReportDefinitionRequestDto.metricKeys`
(`apps/api/src/modules/reports/presentation/dto/create-report-definition-request.dto.ts`) valida cada
elemento do array com `@IsIn(Object.values(IndicatorMetricKey), { each: true })` diretamente no DTO,
respondendo `400` para um valor desconhecido — mesmo `CreateReportDefinitionUseCase`
(`apps/api/src/modules/reports/application/create-report-definition.usecase.ts`) recheando o mesmo
pertencimento por conta própria, como defesa em profundidade contra um chamador que contorne o DTO
(por exemplo, os próprios testes de integração desta fase).

**Razão**: confirmada no código, não presumida — nenhuma das duas rotas de criação usa `metricKey`
como parâmetro de rota; as duas recebem a chave (ou chaves) no corpo da requisição. A divergência é
outra: em Indicador, o pertencimento ao catálogo é agrupado, dentro do mesmo `422`, com dois outros
motivos que só podem ser resolvidos dentro do caso de uso — unicidade de `metricKey`, que exige
consulta ao banco (`findByMetricKey`), e a Invariante T1 (par ou nenhum de
`thresholdComparator`/`thresholdValue`). O próprio `422` de `createIndicatorDefinition` em
`indicators.openapi.yaml` nomeia os três motivos juntos ("Unknown `metricKey`; `metricKey` already
has a definition; or exactly one of `thresholdComparator`/`thresholdValue` was supplied without the
other"), e os três são deliberadamente respondidos de forma uniforme como erro de regra de negócio,
dentro do mesmo caso de uso. Em Relatório, a checagem de pertencimento de `metricKeys` não depende de
nenhuma leitura ao banco — é avaliável inteiramente a partir do corpo da requisição, com
`Object.values(IndicatorMetricKey)` (o enum gerado pelo Prisma), o mesmo dado estático que a
`@IsIn` do DTO já usa — e o próprio `reports.openapi.yaml` declara a escolha explicitamente: um valor
desconhecido "is rejected as malformed (400), not as a domain error, because it fails schema
validation before any business rule runs". Ou seja: a diferença real não é "rota vs. corpo" — é que
o conjunto de checagens de Indicador inclui uma consulta ao banco que não pode viver no DTO, e a
especificação optou por manter as três checagens relacionadas juntas e uniformes (todas `422`, todas
no caso de uso) em vez de fatiar só o pertencimento para o DTO; já o conjunto de checagens de
Relatório não tem nenhuma dependência de I/O, então cabe inteiramente na validação de schema (`400`),
e o contrato documenta essa escolha como proposital.

**Alternativas rejeitadas**:
- *Validar `metricKey` de Indicador também no DTO (`@IsIn`, `400`)* — separaria o pertencimento ao
  catálogo das outras duas checagens do mesmo `422` (unicidade, Invariante T1), que continuariam
  exigindo o caso de uso de qualquer forma; o resultado seria três motivos de falha relacionados
  espalhados por dois códigos de status HTTP diferentes, sem ganho de segurança (o caso de uso já
  precisa validar as outras duas).
- *Mover o pertencimento de `metricKeys` de Relatório para o caso de uso, sem `@IsIn` no DTO
  (`422`, como Indicador)* — funcionaria, mas descartaria uma validação que é inteiramente estática
  e sem I/O, forçando um payload malformado a percorrer autenticação e autorização antes de ser
  rejeitado; o próprio contrato já documenta a preferência por rejeitar cedo o que a validação de
  schema já consegue provar sozinha.
