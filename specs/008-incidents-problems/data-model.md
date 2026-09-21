# Data Model — Gestão de Incidentes e Gestão de Problemas

**Feature**: `008-incidents-problems` · **Spec**: [spec.md](./spec.md) ·
**Research**: [research.md](./research.md)

**O que este documento não modela, deliberadamente**: nenhuma tabela, coluna ou enum de valor
relacionando `Incident` a `Problem` diretamente. `spec.md`'s Q1-Q3 ficam sem resposta até o
coordenador decidir; modelar qualquer forma agora (FK, tabela de ligação, campo de cardinalidade)
seria escolher uma resposta em silêncio — exatamente o que a especificação proíbe. Ver §6.

---

## §1 — Duas tabelas novas, forma paralela deliberada

`Incident` e `Problem` nascem nesta fase — não há dado legado a migrar, ao contrário de
`006-assets-processes` (que promoveu tabelas já existentes). As duas tabelas têm forma parecida por
os dois domínios compartilharem o mesmo tipo de ciclo de vida (research.md D-4/D-5), não por serem o
mesmo conceito — cada campo divergente está listado explicitamente na tabela abaixo.

### `incidents`

```
id                    uuid           PK, default uuid(7)
code                  text           UNIQUE — 'INC-2026-0001' (R-008)
org_unit_id           uuid           NOT NULL, FK -> organizational_units (Restrict)
title                 text           NOT NULL
description           text           NOT NULL
severity              "IncidentSeverity"  NOT NULL
status                "IncidentStatus"    NOT NULL DEFAULT 'OPEN'
reported_by_user_id   uuid           NOT NULL, FK -> users (Restrict)
owner_user_id         uuid           NOT NULL, FK -> users (Restrict)
reported_on           date           NOT NULL
resolution_summary    text           NULL — preenchido só ao entrar em RESOLVED (Invariant I1)
resolved_at           timestamptz    NULL
resolved_by_user_id   uuid           NULL, FK -> users (Restrict)
closed_at             timestamptz    NULL
closed_by_user_id     uuid           NULL, FK -> users (Restrict)
cancellation_reason   text           NULL — preenchido só ao entrar em CANCELLED (Invariant I2)
cancelled_at          timestamptz    NULL
cancelled_by_user_id  uuid           NULL, FK -> users (Restrict)
created_at            timestamptz    NOT NULL DEFAULT now()
updated_at            timestamptz    NOT NULL (auto)
```

### `problems`

```
id                    uuid           PK, default uuid(7)
code                  text           UNIQUE — 'PRB-2026-0001'
org_unit_id           uuid           NOT NULL, FK -> organizational_units (Restrict)
title                 text           NOT NULL
description           text           NOT NULL
severity              "ProblemSeverity"   NOT NULL
status                "ProblemStatus"     NOT NULL DEFAULT 'OPEN'
owner_user_id         uuid           NOT NULL, FK -> users (Restrict)
identified_on         date           NOT NULL
root_cause            text           NULL — preenchido só ao entrar em RESOLVED (Invariant P1)
resolved_at           timestamptz    NULL
resolved_by_user_id   uuid           NULL, FK -> users (Restrict)
closed_at             timestamptz    NULL
closed_by_user_id     uuid           NULL, FK -> users (Restrict)
cancellation_reason   text           NULL
cancelled_at          timestamptz    NULL
cancelled_by_user_id  uuid           NULL, FK -> users (Restrict)
created_at            timestamptz    NOT NULL DEFAULT now()
updated_at            timestamptz    NOT NULL (auto)
```

**Divergências entre os dois, e só estas**: `Incident` tem `reported_by_user_id`/`reported_on`/
`resolution_summary`/`cancellation_reason` (o registrante pode ser diferente do dono, e a resolução é
um resumo do que foi feito); `Problem` tem `identified_on`/`root_cause` no lugar equivalente (não há
"quem reportou" separado do dono — um problema nasce de análise, não de um relato de terceiro) — e
`Problem` tem a exigência adicional de FR-010 (§4) antes de fechar, que `Incident` não tem.

---

## §2 — Novas tabelas de ligação (research.md D-3)

Forma idêntica às quatro já em produção (`FindingRiskLink`, `ControlAssetLink`,
`ControlProcessLink`, `RiskAssetLink`) — coluna dupla de origem/alvo, autor do vínculo, e
`unlinked_at`/`unlinked_by_user_id` em vez de exclusão de linha.

