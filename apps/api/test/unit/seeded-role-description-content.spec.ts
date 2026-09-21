/**
 * Structural guard against F-32 (`docs/deferred-findings.md`) being
 * reintroduced: a seeded role's `description` is **product prose shown to a
 * customer's administrator**, not an engineering note.
 *
 * ## Why a guard exists at all
 *
 * These strings are seeded into `role.description` and rendered verbatim on
 * "Papéis e permissões" — since the 015 redesign, as the two-line body of
 * each role card, the most-read text on that screen. Nothing in the web app
 * contains them, so **no frontend gate could ever catch them**: F-32 was
 * found by a person reading a rendered screen, and F-63 confirmed it a
 * second time, seven months later, still unfixed. Between those two
 * readings the descriptions grew — Problem Manager reached 599 characters,
 * Risk Analyst 528 — because every phase that touched a role appended its
 * own justification to the user-facing string.
 *
 * Three rules, in descending order of seriousness, each of which F-32
 * recorded being broken:
 *
 *  1. **No internal specification artefact.** `spec.md`, `data-model.md`,
 *     `research.md`, `FR-017`, `D-13`, `§4`, `invariante P3`,
 *     `008-incidents-problems` — internal structure leaking into the
 *     product. The reasoning is not deleted; it moves to a code comment
 *     beside the definition, which CLAUDE.md §11.1 explicitly permits in
 *     any language.
 *  2. **No raw permission identifier.** `control:approve`,
 *     `risk:create/edit/assess/treat/transition` — an administrator picking
 *     a role needs to know what it lets someone DO, in business language.
 *     The identifier already has its own place on that screen, beside the
 *     pt-BR verb the web catalogue gives it; it does not belong in prose.
 *     Checked against the REAL catalogue (`getAllPermissionDefinitions()`),
 *     never a hand-copied list, so a permission added tomorrow is covered
 *     the day it is added.
 *  3. **A length ceiling.** The card gives the description two clamped
 *     lines. Past roughly 200 characters the essential sentence is pushed
 *     out of view by whatever came first, which is precisely how F-32's
 *     worst offenders read on screen.
 *
 * ## Non-vacuity
 *
 * A guard that passes because its detector matches nothing protects
 * nothing — the lesson of F-28/F-31/F-33, and of `openapi:check` describing
 * routes it could not see fields in. So the detectors here are also run
 * against the ACTUAL pre-fix strings, quoted from F-32/STATE.md §9, and
 * each must be caught. If someone weakens a pattern to let a new violation
 * through, that half of the suite goes red first.
 *
 * This guards the SEED, i.e. a definition written wrong in this repository.
 * It does not guard a description an operator types into a custom role
 * through the admin UI — that is user content, not shipped product text.
 */
import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_DEFINITIONS } from '../../prisma/seed/platform.seed';
import { getAllPermissionDefinitions } from '../../src/permission-catalogue';

/**
 * Every shape an internal specification reference has taken in this
 * repository's role descriptions, as observed in F-32 and F-63. Kept as
 * named data so a future reviewer can see what each pattern is for instead
 * of decoding a regular expression.
 */
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
  {
    label: 'a named domain invariant (e.g. "invariante P3", "C1/C2")',
    pattern: /\binvariante\s+[A-Z]\d+\b|\b[A-Z]\d\/[A-Z]\d\b/,
  },
];

/** The real catalogue — never a hand-copied list (ADR-003's own rule, and
 * the reason `upsertPermissions` reads the same function). */
const ALL_PERMISSION_IDENTIFIERS: readonly string[] = getAllPermissionDefinitions().map(
  (definition) => definition.identifier,
);

/**
 * Catches an identifier-shaped token that the catalogue does not (yet)
 * contain — `control:create/edit/test` collapses several at once, and a
 * permission renamed tomorrow would otherwise slip past the catalogue
 * check. Deliberately requires NO whitespace around the colon, so ordinary
 * pt-BR prose ("plataforma: usuários") is not a match.
 */
const IDENTIFIER_SHAPED_TOKEN = /\b[a-z][a-z-]*:[a-z][a-z-]*\b/;

/** F-32/STATE.md §9's own measurement: the card body is two clamped lines. */
const DESCRIPTION_MAX_LENGTH = 200;

/** The actual strings this guard exists to have rejected, quoted from
 * `docs/deferred-findings.md` F-32 and `specs/015-roles-permissions-surface/STATE.md` §9. */
