# Data Model — Fundação GRC Compartilhada

Modelo conceitual e relacional. Nomes de tabela, coluna e enum permanecem em inglês (CLAUDE.md
§11.1); a semântica é descrita em pt-BR.

---

## 1. Visão geral

Quatro modelos novos e seis enums novos. Nenhum modelo existente é alterado nesta fase, com uma
exceção aditiva declarada em §7.

```
Evidence ──1:N──> EvidenceLink ──(subjectType, subjectId)──> sujeito
                                   registro de tipo fechado, sem FK

Action ──(originType, originId)──> origem
                                   registro de tipo fechado, sem FK

Finding ──1:N──> Action            FK real (ambos em grc/)
Finding ──N:M──> Evidence          via EvidenceLink, subjectType = FINDING
```

---

## 2. Evidence

Registro GRC que sustenta uma afirmação. **Não** é arquivo: o arquivo é armazenamento; a evidência
é a asserção de que aquele artefato prova alguma coisa.

| Campo | Tipo | Obrigatório | Justificativa de uso |
|---|---|---|---|
| `id` | uuid v7 | sim | identidade |
| `code` | text único | sim | `EVD-2026-0001` — citável em relatório e ofício (R-008) |
| `orgUnitId` | uuid | sim | posse e escopo (R-004) |
| `title` | text | sim | identificação humana |
| `description` | text | não | contexto |
| `type` | `EvidenceType` | sim | auditor filtra pela natureza da prova |
| `source` | `EvidenceSource` | sim | procedência: como entrou no sistema (FR-010) |
| `ownerUserId` | uuid | sim | responsável pela prova |
| `collectedOn` | date | sim | data a que a prova se refere — **distinta** de `createdAt` (FR-005) |
| `validUntil` | date | não | vencimento; alimenta a consulta de evidências a vencer (FR-006) |
| `status` | `EvidenceStatus` | sim | ciclo de vida |
| `externalUrl` | text | não | referência externa quando não há arquivo |
| `observation` | text | não | prova que é o próprio registro, sem artefato — ou, quando há arquivo, a leitura de uma linha do que ele demonstra (ver revisão abaixo) |
| `archivedAt` / `archivedByUserId` | timestamptz / uuid | não | arquivamento com atribuição |
| `createdAt` / `updatedAt` | timestamptz | sim | metadados |

> **Revisão feita durante a implementação da US1 (T017-T038), não o desenho original.** Esta
> seção descrevia `fileId` como "FK real para `File` — reutiliza a infraestrutura existente",
> implementado no T005/T007 como FK real para `Attachment.id`. Essa combinação nunca poderia
> funcionar: `Attachment` carrega `entityType`/`entityId` — ele se anexa **a** um pai — e
> `UploadService` resolve esse pai via `getAttachableEntityAccessor(...).resolveViewableParent(...)`,
> que lança exceção se o pai ainda não existe. Uma evidência só poderia ganhar um anexo **depois**
> de já existir, o que torna `file_id` necessariamente `NULL` no instante em que a linha é
> inserida — e por consequência o CHECK original sempre exigia, na prática, `external_url` ou
> `observation`. Evidência apenas-com-arquivo era impossível de criar: exatamente a classe de
> defeito "ponto de extensão que nunca foi exercitado" que CLAUDE.md §19.10 nomeia, aplicada aqui
> a uma coluna em vez de a um mecanismo.
>
> **Correção**: `fileId` foi **removido** de `Evidence`. `EVIDENCE` foi registrada em
> `AttachableEntityType` (migração aditiva `ALTER TYPE ... ADD VALUE`) e ganhou acessor no
> registro de entidades (`core/comments/domain/entity-registry.ts`), exatamente como `RISK` já
> faz. Um arquivo passa a alcançar a evidência pelo mesmo mecanismo de anexos já provado —
> `POST /attachments` com `entityType: EVIDENCE`, criado necessariamente **depois** que a
> evidência já existe — em vez de por uma coluna que nenhuma operação conseguia preencher
> corretamente no momento em que a restrição era avaliada. Isto é exatamente o que FR-035 já
> exigia (reutilizar anexos existentes, nunca um sistema próprio).
>
> Isto não reescreve a história: o desenho original está registrado no histórico de versão deste
> documento e nas migrações já aplicadas (`20260907090100_grc_foundation_baseline`), que **não**
> foram editadas — a correção é aditiva (`20260907091000_attachable_entity_type_add_evidence`,
> `20260907091100_evidence_file_fk_correction`).

