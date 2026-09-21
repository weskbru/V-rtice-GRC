'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

/**
 * Heading level the group's own title is rendered at, when the surrounding
 * document has a heading outline the group belongs in. Omitted by default:
 * a group that is NOT a section of the page (a filter drawer, say) must not
 * invent a heading, and an out-of-order heading is itself an accessibility
 * defect — so the caller, which is the only party that knows the outline,
 * decides.
 */
export type DisclosureGroupHeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface DisclosureGroupProps {
  /**
   * Visible title of the group. Required and caller-supplied — this package
   * carries no user-facing strings of its own (D-10).
   */
  title: ReactNode;
  /**
   * Optional content rendered at the right end of the toggle row, inside
   * the button — e.g. a count of what the group contains. It is part of the
   * button's accessible name, which is what makes "Riscos, 8" announce as
   * one thing rather than two.
   */
  meta?: ReactNode;
  /**
   * Controlled open state. Pass it together with `onOpenChange` when
   * something outside the group also drives it — "expand every module", for
   * instance. Omit both to let the group own its state, seeded by
   * `defaultOpen`.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Initial state when uncontrolled. Defaults to closed. */
  defaultOpen?: boolean;
  headingLevel?: DisclosureGroupHeadingLevel;
  /** The group's content. Rendered only while open. */
  children: ReactNode;
  className?: string;
  /** Applied to the content region, not to the group's outer element. */
  contentClassName?: string;
}

/**
 * An expandable group, in this platform's existing disclosure idiom: a
 * plain `<button>` carrying `aria-expanded` and `aria-controls`, and a
 * region it names — exactly what `FilterBar` already does for its filter
 * panel (015 D-06). No Accordion, no Collapsible, no new dependency: the
 * project deliberately has neither, and a third-party accordion would bring
 * its own focus and keyboard semantics to sit beside the ones already in
 * use here.
 *
 * ## Why the content unmounts instead of being hidden
 *
 * Closed means gone from the document. A `hidden` subtree would keep every
 * descendant mounted — for a permission catalogue grouped by module, that is
 * the whole catalogue rendered whether or not anyone opened it.
 * `aria-controls` then names an element that is not in the document while
 * collapsed, which assistive technology (and axe) read through the pairing
 * with `aria-expanded="false"` as "this control reveals content" rather than
 * as a dangling reference.
 *
 * `FilterBar` made the opposite choice, and deliberately: it hides its panel
 * instead of unmounting it, because its `aria-controls` survived into a
 * production-visible `aria-valid-attr-value` violation on Firefox when the
 * panel was created after hydration (F-71 — `useId` shifting across the
 * streamed-HTML hydration graft). The divergence between the two components
 * is therefore a cost/exposure trade, not an inconsistency: `FilterBar`'s
 * panel holds a handful of controls with no mount-time work, while this
 * group is used to hold a catalogue. **If this component is ever composed on
 * a streamed route where the panel can be opened, revisit this — the
 * mechanism that produced F-71 applies here identically.**
 *
 * ## Controlled or uncontrolled
 *
 * Both, deliberately. "Expand all modules" needs the parent to hold the
 * state; a group used on its own should not force the caller to write that
 * state by hand. Passing `open` makes the parent authoritative; omitting it
 * keeps the state here.
 */
export function DisclosureGroup({
  title,
  meta,
  open,
  onOpenChange,
  defaultOpen = false,
  headingLevel,
  children,
  className,
  contentClassName,
}: DisclosureGroupProps): React.JSX.Element {
  const reactId = useId();
  const panelId = `disclosure-${reactId}-panel`;
  const buttonId = `disclosure-${reactId}-button`;
  const titleId = `disclosure-${reactId}-title`;
  const metaId = `disclosure-${reactId}-meta`;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  function toggle(): void {
    const next = !isOpen;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const toggleButton = (
    <button
      type="button"
      id={buttonId}
      aria-expanded={isOpen}
      aria-controls={panelId}
      /*
       * Named by an explicit `aria-labelledby` list rather than by letting
       * the accessible-name algorithm concatenate the button's own
       * children. This package already paid for that once: two sibling
       * spans that read as two lines on screen contribute their text with
       * NOTHING between them, so "Riscos" and "8" announce as "Riscos8"
       * (the `SearchablePicker` defect found in CI on 2026-09-11). A
       * multi-element `aria-labelledby` is joined with a space by
       * specification, so title and meta stay two words in every
       * implementation.
       */
      aria-labelledby={meta ? `${titleId} ${metaId}` : titleId}
      onClick={toggle}
      data-slot="disclosure-group-toggle"
      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ChevronDown
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0 text-muted-foreground transition-transform',
          isOpen && 'rotate-180',
        )}
      />
      <span id={titleId} className="min-w-0 flex-1">
        {title}
      </span>
      {meta ? (
        <span id={metaId} className="shrink-0">
          {meta}
        </span>
      ) : null}
    </button>
  );

  const Heading = headingLevel ? (`h${headingLevel}` as const) : null;

  return (
    <div
      data-slot="disclosure-group"
      data-state={isOpen ? 'open' : 'closed'}
      className={cn('rounded-lg border border-border bg-card', className)}
    >
      {Heading ? (
        // The heading carries no styling of its own — Tailwind's preflight
        // already resets headings to inherited size and weight, and the
        // button inside is what the reader actually sees. Its job is the
        // document outline, which is invisible and is exactly the point
        // (NFR-003).
        <Heading>{toggleButton}</Heading>
      ) : (
        toggleButton
      )}

      {isOpen ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          data-slot="disclosure-group-content"
          className={cn('border-t border-border px-3 py-3', contentClassName)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
