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
  label: string;
  options: readonly MultiSelectFilterOption[];
  selected: readonly string[];
  onChange: (next: readonly string[]) => void;
  clearLabel?: string;
  emptyOptionsMessage?: string;
  className?: string;
}

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
