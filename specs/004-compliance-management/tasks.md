# Tasks — Compliance

> **Reconciliação, 2026-09-11** (007-implementation-remediation, Frente G). Este arquivo estava com
> as 71 caixas desmarcadas apesar de CLAUDE.md §17 item 10 listar a fase concluída (commit
> `8f0452d`). 68 das 71 foram marcadas nesta data, uma a uma, contra evidência real — o controller,
> a operação do contrato, o componente ou o teste que a tarefa nomeia, verificado existente hoje em
> `apps/api/src/modules/compliance/**`, `apps/web/src/features/compliance/**`,
> `specs/004-compliance-management/contracts/compliance.openapi.yaml` (23 `operationId` confirmados)
> e as suítes de teste correspondentes — nunca por inferência a partir da fase como um todo. **Três
> permanecem deliberadamente desmarcadas, pela mesma classe de lacuna já registrada para
> 003-controls-management**: nenhum arquivo em `apps/web/e2e/` referencia `compliance`, e
> `accessibility.spec.ts` não tem nenhuma varredura para as telas de Compliance. T067 (E2E do
> caminho completo), T068 (E2E de escopo no vínculo requisito↔controle) e T069 (axe nas telas
> novas) não têm o teste que descrevem.

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Research**: [research.md](./research.md) · **Contract**:
[contracts/compliance.openapi.yaml](./contracts/compliance.openapi.yaml)

`[P]` = paralelizável (arquivos distintos, sem dependência pendente). `[US1|US2|US3]` = história de
usuário que a tarefa serve.

Esta feature não tem `quickstart.md` — Fase 7 substitui o roteiro por um passo de verificação
manual descrito na própria tarefa (T065).

**Nota sobre FR-022/SC-005**: o texto original de `spec.md` exigia escopo organizacional em toda
leitura e escrita do módulo; foi corrigido durante o desenho (ver nota em `spec.md` FR-022,
research.md D-2) para se aplicar **só** onde há registro escopado a proteger — o controle do lado
oposto de `RequirementControlLink`. `Framework`, `FrameworkVersion` e `Requirement` são catálogo de
escopo global, gated só por permissão. Toda tarefa abaixo que toca escopo organizacional reflete a
redação corrigida, não a original — em particular T018, T031 e T033.

---

## Fase 1 — Setup

- [x] T001 Migração aditiva em `apps/api/prisma/migrations/` criando os enums `FrameworkOrigin`, `FrameworkVersionStatus` e as tabelas `frameworks`, `framework_versions`, `requirements` (data-model.md §1–§3), com FK `onDelete: Restrict` e sem `org_unit_id` em nenhuma das três (research.md D-2)
- [x] T002 Migração aditiva criando `requirement_control_links` (data-model.md §4), com índice único parcial `(requirement_id, control_id) WHERE unlinked_at IS NULL` e índice `(control_id) WHERE unlinked_at IS NULL`
- [x] T003 Migração aditiva criando o enum `MappingMigrationOutcome` e as tabelas `requirement_control_mapping_migrations` e `requirement_control_mapping_migration_items` (data-model.md §5)
- [x] T004 Migração aditiva criando `requirement_applicability_declarations` (data-model.md §6), com índice único parcial `(requirement_id) WHERE revoked_at IS NULL`
- [x] T005 Migração aditiva criando o enum `RequirementComplianceState` e a tabela `requirement_compliance_audit_marks` (data-model.md §7) — só guarda o último valor **observado**, nunca é lida para responder "qual o estado atual" (research.md D-11)
- [x] T006 Migração aditiva criando a trigger `requirements_immutable_after_publish` e a função `requirements_prevent_update_after_publish()`, espelhando `approvals_prevent_overwrite()` (`20260905170100_risk_lifecycle_and_approvals_baseline/migration.sql`) — recusa `UPDATE` em `requirements` quando `framework_versions.status` do pai é `PUBLISHED` (data-model.md §3, research.md D-4)
- [x] T007 Migração aditiva revisada acrescentando os sete valores de `AuditEntityType` (`FRAMEWORK`, `FRAMEWORK_VERSION`, `REQUIREMENT`, `REQUIREMENT_CONTROL_LINK`, `REQUIREMENT_CONTROL_MAPPING_MIGRATION`, `REQUIREMENT_APPLICABILITY`, `REQUIREMENT_COMPLIANCE_STATE`) e estender `apps/api/prisma/schema.prisma` para refletir T001–T006 (data-model.md §9)
- [x] T008 Verificar contra o banco real que T001–T007 são aditivas: nenhuma coluna existente de `controls`, `risks` ou tabelas do núcleo alterada, e as contagens de `risk_control_links`/`control_process_links`/`control_asset_links` idênticas antes e depois
- [x] T009 [P] Declarar as permissões `compliance:view`, `compliance:administer` e `compliance:map` em `apps/api/src/modules/compliance/compliance-permissions.ts` e agregá-las no catálogo estático `apps/api/src/permission-catalogue.ts` (FR-023, data-model.md §11)
- [x] T010 [P] Semear o papel `Compliance Manager` com as três permissões em `apps/api/prisma/seed/platform.seed.ts`, mesma convenção de `Control Owner`/`Control Approver` (research.md D-13)

