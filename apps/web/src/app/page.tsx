/**
 * PharosGRC — root route (assurance-audit Fix 4).
 *
 * Previously rendered a static placeholder heading and a literal pt-BR
 * sentence embedded directly in the component ("Estrutura inicial da
 * plataforma — Governança, Riscos e Compliance."), reachable at `/` with
 * NO auth guard — leftover project scaffolding from before `(app)/` and
 * `(public)/login` existed, never replaced.
 *
 * `/` has no content of its own to protect or present: every real
 * destination already lives under `(app)/` (session-gated, redirects to
 * `/login`) or `(public)/login` (redirects an already-authenticated
 * visitor straight to `/dashboard`, ADR-014). Routing straight to
 * `/login` here reuses that existing, already-tested decision rather than
 * re-implementing a second server-side session check just to decide
 * between `/dashboard` and `/login` — and removes the inline string
 * entirely rather than moving it to a message catalog for a page that has
 * no user-facing text left to translate.
 */
import { redirect } from 'next/navigation';

export default function HomePage(): never {
  redirect('/login');
}
