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
