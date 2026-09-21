/**
 * apps/web environment validation (T048).
 *
 * Deliberately narrow: apps/web only ever needs `API_INTERNAL_URL` (the
 * ADR-014 rewrite target — server-side only, never exposed to the browser
 * bundle) and `APP_ORIGIN` (the base URL Playwright and any absolute-URL
 * construction use). Every other variable in `.env.example` belongs to
 * `apps/api/src/infrastructure/config/env.schema.ts`, which is the
 * authoritative, full-surface validator for the API process — this file is
 * not a competing copy of it, just the two names this process itself reads.
 *
 * Mirrors quickstart.md's naming (docs/local-environment.md D-5) and fails
 * loudly and synchronously: importing this module throws immediately if the
 * configuration is missing or malformed, so `next.config.ts` cannot silently
 * fall back to a wrong or hard-coded proxy target.
 */
import { z } from 'zod';

const webEnvSchema = z.object({
  API_INTERNAL_URL: z
    .string({
      message:
        'API_INTERNAL_URL is required (see .env.example) — the ADR-014 rewrite has no default target.',
    })
    .url('API_INTERNAL_URL must be a valid URL, e.g. http://localhost:3001'),
  APP_ORIGIN: z
    .string({ message: 'APP_ORIGIN is required (see .env.example).' })
    .url('APP_ORIGIN must be a valid URL, e.g. http://localhost:3000'),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * Validates `process.env` and returns the two variables apps/web needs.
 * Throws with every violation listed (not just the first) so a
 * misconfigured environment fails fast and completely.
 */
export function loadWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  const result = webEnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid apps/web environment configuration:\n${issues}`);
  }

  return result.data;
}
