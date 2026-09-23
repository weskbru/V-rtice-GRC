'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

export type DisclosureGroupHeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface DisclosureGroupProps {
  title: ReactNode;
  meta?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  headingLevel?: DisclosureGroupHeadingLevel;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

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
      {Heading ? <Heading>{toggleButton}</Heading> : toggleButton}

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
