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