const HISTORICAL_VIOLATIONS: readonly { readonly label: string; readonly text: string }[] = [
  {
    label: 'Compliance Manager (spec directory + research.md + D-13)',
    text:
      'Mantém a biblioteca normativa (frameworks, versões, requisitos), o mapeamento requisito-' +
      'controle e as declarações de aplicabilidade (004-compliance-management, research.md D-13).',
  },
  {
    label: 'Control Approver (raw identifiers + C1/C2 + data-model.md §4)',
    text:
      'Mantido estreito e distinto do Control Owner — exclui deliberadamente ' +
      'control:create/edit/test — para que a segregação de funções da atestação (C1/C2, ' +
      'data-model.md §4) seja administrável concedendo control:approve a um grupo pequeno.',
  },
  {
    label: 'Control Owner (data-model.md §4, FR-017/FR-018)',
    text:
      'Exclui deliberadamente control:approve — quem executa a verificação nunca decide a própria ' +
      'atestação (data-model.md §4, FR-017/FR-018).',
  },
  {
    label: 'Incident Manager (FR-006, spec.md, 008-incidents-problems)',
    text:
      'FR-006 (spec.md, 008-incidents-problems) decide explicitamente que fechar um incidente não ' +
      'exige segregação de funções entre quem resolveu e quem fecha.',
  },
  {
    label: 'Problem Manager (FR-011, invariante P3, data-model.md, FR-010)',
    text:
      'A segregação de funções do fechamento (FR-011/invariante P3, data-model.md — quem fecha ' +
      'precisa ser diferente de quem concluiu a ação corretiva que satisfaz FR-010) é aplicada ' +
      'pelo domínio.',
  },
  {
    label: 'Risk Analyst (raw risk:transition / risk:approve)',
    text:
      'Captura e avalia riscos dentro do seu escopo organizacional, e pode SOLICITAR uma ' +
      'transição de ciclo de vida sujeita a aprovação (permissão risk:transition). Exclui ' +
      'deliberadamente a permissão risk:approve.',
  },
  {
    label: 'Risk Approver (raw risk:create/edit/assess/treat/transition)',
    text:
      'Exclui deliberadamente as permissões de captura, edição, avaliação, tratamento e ' +
      'solicitação de transição de risco (risk:create/edit/assess/treat/transition).',
  },
];

/** The three detectors, as one predicate, so the guard and its
 * non-vacuity proof exercise exactly the same code. */
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

  return violations;
}

describe('Seeded role descriptions are product prose (F-32)', () => {
  it('seeds twelve system roles, each with a description — the guard has subjects', () => {
    expect(SYSTEM_ROLE_DEFINITIONS).toHaveLength(12);
    expect(SYSTEM_ROLE_DEFINITIONS.filter((role) => role.description.trim().length === 0)).toEqual(
      [],
    );
  });

  it.each(SYSTEM_ROLE_DEFINITIONS.map((role) => ({ name: role.name, role })))(
    '$name cites no specification artefact and no raw permission identifier',
    ({ role }) => {
      expect({ role: role.name, violations: findContentViolations(role.description) }).toEqual({
        role: role.name,
        violations: [],
      });
    },
  );

  it.each(SYSTEM_ROLE_DEFINITIONS.map((role) => ({ name: role.name, role })))(
    `$name fits the role card's two clamped lines (<= ${DESCRIPTION_MAX_LENGTH} characters)`,
    ({ role }) => {
      expect({ role: role.name, length: role.description.length }).toEqual({
        role: role.name,
        length: expect.any(Number) as number,
      });
      expect(role.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
    },
  );

  it('gives every role a description of its own — no two roles read alike', () => {
    // Segregation of duties is only legible if the two halves of each pair
    // say different things. A copy-paste that collapses Risk Analyst into
    // Risk Approver (or Control Owner into Control Approver) while trimming
    // for length would otherwise pass every check above.
    const descriptions = SYSTEM_ROLE_DEFINITIONS.map((role) => role.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it.each([
    { pair: 'Risk Analyst / Risk Approver', a: 'Risk Analyst', b: 'Risk Approver' },
    { pair: 'Control Owner / Control Approver', a: 'Control Owner', b: 'Control Approver' },
  ])('$pair — the description still distinguishes who executes from who decides', ({ a, b }) => {
    const executor = SYSTEM_ROLE_DEFINITIONS.find((role) => role.name === a);
    const decider = SYSTEM_ROLE_DEFINITIONS.find((role) => role.name === b);
    expect(executor, `${a} must be seeded`).toBeDefined();
    expect(decider, `${b} must be seeded`).toBeDefined();

    // The deciding half must name a decision in business language, and the
    // executing half must not read as if it also decided. This is the one
    // piece of meaning the length ceiling could plausibly squeeze out, so
    // it is asserted rather than trusted.
    expect(decider!.description).toMatch(/\b(decide|decisão|atesta)\b/i);
    expect(executor!.description).toMatch(/\b(não|nunca)\b/i);
  });
});

describe('The F-32 guard is not vacuously true', () => {
  it.each(HISTORICAL_VIOLATIONS)('rejects the pre-fix description of $label', ({ text }) => {
    expect(findContentViolations(text).length).toBeGreaterThan(0);
  });

  it('rejects every one of the seven descriptions F-32 measured, not merely some', () => {
    const undetected = HISTORICAL_VIOLATIONS.filter(
      ({ text }) => findContentViolations(text).length === 0,
    ).map(({ label }) => label);

    expect(undetected).toEqual([]);
  });

  it('rejects a description that is merely too long, with no forbidden token in it', () => {
    // The length rule is independently non-vacuous: a 599-character
    // Problem Manager description written entirely in clean product prose
    // still fails the card, and this proves the ceiling is what catches it.
    const longButClean = 'Opera o registro de problemas no seu escopo organizacional. '.repeat(10);

    expect(findContentViolations(longButClean)).toEqual([]);
    expect(longButClean.length).toBeGreaterThan(DESCRIPTION_MAX_LENGTH);
  });

  it('accepts ordinary pt-BR prose that uses a colon — the token detector is not trigger-happy', () => {
    // `IDENTIFIER_SHAPED_TOKEN` would be useless if it also matched every
    // enumeration these descriptions legitimately contain.
    const ordinary =
      'Acesso administrativo completo à plataforma: usuários, papéis, unidades organizacionais e ' +
      'configuração da metodologia.';

    expect(findContentViolations(ordinary)).toEqual([]);
  });
});
