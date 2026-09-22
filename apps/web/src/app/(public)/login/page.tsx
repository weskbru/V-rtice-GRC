/**
 * PharosGRC — login screen (T070, FR-047, SC-001).
 *
 * The first thing any user sees. Renders an accessible sign-in form
 * (`LoginForm`) inside a calm, enterprise card. A visitor who already holds
 * a valid session is sent straight to the dashboard rather than shown a
 * sign-in form they do not need (reuses the same server-side session check
 * `(app)/layout.tsx` uses, ADR-014).
 */
import { Shield } from 'lucide-react';
import { redirect } from 'next/navigation';

import { PharosSymbol } from '@/components/branding/pharos-symbol';
import { auth } from '@/lib/messages/auth';
import { fetchCurrentSession } from '@/lib/server-session';

import { LoginForm } from './login-form';
import styles from './login.module.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: auth.login.pageTitle,
};

/** Only a same-origin, absolute path is accepted — anything else falls back to `/dashboard` (never trust a redirect target from a query string). */
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
      <div className={styles.space} aria-hidden="true">
        <picture>
          <source
            media="(min-width: 900px)"
            srcSet="/brand/login/proteus-1280.webp 1280w, /brand/login/proteus-1672.webp 1672w"
            sizes="(max-width: 1199px) 100vw, 90vw"
            type="image/webp"
          />
          {/* A transparent fallback avoids downloading the decorative artwork on mobile. */}
          <img
            src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
            alt=""
            width={1672}
            height={941}
            decoding="async"
          />
        </picture>
      </div>
      <div className={styles.diagonal} aria-hidden="true" />
      <section className={styles.institutional} aria-label={auth.login.institutionalAriaLabel}>
        <div className={styles.content}>
          <header className={styles.brand}>
            <div className={styles.wordmark}>
              <PharosSymbol className={styles.symbol} />
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
          <p>{auth.login.institution}</p>
          <p>{auth.login.signature}</p>
        </footer>
      </section>
      <aside className={styles.story} aria-labelledby="proteus-heading">
        <p className={styles.eyebrow}>{auth.login.inspiredBy}</p>
        <h2 id="proteus-heading">{auth.login.proteus}</h2>
        <p>{auth.login.origin}</p>
      </aside>
    </main>
  );
}