```
incident_risk_links
  id                    uuid  PK
  incident_id           uuid  NOT NULL, FK -> incidents (Restrict)
  risk_id               uuid  NOT NULL, FK -> risks (Restrict)
  linked_by_user_id     uuid  NOT NULL, FK -> users (Restrict)
  linked_at             timestamptz NOT NULL DEFAULT now()
  unlinked_at           timestamptz NULL
  unlinked_by_user_id   uuid  NULL, FK -> users (Restrict)
  -- índice único parcial (incident_id, risk_id) WHERE unlinked_at IS NULL

incident_asset_links      -- mesma forma, (incident_id, asset_id)
incident_process_links    -- mesma forma, (incident_id, process_id)
problem_risk_links        -- mesma forma, (problem_id, risk_id)

problem_incident_links    -- N:M, decisão do coordenador (research.md D-14) — ver §6
  id                    uuid  PK
  problem_id            uuid  NOT NULL, FK -> problems (Restrict)
  incident_id           uuid  NOT NULL, FK -> incidents (Restrict)
  linked_by_user_id     uuid  NOT NULL, FK -> users (Restrict)
  linked_at             timestamptz NOT NULL DEFAULT now()
  unlinked_at           timestamptz NULL
  unlinked_by_user_id   uuid  NULL, FK -> users (Restrict)
  -- índice único parcial (problem_id, incident_id) WHERE unlinked_at IS NULL
```

`problem_incident_links` é a quinta tabela de ligação, não uma exceção de forma — ver §6 para a
propriedade de módulo e a razão de o nome ser `problem_incident_links`, não o inverso.

---

## §3 — Migração aditiva de enums fechados (ADR-008)

Todas as alterações abaixo são `ALTER TYPE ... ADD VALUE`, numa única migração revisada, seguindo o
mesmo padrão que `20260907085000_permission_action_add_grc_foundation` e
`20260908110300_finding_control_risk_links_baseline` já estabeleceram.

```sql
ALTER TYPE "ActionOriginType" ADD VALUE 'INCIDENT';
ALTER TYPE "ActionOriginType" ADD VALUE 'PROBLEM';

ALTER TYPE "EvidenceSubjectType" ADD VALUE 'INCIDENT';
ALTER TYPE "EvidenceSubjectType" ADD VALUE 'PROBLEM';

ALTER TYPE "AttachableEntityType" ADD VALUE 'INCIDENT';
ALTER TYPE "AttachableEntityType" ADD VALUE 'PROBLEM';

ALTER TYPE "CommentableEntityType" ADD VALUE 'INCIDENT';
ALTER TYPE "CommentableEntityType" ADD VALUE 'PROBLEM';

ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBLEM';
ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT_RISK_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT_ASSET_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'INCIDENT_PROCESS_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBLEM_RISK_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROBLEM_INCIDENT_LINK';
```

Mais duas tabelas de enum novo (não extensão — tipo criado por esta fase), na mesma migração:

```sql
CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');
CREATE TYPE "ProblemSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "ProblemStatus" AS ENUM ('OPEN', 'IN_ANALYSIS', 'RESOLVED', 'CLOSED', 'CANCELLED');
```

`EntityCodePrefix` (`grc/shared/domain/entity-code.service.ts`) ganha `'INC'` e `'PRB'` — mudança de
código (união de tipo TypeScript), não de schema; `ENTITY_CODE_PATTERN` é estendido junto.

**Verificação exigida** (mesma disciplina que toda migração aditiva anterior já documentou): aplicar
a migração para cima contra um banco descartável e confirmar que nenhuma tabela existente muda de
forma — as sete famílias de `ALTER TYPE` são as únicas operações contra objetos pré-existentes.

---

## §4 — Invariantes

- **I1 (Incidente)**: `resolution_summary` é `NOT NULL` no momento em que `status` se torna
  `RESOLVED`, e permanece preenchido dali em diante (nunca limpo por uma transição posterior).
  Domain-enforced (`incident.entity.ts`, não CHECK de banco — mesmo padrão que `Finding` usa para
  `closure_justification`).
- **I2 (Incidente)**: `cancellation_reason` é `NOT NULL` no momento em que `status` se torna
  `CANCELLED`. Domain-enforced.
- **P1 (Problema)**: `root_cause` é `NOT NULL` no momento em que `status` se torna `RESOLVED`.
  Domain-enforced.
- **P2 (Problema)**: `status` só pode se tornar `CLOSED` se existir ao menos uma linha em `actions`
  com `origin_type = 'PROBLEM'`, `origin_id = problems.id`, `status = 'COMPLETED'` — verificado por
  consulta no caso de uso de transição, não por CHECK de banco (a mesma razão que impede um CHECK
  simples: a condição atravessa duas tabelas). Reverificado a cada tentativa de transição, nunca
  cacheado.
