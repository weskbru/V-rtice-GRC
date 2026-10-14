# Tasks — Auditoria e Achados

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Research**: [research.md](./research.md) · **Quickstart**:
[quickstart.md](./quickstart.md) · **Contract**: [contracts/audit.openapi.yaml](./contracts/audit.openapi.yaml)

`[P]` = paralelizável (arquivos distintos, sem dependência pendente). `[US1|US2|US3]` = história de
usuário que a tarefa serve.

**`Finding` já existe (Fase 1/ADR-016) e não é criado por esta feature.** As tarefas abaixo que
tocam `finding.entity.ts`, `close-finding.usecase.ts`, `finding-permissions.ts` e
`apps/api/test/contract/findings.spec.ts` são alterações aditivas a arquivos existentes, não
criação — marcadas "ALTERADO" quando é o caso, seguindo a mesma convenção do `plan.md`.

**Nota sobre FR-010 (endurecimento deliberado)**: fechar um achado passa a exigir evidência,
somando-se à regra já existente (ação concluída OU justificativa), nunca a substituindo
(research.md D-6). Isso quebra testes da Fase 1 que fecham achado só com justificativa. T052 é a
tarefa que os atualiza — cada teste alterado deve citar FR-010, e SC-007 carrega exatamente essa
exceção.

**Nota sobre FR-019 (colisão de nome evitada)**: `audit:view` já existe como permissão CORE (leitura
da trilha, `core/authorization`). O recurso deste módulo é `audit-engagement:*`, o módulo é
`modules/audit-engagements/`, e o papel `Auditor` existente é estendido — nunca duplicado.

---

## Fase 1 — Setup / Migração

- [x] T001 Migração aditiva em `apps/api/prisma/migrations/` criando o enum `AuditEngagementStatus`
      (`PLANNING | IN_PROGRESS | COMPLETED | CANCELLED` — o quarto valor fecha o beco sem saída,
      FR-004a; ver T034a) e a tabela `audit_engagements` (data-model.md §1), com
      `version` int para concorrência otimista (research.md D-18), índices `(org_unit_id, status)`
      e `(lead_auditor_user_id)`
- [x] T002 Migração aditiva criando `audit_scope_framework_versions`, `audit_scope_requirements` e
      `audit_scope_controls` (data-model.md §2–§4), cada uma com índice único
      `(audit_engagement_id, <alvo>_id)` e índice `(audit_engagement_id)` — **sem**
      `unlinked_at`/`unlinked_by_user_id` em nenhuma das três (research.md D-12: nenhuma operação de
      remoção de escopo nesta fase)
- [x] T003 Migração aditiva criando `finding_control_links` e `finding_risk_links` (data-model.md
      §5–§6), mesma forma de `RiskControlLink`, com índice parcial único escrito à mão
      `(finding_id, control_id) WHERE unlinked_at IS NULL` /
      `(finding_id, risk_id) WHERE unlinked_at IS NULL` (Prisma não expressa índice parcial — drift
      aceito, mesmo padrão de `RequirementControlLink`) e índice `(finding_id, unlinked_at)` em cada
- [x] T004 Migração aditiva acrescentando a coluna `audit_engagement_id` (uuid, **nula**, FK
      `Restrict` → `audit_engagements`) a `findings`, com índice `(audit_engagement_id)`
      (data-model.md §7, FR-007/FR-008) — nenhuma outra coluna de `findings` muda de forma, nulidade
      ou tipo
- [x] T005 Migração revisada (padrão ADR-008) acrescentando os seis valores novos de
      `AuditEntityType` (`AUDIT_ENGAGEMENT`, `AUDIT_SCOPE_FRAMEWORK_VERSION`,
      `AUDIT_SCOPE_REQUIREMENT`, `AUDIT_SCOPE_CONTROL`, `FINDING_CONTROL_LINK`, `FINDING_RISK_LINK`
      — data-model.md §8, research.md D-9) e estender `apps/api/prisma/schema.prisma` para refletir
      T001–T004
- [x] T006 [P] Estender o registro fechado de prefixos de código do núcleo com `'AUD'` —
      `EntityCodePrefix` e `ENTITY_CODE_PATTERN` em
      `apps/api/src/grc/shared/domain/entity-code.service.ts` (research.md D-8, data-model.md §8);
      reusa `GrcCodeSequence` — nenhuma tabela de sequência nova. Sem isto, T025 não compila
- [x] T007 Verificar contra o banco real que T001–T005 são aditivas: migrar para cima e para baixo;
      confirmar que as contagens de `risk_control_links`, `control_process_links`,
      `control_asset_links`, `requirement_control_links` e `findings` são idênticas antes e depois
      (exceto a coluna nova nula em `findings`); confirmar que nenhuma coluna existente de `risks`,
      `controls`, `framework_versions` ou `requirements` mudou de tipo ou nulidade (suporte a SC-007)
