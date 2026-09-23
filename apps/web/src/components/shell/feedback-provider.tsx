'use client';

import { toast } from 'sonner';

import { Toaster } from '@/components/ui/sonner';
import { common } from '@/lib/messages/common';

export interface FeedbackProviderProps {
  children: React.ReactNode;
}

export function FeedbackProvider({ children }: FeedbackProviderProps): React.JSX.Element {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        containerAriaLabel={common.toaster.regionAriaLabel}
        toastOptions={{ closeButtonAriaLabel: common.toaster.closeButtonAriaLabel }}
      />
    </>
  );
}

export const feedback = {
  success: (message: string, description?: string): void => {
    toast.success(message, description ? { description } : undefined);
  },
  warning: (message: string, description?: string): void => {
    toast.warning(message, description ? { description } : undefined);
  },
  error: (message: string, description?: string): void => {
    toast.error(message, description ? { description } : undefined);
  },
  info: (message: string, description?: string): void => {
    toast.info(message, description ? { description } : undefined);
  },
};
