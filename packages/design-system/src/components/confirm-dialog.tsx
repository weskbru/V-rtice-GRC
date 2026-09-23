'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';

import { useDialogFocusRestore } from '../lib/use-restore-focus';
import { cn } from '../lib/utils';

import type { ComponentType, ReactNode, SVGProps } from 'react';

export interface ConfirmDialogLabels {
  confirm: string;
  cancel: string;
  close: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  labels: ConfirmDialogLabels;
  variant?: 'default' | 'sensitive' | 'destructive';
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onConfirm: () => void;
  isConfirming?: boolean;
}

const CONFIRM_BUTTON_TONE: Record<'default' | 'sensitive' | 'destructive', string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  sensitive: 'bg-status-warning-solid-bg text-status-warning-solid-fg hover:opacity-90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const TITLE_ICON_TONE: Record<'default' | 'sensitive' | 'destructive', string> = {
  default: 'text-foreground',
  sensitive: 'text-status-warning-fg',
  destructive: 'text-destructive',
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  labels,
  variant = 'default',
  icon: Icon,
  onConfirm,
  isConfirming = false,
}: ConfirmDialogProps): React.JSX.Element {
  const handleOpenChange = (nextOpen: boolean): void => {
    if (isConfirming) return;
    onOpenChange(nextOpen);
  };

  const { FocusRestoreAnchor, restoreTargetRef, handleCloseAutoFocus } = useDialogFocusRestore();

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <FocusRestoreAnchor restoreTargetRef={restoreTargetRef} />
          <div className="flex items-start gap-2.5">
            {Icon ? (
              <Icon
                aria-hidden="true"
                className={cn('mt-0.5 size-5 shrink-0', TITLE_ICON_TONE[variant])}
              />
            ) : null}
            <div className="flex flex-col gap-2">
              <Dialog.Title className="text-base font-semibold text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isConfirming}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {labels.cancel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              autoFocus
              disabled={isConfirming}
              onClick={onConfirm}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                CONFIRM_BUTTON_TONE[variant],
              )}
            >
              {isConfirming ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {labels.confirm}
            </button>
          </div>

          <Dialog.Close
            aria-label={labels.close}
            disabled={isConfirming}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
          >
            <X aria-hidden="true" className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
