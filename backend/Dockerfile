ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /workspace

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY backend ./backend
COPY database/prisma ./database/prisma
COPY packages/api-types ./packages/api-types
# Agrupa as etapas para evitar snapshots intermediários das dependências.
RUN pnpm --filter ./backend... install --frozen-lockfile \
    && pnpm --filter ./backend run db:generate \
    && pnpm --filter ./backend... run build \
    && pnpm --filter ./backend deploy --prod --legacy /workspace/deploy/api \
    && mkdir -p /workspace/deploy/api/prisma \
    && cp database/prisma/schema.prisma /workspace/deploy/api/prisma/schema.prisma \
    && /workspace/backend/node_modules/.bin/prisma generate \
       --schema=/workspace/deploy/api/prisma/schema.prisma

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S vertice && adduser -S vertice -G vertice \
    && mkdir -p /app/storage/attachments \
    && chown -R vertice:vertice /app

COPY --from=build --chown=vertice:vertice /workspace/deploy/api ./

USER vertice
EXPOSE 3001

CMD ["node", "dist/src/main.js"]