- **P3 (Problema)**: o usuário que executa a transição para `CLOSED` (`closed_by_user_id`) DEVE ser
  diferente do `completed_by_user_id` da `Action` que satisfaz P2. Domain-enforced, mesma forma que
  `assertClosedByDifferentUser` já faz para `Finding`.
- **L1 (vínculos)**: índice único parcial `(origin_id, target_id) WHERE unlinked_at IS NULL` em cada
  uma das cinco tabelas de ligação — nunca dois vínculos ativos simultâneos para o mesmo par,
  revincular depois de desvincular é permitido (mesma forma de `EvidenceLink`'s `L1`/`L2`).
- **L2 (Problema↔Incidente)**: nenhuma invariante de `Incident`/`Problem` consulta
  `problem_incident_links` (research.md D-15, decisão do coordenador) — o vínculo nunca participa de
  P1/P2/P3 nem de nenhuma precondição de transição de `Incident`. É informativo e auditável, nunca
  uma trava de ciclo de vida.

---

## §5 — Estado derivado, calculado por um único componente (CLAUDE.md §19.7)

Nenhum campo armazenado duplica o que se pode calcular. Os dois candidatos a estado derivado desta
fase:

- **"Incidente está em aberto" / "problema está em aberto"** — não é um campo: é
  `status NOT IN ('CLOSED', 'CANCELLED')`, calculado onde for necessário (listagem, indicador),
  nunca armazenado. Não introduz um vencimento (`dueOn`) — nem `Incident` nem `Problem` têm prazo
  nesta especificação; se um SLA de tempo de resposta for requisito de uma fase futura, o cálculo
  segue o mesmo padrão único que `grc/shared/domain/overdue.service.ts` já estabelece para `Action`
  (research.md, `007-implementation-remediation` D-R... — um único `isXOverdue`, nunca duplicado).
- **"Problema pode fechar" (P2 acima)** — calculado sob demanda pelo caso de uso de transição no
  momento da tentativa, nunca armazenado como um booleano `readyToClose` que poderia divergir do
  fato assim que a `Action` mudasse de estado depois do cálculo.

---

## §6 — Incidente↔Problema (research.md D-13 a D-15, decisões do coordenador)

**Q1-Q3 estão decididas.** `problem_incident_links` é modelada em §2, exatamente como uma quinta
tabela de ligação — não uma exceção de forma, não uma coluna, não um CHECK.

**Cardinalidade**: N:M (D-14). Um problema pode explicar vários incidentes; um incidente pode ter
mais de uma causa contribuinte registrada. `Problem` não exige nenhum incidente vinculado para
nascer ou para transitar por seu próprio ciclo de vida (D-13) — o vínculo é sempre opcional, dos dois
lados, 0..N.

**Propriedade de módulo, sem import cruzado**: a tabela chama-se `problem_incident_links` (Problema
primeiro), porque a rota de escrita (`POST`/`DELETE /problems/{problemId}/incidents`) pertence ao
módulo de Problemas — o mesmo sentido de propriedade que `ControlAssetLink` já tem para Controles.
`modules/problems` resolve o incidente-alvo através de `IncidentDirectoryPort`
(`shared/grc-ports/incident-directory.port.ts`), nunca importando `modules/incidents` diretamente
(ADR-011). `modules/incidents` expõe `GET /incidents/{incidentId}/problems` consultando a mesma
tabela pela própria infraestrutura — leitura direta de uma tabela da plataforma, não uma chamada ao
código de Problemas. Nenhum dos dois módulos importa o outro em nenhuma direção.

**Autorização dos dois lados, exigida desde a primeira linha**: criar o vínculo exige
`problem:link` **e** `incident:view` — a mesma dupla exigência que ADR-020 parte 5 já estabelece
para todo par, desta vez decidida como requisito de partida, não como correção posterior (este
projeto já teve que fechar essa lacuna duas vezes: F-46 e F-49 em `docs/deferred-findings.md`).

**Nenhum acoplamento de ciclo de vida (D-15, L2 acima)**: o vínculo é puramente informativo e
auditável. Nenhuma invariante de `Incident` ou `Problem` consulta `problem_incident_links`. Fechar um
problema não verifica o estado de nenhum incidente vinculado; resolver um incidente não verifica nem
cria nenhum problema. Se uma organização quiser condicionar um fechamento ao outro, isso é política e
relatório da Fase 7 (Indicadores), não uma restrição de banco desta fase — `docs/architecture/
grc-roadmap.md` registra a pergunta na cauda daquela fase, com a razão do coordenador anexada.