**Invariante E1 (revisada)**: ao menos um de `externalUrl`, `observation` preenchido (FR-002).
Aplicado por CHECK no banco **e** no domínio — a regra é de negócio, e o banco é a última linha.
A restrição é deliberadamente mais estreita que o desenho original: uma evidência sustentada por
arquivo agora também carrega sempre ao menos uma `observation` de uma linha dizendo o que o
arquivo demonstra — "aqui está o relatório de teste de intrusão que cobre a API administrativa" é
mais útil a um auditor que um nome de arquivo isolado, e é o que mantém a intenção da FR-002
("toda evidência é legível por um humano") verificável no banco, agora que não existe mais coluna
`fileId` para o CHECK também testar.

**Invariante E2**: `validUntil`, quando presente, ≥ `collectedOn`.

**Invariante E3**: `archivedAt` e `archivedByUserId` são preenchidos juntos ou nenhum.

`EvidenceType`: `DOCUMENT`, `SCREENSHOT`, `SYSTEM_LOG`, `ATTESTATION`, `INSPECTION`, `OTHER`.
`EvidenceSource`: `MANUAL_UPLOAD`, `SYSTEM_EXPORT`, `THIRD_PARTY`, `INSPECTION`.
`EvidenceStatus`: `ACTIVE`, `ARCHIVED`. **Apenas dois** — vencimento **não** é estado gravado.

Uma versão anterior deste modelo incluía `EXPIRED` no enum e ao mesmo tempo afirmava, em §6, que
vencimento era derivado. As duas coisas não podem ser verdade: ou a coluna aceita `EXPIRED` e algo
precisa gravá-lo, ou não aceita. Mantida a segunda — `validUntil` é a única fonte de verdade, o
vencimento é projetado na leitura, e nenhuma rotina periódica precisa existir para mover registros
de estado.

Índices: `code` único; `(orgUnitId, status)`; `(validUntil, status)`; `(ownerUserId, status)`.

---

## 3. EvidenceLink

Associação nomeada entre uma evidência e um sujeito. Entidade própria — não coluna — porque o
vínculo tem autor, data, histórico e evento de auditoria próprios (FR-008).

| Campo | Tipo | Obrigatório | Justificativa |
|---|---|---|---|
| `id` | uuid v7 | sim | identidade |
| `evidenceId` | uuid | sim | FK real para `Evidence`, `onDelete: Restrict` |
| `subjectType` | `EvidenceSubjectType` | sim | registro de tipo fechado (R-001) |
| `subjectId` | uuid | sim | **sem FK** — ver R-001 |
| `linkedAt` / `linkedByUserId` | timestamptz / uuid | sim | quem vinculou e quando |
| `unlinkedAt` / `unlinkedByUserId` | timestamptz / uuid | não | desvínculo preserva a linha |
| `note` | text | não | por que esta prova sustenta este sujeito |

`EvidenceSubjectType`: `RISK`, `RISK_TREATMENT_DECISION`, `FINDING`, `ACTION`.

Valores futuros (`CONTROL`, `REQUIREMENT`, `AUDIT`) **não** são adicionados agora: um enum é
extensível por migração aditiva, e declarar valores sem consumidor é a abstração especulativa que o
critério de admissão proíbe.

