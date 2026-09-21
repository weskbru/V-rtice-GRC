'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ToolbarSelectOption {
  value: string;
  label: string;
}

export interface ToolbarSelectProps {
  /** The control's accessible name, e.g. "Ordenar por" or "Base do nível exibido" — always a full phrase, even when `prefix` shows something shorter. */
  label: string;
  /** Short visible text in front of the control ("Ordenar por", "Base"). Hidden from assistive technology, which reads `label` instead, so the phrase is never announced twice. */
  prefix?: string;
  options: readonly ToolbarSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Widths differ by content: an ordering preset needs more room than "Residual". */
  triggerClassName?: string;
  className?: string;
}

/**
 * One compact labelled `<Select>` for a register's results toolbar (ordering,
 * a display basis, anything else a module needs to sit beside them).
 *
 * The registers had each built this pair — a small caption plus a select —
 * with their own spacing and their own trigger width, which is how two
 * neighbouring modules ended up with `w-[13rem]` and `w-[15rem]` for the
 * same control. The visible caption is `aria-hidden` and the trigger keeps
 * the full `label` as its accessible name: a screen reader hears "Ordenar
 * por, Código (crescente)", not "Ordenar por Ordenar por".
 */
export function ToolbarSelect({
  label,
  prefix,
  options,
  value,
  onValueChange,
  triggerClassName,
  className,
}: ToolbarSelectProps): React.JSX.Element {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {prefix ? (
        <span
          aria-hidden="true"
          className="shrink-0 text-sm whitespace-nowrap text-muted-foreground"
        >
          {prefix}
        </span>
      ) : null}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          aria-label={label}
          className={cn(
            'h-9 min-w-0 overflow-hidden [&>span[data-slot=select-value]]:min-w-0 [&>span[data-slot=select-value]]:overflow-hidden [&>span[data-slot=select-value]]:text-ellipsis',
            triggerClassName,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