- [x] T008 [P] `apps/api/src/modules/audit-engagements/domain/audit-engagement-permissions.ts` —
      cinco permissões novas: `audit-engagement:view|create|edit|scope|transition` (FR-019,
      research.md D-7), agregadas no catálogo estático `apps/api/src/permission-catalogue.ts`
- [x] T009 [P] `apps/api/src/grc/finding/domain/finding-permissions.ts` (ALTERADO, aditivo) — duas
      permissões novas: `finding:remediate` (ação `TRANSITION`, reusada), `finding:link` (ação
      `LINK`, reusada) — nenhum valor novo de `PermissionAction` (research.md D-7)
- [x] T010 Teste provando que `audit-engagement:*` nunca colide com o namespace `audit:*` já
      ocupado pela trilha (`audit:view`, CORE), e que a checagem de unicidade já existente de
      `combinePermissionDefinitions` cobre estruturalmente uma colisão hipotética futura de
      identificador — guarda a decisão de nomeação de FR-019 em código, não só em documento
      (research.md D-7, tabela de riscos do plan.md)
- [x] T011 Semear `apps/api/prisma/seed/platform.seed.ts`: estender o papel `Auditor` (já existente,
      não duplicado) com `audit-engagement:view`; criar o papel novo **"Audit Lead"** com
      `audit-engagement:{create,edit,scope,transition}`, `finding:{create,remediate,link,close}`
      (`finding:create`/`finding:close` reusados, mesmo identificador do caminho manual — research.md
      D-7, data-model.md §10)

## Fase 2 — Fundação do módulo (bloqueia todas as histórias)

- [x] T012 [P] `apps/api/src/shared/grc-ports/risk-directory.port.ts` — `RiskDirectoryPort`/
      `RiskDirectoryEntry { id, code, title, orgUnitId, isActive }`, `isActive = archivedAt === null`
      (nunca `status`) — primeiro porte de LEITURA DE IDENTIDADE de `Risk` para um consumidor
      externo (data-model.md §9, research.md D-4)
- [x] T013 `apps/api/src/modules/risk/infrastructure/risk-directory.adapter.ts` implementando
      `RiskDirectoryPort` (T012); ligar em `risk.module.ts` (*composition root*)
- [x] T014 [P] `apps/api/src/shared/grc-ports/framework-version-directory.port.ts` —
      `FrameworkVersionDirectoryPort`/`FrameworkVersionDirectoryEntry { id, label, status,
      frameworkId }`, sem `orgUnitId` (catálogo global, sem escopo organizacional — research.md D-11,
      data-model.md §9)
- [x] T015 [P] `apps/api/src/shared/grc-ports/requirement-directory.port.ts` —
      `RequirementDirectoryPort`/`RequirementDirectoryEntry { id, externalRef, title,
      frameworkVersionId, frameworkVersionStatus }` (research.md D-11, data-model.md §9)
- [x] T016 `apps/api/src/modules/compliance/infrastructure/framework-version-directory.adapter.ts` +
      `requirement-directory.adapter.ts` implementando T014/T015; ligar em `compliance.module.ts`
- [x] T017 `EvidenceLinkRepositoryPort` (arquivo existente,
      `apps/api/src/grc/evidence/domain/ports/evidence-link-repository.port.ts`) — método aditivo
      `hasActiveLinkForSubject(subjectType: EvidenceSubjectType, subjectId: string):
      Promise<boolean>`, implementado em `prisma-evidence-link.repository.ts`; `findActiveLink`/
      `findById`/`unlink`/`listByEvidence`, já existentes, não mudam de assinatura (data-model.md §9,
      research.md D-6)
- [x] T018 Criar o esqueleto do módulo em `apps/api/src/modules/audit-engagements/`
      (domain/application/infrastructure/presentation) e `audit-engagements.module.ts`, registrado
      no módulo raiz da aplicação
- [x] T019 `apps/api/src/modules/audit-engagements/domain/audit-engagement-audit-allowlist.ts` — o
      field allow-list de `AUDIT_ENGAGEMENT` e das três variantes de escopo
      (`AUDIT_SCOPE_FRAMEWORK_VERSION`/`_REQUIREMENT`/`_CONTROL`), seguindo exatamente
      `modules/controls/domain/control-audit-allowlist.ts`; um evento por intenção
      (`audit_engagement.created/.updated/.started/.completed`), nunca um `.updated` genérico
      cobrindo tudo (FR-020, data-model.md §8)
- [x] T020 [P] `apps/api/src/grc/shared/domain/grc-audit-allowlist.ts` (ALTERADO, aditivo) — field
      allow-list para `FINDING_CONTROL_LINK` e `FINDING_RISK_LINK` (FR-020, data-model.md §8)
