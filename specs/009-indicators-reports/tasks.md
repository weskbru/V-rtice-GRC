# Tasks — Gestão de Indicadores e Gestão de Relatórios

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Research**: [research.md](./research.md) · **Contracts**:
[contracts/indicators.openapi.yaml](./contracts/indicators.openapi.yaml),
[contracts/reports.openapi.yaml](./contracts/reports.openapi.yaml)

**As sete perguntas de escopo desta fase estão decididas** (spec.md "Decisões do coordenador";
research.md D-1 a D-13). Nenhuma tarefa deste arquivo permanece bloqueada por decisão de produto em
aberto.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável — arquivos diferentes, sem dependência pendente
- **[US1]** a **[US6]**: a que user story de `spec.md` a tarefa pertence

---

## Fase 1 — Setup e migração

- [x] T001 Criar `apps/api/src/modules/indicators/{domain,application,infrastructure,presentation}`
      e `apps/api/src/modules/reports/{domain,application,infrastructure,presentation}`, com os
      `index.ts` de barril
- [x] T002 Adicionar ao `schema.prisma` os enums `IndicatorMetricKey` (onze valores, data-model.md
      §3), `IndicatorThresholdComparator` (data-model.md §4), e os modelos `IndicatorDefinition`,
      `IndicatorMeasurement`, `ReportDefinition` (data-model.md §1-§2) — nenhuma coluna
      `org_unit_id` em nenhum dos três (research.md D-8/D-6)
- [x] T003 Estender `AuditEntityType` com `INDICATOR`, `INDICATOR_MEASUREMENT`, `REPORT`;
      `ActionOriginType` com `INDICATOR`; `CommentableEntityType` com `INDICATOR`, por
      `ALTER TYPE ... ADD VALUE`, na mesma migração aditiva (data-model.md §5)
- [x] T004 Criar a migração e verificar, contra um banco descartável: nenhuma tabela existente
      muda de forma; contagens de `risks`, `controls`, `requirements`, `assets`, `processes`,
      `actions`, `incidents`, `problems`, `findings` idênticas antes/depois
- [x] T005 [P] Estender `EntityCodePrefix`/`ENTITY_CODE_PATTERN`
      (`grc/shared/domain/entity-code.service.ts`) com `'IND'` e `'RPT'` (research.md D-9)
- [x] T006 [P] Criar `apps/api/src/shared/messages/indicators.ts` e `reports.ts`, ligados em
      `user-messages.ts` — incluindo os onze rótulos pt-BR de `IndicatorMetricKey` (data-model.md
      §3) e o corpo da notificação de rompimento (US3)
- [x] T007 [P] Criar `apps/web/src/lib/messages/indicators.ts` e `reports.ts`, registrados em
      `index.ts`

**Checkpoint**: schema e catálogos existem; nenhum endpoint ainda é servido.

---

## Fase 2 — Fundação dos dois módulos (bloqueia todas as histórias)

- [x] T008 [P] Criar `indicator-permissions.ts`/`report-permissions.ts` com as seis permissões
      (`view/create/edit` × 2), reusando os valores existentes de `PermissionAction` — nenhum valor
      novo (research.md D-13)
- [x] T009 Registrar os dois conjuntos em `permission-catalogue.ts` via
      `combinePermissionDefinitions`; estender o papel semeado "Read Only"
      (`apps/api/prisma/seed/platform.seed.ts`) com `indicator:view`/`report:view` (research.md D-13)
- [x] T010 [P] Registrar `INDICATOR` em `registerCommentableEntityType`
      (`core/comments/domain/entity-registry.ts`) — só `CommentableEntityType`, nunca
      `AttachableEntityType` (spec.md FR-033)
- [x] T011 [P] Registrar as listas de campos auditáveis dos dois domínios no allow-list de
      auditoria (`INDICATOR`, `INDICATOR_MEASUREMENT`, `REPORT`), seguindo
      `registerRiskAuditAllowlists()`
