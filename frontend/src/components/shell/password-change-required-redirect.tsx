'use client';

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