- [x] T021 Teste de fronteira em
      `apps/api/test/unit/audit-engagements-module-boundary.spec.ts`, mesmo método de
      `compliance-controls-risk-module-boundary.spec.ts`: nenhum arquivo de
      `modules/audit-engagements` importa `modules/risk`, `modules/controls` ou
      `modules/compliance`, e nenhum arquivo desses três importa `modules/audit-engagements`, em
      nenhuma direção (FR-017, SC-008)
- [x] T022 Teste novo (arquivo próprio, não edita nenhum teste existente de Risco/Controles) em
      `apps/api/test/unit/finding-grc-ports-boundary.spec.ts`: nenhum arquivo de `grc/finding`
      importa `modules/risk` ou `modules/controls` diretamente — só `shared/grc-ports/*`
      (`RiskDirectoryPort`/`ControlDirectoryPort`), o caso registrado em research.md D-4 como
      "primeiro consumidor de `shared/grc-ports/` dentro de `grc/**`"

## Fase 3 — US1: Conduzir um engajamento de auditoria (P1)

- [x] T023 [US1] `apps/api/src/modules/audit-engagements/domain/audit-engagement.entity.ts` — três
      estados, duas arestas lineares, sem tabela de transição dedicada (research.md D-3):
      `assertAuditEngagementEditable` (só `PLANNING`, D-13), `assertLegalAuditEngagementTransition`,
      `assertAuditEngagementHasScope` (recusa iniciar sem ao menos um vínculo nas três tabelas de
      escopo, FR-003)
- [x] T024 [US1] `domain/ports/audit-engagement-repository.port.ts` +
      `infrastructure/prisma-audit-engagement.repository.ts` — escopado por `org_unit_id`
      (mesmo padrão de `Risk`/`Finding`), concorrência otimista por `version` (research.md D-18)
- [x] T025 [US1] `application/create-audit-engagement.usecase.ts` — objetivo, período, responsável
      (`lead_auditor_user_id`, singular), unidade organizacional; código gerado via
      `GrcCodeSequence`, prefixo `AUD` (T006); nasce `PLANNING`; auditado
      `AUDIT_ENGAGEMENT`/`audit_engagement.created` (FR-001, US1 AS1)
- [x] T026 [US1] `application/get-audit-engagement.usecase.ts` +
      `application/list-audit-engagement.usecase.ts` — escopados por organização, `404`
      indistinguível de fora de escopo (FR-018, US1 AS5)
- [x] T027 [US1] `application/update-audit-engagement.usecase.ts` — `PATCH` só em `PLANNING`, `422`
      fora dela (D-13); `If-Match`/`ETag` de concorrência otimista, `409` em conflito; auditado
      `audit_engagement.updated`
- [x] T028 [US1] `application/scope/link-framework-version.usecase.ts` — engajamento precisa estar
      `PLANNING`; a versão referenciada precisa estar `PUBLISHED` via `FrameworkVersionDirectoryPort`
      (T014), senão `422` nomeando o campo e **nada é gravado**; `409` em vínculo duplicado; auditado
      `AUDIT_SCOPE_FRAMEWORK_VERSION`/`audit_scope_framework_version.linked`
- [x] T029 [US1] `application/scope/link-requirement.usecase.ts` — mesma forma via
      `RequirementDirectoryPort` (T015), exige `frameworkVersionStatus === 'PUBLISHED'`
      transitivamente (research.md D-2/D-11); auditado `AUDIT_SCOPE_REQUIREMENT`
- [x] T030 [US1] `application/scope/link-control.usecase.ts` — via `ControlDirectoryPort` (já
      existente, reusado sem alteração); controle precisa estar `ACTIVE` e seu `orgUnitId` dentro do
      escopo resolvido do ator, **verificado antes de qualquer escrita** (ADR-020 parte 4); `422`
      nomeando o campo, nada gravado, se inexistente/inativo/fora de escopo; auditado
      `AUDIT_SCOPE_CONTROL`
- [x] T031 [US1] `application/scope/list-audit-scope.usecase.ts` — `GET /audits/{id}/scope`,
      escopado por organização
- [x] T032 [US1] `application/start-audit-engagement.usecase.ts` — `PLANNING → IN_PROGRESS`; recusa
      `422` se não houver nenhum vínculo de escopo nas três tabelas (FR-003); estampa `started_at`/
      `started_by_user_id`; auditado com `status` anterior/posterior (`audit_engagement.started`)
- [x] T033 [US1] `application/complete-audit-engagement.usecase.ts` — `IN_PROGRESS → COMPLETED`;
      estampa `completed_at`/`completed_by_user_id`; auditado (`audit_engagement.completed`);
      permanece integralmente legível depois (FR-004)
