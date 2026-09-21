# Tasks — Gestão de Controles

> **Reconciliação, 2026-09-11** (007-implementation-remediation, Frente G). Este arquivo estava com
> as 60 caixas desmarcadas apesar de CLAUDE.md §17 item 9 listar a fase concluída (commit `9912968`).
> 57 das 60 foram marcadas nesta data, uma a uma, contra evidência real — o arquivo, classe,
> controller, migração ou teste que a tarefa nomeia, verificado existente hoje em
> `apps/api/src/modules/controls/**`, `apps/web/src/features/controls/**` e as suítes de teste
> correspondentes, ou contra o próprio diff do commit de fechamento — nunca por inferência a partir
> da fase como um todo. **Três permanecem deliberadamente desmarcadas, por evidência NEGATIVA real,
> não por falta de checagem**: `git show --stat 9912968` não toca nenhum arquivo em `apps/web/e2e/`,
> e nenhum spec ali (nem `accessibility.spec.ts`) exercita a página `/controls` ou `/controls/{id}`
> isoladamente hoje — apenas a aba "Controles vinculados" embutida em risco/ativo/processo. T054
> (E2E do caminho completo), T055 (E2E de segregação de funções) e T056 (axe nas telas novas de
> Controles) não têm o teste que descrevem. T052 (captura renderizada) está feita —
> `docs/reviews/ui/controls-{light,dark}/` existe.

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Research**: [research.md](./research.md) · **Contract**:
[contracts/controls.openapi.yaml](./contracts/controls.openapi.yaml)

`[P]` = paralelizável (arquivos distintos, sem dependência pendente). `[US1|US2|US3]` = história
de usuário que a tarefa serve.

---

## Fase 1 — Setup

- [x] T001 Migração aditiva em `apps/api/prisma/migrations/` criando os enums `ControlStatus`, `ControlNature`, `ControlType`, `ControlFrequency`, `ControlAssessmentResult` e acrescentando a `controls` as colunas de data-model.md §1, todas nuláveis ou com padrão
- [x] T002 Migração aditiva criando `control_assessments` (data-model.md §2), com o índice `(control_id, assessed_on DESC, created_at DESC)` e **sem** `updated_at`
- [x] T003 Migração aditiva criando `control_process_links` e `control_asset_links` (data-model.md §5), com FK `onDelete: Restrict` e o índice único parcial `WHERE unlinked_at IS NULL`
- [x] T004 Estender `apps/api/prisma/schema.prisma` para refletir T001–T003, incluindo `EvidenceSubjectType += CONTROL`, `ActionOriginType += CONTROL_ASSESSMENT` e `ApprovableEntityType += CONTROL_ASSESSMENT`
- [x] T005 Verificar contra o banco real que a migração é aditiva: nenhuma coluna existente alterada, `risk_control_links` intacta e com a mesma contagem antes e depois (quickstart §1)
- [x] T006 [P] Declarar as permissões `control:*` em `apps/api/src/modules/controls/control-permissions.ts` e agregá-las no catálogo estático `apps/api/src/permission-catalogue.ts`
- [x] T007 [P] Semear os papéis `Control Owner` e `Control Approver` e conceder leitura de controle a `Risk Manager` em `apps/api/prisma/seed/platform.seed.ts`

## Fase 2 — Fundação do módulo (bloqueia todas as histórias)

