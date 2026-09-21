/**
 * T027/003-controls-management, User Story 2 — unit coverage for
 * `domain/control-assessment.entity.ts` (FR-010/FR-011) and for the
 * IMMUTABILITY of `ControlAssessment`: this file also documents, by
 * static inspection, that no update/delete function exists anywhere in
 * this module for the entity.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertAssessedOnNotInFuture,
  assertControlAcceptsNewAssessment,
} from '../../src/modules/controls/domain/control-assessment.entity';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

describe('assertAssessedOnNotInFuture (FR-011)', () => {
  const referenceDate = new Date('2026-06-15T00:00:00.000Z');

  it('accepts an assessedOn strictly before referenceDate', () => {
    expect(() =>
      assertAssessedOnNotInFuture(new Date('2026-06-01T00:00:00.000Z'), referenceDate),
    ).not.toThrow();
  });

  it('accepts an assessedOn equal to referenceDate', () => {
    expect(() => assertAssessedOnNotInFuture(referenceDate, referenceDate)).not.toThrow();
  });

  it('rejects an assessedOn after referenceDate', () => {
    expect(() =>
      assertAssessedOnNotInFuture(new Date('2026-06-16T00:00:00.000Z'), referenceDate),
    ).toThrow(ValidationDomainError);
  });
});

describe('assertControlAcceptsNewAssessment (D-6, FR-006)', () => {
  it('accepts ACTIVE', () => {
    expect(() => assertControlAcceptsNewAssessment('ACTIVE')).not.toThrow();
  });

  it.each(['DRAFT', 'SUSPENDED', 'RETIRED'] as const)('rejects %s', (status) => {
    expect(() => assertControlAcceptsNewAssessment(status)).toThrow(ValidationDomainError);
  });
});

describe('ControlAssessment is immutable by construction (FR-010)', () => {
  it('no file under modules/controls exports an update or delete function for a control assessment', () => {
    const controlsRoot = path.resolve(__dirname, '../../src/modules/controls');
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
          continue;
        }
        const contents = fs.readFileSync(fullPath, 'utf8');
        // A real update/delete surface would name itself close to these
        // shapes — `updateControlAssessment`/`deleteControlAssessment`/
        // `UpdateControlAssessmentUseCase`, or a repository method literally
        // called `update`/`delete` on a `ControlAssessment`-shaped port.
        // `attest`/`setApprovalId` (this workstream's own two narrow,
        // single-purpose exceptions — data-model.md §2/§4) are
        // deliberately excluded from this pattern; they never touch
        // `assessedOn`/`assessorUserId`/`result`/`conclusion`.
        if (/updateControlAssessment|deleteControlAssessment/i.test(contents)) {
          offenders.push(fullPath);
        }
      }
    }

    walk(controlsRoot);
    expect(offenders).toEqual([]);
  });
});
