'use client';

import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

import { useWideViewport } from './use-wide-viewport';

import type { ReactNode } from 'react';

export interface RolePanelShellProps {
  ariaLabel: string;
  overlayTitle: string;
  closeLabel: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

export function RolePanelShell({
  ariaLabel,
  overlayTitle,
  closeLabel,
  header,
  footer,
  children,
  onClose,
}: RolePanelShellProps): React.JSX.Element {
  const isWide = useWideViewport();

  const panel = isWide ? (
    <DetailPanel
      mode="inline"
      ariaLabel={ariaLabel}
      header={header}
      footer={footer}
      onClose={onClose}
      closeLabel={closeLabel}
      className="xl:sticky xl:top-4 xl:max-h-[calc(100svh-5rem)]"
    >
      {children}
    </DetailPanel>
  ) : (
    <DetailPanel mode="overlay" ariaLabel={ariaLabel} header={header} footer={footer}>
      {children}
    </DetailPanel>
  );

  if (isWide) return panel;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetTitle className="sr-only">{overlayTitle}</SheetTitle>
        {panel}
      </SheetContent>
    </Sheet>
  );
}