## Fase 2 — Fundação do módulo (bloqueia todas as histórias)

- [x] T011 Criar o esqueleto do módulo em `apps/api/src/modules/compliance/` (domain/application/infrastructure/presentation) e `compliance.module.ts`
- [x] T012 `apps/api/src/modules/compliance/domain/compliance-audit-allowlist.ts` com o field allow-list de cada um dos sete tipos de auditoria, seguindo exatamente `modules/controls/domain/control-audit-allowlist.ts` (data-model.md §9, FR-025)
- [x] T013 [P] Adicionar `findManyById(ids: readonly string[]): Promise<ControlDirectoryEntry[]>` a `apps/api/src/shared/grc-ports/control-directory.port.ts` — método aditivo para resolução em lote (research.md D-9) — e implementá-lo em `apps/api/src/modules/controls/infrastructure/control-directory.adapter.ts`
- [x] T014 [P] Declarar `ControlEffectivenessPort` (novo) em `apps/api/src/shared/grc-ports/control-effectiveness.port.ts`, com `ControlEffectivenessLevel` (`NOT_ASSESSED | EFFECTIVE | PARTIALLY_EFFECTIVE | INEFFECTIVE | EXPIRED`) e `getEffectivenessBatch(controlIds, referenceDate)` (research.md D-9)
- [x] T015 Implementar `apps/api/src/modules/controls/infrastructure/control-effectiveness.adapter.ts` satisfazendo T014 — reaproveita `ControlEffectivenessService` já existente, uma consulta em lote (`WHERE control_id = ANY($1) AND attested_at IS NOT NULL`), sem recalcular a regra; ligar no *composition root*
- [x] T016 Teste de paridade entre `ControlEffectivenessLevel` (porte, T014) e `ControlEffectiveness` (`modules/controls/domain/control-effectiveness.service.ts`), mesmo padrão de `control-effectiveness-parity.spec.ts` (research.md D-9) — garante que os dois vocabulários fechados nunca divirjam
- [x] T017 Teste de fronteira em `apps/api/test/unit/compliance-controls-risk-module-boundary.spec.ts`, mesmo método de `controls-risk-module-boundary.spec.ts`: nenhum arquivo de `modules/compliance` importa `modules/controls` nem `modules/risk`, e nenhum arquivo desses dois importa `modules/compliance`, em nenhuma direção (SC-007, FR-024)
- [x] T018 Teste provando que a leitura de `Framework`/`FrameworkVersion`/`Requirement` **não** é filtrada por escopo organizacional — sem `ScopedRepository`, sem predicado de `orgUnitId`, gated só por `compliance:view`/`compliance:administer`/`compliance:map` — a redação corrigida de FR-022 (research.md D-2), guardando contra a reintrodução do erro que a correção existe para evitar

## Fase 3 — US1: biblioteca normativa

