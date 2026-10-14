# Data Model — Auditoria e Achados (Fase 4)

Toda tabela desta fase é nova, exceto uma alteração aditiva a `findings` (§6). As decisões que
sustentam cada escolha estão em [research.md](./research.md) e não são repetidas aqui — esta seção
descreve apenas a forma persistida: colunas, nulidade, índices, o que é deliberadamente NÃO
armazenado, e cada tipo de entidade de auditoria novo.

Convenção de nomenclatura mantida de `003`/`004`: `snake_case` no banco, `camelCase` no domínio;
toda FK entre módulos usa `onDelete: Restrict` (nunca `Cascade`, nunca `SetNull` para uma FK
obrigatória); nenhuma tabela desta fase é apagada por nenhuma operação do contrato.

---

## §1. `AuditEngagement` (`audit_engagements`)

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | `uuid(7)`, mesmo padrão de toda outra entidade raiz. |
| `code` | text, único | não | Gerado (`AUD-AAAA-NNNN`), prefixo `AUD` novo no alocador compartilhado (research.md D-8). |
| `objective` | text | não | FR-001, "objetivo". |
| `period_start` / `period_end` | date | não | FR-001, "período". `period_end` DEVE ser `>= period_start` — verificado na aplicação (não `CHECK`: a mesma classe de invariante multi-coluna que o resto do schema já resolve fora do banco quando não há concorrência a proteger). |
| `org_unit_id` | uuid FK → `organizational_units`, `Restrict` | não | Mesma forma de `Risk.org_unit_id`/`Finding.org_unit_id` — nunca nulo. |
| `lead_auditor_user_id` | uuid FK → `users`, `Restrict` | não | FR-001, "responsável" — um único condutor, não uma equipe (spec fala de "quem conduz", singular). |
| `status` | `AuditEngagementStatus` | não | Padrão `PLANNING`. Três estados, duas arestas (research.md D-3). |
| `started_at` / `started_by_user_id` | timestamptz / uuid FK → `users`, `Restrict` | sim | Preenchidos juntos por `POST /audits/{id}/start`. Nulos em `PLANNING`. |
| `completed_at` / `completed_by_user_id` | timestamptz / uuid FK → `users`, `Restrict` | sim | Preenchidos juntos por `POST /audits/{id}/complete`. Nulos antes de `COMPLETED`. |
| `created_at` / `updated_at` | timestamptz | não | |
| `version` | int, padrão `1` | não | Concorrência otimista (research.md D-18) — mesmo mecanismo de `Risk`/`Control`/`Framework`. Incrementado em toda escrita, inclusive as duas transições. |

**Índices**: `(org_unit_id, status)` — a consulta mais comum ("meus engajamentos em execução");
`(lead_auditor_user_id)`.

**Deliberadamente NÃO armazenado**:
- Nenhuma contagem de achados agregada (`findingCount`, `openFindingCount`) — nenhum FR pede um
  resumo do engajamento nesta fase, e armazená-la duplicaria o que `GET /audits/{id}/findings` já
  serve sob demanda (§19.7: se algum dia existir, é calculada, nunca gravada).
- Nenhuma tabela de transição dedicada (`AuditEngagementLifecycleTransition`) — duas arestas
  lineares, capturadas como campo mudando dentro do próprio evento `AUDIT_ENGAGEMENT`
  (research.md D-3).
- Nenhum campo `cancelledAt`/status `CANCELLED` — não pedido por nenhum FR (research.md D-3).

**Invariante de negócio, não de coluna**: iniciar (`PLANNING → IN_PROGRESS`) exige ao menos um
vínculo de escopo em qualquer uma das três tabelas de escopo abaixo (`COUNT(*)` nas três, somado,
`> 0`) — verificado na transação da transição, não expresso como `CHECK` (a ausência de escopo é um
estado transitório válido enquanto `PLANNING`, o mesmo padrão que `FrameworkVersion` já usa para
"publicar exige ao menos um `Requirement`", `data-model.md` §2 de `004-compliance-management`).

---

## §2. `AuditScopeFrameworkVersion` (`audit_scope_framework_versions`)

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `audit_engagement_id` | uuid FK → `audit_engagements`, `Restrict` | não | |
| `framework_version_id` | uuid FK → `framework_versions`, `Restrict` | não | Aponta para a versão específica, nunca para `framework_id` (research.md D-2 — o ponto central da preservação de FR-006). |
| `linked_at` | timestamptz | não | |
| `linked_by_user_id` | uuid FK → `users`, `Restrict` | não | |