- [x] T034 [US1] **Teste de alcançabilidade do ciclo de vida completo**: `PLANNING` é alcançado na
      criação, `IN_PROGRESS` pela chamada real a `start`, `COMPLETED` pela chamada real a
      `complete`; nenhuma operação reverte `COMPLETED → IN_PROGRESS` nem `IN_PROGRESS → PLANNING`;
      **cada estado tem uma consequência observável exercida por uma operação real** — `PATCH`
      recusado uma vez `IN_PROGRESS`; `POST .../findings` recusado uma vez `COMPLETED`;
      `POST .../start` recusado sem escopo — a mesma disciplina que faltou a `FindingStatus` (Fase
      1), ao rascunho `DRAFT` de Controle (Fase 2) e ao quase-incidente de Compliance (Fase 3); os
      três estados são exercitados, não só as duas arestas (quickstart.md §2)
- [x] T034a [US1] Implementar o descarte do engajamento (FR-004a): transição para `CANCELLED`
      alcançável de `PLANNING` **e** de `IN_PROGRESS`, exigindo justificativa, com o registro
      permanecendo legível — nunca excluído. `CANCELLED` é terminal e não aceita achado novo
- [x] T034b [US1] Teste provando que nenhum estado do engajamento é beco sem saída (SC-002a): de
      todo estado não terminal existe transição alcançável, **incluindo a partir de um engajamento
      sem escopo** — que não pode iniciar (FR-003) e, sem esta transição, não poderia sair de
      lugar nenhum. É o defeito que a Fase 1 entregou em `FindingStatus` e a Fase 2 quase entregou
      no `DRAFT` de controle; este teste é o que impede a terceira vez
- [x] T035 [US1] Teste: iniciar um engajamento sem nenhum vínculo de escopo nas três tabelas é
      recusado `422` e o engajamento permanece `PLANNING` (FR-003, quickstart.md §2 cenário 2)
- [x] T036 [US1] Teste: um engajamento concluído permanece integralmente legível — `GET` retorna
      `200` com todos os campos após a conclusão (FR-004, quickstart.md §2 cenário 7)
- [x] T037 [US1] **Teste: o escopo sobrevive a uma revisão da norma** — vincula um requisito de uma
      versão `PUBLISHED`, publica uma segunda versão do mesmo framework com um requisito
      renumerado, relê o escopo do engajamento; o vínculo original continua apontando para a
      versão/requisito original, sem alteração (FR-006, research.md D-2, quickstart.md §1) — a
      tarefa que testa a garantia, não apenas a implementa
- [x] T038 [US1] Teste: vincular escopo contra uma `FrameworkVersion` `DRAFT` (ou um requisito dela)
      é recusado `422` nomeando o campo, nada é gravado (research.md D-2, "regra adicional",
      quickstart.md §1 cenário 5)
- [x] T039 [US1] Teste: um engajamento fora do escopo organizacional do ator responde de forma
      idêntica a um inexistente (`404`), tanto para leitura quanto para tentativas de vincular
      escopo (FR-018, US1 AS5)
- [x] T040 [US1] Controllers e DTOs das operações 1–10 do contrato (CRUD de engajamento; listar
      escopo; adicionar versão de framework/requisito/controle ao escopo; iniciar; concluir), com
      `Problem` RFC 9457 em toda falha e `If-Match`/`ETag` em editar/iniciar/concluir (research.md
      D-18)
- [x] T041 [US1] Contrato: as 10 operações de T040 — `400` para forma malformada, `404`
      indistinguível de fora de escopo para o recurso principal (`AuditEngagement`), `422` nomeando
      o campo para um alvo de escopo inexistente ou fora de escopo, `409` para conflito de
      concorrência otimista e para uma segunda tentativa de vincular o mesmo alvo de escopo

## Fase 4 — US2: Registrar achados a partir do engajamento, e acompanhá-los até a remediação (P1)

- [x] T042 [US2] `apps/api/src/modules/audit-engagements/application/create-finding-from-engagement.usecase.ts`
      — `POST /audits/{id}/findings`; engajamento precisa estar `IN_PROGRESS` (recusado `422` em
      `PLANNING`/`COMPLETED`, FR-004/FR-007); cria `Finding` `OPEN` com `auditEngagementId`
      preenchido; `origin` continua escolhido pelo autor entre os três valores já existentes,
      nenhum valor novo (research.md D-5); auditado como `finding.created` (o tipo `FINDING` já
      existente), com `auditEngagementId` em `newValues` — nenhum tipo de auditoria novo para este
      evento (research.md D-9)
- [x] T043 [US2] `application/list-audit-engagement-findings.usecase.ts` — `GET /audits/{id}/findings`,
      filtrado por `auditEngagementId`, escopado por organização
- [x] T044 [US2] Teste: um achado criado a partir de um engajamento `IN_PROGRESS` mostra a origem
      (`auditEngagementId` no corpo), e a listagem do engajamento o inclui (SC-001, quickstart.md §3)
- [x] T045 [US2] Teste: um achado criado pelo caminho manual (`POST /findings`, inalterado da Fase 1)
      continua com `auditEngagementId: null` — prova que FR-008 permanece válido sem modificação
