import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONTROL_LIFECYCLE_TRANSITIONS,
  evaluateControlPreconditions,
  findControlLifecycleTransition,
  listControlLifecycleTransitionsFrom,
} from '../../src/modules/controls/domain/control-lifecycle';
import { isActiveForControlStatus } from '../../src/modules/controls/domain/control.entity';

import type { ControlStatus } from '@prisma/client';

const ALL_STATUSES: readonly ControlStatus[] = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'];

describe('CONTROL_LIFECYCLE_TRANSITIONS (D-6)', () => {
  it('declares exactly the six legal transitions the spec names, no more and no fewer', () => {
    const pairs = CONTROL_LIFECYCLE_TRANSITIONS.map((rule) => `${rule.from}->${rule.to}`);
    expect(new Set(pairs)).toEqual(
      new Set([
        'DRAFT->ACTIVE',
        'ACTIVE->SUSPENDED',
        'SUSPENDED->ACTIVE',
        'DRAFT->RETIRED',
        'ACTIVE->RETIRED',
        'SUSPENDED->RETIRED',
      ]),
    );
    expect(pairs).toHaveLength(6);
  });

  it('RETIRED is terminal — no row has it as `from`', () => {
    expect(listControlLifecycleTransitionsFrom('RETIRED')).toEqual([]);
  });

  it('every non-RETIRED status has at least one legal outgoing transition — no state is a dead end', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'RETIRED') continue;
      expect(
        listControlLifecycleTransitionsFrom(status).length,
        `status "${status}" has no outgoing transition`,
      ).toBeGreaterThan(0);
    }
  });

  it('an undeclared pair is refused (undefined), never silently permitted', () => {
    expect(findControlLifecycleTransition('RETIRED', 'ACTIVE')).toBeUndefined();
    expect(findControlLifecycleTransition('SUSPENDED', 'DRAFT')).toBeUndefined();
  });

  it('DRAFT -> ACTIVE requires control:edit and the HAS_OWNER precondition (FR-005)', () => {
    const rule = findControlLifecycleTransition('DRAFT', 'ACTIVE');
    expect(rule?.requiredPermission).toBe('control:edit');
    expect(rule?.preconditions).toEqual(['HAS_OWNER']);
  });

  it('every ->RETIRED transition requires control:administer and HAS_JUSTIFICATION (US1 AS3)', () => {
    for (const from of ['DRAFT', 'ACTIVE', 'SUSPENDED'] as const) {
      const rule = findControlLifecycleTransition(from, 'RETIRED');
      expect(rule?.requiredPermission, `${from}->RETIRED`).toBe('control:administer');
      expect(rule?.preconditions, `${from}->RETIRED`).toEqual(['HAS_JUSTIFICATION']);
    }
  });

  it('ACTIVE<->SUSPENDED requires control:edit and no precondition', () => {
    const toSuspended = findControlLifecycleTransition('ACTIVE', 'SUSPENDED');
    const toActive = findControlLifecycleTransition('SUSPENDED', 'ACTIVE');
    expect(toSuspended?.requiredPermission).toBe('control:edit');
    expect(toSuspended?.preconditions).toEqual([]);
    expect(toActive?.requiredPermission).toBe('control:edit');
    expect(toActive?.preconditions).toEqual([]);
  });
});

describe('T018a — a DRAFT control with no owner is not trapped: DRAFT -> RETIRED stays reachable', () => {
  it('DRAFT -> ACTIVE is refused (unmet HAS_OWNER) for an owner-less draft', () => {
    const rule = findControlLifecycleTransition('DRAFT', 'ACTIVE');
    expect(rule).toBeDefined();
    const results = evaluateControlPreconditions(rule!.preconditions, {
      ownerUserId: null,
      justification: null,
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('HAS_OWNER');
    expect(results[0]!.met).toBe(false);
  });

  it('DRAFT -> RETIRED exists in the table at all (the escape hatch itself)', () => {
    expect(findControlLifecycleTransition('DRAFT', 'RETIRED')).toBeDefined();
  });

  it('DRAFT -> RETIRED does NOT require HAS_OWNER — an owner-less draft can still be retired', () => {
    const rule = findControlLifecycleTransition('DRAFT', 'RETIRED')!;
    expect(rule.preconditions).not.toContain('HAS_OWNER');
  });

  it('DRAFT -> RETIRED with a justification is fully satisfiable for an owner-less draft', () => {
    const rule = findControlLifecycleTransition('DRAFT', 'RETIRED')!;
    const results = evaluateControlPreconditions(rule.preconditions, {
      ownerUserId: null,
      justification: 'Cadastrado por engano.',
    });
    expect(results.every((result) => result.met)).toBe(true);
  });

  it('DRAFT -> RETIRED without a justification is refused — the precondition is checked independently of ownership', () => {
    const rule = findControlLifecycleTransition('DRAFT', 'RETIRED')!;
    const results = evaluateControlPreconditions(rule.preconditions, {
      ownerUserId: null,
      justification: '   ',
    });
    expect(results.some((result) => !result.met)).toBe(true);
  });
});

describe('isActiveForControlStatus (T019 — the single is_active/status sync point)', () => {
  it('is false only for RETIRED', () => {
    expect(isActiveForControlStatus('RETIRED')).toBe(false);
  });

  it('is true for every other status', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'RETIRED') continue;
      expect(isActiveForControlStatus(status), status).toBe(true);
    }
  });

  it('is exhaustive over every ControlStatus member — a future enum addition fails this test, not silently falls through', () => {
    for (const status of ALL_STATUSES) {
      expect(() => isActiveForControlStatus(status)).not.toThrow();
    }
    expect(ALL_STATUSES).toHaveLength(4);
  });
});

describe('T019 — isActiveForControlStatus is the single write point, provably', () => {
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

  it('no source file other than control.entity.ts defines the RETIRED<->isActive mapping', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const pattern = /(?:!==|===)\s*'RETIRED'/g;
    const offendingFiles: string[] = [];

    for (const file of listSourceFiles(srcDir)) {
      if (path.basename(file) === 'control.entity.ts') continue;
      const contents = fs.readFileSync(file, 'utf8');
      if (pattern.test(contents)) {
        offendingFiles.push(path.relative(srcDir, file));
      }
    }

    expect(offendingFiles).toEqual([]);
  });

  it('control.entity.ts itself genuinely contains the mapping — guards the guard against a silently-passing, empty scan', () => {
    const entityFile = path.resolve(
      __dirname,
      '../../src/modules/controls/domain/control.entity.ts',
    );
    const contents = fs.readFileSync(entityFile, 'utf8');
    expect(/(?:!==|===)\s*'RETIRED'/.test(contents)).toBe(true);
  });
});
