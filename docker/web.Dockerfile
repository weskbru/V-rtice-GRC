ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /workspace

FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN pnpm fetch

FROM fetch AS build
COPY . .
RUN pnpm install --offline --frozen-lockfile
ENV DOCKER_BUILD=1

ARG API_INTERNAL_URL
ARG APP_ORIGIN
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV APP_ORIGIN=${APP_ORIGIN}
RUN pnpm --filter ./apps/web... run build

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S pharos && adduser -S pharos -G pharos

COPY --from=build --chown=pharos:pharos /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=pharos:pharos /workspace/apps/web/.next/static ./apps/web/.next/static

COPY --from=build --chown=pharos:pharos /workspace/apps/web/public ./apps/web/public

USER pharos
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