**Índice único** `(audit_engagement_id, framework_version_id)` — a mesma versão não é adicionada
duas vezes ao mesmo engajamento (uma tentativa repetida responde `409` como conflito de estado, não
como erro de validação — ver contrato).

**Índice** `(audit_engagement_id)` — a consulta de listagem de escopo.

**Sem `unlinked_at`/`unlinked_by_user_id`** — deliberado (research.md D-12): esta tabela não tem
operação de remoção; uma vez gravada, a linha é permanente pela vida do engajamento.

**Pré-condição de escrita**: `FrameworkVersion.status = PUBLISHED` (research.md D-2) — verificada
pela aplicação através do novo `FrameworkVersionDirectoryPort` (§8), nunca por leitura direta da
tabela `framework_versions` (proibida pela fronteira de módulo).

---

## §3. `AuditScopeRequirement` (`audit_scope_requirements`)

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `audit_engagement_id` | uuid FK → `audit_engagements`, `Restrict` | não | |
| `requirement_id` | uuid FK → `requirements`, `Restrict` | não | Aponta para a cláusula específica — imutável após publicação da versão-pai, por trigger de banco já existente (research.md D-2). |
| `linked_at` | timestamptz | não | |
| `linked_by_user_id` | uuid FK → `users`, `Restrict` | não | |

**Índice único** `(audit_engagement_id, requirement_id)`. **Índice** `(audit_engagement_id)`. Sem
remoção — mesma nota de §2.

**Pré-condição de escrita**: o requisito pertence a uma `FrameworkVersion` com `status = PUBLISHED`
(verificado transitivamente pelo mesmo porte).

---

## §4. `AuditScopeControl` (`audit_scope_controls`)

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `audit_engagement_id` | uuid FK → `audit_engagements`, `Restrict` | não | |
| `control_id` | uuid FK → `controls`, `Restrict` | não | |
| `linked_at` | timestamptz | não | |
| `linked_by_user_id` | uuid FK → `users`, `Restrict` | não | |

**Índice único** `(audit_engagement_id, control_id)`. **Índice** `(audit_engagement_id)`. Sem
remoção — mesma nota de §2.

**Pré-condição de escrita**: o controle existe, está `ACTIVE`, e seu `orgUnitId` (via
`ControlDirectoryPort`, já existente) está dentro do escopo resolvido do ator que define o escopo
(ADR-020 parte 4, research.md D-11) — um controle `SUSPENDED`/`RETIRED`/`DRAFT` ou fora de escopo é
recusado com `422`, indistinguível de um controle inexistente.

---

## §5. `FindingControlLink` (`finding_control_links`)

Mesma forma exata de `RiskControlLink` (`schema.prisma:1526`), do lado de `grc/finding`
(ADR-020 parte 1).

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `finding_id` | uuid FK → `findings`, `Restrict` | não | |
| `control_id` | uuid FK → `controls`, `Restrict` | não | |
| `linked_at` | timestamptz | não | |
| `linked_by_user_id` | uuid FK → `users`, `Restrict` | não | |
| `unlinked_at` | timestamptz | sim | FR-016 — desvincular preserva a linha. |
| `unlinked_by_user_id` | uuid FK → `users`, `Restrict` | sim | |

**Índice parcial único** `(finding_id, control_id) WHERE unlinked_at IS NULL` — escrito à mão na
migração (Prisma não expressa índice parcial), mesmo padrão já documentado como drift aceito por
`RequirementControlLink`/`ControlProcessLink`. **Índice** `(finding_id, unlinked_at)`.

**Pré-condição de escrita**: `Finding.status != ARCHIVED` (a mesma invariante de
`assertFindingEditable`, aplicada aqui — research.md D-4); controle existe, `ACTIVE`, dentro do
escopo do ator via `ControlDirectoryPort`.

---

## §6. `FindingRiskLink` (`finding_risk_links`)

Mesma forma de §5, contra `Risk`.

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `finding_id` | uuid FK → `findings`, `Restrict` | não | |
| `risk_id` | uuid FK → `risks`, `Restrict` | não | |
| `linked_at` | timestamptz | não | |
| `linked_by_user_id` | uuid FK → `users`, `Restrict` | não | |
| `unlinked_at` | timestamptz | sim | |
| `unlinked_by_user_id` | uuid FK → `users`, `Restrict` | sim | |

