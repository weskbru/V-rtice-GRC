export type EntityCodePrefix =
  'EVD' | 'ACT' | 'FND' | 'CTL' | 'FMK' | 'AUD' | 'AST' | 'PRC' | 'INC' | 'PRB' | 'IND' | 'RPT';

export const ENTITY_CODE_PREFIXES = {
  EVIDENCE: 'EVD',
  ACTION: 'ACT',
  FINDING: 'FND',
  CONTROL: 'CTL',
  FRAMEWORK: 'FMK',
  AUDIT_ENGAGEMENT: 'AUD',
  ASSET: 'AST',
  PROCESS: 'PRC',
  INCIDENT: 'INC',
  PROBLEM: 'PRB',
  INDICATOR: 'IND',
  REPORT: 'RPT',
} as const satisfies Record<string, EntityCodePrefix>;

const SEQUENCE_MIN_DIGITS = 4;

export const ENTITY_CODE_PATTERN =
  /^(EVD|ACT|FND|CTL|FMK|AUD|AST|PRC|INC|PRB|IND|RPT)-\d{4}-\d{4,}$/;

export function formatEntityCode(prefix: EntityCodePrefix, year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`formatEntityCode: year must be a 4-digit integer, got ${String(year)}.`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(
      `formatEntityCode: sequence must be a positive integer, got ${String(sequence)}.`,
    );
  }

  const paddedSequence = String(sequence).padStart(SEQUENCE_MIN_DIGITS, '0');
  return `${prefix}-${String(year)}-${paddedSequence}`;
}

export function isValidEntityCode(code: string): boolean {
  return ENTITY_CODE_PATTERN.test(code);
}
