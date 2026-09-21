# Data Model — Compliance (Fase 3)

Toda tabela desta fase é nova; nenhuma tabela existente muda de forma (SC-006: Riscos e Controles
continuam passando sem alteração de teste). As decisões que sustentam cada escolha estão em
[research.md](./research.md) e não são repetidas aqui — esta seção descreve apenas a forma
persistida.

---

## §1. `Framework`

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `code` | text, único | não | Gerado (`FMK-AAAA-NNNN`), estável para a vida do registro (research.md D-14). |
| `name` | text | não | |
| `description` | text | não | |
| `origin` | `FrameworkOrigin` | não | `EXTERNAL_STANDARD` \| `INTERNAL_POLICY` (FR-001). |
| `created_at` / `updated_at` | timestamptz | não | |
| `version` | int, padrão `1` | não | Concorrência otimista (mesmo mecanismo de Risco/Controle). |

**Sem `org_unit_id`.** Catálogo de escopo global, gated só por permissão (research.md D-2) —
mesmo padrão de `roles`/`permissions`, que também não têm a coluna.

**Índices**: `code` (único, já cobre busca por identificador).

---

## §2. `FrameworkVersion`

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `framework_id` | uuid FK → `frameworks` `onDelete: Restrict` | não | |
| `label` | text | não | Identificador do domínio, não gerado (research.md D-14). Único por framework. |
| `status` | `FrameworkVersionStatus` | não | `DRAFT` (padrão) \| `PUBLISHED`. Dois estados, uma aresta (research.md D-3). |
| `published_at` / `published_by_user_id` | timestamptz / uuid FK → `users` | sim | Preenchidos na publicação. Nulos enquanto `DRAFT`. |
| `created_at` / `updated_at` | timestamptz | não | |
| `version` | int, padrão `1` | não | Concorrência otimista. |

**Índice único** `(framework_id, label)`.

**Sem tabela de transições.** A publicação é um campo mudando de `DRAFT` para `PUBLISHED`, uma vez,
auditado dentro do próprio evento `FRAMEWORK_VERSION` (research.md D-3) — não existe
`FrameworkVersionLifecycleTransition`.

**Invariante de negócio, não de coluna**: publicar exige ao menos um `Requirement` (FR-005) —
verificado na transação da publicação (`COUNT(*) FROM requirements WHERE framework_version_id =
$1`), não expresso como `CHECK` (uma tabela vazia é um estado transitório válido enquanto `DRAFT`).

---

## §3. `Requirement`

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `framework_version_id` | uuid FK → `framework_versions` `onDelete: Restrict` | não | Pertence a exatamente uma versão (FR-003), nunca ao framework diretamente. |
| `external_ref` | text | não | O número da cláusula na norma (ex. `A.5.16`). Identificador do domínio, não gerado (research.md D-14). |
| `title` | text | não | |
| `description` | text | não | |
| `created_at` / `updated_at` | timestamptz | não | `updated_at` só muda enquanto a versão-pai está `DRAFT` — ver a trigger abaixo. |
| `created_by_user_id` | uuid FK → `users` | não | |
| `version` | int, padrão `1` | não | Concorrência otimista. |

**Índice** `(framework_version_id, external_ref)` — não único: duas versões de normas diferentes
podem coincidir no número de cláusula por acidente, e nada nesta especificação exige unicidade
global do `external_ref`; a unicidade que importa (não duplicar a mesma exigência dentro da MESMA
versão) fica como convenção de cadastro, não como `UNIQUE` — FR-007 fala de duplicação **entre**
normas ser correta, nunca de duplicação **dentro** da mesma versão ser proibida por regra que este
spec declare.

**Imutabilidade após publicação (FR-004) — trigger de banco, não só aplicação** (research.md D-4):

```
CREATE TRIGGER requirements_immutable_after_publish
    BEFORE UPDATE ON "requirements"
    FOR EACH ROW EXECUTE FUNCTION requirements_prevent_update_after_publish();
```

