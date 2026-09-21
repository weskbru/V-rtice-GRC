# PharosGRC - Agent Instructions

## Context

PharosGRC is a corporate Governance, Risk and Compliance platform.

The first business domain is Risk Management.

Always read CLAUDE.md before performing significant work.

---

## Documentation map

Before significant work, also check whether a topic doc already covers what you are about to
touch — this repository has one:

- `docs/HANDOVER.md` — onboarding entry point: overview, environment setup, recommended reading
  order for a first day.
- `docs/STATE.md` — dated snapshot of what exists today (implemented/partial/planned per module),
  known pending items. Not a changelog.
- `docs/architecture.md`, `docs/architecture/database.md`, `docs/architecture/security.md`,
  `docs/architecture/frontend.md`, `docs/guides/development.md`, `docs/guides/testing.md`,
  `docs/guides/troubleshooting.md` — one topic doc each; each is the source of truth for its
  subject.
- `docs/modules/` — one document per business module (status, code paths, open items).
- `docs/architecture/decisions.md` — ADRs (ADR-016 onward; ADR-001–015 live in
  `specs/001-grc-platform-foundation/research.md`).
- `docs/local-environment.md` — dated environment decisions/traps (D-1..D-23).
- `docs/deferred-findings.md` — canonical, dated defect/debt register (F-1..F-73).
- `docs/README.md` — full index, with a "source of truth per subject" table and a Vigente/Histórico
  split.

**When changing behavior, update the topic doc that is the source of truth for it, in the same
change** — not as a follow-up. A schema change updates `docs/architecture/database.md` if the model
or migration policy shifted; a new endpoint or authorization rule updates
`docs/architecture/security.md`'s checklist section if the pattern itself changed; a new module gets
(or extends) its own `docs/modules/*.md`. Closing a phase also means updating that phase's own
`specs/NNN-*/STATE.md` — see `docs/guides/development.md` §6.9.

---

## General rules

- Do not implement unspecified functionality.
- Do not make architectural changes without justification.
- Prefer small, isolated changes.
- Avoid unnecessary dependencies.
- Preserve existing contracts whenever possible.
- Never expose secrets.
- Never bypass authorization checks.
- Consider auditability for business-critical changes.
- The v1 user-facing UI language is permanently Brazilian Portuguese (pt-BR); add every new user-facing string to the centralized message catalogs in pt-BR, never inline in a component.
- Never reintroduce user-facing English text; technical identifiers (code, types, files, database, API, audit action names, logs, comments, test names) stay in English.

---

## Before coding

The agent must:

1. Understand the requirement.
2. Locate the relevant specification.
3. Identify affected modules.
4. Identify architectural impacts.
5. Identify security implications.
6. Identify required tests.

---

## During coding

- Follow the project's architecture.
- Keep modules cohesive.
- Minimize coupling.
- Validate input.
- Handle errors explicitly.
- Keep business logic out of controllers and UI components where appropriate.
- Do not duplicate business rules.
- Do not introduce abstractions without a concrete need.

---

## After coding

Run, when applicable:

- unit tests;
- integration tests;
- end-to-end tests;
- lint;
- type-check.

Review the resulting diff.

Verify that unrelated files were not changed.

---

## Security

Never:

- hard-code credentials;
- commit secrets;
- trust client-side authorization;
- expose sensitive data unnecessarily;
- disable security controls merely to make tests pass.

Authorization must be enforced server-side.

---

## Database

Database changes must be deliberate.

Consider:

- migrations;
- indexes;
- constraints;
- referential integrity;
- historical data;
- audit requirements;
- performance.

Do not modify production-oriented schema assumptions casually.

---

## GRC principles

Business entities may have historical significance.

Do not simply delete or overwrite important GRC information when the domain requires traceability.

Prefer explicit lifecycle states and audit history when appropriate.

---

## Agent delegation

Use specialized agents when appropriate.

Suggested responsibilities:

- backend: API and domain implementation;
- frontend: UI and interaction;
- database: schema and persistence;
- QA: test strategy and validation;
- security: security review;
- architecture: architectural review.

The main agent remains responsible for integration and final consistency.

## Engineering rules validated by external benchmark

Derived from a benchmark of a mature open-source GRC platform (`docs/history/probo-benchmark.md`).
Principles only — never stack-specific conventions from another codebase. Each is here because a
real defect motivated it, not for symmetry.

### Authorization and scope

- **Carry the organizational scope on every scoped table**, even when it is derivable through a
  relation. Authorization must never depend on a join, and never on a foreign key supplied by the
  client.
- **After authorizing, pass the resolved scope down.** Downstream code uses that scope; it never
  re-derives one from a client-supplied id. Re-deriving is how a patched IDOR comes back.
- UI permission gating is a **convenience, never a security control**. The server decides, always.

### Errors and logging

- **Opaque errors by default.** Only explicitly mapped categories surface a meaningful message;
  the default branch always returns a generic internal error and logs the original server-side.
  Never expose stack traces, SQL errors or file paths.
- **Structured logs carry identifiers, never values.** No PII in logs.

### Secrets at rest

Three tiers, decided per column, never ad hoc: hash for high-entropy tokens; password hash for
human passwords; reversible encryption only for what must be read back. No plaintext secret in a
text column, ever.

### Frontend state

- Decision order: server data in the query cache; shareable state in the URL; ephemeral state in
  `useState`; context; global store last.
- **A URL-state hook never owns a `useState` mirror plus a write-back effect.** Multiple writers
  fight each other. This is the exact shape of the causes/consequences defect: data saved
  correctly to the database while vanishing from the screen, with every test green.
- Fetched data is not drilled down as props from an ancestor. The component that uses it reads it
  where it is used.

### Tests

- **Every endpoint has contract coverage** (D-11). This project's mirror test — contracted
  operations versus implemented operations — stays green; it is what caught two contracted
  endpoints that had never been implemented.
- **E2E isolation comes from fresh fixtures created through the real API**, not from a shared
  mutable account pool. A shared pool produced both the F-16 race and F-34's 37 orphaned users.
- A security fix gets a regression test that **generalizes to every call site sharing the
  vulnerable pattern**, not only the reported instance.

### Documentation

- A guide that describes what the code does today, without a ratified decision behind it, says so
  in its own first line (`Status: provisional`). Distinguish *what the code does* from *what was
  decided*.
- Prefer an index plus per-topic files over one growing document. A policy nobody can find is a
  policy nobody follows.
