export const RISK_CODE_PREFIX = 'RSK';

const SEQUENCE_MIN_DIGITS = 4;

export const RISK_CODE_PATTERN = /^RSK-\d{4}-\d{4,}$/;

export function formatRiskCode(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`formatRiskCode: year must be a 4-digit integer, got ${String(year)}.`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(
      `formatRiskCode: sequence must be a positive integer, got ${String(sequence)}.`,
    );
  }

  const paddedSequence = String(sequence).padStart(SEQUENCE_MIN_DIGITS, '0');
  return `${RISK_CODE_PREFIX}-${String(year)}-${paddedSequence}`;
}

export function isValidRiskCode(code: string): boolean {
  return RISK_CODE_PATTERN.test(code);
}
