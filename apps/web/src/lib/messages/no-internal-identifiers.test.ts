import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 006-assets-processes — no user-facing string may contain an internal
 * requirement, decision or story identifier.
 *
 * ## The defect
 *
 * The Assets catalogue rendered, on screen, to a real user:
 *
 *     Ativos desativados · 0 · Situação inativa — sem novos vínculos (FR-012)
 *
 * `FR-012` is a functional-requirement number from
 * `specs/006-assets-processes/spec.md`. It means nothing to the person
 * looking at an asset inventory, and it makes the product look like its own
 * internal tracker leaked into the UI.
 *
 * Found by looking at the rendered page (CLAUDE.md §18.1), not by any gate:
 * every string was correctly in a centralized pt-BR catalogue (§11.1), so
 * the language rule was satisfied; nothing checked what was IN the string.
 *
 * ## Why this scans every catalogue, not the two that introduced it
 *
 * The sweep found **five** occurrences: four in the two new catalogues and
 * one already shipped in `risks.ts`
 * ("Controles associados que influenciam o risco residual (FR-078)"),
 * live on the risk detail screen. A guard written only for the new module
 * would have left the shipped one in place — and AGENTS.md requires a fix
 * to generalize to every call site sharing the pattern.
 *
 * ## Scope of the rule
 *
 * Only string LITERALS are checked, never comments. Citing a requirement in
 * a JSDoc block above a message is good practice and stays — it is how a
 * reader learns why the wording is what it is. The rule is exclusively
 * about what reaches the screen.
 */

const MESSAGES_DIR = path.resolve(__dirname);

/**
 * `FR-012`, `SC-003`, `ADR-020`, `US1`, `T042` — the identifier vocabularies
 * this repository's specs, decisions and task lists actually use.
 */
const INTERNAL_IDENTIFIER = /\b(?:FR|SC|ADR|FMK|D|T)-?\d{2,}\b|\bUS\d\b/;

/**
 * A property assignment whose value is a single-quoted string literal, e.g.
 * `  hint: 'Situação inativa — ...',`. Deliberately narrow: it must not
 * match a line inside a block comment, which is where citing a requirement
 * is not only allowed but wanted.
 */
const STRING_VALUE_LINE = /^\s*(?:[A-Za-z_$][\w$]*|'[^']*'|"[^"]*")\s*:\s*'(.*)'[,;]?\s*$/;

/** A `return \`...\`` or `: \`...\`` inside a message-building function. */
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

    // Track block comments so a `* ... (FR-012) ...` documentation line is
    // never mistaken for a rendered string.
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

  // The detector must recognise the exact strings that were on screen, or
  // the assertion above would be green against the very defect it exists
  // to reject.
  it('recognises the strings that were actually rendered, and leaves documentation alone', () => {
    expect(INTERNAL_IDENTIFIER.test('Situação inativa — sem novos vínculos (FR-012)')).toBe(true);
    expect(
      INTERNAL_IDENTIFIER.test('Controles associados que influenciam o risco residual (FR-078).'),
    ).toBe(true);
    expect(INTERNAL_IDENTIFIER.test('Situação inativa — não aceitam novos vínculos')).toBe(false);

    // A requirement cited in a comment is documentation, not UI: the line
    // scanner must not even reach it.
    expect(STRING_VALUE_LINE.test(' * **Desativação nunca é exclusão (FR-012).**')).toBe(false);
  });
});
