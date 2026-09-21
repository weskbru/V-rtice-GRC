/**
 * Environment schema (T015).
 *
 * This is the ONLY file in the codebase permitted to read `process.env`
 * (working rule #2 for T014-T025). Every other file must obtain
 * configuration through `AppConfigService` (see `app-config.service.ts`),
 * never through `process.env` directly.
 *
 * `envSchema` validates every variable documented in `.env.example`, using
 * exactly the names `.env.example` uses (`.env.example` is generated from
 * `specs/001-grc-platform-foundation/quickstart.md`, the authoritative
 * naming source — see docs/local-environment.md D-5). `validateEnv` is
 * passed to `ConfigModule.forRoot({ validate })` so an invalid configuration
 * throws during Nest's bootstrap phase — the process never starts serving
 * traffic with a configuration it cannot trust (constitution §12, §13).
 *
 * Notable cross-field rules, each a coordinator decision recorded in
 * docs/local-environment.md:
 *   - D-2: `REDIS_URL` is optional in development/test, but REQUIRED and
 *     non-empty when `NODE_ENV=production` — the in-memory cache adapter
 *     would give a multi-instance production deployment an inconsistent
 *     view of sessions/permissions/scope.
 *   - `SESSION_COOKIE_SECURE` must be `true` whenever `NODE_ENV=production`
 *     — a session cookie without `Secure` in production is a credential
 *     leak over any accidental plaintext hop.
 *   - `DATABASE_URL` (restricted `pharos_app` role) and
 *     `DATABASE_MIGRATION_URL` (owner `pharos_owner` role) must be set and
 *     must differ — ADR-005's append-only guarantee on `audit_event` only
 *     holds if the running application never connects with the owner role.
 *   - D-6: `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS` / `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS`
 *     replace the single `AUTH_RATE_LIMIT_ATTEMPTS` that `.env.example`
 *     briefly had — a shared corporate NAT must not be locked out by a
 *     handful of individual mistyped passwords, so the origin ceiling must
 *     be at least as high as the account ceiling.
 *
 * The Docker-Compose-only variables (`POSTGRES_HOST_PORT`,
 * `POSTGRES_OWNER_PASSWORD`, ...) are still declared here so every name in
 * `.env.example` is accounted for and typo-checked, but they are read by
 * `docker-compose.yml`/`docker-compose.test.yml`, never by this Node
 * process, so they stay optional and are not exposed through
 * `AppConfigService`.
 */
import { z } from 'zod';

/**
 * `.env` values are always strings. `z.coerce.boolean()` is deliberately
 * NOT used for `true`/`false` flags: `Boolean("false")` is `true` in
 * JavaScript, so zod's built-in boolean coercion would accept
 * `SOME_FLAG=false` and silently turn it into `true`. This helper accepts
 * only the literal strings `"true"`/`"false"`.
 */
function booleanFlag() {
  return z.enum(['true', 'false']).transform((value) => value === 'true');
}

