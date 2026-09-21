# docker/web.Dockerfile
#
# Multi-stage build for the Next.js frontend (apps/web) inside the pnpm
# workspace (T012). Build context MUST be the repository root — see
# docker-compose.yml (`build.context: .`) — for the same pnpm-workspace
# reason as docker/api.Dockerfile.
#
# Produces and runs Next.js's "standalone" output
# (https://nextjs.org/docs/app/api-reference/config/next-config-js/output),
# which needs neither the full workspace node_modules tree nor the Next.js
# CLI at runtime. apps/web/next.config.ts only turns this on when
# DOCKER_BUILD=1 is set (see the build stage below) — the same `build` script
# run unconditionally on a native Windows dev machine was verified to fail
# outright (EPERM creating the symlinks standalone tracing needs, which
# requires a privilege this build's Linux container has but that Windows
# machine does not) — so this Dockerfile, not next.config.ts unconditionally,
# is what turns standalone output on.
#
# In a monorepo, Next.js's standalone output preserves the workspace-relative
# path (apps/web/server.js), which is why the runtime stage copies it to `/app`
# and runs `node apps/web/server.js` rather than `node server.js`.

ARG NODE_VERSION=22-alpine

# ---- base: shared tool setup -------------------------------------------------
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /workspace

# ---- fetch: populate the pnpm store from the lockfile only ------------------
FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN pnpm fetch

# ---- build: install the full workspace offline from the store, then build --
FROM fetch AS build
COPY . .
RUN pnpm install --offline --frozen-lockfile
# See the file header: apps/web/next.config.ts only sets output: "standalone"
# when this is set, so this container's build (and only this build) gets it.
ENV DOCKER_BUILD=1

# apps/web's rewrites() destination (ADR-014) is a Next.js config value, and
# Next resolves + serializes rewrites() into the build output once, at
# `next build` time — it is NOT re-read from the environment when
# server.js starts. `docker-compose.yml`'s `environment: API_INTERNAL_URL`
# for the `web` service therefore has NO effect on the browser-facing
# `/api/*` proxy target (verified: without this, the container silently
# rewrites to whatever value happened to be readable at build time —
# `apps/web/.env`, a developer's own local file that COPY . . brings into
# this stage despite .dockerignore's `.env`/`.env.*` rule, which does not
# actually exclude nested paths like apps/web/.env — see F-6 verification
# notes in docs/local-environment.md for the reproduction; that .dockerignore
# gap is a separate, unfixed finding). ARGs set here, not a copied .env file,
# are therefore the only reliable source for this build. Next.js's own env
# loading never overwrites a variable already present in `process.env`, so
# these ENV values win regardless of what COPY . . also brought in.
ARG API_INTERNAL_URL
ARG APP_ORIGIN
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV APP_ORIGIN=${APP_ORIGIN}
RUN pnpm --filter ./apps/web... run build

# ---- runtime: minimal image, non-root user, standalone server only ---------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S pharos && adduser -S pharos -G pharos

# The standalone output already contains a pruned node_modules tree; static
# assets are excluded from it by design and copied separately, per Next.js's
# documented deployment layout.
COPY --from=build --chown=pharos:pharos /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=pharos:pharos /workspace/apps/web/.next/static ./apps/web/.next/static

# apps/web/public/ holds real static assets (currently the brand SVGs under
# public/brand/, referenced from app/layout.tsx, app/(public)/login/page.tsx
# and components/shell/sidebar.tsx) that Next.js's standalone output does NOT
# include (see the runtime-stage comment above) — they must be copied
# separately, per Next.js's documented deployment layout. F-35: this line was
# previously commented out on the reasoning that public/ did not exist, and
# that reasoning silently went stale the moment a later phase added assets to
# it, leaving the built image serving a broken brand mark with nothing in the
# build/lint/test pipeline able to notice. Re-check before ever removing this
# line again: does `git ls-files apps/web/public` return anything? If yes,
# this COPY stays, regardless of why it was originally added.
COPY --from=build --chown=pharos:pharos /workspace/apps/web/public ./apps/web/public

USER pharos
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