**Índice parcial único** `(finding_id, risk_id) WHERE unlinked_at IS NULL`. **Índice**
`(finding_id, unlinked_at)`.

**Pré-condição de escrita**: `Finding.status != ARCHIVED`; risco existe, `archived_at IS NULL`,
dentro do escopo do ator via `RiskDirectoryPort` (novo, §9).

---

## §7. Alteração aditiva a `Finding` (`findings`) — tabela existente, owned por `002-shared-grc-foundation`

| Coluna nova | Tipo | Nulo | Nota |
|---|---|---|---|
| `audit_engagement_id` | uuid FK → `audit_engagements`, `Restrict` | **sim** | FR-007/FR-008 — nula para todo achado manual (o caminho da Fase 1 continua válido sem alteração); preenchida apenas por `POST /audits/{auditId}/findings`. |

**Índice novo**: `(audit_engagement_id)` — a consulta `GET /audits/{id}/findings`.

**Nenhuma outra coluna de `findings` muda de forma.** `origin` (`FindingOrigin`) permanece com seus
três valores atuais — não ganha um quarto (research.md D-5). Nenhuma coluna existente de `Finding`
é removida, renomeada ou tem sua nulidade alterada — `SC-007` ("Riscos, Controles e Compliance
continuam funcionando sem alteração de teste") se estende, por princípio equivalente, aos testes
já existentes de `Finding` da Fase 1: nenhum deles depende de uma forma que esta migração altere.

**Nota de comportamento, não de coluna** (research.md D-6): o CASO DE USO de fechamento
(`CloseFindingUseCase`) passa a consultar `EvidenceLinkRepositoryPort` além de
`findCompletedLinkedActionResponsibles` — uma mudança de comportamento aditiva sobre a mesma
tabela, sem alteração de coluna. Nenhum teste de fechamento da Fase 1 que já anexa evidência antes
de fechar quebra; um teste que fechava SEM evidência alguma (se existir) deixa de passar — esperado
e reportado em research.md D-6, não uma regressão silenciosa.

---

## §8. Enums novos

```
enum AuditEngagementStatus {
  PLANNING
  IN_PROGRESS
  COMPLETED
}
```

Três estados, duas arestas (`PLANNING → IN_PROGRESS`, `IN_PROGRESS → COMPLETED`), lineares,
irreversíveis — nenhuma aresta de volta (research.md D-3). `COMPLETED` é terminal, mesmo tratamento
de `FrameworkVersionStatus.PUBLISHED`.

**`AuditEntityType`, seis valores novos** (crescimento aditivo do enum existente, migração revisada
— ADR-008; ver research.md D-9 para a justificativa de cada um):

```
AUDIT_ENGAGEMENT
AUDIT_SCOPE_FRAMEWORK_VERSION
AUDIT_SCOPE_REQUIREMENT
AUDIT_SCOPE_CONTROL
FINDING_CONTROL_LINK
FINDING_RISK_LINK
```

**`EntityCodePrefix`, um valor novo** (extensão aditiva do union em
`grc/shared/domain/entity-code.service.ts`, research.md D-8):

```
'AUD'
```

**Nenhuma mudança a `FindingStatus`, `FindingOrigin`, `FindingCategory`, `FindingSeverity`,
`FindingPriority`, `PermissionAction` ou qualquer outro enum já existente.** `PermissionAction`
reusa `LINK`/`TRANSITION`, já presentes (research.md D-7); nenhum valor novo é adicionado a ele.

---

## §9. Portes novos em `shared/grc-ports/` (não existem hoje — confirmado por grep)

### `RiskDirectoryPort` (`shared/grc-ports/risk-directory.port.ts`)

```ts
export interface RiskDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly orgUnitId: string;
  readonly isActive: boolean; // archivedAt === null (research.md D-4) — não `status`
}

export abstract class RiskDirectoryPort {
  abstract findById(id: string): Promise<RiskDirectoryEntry | undefined>;
}
```

Espelha `ControlDirectoryPort` exatamente. Adaptador: `modules/risk`. Sem `findManyById` — nenhum
consumidor desta fase precisa de resolução em lote (diferente de `ControlDirectoryPort.findManyById`,
que a Fase 3 introduziu para até 500 vínculos de uma vez); acrescentar quando um consumidor real
precisar (CLAUDE.md §19.10).

### `FrameworkVersionDirectoryPort` (`shared/grc-ports/framework-version-directory.port.ts`)

```ts
export interface FrameworkVersionDirectoryEntry {
  readonly id: string;
  readonly label: string;
  readonly status: 'DRAFT' | 'PUBLISHED';
  readonly frameworkId: string;
}

export abstract class FrameworkVersionDirectoryPort {
  abstract findById(id: string): Promise<FrameworkVersionDirectoryEntry | undefined>;
}
```

Sem `orgUnitId` — `FrameworkVersion` não tem escopo organizacional (catálogo global, research.md
D-11). Adaptador: `modules/compliance`.

### `RequirementDirectoryPort` (`shared/grc-ports/requirement-directory.port.ts`)

```ts
export interface RequirementDirectoryEntry {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
  readonly frameworkVersionId: string;
  readonly frameworkVersionStatus: 'DRAFT' | 'PUBLISHED';
}

export abstract class RequirementDirectoryPort {
  abstract findById(id: string): Promise<RequirementDirectoryEntry | undefined>;
}
```

`frameworkVersionStatus` incluído para que `LinkAuditScopeToRequirementUseCase` não precise de uma
segunda chamada a `FrameworkVersionDirectoryPort` só para verificar publicação — a mesma economia
de round-trip que `ControlDirectoryEntry` já aplica ao incluir `orgUnitId` em vez de forçar um
segundo porte. Adaptador: `modules/compliance`.

### `EvidenceLinkRepositoryPort` — método aditivo (arquivo existente, `grc/evidence`)

```ts
// Aditivo — findActiveLink/findById/unlink/listByEvidence, já existentes, não mudam.
abstract hasActiveLinkForSubject(
  subjectType: EvidenceSubjectType,
  subjectId: string,
): Promise<boolean>;
```

Consumido por `CloseFindingUseCase` (research.md D-6). `grc/finding` já pode importar `grc/evidence`
diretamente — sem porte intermediário — porque ambos vivem sob `grc/**`, o mesmo bucket de fronteira
de lint (nenhuma regra separa capacidades DENTRO de `grc/**`; só `core/** ↔ grc/**` e
`grc/** ↔ modules/**` são vigiadas). O precedente já existe:
`FindingEvidenceSubjectAccessor` (`grc/finding/application/collaboration/`) já importa de
`grc/evidence`'s registro de tipo fechado hoje.

### `FindingReferenceReadPort` (nomeado, não construído nesta fase — research.md D-16)

Reservado para a rota recíproca `GET /risks/{riskId}/findings`/`GET /controls/{controlId}/findings`,
fora do escopo desta entrega. Forma esperada, para quem a construir:

```ts
export interface FindingReferenceRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: FindingStatus;
}

export abstract class FindingReferenceReadPort {
  abstract listByControl(controlId: string): Promise<readonly FindingReferenceRecord[]>;
  abstract listByRisk(riskId: string): Promise<readonly FindingReferenceRecord[]>;
}
```

---

## §10. Permissões e papéis — o que precisa ser adicionado onde (não aplicado por este documento)

Ver research.md D-7 para a tabela completa e a justificativa. Resumo do que precisa mudar em código
(fora dos cinco arquivos desta tarefa, listado aqui para que a implementação não precise
redescobrir):

- `modules/audit-engagements/domain/audit-engagement-permissions.ts` (novo arquivo) — cinco
  permissões: `audit-engagement:view|create|edit|scope|transition`.
- `grc/finding/domain/finding-permissions.ts` (arquivo existente, edição aditiva) — duas
  permissões novas: `finding:remediate`, `finding:link`.
- `prisma/seed/platform.seed.ts` (arquivo existente, edição aditiva) — papel `Auditor` ganha
  `audit-engagement:view`; papel novo `Audit Lead` com a autoridade de escrita completa (research.md
  D-7).

Nenhum valor novo de `PermissionAction` — reuso de `LINK`/`TRANSITION`, já existentes.

---

## §11. Campos derivados nesta fase — nenhum

Diferente de `Control.effectiveness` ou `Requirement.complianceState`, nenhuma entidade desta fase
tem um campo calculado no momento da leitura (research.md D-14). `AuditEngagement.status` e
`Finding.status` são colunas gravadas, não recomputadas. Nenhum `GET` desta fase precisa de
`Cache-Control: no-store` — condição verificada e ausente, não omitida por descuido.
