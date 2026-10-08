import { AlertTriangle } from 'lucide-react';

import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

export interface ErrorStateProblem {
  title?: string;
  detail?: string;
  correlationId?: string;
}

export interface ErrorStateProps {
  problem?: ErrorStateProblem;
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

const FALLBACK_TITLE = 'Algo deu errado';
const FALLBACK_MESSAGE =
  'Não foi possível concluir a solicitação. Tente novamente e, se o problema persistir, entre em contato com o suporte.';

export function ErrorState({
  problem,
  title,
  message,
  action,
  className,
}: ErrorStateProps): React.JSX.Element {
  const resolvedTitle = title ?? problem?.title ?? FALLBACK_TITLE;
  const resolvedMessage = message ?? problem?.detail ?? FALLBACK_MESSAGE;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-status-danger-border bg-status-danger-bg px-6 py-12 text-center',
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="size-10 text-status-danger-fg" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-status-danger-fg">{resolvedTitle}</p>
        <p className="max-w-md text-sm text-status-danger-fg/90">{resolvedMessage}</p>
        {problem?.correlationId ? (
          <p className="mt-1 text-xs text-status-danger-fg/70">
            Referência: {problem.correlationId}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
