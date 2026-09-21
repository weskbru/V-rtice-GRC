/**
 * Prisma CLI configuration (T014/T042). Replaces the deprecated
 * `package.json#prisma` key. Loaded automatically by `prisma generate`,
 * `prisma migrate` and `prisma db seed`. Deliberately does not set
 * `datasource.url` here — the schema's own `env("DATABASE_URL")` /
 * `env("DATABASE_MIGRATION_URL")` already resolve those from `apps/api/.env`
 * (loaded by Prisma's own dotenv support), matching how `PrismaService`
 * reads them via `AppConfigService` at runtime.
 *
 * `seed` runs via `ts-node --transpile-only`, NOT `tsx` (T042 changed this
 * from the T014 placeholder): `prisma/seed/index.ts` bootstraps a real
 * NestJS application context to reuse `AppConfigService`/`PrismaService`
 * exactly as the running application does (see that file's header) —
 * NestJS's constructor-injection DI depends on `design:paramtypes`
 * metadata that `emitDecoratorMetadata` writes into compiler output.
 * `tsx` is esbuild-based, and esbuild does not implement
 * `emitDecoratorMetadata` at all, so every constructor parameter Nest
 * tried to inject resolved to `undefined` (confirmed empirically: the
 * seed script crashed inside `PrismaService`'s constructor reading
 * `appConfig.database` off an `undefined` `appConfig`). `ts-node` uses the
 * real TypeScript transpiler, which DOES honor `emitDecoratorMetadata`
 * from `tsconfig.json` (`experimentalDecorators`/`emitDecoratorMetadata`
 * are both `true` there) — the same tool already trusted for
 * `scripts/generate-openapi.ts`/`scripts/check-openapi.ts` in this
 * package's own `openapi:generate`/`openapi:check` scripts.
 */
import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed/index.ts',
  },
});