- [x] T019 Estender o registro fechado de prefixos de código do núcleo com `FMK` — `EntityCodePrefix` e `ENTITY_CODE_PATTERN` em `apps/api/src/grc/shared/domain/entity-code.service.ts` (research.md D-14, data-model.md §10). Sem isto, T021 não compila
- [x] T020 [US1] `apps/api/src/modules/compliance/domain/framework.entity.ts` + porte de repositório + repositório Prisma **não escopado** (catálogo de plataforma, como `Role`/`Permission` — research.md D-2)
- [x] T021 [US1] Casos de uso de criar/ler/listar/editar framework, com `code` gerado pelo alocador compartilhado (`GrcCodeSequence`, prefixo `FMK`, T019); framework criado sem versão é legível e sem estado de conformidade a relatar (edge case "framework sem versão alguma")
- [x] T022 [US1] `apps/api/src/modules/compliance/domain/framework-version-lifecycle.ts`: dois estados, uma aresta (`DRAFT -> PUBLISHED`), sem tabela de transições (research.md D-3); `framework-version.entity.ts` + repositório
- [x] T023 [US1] Casos de uso: criar versão (nasce `DRAFT`), ler, listar, editar `label` (só em `DRAFT`, `422` depois de publicada), publicar (exige ao menos um requisito — FR-005 —, estampa `publishedAt`/`publishedByUserId`, uma via só)
- [x] T024 [US1] Teste do ciclo de vida de duas arestas: `DRAFT` é alcançado na criação, `PUBLISHED` é alcançado pela publicação, não existe operação que reverta `PUBLISHED -> DRAFT`, e criar uma versão nova não altera nem invalida a anterior, que permanece íntegra e legível (FR-002, FR-006, research.md D-3) — o teste de alcançabilidade que Fase 1 (`FindingStatus`) e o rascunho de Fase 2 (`Control` `DRAFT`) deixaram de ter
- [x] T025 [US1] Teste provando que publicar uma versão sem requisito algum é recusado com `422`, e que a versão permanece `DRAFT` e inalterada (FR-005, edge case "versão publicada sem cláusulas")
- [x] T026 [US1] `apps/api/src/modules/compliance/domain/requirement.entity.ts` + repositório; editável apenas enquanto a versão-pai é `DRAFT` (checagem de aplicação, paralela à trigger de T006)
- [x] T027 [US1] Casos de uso de criar/ler/listar/editar requisito — recusados com `422` uma vez publicada a versão-pai (FR-004); o mesmo `externalRef` pode legitimamente repetir entre versões de normas diferentes, nunca deduplicado (FR-007) — teste incluído. A serialização de `complianceState` nestes casos de uso fica pendente de T046 (US3); os casos de uso aqui não dependem dela
- [x] T028 [US1] Teste de integração que tenta a escrita direta via SQL bruto contra `requirements` de uma versão publicada, sem passar por nenhum caso de uso — só a trigger de T006 pode pegar esse caminho (research.md D-4, SC-003)
- [x] T029 [US1] Teste provando que a mesma edição, tentada pelo caso de uso (não por SQL bruto), também é recusada e a tentativa é auditada (FR-004) — as duas guardas (aplicação e banco) testadas separadamente, cada uma podendo falhar sem mascarar a outra
- [x] T030 [US1] Controllers e DTOs das operações 1–9, 11 e 13 do contrato (framework CRUD, versão CRUD e publicação, criar/editar requisito), com `If-Match`/`ETag` de concorrência otimista e `Problem` RFC 9457 em toda falha
- [x] T031 [US1] Contrato: as 11 operações de T030, incluindo `404` indistinguível para quem não tem `compliance:view`, `400` para propriedade desconhecida (`code`, `status`, `version`, `complianceState`) e `409` de conflito de versão

## Fase 4 — US2: mapeamento e migração

