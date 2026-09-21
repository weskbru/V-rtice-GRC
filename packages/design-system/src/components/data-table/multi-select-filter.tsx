'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

import { useDisclosureClose } from './use-disclosure-close';

export interface MultiSelectFilterOption {
  value: string;
  label: string;
}

export interface MultiSelectFilterProps {
  /** Visible trigger text AND the disclosure panel's accessible name — keep it short and unique among sibling filters (e.g. "Status", "Categoria"). */
  label: string;
  options: readonly MultiSelectFilterOption[];
  selected: readonly string[];
  onChange: (next: readonly string[]) => void;
  clearLabel?: string;
  emptyOptionsMessage?: string;
  className?: string;
}

/**
 * Generic, keyboard-operable multi-select filter control (T109) — the
 * building block behind every checkbox-list filter in the risk register
 * (status, risk level, category, organizational unit, owner) and every
 * future module's register screen.
 *
 * A real `<button>` trigger plus a manually-controlled panel of native
 * `<input type="checkbox">` elements, not the native `<details>/<summary>`
 * disclosure or a Radix combobox: native checkboxes need no ARIA
 * choreography to be correct, and a plain `<button>` has an unambiguous,
 * cross-browser accessible role — see `use-disclosure-close.ts`'s doc
 * comment for why that matters to this project's E2E suite specifically.
 *
 * ## Why the panel is hidden rather than unmounted (F-71)
 *
 * Same reason, same mechanism and same measurement as `FilterBar`'s own
 * panel — read that component's doc comment for the full account. The short
 * version: React 19's `useId` is positional and shifts when a streamed
 * `<Suspense>` chunk races hydration; React does not patch an attribute
 * mismatch, so a trigger that was server-rendered keeps the SERVER id in its
 * `aria-controls` while a panel created later on click is born with the
 * CLIENT id, and the reference dangles with `aria-expanded="true"`.
 *
 * This component only became exposed to that when `FilterBar` stopped
 * unmounting its collapsed panel: before that, on a collapsible register,
 * these triggers were never in the server HTML at all, so trigger and panel
 * shared the client numbering. Measured immediately after that change, in a
 * production build: **22 of 32 Firefox loads of `/risks` had all four of
 * these triggers pointing at an id not in the document while their popover
 * was open** — and, unlike `FilterBar`'s disclosure button, NO GATE WOULD
 * EVER HAVE SAID SO. `aria-haspopup` is why: axe's own
 * `aria-valid-attr-value` rule downgrades a missing `aria-controls` target to
 * "needs review" for any element carrying it ("Unable to determine if
 * aria-controls referenced ID exists on the page while using
 * aria-haspopup"), so the violation is never reported. Hiding the panel
 * instead of unmounting it makes trigger and panel come from the same render
 * pass, and the question stops being asked.
 *
 * What survives both passes is the panel ELEMENT; the option checkboxes
 * still mount on open. The defect is entirely in two attributes — the
 * trigger's `aria-controls` and the panel's `id` — so that is enough, and it
 * keeps the change invisible to everything else. It is not a detail: the
 * first attempt DID keep the options mounted, and the suite caught it
 * immediately — `requirement-list-section.test.tsx` failed because a hidden
 * option labelled "Não atendido" made a `getByText` for the row's compliance
 * state ambiguous. Nothing a user could see had changed, and a real test had
 * still been broken; there is no reason to pay that to fix two attributes.
 *
 * `hidden` is the whole mechanism: the package's Tailwind preflight carries
 * `[hidden]:where(:not([hidden='until-found'])) { display: none !important }`,
 * and the explicit `hidden` utility is applied alongside so the panel is
 * `display: none` — out of the tab order and out of the accessibility tree —
 * even without preflight.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  clearLabel = 'Limpar',
  emptyOptionsMessage = 'Nenhuma opção disponível.',
  className,
}: MultiSelectFilterProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useDisclosureClose(containerRef, open, () => setOpen(false));

  function toggleValue(value: string): void {
    if (selected.includes(value)) {
      onChange(selected.filter((entry) => entry !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span>{label}</span>
        {selected.length > 0 ? (
          <span
            aria-hidden="true"
            className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {selected.length}
          </span>
        ) : null}
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </button>

      <div
        id={panelId}
        role="group"
        aria-label={label}
        // Present in every render pass, hidden while closed (F-71).
        hidden={!open}
        className={cn(
          'absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md',
          !open && 'hidden',
        )}
      >
        {open ? (
          <>
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyOptionsMessage}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {options.map((option) => {
                  const checked = selected.includes(option.value);
                  return (
                    <li key={option.value}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleValue(option.value)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        <span>{option.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {selected.length > 0 ? (
              <div className="mt-1 border-t border-border pt-1">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {clearLabel}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