A função consulta `framework_versions.status` do pai (`NEW.framework_version_id` /
`OLD.framework_version_id`, que não podem divergir — um requisito nunca migra de versão) e recusa a
`UPDATE` quando o status é `PUBLISHED`. Espelha `approvals_prevent_overwrite()`
(`20260905170100_risk_lifecycle_and_approvals_baseline/migration.sql`), a única trigger de
imutabilidade já em produção nesta base.

**Não hard-deletado.** Nenhuma operação do contrato remove um requisito — nem em `DRAFT` (a
especificação não pede exclusão, só edição enquanto rascunho); reconsiderar uma cláusula em
rascunho é editá-la, não recriá-la.

---

## §4. `RequirementControlLink` — o mapeamento N:M (ADR-017, ADR-020)

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `requirement_id` | uuid FK → `requirements` `onDelete: Restrict` | não | |
| `control_id` | uuid FK → `controls` `onDelete: Restrict` | não | Integridade real no banco (ADR-020 parte 2) — `controls` é a tabela de Controles; a FK aponta para ela diretamente, o import de módulo continua proibido ao nível de código (research.md D-9). |
| `linked_at` / `linked_by_user_id` | timestamptz / uuid | não | |
| `unlinked_at` / `unlinked_by_user_id` | timestamptz / uuid | sim | Nulos enquanto vigente. Desvincular preserva (FR-011), nunca exclui fisicamente. |

**Unicidade parcial** `(requirement_id, control_id) WHERE unlinked_at IS NULL` — impede duplicata
vigente, permite revincular depois de desfeito (mesma técnica de `ControlProcessLink`).

**Índice** `(control_id) WHERE unlinked_at IS NULL` — é o que o cálculo de conformidade em lote
(§6) percorre para resolver, de um conjunto de requisitos, o conjunto de controles vigentes
envolvidos.

**Tipo de auditoria próprio**: `REQUIREMENT_CONTROL_LINK` (ADR-008, ADR-020 parte 1) — vincular e
desvincular são auditados com os dois identificadores (FR-010).

**Escopo na escrita**: o `control_id` referenciado precisa estar no escopo do ator, verificado via
`ControlDirectoryPort.findById` (existente, Fase 2) antes de gravar (research.md D-2, D-9). Um
controle fora de escopo, ou inexistente, responde como inexistente.

---

## §5. `RequirementControlMappingMigration` — a migração como evento de primeira classe (FR-012)

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `framework_id` | uuid FK → `frameworks` `onDelete: Restrict` | não | Origem e destino precisam pertencer ao mesmo framework (FR-012); guardado para consulta sem join. |
| `source_framework_version_id` | uuid FK → `framework_versions` `onDelete: Restrict` | não | |
| `target_framework_version_id` | uuid FK → `framework_versions` `onDelete: Restrict` | não | |
| `executed_at` / `executed_by_user_id` | timestamptz / uuid | não | |

**`RequirementControlMappingMigrationItem`** — um item por requisito de destino processado nesta
execução:

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `migration_id` | uuid FK → `requirement_control_mapping_migrations` `onDelete: Restrict` | não | |
| `target_requirement_id` | uuid FK → `requirements` `onDelete: Restrict` | não | |
| `source_requirement_ids` | uuid[] | não | Vazio quando `outcome = PENDING_DECISION` (research.md D-6). |
| `outcome` | `MappingMigrationOutcome` | não | `COPIED` \| `PENDING_DECISION` \| `SKIPPED_ALREADY_MAPPED` (research.md D-6). |
| `copied_link_count` | int, padrão `0` | não | Quantos `RequirementControlLink` esta execução criou para este destino. |

**Índice** `(migration_id)` na tabela de itens — leitura completa de uma execução em uma consulta.

**Tipo de auditoria próprio**: `REQUIREMENT_CONTROL_MAPPING_MIGRATION`, **um evento por execução**
(SC-004) — o resumo (contagens por `outcome`) vai no `newValues` do evento; o detalhe por item fica
nas tabelas acima, consultável por um endpoint de leitura dedicado, não replicado linha a linha na
trilha de auditoria (research.md D-6, US2 AS4: "não como uma sequência de vínculos avulsos").

---

