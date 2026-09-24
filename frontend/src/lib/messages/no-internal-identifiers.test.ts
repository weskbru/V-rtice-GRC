import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MESSAGES_DIR = path.resolve(__dirname);

const INTERNAL_IDENTIFIER = /\b(?:FR|SC|ADR|FMK|D|T)-?\d{2,}\b|\bUS\d\b/;

const STRING_VALUE_LINE = /^\s*(?:[A-Za-z_$][\w$]*|'[^']*'|"[^"]*")\s*:\s*'(.*)'[,;]?\s*$/;

const TEMPLATE_VALUE_LINE = /^\s*(?:return\s+)?`([^`]*)`[,;]?\s*$/;

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

function catalogueFiles(): string[] {
  return readdirSync(MESSAGES_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => path.join(MESSAGES_DIR, name));
}

function offencesIn(file: string): Offence[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const offences: Offence[] = [];
  let insideBlockComment = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (insideBlockComment) {
      if (trimmed.includes('*/')) insideBlockComment = false;
      return;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) insideBlockComment = true;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    const match = STRING_VALUE_LINE.exec(line) ?? TEMPLATE_VALUE_LINE.exec(line);
    if (!match) return;

    const value = match[1] ?? '';
    if (INTERNAL_IDENTIFIER.test(value)) {
      offences.push({
        file: path.basename(file),
        line: index + 1,
        text: value.slice(0, 90),
      });
    }
  });

  return offences;
}

describe('user-facing message catalogues carry no internal identifiers', () => {
  const files = catalogueFiles();

  it('scans every catalogue in lib/messages — the sweep is not vacuous', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it('no rendered string contains a requirement, decision, story or task identifier', () => {
    const offences = files.flatMap(offencesIn);

    expect(offences.map((offence) => `${offence.file}:${offence.line} — ${offence.text}`)).toEqual(
      [],
    );
  });

  it('recognises the strings that were actually rendered, and leaves documentation alone', () => {
    expect(INTERNAL_IDENTIFIER.test('Situação inativa — sem novos vínculos (FR-012)')).toBe(true);
    expect(
      INTERNAL_IDENTIFIER.test('Controles associados que influenciam o risco residual (FR-078).'),
    ).toBe(true);
    expect(INTERNAL_IDENTIFIER.test('Situação inativa — não aceitam novos vínculos')).toBe(false);

    expect(STRING_VALUE_LINE.test(' * **Desativação nunca é exclusão (FR-012).**')).toBe(false);
  });
});
