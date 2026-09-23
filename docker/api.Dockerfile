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
RUN pnpm --filter ./apps/api exec prisma generate
RUN pnpm --filter ./apps/api... run build
RUN pnpm --filter ./apps/api deploy --prod --legacy /workspace/deploy/api

RUN mkdir -p /workspace/deploy/api/prisma \
    && cp apps/api/prisma/schema.prisma /workspace/deploy/api/prisma/schema.prisma \
    && /workspace/apps/api/node_modules/.bin/prisma generate \
       --schema=/workspace/deploy/api/prisma/schema.prisma

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S pharos && adduser -S pharos -G pharos \
    && mkdir -p /app/storage/attachments \
    && chown -R pharos:pharos /app

COPY --from=build --chown=pharos:pharos /workspace/deploy/api ./

USER pharos
EXPOSE 3001

CMD ["node", "dist/src/main.js"]
