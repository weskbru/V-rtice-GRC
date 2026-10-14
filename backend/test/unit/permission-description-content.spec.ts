import { describe, expect, it } from 'vitest';

import { getAllPermissionDefinitions } from '../../src/permission-catalogue';

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

const ALL_PERMISSION_IDENTIFIERS: readonly string[] = getAllPermissionDefinitions().map(
  (definition) => definition.identifier,
);

const IDENTIFIER_SHAPED_TOKEN = /\b[a-z][a-z-]*:[a-z][a-z-]*\b/;

const ENGLISH_TELLS: readonly RegExp[] = [
  /\bthe\b/i,
  /\bwithin\b/i,
  /\brecords?\b/i,
  /\borganizational scope\b/i,
  /\band\b/i,
  /\ba new\b/i,
  /\ban? [a-z]+ing\b/i,
];

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
