import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps): React.JSX.Element {
  return (
    <fieldset className={cn('flex flex-col gap-4 rounded-lg border border-border p-4', className)}>
      <legend className="px-1 text-sm font-semibold text-foreground">{title}</legend>
      {description ? <p className="-mt-2 text-sm text-muted-foreground">{description}</p> : null}
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}
