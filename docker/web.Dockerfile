ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /workspace

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY frontend ./frontend
COPY packages/api-types ./packages/api-types
ENV DOCKER_BUILD=1

ARG API_INTERNAL_URL
ARG APP_ORIGIN
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV APP_ORIGIN=${APP_ORIGIN}
# Agrupa instalação e build para evitar snapshots intermediários.
RUN pnpm --filter '@pharos/web...' install --frozen-lockfile \
    && pnpm --filter '@pharos/web...' run build

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S pharos && adduser -S pharos -G pharos

COPY --from=build --chown=pharos:pharos /workspace/frontend/.next/standalone ./
COPY --from=build --chown=pharos:pharos /workspace/frontend/.next/static ./frontend/.next/static

COPY --from=build --chown=pharos:pharos /workspace/frontend/public ./frontend/public

USER pharos
EXPOSE 3000

CMD ["node", "frontend/server.js"]