- [x] T012 [P] `domain/indicator-metric-catalog.ts` — o mapa estático `IndicatorMetricKey ->
      { sourcePermission, scopeApplicability, shape }` (data-model.md §3); teste unitário provando
      que os onze valores do enum têm exatamente uma entrada cada, nem mais nem menos (o mesmo
      padrão exaustivo que `FindingStatus`/`ControlStatus` já tiveram desde a Fase 1/2)
- [x] T013 [P] `domain/indicator-threshold.ts` — `evaluateThresholdBreach(comparator, value,
      thresholdValue): boolean`, função pura, testada contra os quatro comparadores e o caso
      "nenhum limiar configurado" (spec.md FR-019)
- [x] T014 [P] `ScopedRepository`/leitura direta (sem escopo próprio) dos dois módulos, conforme a
      tabela de data-model.md §8

**Checkpoint**: os dois módulos existem, o catálogo de métricas e a avaliação de limiar são
testáveis isoladamente, nada ainda é servido por HTTP.

---

## Fase 3 — US1: Valor atual de um indicador, por escopo (P1) 🎯 MVP

- [x] T015 [P] [US1] Teste de contrato: `GET /indicators` (catálogo de definições) —
      `contracts/indicators.openapi.yaml`
- [x] T016 [P] [US1] Teste de contrato: `POST /indicators` (criar definição)
- [x] T017 [P] [US1] Teste de contrato: `GET /indicators/{metricKey}/current`
- [x] T018 `CreateIndicatorDefinitionUseCase` — valida Invariant T1 (limiar par-ou-nenhum,
      data-model.md §1), gera código via `entity-code.service.ts`, audita a criação
- [x] T019 `IndicatorMetricProvider` de Risco — delega a `DashboardQueryPort.getRiskProfile`/
      `getTreatmentActionsSummary` já existentes (nenhuma consulta nova); cobre
      `RISK_TOTAL_BY_LEVEL`/`RISK_TREATMENT_OVERDUE_COUNT`
- [x] T020 [P] `IndicatorMetricProvider` de Controle — `CONTROL_INACTIVE_COUNT`, consulta própria
      de `modules/controls` sobre `ControlStatus`
- [x] T021 [P] `IndicatorMetricProvider` de Conformidade — `COMPLIANCE_PERCENTAGE`, delega a
      `GetFrameworkVersionComplianceSummaryUseCase`; **sem** predicado de escopo (research.md D-8) —
      teste unitário prova que a assinatura do provider não recebe `ScopeFilter` neste caso
      específico, único entre os onze
- [x] T022 [P] `IndicatorMetricProvider` de Auditoria — `AUDIT_ENGAGEMENT_OPEN_COUNT`
- [x] T023 [P] `IndicatorMetricProvider` de Achado — `FINDING_OPEN_COUNT_BY_SEVERITY`
- [x] T024 [P] `IndicatorMetricProvider` de Ativo — `ASSET_INACTIVE_COUNT`
- [x] T025 [P] `IndicatorMetricProvider` de Processo — `PROCESS_INACTIVE_COUNT`
- [x] T026 [P] `IndicatorMetricProvider` de Ação — `ACTION_OVERDUE_COUNT`, delega a
      `isActionOverdue` (`grc/shared/domain/overdue.service.ts`) — nenhuma segunda regra de atraso
- [x] T027 [P] `IndicatorMetricProvider` de Incidente — `INCIDENT_OPEN_COUNT_BY_SEVERITY`
- [x] T028 [P] `IndicatorMetricProvider` de Problema — `PROBLEM_OPEN_COUNT_BY_SEVERITY`
- [x] T029 `IndicatorCalculationService` — despacha para o provider da chave, aplica
      `evaluateThresholdBreach` (T013) quando a definição correspondente existir; **único** ponto
      de cálculo (CLAUDE.md §19.7) — nenhum provider é chamado de nenhum outro lugar do código
- [x] T030 `GetIndicatorCurrentValueUseCase` — resolve escopo uma vez, exige `indicator:view` **e**
      `sourcePermission` da chave (FR-006), responde `404` para chave desconhecida (FR-010)
- [x] T031 Controller + DTOs + mappers de `GET /indicators`, `POST /indicators`,
      `GET /indicators/{metricKey}/current`
