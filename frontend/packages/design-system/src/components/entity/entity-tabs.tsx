'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

import type { ComponentType, ReactNode, SVGProps } from 'react';

export interface EntityTab {
  id: string;
  label: string;
  content: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  visible?: boolean;
}

export interface EntityTabsScrollLabels {
  scrollBack: string;
  scrollForward: string;
}

type EntityTabsControlProps =
  | {
      value: string;
      onValueChange: (value: string) => void;
    }
  | { value?: undefined; onValueChange?: undefined };

export type EntityTabsProps = EntityTabsControlProps & {
  tabs: readonly EntityTab[];
  defaultTabId?: string;
  ariaLabel: string;
  scrollLabels: EntityTabsScrollLabels;
  size?: 'default' | 'compact';
  subordinate?: boolean;
  className?: string;
};

const SCROLL_STEP_PX = 160;

function useHorizontalOverflow(): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  canScrollBack: boolean;
  canScrollForward: boolean;
  scrollBy: (deltaPx: number) => void;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure(): void {
      if (!container) return;
      setCanScrollBack(container.scrollLeft > 1);
      setCanScrollForward(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
    }

    measure();
    container.addEventListener('scroll', measure, { passive: true });

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (contentRef.current) observer.observe(contentRef.current);

    return () => {
      container.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  function scrollBy(deltaPx: number): void {
    containerRef.current?.scrollBy({ left: deltaPx, behavior: 'smooth' });
  }

  return { containerRef, contentRef, canScrollBack, canScrollForward, scrollBy };
}

export function EntityTabs(props: EntityTabsProps): React.JSX.Element | null {
  const {
    tabs,
    defaultTabId,
    ariaLabel,
    scrollLabels,
    size = 'default',
    subordinate = false,
    className,
  } = props;
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);
  const { containerRef, contentRef, canScrollBack, canScrollForward, scrollBy } =
    useHorizontalOverflow();

  if (visibleTabs.length === 0) {
    return null;
  }

  const requestedValue = props.value ?? defaultTabId;
  const resolvedValue = visibleTabs.some((tab) => tab.id === requestedValue)
    ? requestedValue!
    : visibleTabs[0]!.id;

  const rootProps =
    props.value !== undefined
      ? { value: resolvedValue, onValueChange: props.onValueChange }
      : { defaultValue: resolvedValue };

  return (
    <TabsPrimitive.Root {...rootProps} className={cn('flex flex-col gap-4', className)}>
      <div className="relative">
        <div ref={containerRef} className="overflow-x-auto scroll-smooth">
          <TabsPrimitive.List
            ref={contentRef}
            className={cn(
              'text-muted-foreground',
              subordinate
                ? 'inline-flex w-fit items-center gap-4 border-b border-border'
                : cn(
                    'inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]',
                    size === 'compact' && 'max-sm:w-full max-sm:flex-wrap max-sm:gap-1.5',
                  ),
            )}
            aria-label={ariaLabel}
          >
            {visibleTabs.map((tab) => {
              const Icon = !subordinate ? tab.icon : undefined;
              return (
                <TabsPrimitive.Trigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    'font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    subordinate
                      ? cn(
                          'rounded-none border-b-2 border-transparent px-1 py-2 text-xs whitespace-nowrap text-muted-foreground',
                          'hover:text-foreground',
                          'data-[state=active]:border-foreground data-[state=active]:text-foreground',
                        )
                      : cn(
                          'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap text-foreground/80',
                          'hover:text-foreground',
                          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                          size === 'compact' && 'max-sm:h-7 max-sm:px-2 max-sm:text-xs',
                        ),
                  )}
                >
                  {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
                  {tab.label}
                </TabsPrimitive.Trigger>
              );
            })}
          </TabsPrimitive.List>
        </div>

        {canScrollBack ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent"
            />
            <button
              type="button"
              aria-label={scrollLabels.scrollBack}
              onClick={() => scrollBy(-SCROLL_STEP_PX)}
              className="absolute inset-y-0 left-0 flex w-6 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
          </>
        ) : null}

        {canScrollForward ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
            />
            <button
              type="button"
              aria-label={scrollLabels.scrollForward}
              onClick={() => scrollBy(SCROLL_STEP_PX)}
              className="absolute inset-y-0 right-0 flex w-6 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </>
        ) : null}
      </div>

      {visibleTabs.map((tab) => (
        <TabsPrimitive.Content key={tab.id} value={tab.id} className="outline-none">
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
