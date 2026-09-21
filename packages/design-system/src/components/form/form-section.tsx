import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface FormSectionProps {
  /** Section heading — rendered as a native `<legend>` so assistive technology announces it as the group label for every field inside (WCAG 1.3.1). */
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Platform-wide grouping for a set of related `FormField`s within a longer
 * form (T093, FR-045). Built on a native `<fieldset>`/`<legend>` pair rather
 * than a generic `<div>` heading, so the section/field relationship is
 * conveyed to assistive technology structurally, not just visually.
 */
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
