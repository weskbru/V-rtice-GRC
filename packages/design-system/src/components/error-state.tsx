import { AlertTriangle } from 'lucide-react';

import { cn } from '../lib/utils';

import type { ReactNode } from 'react';

/**
 * The safe subset of an RFC 9457 `application/problem+json` response this
 * component is allowed to render. Deliberately narrow: `detail` is a
 * server-authored human message (never a stack trace, SQL fragment or raw
 * exception text — the API's global exception filter guarantees that,
 * ADR-009), and `correlationId` is a *support-facing* reference id the user
 * can quote to an administrator — not an internal identifier, so surfacing
 * it does not violate FR-107/FR-108. Any other field on a problem+json body
 * (e.g. `instance`, a URI, internal error codes) is intentionally not part
 * of this type and must never be threaded through to this component.
 */
export interface ErrorStateProblem {
  title?: string;
  detail?: string;
  correlationId?: string;
}

export interface ErrorStateProps {
  /** A problem+json payload (see `ErrorStateProblem`) — preferred over raw strings so the shape stays consistent with the API contract. */
  problem?: ErrorStateProblem;
  /** Plain override, used when there is no problem+json payload (e.g. a network failure before any response arrived). */
  title?: string;
  message?: string;
  /** e.g. a "Retry" button, owned by the caller. */
  action?: ReactNode;
  className?: string;
}

const FALLBACK_TITLE = 'Algo deu errado';
const FALLBACK_MESSAGE =
  'Não foi possível concluir a solicitação. Tente novamente e, se o problema persistir, entre em contato com o suporte.';

/**
 * Platform-wide error-state pattern (FR-045). Renders only a title, a human
 * message and an optional support reference id — never a stack trace or any
 * other internal identifier (FR-107, FR-108, SC-010), regardless of what a
 * caller's `problem` payload actually contains.
 */
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
