import fs from 'node:fs';
import path from 'node:path';

import { EvidenceSubjectType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { EVIDENCE_SUBJECT_TYPE_VALUES } from '../../src/grc/evidence/presentation/dto/evidence-enum-values';

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
    expect(EVIDENCE_SUBJECT_TYPE_VALUES).toContain('CONTROL');
    expect(registeredSubjectTypeLiterals()).toContain('CONTROL');
  });
});
