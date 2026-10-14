# Tasks — Gestão de Incidentes e Gestão de Problemas

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Research**: [research.md](./research.md) · **Contracts**:
[contracts/incidents.openapi.yaml](./contracts/incidents.openapi.yaml),
[contracts/problems.openapi.yaml](./contracts/problems.openapi.yaml)

**O vínculo Incidente↔Problema está decidido** (spec.md "Decisões do coordenador"; research.md D-13
a D-15) e implementado nas tarefas T053a-T053i (Fase 5) — N:M, opcional dos dois lados, propriedade
de Problemas, sem acoplamento de ciclo de vida. Nenhuma tarefa deste arquivo permanece bloqueada.

> **Reconciliação, 2026-09-11.** Este arquivo tinha 1 de 79 itens marcados enquanto o commit `HEAD`
> (`501c7ad`) já continha schema, os dois módulos, contratos, dez papéis de autorização, telas,
> jornadas E2E e uma correção de affordance. As marcações abaixo foram conferidas uma a uma contra o
> código no commit `501c7ad` (CI verde, run `34608398835`) — cada `[x]` cita o arquivo, teste ou
> commit que a sustenta; cada `[ ]` permanece porque nada no repositório a sustenta, com a razão
> registrada. Ver `STATE.md` para o relato completo, incluindo três achados desta própria
> reconciliação que não estavam em nenhum registro anterior: o contrato desta fase nunca entrou no
> portão `contract-coverage.spec.ts` (a mesma classe de defeito F-31 já corrigida duas vezes antes
> neste projeto), os dois módulos nunca registraram um acessor de comentário/anexo apesar do enum
> aceitar `INCIDENT`/`PROBLEM`, e nenhuma tela de Risco/Ativo/Processo passou a listar o incidente ou
> problema vinculado a ela — o vínculo só é visível a partir do lado de Incidente/Problema.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável — arquivos diferentes, sem dependência pendente
- **[US1]** a **[US5]**: a que user story de `spec.md` a tarefa pertence

---

## Fase 1 — Setup e migração

- [x] T001 Criar `apps/api/src/modules/incidents/{domain,application,infrastructure,presentation}`
      e `apps/api/src/modules/problems/{domain,application,infrastructure,presentation}`. As quatro
      pastas existem nos dois módulos. **Sem `index.ts` de barril** em nenhuma delas — mas nenhum
      outro módulo de negócio deste repositório (`assets`, `processes`, `controls`) tem barril
      próprio tampouco; a estrutura segue a convenção real do projeto, não a letra literal da
      tarefa. Não é uma lacuna desta fase.
- [x] T002 `schema.prisma`: enums `IncidentSeverity`/`IncidentStatus`/`ProblemSeverity`/
      `ProblemStatus` (linhas 2947-2989) e modelos `Incident`/`Problem`/`IncidentRiskLink`/
      `IncidentAssetLink`/`IncidentProcessLink`/`ProblemRiskLink`/`ProblemIncidentLink`
      (linhas 2999-3202). `ProblemIncidentLink` não estava no pedido original da tarefa — nasceu do
      marco de decisão Incidente↔Problema (T053a-T053i) e está corretamente presente.
- [x] T003 Os cinco enums fechados cresceram aditivamente: `AttachableEntityType`/
      `CommentableEntityType` ganharam `INCIDENT`/`PROBLEM`; `AuditEntityType` ganhou sete valores
      (`INCIDENT`, `PROBLEM`, `INCIDENT_RISK_LINK`, `INCIDENT_ASSET_LINK`, `INCIDENT_PROCESS_LINK`,
      `PROBLEM_RISK_LINK`, `PROBLEM_INCIDENT_LINK`); `EvidenceSubjectType` ganhou os dois.
      **Divergência registrada, não escondida**: `ActionOriginType` foi **deliberadamente excluído**
      desta migração — commit `064c9d1` documenta a decisão de só estender esse enum quando o
      acessor de quatro métodos existisse de verdade (T058/commit `aa7dac2`, migração separada
      `20260911030000`). A tarefa pedia as cinco extensões "na mesma migração aditiva"; o que
      aconteceu foi quatro na fundação e a quinta um commit depois, por uma razão escrita e boa
      (evitar um enum estendido sem consumidor real, CLAUDE.md §19.10). Tratado como o espírito da
      tarefa cumprido, não como a letra.
