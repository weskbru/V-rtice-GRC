'use client';

import { useRef } from 'react';

import { cn } from '../lib/utils';

import type { ComponentType, KeyboardEvent, SVGProps } from 'react';

export interface ViewToggleOption<TValue extends string> {
  value: TValue;
  /** Visible text. */
  label: string;
  /** Optional leading icon (lucide-react component). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Accessible name when it must be fuller than `label`, e.g. "Ver os riscos em cards". */
  accessibleLabel?: string;
}

export interface ViewToggleProps<TValue extends string> {
  /** Accessible name for the group, e.g. "Modo de visualização". */
  label: string;
  options: readonly ViewToggleOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  className?: string;
}

/**
 * Compact segmented control for switching how a list is presented (e.g.
 * Cards / Tabela). Pure presentation — it carries no domain knowledge of
 * what the options mean.
 *
 * Implements the ARIA APG "radio group" pattern (a single-choice segmented
 * control, not a toolbar of independent toggle buttons): the container is
 * `role="radiogroup"`, each segment is `role="radio"` with `aria-checked`,
 * and a roving `tabIndex` means Tab enters/leaves the group at the selected
 * segment while the arrow keys (plus Home/End) move the selection between
 * segments, wrapping at the ends — the standard keyboard model for this
 * widget. Selection is therefore programmatically determinable via
 * `aria-checked`, never only a visual difference, and the selected segment
 * is never identified by colour alone: it gets a filled background, a
 * heavier font weight and (when supplied) its icon together (CLAUDE.md
 * §18.8).
 *
 * `h-9` to match the sibling filter controls this sits next to on a
 * register screen's toolbar (`FilterBar`, `MultiSelectFilter`), which are
 * all `h-9` too.
 */
export function ViewToggle<TValue extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: ViewToggleProps<TValue>): React.JSX.Element {
  const optionRefs = useRef(new Map<TValue, HTMLButtonElement>());

  function focusOption(nextValue: TValue): void {
    optionRefs.current.get(nextValue)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();

    const nextOption = options[nextIndex];
    if (!nextOption) return;
    onChange(nextOption.value);
    focusOption(nextOption.value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex h-9 items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-xs',
        className,
      )}
    >
      {options.map((option, index) => {
        const Icon = option.icon;
        const checked = option.value === value;

        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) {
                optionRefs.current.set(option.value, node);
              } else {
                optionRefs.current.delete(option.value);
              }
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.accessibleLabel}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              checked
                ? 'bg-primary font-semibold text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
