'use client';

import { Button } from '@/components/ui/button';
import { common } from '@/lib/messages/common';

export interface ReferenceDataErrorProps {
  /** The module's own message, e.g. "Não foi possível carregar as opções de filtro." */
  message: string;
  onRetry: () => void;
}

/**
 * PharosGRC — the "filter options failed to load" banner, shown above a
 * register's toolbar.
 *
 * It exists so that loading, loaded-and-empty, and failed stay three
 * distinct states. A register that swallows the failure and falls back to an
 * empty option list tells the user "this organization has no categories"
 * when the truth is "the request broke" — a defect this screen shipped once
 * already. The retry re-runs the module's own reference-data load; the list
 * underneath is never blocked by it.
 *
 * Copied verbatim into five registers before this; the only thing that ever
 * differed was the sentence, which is why that is the one thing passed in.
 */
export function ReferenceDataError({
  message,
  onRetry,
}: ReferenceDataErrorProps): React.JSX.Element {
  return (
    <p
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm font-medium text-status-danger-fg"
    >
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {common.actions.retry}
      </Button>
    </p>
  );
}
