# Specification Quality Checklist: Gestão de Ativos e Gestão de Processos

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-08
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

## Notes

### Deviations taken deliberately, with reasons

**"No implementation details" — partially and knowingly relaxed, in one section only.**
The "Contexto medido, não presumido" section names files, line numbers, table names and a
measured database state. That is implementation detail by the letter of this checklist. It is
kept because this feature's whole purpose is to correct a structural condition that cannot be
stated without naming what it is, and because `specs/005-audit-findings/STATE.md` §6 records
three separate occasions where this repository accepted a confident, plausible, WRONG claim that
was never re-checked. The evidence table exists so the next reader can re-run each check rather
than trust the sentence. Every other section — user stories, FR, SC, assumptions — is free of
implementation detail and is what planning consumes.

### Why zero [NEEDS CLARIFICATION] markers

Three decisions were genuinely open. Each was resolved by measurement plus an existing, written
project rule, and recorded as a named assumption rather than deferred as a question:

- **A-2, `orgUnitId` obligatoriness** — resolved by AGENTS.md's explicit "carry the organizational
  scope on every scoped table" plus a measured database state (both existing rows are NULL). The
  rejected alternative is named, with the reason it is rejected.
- **A-3, two states vs. a four-state lifecycle** — resolved by measurement: `isActive` already has
  a real consequence at two verified call sites. Inventing further states would repeat a defect
  this project has hit three times.
- **A-5/A-6, ownership and authority of the two existing list operations** — resolved by an
  in-repository precedent (`GET /controls` moved out of `platform.openapi.yaml` in Fase 2).

Asking the user about any of the three would have been asking them to re-decide something the
repository had already decided in writing.

### One requirement is a security correction, not a feature

FR-011 / US3 / SC-003 close a **measured, currently-open** authorization gap: `isOrgUnitWithinScope`
appears 5 times in `control-link.usecase.ts` and **0 times** in `asset-link.usecase.ts` and
`process-link.usecase.ts`, in the same directory. ADR-020's own "correção 2" (F-46) closed exactly
this for Risk→Control on 2026-09-08 and did not extend it to the two identical siblings.

Planning must treat it as such: it needs a regression test that generalizes to every call site
sharing the pattern, per AGENTS.md, not a fix to the one instance reported here.
