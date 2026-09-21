/**
 * Structural guard against F-63 (`docs/deferred-findings.md`) parte 1 being
 * reintroduced: a permission's `description` is **product prose shown to a
 * customer's administrator** — CLAUDE.md §11.1 — never the raw technical
 * `identifier` and never a citation of this repository's own internal
 * specification artefacts (`spec.md`, `data-model.md`, `research.md`,
 * `FR-nnn`, `D-nn`, …).
 *
 * Mirrors `seeded-role-description-content.spec.ts`'s own guard for F-32 —
 * same three structural rules, same non-vacuity discipline (a detector that
 * matches nothing protects nothing) — checked here against
 * `getAllPermissionDefinitions()` instead of `SYSTEM_ROLE_DEFINITIONS`, so a
 * permission added by any future module is covered the day it is added,
 * never a hand-copied list.
 *
 * ## Where this text actually renders
 *
 * The role detail dialog, the permission list shown while creating or
 * editing a role, and the user's own role dialog (F-63's own three named
 * surfaces) — none of them is a frontend catalogue entry, so no frontend
 * gate could ever catch English leaking in here; only a guard on the
 * SOURCE of the text can.
 *
 * ## A fourth rule this file adds beyond F-32's three
 *
 * F-32 never needed a language check — its violations were EITHER already
 * pt-BR prose citing spec artefacts, OR raw identifiers, never English
 * prose outright. F-63 parte 1's actual defect was 74 descriptions written
 * in English from the start. `ENGLISH_TELLS` is a conservative, best-effort
 * detector (a handful of English function words essentially never used in
 * pt-BR technical prose) — it does not prove a string IS pt-BR, only that it
 * is not OBVIOUSLY English; false negatives are possible for a very short
 * description with no function word at all, but every description in the
 * catalogue today is a full sentence, so this has real reach.
 */
import { describe, expect, it } from 'vitest';

import { getAllPermissionDefinitions } from '../../src/permission-catalogue';

/** Same shape as `seeded-role-description-content.spec.ts`'s own
 * `SPEC_ARTEFACT_PATTERNS` — kept as a local copy rather than a shared
 * import: the two guards protect different source data (permissions vs.
 * roles) that happen to be checked the same way, not a single mechanism
 * that should be refactored into one just because the regexes match. */
const SPEC_ARTEFACT_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'a spec-kit artefact filename', pattern: /\b\w+[-\w]*\.md\b/i },
  {
    label: 'a spec feature-directory name (e.g. 008-incidents-problems)',
    pattern: /\b\d{3}-[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/,
  },
  { label: 'a requirement identifier (FR-/NFR-/SC-)', pattern: /\b(?:N?FR|SC)-\d+/i },
  { label: 'a research decision identifier (D-nn)', pattern: /\bD-\d+\b/ },
  { label: 'an architecture decision record reference', pattern: /\bADR-\d+/i },
  { label: 'a task identifier (Tnnn)', pattern: /\bT\d{3}\b/ },
  { label: 'a user-story identifier (USn)', pattern: /\bUS\d+\b/ },
  { label: 'a deferred-findings identifier (F-nn)', pattern: /\bF-\d+\b/ },
  { label: 'a document section sign', pattern: /§/ },
];

/** Every permission identifier the REAL catalogue declares — never a
 * hand-copied list, for the same reason F-32's guard reads
 * `getAllPermissionDefinitions()` rather than enumerating identifiers by
 * hand. */
const ALL_PERMISSION_IDENTIFIERS: readonly string[] = getAllPermissionDefinitions().map(
  (definition) => definition.identifier,
);

/** Catches an identifier-shaped token even if the catalogue does not (yet)
 * declare it — a permission renamed tomorrow would otherwise slip past the
 * catalogue check. No whitespace around the colon, so ordinary pt-BR prose
 * with a colon ("plataforma: usuários") is not a match. */
const IDENTIFIER_SHAPED_TOKEN = /\b[a-z][a-z-]*:[a-z][a-z-]*\b/;

/**
 * Conservative English tells: whole-word matches for function words that
 * are essentially never legitimate pt-BR technical prose. Deliberately
 * narrow (a handful of high-confidence words, not a full stopword list) to
 * keep the false-positive rate low against real pt-BR sentences that
 * happen to contain a loanword or a proper noun.
 */
const ENGLISH_TELLS: readonly RegExp[] = [
  /\bthe\b/i,
  /\bwithin\b/i,
  /\brecords?\b/i,
  /\borganizational scope\b/i,
  /\band\b/i,
  /\ba new\b/i,
  /\ban? [a-z]+ing\b/i,
];

