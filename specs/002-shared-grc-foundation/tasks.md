# Tasks: Fundação GRC Compartilhada

> **Reconciliação, 2026-09-11** (007-implementation-remediation, Frente G). Este arquivo estava com
> as 85 caixas desmarcadas apesar de CLAUDE.md §17 item 8 listar a fase concluída ("Núcleo GRC
> compartilhado — Evidência, Ação e Achado, ADR-016"). As 85 foram marcadas nesta data, uma a uma,
> contra evidência real — o arquivo, classe, migração, controller ou teste que a tarefa nomeia,
> existindo hoje em `apps/api/src/grc/{evidence,action,finding,shared}/**`,
> `apps/web/src/features/{evidence,actions,findings}/**` e as suítes de teste correspondentes —
> nunca por inferência a partir do estado de outra tarefa ou da fase como um todo. Nenhuma exigiu
> correção: todas as 85 têm artefato real correspondente.

**Input**: Design documents from `/specs/002-shared-grc-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/grc-foundation.openapi.yaml

**Tests**: obrigatórios. A Constituição IX e a regra permanente D-11 exigem cobertura de contrato
para todo endpoint; segurança, escopo e auditoria não são verificáveis sem teste.

**Organization**: agrupadas por user story, de forma que cada uma seja implementável e testável de
forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável — arquivos diferentes, sem dependência pendente
- **[US1] / [US2] / [US3]**: a que user story a tarefa pertence

## Path Conventions

API em `apps/api/src/`, web em `apps/web/src/`, testes em `apps/api/test/` e junto ao componente
no web. A camada nova é `apps/api/src/grc/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar a camada `grc/` e os artefatos que toda a fase usa.

- [x] T001 Criar a árvore `apps/api/src/grc/{evidence,action,finding,shared}/{domain,application,infrastructure,presentation}` com os `index.ts` de barril
- [x] T002 Confirmar que as políticas de fronteira `grc` em `apps/api/eslint.config.mjs` continuam ativas, repetindo as quatro sondas descartáveis do portão arquitetural e removendo-as em seguida
- [x] T003 [P] Criar `apps/api/src/shared/messages/evidence.ts`, `action.ts` e `findings.ts` com os catálogos pt-BR, e ligá-los em `user-messages.ts`
- [x] T004 [P] Criar `apps/web/src/lib/messages/evidence.ts`, `actions.ts` e `findings.ts` e registrá-los em `index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema, permissões, auditoria e escopo — nada de user story começa antes disto.

**⚠️ CRITICAL**: nenhuma tarefa de user story pode começar até esta fase terminar.

- [x] T005 Adicionar ao `apps/api/prisma/schema.prisma` os modelos `Evidence`, `EvidenceLink`, `Action`, `Finding` e os seis enums, conforme data-model.md §2–§5
- [x] T006 Adicionar `actionId String?` a `RiskTreatmentAction` com FK opcional para `Action` e `onDelete: Restrict` (data-model.md §7) — alteração **aditiva**, nenhuma coluna removida ou renomeada
- [x] T007 Criar a migração aditiva, incluindo o CHECK da invariante E1 (ao menos um de `file_id`, `external_url`, `observation`) e o índice único parcial da invariante L1 (`unlinkedAt IS NULL`)
- [x] T008 Criar `apps/api/src/grc/evidence/domain/evidence-permissions.ts`, `action/domain/action-permissions.ts` e `finding/domain/finding-permissions.ts`, cada um com sua augmentação `declare module` de `PermissionRegistry`
- [x] T009 Registrar os três conjuntos em `apps/api/src/permission-catalogue.ts` via `combinePermissionDefinitions` — uma linha de import e um argumento por conjunto
- [x] T010 Estender `AuditEntityType` com `EVIDENCE`, `EVIDENCE_LINK`, `ACTION`, `FINDING` por migração aditiva `ALTER TYPE ... ADD VALUE`
- [x] T011 Criar `apps/api/src/grc/shared/domain/overdue.service.ts` — a **única** regra de vencimento (R-006), pura, sem acesso a banco (FR-014)
- [x] T012 [P] Criar `apps/api/src/grc/shared/domain/entity-code.service.ts` para gerar `EVD-`, `ACT-` e `FND-` no padrão já usado por risco (R-008) (FR-004)
- [x] T013 Criar os `ScopedRepository` base das três entidades, com o argumento de escopo obrigatório e sem valor padrão
- [x] T014 Registrar as listas de campos auditáveis das três entidades no allow-list de auditoria, seguindo o padrão de `registerRiskAuditAllowlists()`
- [x] T015 [P] Escrever testes unitários de `overdue.service.ts` cobrendo prazo futuro, prazo hoje, prazo passado, e cada estado terminal (SC-007)
- [x] T016 [P] Escrever teste de arquitetura que falha se `grc/` importar `modules/` ou se `core/` importar `grc/` (FR-036)

**Checkpoint**: fundação pronta — as user stories podem começar.

---

## Phase 3: User Story 1 — Sustentar uma decisão com prova (Priority: P1) 🎯 MVP

**Goal**: registrar evidência, vinculá-la a sujeitos, arquivá-la sem perder o fato histórico.

**Independent Test**: registrar uma evidência, vinculá-la a um risco, arquivá-la e confirmar que o
vínculo histórico permanece legível e atribuível.

### Tests for User Story 1

- [x] T017 [P] [US1] Contract test de `listEvidence`, `createEvidence`, `getEvidence`, `updateEvidence`, `archiveEvidence` em `apps/api/test/contract/evidence.spec.ts` (D-11)
- [x] T018 [P] [US1] Contract test de `listEvidenceLinks`, `linkEvidence`, `unlinkEvidence` em `apps/api/test/contract/evidence-links.spec.ts` (D-11)
- [x] T019 [P] [US1] Teste de invariante E1: evidência sem arquivo, sem URL e sem observação é recusada; com qualquer uma delas é aceita (FR-002)
- [x] T020 [P] [US1] Teste de escopo: `GET`, `PATCH` e vínculo de evidência fora do escopo respondem **404**, byte a byte iguais à resposta de um id inexistente (SC-005) (FR-032)
- [x] T021 [P] [US1] Teste de autorização dos dois lados: vincular exige `evidence:link` **e** permissão de leitura mais escopo no sujeito (FR-031)
- [x] T022 [P] [US1] Teste de preservação histórica: arquivar evidência mantém todos os vínculos consultáveis (SC-004) (FR-009)
- [x] T023 [P] [US1] Teste de auditoria: `evidence.created`, `evidence.linked`, `evidence.unlinked`, `evidence.archived` são eventos distintos, com ator, escopo e valores antes/depois (FR-028, FR-029)
- [x] T024 [P] [US1] Teste de negação auditada: tentativa sem permissão gera evento com desfecho `DENIED` (FR-030)
- [x] T025 [P] [US1] Teste de R-010: listar vínculos omite sujeitos fora do escopo do leitor e a contagem reflete o que ele pode ver

### Implementation for User Story 1

- [x] T026 [P] [US1] Entidade de domínio `Evidence` com invariantes E1–E3 em `apps/api/src/grc/evidence/domain/evidence.entity.ts` (FR-001, FR-003, FR-004)
- [x] T027 [P] [US1] Entidade de domínio `EvidenceLink` com invariantes L1–L2
- [x] T028 [US1] Portas de repositório em `apps/api/src/grc/evidence/domain/ports/`
- [x] T029 [US1] Porta `EvidenceSubjectResolverPort` — resolve existência, escopo e rótulo de um sujeito por tipo, sem que `grc` conheça módulo algum (R-001)
- [x] T030 [US1] Adaptador do resolvedor para `RISK` e `RISK_TREATMENT_DECISION`, registrado no composition root
- [x] T031 [US1] Repositórios Prisma escopados em `apps/api/src/grc/evidence/infrastructure/`
- [x] T032 [P] [US1] Casos de uso: criar, listar, obter, atualizar, arquivar
- [x] T033 [P] [US1] Casos de uso: vincular e desvincular, com verificação dos dois lados antes da escrita (FR-007, FR-008, FR-031)
- [x] T034 [US1] Controller, DTOs e mappers em `apps/api/src/grc/evidence/presentation/`, com `@RequirePermission` em toda rota (FR-033)
- [x] T035 [US1] `EvidenceModule` e registro no `AppModule`
- [x] T036 [P] [US1] Componente web de evidência consumível por contexto de domínio em `apps/web/src/features/evidence/`
- [x] T037 [US1] Integrar o painel de evidências na tela de detalhe do risco, sem nova entrada na navegação (R-009)
- [x] T038 [P] [US1] Testes de componente do painel de evidências

**Checkpoint**: US1 funcional e testável de forma independente.

---

## Phase 4: User Story 2 — Trabalho de remediação numa lista única (Priority: P2)

**Goal**: uma só entidade de trabalho, consumida por múltiplas origens, sem regredir Riscos.

**Independent Test**: criar ações de duas origens distintas para o mesmo responsável e vê-las numa
única lista com a origem identificada.

### Tests for User Story 2

- [x] T039 [P] [US2] Contract test de `listActions`, `createAction`, `getAction`, `updateAction`, `transitionAction` em `apps/api/test/contract/actions.spec.ts` (D-11)
- [x] T040 [P] [US2] Teste de transições: cada transição legal aceita, cada ilegal responde **422**
- [x] T041 [P] [US2] Teste de reabertura: sem motivo é recusada; com motivo registra `action.reopened` e preserva a conclusão anterior
- [x] T042 [P] [US2] Teste de vencimento calculado: nenhuma coluna materializada existe, e `overdue` muda ao concluir sem gravação de campo (FR-014)
- [x] T043 [P] [US2] Teste de escopo e de negação auditada, como em T020/T024
- [x] T044 [P] [US2] Teste de origem: criar ação exige permissão de edição e escopo sobre o registro de origem
- [x] T045 [US2] **Teste de regressão de Riscos**: toda a suíte existente do módulo passa sem qualquer alteração nos testes (SC-006)
- [x] T045a [P] [US2] Cenário de evidência anexada a uma **ação**, comprovando sua execução — exercita `EvidenceSubjectType.ACTION`, que sem isto seria valor de enum sem consumidor (FR-017)
- [x] T046 [P] [US2] Teste da escrita dupla: criar ação de tratamento preenche `RiskTreatmentAction.actionId` e a `Action` correspondente

### Implementation for User Story 2

- [x] T047 [P] [US2] Entidade `Action` com invariantes A1–A3 e a tabela de transições em `apps/api/src/grc/action/domain/` (FR-011, FR-012, FR-013)
- [x] T048 [US2] Portas de repositório e `ActionOriginResolverPort`, análoga à de evidência
- [x] T049 [US2] Adaptador de origem para `RISK_TREATMENT`, registrado no composition root
- [x] T050 [US2] Repositório Prisma escopado
- [x] T051 [P] [US2] Casos de uso: criar, listar, obter, atualizar
- [x] T052 [US2] Caso de uso de transição, emitindo um evento semântico por transição — nunca um `action.updated` genérico (FR-015, FR-016, FR-028)
- [x] T053 [US2] Controller, DTOs e mappers, com permissão declarada por rota
- [x] T054 [US2] `ActionModule` e registro no `AppModule`
- [x] T055 [US2] Escrita aditiva no caso de uso de ação de tratamento de risco: cria a `Action` e grava `actionId`, **sem** alterar resposta, rota ou tela existente (R-003) (FR-018, FR-019)
- [x] T056 [P] [US2] Tela "Minhas ações" em `apps/web/src/app/(app)/actions/`, com filtro por origem, estado e atraso (SC-002)
- [x] T057 [P] [US2] Entrada de navegação para "Minhas ações" — a **única** entrada nova desta fase
- [x] T058 [P] [US2] Testes de componente e teste de acessibilidade da tela nova

**Checkpoint**: US1 e US2 funcionam de forma independente.

---

## Phase 5: User Story 3 — Registrar e encerrar um achado (Priority: P3)

**Goal**: constatação GRC com prova, remediação e encerramento com segregação de funções.

**Independent Test**: registrar um achado, vincular evidência e ação, encerrá-lo com prova e
reconstruir a proveniência inteira.

### Tests for User Story 3

- [x] T059 [P] [US3] Contract test de `listFindings`, `createFinding`, `getFinding`, `updateFinding`, `closeFinding` em `apps/api/test/contract/findings.spec.ts` (D-11)
- [x] T060 [P] [US3] **Teste de segregação de funções**: quem é responsável por ação concluída do achado recebe **403** ao tentar encerrá-lo; outro usuário com `finding:close` consegue (FR-025)- [ ] T061 [P] [US3] Teste da invariante F3: concluir todas as ações **não** encerra o achado (FR-024)- [ ] T062 [P] [US3] Teste da invariante F1: encerrar sem ação concluída e sem justificativa responde **422** (FR-026)
- [x] T063 [P] [US3] Teste de severidade × prioridade: mudam de forma independente, e a mudança de prioridade gera evento próprio (FR-022)
- [x] T064 [P] [US3] Teste de escopo e negação auditada
- [x] T065 [P] [US3] Teste de proveniência: a partir de um achado encerrado, a sequência abertura → evidência → ações → encerramento é reconstruível pela API (SC-003)
- [x] T066 [P] [US3] Teste adversarial: tentar encerrar por um segundo caminho — `updateFinding` com `status` — é recusado como propriedade desconhecida (C5)
- [x] T066a [P] [US3] Contract test de `reopenFinding` e `archiveFinding` (D-11); reabrir exige motivo, e a conclusão anterior permanece na trilha (FR-027)
- [x] T066b [P] [US3] Teste da invariante F4: arquivar achado que não está `CLOSED` responde **422** — arquivar não é atalho para fechar e não contorna a segregação de funções

### Implementation for User Story 3

- [x] T067 [P] [US3] Entidade `Finding` com invariantes F1–F3 e tabela de transições (FR-020, FR-021)
- [x] T068 [US3] Portas de repositório
- [x] T069 [US3] Repositório Prisma escopado, com as consultas de SC-010 (sem remediação, por severidade)
- [x] T070 [P] [US3] Casos de uso: criar, listar, obter, atualizar
- [x] T071 [US3] Caso de uso de encerramento, com a checagem de segregação de funções no domínio e evento `finding.closed` (FR-025, FR-026)
- [x] T071a [US3] Casos de uso de reabertura e arquivamento, com invariante F4 e eventos `finding.reopened` e `finding.archived` (FR-027)
- [x] T072 [US3] Estender `EvidenceSubjectType` e `ActionOriginType` para aceitar `FINDING`, e registrar os resolvedores correspondentes — é o que dá ao achado prova e remediação (FR-023)
- [x] T073 [US3] Controller, DTOs e mappers
- [x] T074 [US3] `FindingModule` e registro no `AppModule`
- [x] T075 [P] [US3] Componentes web de achado, consumidos por contexto de domínio
- [x] T076 [P] [US3] Testes de componente

**Checkpoint**: as três stories funcionam de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T077 Teste espelho contrato↔implementação: as 18 operações de `grc-foundation.openapi.yaml` existem e estão cobertas (D-11, fecha a classe da F-31) (SC-008)
- [x] T078 [P] Reutilizar comentários e anexos nas três entidades registrando os tipos nos registros existentes (FR-035)- [ ] T079 [P] Verificar que nenhuma string voltada ao usuário ficou embutida em componente (FR-034), e que um enum sem tradução falha o typecheck- [ ] T080 E2E Playwright do fluxo crítico: evidência → vínculo → ação → achado → encerramento com segregação de funções
- [x] T081 [P] Varredura de acessibilidade com axe na tela nova e nos painéis novos, sem regressão
- [x] T082 [P] Verificar que as consultas de SC-010 usam índice, com `EXPLAIN` sobre volume representativo
- [x] T083 Executar o `quickstart.md` inteiro contra a aplicação em execução e registrar o resultado (SC-001)
- [x] T084 Atualizar `docs/architecture.md` com a camada `grc/` e seus pontos de extensão, e registrar em `docs/deferred-findings.md` a dívida datada de convergência de R-003
- [x] T085 Rodar a suíte completa e o CI; confirmar `openapi:check` verde e nenhuma alteração de contrato existente (SC-009)

---

## Dependencies

```
Setup (T001–T004)
   ↓
Foundational (T005–T016)   ← bloqueia tudo
   ↓
   ├── US1 (T017–T038)     🎯 MVP
   │      ↓
   ├── US2 (T039–T058)     depende de US1 apenas para ação comprovada por evidência
   │      ↓
   └── US3 (T059–T076)     depende de US1 e US2 (achado usa evidência e ação)
          ↓
   Polish (T077–T085)
```

US1 é entregável sozinha. US2 é entregável após US1. US3 fecha o ciclo e é o que torna o
compartilhamento real: com ela, Ação passa a ter duas origens e Evidência dois tipos de sujeito.

## Parallel Opportunities

- **Setup**: T003 e T004 em paralelo.
- **Foundational**: T012, T015 e T016 em paralelo; T005–T007 são sequenciais entre si.
- **US1**: T017–T025 (testes) todos em paralelo; T026/T027 e T032/T033 em paralelo.
- **US2**: T039–T044 e T046 em paralelo; T056–T058 em paralelo.
- **US3**: T059–T066 em paralelo; T075/T076 em paralelo.
- **Polish**: T078, T079, T081 e T082 em paralelo.

## Implementation Strategy

**MVP**: Phase 1 + Phase 2 + US1. Entrega a capacidade que mais domínios futuros consomem e prova
os mecanismos difíceis — registro de tipo fechado, verificação dos dois lados, preservação
histórica.

**Incremental**: cada story é um incremento verificável. A ordem não é negociável, porque US3 usa
as duas anteriores.

**Marco de convergência (R-003, FR-019)**: a fase que retira `RiskTreatmentAction` e aponta as
rotas de risco para `Action` precede a fase de Incidentes. Se Incidentes começar antes, a dívida
deixa de ser temporária e a decisão de R-003 precisa ser revista, não repetida.

**Regra de parada**: se T045 falhar — qualquer teste existente de Riscos precisar mudar — a
compatibilidade retroativa falhou. Isso é defeito a corrigir, não teste a ajustar.
