'use client';

/**
 * PharosGRC application shell — mandatory-password-change redirect seam
 * (S-01).
 *
 * Registers itself as the `api-client.ts` `setPasswordChangeRequiredHandler`
 * seam for the lifetime of the authenticated shell, mirroring
 * `SessionExpiredDialog`'s own registration pattern for its 401 seam. On
 * the new `PasswordChangeRequiredDomainError` (403) the API now raises for
 * any non-exempt route while the caller's password change is pending
 * (`MandatoryPasswordChangeGuard`), this redirects to the screen that
 * actually resolves it rather than letting the page that made the call
 * render a generic, dead-end error.
 *
 * Renders nothing — unlike `SessionExpiredDialog`, there is no in-place
 * recovery to offer here (a redirect IS the recovery): the mandatory
 * change must be completed on `/profile` before anything else in the
 * platform is usable again.
 */
import { useEffect } from 'react';

import { useNavigate } from '@/components/shell/navigation-pending';
import { setPasswordChangeRequiredHandler } from '@/lib/api-client';

export function PasswordChangeRequiredRedirect(): null {
  const navigate = useNavigate();

  useEffect(() => {
    setPasswordChangeRequiredHandler(() => {
      navigate('/profile?mustChangePassword=true', { replace: true });
    });
    return () => setPasswordChangeRequiredHandler(null);
  }, [navigate]);

  return null;
}
