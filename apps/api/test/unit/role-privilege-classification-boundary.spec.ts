/**
 * 2026-09-14 — ADR-021's first guard, built: the role privilege
 * classification does not exist on the server, and cannot be reached from
 * anything that decides access.
 *
 * ## Why a structural sweep, and why it is only HALF the guard
 *
 * `specs/015-roles-permissions-surface/STATE.md` §16.1 item 2 names the gap
 * exactly: the classification's inertness was "provada por ausência, não por
 * teste" — §12.1 measured it once with `grep` and wrote the result down. A
 * measurement taken by hand on one day is a fact about that day, not a
 * regression guard.
 *
 * The threat ADR-021 describes is concrete and short to write: a copy of the
 * predicate, or of its three-identifier criterion, consulted at a decision
 * point; or an `isPrivileged` field appearing in `RoleResponse` or on the
 * `Role` table. All four shapes are TEXTUAL, so a text sweep catches them —
 * and, unlike a behavioural assertion, it catches them at the moment they
 * are INTRODUCED, before anyone has wired them to anything.
 *
 * What a text sweep cannot do is prove that the classification, if it did
 * exist, would change nothing. That is the other half, and it is a separate,
 * behavioural file: `test/integration/role-privilege-classification-inert.spec.ts`
 * proves that a maximally "privileged" role and a plain one produce the SAME
 * authorization decision for the same permission. Neither half subsumes the
 * other: the structural one would miss a paraphrase that never names an
 * identifier, and the behavioural one would miss a classification that
 * exists and happens to agree today. Together they answer the question that
 * matters — does the test fail if someone wires the classification to
 * authorization? — from both ends.
 *
 * The idiom is this repository's own:
 * `test/unit/asset-process-table-access-boundary.spec.ts` (no file outside
 * two modules touches two tables) and
 * `test/unit/audit-engagement-permission-namespace.spec.ts` (a namespace
 * collision impossible in test, not in review).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { toRoleResponse } from '../../src/core/authorization/presentation/dto/role-response.mapper';

const API_SRC = path.resolve(__dirname, '../../src');
const PRISMA_SCHEMA = path.resolve(__dirname, '../../prisma/schema.prisma');

/**
 * The three identifiers ADR-021 derives the classification from. They are
 * the server's own, and the server is free to NAME them — `@RequirePermission`
 * has to. What the server must not do is treat their DISJUNCTION as a fact,
 * which is what a file naming all three at once would be doing.
 */
const GOVERNANCE_IDENTIFIERS = ['role:administer', 'user:administer', 'org_unit:administer'];

/**
 * The single file allowed to name all three: the permission registry that
 * DEFINES them. Naming them there is the definition itself, not a derived
 * classification — every other file gets them one at a time, from a
 * `@RequirePermission` decorator.
 */
const PERMISSION_REGISTRY = 'core/authorization/domain/permissions.ts';

/**
 * Every spelling of the classification that has appeared in this project's
 * own writing about it (ADR-021, `role-privilege.ts`, `spec.md` FR-035 to
 * FR-037) plus the shapes ADR-021 predicts a violation would take.
 */
const FORBIDDEN_TOKENS = [
  'isPrivilegedRole',
  'PRIVILEGED_PERMISSION_IDENTIFIERS',
  'isPrivileged',
  'is_privileged',
  'privilegedRole',
  'privileged_role',
];

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

function readTypeScriptSources(directory: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...readTypeScriptSources(absolute));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    files.push({
      relativePath: path.relative(API_SRC, absolute).split(path.sep).join('/'),
      content: readFileSync(absolute, 'utf8'),
    });
  }
  return files;
}

const SOURCES = readTypeScriptSources(API_SRC);

describe('ADR-021 — the role privilege classification is absent from the server', () => {
  it('sweeps a non-empty set of API sources (sanity check on the sweep itself)', () => {
    // A sweep that read nothing would pass every assertion below vacuously.
    expect(SOURCES.length).toBeGreaterThan(300);
    expect(SOURCES.map((file) => file.relativePath)).toContain(PERMISSION_REGISTRY);
    expect(SOURCES.map((file) => file.relativePath)).toContain(
      'core/authorization/presentation/permission.guard.ts',
    );
  });

  it('names the classification nowhere in apps/api/src, under any of its spellings', () => {
    const offenders: string[] = [];
    for (const file of SOURCES) {
      for (const token of FORBIDDEN_TOKENS) {
        if (file.content.includes(token)) {
          offenders.push(`${file.relativePath} contains "${token}"`);
        }
      }
    }
    // Named, not counted: a failure says which file and which spelling.
    expect(offenders).toEqual([]);
  });

  it('lets exactly one file — the permission registry — name all three governance identifiers together', () => {
    const naming = SOURCES.filter((file) =>
      GOVERNANCE_IDENTIFIERS.every((identifier) => file.content.includes(identifier)),
    ).map((file) => file.relativePath);

    /*
     * A second file here IS the violation ADR-021 describes: a
     * reimplementation of the criterion. `PermissionGuard` growing a
     * "holds any of these three -> allow" branch, a
     * `privileged-permissions.ts` constant imported by a guard, or a
     * segregation-of-duties check keyed on governance permissions all
     * produce exactly this failure, by name.
     *
     * Files that name ONE or TWO of them are normal and expected —
     * `admin-users.controller.ts` gates by `user:administer` and
     * `role:administer` side by side, and that is authorization reading the
     * permission it needs, not a classification.
     */
    expect(naming).toEqual([PERMISSION_REGISTRY]);
  });

  it('keeps RoleResponse at the six fields the contract declares — no privilege field reaches a client', () => {
    const response = toRoleResponse({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      name: 'Fixture',
      description: 'Fixture role.',
      isSystem: false,
      permissions: [
        {
          id: 'ffffffff-ffff-4fff-8fff-fffffffffffe',
          identifier: 'role:administer',
          resource: 'role',
          action: 'ADMINISTER',
          description: 'Administer roles.',
        },
      ],
      assignedUserCount: 0,
    });

    expect(Object.keys(response).sort()).toEqual([
      'assignedUserCount',
      'description',
      'id',
      'isSystem',
      'name',
      'permissions',
    ]);
  });

  it('keeps the Role table free of any privilege column', () => {
    const schema = readFileSync(PRISMA_SCHEMA, 'utf8');
    const roleModel = /\nmodel Role \{([\s\S]*?)\n\}/.exec(schema)?.[1];
    expect(roleModel).toBeDefined();

    // The six fields ADR-021 records, and nothing that classifies.
    for (const forbidden of ['isPrivileged', 'is_privileged', 'privilege', 'level', 'tier']) {
      expect(roleModel ?? '').not.toContain(forbidden);
    }
    for (const field of ['id', 'name', 'description', 'isSystem', 'createdAt', 'updatedAt']) {
      expect(roleModel ?? '').toContain(field);
    }
  });
});
