/**
 * PharosGRC — small, cross-feature formatting helpers with no feature-specific
 * knowledge (contrast `features/risks/date.ts`, which is deliberately
 * feature-scoped because it also documents a risk-field-specific parsing
 * hazard).
 *
 * `formatBytes` started as a private helper inside
 * `features/risks/components/risk-attachments-section.tsx`, with a comment
 * explaining it was NOT extracted because the risk feature was its only
 * caller (CLAUDE.md §2 — no premature abstraction). `features/evidence`
 * gained a second, genuinely identical need for it (assurance-audit Fix 1);
 * with a real second caller, extracting here is no longer premature.
 */

/** Formats a byte count as a pt-BR-localized, human-scaled size (e.g. "1,2 MB"). */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${units[unitIndex]}`;
}