function portNumber() {
  return z.coerce.number().int().min(1).max(65535);
}

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export const envSchema = z
  .object({
    // -------------------------------------------------------------------
    // Application / runtime
    // -------------------------------------------------------------------
    NODE_ENV: z.enum(NODE_ENVIRONMENTS),
    API_PORT: portNumber(),
    WEB_PORT: portNumber(),
    API_INTERNAL_URL: z.string().url(),
    APP_ORIGIN: z.string().url(),

    // -------------------------------------------------------------------
    // Database — PostgreSQL (ADR-005)
    // -------------------------------------------------------------------
    DATABASE_URL: z.string().min(1),
    DATABASE_MIGRATION_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1),
    TEST_DATABASE_MIGRATION_URL: z.string().min(1),

    // -------------------------------------------------------------------
    // Cache — Redis (D-2). Optional; empty string is treated as absent.
    // -------------------------------------------------------------------
    REDIS_URL: z
      .string()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),

    // -------------------------------------------------------------------
    // Sessions (ADR-002)
    // -------------------------------------------------------------------
    SESSION_COOKIE_NAME: z.string().min(1),
    SESSION_COOKIE_SECURE: booleanFlag(),
    SESSION_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']),
    // Sliding inactivity expiry (FR-014), runtime-configurable within sane
    // bounds: at least 1 minute, at most 24 hours.
    SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(1440),
    // Absolute session lifetime (FR-014), runtime-configurable within sane
    // bounds: at least 1 hour, at most 30 days.
    SESSION_ABSOLUTE_LIFETIME_HOURS: z.coerce.number().int().min(1).max(720),

    // -------------------------------------------------------------------
    // Password policy (FR-006)
    // -------------------------------------------------------------------
    PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128),
    PASSWORD_REQUIRE_COMPLEXITY: booleanFlag(),

    // -------------------------------------------------------------------
    // Password hashing — argon2id (ADR-001)
    // -------------------------------------------------------------------
    ARGON2_MEMORY_COST: z.coerce.number().int().min(8192),
    ARGON2_TIME_COST: z.coerce.number().int().min(1),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1),

    // -------------------------------------------------------------------
    // Logging (ADR-012)
    // -------------------------------------------------------------------
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
    LOG_PRETTY: booleanFlag(),

    // -------------------------------------------------------------------
    // Rate limiting and authentication throttling (T066, FR-008, D-6)
    // -------------------------------------------------------------------
    THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1),
    THROTTLE_LIMIT: z.coerce.number().int().min(1),
    AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS: z.coerce.number().int().min(1),
    AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS: z.coerce.number().int().min(1),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1),

    // -------------------------------------------------------------------
    // Attachment storage (ADR-010)
    // -------------------------------------------------------------------
    ATTACHMENT_STORAGE_DRIVER: z.enum(['local']),
    ATTACHMENT_STORAGE_PATH: z.string().min(1),
    ATTACHMENT_MAX_SIZE_BYTES: z.coerce.number().int().min(1),
    ATTACHMENT_ALLOWED_MIME_TYPES: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((mime) => mime.trim())
          .filter((mime) => mime.length > 0),
      ),

    // -------------------------------------------------------------------
    // Seed data (T042)
    // -------------------------------------------------------------------
    SEED_DEV_FIXTURES: booleanFlag(),
    SEED_ADMIN_EMAIL: z.string().email(),
    // Intentionally not `.min(...)` here: an absent seed password must fail
    // the seed script itself (T042), not environment validation, since the
    // API process boots fine without ever running the seed.
    SEED_ADMIN_PASSWORD: z.string().optional().default(''),

    // -------------------------------------------------------------------
    // Docker Compose only — not read by this process. Declared so every
    // `.env.example` name is accounted for; not exposed via AppConfigService.
    // -------------------------------------------------------------------
    POSTGRES_HOST_PORT: portNumber().optional(),
    REDIS_HOST_PORT: portNumber().optional(),
    TEST_POSTGRES_HOST_PORT: portNumber().optional(),
    TEST_REDIS_HOST_PORT: portNumber().optional(),
    POSTGRES_DB: z.string().optional(),
    TEST_POSTGRES_DB: z.string().optional(),
    POSTGRES_SUPERUSER_PASSWORD: z.string().optional(),
    POSTGRES_OWNER_USER: z.string().optional(),
    POSTGRES_OWNER_PASSWORD: z.string().optional(),
    POSTGRES_APP_USER: z.string().optional(),
    POSTGRES_APP_PASSWORD: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    // D-2: production requires Redis — the in-memory cache adapter is a
    // single-process fallback only, unsafe for a multi-instance deployment.
    if (config.NODE_ENV === 'production' && !config.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when NODE_ENV=production (D-2).',
      });
    }

    // A session cookie without Secure in production is a credential leak
    // over any accidental plaintext hop.
    if (config.NODE_ENV === 'production' && !config.SESSION_COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_COOKIE_SECURE'],
        message: 'SESSION_COOKIE_SECURE must be true when NODE_ENV=production.',
      });
    }

    // ADR-005: the application must never connect with the owner/migration
    // role. Requiring the two URLs to differ is a cheap guard against a
    // copy-paste misconfiguration that would otherwise defeat the
    // append-only guarantee on audit_event silently.
    if (config.DATABASE_URL === config.DATABASE_MIGRATION_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_MIGRATION_URL'],
        message:
          'DATABASE_URL and DATABASE_MIGRATION_URL must be distinct (ADR-005: the application ' +
          'role must never be the migration/owner role).',
      });
    }

    if (config.TEST_DATABASE_URL === config.TEST_DATABASE_MIGRATION_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_MIGRATION_URL'],
        message: 'TEST_DATABASE_URL and TEST_DATABASE_MIGRATION_URL must be distinct (ADR-005).',
      });
    }

    // D-6: the per-origin ceiling exists precisely to stay above the
    // per-account ceiling, so a shared NAT is not locked out by a handful
    // of individually mistyped passwords. A configuration that inverts this
    // has defeated the reason the split exists.
    if (config.AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS < config.AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS'],
        message:
          'AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS must be >= AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS (D-6).',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Passed to `ConfigModule.forRoot({ validate })`. Throws a single
 * `Error` with every violation listed (not just the first) so a
 * misconfigured environment fails fast, at boot, with a complete report.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