- [x] T032 [US2] `apps/api/src/modules/compliance/domain/requirement-control-link.entity.ts` + repositório; escopo do controle referenciado verificado via `ControlDirectoryPort.findById` **antes** de gravar (data-model.md §4, research.md D-2/D-5) — a redação corrigida de FR-022 aplicada no único lugar onde de fato há registro escopado a proteger
- [x] T033 [US2] Casos de uso: vincular (`409` se já há vínculo vigente; revincular após desvínculo é permitido), listar (`includeWithdrawn`), desvincular (estampa `unlinkedAt`/`unlinkedByUserId`, preserva a linha — FR-011); tudo auditado com o tipo `REQUIREMENT_CONTROL_LINK` (FR-008, FR-010); vincular é permitido independente do status da versão-pai e mesmo sobre requisito declarado não aplicável (edge case "cláusula não aplicável ligada a controle")
- [x] T034 [US2] Teste provando que um controle fora do escopo do ator e um controle inexistente produzem exatamente o mesmo `422`, sem sinal que os distinga (SC-005, FR-022)
- [x] T035 [US2] Teste provando que o mesmo controle, vinculado a requisitos de dois frameworks diferentes, permanece um único registro — contagem de controles antes e depois (SC-001, FR-009)
- [x] T036 [US2] `apps/api/src/modules/compliance/domain/requirement-control-mapping-migration.entity.ts` + entidade de item, executando o algoritmo por requisito de destino de research.md D-6 (`COPIED` / `PENDING_DECISION` / `SKIPPED_ALREADY_MAPPED`) a partir de correspondências **fornecidas pelo gestor no corpo da requisição**
- [x] T037 [US2] Teste provando que a migração **nunca infere** uma correspondência: dois requisitos com o mesmo `externalRef` em versões diferentes, ausentes do corpo da requisição, voltam ambos `PENDING_DECISION` — nunca `COPIED` por coincidência de código (research.md D-6, "o sistema explicitamente NÃO tenta inferir")
- [x] T038 [US2] Teste provando que um destino com vínculo vigente próprio (manual ou de execução anterior) volta `SKIPPED_ALREADY_MAPPED` mesmo quando listado no corpo da requisição — o mapeamento decidido nunca é sobrescrito (FR-014) — inclui a tentativa deliberada de forçar a sobrescrita e a confirmação da recusa
- [x] T039 [US2] Teste provando que um destino ausente das correspondências e sem vínculo prévio volta `PENDING_DECISION`, nunca silenciosamente sem mapeamento (FR-013)
- [x] T040 [US2] Teste de reexecutabilidade: uma segunda execução sobre a mesma versão de destino processa somente os requisitos ainda não decididos, sem tocar itens já `COPIED` ou `SKIPPED_ALREADY_MAPPED` de uma execução anterior ou de decisão manual (research.md D-6, edge case "migração para uma versão que já tem mapeamentos")
- [x] T041 [US2] Teste provando que uma execução inteira emite **exatamente um** evento de auditoria `REQUIREMENT_CONTROL_MAPPING_MIGRATION`, com as contagens por resultado — nunca um evento por vínculo copiado (SC-004, FR-012, US2 AS4)
- [x] T042 [US2] Validação: `sourceFrameworkVersionId` precisa pertencer ao mesmo framework da versão de destino (`422` caso contrário, FR-012); `targetRequirementId` precisa pertencer à versão de destino e aparecer no máximo uma vez; cada `sourceRequirementIds` precisa pertencer à versão de origem
- [x] T043 [US2] Controllers e DTOs das operações 14–16 e 21–23 do contrato (vincular/listar/desvincular controle; executar/listar/ler migração)
- [x] T044 [US2] Contrato: as 6 operações de T043

## Fase 5 — US3: aplicabilidade e estado de conformidade

