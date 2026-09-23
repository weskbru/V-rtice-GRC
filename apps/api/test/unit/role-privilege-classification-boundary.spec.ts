import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { toRoleResponse } from '../../src/core/authorization/presentation/dto/role-response.mapper';

const API_SRC = path.resolve(__dirname, '../../src');
const PRISMA_SCHEMA = path.resolve(__dirname, '../../prisma/schema.prisma');

const GOVERNANCE_IDENTIFIERS = ['role:administer', 'user:administer', 'org_unit:administer'];

const PERMISSION_REGISTRY = 'core/authorization/domain/permissions.ts';

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
    expect(offenders).toEqual([]);
  });

  it('lets exactly one file — the permission registry — name all three governance identifiers together', () => {
    const naming = SOURCES.filter((file) =>
      GOVERNANCE_IDENTIFIERS.every((identifier) => file.content.includes(identifier)),
    ).map((file) => file.relativePath);

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

    for (const forbidden of ['isPrivileged', 'is_privileged', 'privilege', 'level', 'tier']) {
      expect(roleModel ?? '').not.toContain(forbidden);
    }
    for (const field of ['id', 'name', 'description', 'isSystem', 'createdAt', 'updatedAt']) {
      expect(roleModel ?? '').toContain(field);
    }
  });
});