- [x] T008 Declarar `ControlDirectoryPort` em `apps/api/src/shared/grc-ports/control-directory.port.ts`, expondo **apenas** `{ id, code, name, orgUnitId, isActive }` (ADR-020 parte 3)
- [x] T009 Criar o esqueleto do módulo em `apps/api/src/modules/controls/` (domain/application/infrastructure/presentation) e `controls.module.ts`
- [x] T010 `apps/api/src/modules/controls/infrastructure/control-directory.adapter.ts` — o adaptador que satisfaz T008; ligar no *composition root*
- [x] T011 Substituir a leitura direta da tabela `controls` em `apps/api/src/modules/risk/` pelo consumo de `ControlDirectoryPort`; nenhuma outra alteração no módulo de Riscos
- [x] T012 Teste de fronteira provando que `modules/risk` não importa `modules/controls` e vice-versa (SC-007), e teste de escopo provando que a recusa do vínculo risco↔controle continua **idêntica** após T011 (research D-4 — a refatoração "sem mudança de comportamento" é a que passa despercebida quando quebra)
- [x] T013 `apps/api/src/modules/controls/domain/control-effectiveness.service.ts` — o calculador único, com `referenceDate` como parâmetro obrigatório (research D-2)
- [x] T014 Teste unitário exaustivo de T013: sem verificação atestada → `NOT_ASSESSED`; verificação não atestada não conta; frequência nula → `EXPIRED` inalcançável; janela vencida → `EXPIRED`
- [x] T015 Expressão SQL equivalente a T013 para filtrar/ordenar o catálogo, com comentário de paridade em cada lado, seguindo `overdueReviewFragment`/`isOverdueReview`
- [x] T016 Teste que confronta T013 e T015 sobre os mesmos dados — sem ele, são duas regras que apenas começam iguais
- [x] T017 Repositório escopado do módulo, com escopo obrigatório e sem valor padrão

## Fase 3 — US1: catálogo e ciclo de vida

- [x] T018 [US1] `control.entity.ts` e `control-lifecycle.ts`: estados e transições permitidas — `DRAFT → ACTIVE`, `ACTIVE ↔ SUSPENDED`, e `RETIRED` alcançável dos **três** estados anteriores — mais a exigência de dono para ativar (FR-005)
- [x] T018a [US1] Teste provando que um controle em `DRAFT` **sem dono** pode ser aposentado: sem `DRAFT → RETIRED` ele não ativa (falta dono) nem é excluído (FR-006), e fica preso para sempre — o defeito de estado inalcançável que o portão de análise encontrou
- [x] T019 [US1] Ponto único que mantém `is_active` em sincronia com `status` (data-model.md §1) — e o teste que prova que é único
- [x] T019a Estender o registro fechado de prefixos de código do núcleo com `CTL` — `EntityCodePrefix`, `ENTITY_CODE_PREFIXES` e `ENTITY_CODE_PATTERN` em `apps/api/src/grc/shared/domain/entity-code.service.ts` — e corrigir o comentário da união, que hoje restringe a extensão a entidades do núcleo (ver data-model.md §1). Sem isto, T020 não compila
- [x] T020 [US1] Casos de uso: criar, ler, editar, listar (paginado, filtrado, ordenado), com geração de código pelo alocador compartilhado usando o prefixo `CTL`
- [x] T021 [US1] Caso de uso de transição de ciclo de vida, com auditoria de estado anterior e posterior
- [x] T022 [US1] Validar o dono pela regra de linha organizacional já existente (`AssignmentLineService`) — um consumidor a mais, nunca uma segunda cópia (FR-008)
- [x] T023 [US1] Controllers e DTOs das operações 1–6 do contrato
- [x] T024 [US1] Contrato: as 6 operações, incluindo `404` indistinguível para fora de escopo (FR-007)
- [x] T025 [US1] Teste provando que cada estado tem consequência observável — nenhum estado declarado e inalcançável (research D-6)
- [x] T026 [US1] Teste de compatibilidade: um controle preexistente (atributos novos nulos) é lido e renderizado sem erro (FR-003)

## Fase 4 — US2: verificação e atestação

- [x] T027 [US2] `control-assessment.entity.ts`: imutável, com recusa de `assessedOn` futura (FR-011)
- [x] T028 [US2] Casos de uso de registrar, listar e ler verificação — **sem** operação de edição ou exclusão (FR-010)
- [x] T029 [US2] Solicitação de atestação usando `ApprovableEntityType.CONTROL_ASSESSMENT`, sem motor de workflow (research D-3)
- [x] T030 [US2] Decisão de atestação com as invariantes **C1** (executor não atesta) e **C2** (dono não atesta) declaradas e verificadas separadamente
- [x] T031 [US2] Auditar toda recusa de atestação com o motivo; quando C1 e C2 se aplicam juntas, o evento nomeia as duas (FR-019)
- [x] T032 [US2] Emitir `control.effectiveness.changed` com valor anterior e posterior quando a atestação altera a efetividade derivada (FR-020)
- [x] T033 [US2] Controllers e DTOs das operações 7–11
- [x] T034 [US2] Contrato das operações 7–11, incluindo os dois `422` de segregação
- [x] T035 [US2] Integração: registrar → atestar → efetividade muda; e registrar → **não** atestar → efetividade não muda (FR-016)

