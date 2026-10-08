import fs from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

const ALLOWED_ACTION_SHAPED_MODELS: readonly string[] = ['Action'];

const ACTION_SIGNATURE_FIELDS: readonly string[] = [
  'title',
  'responsibleUserId',
  'dueOn',
  'status',
  'completedAt',
];

function actionShapedModelNames(): readonly string[] {
  return Prisma.dmmf.datamodel.models
    .filter((model) =>
      ACTION_SIGNATURE_FIELDS.every((field) => model.fields.some((f) => f.name === field)),
    )
    .map((model) => model.name);
}

function enumValues(enumName: string): readonly string[] {
  const found = Prisma.dmmf.datamodel.enums.find((candidate) => candidate.name === enumName);
  if (!found) {
    throw new Error(`Enum "${enumName}" was not found in the generated Prisma client's DMMF.`);
  }
  return found.values.map((value) => value.name);
}

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

function registeredActionOriginTypeLiterals(): readonly string[] {
  const srcDir = path.resolve(__dirname, '../../src');
  const pattern = /registerActionOriginResolver\(\s*['"]([A-Z_]+)['"]/g;
  const found: string[] = [];

  for (const file of listSourceFiles(srcDir)) {
    const contents = stripComments(fs.readFileSync(file, 'utf8'));
    for (const match of contents.matchAll(pattern)) {
      const literal = match[1];
      if (literal) {
        found.push(literal);
      }
    }
  }
  return found;
}

describe('Action / RiskTreatmentAction convergence guard (Fix 9)', () => {
  it('no Prisma model outside the explicit allowlist carries the full Action signature', () => {
    const found = actionShapedModelNames();
    expect(new Set(found)).toEqual(new Set(ALLOWED_ACTION_SHAPED_MODELS));
  });

  it('the allowlist itself still matches reality — both named models genuinely carry every signature field', () => {
    for (const modelName of ALLOWED_ACTION_SHAPED_MODELS) {
      const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === modelName);
      expect(model, `Model "${modelName}" was not found in the DMMF`).toBeDefined();
      for (const field of ACTION_SIGNATURE_FIELDS) {
        expect(
          model?.fields.some((f) => f.name === field),
          `Model "${modelName}" no longer has a "${field}" field`,
        ).toBe(true);
      }
    }
  });

  it('ActionOriginType members correspond 1:1 with a registerActionOriginResolver call site, each exactly once', () => {
    const originTypeValues = enumValues('ActionOriginType');
    const registeredLiterals = registeredActionOriginTypeLiterals();

    for (const originType of originTypeValues) {
      const count = registeredLiterals.filter((literal) => literal === originType).length;
      expect(
        count,
        `ActionOriginType "${originType}" has ${count} registration call sites, expected exactly 1`,
      ).toBe(1);
    }

    for (const literal of registeredLiterals) {
      expect(
        originTypeValues,
        `Registered literal "${literal}" is not a member of ActionOriginType`,
      ).toContain(literal);
    }
  });
});
