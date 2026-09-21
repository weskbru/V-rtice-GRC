import { cn } from '../lib/utils';

export interface EmptyValueProps {
  /** The localized placeholder text itself (e.g. "Nunca acessou", "Nenhum papel", "—") — supplied by the caller, never invented here (D-10). */
  children: React.ReactNode;
  className?: string;
}

/**
 * Platform-wide, deliberately quiet rendering for "this field has no value
 * yet" — smaller and lighter than a populated cell's own text, so a column
 * full of real values never competes for attention with the placeholder for
 * the handful of rows that don't have one (CLAUDE.md §18.11: "a informação
 * importante domina os metadados secundários"). The word itself is always
 * kept in the DOM (never collapsed to a bare, ambiguous dash) — only its
 * visual weight recedes.
 *
 * Promoted from a pattern the risk register established locally
 * (`risk-register-columns.tsx`'s own `NotSetValue`) so every module's list —
 * Administration included (wave 4) — renders "no value yet" identically
 * instead of a screen inventing its own dash/placeholder convention
 * (CLAUDE.md §18.3, §18.12).
 *
 * Renders at full `text-muted-foreground` opacity, not diluted further: the
 * token itself already clears WCAG AA (5.31:1 on background, 5.7:1 on card —
 * see `globals.css`), but a `/80` alpha modifier on top of it dropped that to
 * 3.70:1 on card (a real axe `color-contrast` finding). The smaller size and
 * `italic` styling already carry the "de-emphasised / no value" signal, so
 * opacity was adding contrast risk without adding meaning.
 */
export function EmptyValue({ children, className }: EmptyValueProps): React.JSX.Element {
  return <span className={cn('text-xs text-muted-foreground italic', className)}>{children}</span>;
}
