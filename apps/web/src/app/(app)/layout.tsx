/**
 * PharosGRC — authenticated application shell (T072, FR-039).
 *
 * Every route under `(app)/` renders inside this shell. Session resolution
 * happens here, server-side, forwarding the incoming request's cookie
 * (ADR-014) — an unauthenticated request never renders a single pixel of
 * protected content; it is redirected to `/login` before this component
 * returns anything.
 *
 * A future GRC module adds a route under `(app)/` and a `navigationRegistry`
 * entry (T071); this file does not change.
 */
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell/app-shell';
import { fetchCurrentSession } from '@/lib/server-session';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const session = await fetchCurrentSession();

  if (!session) {
    redirect('/login');
  }

  return <AppShell session={session}>{children}</AppShell>;
}