## §6. `RequirementApplicabilityDeclaration` — a declaração de não aplicabilidade (FR-015)

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `requirement_id` | uuid FK → `requirements` `onDelete: Restrict` | não | |
| `justification` | text | não | Obrigatória (FR-015); sem ela a declaração é recusada antes de chegar aqui. |
| `declared_at` / `declared_by_user_id` | timestamptz / uuid | não | |
| `revoked_at` / `revoked_by_user_id` | timestamptz / uuid | sim | Preenchidos ao reverter para aplicável. Nulos enquanto vigente. |

**Unicidade parcial** `(requirement_id) WHERE revoked_at IS NULL` — no máximo uma declaração
vigente por requisito (research.md D-7). Ausência de linha vigente = aplicável (o padrão, FR-015 AS1).

**Tipo de auditoria próprio**: `REQUIREMENT_APPLICABILITY`.

---

## §7. Estado de conformidade — **sem coluna**, calculado, com marca d'água só para auditoria

Não existe `compliance_state` em `requirements`, nem em `framework_versions`, nem em nenhuma outra
tabela desta fase. `RequirementComplianceService` (`modules/compliance/domain/`) é o único ponto de
cálculo (research.md D-8), com esta forma:

```
entrada:  applicability (D-7), vínculos vigentes do requisito com { isActive, effectiveness }
          (resolvidos via ControlDirectoryPort + ControlEffectivenessPort, research.md D-9)
saída:    NOT_APPLICABLE | NOT_MET | NOT_PROVEN | PARTIALLY_MET | COMPLIANT
```

A tabela completa de quando cada valor ocorre e por que ele existe está em research.md D-8; não é
repetida aqui.

**A única tabela que este parágrafo introduz não guarda o estado — guarda a última vez que ele foi
observado, só para permitir auditar a mudança (FR-021)**:

### `RequirementComplianceAuditMark`

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `requirement_id` | uuid FK → `requirements` `onDelete: Restrict`, PK | não | Uma linha por requisito, criada na primeira leitura que o computa. |
| `last_audited_state` | `RequirementComplianceState` | não | O último valor **observado**, nunca o valor **atual** — quem quer o valor atual chama o calculador, nunca esta tabela. |
| `last_audited_at` | timestamptz | não | |

**Por que esta tabela não é a coluna que FR-017/§19.7 proíbem**: nenhuma operação de leitura desta
API consulta `RequirementComplianceAuditMark` para responder "qual o estado deste requisito" — essa
pergunta é sempre respondida pelo cálculo fresco (D-8). Esta tabela só é lida pelo próprio mecanismo
que a escreve, para decidir se uma mudança precisa ser auditada (research.md D-11). Escrita por
`UPDATE ... WHERE last_audited_state IS DISTINCT FROM $novo`, condicional, para que leituras
concorrentes do mesmo requisito não dupliquem o evento de auditoria da mesma transição.

**Tipo de auditoria próprio**: `REQUIREMENT_COMPLIANCE_STATE`, um evento por transição
efetivamente observada (nunca na criação inicial da marca — research.md D-11).

**Sem gêmeo SQL** (research.md D-10): ao contrário da efetividade de Controle (Fase 2), o estado de
conformidade não tem expressão SQL replicada, porque o escopo de cálculo desta fase — uma versão
por vez, até 500 cláusulas (SC-008) — cabe inteiro em cálculo em memória sobre chamadas em lote aos
dois portes de leitura, sem paginação/filtro arbitrário sobre uma tabela grande que justificasse o
custo de uma segunda implementação da regra em SQL.

---

## §8. Enumerações novas

```
FrameworkOrigin           EXTERNAL_STANDARD | INTERNAL_POLICY
FrameworkVersionStatus    DRAFT | PUBLISHED
MappingMigrationOutcome   COPIED | PENDING_DECISION | SKIPPED_ALREADY_MAPPED
RequirementComplianceState  NOT_APPLICABLE | NOT_MET | NOT_PROVEN | PARTIALLY_MET | COMPLIANT
```