/** The three structural detectors plus the language tell, as one predicate
 * — mirrors `seeded-role-description-content.spec.ts`'s own
 * `findContentViolations` shape. */
function findContentViolations(description: string): string[] {
  const violations: string[] = [];

  for (const { label, pattern } of SPEC_ARTEFACT_PATTERNS) {
    const match = pattern.exec(description);
    if (match) {
      violations.push(`${label}: "${match[0]}"`);
    }
  }

  for (const identifier of ALL_PERMISSION_IDENTIFIERS) {
    if (description.includes(identifier)) {
      violations.push(`raw permission identifier: "${identifier}"`);
    }
  }

  const shaped = IDENTIFIER_SHAPED_TOKEN.exec(description);
  if (shaped) {
    violations.push(`permission-shaped token: "${shaped[0]}"`);
  }

  for (const tell of ENGLISH_TELLS) {
    const match = tell.exec(description);
    if (match) {
      violations.push(`English tell: "${match[0]}"`);
    }
  }

  return violations;
}

describe('Permission descriptions are pt-BR product prose, never English or an internal artefact (F-63 parte 1)', () => {
  const definitions = getAllPermissionDefinitions();

  it('the catalogue has permissions to check — the guard has subjects', () => {
    expect(definitions.length).toBeGreaterThan(0);
    expect(definitions.filter((definition) => definition.description.trim().length === 0)).toEqual(
      [],
    );
  });

  it.each(definitions.map((definition) => ({ identifier: definition.identifier, definition })))(
    '$identifier — description is clean pt-BR prose, no artefact, no raw identifier, no English tell',
    ({ definition }) => {
      expect({
        identifier: definition.identifier,
        violations: findContentViolations(definition.description),
      }).toEqual({ identifier: definition.identifier, violations: [] });
    },
  );

  it('gives every permission a description of its own — no two permissions read alike', () => {
    const descriptions = definitions.map((definition) => definition.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

describe('The F-63 parte 1 guard is not vacuously true', () => {
  /** The actual pre-translation strings this catalogue carried, quoted
   * verbatim from `docs/deferred-findings.md` F-63 and the source files
   * before this fix — the same non-vacuity discipline F-32's own guard
   * establishes: a detector that never rejects anything protects nothing. */
  const PRE_TRANSLATION_VIOLATIONS: readonly { readonly label: string; readonly text: string }[] = [
    {
      label: 'risk:view (plain English prose)',
      text: "View risk records within the caller's organizational scope.",
    },
    {
      label: 'control:edit (English prose citing a raw identifier-shaped transition)',
      text:
        "Edit a control's descriptive, ownership and classification fields, and move it through " +
        'DRAFT->ACTIVE and ACTIVE<->SUSPENDED transitions.',
    },
    {
      label: 'incident:transition (English prose citing data-model.md)',
      text: 'Move an incident through its lifecycle (data-model.md D-4).',
    },
    {
      label: 'problem:link (English prose citing research.md)',
      text: 'Link or unlink a problem to a risk, or to an incident it explains (research.md D-14).',
    },
    {
      label: 'report:view (English prose citing spec.md FR-025)',
      text:
        'List report definitions and run a report, computing every referenced indicator metric ' +
        '(spec.md FR-025).',
    },
  ];

  it.each(PRE_TRANSLATION_VIOLATIONS)(
    'rejects the pre-translation description of $label',
    ({ text }) => {
      expect(findContentViolations(text).length).toBeGreaterThan(0);
    },
  );

  it('rejects every one of the five pre-translation descriptions measured, not merely some', () => {
    const undetected = PRE_TRANSLATION_VIOLATIONS.filter(
      ({ text }) => findContentViolations(text).length === 0,
    ).map(({ label }) => label);

    expect(undetected).toEqual([]);
  });

  it('accepts ordinary pt-BR prose that uses a colon — the token detector is not trigger-happy', () => {
    const ordinary =
      'Acesso administrativo completo à plataforma: usuários, papéis, unidades organizacionais e ' +
      'configuração da metodologia.';

    expect(findContentViolations(ordinary)).toEqual([]);
  });

  it('accepts a real translated description from the catalogue itself', () => {
    const risk = getAllPermissionDefinitions().find(
      (definition) => definition.identifier === 'risk:view',
    );
    expect(risk, 'risk:view must be seeded').toBeDefined();
    expect(findContentViolations(risk!.description)).toEqual([]);
  });
});
