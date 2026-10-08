'use client';

import { Button } from '@/components/ui/button';
import { common } from '@/lib/messages/common';

export interface ReferenceDataErrorProps {
  message: string;
  onRetry: () => void;
}

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
