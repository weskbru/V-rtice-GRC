import { FeedbackProvider } from '@/components/shell/feedback-provider';
import { ThemeProvider } from '@/components/shell/theme-provider';

import '../styles/globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PharosGRC',
  description: 'PharosGRC — plataforma corporativa de Governança, Riscos e Compliance',
  icons: {
    icon: '/brand/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    // `suppressHydrationWarning` is required by next-themes (ThemeProvider):
    // its blocking pre-hydration script sets `class` on this element from
    // the persisted/system preference, which will not match what the server
    // rendered (the server cannot know it) — without this, React logs a
    // spurious hydration mismatch warning for a class it never controls.
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