- [x] T032 [US1] Teste de integração, um por domínio-fonte (nove testes — SC-001): valor de cada
      `IndicatorMetricKey` sob escopo `UNIT` bate com uma contagem manual filtrada pela mesma
      unidade contra o banco de teste

**Checkpoint**: um usuário autorizado consegue ver o valor atual de qualquer indicador do catálogo,
corretamente escopado — a fase já entrega valor demonstrável sozinha (MVP, ver "MVP" abaixo).

---

## Fase 4 — US2: Histórico organização inteira (P1)

- [x] T033 [P] [US2] Teste de contrato: `POST /indicators/{metricKey}/measurements`
- [x] T034 [P] [US2] Teste de contrato: `GET /indicators/{metricKey}/measurements`
- [x] T035 `CreateIndicatorMeasurementUseCase` — exige `indicator:edit` **e**
      `ScopeFilter.kind === 'GLOBAL'` do chamador (recusa `403` antes de qualquer leitura de fonte,
      research.md D-6); chama `IndicatorCalculationService` (T029, nunca uma segunda
      implementação); grava `value`/`valueByBucket` conforme `shape` do catálogo (Invariant M1);
      audita a criação com o valor calculado como "valor posterior"
- [x] T036 `ListIndicatorMeasurementsUseCase` — mesma dupla exigência de T035, paginado por
      `computedAt`
- [x] T037 Controller + DTOs + mappers das duas operações — nenhum verbo `PATCH`/`PUT`/`DELETE`
      declarado no contrato para este recurso (SC-002)
- [x] T038 [US2] Teste de integração: registrar dois pontos em momentos diferentes; confirmar
      ordem, imutabilidade (nenhuma rota de edição existe — verificado por chamar
      `PATCH`/`DELETE` contra a rota e receber `404`/`405` de roteamento, nunca `403` de
      autorização — a rota nem existe); confirmar `403` para um chamador com escopo `UNIT`, nos
      dois sentidos (escrita e leitura)

**Checkpoint**: um usuário de escopo global consegue construir e ler uma série histórica; um
usuário de escopo `UNIT` está corretamente impedido dos dois lados.

---

## Fase 5 — US3: Limiar e notificação (P1)

- [x] T039 [US3] Teste de integração: um `IndicatorMeasurement` cujo valor rompe o limiar
      configurado produz exatamente uma linha em `notifications`, endereçada ao `ownerUserId` do
      indicador, lida pelo repositório real (não um mock de `NotificationService` — plan.md,
      tabela de riscos)
- [x] T040 [US3] Teste de integração: um valor que não rompe produz zero notificações
- [x] T041 [US3] Teste unitário: um `IndicatorDefinition` sem limiar configurado nunca aciona
      `breached` (T013 já cobre a função pura; este teste cobre o caso de ponta a ponta através de
      T035)
- [x] T042 Corpo da notificação (`shared/messages/indicators.ts`, T006) nomeia o indicador e o
      valor calculado, com `entityType: CommentableEntityType.INDICATOR` (T010) como link profundo

**Checkpoint**: rompimento de limiar produz notificação real, verificável sem instrumentação
especial — primeiro produtor real de `NotificationService` (§19.10).

---

## Fase 6 — US4: Ação como destino (P1)

- [x] T043 Migração separada (não misturada à de T003): `ActionOriginType += INDICATOR`
      (`ADD VALUE IF NOT EXISTS`), acompanhada, na mesma tarefa, por `IndicatorActionOriginAccessor`
      com os quatro métodos exigidos por `test/unit/action-model-convergence-guard.spec.ts`
      (research.md D-5) — nunca em tarefas separadas
- [x] T044 `resolveOriginScope`/`listOriginIdsInScope` tratam todo `IndicatorDefinition` como
      visível a qualquer chamador com `indicator:view` (spec.md FR-021 — sem coluna de unidade a
      filtrar, research.md D-8)
