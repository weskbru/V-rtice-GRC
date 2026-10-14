# Specification Quality Checklist: Fundação GRC Compartilhada

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation notes — iteration 1

Three issues were found on the first pass and fixed before this checklist was marked complete.

1. **SC-007 originally read "a regra de vencimento existe em um único lugar do código"** — a
   code-structure claim, not a user-facing outcome, and therefore not technology-agnostic. It was
   kept deliberately rather than removed: F-24 records that this exact predicate is currently
   duplicated in four places, and the whole point of a shared foundation is that it stops being
   duplicated. The criterion is stated as verifiable by search, which is testable without
   knowing the implementation. **Accepted as a deliberate exception, recorded here rather than
   hidden.**

2. **FR-018 and FR-019 reference the existing Risk module by name.** That is a dependency, not an
   implementation detail, and the brief requires the compatibility analysis to be explicit. Kept.

3. **The "Contexto e limites" section cites a competing product's defect.** Rewritten to state the
   defect without naming the product, so the specification stands on its own reasoning rather than
   on an external comparison. The evidence remains available in
   `docs/history/probo-benchmark.md`.

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- No `[NEEDS CLARIFICATION]` markers were needed: every open question had a defensible default
  grounded in an accepted ADR or in existing, verified system behaviour. Defaults are recorded in
  the Assumptions section rather than left implicit.

---

## Análise pós-tarefas (`/speckit-analyze`) — 2026-09-07

Seis achados. Todos os CRITICAL e HIGH resolvidos antes de declarar pronto.

| ID | Severidade | Achado | Disposição |
|---|---|---|---|
| C1 | **CRITICAL** | `FindingStatus` declarava 4 estados e 6 transições; a API implementava uma (`closeFinding`). `ARCHIVED` e a reabertura eram **inalcançáveis**, e as colunas `archivedAt`/`archivedByUserId` nunca seriam preenchidas por nada. | **RESOLVIDO** — `reopenFinding` e `archiveFinding` no contrato, invariante F4 (só encerrado arquiva, para que arquivar não vire atalho contornando a segregação de funções), tarefas T066a, T066b e T071a. |
| C2 | **HIGH** | `EvidenceStatus` era enum de coluna gravada e incluía `EXPIRED`, enquanto o próprio modelo afirmava que vencimento era derivado e nunca gravado. O contrato expunha `status` **e** `expired`, sem dizer qual é autoritativo. | **RESOLVIDO** — `EXPIRED` removido do enum, que fica `ACTIVE`/`ARCHIVED`. Vencimento é só o booleano calculado; `validUntil` é a única fonte de verdade. A contradição ficou registrada no data-model em vez de apagada. |
| C3 | **HIGH** | 23 de 36 FRs e 3 de 10 SCs não eram citados por identificador em nenhum artefato posterior. A cobertura existia semanticamente, mas não era verificável em revisão. | **RESOLVIDO** — cada FR e SC agora é citado pela tarefa que o realiza. Verificado por script: zero sem citação. |
| C4 | MEDIUM | `EvidenceSubjectType.ACTION` existia sem nenhuma tarefa ou cenário que o exercitasse — valor de enum sem consumidor. | **RESOLVIDO** — T045a, na fase de US2, onde `Action` já existe. |
| C5 | MEDIUM | Nada no contrato impedia encerrar um achado por `updateFinding`, contornando a segregação de funções. | **RESOLVIDO** — o contrato declara que `status` é rejeitado como propriedade desconhecida; T066 testa isso de forma adversarial. |
| C6 | LOW | FR-019 exigia caminho de convergência "datado" sem data. | **RESOLVIDO** — marco fixado em tasks.md: a convergência precede a fase de Incidentes. |

**Métricas finais**: 36 FRs, 10 SCs, 89 tarefas, 20 operações de contrato. Zero tarefas fora do
formato exigido, zero rótulos divergentes da fase, zero requisitos sem citação, zero operações sem
tarefa de contrato.

**Observação sobre C1**, que vale mais que a correção em si: o modelo declarava um estado que
nenhuma operação alcançava. É a mesma classe de defeito registrada sete vezes neste projeto — algo
que parecia coberto porque estava escrito, e que nunca havia sido executado. A análise a pegou
porque comparou o diagrama de transições com as operações do contrato, e não porque alguém releu o
texto.
