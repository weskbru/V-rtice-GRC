'use client';

import { cn } from '../../lib/utils';

export interface PageSizeSelectProps {
  pageSize: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange: (pageSize: number) => void;
  label: string;
  className?: string;
}

export function PageSizeSelect({
  pageSize,
  pageSizeOptions = [25, 50, 100],
  onPageSizeChange,
  label,
  className,
}: PageSizeSelectProps): React.JSX.Element {
  return (
    <label className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {label}
      <select
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {pageSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
