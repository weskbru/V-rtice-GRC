import { z } from 'zod';

function booleanFlag() {
  return z.enum(['true', 'false']).transform((value) => value === 'true');
}

function portNumber() {
  return z.coerce.number().int().min(1).max(65535);
}

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVIRONMENTS),
    API_PORT: portNumber(),
    WEB_PORT: portNumber(),
    API_INTERNAL_URL: z.string().url(),
    APP_ORIGIN: z.string().url(),

    DATABASE_URL: z.string().min(1),
    DATABASE_MIGRATION_URL: z.string().min(1).optional(),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    TEST_DATABASE_MIGRATION_URL: z.string().min(1).optional(),

    REDIS_URL: z
      .string()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),

    SESSION_COOKIE_NAME: z.string().min(1),
    SESSION_COOKIE_SECURE: booleanFlag(),
    SESSION_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']),
    SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(1440),
    SESSION_ABSOLUTE_LIFETIME_HOURS: z.coerce.number().int().min(1).max(720),

    PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128),
    PASSWORD_REQUIRE_COMPLEXITY: booleanFlag(),

    ARGON2_MEMORY_COST: z.coerce.number().int().min(8192),
    ARGON2_TIME_COST: z.coerce.number().int().min(1),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
    LOG_PRETTY: booleanFlag(),

    THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1),
    THROTTLE_LIMIT: z.coerce.number().int().min(1),
    AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS: z.coerce.number().int().min(1),
    AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS: z.coerce.number().int().min(1),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1),

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

    SEED_DEV_FIXTURES: booleanFlag(),
    SEED_ADMIN_EMAIL: z.string().email(),
    SEED_ADMIN_PASSWORD: z.string().optional().default(''),

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
    if (config.NODE_ENV === 'production' && !config.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when NODE_ENV=production (D-2).',
      });
    }

    if (config.NODE_ENV === 'production' && !config.SESSION_COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_COOKIE_SECURE'],
        message: 'SESSION_COOKIE_SECURE must be true when NODE_ENV=production.',
      });
    }

    if (
      config.DATABASE_MIGRATION_URL !== undefined &&
      config.DATABASE_URL === config.DATABASE_MIGRATION_URL
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_MIGRATION_URL'],
        message:
          'DATABASE_URL and DATABASE_MIGRATION_URL must be distinct (ADR-005: the application ' +
          'role must never be the migration/owner role).',
      });
    }

    if (
      config.TEST_DATABASE_MIGRATION_URL !== undefined &&
      config.TEST_DATABASE_URL === config.TEST_DATABASE_MIGRATION_URL
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_MIGRATION_URL'],
        message: 'TEST_DATABASE_URL and TEST_DATABASE_MIGRATION_URL must be distinct (ADR-005).',
      });
    }

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
