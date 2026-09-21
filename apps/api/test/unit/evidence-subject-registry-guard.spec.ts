/**
 * Guard: every `EvidenceSubjectType` the schema declares must be both
 * ACCEPTED at the HTTP edge and RESOLVABLE in the domain.
 *
 * ## The defect this exists because of
 *
 * Phase 2 (Controls) added `CONTROL` to the Prisma `EvidenceSubjectType`
 * enum, registered its accessor
 * (`modules/controls/application/collaboration/control-evidence-subject-accessor.ts`),
 * and covered it with an integration test that passed. Meanwhile every
 * evidence request naming a control was rejected with a `400`, because the
 * two DTOs at the edge each carried their own hand-typed copy of the four
 * values the enum had when they were written.
 *
 * So FR-026 ("evidence may substantiate a control") was declared in the
 * spec, wired in the domain, proven by a test one layer below the edge —
 * and dead in the product. Nothing in the suite could see it, because every
 * layer was individually correct and only the JOIN between two of them was
 * wrong. It was found by opening the running application.
 *
 * The edge list is now derived from the enum
 * (`grc/evidence/presentation/dto/evidence-enum-values.ts`), which closes
 * one direction. This file closes the other: a value can no longer reach
 * the enum without an accessor behind it. `ActionOriginType` has had exactly
 * this guard since the assurance phase — `EvidenceSubjectType` did not, and
 * that asymmetry is precisely why Action caught its own version of this
 * mistake and Evidence did not.
 *
 * Static text scan over `apps/api/src`, mirroring
 * `action-model-convergence-guard.spec.ts`: registering an accessor for real
 * needs a NestJS context, but proving the registration was at least written
 * does not.
 */
import fs from 'node:fs';
import path from 'node:path';

import { EvidenceSubjectType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { EVIDENCE_SUBJECT_TYPE_VALUES } from '../../src/grc/evidence/presentation/dto/evidence-enum-values';

/**
 * Strips block and line comments before scanning.
 *
 * Without this the scan counts prose: `control-relationship.module.ts`'s own
 * header helpfully documents `registerEvidenceSubjectResolver('CONTROL', ...)`,
 * and that sentence read as a second registration — the guard reported a
 * duplicate that did not exist, on its very first run. A guard whose failure
 * message is wrong is worse than no guard, because the next person spends
 * their time disproving it.
 *
 * Deliberately crude (it does not understand strings containing `//`), which
 * is fine here: the only thing being counted is a call pattern that never
 * appears inside a string literal.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Every subject-type literal named as the first argument of a
 * `registerEvidenceSubjectResolver(...)` call anywhere in `apps/api/src`. */
function registeredSubjectTypeLiterals(): readonly string[] {
  const srcDir = path.resolve(__dirname, '../../src');
  const pattern = /registerEvidenceSubjectResolver\(\s*['"]([A-Z_]+)['"]/g;
  const found: string[] = [];

  for (const file of listSourceFiles(srcDir)) {
    for (const match of stripComments(fs.readFileSync(file, 'utf8')).matchAll(pattern)) {
      const literal = match[1];
      if (literal) found.push(literal);
    }
  }
  return found;
}

describe('EvidenceSubjectType edge/domain registry guard', () => {
  const schemaValues = Object.values(EvidenceSubjectType);

  it('the HTTP edge accepts exactly the values the schema declares', () => {
    // Not "at least" — exactly. A value accepted at the edge with no schema
    // member behind it would be a 500 waiting to happen, and a schema member
    // missing from the edge is the defect this file is named after.
    expect([...EVIDENCE_SUBJECT_TYPE_VALUES].sort()).toEqual([...schemaValues].sort());
  });

  it('every schema value has exactly one registered accessor', () => {
    const registered = registeredSubjectTypeLiterals();

    for (const subjectType of schemaValues) {
      const count = registered.filter((literal) => literal === subjectType).length;
      expect(
        count,
        `EvidenceSubjectType "${subjectType}" has ${count} registration call sites, expected exactly 1`,
      ).toBe(1);
    }
  });

  it('CONTROL specifically is accepted and registered — the case that shipped broken', () => {
    // Named explicitly rather than left to the loops above. The two
    // assertions before this one would keep passing if `CONTROL` were
    // removed from the schema entirely; this one would not, and "we quietly
    // dropped the capability" is a failure mode worth its own line.
    expect(EVIDENCE_SUBJECT_TYPE_VALUES).toContain('CONTROL');
    expect(registeredSubjectTypeLiterals()).toContain('CONTROL');
  });
});