- [x] T045 Registrar `IndicatorActionOriginAccessor` em `IndicatorsModule`
- [x] T046 [US4] Teste de integração: `POST /actions` com `originType: INDICATOR` resolve, aparece
      em "Minhas ações", obedece à mesma tabela de transição de toda outra `Action`; o guard de
      convergência falha se a chamada de registro for removida (mesma prova por remoção que
      `008-incidents-problems` já fez)

**Checkpoint**: `Action` de origem `INDICATOR` funciona de ponta a ponta — fecha US4.

---

## Fase 7 — US5: Definição e execução de relatório, com exportação CSV (P1)

- [x] T047 [P] [US5] Teste de contrato: `GET /reports`
- [x] T048 [P] [US5] Teste de contrato: `POST /reports`
- [x] T049 [P] [US5] Teste de contrato: `GET /reports/{id}/run` (JSON)
- [x] T050 [P] [US5] Teste de contrato: `GET /reports/{id}/run?format=csv`
- [x] T051 `CreateReportDefinitionUseCase` — valida `metricKeys` não vazio e cada elemento existente
      em `IndicatorMetricKey`, gera código `RPT-`, audita a criação
- [x] T052 `RunReportUseCase` — para cada `metricKey`, chama `IndicatorCalculationService` (T029,
      **o mesmo** de US1, nunca uma segunda implementação, FR-025); quando o chamador não tem a
      `sourcePermission` daquela chave, marca o item `available: false` sem interromper os demais
      (FR-026, SC-006) — nunca `403` da operação inteira
- [x] T053 `ExportReportCsvUseCase` — serializa o resultado de T052 em `text/csv` (cabeçalho +
      uma linha por item), escrito à mão (research.md D-10, sem biblioteca nova)
- [x] T054 Controller + DTOs + mappers das quatro operações
- [x] T055 [US5] Teste de integração: relatório com três `metricKey` de domínios diferentes,
      executado por um usuário sem permissão de fonte para um deles — confirma os outros dois
      presentes e o terceiro `available: false` (SC-006)
- [x] T056 [US5] Teste de integração: o mesmo relatório executado por dois usuários de escopos
      organizacionais diferentes devolve valores diferentes para métricas escopadas por unidade, e
      o mesmo valor para `COMPLIANCE_PERCENTAGE`

**Checkpoint**: um relatório de domínios cruzados existe, executa e exporta — fecha a segunda
metade da fase.

---

## Fase 8 — Interface (§18) (P2)

**Critérios de aceitação explícitos, por CLAUDE.md §18.12** (obrigatório para trabalho substancial
de interface — não implícito):

- **Hierarquia visual**: o valor calculado de cada indicador é o elemento dominante do cartão;
  rótulo da métrica, unidade organizacional aplicável e "atualizado em" são metadados secundários,
  visivelmente subordinados (§18.11, "a informação importante domina os metadados secundários").
- **Estados de interação**: cartão de indicador com `available: false` (dentro de um relatório) é
  visualmente distinto de um cartão com valor — nunca um número zerado sem explicação (§18.11,
  "erros são compreensíveis sem depender só de cor").
- **Responsividade**: grade de cartões de indicador colapsa para uma coluna em largura de telefone
  (~400px), sem rolagem horizontal acidental; tabela de histórico usa o mesmo padrão de rolagem
  contida que toda outra tabela desta plataforma já usa.
- **Acessibilidade**: badge de rompimento de limiar comunica o estado por ícone/texto, nunca só
  cor (§18.8); gráfico de tendência histórica tem uma alternativa textual/tabular acessível a
  leitor de tela — a mesma lição que F-28 já pagou para o Dashboard (varredura de acessibilidade
  rodando **depois** do gráfico renderizar, nunca contra o esqueleto).