**Invariante L1**: unicidade parcial em `(evidenceId, subjectType, subjectId)` **onde
`unlinkedAt IS NULL`** — o mesmo par não pode ter dois vínculos ativos, mas pode ter um histórico
de vínculo e desvínculo repetidos.

**Invariante L2**: `unlinkedAt` e `unlinkedByUserId` preenchidos juntos ou nenhum.

Índices: `(subjectType, subjectId, unlinkedAt)`; `(evidenceId, unlinkedAt)`; o índice único parcial
de L1.

---

## 4. Action

Unidade de trabalho rastreável. Uma só, para todos os domínios.

| Campo | Tipo | Obrigatório | Justificativa |
|---|---|---|---|
| `id` | uuid v7 | sim | identidade |
| `code` | text único | sim | `ACT-2026-0001` |
| `orgUnitId` | uuid | sim | escopo |
| `originType` | `ActionOriginType` | sim | registro de tipo fechado |
| `originId` | uuid | sim | **sem FK** (R-001) |
| `title` | text | sim | — |
| `description` | text | não | — |
| `responsibleUserId` | uuid | sim | FK real para `User` |
| `dueOn` | date | sim | prazo |
| `status` | `ActionStatus` | sim | ciclo |
| `completedAt` / `completedByUserId` | timestamptz / uuid | não | carimbados na conclusão |
| `reopenedAt` / `reopenedByUserId` / `reopenReason` | timestamptz / uuid / text | não | reabertura (FR-016) |
| `createdAt` / `updatedAt` | timestamptz | sim | — |

`ActionOriginType`: `RISK_TREATMENT`, `FINDING`.
Origens futuras (`INCIDENT`, `COMPLIANCE_GAP`, `CONTROL_IMPROVEMENT`, `PROBLEM`) entram com seus
módulos.

`ActionStatus`: `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
Deliberadamente idêntico a `TreatmentActionStatus`, para que a convergência de R-003 seja
mapeamento um-para-um e não tradução.

**Transições legais**:

```
OPEN ──> IN_PROGRESS ──> COMPLETED
  │            │              │
  │            │              └──> OPEN            (reabertura, exige motivo)
  └────────────┴──────────────────> CANCELLED
```

`CANCELLED` é terminal. `COMPLETED → OPEN` é a única saída de um estado terminal, e é registrada
como evento distinto.

**Invariante A1**: `completedAt` preenchido se e somente se `status = COMPLETED`.
**Invariante A2**: reabertura exige `reopenReason` não vazio.
**Invariante A3**: `dueOn` no passado é aceito na criação — remediação atrasada se registra, não se
impede.

Índices: `code` único; `(responsibleUserId, status, dueOn)` — atende "minhas ações" e "atrasadas";
`(originType, originId)`; `(orgUnitId, status)`; `(dueOn, status)`.

---

## 5. Finding

Constatação GRC. Não é registro genérico de problema.

| Campo | Tipo | Obrigatório | Justificativa |
|---|---|---|---|
| `id` | uuid v7 | sim | identidade |
| `code` | text único | sim | `FND-2026-0001` — citado em relatório |
| `orgUnitId` | uuid | sim | escopo |
| `title` | text | sim | — |
| `description` | text | sim | o que foi constatado |
| `recommendation` | text | não | o que se recomenda fazer |
| `category` | `FindingCategory` | sim | natureza da constatação |
| `origin` | `FindingOrigin` | sim | de onde veio |
| `severity` | `FindingSeverity` | sim | gravidade do fato (R-005) |
| `priority` | `FindingPriority` | sim | urgência de tratar (R-005) |
| `ownerUserId` | uuid | sim | responsável pelo achado |
| `identifiedOn` | date | sim | quando foi constatado |
| `status` | `FindingStatus` | sim | ciclo |
| `closedAt` / `closedByUserId` / `closureJustification` | timestamptz / uuid / text | não | encerramento |
| `archivedAt` / `archivedByUserId` | timestamptz / uuid | não | arquivamento |
| `createdAt` / `updatedAt` | timestamptz | sim | — |

`FindingCategory`: `NONCONFORMITY`, `CONTROL_DEFICIENCY`, `OBSERVATION`, `IMPROVEMENT_OPPORTUNITY`.
`FindingOrigin`: `INTERNAL_ASSESSMENT`, `CONTROL_TESTING`, `MANAGEMENT_REVIEW`.
Origens futuras (`AUDIT`, `COMPLIANCE_MONITORING`, `SECURITY_ASSESSMENT`, `PRIVACY_ASSESSMENT`)
entram com seus módulos.
`FindingSeverity`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
`FindingPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
`FindingStatus`: `OPEN`, `IN_REMEDIATION`, `CLOSED`, `ARCHIVED`.

