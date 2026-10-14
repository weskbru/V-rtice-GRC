import { AlertCircle } from 'lucide-react';
import { useId } from 'react';

import { cn } from '../../lib/utils';

import type { ReactNode } from 'react';

export interface FormFieldRenderProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean;
}

export interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  optionalIndicator?: string;
  className?: string;
  children: (field: FormFieldRenderProps) => ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  description,
  error,
  optionalIndicator,
  className,
  children,
}: FormFieldProps): React.JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="ml-0.5 text-status-danger-fg">
                *
              </span>
              <span className="sr-only"> (obrigatório)</span>
            </>
          ) : null}
        </label>
        {!required && optionalIndicator ? (
          <span className="text-xs font-normal text-muted-foreground">{optionalIndicator}</span>
        ) : null}
      </div>

      {children({
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
      })}

      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-medium text-status-danger-fg"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
