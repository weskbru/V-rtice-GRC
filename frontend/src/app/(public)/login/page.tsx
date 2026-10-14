import { Shield } from 'lucide-react';
import { redirect } from 'next/navigation';

import { VerticeSymbol } from '@/components/branding/vertice-symbol';
import { auth } from '@/lib/messages/auth';
import { fetchCurrentSession } from '@/lib/server-session';

import { LoginForm } from './login-form';
import styles from './login.module.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: auth.login.pageTitle,
};

function sanitizeReturnTo(value: string | undefined): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.includes('://')) {
    return value;
  }
  return '/dashboard';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const existingSession = await fetchCurrentSession();
  if (existingSession) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const rawReturnTo = params.returnTo;
  const returnTo = sanitizeReturnTo(typeof rawReturnTo === 'string' ? rawReturnTo : undefined);

  return (
    <main className={styles.page}>
      <div className={styles.visual} aria-hidden="true">
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
          <path d="M180 120 H340 L600 880 H440 Z" fill="#17324d" />
          <path d="M660 120 H820 L560 880 H440 Z" fill="#2878c8" opacity=".3" />
          <path
            d="M150 650 L520 280 L850 500"
            fill="none"
            stroke="#7eb4ee"
            strokeWidth="2"
            opacity=".24"
          />
          <circle cx="150" cy="650" r="7" fill="#7eb4ee" opacity=".6" />
          <circle cx="520" cy="280" r="7" fill="#7eb4ee" opacity=".6" />
          <circle cx="850" cy="500" r="7" fill="#7eb4ee" opacity=".6" />
        </svg>
      </div>
      <div className={styles.diagonal} aria-hidden="true" />
      <section className={styles.institutional} aria-label={auth.login.institutionalAriaLabel}>
        <div className={styles.content}>
          <header className={styles.brand}>
            <div className={styles.wordmark}>
              <VerticeSymbol className={styles.symbol} />
              <span>{auth.brand.name}</span>
            </div>
            <p className={styles.tagline}>{auth.brand.tagline}</p>
          </header>
          <div className={styles.intro}>
            <h2>{auth.login.slogan}</h2>
            <p>{auth.login.introduction}</p>
          </div>
          <div className={styles.card}>
            <h1>{auth.login.heading}</h1>
            <p className={styles.subheading}>{auth.login.subheading}</p>
            <LoginForm returnTo={returnTo} />
            <div className={styles.restricted}>{auth.login.restricted}</div>
            <div className={styles.provisioning}>
              <Shield aria-hidden="true" />
              <p>{auth.login.footer}</p>
            </div>
          </div>
        </div>
        <footer className={styles.signature}>
          <p>{auth.login.organization}</p>
          <p>{auth.login.signature}</p>
        </footer>
      </section>
      <aside className={styles.story} aria-labelledby="brand-story-heading">
        <p className={styles.eyebrow}>{auth.login.storyEyebrow}</p>
        <h2 id="brand-story-heading">{auth.login.storyHeading}</h2>
        <p>{auth.login.storyDescription}</p>
      </aside>
    </main>
  );
}