- [x] T045 [US3] `apps/api/src/modules/compliance/domain/requirement-applicability-declaration.entity.ts` + repositório; índice único parcial garante no máximo uma declaração vigente; reverter preserva a linha (research.md D-7)
- [x] T046 [US3] Casos de uso: declarar não aplicável (`justification` obrigatória, `422` se ausente, `409` se já há declaração vigente), reverter (`422` se já revogada) — auditados com o tipo `REQUIREMENT_APPLICABILITY`
- [x] T047 [US3] `apps/api/src/modules/compliance/domain/requirement-compliance.service.ts` — o calculador único (research.md D-8): entrada `applicability` + vínculos vigentes `{ isActive, effectiveness }`, saída um dos cinco `RequirementComplianceState`; função pura, sem I/O
- [x] T048 [US3] Teste unitário exaustivo de T047 exercitando **os cinco estados** das cenas de aceitação de US3 — `NOT_APPLICABLE`, `NOT_MET` (zero vínculos), `NOT_PROVEN` (vínculo sem prova), `PARTIALLY_MET` (mistura), `COMPLIANT` (todos provam) — mais os dois edge cases nomeados no spec: controle aposentado ligado a requisito vigente vira `NOT_PROVEN`, nunca erro; requisito não aplicável com vínculo mantido continua excluído do cálculo mas o vínculo permanece legível. Nenhum sexto valor à espera de uma operação que o alcance — a mesma disciplina que faltou a `FindingStatus` (Fase 1) e quase faltou ao ciclo de vida de `Control` (Fase 2)
- [x] T049 [US3] `apps/api/src/modules/compliance/domain/requirement-compliance-audit-mark.entity.ts` + repositório; mecanismo de comparação no momento da leitura — calcula o valor fresco (T047), compara à marca d'água, grava `REQUIREMENT_COMPLIANCE_STATE` com (anterior, posterior) só quando diferem, atualiza a marca (research.md D-11) — acionado em toda leitura que expõe `complianceState` (listar requisitos, ler requisito, resumo de versão) e como efeito colateral de toda escrita deste módulo que pode afetá-lo (vincular/desvincular, declarar/reverter, executar migração)
- [x] T050 [US3] Teste provando que a primeira computação de um requisito cria a marca **sem** emitir evento de auditoria — não há "anterior" real para comparar (research.md D-11, "a marca inicial nunca é mudança")
- [x] T051 [US3] Teste provando que o evento de auditoria registra o momento da **observação**, não o momento em que a causa ocorreu (tipicamente uma atestação decidida no módulo de Controles) — os dois instantes divergem quando a leitura acontece depois, e o evento descreve isso honestamente em vez de sugerir detecção em tempo real (research.md D-11, FR-021)
- [x] T052 [US3] Teste de concorrência: duas transações leem o mesmo requisito simultaneamente logo após uma mudança real de estado; o `UPDATE ... WHERE last_audited_state IS DISTINCT FROM $novo` condicional garante que só uma grava, e exatamente um evento `REQUIREMENT_COMPLIANCE_STATE` é registrado (research.md D-11)
- [x] T053 [US3] Teste provando que `complianceState` é recusado como propriedade desconhecida em **todo** corpo de requisição do contrato — criar/editar requisito, vincular/desvincular controle, declarar/reverter aplicabilidade, executar migração — nenhum aceita o estado derivado como entrada (FR-017, §19.7)
- [x] T054 [US3] Resumo de conformidade da versão (FR-020): agrega o mesmo `RequirementComplianceState` sobre os requisitos **aplicáveis**, nunca uma segunda regra; `totalRequirements`/`applicableRequirementCount`/`counts`/`compliancePercentage` com `null` quando zero aplicáveis (nunca `0` nem `100`); teste confirmando que duas versões `PUBLISHED` do mesmo framework relatam resumos independentes (edge case "duas versões vigentes ao mesmo tempo")
- [x] T055 [US3] Teste de performance: resumo de conformidade de uma versão com 500 requisitos em menos de 2 segundos, via leitura em lote e cálculo em memória (SC-008, research.md D-10) — sem expressão SQL replicada
- [x] T056 [US3] Controllers e DTOs das operações 10, 12 e 17–20 do contrato (listar/ler requisito com `complianceState`, declarações de aplicabilidade, resumo de versão)
- [x] T057 [US3] Contrato: as 6 operações de T056

## Fase 6 — Interface (§18)

