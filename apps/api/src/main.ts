import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfigService } from './infrastructure/config/app-config.service';
import { API_GLOBAL_PREFIX } from './infrastructure/http/api-prefix';
import { NestLoggerAdapter } from './infrastructure/logging/nest-logger.adapter';

import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Number of reverse-proxy hops between the client and this process to
 * trust for `X-Forwarded-For`/`X-Forwarded-Proto` (ADR-014): exactly one —
 * the single-origin Next.js proxy (dev rewrites) or the equivalent reverse
 * proxy in front of both applications in production. `req.ip` (read into
 * `RequestContext.ipAddress`, T019, and from there into every audit entry
 * and security log line) is only correct with this set explicitly; Express
 * ignores `X-Forwarded-For` entirely by default. If a future deployment
 * adds another hop (e.g. a CDN) in front of that proxy, this number must
 * grow to match it — trusting more hops than actually exist lets a client
 * spoof its own IP by forging the header.
 */
const TRUSTED_PROXY_HOPS = 1;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Buffer Nest's own bootstrap log lines until the structured pino
    // logger (ADR-012) is ready to take over, a few lines down.
    bufferLogs: true,
  });

  app.useLogger(app.get(NestLoggerAdapter));

  app.set('trust proxy', TRUSTED_PROXY_HOPS);

  // Express auto-generates a weak, content-hash `ETag` on any JSON response
  // whose handler did not already set one explicitly (`res.send`'s own
  // `generateETag` branch) — harmless in isolation (it hashes the exact
  // bytes sent, so it cannot go stale the way a version-scoped one can),
  // but this app's frontend (`apps/web/src/features/{controls,compliance}
  // /api.ts`'s `resolveEtag`) treats ANY non-null `ETag` on a `GET` as the
  // resource's concurrency token and echoes it verbatim in the next
  // mutation's `If-Match` — an auto-generated hash is not that, and would
  // make every such follow-up write fail with 400 `ifMatchInvalid`. This
  // surfaced concretely fixing `RequirementController.findById`/
  // `ControlController.findById` (`complianceState`/`effectiveness` are
  // derived at read time and must never carry a version-based `ETag` at
  // all — see those handlers' own doc comments): removing the manual,
  // dishonest `ETag` there was not enough on its own; Express's automatic
  // one would have silently taken its place. Disabled globally rather than
  // per-route because Express exposes no clean per-response way to opt
  // out, and no `ETag` this app actually wants is affected — every
  // endpoint that wants one already sets it explicitly (`formatETag`,
  // ADR-013), and setting one always short-circuits the auto branch
  // regardless of this setting.
  app.set('etag', false);

  // Security headers (T024). The exception filter (T021) already sets
  // `application/problem+json` responses itself; helmet's defaults cover
  // the rest (HSTS, frame options, no-sniff, referrer policy, etc.).
  app.use(helmet());

  app.setGlobalPrefix(API_GLOBAL_PREFIX);

  // The global ValidationPipe (T022) and the global exception filter (T021)
  // are registered as APP_PIPE/APP_FILTER providers in AppModule, not here —
  // ProblemDetailsFilter needs AppLogger injected, which only a Nest
  // provider (not a manually-constructed instance passed to
  // `useGlobalFilters`) resolves from the DI container. Global rate
  // limiting (@nestjs/throttler, T024) is likewise registered as an
  // APP_GUARD provider in AppModule, budget driven by `THROTTLE_TTL_SECONDS`
  // / `THROTTLE_LIMIT` via `AppConfigService`.

  const appConfig = app.get(AppConfigService);

  await app.listen(appConfig.app.apiPort);
}

void bootstrap();
