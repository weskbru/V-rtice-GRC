/**
 * PharosGRC — shared detail-screen read-only field with a leading semantic
 * icon, originally built for the risk overview's "Detalhes do risco" card
 * (017-risk-overview-polish, T097/FR-053/FR-069/FR-093).
 *
 * Local composition, not a `ReadOnlyField` change:
 * `packages/design-system/src/components/form/read-only-field.tsx` is used
 * across the whole product and has no icon prop, and it stays that way — no
 * other screen has asked for icons on it, and CLAUDE.md §19.4/§18.3 both say
 * a shared primitive changes for a proven cross-screen need, not one
 * screen's polish. This component copies `ReadOnlyField`'s own `dt`/`dd`
 * classes VERBATIM (see 017's own decision record, preserved in
 * `risk-overview.tsx`'s header comment) so a caller's read-only semantics
 * stay visually identical to every other `ReadOnlyField` on the platform —
 * the only addition is the icon slot ahead of the label.
 *
 * The empty-value fallback text is NOT baked in here: this component lives
 * outside every feature module and must not import any module's message
 * catalog (CLAUDE.md §11.1 — user-facing strings live in centralized
 * catalogs, and a shared, domain-free component cannot own one). The caller
 * supplies `emptyLabel` — the exact string it would otherwise have inlined
 * — and `DetailField` renders it through the platform's own `EmptyValue`
 * when `value` is `null`.
 *
 * ## Promotion (018-incident-detail-experience)
 *
 * Moved here, verbatim in rendered output, from the module-local
 * `DetailField` inside `features/risks/components/risk-overview.tsx`. The
 * promotion is earned, not speculative (CLAUDE.md §19.10): Incidents' own
 * detail screen (018-incident-detail-experience) is the second real
 * consumer of this exact field composition. Consumers today:
 * `apps/web/src/features/risks/components/risk-overview.tsx` (passing
 * `risks.overview.notSet` as `emptyLabel`, unchanged from before this
 * promotion) and the incident detail view built in this same round.
 *
 * ## C6 (Fase 6 review) — the markup was invalid `<dl>` content, from before
 * this promotion existed
 *
 * The ORIGINAL shape (icon `<span>` and a `<div>` wrapping `dt`/`dd`, as
 * two siblings inside the div this component handed the caller's `<dl>`)
 * predates this file — `git log -S` traces it to 017-risk-overview-polish
 * (`37143ba`), byte-identical, never touched by the promotion itself. Axe's
 * `definition-list`/`dlitem` rules (serious, WCAG 1.3.1) require a `<dl>`'s
 * own direct-child `<div>` to contain ONLY `dt`/`dd` — an icon `<span>`
 * sibling inside that div is not allowed, regardless of how long the
 * violation went undetected. Promoting the component in Fase 1 and giving
 * Incidents its own two `<dl>`s (`incident-overview.tsx`,
 * `incident-lifecycle-section.tsx`) doubled the violation's surface, which
 * is what turned a pre-existing, unnoticed defect into something this round
 * had to close before calling the screen done (CLAUDE.md §18.8: a
 * refinement preserves or improves existing guarantees — a brand-new screen
 * inheriting a known `serious` violation does not clear that bar).
 *
 * Fixed by moving the icon INSIDE `<dt>` (a `<dt>` may contain any flow
 * content — an icon plus its label is ordinary flow content, nothing
 * `dl`-specific forbids it) instead of beside it. The wrapping `<div>` now
 * contains exactly `dt` and `dd`, nothing else, satisfying `only-dlitems`.
 * `<dd>` gets an explicit `pl-[38px]` (`size-7` icon + `gap-2.5`, the exact
 * two values that used to indent BOTH `dt` and `dd` together via the old
 * shared flex row) so its text still starts at the identical horizontal
 * position as before — measured directly (`getBoundingClientRect`) against
 * Risk's own rendered "Detalhes do risco" card, both before and after: the
 * icon's own x, the label's x and the value's x are byte-identical. The one
 * change that does NOT cancel out is vertical: the icon now sits beside the
 * LABEL line alone (28px tall) rather than centered against the label+value
 * two-line block, so each field's own row grows slightly taller to fit the
 * icon next to single-line text — an unavoidable, honestly-disclosed
 * consequence of the icon now living inside valid `dl` content, not a
 * regression hidden by only checking horizontal position.
 */
import { EmptyValue } from '@pharos/design-system/components';

import { cn } from '@/lib/utils';

import type { ComponentType, ReactNode, SVGProps } from 'react';

export interface DetailFieldProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  /** Present value, or `null` to render `emptyLabel` through the platform's `EmptyValue` placeholder instead. */
  value: ReactNode | null;
  /** The caller's own catalog string for "not set" — rendered only when `value` is `null`. Required because this component must not import any module's message catalog. */
  emptyLabel: string;
  /** Same meaning as `ReadOnlyField`'s `muted` — de-emphasizes secondary/classification-style facts below primary ones. */
  muted?: boolean;
}

export function DetailField({
  icon: Icon,
  label,
  value,
  emptyLabel,
  muted = false,
}: DetailFieldProps): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt
        className={cn(
          'flex items-center gap-2.5 font-medium tracking-wide text-muted-foreground uppercase',
          muted ? 'text-[0.6875rem]' : 'text-xs',
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <Icon className="size-3.5" />
        </span>
        {label}
      </dt>
      <dd
        className={cn(
          // `pl-[38px]` — see this file's own C6 doc comment: `size-7`
          // (28px) + `gap-2.5` (10px), the exact two values that used to
          // indent both `dt` and `dd` together via the old shared flex row.
          'whitespace-pre-wrap pl-[38px]',
          muted ? 'text-sm text-foreground/80' : 'text-sm text-foreground',
        )}
      >
        {value ?? <EmptyValue>{emptyLabel}</EmptyValue>}
      </dd>
    </div>
  );
}
