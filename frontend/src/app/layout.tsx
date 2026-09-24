import { FeedbackProvider } from '@/components/shell/feedback-provider';
import { ThemeProvider } from '@/components/shell/theme-provider';

import '../styles/globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PharosGRC',
  description: 'PharosGRC — plataforma corporativa de Governança, Riscos e Compliance',
  icons: {
    icon: [
      {
        url: '/brand/pharos/favicon.ico',
        sizes: '16x16 32x32 48x48 96x96 128x128',
        type: 'image/x-icon',
      },
      { url: '/brand/pharos/symbol-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/pharos/symbol-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/pharos/symbol-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/brand/pharos/symbol-128.png', sizes: '128x128', type: 'image/png' },
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
