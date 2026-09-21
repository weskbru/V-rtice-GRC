'use client';

import * as Popover from '@radix-ui/react-popover';
import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

/**
 * CLAUDE.md §18.10/§18.12 (Front H, the link-picker defect): a single
 * option in a `SearchablePicker`'s list. Domain-agnostic on purpose — this
 * package must never know what a "control" or a "risk" is (D-10's own
 * rule for every component here); the caller maps its own domain records
 * onto this shape.
 */
export interface SearchablePickerOption {
  readonly id: string;
  /** Primary line — e.g. a name or title. */
  readonly label: string;
  /** Secondary line — e.g. a code. Rendered smaller, muted. */
  readonly description?: string;
}

/** What one `onSearch` call resolves to. `isPartial` is required, never
 * inferred by this component — only the caller knows the true total
 * (`meta.total` from the page envelope its own endpoint returns), and a
 * picker that guessed instead of being told would eventually guess wrong
 * silently. */
export interface SearchablePickerResult {
  readonly options: readonly SearchablePickerOption[];
  readonly isPartial: boolean;
}

/**
 * Every user-facing string, supplied by the caller (CLAUDE.md §11.1/§18.3:
 * `packages/design-system` holds no user-facing text of its own — every
 * catalog entry lives in `apps/web/src/lib/messages/`).
 */
export interface SearchablePickerLabels {
  /** Shown on the closed trigger when nothing is selected. */
  readonly placeholder: string;
  /** Placeholder text inside the search input itself. */
  readonly searchPlaceholder: string;
  /** Shown when a search returns zero results. */
  readonly emptyText: string;
  /** Shown while a search is in flight. */
  readonly loadingText: string;
  /**
   * Shown below the list when `isPartial` is true for the current
   * results — states PLAINLY that more exist than are shown, so the
   * reader knows to keep typing rather than concluding the record does
   * not exist. Takes the number actually shown so the message can say
   * exactly that (e.g. "Mostrando 25 de 142 resultados — refine a busca
   * para ver mais.").
   */
  readonly partialResultsText: (shownCount: number) => string;
  /** Accessible name for the trigger button (e.g. "Selecionar controle"). */
  readonly triggerAriaLabel: string;
}

export interface SearchablePickerProps {
  /** Currently selected option, or `undefined` for none. Passed as the
   * full option (not just an id) so the trigger can render its label
   * without a second, separate fetch by id — the caller already has it
   * from wherever the current value came from. */
  readonly value: SearchablePickerOption | undefined;
  readonly onChange: (option: SearchablePickerOption) => void;
  /**
   * Server-side search (Front H: this is the ONE thing the old plain
   * `<Select>` picker never did — every call site's endpoint already
   * accepts this exact query parameter and always did). Called with `''`
   * once when the popover opens (to show a first page before the user
   * types anything) and again, debounced, on every keystroke. NEVER
   * called with a larger page size to "fix" the defect that way — a
   * bigger first page still runs out eventually and hides the same
   * defect one page further down; searching is the only fix that does
   * not run out.
   */
  readonly onSearch: (query: string) => Promise<SearchablePickerResult>;
  readonly labels: SearchablePickerLabels;
  readonly disabled?: boolean;
  /** Debounce window between the last keystroke and the search call.
   * Default 300ms — long enough to not fire on every keystroke of a fast
   * typist, short enough to still feel immediate. */
  readonly debounceMs?: number;
}

/**
 * The one searchable, server-side-paginated picker every "link this
 * record to that one" screen in the product uses (Front H). Replaces a
 * plain `<Select>` fed by a single unsearched fetch of the target
 * registry's first page — past that page's size, a record simply could
 * not be reached, and the screen said nothing about why. Built on
 * `cmdk` + Radix Popover, the same combobox composition `apps/web`'s own
 * shadcn primitives already use elsewhere in this product — no second
 * component library, per CLAUDE.md §18.4.
 *
 * **Two behaviours a caller now depends on, both found only by running the
 * real component against a real build (CI, 2026-09-11) — neither type-check
 * nor lint could see either one:**
 *
 * 1. **The trigger's own accessible name is `labels.triggerAriaLabel`
 *    ("Selecionar X"), never `labels.placeholder` and never whatever text
 *    the adjacent "Vincular"/link button carries.** The retired `<Select>`
 *    this component replaced happened to share its trigger's `aria-label`
 *    with that button's own label — several e2e specs and component tests
 *    had silently come to assume that coincidence. Changing
 *    `triggerAriaLabel` independently of the caller's link-button label is
 *    intentional (they are two different controls with two different
 *    purposes) but is now a naming contract other code reaches for by
 *    exact string — do not casually rename one without checking callers.
 * 2. **A failed `onChange` consumer (a link attempt the server refused)
 *    does NOT get this component to reset itself.** `value` is fully
 *    caller-controlled — if the caller's own `onLink` handler only clears
 *    `selectedOption` on success (every current call site's own
 *    `RelationshipSubsection`-shaped pattern), the trigger keeps showing
 *    the rejected option's label after a refusal. This is correct — a user
 *    whose link attempt failed should still see what they tried, the same
 *    way a form does not blank a field after a rejected submit — but it
 *    means a refused option's name IS legitimately still on screen
 *    afterward, inside this component's own trigger, not as a stray row
 *    anywhere else. A test asserting "this name appears nowhere on the
 *    page" after a refusal is asserting something this component was never
 *    going to promise; scope such an assertion to the specific list/table
 *    region it actually means.
 */
