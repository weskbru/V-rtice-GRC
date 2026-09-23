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
  label: string;
  prefix?: string;
  options: readonly ToolbarSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  className?: string;
}

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