- [x] T046 [US2] Teste: registrar achado a partir de um engajamento `PLANNING` ou `COMPLETED` é
      recusado `422` (FR-004, FR-007, edge case "engajamento concluído recebendo achado")
- [x] T047 [US2] `apps/api/src/grc/finding/application/start-remediation.usecase.ts` (NOVO) —
      `StartFindingRemediationUseCase`, `POST /findings/{id}/start-remediation`; chama
      `assertLegalFindingTransition('OPEN', 'IN_REMEDIATION')` (já legal na tabela existente —
      **nenhuma alteração a `LEGAL_TRANSITIONS`**); recusado `422` a partir de qualquer status que
      não `OPEN`; auditado `finding.remediation_started` com `status` anterior/posterior
      (research.md D-10)
- [x] T048 [US2] **Teste que exercita `OPEN → IN_REMEDIATION` pela operação real, não pela tabela de
      transições**: obter um achado `OPEN`, chamar `start-remediation`, confirmar
      `status: IN_REMEDIATION` e um evento `finding.remediation_started` com
      `previousValues.status = OPEN` / `newValues.status = IN_REMEDIATION` (SC-002 — a aresta
      declarada desde a Fase 1 e inalcançável até esta tarefa; quickstart.md §4). **Esta é a tarefa
      que fecha a dívida nomeada no cabeçalho de `finding.entity.ts`** — depois dela, T090 atualiza
      esse cabeçalho
- [x] T049 [US2] Teste: chamar `start-remediation` uma segunda vez sobre o mesmo achado (agora
      `IN_REMEDIATION`) é recusado `422` — a aresta só parte de `OPEN` (quickstart.md §4 cenário 3)
- [x] T050 [US2] `finding.entity.ts` (ALTERADO) — nova **Invariante F5**,
      `assertFindingHasSupportingEvidence(hasActiveEvidenceLink: boolean): void`, **aditiva** ao
      lado da Invariante F1 já existente (`assertFindingCloseRequirementMet`, inalterada); lança
      `ValidationDomainError` nomeando um campo de evidência quando não há nenhum `EvidenceLink`
      ativo para este achado (FR-010, research.md D-6)
- [x] T051 [US2] `grc/finding/application/close-finding.usecase.ts` (ALTERADO) — passa a consultar
      `EvidenceLinkRepositoryPort.hasActiveLinkForSubject('FINDING', findingId)` (T017), além da
      consulta já existente `findCompletedLinkedActionResponsibles`; aplica F1 (inalterada) **e** F5
      (T050) — fechar passa a exigir as duas: F1 satisfeita **e** ao menos um vínculo de evidência
      ativo, nunca substituindo F1 (FR-010, aditivo)