**Transições legais**:

```
OPEN ──> IN_REMEDIATION ──> CLOSED ──> ARCHIVED
  │             │              │
  └─────────────┴──> CLOSED    └──> IN_REMEDIATION   (reabertura)
```

**Invariante F1**: encerrar exige ao menos uma ação vinculada concluída **ou**
`closureJustification` não vazia (FR-026).

**Invariante F2 — segregação de funções**: `closedByUserId` não pode ser o `responsibleUserId` de
nenhuma `Action` concluída vinculada a este achado (FR-025). Aplicada no domínio; **não** por CHECK,
porque envolve outra tabela — e uma restrição que o banco não consegue expressar deve ser dita no
domínio de forma explícita e testada, não simulada por gatilho.

**Invariante F3**: conclusão de todas as ações **não** transiciona o achado. O encerramento é
sempre ato explícito (FR-024).

**Invariante F4**: só um achado `CLOSED` pode ser arquivado. Arquivar não é atalho para fechar —
se fosse, contornaria a segregação de funções de F2 (FR-027).

**Alcançabilidade das transições**: cada transição do diagrama tem operação própria no contrato —
`closeFinding`, `reopenFinding`, `archiveFinding` — e `updateFinding` **não** aceita `status`.
Um estado que nenhuma operação alcança é coluna morta, e foi assim que `ARCHIVED` existiu neste
modelo até a análise apontar.

Índices: `code` único; `(orgUnitId, status)`; `(severity, status)`; `(ownerUserId, status)`;
`(status, identifiedOn)`.

---

## 6. Estados derivados

Dois estados **nunca** são digitados:

- **Ação atrasada**: `status ∈ {OPEN, IN_PROGRESS}` e `dueOn < hoje`. Calculada na leitura por um
  serviço único (R-006), como já se faz com nível de risco. Não existe coluna `isOverdue`.
- **Evidência vencida**: `validUntil < hoje`. Exposta como o booleano `expired`, calculado na
  leitura. Não existe valor `EXPIRED` em `EvidenceStatus` nem coluna materializada — ver §2.

---

## 7. Alteração aditiva no módulo de Riscos

Único ponto de contato com o existente. Nenhuma coluna é removida ou renomeada.

`RiskTreatmentAction` ganha `actionId uuid?` — FK opcional para `Action`, `onDelete: Restrict`,
preenchida na criação a partir da fase (R-003). Colunas existentes permanecem autoritativas para
todas as leituras atuais; nenhuma rota, resposta ou tela muda.

A convergência — retirar `RiskTreatmentAction`, apontar as rotas de risco para `Action`, e
eliminar as quatro duplicatas do predicado de vencimento (F-24) — é fase própria, pré-requisito de
Incidentes.

---

## 8. O que este modelo deliberadamente não tem

Tabela genérica de relacionamento; modelo de entidade universal; motor de workflow; motor de
metadados; tabela de versões por entidade ou consulta temporal genérica; `Control`, `Framework`,
`FrameworkVersion`, `Requirement`; coluna de escopo global paralela à hierarquia; coluna `isOverdue`
ou `isExpired` materializada; chave estrangeira especulativa para módulo inexistente.
