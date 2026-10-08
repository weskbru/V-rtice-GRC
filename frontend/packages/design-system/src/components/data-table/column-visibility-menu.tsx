'use client';

import { Columns3 } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

import { useDisclosureClose } from './use-disclosure-close';

export interface ColumnVisibilityOption {
  id: string;
  label: string;
}

export interface ColumnVisibilityMenuProps {
  label: string;
  columns: readonly ColumnVisibilityOption[];
  visibility: Readonly<Record<string, boolean>>;
  onChange: (next: Record<string, boolean>) => void;
  className?: string;
}

export function ColumnVisibilityMenu({
  label,
  columns,
  visibility,
  onChange,
  className,
}: ColumnVisibilityMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useDisclosureClose(containerRef, open, () => setOpen(false));

  function toggle(id: string): void {
    const currentlyVisible = visibility[id] !== false;
    onChange({ ...visibility, [id]: !currentlyVisible });
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
        <Columns3 aria-hidden="true" className="size-4" />
        <span>{label}</span>
      </button>

      <div
        id={panelId}
        role="group"
        aria-label={label}
        hidden={!open}
        className={cn(
          'absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md',
          !open && 'hidden',
        )}
      >
        {open ? (
          <ul className="flex flex-col gap-0.5">
            {columns.map((column) => {
              const checked = visibility[column.id] !== false;
              return (
                <li key={column.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(column.id)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span>{column.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