## Fase 5 — US3: relacionamentos

- [x] T036 [US3] Entidades de vínculo `ControlProcessLink` e `ControlAssetLink` com tipo de auditoria próprio cada uma (ADR-020 parte 1)
- [x] T037 [US3] Casos de uso de vincular/desvincular: escopo do alvo verificado **antes** da escrita, permissão dos dois lados, desvínculo preservando histórico (FR-023–FR-025)
- [x] T038 [US3] Leitura dos riscos tratados pelo controle, consumindo o vínculo existente — nenhuma criação, nenhuma remoção desse lado (FR-021)
- [x] T039 [US3] Registrar `CONTROL` em `EvidenceSubjectType` e `CONTROL_ASSESSMENT` em `ActionOriginType` nos registros de tipo fechado, com os rótulos pt-BR correspondentes
- [x] T040 [US3] Controllers e DTOs das operações 12–18
- [x] T041 [US3] Contrato das operações 12–18
- [x] T042 [US3] Integração: alvo fora de escopo responde como inexistente **e nada é gravado** (quickstart §7); revincular par desfeito é permitido e preserva o anterior

## Fase 6 — Interface (§18)

- [x] T043 [P] `apps/web/src/lib/messages/controls.ts` — catálogo pt-BR completo do módulo
- [x] T044 [P] `apps/web/src/features/controls/{types,api,status}.ts` espelhando o contrato
- [x] T045 [US1] Catálogo de controles reutilizando os padrões já estabelecidos no registro de riscos — cards e tabela, indicadores, barra de resultados, paginação compartilhada (§18.12 proíbe linguagem visual própria por módulo)
- [x] T046 [US1] Formulário de criação/edição, com o seletor de dono usando a listagem de **atribuição** para a unidade selecionada, nunca a de navegação
- [x] T047 [US1] Detalhe do controle com abas, ações de ciclo de vida e efetividade apresentada com ícone e texto, nunca só cor (§18.8)
- [x] T048 [US2] Seção de verificações: histórico, registro e atestação, com as duas recusas de segregação explicadas ao usuário
- [x] T049 [US3] Seções de vínculos (riscos, processos, ativos), evidências e ações
- [x] T050 Navegação: entrada "Controles" deixa de ser "planejado" no registro de navegação
- [x] T051 Testes unitários dos componentes novos
- [x] T052 Verificação renderizada obrigatória (§18.1): capturar as telas novas nos dois temas e revisar contra o portão do §18.11

## Fase 7 — Validação e fechamento

- [x] T053 Executar o roteiro de `quickstart.md` inteiro contra a aplicação em execução, corrigindo o roteiro onde a realidade divergir do desenho
- [ ] T054 E2E do caminho completo: criar → ativar → verificar → atestar → vincular → remediar
- [ ] T055 E2E de segregação de funções e de escopo organizacional
- [ ] T056 Acessibilidade (axe) nas telas novas, claro e escuro, aguardando conteúdo real e não o esqueleto
- [x] T057 Regressão: suítes de Risco passam **sem que nenhum teste de Risco tenha sido alterado** (SC-006); se algum precisou mudar, investigar como regressão
- [x] T058 Relatar onde ADR-020 não coube (§19.10) e registrar dívida não bloqueante em `docs/deferred-findings.md`

---

## Dependências

```
Fase 1 → Fase 2 → { Fase 3 → Fase 4 → Fase 5 } → Fase 6 → Fase 7
```

As fases 3–5 são sequenciais por dependência de domínio (a verificação precisa do controle; o
vínculo precisa de ambos), mas a paralelização real existe **dentro** de cada uma: contrato,
domínio e testes de arquivos distintos correm juntos.

## MVP

Fase 1 + Fase 2 + Fase 3 (US1) já entregam valor independente: uma biblioteca de controles
governada, escopada e auditável.