- [x] T052 [US2] **Atualizar os testes da Fase 1 em `apps/api/test/contract/findings.spec.ts` que
      fecham um achado só com justificativa, sem evidência** — cada teste atualizado passa a anexar
      um vínculo de evidência antes de fechar, e cada alteração cita **FR-010** no próprio teste ou
      comentário adjacente, conforme a instrução do próprio `spec.md` ("quem alterar esses testes
      deve citar este requisito") — esta é a exceção nomeada por SC-007, não uma regressão
- [x] T053 [US2] **Teste novo provando o endurecimento**: um achado que satisfaz a Invariante F1
      (justificativa, sem ação concluída) mas não tem nenhum vínculo de evidência ativo é agora
      recusado `422` ao fechar — exatamente o caso que teria fechado antes desta fase (SC-003,
      quickstart.md §5 cenários 1–2)
- [x] T054 [US2] Teste: uma evidência arquivada depois de anexada ainda sustenta o fechamento — só a
      AUSÊNCIA de vínculo ativo recusa; o `status` da `Evidence` referenciada nunca é verificado, só
      `EvidenceLink.unlinkedAt` (FR-010, edge case do `spec.md`, quickstart.md §5 cenários 5–6)
- [x] T055 [US2] Teste: reabrir e fechar de novo exercita F5 outra vez — um achado reaberto cujo
      único vínculo de evidência foi desvinculado (não arquivado — desvinculado de verdade) é
      recusado ao fechar pela segunda vez, provando que F5 é avaliada a cada tentativa de
      fechamento, não em cache da primeira
- [x] T056 [US2] Teste (SC-004): segregação de funções exercida pelo produtor real — achado criado
      a partir de um engajamento, movido a `IN_REMEDIATION`, com ação vinculada `COMPLETED` de
      responsável **A** e evidência anexada; a tentativa de **A** de fechar é recusada `403` e
      auditada como `finding.close_denied`; **B** (não responsável pela ação concluída) fecha com
      sucesso, com justificativa (quickstart.md §6)
- [x] T057 [US2] Presentation: estender `finding.controller.ts` (existente) com a rota
      `start-remediation`; controllers/DTOs das operações 11–12 (listar/registrar achados por
      engajamento) em `modules/audit-engagements/presentation`
- [x] T058 [US2] Contrato: as operações 11–13 (listar achados do engajamento, registrar achado a
      partir do engajamento, mover para remediação)
- [x] T059 [US2] **Prova de que nenhuma operação exclui um `Finding`**: grep estrutural (automatizado
      como teste, não comentário) contra `apps/api/src/modules/audit-engagements`,
      `apps/api/src/grc/finding` e os dois contratos (`audit.openapi.yaml`,
      `grc-foundation.openapi.yaml`) por qualquer rota de verbo `DELETE` ou método de repositório que
      apague uma linha de `findings`; a única coisa que a busca pode encontrar é `archiveFinding`
      (já existente, preserva a linha) — nenhum `DELETE /findings/{id}` em lugar algum (FR-012,
      SC-005)

## Fase 5 — US3: Ligar o achado ao que ele afeta (P2)

- [x] T060 [US3] `grc/finding/domain/finding-control-link.entity.ts` +
      `domain/ports/finding-control-link-repository.port.ts` +
      `infrastructure/prisma-finding-control-link.repository.ts` — mesma forma exata de
      `RiskControlLink`; `unlinkedAt`/`unlinkedByUserId` preservam o desvínculo (FR-016)
- [x] T061 [US3] [P] mesma forma para `finding-risk-link.entity.ts` + porte + repositório, contra
      `RiskDirectoryPort` (T012/T013)
- [x] T062 [US3] `application/links/link-finding-control.usecase.ts` — exige `finding:link` (lado que
      registra) **e** `control:view` (lado referenciado, ADR-020 parte 5); resolve o escopo
      organizacional do ator e verifica o `orgUnitId` do controle-alvo (via `ControlDirectoryPort`)
      **antes de qualquer escrita**; recusa `422` nomeando `controlId` para controle inexistente,
      inativo ou fora de escopo, indistinguível, nada gravado; recusa se `Finding.status ===
      ARCHIVED` (reusa `assertFindingEditable`); auditado
      `FINDING_CONTROL_LINK`/`finding_control_link.linked`
- [x] T063 [US3] `application/links/unlink-finding-control.usecase.ts` —
      `DELETE /findings/{id}/controls/{linkId}`; exige só `finding:link` (sem repetir `control:view`
      — mesma isenção já aceita para `UnlinkControlUseCase`, porque o `linkId` só é obtido pela
      própria listagem sob `finding:view`); estampa `unlinkedAt`/`unlinkedByUserId`, preserva a
      linha; auditado `finding_control_link.unlinked`
- [x] T064 [US3] `application/links/list-finding-control-links.usecase.ts` —
      `GET /findings/{id}/controls`, sob `finding:view`
- [x] T065 [US3] [P] `application/links/link-finding-risk.usecase.ts` +
      `unlink-finding-risk.usecase.ts` + `list-finding-risk-links.usecase.ts` — espelham T062–T064
      exatamente, contra `RiskDirectoryPort` e `risk:view` (FR-013 a FR-016)
- [x] T066 [US3] **Teste provando que a checagem de escopo acontece ANTES de qualquer escrita, com
      asserção de que nada foi gravado**: tentar vincular um achado a um controle (e, separadamente,
      a um risco) fora do escopo organizacional do ator; confirmar `422` nomeando o campo **e**
      confirmar que a contagem de linhas de `finding_control_links`/`finding_risk_links` é idêntica
      antes e depois da tentativa (ADR-020 partes 4+5, FR-015, quickstart.md §8) — o gap exato que a
      correção de 2026-09-08 do ADR-020 fechou para os dois pares anteriores, aplicado aqui desde o
      primeiro vínculo
- [x] T067 [US3] Teste: vincular sem `control:view` (respectivamente `risk:view`) no lado
      referenciado, mesmo tendo `finding:link`, é recusado `422` idêntico a um alvo inexistente —
      nunca `403` (ADR-020 parte 5, quickstart.md §9 cenário 1)
- [x] T068 [US3] Teste novo (arquivo próprio, não edita `control-link-permission-pairing.spec.ts`
      existente): nenhum papel semeado tem `finding:link` (respectivamente
      `audit-engagement:scope`) sem também ter `control:view`/`risk:view`/`compliance:view` — a
      mesma dupla garantia que `control-link-permission-pairing.spec.ts` já cobra dos pares
      anteriores, estendida aos cinco pares novos desta fase (research.md D-11, quickstart.md §9)
- [x] T069 [US3] Teste: desvincular preserva o histórico — `DELETE` estampa `unlinkedAt`/
      `unlinkedByUserId`, a linha permanece consultável com `includeWithdrawn`, e o vínculo deixa de
      contar como ativo (FR-016, US3 AS5)
- [x] T070 [US3] Teste: um controle aposentado/suspenso/rascunho ou um risco arquivado, ligado a um
      achado antes dessa mudança, permanece vinculado e legível — o edge case "controle aposentado
      ligado a achado aberto" do `spec.md`
- [x] T071 [US3] Teste: tentar vincular um controle ou risco a um achado `ARCHIVED` é recusado
      (invariante de estado terminal já existente, reusada — research.md D-4)
- [x] T072 [US3] Controllers e DTOs das operações 14–19 (listar/vincular/desvincular achado↔controle;
      listar/vincular/desvincular achado↔risco)
- [x] T073 [US3] Contrato: as operações 14–19

## Fase 6 — Interface (§18)

- [x] T074 [P] `apps/web/src/lib/messages/audit-engagements.ts` — catálogo pt-BR completo
      (engajamento, escopo, achado a partir de engajamento, remediação, vínculo a controle/risco)
- [x] T075 [P] `apps/web/src/features/audit-engagements/{types,api}.ts` espelhando as 19 operações
      do contrato
- [x] T076 [US1] Lista e detalhe de engajamento; formulário de criação (objetivo, período,
      responsável, unidade organizacional); formulário de escopo com as três variantes,
      apresentadas como decisão explícita do auditor, nunca uma sugestão pré-marcada (mesmo
      espírito da Fase 3 para migração de mapeamento); ações de ciclo de vida (iniciar/concluir)
      com os três estados distinguíveis entre si por mais do que cor — reusando os padrões de
      tabela/formulário/status já estabelecidos (§18.12)
- [x] T077 [US2] Formulário de achado a partir de engajamento (estende `features/findings`
      existente, herdando o Design System — nunca linguagem própria, §18.12); ação "mover para
      remediação"; formulário de fechamento de achado atualizado para exigir e comunicar
      visivelmente a evidência (não apenas texto de erro genérico), refletindo FR-010 na interface
- [x] T078 [US3] Interface de vínculo achado↔controle e achado↔risco (vincular/listar/desvincular),
      reusando os padrões de tabela já usados pelos vínculos existentes de Risco/Controle
- [x] T079 Navegação: entrada "Auditoria" (ou rótulo pt-BR equivalente) deixa de ser "planejado" no
      registro de navegação principal
- [x] T080 Testes unitários dos componentes novos
- [x] T081 Verificação renderizada obrigatória (§18.1): capturar as telas novas com
      `apps/web/scripts/ui-capture.mjs` nos dois temas (claro/escuro); capturas salvas em
      `docs/reviews/ui/` na raiz do repositório; revisar contra o portão de aceitação do §18.11
      antes de considerar a Fase 6 concluída

## Fase 7 — Validação e fechamento

- [x] T082 Roteiro manual de ponta a ponta contra a aplicação em execução, seguindo
      `quickstart.md` §0–§11 integralmente (criar engajamento → escopo → iniciar → achado →
      remediação → fechamento com evidência → vínculos → desvínculo), registrando qualquer
      divergência entre desenho e realidade
- [x] T083 E2E (Playwright) do caminho completo: engajamento → escopo → início → achado →
      remediação → fechamento com evidência → vínculo a controle e a risco
      (`apps/web/e2e/audit-engagement.spec.ts`)
- [x] T084 E2E de escopo organizacional nos cinco pares novos (Audit→Control, Finding→Control,
      Finding→Risk, leitura de engajamento, leitura de achado) — alvo fora de escopo responde como
      inexistente, nunca `403` (quickstart.md §8) (`apps/web/e2e/audit-engagement-scope.spec.ts`)
- [x] T085 Acessibilidade (axe) nas telas novas, claro e escuro, aguardando conteúdo real
      (`apps/web/e2e/accessibility.spec.ts`) — achou e corrigiu um defeito real pré-existente no
      primitivo compartilhado `Table` (F-47, D-15)
- [x] T086 **Grep estrutural provando ausência de qualquer operação de exclusão no contrato desta
      fase**, automatizado como teste: contra `contracts/audit.openapi.yaml`, as únicas duas
      ocorrências de `delete:` como verbo HTTP são `unlinkFindingFromControl`/
      `unlinkFindingFromRisk`, ambas retornando `200` com o vínculo preservado — nunca `204`/corpo
      vazio; não existe `DELETE /audits/{id}`, `DELETE /findings/{id}` nem
      `DELETE /audits/{id}/scope/...` em lugar nenhum do arquivo (FR-012, SC-005, quickstart.md §7)
      — complementa T059, que prova a mesma ausência do lado do código, não só do contrato
- [x] T087 **Confirmar que nenhum `GET` deste módulo precisa de `Cache-Control: no-store`**: revisão
      dedicada (não suposição silenciosa) de que toda propriedade de toda resposta desta API é uma
      coluna gravada por uma escrita anterior, nunca um valor calculado no momento da leitura a
      partir de estado mutável de outro módulo (research.md D-14, data-model.md §11) — a condição
      que ativaria a exigência (o defeito que a Fase 3 enviou) está ausente aqui, e esta tarefa
      registra a confirmação explicitamente em vez de presumi-la
- [x] T088 Regressão: as suítes de Risco, Controles e Compliance passam com a MESMA contagem de
      testes de antes desta fase, **sem que nenhum arquivo de teste deles tenha sido tocado** — a
      única exceção é `apps/api/test/contract/findings.spec.ts` (T052), e cada alteração ali cita
      FR-010 explicitamente (SC-007)
- [x] T089 **Estender o schema de resposta `Finding` em
      `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`** com a propriedade
      nova `auditEngagementId` (uuid, `nullable`, `readOnly`), e atualizar
      `apps/api/src/grc/finding/presentation/dto/finding-response.mapper.ts` para preenchê-la — para
      que a origem apareça em toda leitura de achado, não só nas listagens deste módulo
      (research.md D-5, item de acompanhamento nomeado explicitamente, fora dos cinco arquivos de
      desenho desta feature)
- [x] T090 Atualizar o cabeçalho de `finding.entity.ts` (o comentário que documenta
      `OPEN → IN_REMEDIATION` como "no operation reaches it") para registrar que a aresta é
      alcançável desde T047/T048 — a dívida nomeada por `spec.md` fechada em código **e** em
      documentação, não deixada como comentário obsoleto
- [x] T091 Revisão final contra a tabela de conformidade do research.md D-11: confirmar que as
      cinco partes do ADR-020 (tabela nomeada, FK `Restrict`, porte em `shared/`, escopo verificado
      antes da escrita, permissão dos dois lados) estão aplicadas nos cinco pares novos desta fase,
      sem exceção pendente

---

## Dependências

```
Fase 1 → Fase 2 → { Fase 3 → Fase 4 → Fase 5 } → Fase 6 → Fase 7
```

Fase 4 depende de Fase 3 (registrar achado exige um engajamento `IN_PROGRESS` para se referir).
Fase 5 é independente de Fase 4 até o ponto em que ambas tocam `finding.entity.ts`
(`start-remediation`, T047, e a Invariante F5, T050) — coordenadas pelo mesmo agente para evitar
conflito de merge, mas sem dependência de dado entre as duas. T050/T051 (Invariante F5 e
`CloseFindingUseCase`) podem começar assim que a Fase 2 estiver pronta, em paralelo a toda a Fase 3.
A paralelização real existe **dentro** de cada fase: migração, portes, domínio e testes de arquivos
distintos correm juntos. T012/T014/T015 (portes novos, arquivos distintos), T008/T009 (permissões de
módulos diferentes) e T060/T061 (os dois pares de vínculo) são os pares mais óbvios; a Fase 6 repete
o padrão de T074/T075.

## MVP

Fase 1 + Fase 2 + Fase 3 (US1) já entregam valor independente: o registro auditável de que um
engajamento de auditoria foi aberto, teve seu escopo definido, foi executado e encerrado — mesmo
antes de qualquer achado existir. US2 (Fase 4) é o que fecha a dívida nomeada pela Fase 1
(`OPEN → IN_REMEDIATION`) e por isso está no mesmo nível de prioridade (P1) que US1 no `spec.md`;
as duas juntas são o que a especificação considera a entrega mínima completa desta fase. US3
(Fase 5, P2) é aditiva sobre as duas primeiras.

## Cobertura

Todo FR-001–FR-020 e todo SC-001–SC-008 mapeiam a pelo menos uma tarefa acima; nenhuma lacuna foi
identificada. As 20 operações do contrato são implementadas e testadas em três grupos, sem
sobreposição nem omissão: operações 1–11 em T040/T041 (US1), operações 12–14 em T057/T058 (US2),
operações 15–20 em T072/T073 (US3).

Mapa FR → tarefa(s) principal(is): FR-001→T023,T025 · FR-002→T023,T034 · FR-003→T023,T032,T035 ·
FR-004→T033,T036,T042,T046 · FR-005→T028,T029,T030 · FR-006→T037 · FR-007→T042,T044 · FR-008→T045 ·
FR-009→T047,T048 · FR-010→T050,T051,T052,T053,T054 · FR-011→T056 · FR-012→T059,T086 ·
FR-013→T060–T065 · FR-014→T062,T065,T067 · FR-015→T062,T065,T066 · FR-016→T063,T065,T069 ·
FR-017→T021,T022 · FR-018→T026,T039,T066 · FR-019→T008,T010,T011 · FR-020→T019,T020.

Mapa SC → tarefa(s) principal(is): SC-001→T044 · SC-002→T048 · SC-003→T053 · SC-004→T056 ·
SC-005→T059,T086 · SC-006→T039,T066 · SC-007→T007,T052,T088 · SC-008→T021.
