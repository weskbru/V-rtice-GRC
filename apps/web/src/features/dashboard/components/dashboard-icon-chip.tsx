/**
 * PharosGRC — the small tinted square that carries a dashboard card's icon.
 *
 * This component paints whichever `DashboardTone` its caller passes — it
 * has no opinion of its own about what a tone MEANS. Every caller on this
 * screen now gives it the SAME meaning, IDENTITY, never severity — each
 * still named separately below because each answers "identity of what":
 *
 * ## "Visão dos módulos" (`DashboardModuleCard`) — tint is AREA IDENTITY
 *
 * The landing screen shows up to eight module cards from eight different
 * GRC areas. Rendered all in the same neutral ink, they read as one
 * undifferentiated grid and the eye has nothing to anchor on. A soft tint
 * per area gives each card an identity the reader can find again — "the
 * red one is Incidentes" — without turning the screen into a colour chart.
 * Not status: the tints (`--tint-*` in the design system) are identity
 * hues here, deliberately separate from the reserved `--status-*` tokens.
 * A red chip in THIS section means "Incidentes", never "bad" — severity
 * inside a module card is carried by its own `DashboardModuleMetric.tone`
 * (`danger`/`warning`/`success`, the reserved status tokens), not by this
 * chip.
 *
 * ## "O que requer atenção agora" (`DashboardStatCard`) — tint is IDENTITY too
 *
 * `contextTone` is the tile's own subject family (amber approvals, red
 * overdue items and incidents, blue upcoming deadlines, teal risk review,
 * violet problems) — not urgency. Dashboard V2 Fase B had briefly made
 * this edge mean SEVERITY instead, with a `severityTone()` helper in
 * `page.tsx` computing red/amber from a by-severity breakdown for the two
 * tiles that sum across an entire range ("Incidentes abertos", "Problemas
 * pendentes"), added when a rendered check caught "Incidentes abertos"
 * fixed red while its own context line read "0 críticos". A later round
 * decided identity reads better here too, exactly like the module cards
 * beside it, and removed `severityTone()` along with the `tone` prop that
 * carried its result. Nothing the user could tell from this screen was
 * lost: colour was never the ONLY thing saying how urgent a tile is —
 * every chip still sits beside its own card's visible title and a context
 * line naming the condition in words ("fora do prazo", "fora do limiar");
 * the icon itself is decorative (`aria-hidden`).
 *
 * ## `idle`
 *
 * An attention card whose figure is zero has nothing to act on. Its chip
 * drops to the muted surface regardless of which of the two rules above
 * assigned its tone — the number `0` beside it states the same thing in
 * words, so this is emphasis, not a colour-only signal, and a zero never
 * has to "look favourable" by borrowing green.
 *
 * ## `variant="flat"` — for when the SURFACE already carries the tone
 *
 * The first render of Fase B put the severity tint only on this 32px
 * chip, inside an otherwise plain white card — measured at ~2.3% of the
 * tile's area, with the title/value/context text identical across all
 * seven tiles. A reader could not tell the tiles apart at a glance, which
 * is the exact defect this fase exists to fix. `DashboardStatCard` now
 * tints its own CARD surface (a wash background plus an accent border —
 * see that file's own header), so painting the chip's usual filled square
 * on top of an already-tinted card would be a second colour block on the
 * first — the card-in-card CLAUDE.md §18 asks this rodada to reduce, not
 * add. `variant="flat"` renders the icon in the tone's ink colour with NO
 * background of its own, sitting directly on the card's own tint.
 * `DashboardModuleCard` keeps the default `"chip"` variant unchanged —
 * its own card surface stays plain, so the filled square is still the
 * only thing carrying that card's area identity.
 *
 * ## "Distribuições" (`DashboardChartCard`) — the THIRD decision, written
 * down beside the other two
 *
 * A distribution chart is neither of the first two cases: it has no
 * single severity to report (it is a spread across every risk level or
 * every status at once, several of them favourable), and it is not a
 * flat count either. It IS scoped to one area (Riscos for the two risk
 * charts, Planos de Ação for the action donut), so AREA tint is the rule
 * that applies — but restricted to the `variant="chip"` icon, never a
 * surface wash or a second decorative rule. A chart's `<svg>`/`<table>` already carries its OWN
 * meaningful colour — risk level, status — reused unchanged from
 * `RiskLevelBadge`/`StatusBadge` (`chart-tokens.ts`) precisely so it
 * never disagrees with the register. Washing the card behind that data
 * would add a second, non-data colour directly around shapes and legend
 * swatches whose distinctness from each other is the entire point;
 * `variant="chip"` ties the card to the rest of the screen without
 * touching a single data-bearing pixel.
 */
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type DashboardTone =
  'teal' | 'blue' | 'red' | 'violet' | 'amber' | 'indigo' | 'orange' | 'green';