`ControlEffectivenessLevel` **não** é declarado aqui — é o vocabulário do porte compartilhado
(research.md D-9), uma cópia deliberada e mínima de `ControlEffectiveness`
(`modules/controls/domain/control-effectiveness.service.ts`), mantida em paridade por teste, nunca
por import entre módulos.

---

## §9. Tipos de auditoria novos (`AuditEntityType`)

`FRAMEWORK`, `FRAMEWORK_VERSION`, `REQUIREMENT`, `REQUIREMENT_CONTROL_LINK`,
`REQUIREMENT_CONTROL_MAPPING_MIGRATION`, `REQUIREMENT_APPLICABILITY`,
`REQUIREMENT_COMPLIANCE_STATE` — sete valores, cada um com seu próprio field allow-list
(`modules/compliance/domain/compliance-audit-allowlist.ts`, seguindo exatamente o padrão de
`modules/controls/domain/control-audit-allowlist.ts`), acrescentados por migração aditiva revisada
(ADR-008: "closed platform enums grow by reviewed migration").

Nenhum evento genérico de "atualização" cobre mais de um destes — FR-025 proíbe reduzir a um
evento só, e cada um descreve uma intenção de negócio distinta (versão publicada, cláusula
vinculada, mapeamento migrado, aplicabilidade declarada, conformidade alterada — exatamente a lista
que FR-025 enumera).

---

## §10. Código de entidade

`EntityCodePrefix` (`grc/shared/domain/entity-code.service.ts`) estende de
`'EVD' | 'ACT' | 'FND' | 'CTL'` para `'EVD' | 'ACT' | 'FND' | 'CTL' | 'FMK'`; `ENTITY_CODE_PATTERN`
ganha `FMK` na mesma alternância (research.md D-14). Só `Framework` usa o alocador
(`GrcCodeSequence`, prefixo `FMK`); `FrameworkVersion` e `Requirement` não têm código gerado.

---

## §11. Permissões

`compliance:view`, `compliance:administer`, `compliance:map` — declaradas pelo agregador estático
(`permission-catalogue.ts`), seguindo `modules/controls/control-permissions.ts` como modelo de
arquivo (fora de `domain/application/infrastructure/presentation`, portanto fora da política de
`eslint-plugin-boundaries`).

Papel semeado: `Compliance Manager`, com as três (research.md D-13) — `platform.seed.ts`, mesma
convenção de `Control Owner`/`Control Approver`.

---

## §12. Escopo organizacional

`Framework`, `FrameworkVersion` e `Requirement` **não** usam `ScopedRepository` — são catálogo de
escopo global (research.md D-2), gated só por `compliance:view`/`compliance:administer`/
`compliance:map`, o mesmo regime de `roles`/`permissions`.

`RequirementControlLink` é a única escrita desta fase onde escopo organizacional é verificado
(§4): o controle referenciado precisa estar dentro do escopo do ator, via `ControlDirectoryPort`.
Fora de escopo, ou inexistente, responde como inexistente (FR-022).

---

## §13. O que é deliberadamente **não** armazenado, e por quê

- **Estado de conformidade** (requisito ou versão) — calculado, §7.
- **Correspondência "sugerida" entre cláusulas de versões diferentes** — o sistema não infere nem
  guarda uma sugestão automática de correspondência; a correspondência que existe é sempre a que o
  humano decidiu e submeteu numa execução de migração (research.md D-6), guardada em
  `RequirementControlMappingMigrationItem`, não antes disso.
- **Evidência ou ação anexadas diretamente a `Requirement`** — nenhuma tabela, nenhum valor de
  registro de tipo fechado (research.md D-12).
- **Um rótulo categórico único para o estado da versão** ("versão conforme"/"não conforme") — o
  resumo é a distribuição por estado mais o percentual (research.md D-8), nunca reduzido a um
  booleano que esconderia qual fração de "conforme" a versão realmente tem.
- **FK direta de `Requirement` para `Control`** — não existe; a relação passa sempre por
  `RequirementControlLink` (§4), nunca por uma coluna de atalho no requisito, mesmo para o caso
  comum de um único controle satisfazendo a cláusula.
