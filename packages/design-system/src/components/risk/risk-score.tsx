import { MinusCircle } from 'lucide-react';

import { cn } from '../../lib/utils';

import { RiskLevelBadge } from './risk-level-badge';

import type { RiskLevelBadgeLabels } from './risk-level-badge';
import type { RiskLevel } from './risk-level-visuals';

/**
 * `RiskScore`'s own chrome text. Required, never defaulted inside the
 * component, following the same rationale as `DataTableLabels` —
 * `packages/design-system` must not depend on `apps/web`'s pt-BR message
 * catalog.
 */
export interface RiskScoreLabels {
  /** Full basis name, e.g. `inherent` -> "Inerente". Shared vocabulary with `RiskLevelBadge`'s own `basis` prefix. */
  basisName: (basis: 'inherent' | 'residual') => string;
  /** Full level name, e.g. `LOW` -> "Baixo" — used only in the screen-reader caption; the visible level name itself comes from `RiskLevelBadge`. */
  levelName: (level: RiskLevel) => string;
  /** Screen-reader caption tying score, basis and level together in one sentence, e.g. "Pontuação residual: 12 (Alto)". */
  scoreCaption: (params: { basisLabel: string; score: number; levelLabel: string }) => string;
  /** Rendered instead of a score when the risk has no assessment yet on this basis, e.g. "Risco inerente ainda não avaliado". Takes the resolved basis name so the caller can inflect it correctly. */
  notAssessedCaption: (basisLabel: string) => string;
  /** Forwarded straight through to the composed `RiskLevelBadge` (D-10 — one labels-prop convention, not a second copy of the same strings). */
  riskLevelBadge: RiskLevelBadgeLabels;
}

export interface RiskScoreProps {
  /**
   * The already-derived score for this basis, or `null` when the risk has
   * no assessment yet — rendered as an explicit "not yet assessed" message,
   * never as `0` or an empty box (per the task's not-yet-assessed
   * requirement). `RiskScore` never computes this value itself (ADR-006):
   * it is always `Risk.inherentScore`/`residualScore` or an assessment's
   * own score, passed straight through.
   */
  score: number | null;
  /** The level paired with `score` (data-model.md `RiskLevel`). Must be `null` exactly when `score` is `null`, and non-null otherwise. */
  level: RiskLevel | null;
  /**
   * Which of the two values this is. Always rendered, never omitted —
   * ADR-006: a level or score shown without naming its basis lets two
   * readers of the same figure disagree about what it means. Forwarded to
   * `RiskLevelBadge` so its own basis prefix stays visible, and included in
   * the screen-reader caption as well.
   */
  basis: 'inherent' | 'residual';
  labels: RiskScoreLabels;
  /** Forwarded to `RiskLevelBadge`. 'subtle' (default) or 'solid'. */
  emphasis?: 'subtle' | 'solid';
  className?: string;
}

/**
 * Displays a risk's derived score next to its level, composed from the
 * existing `RiskLevelBadge` rather than reimplementing the level→color
 * vocabulary (icon, border weight, text label). Per ADR-006, `RiskScore`
 * never computes a score or a level itself — both arrive as props, already
 * derived by `RiskScoringService` on the backend.
 */
export function RiskScore({
  score,
  level,
  basis,
  labels,
  emphasis = 'subtle',
  className,
}: RiskScoreProps): React.JSX.Element {
  const basisLabel = labels.basisName(basis);

  if (score === null || level === null) {
    // No `role="status"` — see `StatusBadge`'s doc comment (T203, F-2). This
    // message is present at first render on every never-assessed risk; a
    // live-region role over content that is not going to change while
    // mounted promises an announcement it cannot deliver. The message is
    // still fully reachable in normal reading order.
    return (
      <div
        className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}
      >
        <MinusCircle aria-hidden="true" className="size-4 shrink-0" />
        <span>{labels.notAssessedCaption(basisLabel)}</span>
      </div>
    );
  }

  const levelLabel = labels.levelName(level);

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <div className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="text-lg leading-none font-bold tabular-nums text-foreground"
        >
          {score}
        </span>
        <RiskLevelBadge
          level={level}
          basis={basis}
          labels={labels.riskLevelBadge}
          emphasis={emphasis}
        />
      </div>
      <span className="sr-only">{labels.scoreCaption({ basisLabel, score, levelLabel })}</span>
    </div>
  );
}