/** Full class strings spelled out, never interpolated — Tailwind only generates classes it can find literally in source. */
const TONE_CLASSES: Readonly<Record<DashboardTone, string>> = {
  teal: 'bg-tint-teal-bg text-tint-teal-fg',
  blue: 'bg-tint-blue-bg text-tint-blue-fg',
  red: 'bg-tint-red-bg text-tint-red-fg',
  violet: 'bg-tint-violet-bg text-tint-violet-fg',
  amber: 'bg-tint-amber-bg text-tint-amber-fg',
  indigo: 'bg-tint-indigo-bg text-tint-indigo-fg',
  orange: 'bg-tint-orange-bg text-tint-orange-fg',
  green: 'bg-tint-green-bg text-tint-green-fg',
};

/** `variant="flat"`: ink only, no fill — see this file's header. */
const TONE_TEXT_CLASSES: Readonly<Record<DashboardTone, string>> = {
  teal: 'text-tint-teal-fg',
  blue: 'text-tint-blue-fg',
  red: 'text-tint-red-fg',
  violet: 'text-tint-violet-fg',
  amber: 'text-tint-amber-fg',
  indigo: 'text-tint-indigo-fg',
  orange: 'text-tint-orange-fg',
  green: 'text-tint-green-fg',
};

/**
 * Shared module-card base accent bar fill. `DashboardModuleCard` applies
 * this as a thin (`h-0.5`) strip along its bottom edge, `aria-hidden`,
 * never a progress/completion signal
 * (no percentage exists behind either card's data for it to represent).
 * `/45` opacity is a calibrated value, not a rough one: at full `-fg`
 * strength this bar measured as the single most saturated element on the
 * page, outweighing "O que requer atenção agora"'s own severity tiles —
 * backwards from the reading order the dashboard needs. Exported once
 * here (rather than declared twice) so the calibration lives in one
 * place if it is ever revisited.
 */
export const TONE_ACCENT_CLASSES: Readonly<Record<DashboardTone, string>> = {
  teal: 'bg-tint-teal-fg/45',
  blue: 'bg-tint-blue-fg/45',
  red: 'bg-tint-red-fg/45',
  violet: 'bg-tint-violet-fg/45',
  amber: 'bg-tint-amber-fg/45',
  indigo: 'bg-tint-indigo-fg/45',
  orange: 'bg-tint-orange-fg/45',
  green: 'bg-tint-green-fg/45',
};

export interface DashboardIconChipProps {
  icon: LucideIcon;
  tone: DashboardTone;
  /** Mutes the chip — see this file's header, "`idle`". */
  idle?: boolean;
  size?: 'sm' | 'md';
  /** `"chip"` (default): icon on its own tinted square. `"flat"`: icon in
   * tone ink only, no square of its own — see this file's header. */
  variant?: 'chip' | 'flat';
}

export function DashboardIconChip({
  icon: Icon,
  tone,
  idle = false,
  size = 'md',
  variant = 'chip',
}: DashboardIconChipProps): React.JSX.Element {
  return (
    <span
      data-tone={idle ? 'idle' : tone}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        size === 'md' ? 'size-9' : 'size-8',
        idle
          ? 'bg-muted text-muted-foreground'
          : variant === 'flat'
            ? TONE_TEXT_CLASSES[tone]
            : TONE_CLASSES[tone],
      )}
    >
      <Icon aria-hidden="true" className={size === 'md' ? 'size-[18px]' : 'size-4'} />
    </span>
  );
}
