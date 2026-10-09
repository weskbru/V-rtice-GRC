import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvConfig } from './env.schema';

export interface AppSettings {
  readonly nodeEnv: EnvConfig['NODE_ENV'];
  readonly isProduction: boolean;
  readonly apiPort: number;
  readonly webPort: number;
  readonly apiInternalUrl: string;
  readonly appOrigin: string;
}

export interface DatabaseSettings {
  readonly url: string;
  readonly migrationUrl: string | undefined;
  readonly testUrl: string | undefined;
  readonly testMigrationUrl: string | undefined;
}

export interface CacheSettings {
  readonly redisUrl: string | undefined;
}

export interface SessionSettings {
  readonly cookieName: string;
  readonly cookieSecure: boolean;
  readonly cookieSameSite: 'lax' | 'strict' | 'none';
  readonly idleTimeoutMinutes: number;
  readonly absoluteLifetimeHours: number;
}

export interface PasswordPolicySettings {
  readonly minLength: number;
  readonly requireComplexity: boolean;
}

export interface Argon2Settings {
  readonly memoryCost: number;
  readonly timeCost: number;
  readonly parallelism: number;
}

export interface LoggingSettings {
  readonly level: EnvConfig['LOG_LEVEL'];
  readonly pretty: boolean;
}

export interface ThrottleSettings {
  readonly ttlSeconds: number;
  readonly limit: number;
}

export interface AuthRateLimitSettings {
  readonly accountAttempts: number;
  readonly originAttempts: number;
  readonly windowSeconds: number;
  readonly lockoutMinutes: number;
}

export interface AttachmentSettings {
  readonly storageDriver: 'local';
  readonly storagePath: string;
  readonly maxSizeBytes: number;
  readonly allowedMimeTypes: readonly string[];
}

export interface SeedSettings {
  readonly devFixtures: boolean;
  readonly adminEmail: string;
  readonly adminPassword: string;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  private get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.configService.get(key, { infer: true });
  }

  get app(): AppSettings {
    const nodeEnv = this.get('NODE_ENV');

    return {
      nodeEnv,
      isProduction: nodeEnv === 'production',
      apiPort: this.get('API_PORT'),
      webPort: this.get('WEB_PORT'),
      apiInternalUrl: this.get('API_INTERNAL_URL'),
      appOrigin: this.get('APP_ORIGIN'),
    };
  }

  get database(): DatabaseSettings {
    return {
      url: this.get('DATABASE_URL'),
      migrationUrl: this.get('DATABASE_MIGRATION_URL'),
      testUrl: this.get('TEST_DATABASE_URL'),
      testMigrationUrl: this.get('TEST_DATABASE_MIGRATION_URL'),
    };
  }

  get cache(): CacheSettings {
    return {
      redisUrl: this.get('REDIS_URL'),
    };
  }

  get session(): SessionSettings {
    return {
      cookieName: this.get('SESSION_COOKIE_NAME'),
      cookieSecure: this.get('SESSION_COOKIE_SECURE'),
      cookieSameSite: this.get('SESSION_COOKIE_SAMESITE'),
      idleTimeoutMinutes: this.get('SESSION_IDLE_TIMEOUT_MINUTES'),
      absoluteLifetimeHours: this.get('SESSION_ABSOLUTE_LIFETIME_HOURS'),
    };
  }

  get passwordPolicy(): PasswordPolicySettings {
    return {
      minLength: this.get('PASSWORD_MIN_LENGTH'),
      requireComplexity: this.get('PASSWORD_REQUIRE_COMPLEXITY'),
    };
  }

  get argon2(): Argon2Settings {
    return {
      memoryCost: this.get('ARGON2_MEMORY_COST'),
      timeCost: this.get('ARGON2_TIME_COST'),
      parallelism: this.get('ARGON2_PARALLELISM'),
    };
  }

  get logging(): LoggingSettings {
    return {
      level: this.get('LOG_LEVEL'),
      pretty: this.get('LOG_PRETTY'),
    };
  }

  get throttle(): ThrottleSettings {
    return {
      ttlSeconds: this.get('THROTTLE_TTL_SECONDS'),
      limit: this.get('THROTTLE_LIMIT'),
    };
  }

  get authRateLimit(): AuthRateLimitSettings {
    return {
      accountAttempts: this.get('AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS'),
      originAttempts: this.get('AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS'),
      windowSeconds: this.get('AUTH_RATE_LIMIT_WINDOW_SECONDS'),
      lockoutMinutes: this.get('AUTH_LOCKOUT_MINUTES'),
    };
  }

  get attachment(): AttachmentSettings {
    return {
      storageDriver: this.get('ATTACHMENT_STORAGE_DRIVER'),
      storagePath: this.get('ATTACHMENT_STORAGE_PATH'),
      maxSizeBytes: this.get('ATTACHMENT_MAX_SIZE_BYTES'),
      allowedMimeTypes: this.get('ATTACHMENT_ALLOWED_MIME_TYPES'),
    };
  }

  get seed(): SeedSettings {
    return {
      devFixtures: this.get('SEED_DEV_FIXTURES'),
      adminEmail: this.get('SEED_ADMIN_EMAIL'),
      adminPassword: this.get('SEED_ADMIN_PASSWORD'),
    };
  }
}