- [x] T058 [P] `apps/web/src/lib/messages/compliance.ts` — catálogo pt-BR completo (framework, versão, cláusula, mapeamento, migração, aplicabilidade, estados de conformidade)
- [x] T059 [P] `apps/web/src/features/compliance/{types,api,compliance-state}.ts` espelhando o contrato; `compliance-state.ts` traz rótulo, ícone e cor de cada um dos cinco estados — cor nunca é o único indicador (§18.8)
- [x] T060 [US1] Biblioteca normativa: listas/detalhe de framework, listas/detalhe de versão com ação de publicar, listas/detalhe/formulário de requisito — reusando os padrões de tabela/formulário/status já estabelecidos por Riscos e Controles (§18.12 proíbe linguagem visual própria por módulo)
- [x] T061 [US2] Tela de mapeamento cláusula↔controle (vincular/desvincular) e tela de migração de mapeamento — a correspondência é apresentada como decisão explícita do gestor, nunca como sugestão pré-marcada (research.md D-6)
- [x] T062 [US3] Interface de declaração de aplicabilidade (declarar/reverter, justificativa obrigatória e visível) e a visão de resumo de conformidade da versão (distribuição por estado + percentual, nunca um único rótulo conforme/não conforme); requisitos não aplicáveis visualmente distintos, nunca exibidos como conformes nem como não atendidos (edge case, §18.8)
- [x] T063 Navegação: entrada "Compliance" deixa de ser "planejado" no registro de navegação
- [x] T064 Testes unitários dos componentes novos
- [x] T065 Verificação renderizada obrigatória (§18.1): capturar as telas novas com `ui-capture.mjs` nos dois temas e revisar contra o portão do §18.11 — em particular, confirmar que os cinco estados de conformidade são distinguíveis entre si por mais do que cor

## Fase 7 — Validação e fechamento

- [x] T066 Roteiro manual de ponta a ponta contra a aplicação em execução (esta feature não tem `quickstart.md`): cadastrar framework → publicar versão com cláusulas → tentar editar cláusula publicada (recusado) → criar versão seguinte → vincular controles → executar migração → declarar não aplicável → ler resumo de conformidade — registrando qualquer divergência entre desenho e realidade
- [ ] T067 E2E (Playwright) do caminho completo: biblioteca → mapeamento → migração → estado de conformidade
- [ ] T068 E2E de escopo organizacional no vínculo requisito↔controle: controle dentro do escopo cria o vínculo; fora do escopo e inexistente respondem com o mesmo `422`
- [ ] T069 Acessibilidade (axe) nas telas novas, claro e escuro, aguardando conteúdo real e não o esqueleto
- [x] T070 Regressão: suítes de Risco e de Controles passam **sem que nenhum teste deles tenha sido alterado** (SC-006); qualquer necessidade de mudança é investigada como regressão, não ajustada
- [x] T071 Relatar onde o porte `ControlEffectivenessPort` não coube de forma limpa (§19.10) e registrar dívida não bloqueante em `docs/deferred-findings.md`

---

## Dependências

```
Fase 1 → Fase 2 → { Fase 3 → Fase 4 → Fase 5 } → Fase 6 → Fase 7
```

Fase 4 depende de Fase 3 (o vínculo precisa do requisito e do ciclo de vida da versão); Fase 5
depende de Fase 4 (o cálculo de conformidade lê os vínculos vigentes). A paralelização real existe
**dentro** de cada fase: migração, contrato, domínio e testes de arquivos distintos correm juntos.
T013/T014 (portes aditivos, arquivos distintos) e T009/T010 (permissão/semeadura) são os pares mais
óbvios; a Fase 6 repete o padrão de T058/T059.

## MVP

Fase 1 + Fase 2 + Fase 3 (US1) já entregam valor independente: uma biblioteca normativa versionada,
publicável e auditável — o catálogo de exigências a que a organização responde, mesmo antes de
qualquer mapeamento a controle existir.

## Cobertura

Todo FR-001–FR-025 e todo SC-001–SC-008 mapeiam a pelo menos uma tarefa acima; nenhuma lacuna foi
identificada. As 23 operações do contrato são implementadas e testadas em três grupos, sem
sobreposição nem omissão: operações 1–9/11/13 em T030/T031 (US1), operações 14–16/21–23 em
T043/T044 (US2), operações 10/12/17–20 em T056/T057 (US3).