- [x] T004 Migração aditiva (`20260911020000_incidents_problems_foundation_baseline`) mais a segunda
      (`20260911030000_action_origin_type_add_incidents_problems`). Não reexecutei a verificação
      "contagens de risks/assets/processes idênticas antes/depois" contra um banco descartável nesta
      reconciliação (fora do escopo desta tarefa: não tocar banco de dados) — aceito com base no
      auto-relato do commit `064c9d1" ("Verificado localmente antes deste commit") e no fato de CI
      seguir verde em todos os commits seguintes que rodam `test:integration`/`test:contract` contra
      um banco migrado do zero.
- [x] T005 `EntityCodePrefix`/`ENTITY_CODE_PATTERN`
      (`apps/api/src/grc/shared/domain/entity-code.service.ts`) incluem `'INC'`/`'PRB'`.
- [x] T006 `apps/api/src/shared/messages/{incidents,problems}.ts` existem, ligados em
      `user-messages.ts`.
- [x] T007 `apps/web/src/lib/messages/{incidents,problems}.ts` existem, registrados em `index.ts`.

**Checkpoint**: cumprido.

---

## Fase 2 — Fundação dos dois módulos (bloqueia todas as histórias)

- [x] T008 `incident-permissions.ts`/`problem-permissions.ts`: cinco permissões cada
      (`view/create/edit/transition/link`), todas reusando valores existentes de `PermissionAction`.
      Confirmado dez permissões no total (`permissions.spec.ts` soma
      `INCIDENT_PERMISSION_DEFINITIONS.length + PROBLEM_PERMISSION_DEFINITIONS.length`).
- [x] T009 `permission-catalogue.ts` importa e combina os dois conjuntos.
- [ ] **T010 — NÃO FEITO.** `registerAttachableEntityType`/`registerCommentableEntityType`
      (`core/comments/domain/entity-registry.ts`) **nunca são chamados** para `'INCIDENT'` nem
      `'PROBLEM'` em lugar nenhum do código de produção — nem em `incidents.module.ts`, nem em
      `problems.module.ts`, nem em nenhum outro arquivo (`grep` confirmatório: só `RiskModule` e
      `EvidenceModule` chamam essas duas funções, para `'RISK'`/`'EVIDENCE'`). O enum
      `AttachableEntityType`/`CommentableEntityType` ACEITA os dois valores (T003 fez isso), mas o
      registro do acessor que os torna utilizáveis não existe. Consequência real: qualquer tentativa
      de comentar ou anexar um arquivo bruto a um Incidente/Problema lança
      `EntityTypeNotRegisteredError` (`getAttachableEntityAccessor`/`getCommentableEntityAccessor`,
      `entity-registry.ts` linhas 146-191) — um 500 não tratado, não um 403 nem um 404. Ver
      `STATE.md` §"Defeitos encontrados por esta reconciliação".
- [x] T011 `registerIncidentAuditAllowlists`/`registerProblemAuditAllowlists`
      (`domain/incident-audit-allowlist.ts`/`domain/problem-audit-allowlist.ts`), chamados nos dois
      `*.module.ts`.
- [ ] **T012 — parcialmente feito.** A tabela de transição e as pré-condições de Incidente existem,
      mas não como a tarefa pede: não há `domain/incident-lifecycle.ts` nem funções
      `evaluateIncidentPreconditions`/`findIncidentLifecycleTransition`. A tabela vive dentro de
      `domain/incident.entity.ts` (`LEGAL_TRANSITIONS`, `isLegalIncidentTransition`,
      `assertLegalIncidentTransition`), cujo próprio cabeçalho justifica a forma: "matching
      `grc/action/domain/action.entity.ts`/`grc/finding/domain/finding.entity.ts`'s own shape" — uma
      decisão de precedente arquitetural real, não um descuido. O que falta de verdade: **nenhum
      teste de unidade** prova "todo estado não-terminal tem ao menos uma transição de saída" para
      Incidente (nem para Problema — ver T013). `apps/api/test/unit/` não tem nenhum arquivo
      `*incident*`/`*problem*`; a cobertura de transição existe só via teste de contrato (HTTP), que
      prova cada aresta individualmente, não a propriedade estrutural que T012 pede.
- [ ] **T013 — parcialmente feito.** `domain/problem-lifecycle.ts` existe, com
      `evaluateProblemPreconditions`/`findProblemLifecycleTransition`, exatamente como pedido, e a
      pré-condição de fechamento (P2/P3) é de fato uma função pura testável isoladamente
      (`assertProblemHasCompletedCorrectiveAction`/`assertCloserNotSameAsCompleter`, importadas por
      `transition-problem.usecase.ts`). Mesma lacuna de T012: nenhum teste de unidade dedicado prova
      a exaustividade da tabela — só teste de contrato, aresta a aresta.
- [x] T014 `IncidentScopedRepository`/`ProblemScopedRepository`
      (`infrastructure/{incident,problem}-scoped-repository.ts`) estendem `ScopedRepository` com
      `orgUnitId` fixo no construtor — sem valor padrão, argumento obrigatório de fato.

**Checkpoint**: parcialmente cumprido — ver T010/T012/T013 acima.

---

## Fase 3 — US1: Incidente até o fechamento (P1) 🎯 MVP

- [x] T015 `test/contract/incidents.spec.ts` — `POST /incidents` cria com `code` gerado, `status:
      OPEN` (linha 163).
- [x] T016 idem — `PATCH /incidents/{id}` rejeita `status` como propriedade desconhecida (linha 367,
      "C5/adversarial").
- [x] T017 Cada transição legal aceita, cada ilegal responde 422 (linhas 411-620, uma `it` por
      aresta e uma para o par ilegal).
- [x] T018 Invariante I1: `RESOLVED` sem `resolutionSummary` recusado 422 (linha 429); com o campo,
      aceito (linha 444).
- [x] T019 Invariante I2: `CANCELLED` sem `cancellationReason` recusado 422 (linha 583).
- [x] T020 Reabertura sem motivo recusada, com motivo aceita e resolução anterior preservada na
      trilha (linhas 525-582).
- [x] T021 Escopo: `GET`/`PATCH`/transição fora do escopo respondem 404 idêntico a inexistente
      (linhas 316, 642).
- [x] T022 Negação auditada: `POST /incidents` sem `incident:create` gera evento com `outcome:
      DENIED` — confirmado pelo padrão idêntico usado em todo o arquivo (`refuses ... 403`) e pela
      auditoria central de `PermissionGuard`, que audita toda negação de permissão (não um teste
      específico por nome, mas o mecanismo é o mesmo já provado em todos os módulos anteriores).
- [x] T023 `domain/incident.entity.ts` com I1 (`assertResolutionSummaryProvided`) e I2
      (`assertCancellationReasonProvided`).
- [x] T024 `application/{create,list,get,update}-incident.usecase.ts` existem.
- [x] T025 `application/transition-incident.usecase.ts` — eventos semânticos por transição
      (`incident.started`, `incident.resolved`, `incident.closed`, `incident.cancelled`,
      `incident.reopened`, confirmado pelos nomes de teste em `incidents.spec.ts`), nunca um
      `incident.updated` genérico.
- [x] T026 `presentation/incident.controller.ts` + DTOs + `incident-response.mapper.ts` existem e
      funcionam (712 testes de contrato verdes cobrindo as rotas). **Mas a segunda metade da tarefa
      não foi feita**: `incidents.openapi.yaml` nunca foi acrescentado a `CONTRACT_SOURCES` de
      `apps/api/test/contract/contract-coverage.spec.ts` — ver T040 e `STATE.md` para o relato
      completo; é a mesma classe de defeito F-31 que este projeto já corrigiu duas vezes.
- [x] T027 `IncidentsModule` registrado em `app.module.ts` (linha 133).
- [x] T028 `features/incidents/components/incident-catalog-view.tsx`, colunas, filtros, barra de
      resultados e estado vazio existem (`incident-register-*.tsx`).
- [x] T029 `incident-form.tsx`, `incident-overview.tsx`, `incident-lifecycle-actions.tsx`,
      `incident-transition-dialog.tsx` existem.
- [ ] **T030 — parcialmente feito.** Só 3 dos 12 componentes novos de Incidente têm teste dedicado
      (`incident-corrective-actions.test.tsx`, `incident-lifecycle-actions.test.tsx`,
      `incident-register-empty.test.tsx`, mais `status.test.ts`). Sem teste próprio:
      `incident-catalog-view.tsx`, `incident-form.tsx`, `incident-overview.tsx`,
      `incident-problem-links-section.tsx`, `incident-register-columns.tsx`,
      `incident-register-filters.tsx`, `incident-register-results-bar.tsx`,
      `incident-relationships-section.tsx`, `incident-transition-dialog.tsx`. Parte desse
      comportamento está coberta indiretamente pelo E2E (`e2e/incidents.spec.ts`), mas não pelo
      teste de componente que a tarefa pede.

**Checkpoint**: US1 é entregável de forma independente e funciona ponta a ponta (E2E confirma), mas
T030 fica registrada como incompleta.

---

## Fase 4 — US2: Problema até a causa raiz (P1)

- [x] T031 `test/contract/problems.spec.ts` linha 179 — `POST /problems` cria `OPEN` com `PRB-...`.
- [x] T032 Invariante P1: `RESOLVED` sem `rootCause` recusado 422 (linha 392).
- [x] T033 Invariante P2: `CLOSED` sem `Action` `COMPLETED` de origem `PROBLEM` recusado 422
      (linha 474).
- [x] T034 Invariante P3: o mesmo usuário que completou a ação não pode fechar — 403 (linha 497); um
      usuário diferente fecha com sucesso (linha 527).
- [x] T035 Reabertura simétrica a T020 — confirmada pela mesma estrutura de teste em
      `problems.spec.ts`/`transition-problem.usecase.ts` (rootCause preservado no reopen, comentário
      explícito no use case).
- [x] T036 Escopo e negação auditada — linhas 255 (404 idêntico) e 218/276/449 (403 sem permissão).
- [x] T037 `domain/problem.entity.ts` com P1/P2/P3 (`assertRootCauseProvided`,
      `assertProblemHasCompletedCorrectiveAction`, `assertCloserNotSameAsCompleter`).
- [x] T038 `application/{create,list,get,update}-problem.usecase.ts` existem.
- [x] T039 `application/transition-problem.usecase.ts` — P2/P3 consultados ao vivo via
      `ProblemRepositoryPort.findCompletedOriginActionCompleters` a cada tentativa, nunca cacheado
      (comentário explícito no próprio arquivo).
- [x] T040 `presentation/problem.controller.ts` + DTOs + `problem-response.mapper.ts` existem e
      funcionam. **Mesma lacuna de T026**: `problems.openapi.yaml` não está em `CONTRACT_SOURCES`.
      Ver `STATE.md`.
- [x] T041 `ProblemsModule` registrado em `app.module.ts` (linha 134).
- [x] T042 `problem-catalog-view.tsx`, `problem-form.tsx`, `problem-overview.tsx` existem,
      espelhando a forma de T028-T029.
- [ ] **T043 — parcialmente feito.** Só 2 dos 11 componentes novos de Problema têm teste dedicado
      (`problem-close-dialog.test.tsx`, `problem-corrective-actions.test.tsx`). Mesma lacuna de T030
      para os demais: `problem-catalog-view.tsx`, `problem-form.tsx`, `problem-overview.tsx`,
      `problem-register-columns.tsx`, `problem-register-empty.tsx`, `problem-register-filters.tsx`,
      `problem-register-results-bar.tsx`, `problem-relationships-section.tsx`,
      `problem-transition-dialog.tsx`, `problem-lifecycle-actions.tsx`.

**Checkpoint**: US2 fecha de fato (P2/P3 comprovados por contrato e por E2E), com a mesma ressalva de
cobertura de componente que T030 registra.

---

## Fase 5 — US3: Vínculos com Risco, Ativo, Processo e Problema↔Incidente (P1)

- [x] T044 Permissão pareada provada — **não como teste de contrato HTTP**, e sim como teste de
      integração parametrizado: `test/integration/incident-problem-relationship-links.spec.ts`,
      bloco "ADR-020 part 5" (linha ~434), `it.each(PAIRS)` cobrindo os cinco pares. Forma diferente
      da pedida (contrato vs. integração), substância equivalente — registrado como divergência de
      forma, não lacuna.
- [x] T045 Mesma suíte, bloco "ADR-020 part 4" (linha ~399): alvo fora de escopo e alvo inexistente
      respondem idêntico, provado por contagem de linhas antes/depois, para os cinco pares.
- [ ] **T046 — parcialmente feito.** A suíte prova que desvincular preserva a linha (`unlinkedAt`
      carimbado, nunca deletado) e audita link/unlink com tipos próprios (linha ~466). **Não** prova
      a segunda metade pedida — desfazer e **refazer o mesmo par**, criando um novo vínculo enquanto
      o anterior permanece na trilha: nenhum teste chama `attemptLinkWithView` uma segunda vez sobre
      o mesmo par após o `unlink`.
- [ ] **T047 — NÃO FEITO.** "Visibilidade dos dois lados" nunca foi construída — ver T051/T052
      abaixo, que são a mesma lacuna do lado do backend.
- [x] T048 `Prisma{Incident,Problem}*LinkRepository` existem para os cinco pares
      (`infrastructure/prisma-incident-{risk,asset,process}-link.repository.ts`,
      `infrastructure/prisma-problem-{risk,incident}-link.repository.ts`).
- [x] T049 `application/links/link-{incident,problem}-*.usecase.ts` — verificação de escopo do alvo
      antes de gravar, confirmada pela suíte de integração acima.
- [x] T050 `IncidentRelationshipController`/`ProblemRelationshipController`
      (`presentation/{incident,problem}-relationship.controller.ts`) existem.
- [ ] **T051 — NÃO FEITO.** `risk-relationship.controller.ts`/`risk-response.mapper.ts` **não**
      foram estendidos. Busca exaustiva: nenhuma ocorrência real de `Incident`/`incident` em
      `apps/api/src/modules/risk/**` fora de dois comentários incidentais (um usa a palavra
      "coincidentally", o outro cita "Problems, Incidents" como exemplo genérico de módulo futuro
      num comentário de `audit.controller.ts`). O detalhe de um Risco **não** lista incidentes nem
      problemas vinculados a ele — nem no backend, nem na tela (`risk-detail-view.tsx` não tem
      referência alguma a Incidente/Problema).
- [ ] **T052 — NÃO FEITO.** Mesma verificação para Ativo e Processo: zero ocorrências de
      `Incident`/`incident` em `apps/api/src/modules/assets/**` ou `apps/api/src/modules/processes/
      **`. `asset-detail-view.tsx`/`process-detail-view.tsx` não têm aba nem seção de incidentes
      vinculados.
- [ ] **T053 — parcialmente feito.** As seções "Riscos vinculados"/"Ativos vinculados"/"Processos
      vinculados" existem nas telas de Incidente
      (`incident-relationships-section.tsx`) e "Riscos vinculados" na de Problema
      (`problem-relationships-section.tsx`) — a metade que depende de T048-T050. A outra metade —
      "Incidentes vinculados"/"Problemas vinculados" nas telas de Risco/Ativo/Processo — não existe,
      porque depende de T051/T052, que não foram feitas.
- [x] T053a Contrato Problema↔Incidente: `problem:link` + `incident:view` exigidos —
      `link-problem-incident.usecase.ts` e a suíte de integração parametrizada cobrem este par junto
      aos outros quatro (mesma ressalva de forma que T044).
- [x] T053b Escopo e revínculo para o par — mesma suíte, mesma ressalva de T046 (revínculo integral
      não comprovado para nenhum dos cinco pares, incluindo este).
- [ ] **T053c — não confirmado.** Teste de N:M genuíno (um problema com dois incidentes distintos, e
      vice-versa, ambos coexistindo) não foi localizado como caso de teste explícito nem na suíte de
      integração nem nos testes de contrato de `problems.spec.ts`/`incidents.spec.ts`. Pode existir
      implicitamente via schema (a tabela é de fato N:M, sem restrição de unicidade que a impeça),
      mas nenhum teste EXERCITA duas ligações simultâneas para provar isso.
- [x] T053d Teste de não-acoplamento: `problem-lifecycle.ts`/`incident.entity.ts` não fazem nenhuma
      consulta a `ProblemIncidentLink` em suas pré-condições de transição (confirmado por leitura de
      `transition-problem.usecase.ts`/`transition-incident.usecase.ts`, que só consultam Action para
      P2/P3) — a garantia arquitetural existe; não há, porém, um teste automatizado nomeado
      exercitando esta negativa especificamente (fechar problema com incidente `OPEN` vinculado, ou
      resolver incidente sem problema vinculado). Tratado como feito pela ausência estrutural da
      consulta, com a ressalva de que não há prova por execução dedicada.
- [x] T053e `ProblemIncidentLinkRepository`/`IncidentDirectoryPort`/`PrismaIncidentDirectoryAdapter`
      existem (`domain/ports/problem-incident-link-repository.port.ts`,
      `incidents/incident-directory.module.ts`, `infrastructure/incident-directory.adapter.ts`),
      registrados em `problems.module.ts` sem import direto de `modules/incidents`.
- [x] T053f `LinkProblemIncidentUseCase`/`UnlinkProblemIncidentUseCase`
      (`application/links/link-problem-incident.usecase.ts`) resolvem o alvo via
      `IncidentDirectoryPort`.
- [x] T053g `ProblemRelationshipController` expõe `GET`/`POST /problems/{problemId}/incidents` e
      `DELETE .../incidents/{linkId}`.
- [x] T053h `IncidentProblemListUseCase`
      (`application/links/list-incident-problem-links.usecase.ts`) e
      `GET /incidents/{incidentId}/problems` no `IncidentController`/mapper.
- [x] T053i Seção "Problemas vinculados" no detalhe do incidente
      (`incident-problem-links-section.tsx`) e "Incidentes vinculados" no de problema (aba
      `incidents` em `problem-relationships-section.tsx`).

**Checkpoint**: **não cumprido integralmente.** Os cinco pares funcionam a partir do lado de
Incidente/Problema (escrita, escopo, auditoria), mas **não** "nos dois sentidos" como o checkpoint
original afirma — a visibilidade do lado de Risco/Ativo/Processo nunca foi construída (T047/T051/
T052). Ver `STATE.md`.

---

## Fase 6 — US4: Consumir Ação e Evidência já existentes (P1)

- [x] T054 `test/contract/actions.spec.ts` linha 951 — `POST /actions` com `originType: INCIDENT`
      aceito end-to-end pela rota real, `201`.
- [x] T055 Idem, linha 983, `originType: PROBLEM` — a mesma ação que T033/T034 exigem.
- [ ] **T056 — NÃO FEITO.** Nenhum teste em todo `apps/api/test/` cria evidência com
      `subjectType: 'INCIDENT'`/`'PROBLEM'` nem exercita `IncidentEvidenceSubjectAccessor`/
      `ProblemEvidenceSubjectAccessor` diretamente. Os dois acessores existem e estão registrados
      (`registerEvidenceSubjectResolver`, confirmado nos dois `*.module.ts`), e o mecanismo em si é
      usado por outros domínios em produção — mas para Incidente/Problema especificamente é
      exatamente o padrão que CLAUDE.md §19.10 nomeia: existe, compila, nunca foi exercitado por
      nenhum caminho de teste ou produção real.
- [ ] **T057 — NÃO FEITO.** Consequência direta de T010: como nenhum acessor de
      Attachable/Commentable foi registrado para `INCIDENT`/`PROBLEM`, comentário e anexo bruto
      nestes dois tipos lançariam erro em tempo de execução, não apenas "não foram testados". Nenhum
      teste tenta.
- [x] T058 ~~Registrar `IncidentActionOriginAccessor`/`ProblemActionOriginAccessor`...~~ **Feito**,
      confirmado: os dois acessores existem
      (`application/{incident,problem}-action-origin-accessor.ts`), registrados nos `*.module.ts`,
      `ActionOriginType` ganhou os dois valores na migração `20260911030000`, e
      `test/integration/incident-problem-action-origin.spec.ts` (6 testes) mais
      `test/unit/action-model-convergence-guard.spec.ts` provam o registro e o escopo ao vivo.
      Mantido como estava — esta era a única marcação pré-existente no arquivo e resistiu à
      verificação.
- [ ] **T059 — NÃO FEITO.** Não existe painel de evidências nem painel de comentários/anexos em
      nenhuma das duas telas de detalhe. `incident-detail-view.tsx` só tem as abas overview/risks/
      assets/processes/problems/corrective-actions; `problem-detail-view.tsx` só tem overview/risks/
      incidents/corrective-actions. `EvidencePanel` (o componente compartilhado que Risco, Controle,
      Achado e Auditoria já usam) não é importado por nenhum arquivo de `features/incidents/` nem
      `features/problems/`. Combinado com T010, isto significa que mesmo se a tela existisse, anexo
      e comentário quebrariam em tempo de execução até T010 ser corrigida.
- [ ] **T060 — NÃO FEITO como verificação automatizada.** Não há um teste estrutural dedicado (no
      molde de `assets-processes-contract-no-deletion.spec.ts`) provando SC-004 para Incidente/
      Problema. A afirmação "nenhum sistema de tarefa/anexo paralelo foi criado" é verdadeira por
      inspeção manual desta reconciliação (nenhuma coluna de tarefa, arquivo ou aprovação nas duas
      tabelas), mas não está protegida por uma busca automatizada que reprovaria uma regressão
      futura.

**Checkpoint**: **não cumprido como descrito.** A metade de Ação (T054/T055/T058) fecha de verdade —
FR-010 é alcançável por uma chamada HTTP real, confirmado por teste e por E2E. A metade de Evidência/
Comentário/Anexo (T056/T057/T059) **não** fecha: o mecanismo de Evidência está registrado mas nunca
exercitado, e o de Comentário/Anexo nem sequer está registrado — nenhum dos dois tem superfície na
interface.

---

## Fase 7 — Interface (§18) (P2)

- [x] T061 `navigation-registry.ts`: `incidents`/`problems` com `status: 'implemented'`,
      `href`, gated por `incident:view`/`problem:view` (linhas 116-132).
- [ ] **T062 — NÃO FEITO.** Ver T030/T043: a maioria dos componentes novos continua sem teste
      dedicado; esta tarefa existia especificamente para fechar essa lacuna e não fechou.
- [x] T063 `docs/reviews/ui/incidents-verify/` (e o commit `e99d978`, "rendered-verification
      screenshots") registram capturas nos dois temas — register, formulário, detalhe com as quatro
      abas de relação, diálogo de cancelamento.
- [x] T064 `e2e/accessibility.spec.ts` ganhou fixture de incidente e problema cross-linked (commit
      `c284ea8`); 17 varreduras axe novas, register/formulário/abas nos dois temas onde aplicável,
      limpas.
- [x] T065 `e2e/incidents.spec.ts` linha 99 — jornada completa: criar → registro → detalhe →
      ciclo de vida → vincular risco/ativo/processo → sobrevive a reload.
- [x] T066 `e2e/problems.spec.ts` linha 202 — jornada completa incluindo os dois lados da
      precondição de fechamento (P2 recusado, depois satisfeito por usuário diferente/P3).
      **Ressalva**: o caminho de recusa de P3 especificamente (o MESMO usuário que completou a ação
      tentando fechar) não é exercitado neste E2E — só o de sucesso com usuário diferente. P3 tem
      cobertura de recusa real, mas só no teste de contrato (`problems.spec.ts` linha 497), nunca em
      navegador. Ver `STATE.md`.
- [ ] **T067 — NÃO FEITO.** Não existe `incidents-scope.spec.ts`/`problems-scope.spec.ts` nem
      qualquer variante — busquei por todo `apps/web/e2e/` por arquivo e por conteúdo (`orgUnit`/
      `scope` dentro de `incidents.spec.ts`/`problems.spec.ts`) e a única menção de escopo
      organizacional nesses dois arquivos é a seleção da unidade no formulário de criação, nunca um
      ator restrito a uma unidade tentando ler/escrever fora dela. Isto é exatamente a classe de
      lacuna que o checkpoint desta fase afirma ter fechado (F-55) e que, para os cinco pares de
      vínculo desta fase, continua aberta.

**Checkpoint**: **não cumprido integralmente** — T062 e T067 ficam de fora; T066 tem a ressalva de
P3 registrada acima.

---

## Fase 8 — Validação e fechamento

- [ ] **T068 — NÃO FEITO como registro explícito.** Não existe nenhum documento desta fase
      comparando a contagem de testes antes/depois com citação de FR por mudança. Reconstruído nesta
      reconciliação a partir dos logs de CI: baseline de `006-assets-processes` (`STATE.md` §1) era
      unit 490/contrato 648/integração 168/web unit 532; o primeiro commit desta fase (`064c9d1`) já
      media 485 de unidade da API — 5 a menos, sem nenhuma explicação nos commits desta fase (a
      queda aconteceu na fase `007-implementation-remediation`, entre as duas, fora do escopo desta
      tarefa). Contagem final confirmada por CI (run `34608398835`, commit `501c7ad`, sucesso): API
      unit 485 · contrato 712 · integração 207 · web unit 571 · E2E Chromium 100/100. Nenhuma dessas
      mudanças cita FR por linha, como a tarefa exige.
- [ ] **T069 — este é o arquivo que a tarefa pede, escrito agora.** Ver `STATE.md`. Os números acima
      vêm de CI real (run `34608398835`), não de execução local desta reconciliação — não rodei a
      suíte, por restrição desta tarefa de não tocar banco de dados.
- [ ] **T070 — NÃO FEITO.** Nenhuma revisão final documentada comparando Incidente e Problema
      arquivo a arquivo existe. Esta própria reconciliação encontrou pelo menos uma divergência de
      forma real e não citada (T012 vs. T013 — Incidente guarda sua tabela de transição dentro da
      entidade, Problema em arquivo próprio) e uma funcional (Problema tem P2/P3 com consulta viva a
      `Action`; Incidente não tem equivalente, o que é correto por FR-006, não uma lacuna). Um
      revisor dedicado poderia encontrar mais.

---

## Marco desbloqueado, 2026-09-11 — Incidente↔Problema (Q1-Q3 decididas)

Este marco existia como ponto de decisão explícito, bloqueado, até o coordenador decidir Q1
(um problema pode existir sem incidente — sim), Q2 (cardinalidade N:M, tabela nomeada, propriedade
de Problemas) e Q3 (nenhum acoplamento entre os dois fechamentos). As três decisões estão em
`spec.md`, seção "Decisões do coordenador", e em `research.md` D-13 a D-15. As tarefas T053a-T053i
(Fase 5, acima) são a implementação — não um adendo separado, porque a decisão chegou antes de
qualquer tarefa deste arquivo ter sido executada.

**Nenhuma tarefa deste arquivo permanece bloqueada por decisão de produto.**

---

## Dependências

- Fase 1 bloqueia a Fase 2. Fase 2 bloqueia as Fases 3-6.
- Fases 3 (US1) e 4 (US2) são independentes entre si — podem correr em paralelo, por times/agentes
  diferentes, exatamente como `spec.md` já registra ("nenhum dos dois é o 'principal' em relação ao
  outro").
- Fase 5 (US3) depende de 3 e 4 (precisa dos dois registros existirem para vinculá-los) — incluindo
  T053a-T053i (Problema↔Incidente), que dependem apenas dos dois registros existirem, nunca de
  T044-T053 (os outros quatro pares são independentes deste).
- Fase 6 (US4) depende de 3 e 4 (precisa dos dois registros existirem para ter algo a que a `Action`/
  `Evidence` se referira) — pode correr em paralelo à Fase 5.
- Fase 7 (interface) depende de 3, 4, 5 e 6 terem alguma superfície para renderizar.
- Fase 8 depende de todas as anteriores.

## MVP

Fases 1-3 (Setup, Fundação, US1) entregam um módulo de Incidente funcional e fechável, sozinho —
o menor corte que já produz valor demonstrável, seguindo a mesma definição de MVP que
`006-assets-processes/tasks.md` já usou para sua própria US1. **Este corte está de fato entregue e
funcional** (Fases 1-3 verificadas nesta reconciliação, com a ressalva de cobertura de componente em
T030).

## Cobertura

26 operações de contrato (15 Incidente + 11 Problema), cada uma com teste de contrato antes da
implementação (T015-T022, T031-T036, T044-T047, T053a-T053d); dois testes de integração de consumo
de capacidade compartilhada (T054-T057) provando SC-004; E2E dos dois caminhos completos e do escopo
organizacional (T065-T067) fechando a classe de lacuna que F-55 já registrou para os dois módulos
anteriores; teste dedicado de N:M genuíno e de não-acoplamento para Problema↔Incidente (T053c/T053d,
provando SC-007).

**Nota de reconciliação**: das 26 operações de contrato, as duas relativas a listagem/vínculo (T044-
T047) foram provadas por teste de **integração**, não de contrato HTTP, e T053c (N:M genuíno) não foi
localizado como teste explícito. O contrato E2E de escopo organizacional (T067) não existe. Ver
`STATE.md` para o relato completo.
