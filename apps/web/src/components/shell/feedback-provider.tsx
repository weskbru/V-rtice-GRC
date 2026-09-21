'use client';

/**
 * PharosGRC application shell — feedback provider (T074, FR-044).
 *
 * The single, consistent notification mechanism for success, warning, error
 * and informational outcomes, used uniformly across every screen (FR-044,
 * FR-045). Mounted once at the root layout so it is available in both the
 * public (login) and authenticated trees.
 *
 * Every screen reports an outcome through the `feedback` object exported
 * below — never by importing `sonner`'s `toast` directly. That keeps one
 * place deciding how each kind of outcome looks and behaves, so a future
 * module gets the same feedback pattern for free instead of inventing its
 * own (Constitution X).
 */
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
      {/* `sonner` defaults `closeButtonAriaLabel`/`containerAriaLabel` to
       * English ("Close toast"/"Notifications") — real, documented props
       * (`closeButtonAriaLabel` on `ToastOptions`, nested under
       * `ToasterProps.toastOptions`; `containerAriaLabel` directly on
       * `ToasterProps`), overridden once here so every `feedback.*` call in
       * the application inherits pt-BR labels (CLAUDE.md §11.1; see
       * `common.toaster`'s own doc comment for the full account). */}
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

/** Platform-wide feedback API (FR-044). Prefer this over calling `sonner` directly. */
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
