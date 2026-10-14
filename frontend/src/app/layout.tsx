import { FeedbackProvider } from '@/components/shell/feedback-provider';
import { ThemeProvider } from '@/components/shell/theme-provider';
import { auth } from '@/lib/messages/auth';

import '../styles/globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: auth.brand.name,
  description: auth.brand.description,
  icons: {
    icon: [
      {
        url: '/brand/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