- **Reuso do Design System**: cartão de métrica, badge de nível e badge de rompimento são
  componentes de `packages/design-system`, não implementações locais de `features/indicators`
  (§18.3/§18.12) — se um componente equivalente não existir ainda (por exemplo, "badge de
  rompimento de limiar" é um conceito novo), ele é construído no Design System, não no módulo.
- **Verificação renderizada**: capturado nos dois temas com
  `apps/web/scripts/ui-capture.mjs`, larguras 1440 e ~400px, e revisado como imagem antes de a
  tarefa ser aceita — nunca só "o componente compila".

Tarefas:

- [x] T057 [P] [US6] Cartão de métrica genérico (Design System) — número dominante, unidade,
      indicador de disponibilidade; reusa badge de nível de risco já existente para métricas
      `BY_BUCKET`. **Ressalva**: entregue no commit `48b316b`, mas nenhuma tela ainda o consome —
      verificação renderizada (§18.1/§18.11) segue pendente até T060/T061/T066.
- [x] T058 [P] [US6] Badge de rompimento de limiar (Design System) — ícone + texto, nunca só cor.
      **Ressalva**: mesma pendência de verificação renderizada de T057 acima — commit `48b316b`,
      sem tela consumidora, portão do §18.11 aberto até T060/T061/T066.
- [x] T059 [P] [US6] Componente de tendência histórica com alternativa textual/tabular acessível.
      **Ressalva**: mesma pendência de verificação renderizada de T057/T058 acima — commit
      `48b316b`, sem tela consumidora, portão do §18.11 aberto até T060/T061/T066.
- [x] T060 `app/(app)/indicators/` — catálogo, valor atual, histórico (para escopo `GLOBAL`).
      **Ressalva**: a verificação renderizada desta tela foi feita enquanto o banco de
      desenvolvimento ainda recusava as seis permissões novas (dado de seed defasado — ver
      `STATE.md`); a recaptura com dado real, permissão correta e portão do §18.11 é parte de
      T066, ainda **em andamento**.
- [x] T061 `app/(app)/reports/` — catálogo, criação, execução, botão de exportação CSV.
      **Ressalva**: mesma pendência de T060 acima — a verificação renderizada de Indicadores foi
      feita sob o mesmo banco com permissão defasada; a recaptura dos dois módulos é parte de
      T066, ainda **em andamento**.
- [x] T062 `features/indicators/`, `features/reports/` — types, api, hooks de estado de catálogo
      (mesmo padrão de `use-incident-register-state.ts`). **Ressalva**: mesma pendência de T060/T061
      acima — verificação renderizada completa depende da recaptura de T066, ainda **em andamento**.
- [x] T063 `navigation-registry.ts` — `id: 'indicators'`/`'reports'` ganham `requiredPermission`
      (`indicator:view`/`report:view`) e `href`, saem de `status: 'planned'` para
      `status: 'implemented'`, na mesma tarefa que T060/T061. **Entregue no commit `d31e140`**:
      os dois registros ganham `requiredPermission`/`href` e `status: 'implemented'`; o cabeçalho
      passa a mostrar o rótulo pt-BR em vez do fallback que humanizava o segmento de URL.
- [ ] T064 **OBSOLETA — não executar.** Verificado em 2026-09-11, contra o commit `795343b`: o
      trabalho que esta tarefa pede já foi entregue pelo commit `cffb553`, ANTES de esta fase
      começar. `core/dashboard/domain/default-planned-areas.ts` já não registra `PROBLEMS` nem
      `INCIDENTS` (`registerDefaultPlannedAreas()` registra zero áreas hoje, com o próprio comentário
      do arquivo explicando por quê), e as chaves órfãs correspondentes já foram removidas de
      `apps/api/src/shared/messages/dashboard.ts` (`plannedAreaLabels: {}`) na mesma correção. Não há
      mais o que fazer aqui — a tarefa fica registrada, não apagada, e não deve ser marcada `[x]`
      como se tivesse sido executada por esta fase; ela nunca precisou ser. Ver
      `spec.md`, "Achados fora do escopo desta especificação", achado 1, para o registro completo da
      correção. Descrição original, preservada abaixo: `core/dashboard/domain/
      default-planned-areas.ts` — remove os registros de `PROBLEMS` e
      `INCIDENTS` (fecha o Achado 1 de `spec.md`, FR-038); remove as duas chaves órfãs
      correspondentes de `apps/api/src/shared/messages/dashboard.ts` na mesma tarefa (evita repetir
      o órfão que `CONTROLS` já deixou); teste de contrato confirma `plannedAreas: []` para todo
      chamador (SC-009)
- [x] T065 [P] [US6] Varredura de acessibilidade automatizada (axe), dois temas, telas de
      Indicadores e Relatórios com conteúdo real renderizado (não o esqueleto). **Entregue no
      commit `d31e140`**: doze cenários axe cobrindo catálogo, detalhe (aba "Visão geral" e aba
      "Histórico" com o `<svg>` do Recharts já pintado — a lição do F-28 aplicada de propósito) e
      os fluxos de Relatório, nos dois temas, com medição registrada e relatório real na base de
      dados da suíte (não um catálogo vazio que passaria sem provar nada). Suíte completa de
      acessibilidade: 99 de 99, lida até o fim.
- [x] T066 [P] [US6] Captura renderizada com `ui-capture.mjs`, dois temas, revisão manual contra o
      portão do §18.11. **Entregue no commit `d31e140`**: capturas nos dois temas, larguras 1440 e
      ~400px. Confirmado pela revisão: o valor calculado domina o cartão, o catálogo mostra a
      distribuição real, o gráfico de histórico desenha série real sobre tabela populada, campos
      obrigatórios são inconfundíveis, o item de navegação ativo é visível, e a grade colapsa para
      uma coluna sem rolagem horizontal. Foco de teclado não foi fotografado — registrado como NÃO
      VERIFICADO em vez de presumido, já que nenhum componente novo de interação foi introduzido e
      os componentes compartilhados já têm cobertura de teclado por outras telas.

**Checkpoint**: as telas novas existem, são acessíveis, verificadas renderizadas, e o mecanismo de
área planejada do Dashboard está correto. **Correção de 2026-09-11**: "está corrigido" descrevia
originalmente um resultado desta fase (via T064); verificado contra `795343b` que o mecanismo já
estava corrigido pelo commit `cffb553` ANTES de esta fase começar — T064 está marcada obsoleta acima.
O checkpoint permanece verdadeiro sobre o estado final (o mecanismo está, de fato, correto), mas não
por trabalho desta fase.

---

## Fase 9 — Validação e fechamento

- [x] T067 Medir a linha de base de testes antes desta fase (unit/contrato/integração/web) e
      confirmar a mesma contagem depois, exceto onde um teste mudou por um FR desta fase — citando
      o FR em cada mudança (SC-007). **Fechada pela medição de fechamento do coordenador, commit
      `d31e140`** (`STATE.md` §14): antes (`795343b`) → depois (`d31e140`) — contrato 728 → 807,
      unidade da API 485 → 569, integração 235 → 258, unidade da web 596 → 663. Nenhum teste
      removido, confirmado por filtro de diff. A análise anterior desta tarefa (§12 de `STATE.md`,
      preservada) identificara sete commits de manutenção pré-existente dentro da mesma janela sem
      FR de 009 próprio (Grupo C) — tratados como fora do perímetro de SC-007 por pertencerem a
      `008-incidents-problems`/manutenção geral, decisão do coordenador registrada em `STATE.md`
      §14.
- [x] T068 Acrescentar `contracts/indicators.openapi.yaml` e `contracts/reports.openapi.yaml` a
      `CONTRACT_SOURCES` de `apps/api/test/contract/contract-coverage.spec.ts` **na mesma tarefa**
      que os contratos são criados (T015-T017/T033-T034/T047-T050) — não depois; é exatamente a
      omissão que `specs/005-audit-findings/STATE.md` §3 registra ter deixado duas operações
      inteiras sem nenhum teste apesar de marcadas concluídas. **Entregue no commit `311549c`**:
      as cinco operações contratadas sem implementação (`listIndicatorMetricKeys`,
      `getIndicatorDefinition`, `updateIndicatorDefinition`, `getReportDefinition`,
      `updateReportDefinition`) foram implementadas antes de os dois contratos entrarem em
      `CONTRACT_SOURCES` — 55 arquivos / 807 testes de contrato, VERIFICADO na medição de
      fechamento (§14 de `STATE.md`).
- [x] T069 Guarda estrutural (SC-005): nenhuma tabela desta fase declara coluna de tarefa, arquivo
      ou aprovação em paralelo ao que `Action`/`Evidence`/`AttachableEntityType`/
      `ApprovableEntityType` já fornecem — validada plantando um contra-exemplo deliberado e
      confirmando que a guarda falha antes de aceitá-la contra o código real (a lição de
      `specs/006-assets-processes/STATE.md` §2.4, aplicada desde a criação da guarda, não depois de
      alguém a encontrar vácua)
- [x] T070 Rodar a suíte completa (`test:unit`, `test:contract`, `test:integration`, `test:e2e`) e
      registrar o resultado em um `STATE.md` desta fase, seguindo o padrão de `005`/`006`. **Medição
      de fechamento do coordenador, em série, contra o commit `d31e140`** (`STATE.md` §14): unidade
      da API 57 arquivos/569 testes, unidade da web 123/663, contrato 55/807, integração 52/258;
      typecheck, lint, format:check e openapi:check limpos; audit passa (F-57 abaixo do limiar);
      builds de API, web, design system e api-types; **E2E Chromium 129 de 129, 7,5 minutos**, com
      um único worker Playwright — com o padrão de quatro workers a suíte falhava (o `ThrottlerGuard`
      global devolvia `429` até no login, F-59 atualizado com a evidência das três execuções).
- [x] T071 Revisão final comparando `Indicator` e `Report` arquivo a arquivo — toda divergência de
      forma cita o FR ou D-N que a justifica (research.md D-1, D-8). Executada e registrada em
      `STATE.md` §13 (estrutura de diretório, mecanismo de delegação de cálculo, assimetria de
      teste unitário entre os dois "create" use case, e os itens verificados como consistentes sem
      achado) — três pendências deixadas para o coordenador em §13.5, nenhuma bloqueando o
      fechamento da fase.

---

## Dependências

- Fase 1 bloqueia a Fase 2. Fase 2 bloqueia as Fases 3-8.
- Fase 3 (US1) é a única com dependência zero das demais fases de negócio — é o MVP (abaixo).
- Fase 4 (US2) depende de 3 (precisa de `IndicatorCalculationService`, T029, para calcular o valor
  de cada ponto de medição).
- Fase 5 (US3) depende de 4 (precisa de `IndicatorMeasurement` existir para ter algo cujo
  rompimento notificar).
- Fase 6 (US4) depende de 3 (precisa de `IndicatorDefinition` existir para ser origem de uma
  `Action`) — pode correr em paralelo às Fases 4/5, por times/agentes diferentes.
- Fase 7 (US5) depende de 3 (precisa de `IndicatorCalculationService` para compor) — pode correr em
  paralelo às Fases 4/5/6.
- Fase 8 (interface) depende de 3, 4, 5, 6 e 7 terem alguma superfície para renderizar.
- Fase 9 depende de todas as anteriores.

## MVP

Fases 1-3 (Setup, Fundação, US1) entregam a capacidade de ver o valor atual de qualquer indicador
do catálogo, corretamente escopado, pela API — o menor corte que já produz valor demonstrável,
seguindo a mesma definição de MVP que `006-assets-processes/tasks.md` e
`008-incidents-problems/tasks.md` já usaram para suas próprias primeiras user stories.

## Cobertura

Catorze operações de contrato (três de `GET /indicators`/`POST /indicators`/
`GET /indicators/{metricKey}/current`, duas de medição, quatro de relatório/exportação, mais as
implícitas de listagem), cada uma com teste de contrato antes da implementação (T015-T017,
T033-T034, T047-T050); nove testes de integração de paridade de escopo, um por domínio-fonte
(T032, provando SC-001); dois testes de integração de notificação (T039-T040, provando SC-003); um
teste de integração de convergência de `Action` (T046, provando US4); dois testes de integração de
execução de relatório cruzado (T055-T056, provando SC-006); guarda estrutural de "nenhuma tabela
paralela" (T069, provando SC-005), validada por contra-exemplo antes de aceita; E2E dos dois
caminhos completos e do escopo organizacional (T065-T066) fechando a mesma classe de lacuna que
F-55 já registrou para os módulos anteriores.
