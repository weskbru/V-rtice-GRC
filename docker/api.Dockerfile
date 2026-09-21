# docker/api.Dockerfile
#
# Multi-stage build for the NestJS API (apps/api) inside the pnpm workspace
# (T012). Build context MUST be the repository root — see docker-compose.yml
# (`build.context: .`) — because a pnpm workspace needs the lockfile, the
# workspace manifest and every workspace package (packages/api-types, etc.)
# visible to `pnpm install`.
#
# MIGRATIONS ARE NOT RUN AUTOMATICALLY ON CONTAINER START. This image only
# serves the API (`node dist/src/main.js`). Applying the schema
# (`prisma migrate deploy`) is a documented, explicit, separate operator step
# (see quickstart.md section 2 and docker-compose.yml), run once per release.
#
# The `runtime` stage below ships only apps/api's PRODUCTION dependencies
# (`pnpm deploy --prod`) — neither `pnpm` itself nor the `prisma` CLI
# (a devDependency) is present in it, by design (see the rejected-alternative
# note below the second `prisma generate` call further down: shipping the CLI
# into the final image would grow it for a command this stage need not run).
# So migrations run from the HOST, with the pnpm/prisma toolchain already in
# this workspace, pointed at the database's published port — this is
# quickstart.md's primary documented path, not a workaround:
#   DATABASE_URL=postgresql://pharos_app:...@localhost:<published-port>/pharos_grc?schema=public \
#   DATABASE_MIGRATION_URL=postgresql://pharos_owner:...@localhost:<published-port>/pharos_grc?schema=public \
#   pnpm --filter ./apps/api exec prisma migrate deploy
# (run from the monorepo root; substitute the actual POSTGRES_HOST_PORT).
# `docker compose exec api pnpm exec prisma migrate deploy` — sometimes cited
# as a container-native alternative — does NOT work against this image for
# the same reason: verified during the F-12/F-13 production-readiness pass.
#
# Not running migrations from inside the container is deliberate, not an
# oversight, independent of the above:
#   - the owner/migration role (DATABASE_MIGRATION_URL, ADR-005) must only
#     ever be used from an operator-invoked, short-lived command — never
#     embedded in the entrypoint of a container that also serves traffic;
#   - a rolling restart or a horizontally scaled `api` service must never
#     race a schema migration against itself;
#   - a failed migration must not crash-loop a container that would otherwise
#     serve the previous, still-working schema.

ARG NODE_VERSION=22-alpine

# ---- base: shared tool setup -------------------------------------------------
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /workspace

# ---- fetch: populate the pnpm content-addressable store from the lockfile
# only, so this layer is cached until the lockfile itself changes.
FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN pnpm fetch

# ---- build: install the full workspace offline from the store, compile the
# API, generate the Prisma client, then prune to a self-contained,
# production-only deployment of apps/api.
FROM fetch AS build
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm --filter ./apps/api exec prisma generate
RUN pnpm --filter ./apps/api... run build
# `pnpm deploy` produces a standalone directory containing only apps/api's
# production dependencies and its own workspace dependencies (e.g.
# packages/api-types) — no dev dependencies, no other workspace app.
# --legacy: pnpm v10 defaults to requiring `inject-workspace-packages=true`
# in .npmrc (hardlinked/injected workspace deps) for `deploy`, which this
# workspace does not set; without it, `deploy` fails outright with
# ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE. The legacy algorithm (resolving the
# existing symlinked workspace deps into real copies) is exactly what a
# single Dockerfile RUN step needs here and requires no workspace-wide
# .npmrc change that would also affect local development.
RUN pnpm --filter ./apps/api deploy --prod --legacy /workspace/deploy/api

# F-12: `pnpm deploy --legacy` re-resolves /workspace/deploy/api's dependency
# tree from pnpm's content-addressable store rather than cloning this
# stage's current node_modules, so it does NOT carry over the `.prisma/client`
# directory the `prisma generate` step above wrote into the *workspace's* own
# pnpm virtual store (`.pnpm/@prisma+client@.../node_modules/.prisma/client`).
# `@prisma/client` (a regular, deployed dependency) requires
# `.prisma/client/default` via ordinary Node module resolution, so without
# that directory present as a sibling of `@prisma/client` inside the deploy
# output, the runtime image crash-loops before it can serve a single request.
#
# Fix: regenerate the client a second time, this time targeting the deploy
# output directly, so Prisma's own module-resolution-based placement writes
# `.prisma/client` exactly where the deployed `@prisma/client` expects it.
# schema.prisma is copied in explicitly rather than relied upon as an
# incidental side effect of `pnpm deploy`'s file selection, so this step does
# not depend on packaging behavior that could silently change.
#
# Rejected alternatives:
#   - Copying the already-generated `.prisma/client` directory from the
#     workspace virtual store into the deploy output (`COPY --from=build
#     .pnpm/@prisma+client@.../node_modules/.prisma/client ...`): brittle,
#     because that path is keyed by the exact resolved version string in
#     pnpm's virtual store layout and would silently need updating on every
#     `@prisma/client` version bump — the very kind of drift this fix must
#     avoid.
#   - Dropping `--legacy` / using `inject-workspace-packages=true` instead:
#     changes `.npmrc` workspace-wide, affecting local development's install
#     behavior for a problem that is specific to this one Docker build step.
#   - Regenerating inside the `runtime` stage: would require shipping the
#     `prisma` CLI (a devDependency, pulling in its own toolchain) into the
#     final image, growing its size and attack surface, for no benefit over
#     doing the same generation here in the stage that is discarded after
#     build. This approach also costs no extra build time worth mentioning —
#     it reuses the engine binaries already fetched offline for the first
#     `generate` call above, so no network access is repeated — and it uses
#     the exact same schema.prisma as that first call, so the two client
#     copies cannot drift from each other or from the schema.
RUN mkdir -p /workspace/deploy/api/prisma \
    && cp apps/api/prisma/schema.prisma /workspace/deploy/api/prisma/schema.prisma \
    && /workspace/apps/api/node_modules/.bin/prisma generate \
       --schema=/workspace/deploy/api/prisma/schema.prisma

# ---- runtime: minimal image, no build toolchain, non-root user --------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root runtime user. The attachment storage directory (ADR-010,
# FileStorageProvider local adapter) is created and owned here so the
# container never needs root to write uploads.
RUN addgroup -S pharos && adduser -S pharos -G pharos \
    && mkdir -p /app/storage/attachments \
    && chown -R pharos:pharos /app

COPY --from=build --chown=pharos:pharos /workspace/deploy/api ./

USER pharos
EXPOSE 3001

# apps/api/tsconfig.json sets rootDir: "./" (not "./src"), so `nest build`
# preserves the source subdirectory and emits to dist/src/main.js, not
# dist/main.js.
CMD ["node", "dist/src/main.js"]