export function SearchablePicker({
  value,
  onChange,
  onSearch,
  labels,
  disabled = false,
  debounceMs = 300,
}: SearchablePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchablePickerResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  // Debounced, race-safe search: a `requestId` guards against a slower
  // EARLIER response overwriting a faster LATER one (e.g. "risco" resolving
  // after "risco de fraude" already did) — never merely "the last call
  // made", but "the last call STARTED", using a monotonically increasing
  // counter rather than the promise identity itself.
  useEffect(() => {
    if (!open) return undefined;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    const timeout = setTimeout(
      () => {
        void onSearch(query)
          .then((next) => {
            if (requestIdRef.current === requestId) {
              setResult(next);
            }
          })
          .catch(() => {
            if (requestIdRef.current === requestId) {
              setResult({ options: [], isPartial: false });
            }
          })
          .finally(() => {
            if (requestIdRef.current === requestId) {
              setIsLoading(false);
            }
          });
        // First call (popover just opened, query is still '') fires
        // immediately — only a real keystroke waits out the debounce.
      },
      query === '' ? 0 : debounceMs,
    );

    return () => clearTimeout(timeout);
    // `onSearch` is deliberately excluded from this effect's dependencies:
    // it is expected to be referentially stable per mount (callers pass a
    // plain closure); including it would re-trigger a search on every
    // parent render, not only on `open`/`query` changes.
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResult(undefined);
    }
  }, [open]);

  const options = result?.options ?? [];
  const showEmpty = !isLoading && result !== undefined && options.length === 0;
  const showPartialHint = !isLoading && (result?.isPartial ?? false) && options.length > 0;

  const triggerLabel = useMemo(() => value?.label ?? labels.placeholder, [value, labels]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={labels.triggerAriaLabel}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>
            {triggerLabel}
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 w-[--radix-popover-trigger-width] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <CommandPrimitive shouldFilter={false} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                value={query}
                onValueChange={setQuery}
                placeholder={labels.searchPlaceholder}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              {isLoading ? (
                <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin opacity-50" />
              ) : null}
            </div>
            <CommandPrimitive.List className="max-h-72 overflow-y-auto overflow-x-hidden p-1">
              {showEmpty ? (
                <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {labels.emptyText}
                </CommandPrimitive.Empty>
              ) : null}
              {isLoading && options.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {labels.loadingText}
                </div>
              ) : null}
              {options.map((option) => {
                const isSelected = option.id === value?.id;
                return (
                  <CommandPrimitive.Item
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    /**
                     * Explicit `aria-label` (CI-found defect, 2026-09-11):
                     * without it, the accessible name is computed from this
                     * item's rendered text content — the label and
                     * description below are two SIBLING text nodes (stacked
                     * visually by `flex-col`, which gives sighted users a
                     * free line-break separation), and the accname
                     * algorithm concatenates sibling text-node
                     * contributions with NOTHING between them, trimming
                     * each contribution's own leading/trailing whitespace
                     * first — a hidden separator span between them (the
                     * first fix tried here) gets its own surrounding spaces
                     * trimmed away for the same reason and does not
                     * survive. The result without either fix:
                     * "Controle fora do escopoCTL-2026-0001", one fused,
                     * illegible word to a screen reader — confirmed via
                     * `dom-accessibility-api`, the same accname-spec
                     * implementation `@testing-library/jest-dom`'s own
                     * `toHaveAccessibleName` uses. Neither type-check nor
                     * lint could see this; only exercising the rendered
                     * option could. An explicit `aria-label` is IMMUNE to
                     * that per-node trimming (it is used verbatim, not
                     * assembled from child text nodes), so it is the
                     * reliable fix even though it means this one string
                     * exists in two places (here and the visible spans
                     * below) — a duplication accepted deliberately, having
                     * measured that the alternative does not actually work.
                     */
                    aria-label={
                      option.description ? `${option.label} ${option.description}` : option.label
                    }
                    className={cn(
                      'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
                      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                    )}
                  >
                    <Check
                      aria-hidden="true"
                      className={cn('size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                    />
                    {/* Purely visual from here down — the item's own
                        `aria-label` above is authoritative for the
                        accessible name and does not descend into this
                        content (accname spec), so no `aria-hidden` is
                        needed on it either. */}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{option.label}</span>
                      {option.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </CommandPrimitive.Item>
                );
              })}
            </CommandPrimitive.List>
            {showPartialHint ? (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {labels.partialResultsText(options.length)}
              </div>
            ) : null}
          </CommandPrimitive>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
