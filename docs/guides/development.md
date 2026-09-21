# Desenvolvimento — PharosGRC

> Idioma: este arquivo é a referência de desenvolvimento e é escrito em português do Brasil, por
> decisão dos escritores de documentação desta iniciativa (identificadores técnicos permanecem em
> inglês, conforme CLAUDE.md §11.1). `docs/local-environment.md` (registro de decisões datado e
> armadilhas de ambiente) e `specs/001-grc-platform-foundation/quickstart.md` (roteiro histórico de
> validação da Fase 001) permanecem em inglês — não foram traduzidos, apenas referenciados aqui.

Este é o guia de referência para configurar o ambiente e desenvolver no dia a dia no PharosGRC,
partindo de uma máquina limpa com apenas acesso ao Git e segredos fornecidos separadamente.

Documentos relacionados:

- [`docs/architecture.md`](../architecture.md) — limites de módulo, pontos de extensão, exemplo
  completo de como adicionar um módulo de negócio.
- [`docs/architecture/database.md`](../architecture/database.md) — modelo de dados, migrações, política de seed.
- [`docs/architecture/security.md`](../architecture/security.md) — autenticação, autorização, sessões, segurança.
- [`docs/architecture/frontend.md`](../architecture/frontend.md) — arquitetura de `apps/web`, Design System, features.
- [`docs/guides/testing.md`](./testing.md) — estratégia de testes e CI em detalhe.
- [`docs/guides/troubleshooting.md`](./troubleshooting.md) — sintomas conhecidos e suas causas.
- [`docs/local-environment.md`](../local-environment.md) — registro datado de decisões de ambiente
  (D-1..D-23) e armadilhas já pagas; leia antes de rodar qualquer comando pela primeira vez.
- [`specs/001-grc-platform-foundation/quickstart.md`](../../specs/001-grc-platform-foundation/quickstart.md)
  — roteiro histórico de validação da Fase 001 (cenários de aceite por user story).

---

## 1. Requisitos

| Item | Versão | Observação |
|---|---|---|
| Node.js | **22** (LTS) | `package.json` raiz declara `"engines": {"node": ">=22"}` e o CI (`.github/workflows/ci.yml`, `NODE_VERSION: "22"`) fixa exatamente essa versão. `docs/local-environment.md` D-3 registra que a máquina de desenvolvimento roda Node 24 e considera isso aceitável (também LTS, satisfaz `>=22`) — mas **22 é o que este projeto verifica e o que deve ser tratado como alvo**, não 24. Veja a contradição registrada no relatório final deste documento. |
| pnpm | **10.34.5** | Fixado em `package.json#packageManager` (`pnpm@10.34.5`) e usado literalmente pelo CI (`PNPM_VERSION: "10.34.5"`, `pnpm/action-setup`). Ative via Corepack: `corepack enable` seguido de `corepack prepare pnpm@10.34.5 --activate` (Corepack lê `packageManager` automaticamente). |
| PostgreSQL | 17 (Docker) ou 18 (nativo, confirmado em uso) | `docker-compose.yml`/`docker-compose.test.yml` usam `postgres:17-alpine`; o CI usa `postgres:17-alpine`. `docs/local-environment.md` registra a máquina de referência rodando PostgreSQL **18** nativo sem problema — nenhuma feature específica de uma versão é usada. Extensões `pg_trgm` e `citext` são obrigatórias em ambas as bases (dev e teste). |
| Redis | **Opcional em desenvolvimento, obrigatório em produção** | `REDIS_URL` vazio faz o `CacheProvider` cair para um adaptador em memória (`InMemoryCacheProvider`) — sessões, permissões e escopo continuam corretos, só não são compartilhados entre processos nem sobrevivem a um restart. `apps/api/src/infrastructure/config/env.schema.ts` rejeita `REDIS_URL` vazio quando `NODE_ENV=production` (docs/local-environment.md D-2). |
| Docker Desktop | Opcional para desenvolvimento nativo; necessário para a alternativa em contêiner (seção 3) | Só é indispensável se você optar por não instalar PostgreSQL nativamente, ou para rodar `docker-compose.test.yml` para as suítes de integração/contrato/E2E. |
| Git | qualquer versão atual | — |

Notas específicas do Windows:

- `apps/api` depende de `argon2`, módulo nativo. Se o pnpm pedir aprovação de build scripts, rode
  `pnpm approve-builds`.
- Este repositório é desenvolvido em Windows 11 com Git Bash e PowerShell 5.1
  (`docs/local-environment.md`, seção "Machine facts"). Comandos abaixo são apresentados em forma
  neutra (`bash`); ajuste para `$env:NAME = "valor"` no PowerShell onde houver variável de ambiente
  inline.
- `apps/api` resolve `.env` a partir do **próprio diretório** (`apps/api/.env`), nunca da raiz do
  monorepo — `prisma.config.ts` roda `import 'dotenv/config'` e `pnpm --filter` executa os scripts
  do pacote com `cwd=apps/api`. Isso é tratado em detalhe na seção 2.

---

## 2. Primeira configuração, passo a passo

Sequência mínima verificada para um clone limpo (`docs/local-environment.md` D-22, "Trap 2"):

```bash
# 1. Clonar e instalar
git clone <repository-url> pharos-grc
cd pharos-grc
corepack enable
pnpm install --frozen-lockfile

# 2. Arquivos de ambiente — existe UM .env.example na raiz; não existe um por app.
#    apps/api lê apps/api/.env (nunca a raiz); apps/web não precisa de .env próprio
#    para os fluxos abaixo (só variáveis exportadas no shell — ver Trap 3/Trap 4 abaixo).
cp .env.example .env
cp .env.example apps/api/.env
# Definir SEED_ADMIN_PASSWORD em AMBOS os arquivos (ou exportar no shell antes do seed) —
# o valor nunca deve ser registrado em nenhum arquivo versionado.

# 3. Banco de dados — duas bases: pharos_grc (dev) e pharos_grc_test (testes),
#    cada uma com dois papéis (ADR-005): pharos_owner (migração/DDL) e
#    pharos_app (restrito, usado pela aplicação em runtime). Se você optar por
#    PostgreSQL nativo em vez do Docker Compose, provisione as duas bases e os
#    dois papéis manualmente, espelhando docker/postgres/init/01-roles.sql
#    (extensões pg_trgm e citext em ambas).

# 4. Geração do cliente Prisma, migração e seed
pnpm --filter @pharos/api run db:generate
pnpm --filter @pharos/api exec prisma migrate deploy    # nunca `migrate dev` — ver docs/local-environment.md D-17/D-18
pnpm --filter @pharos/api run db:seed

# 5. Pacotes internos que apps/web consome já BUILDADOS (dist/ é gitignored)
pnpm --filter @pharos/api-types run generate && pnpm --filter @pharos/api-types run build
pnpm --filter @pharos/design-system run build

# 6. Subir as duas aplicações (dois terminais)
pnpm --filter @pharos/api dev     # NestJS em http://localhost:3001
pnpm --filter @pharos/web dev     # Next.js (Turbopack) em http://localhost:3000
```

Confirmar que o backend está de pé:

```bash
curl http://localhost:3001/api/v1/health/live     # liveness do processo
curl http://localhost:3001/api/v1/health/ready     # PostgreSQL + Redis alcançáveis
```

(o prefixo global `/api/v1` se aplica também aos endpoints de saúde — não existe `/health/live` sem
prefixo.)

Abra `http://localhost:3000`. Você deve ser redirecionado para a tela de login.

### 2.1 Variáveis de ambiente obrigatórias

Toda variável abaixo é validada em `apps/api/src/infrastructure/config/env.schema.ts` (única
função autorizada a ler `process.env` no backend) e documentada, com comentário, em
`.env.example`. A tabela deriva dessas duas fontes, não de `quickstart.md` isoladamente — onde os
dois já divergiram no passado, `.env.example`/`env.schema.ts` são a fonte corrente
(`docs/local-environment.md` D-5 registra a reconciliação de nomes).

| Nome | Onde é lido | Obrigatória | Propósito |
|---|---|---|---|
| `NODE_ENV` | `apps/api` | Sim | `development`\|`test`\|`production`; controla verbosidade de erro, formatação de log e validações condicionais (`SESSION_COOKIE_SECURE`, `REDIS_URL` obrigatórios em produção). |
| `API_PORT` | `apps/api` | Sim | Porta de escuta do NestJS. Padrão de desenvolvimento: `3001`. |
| `WEB_PORT` | `apps/web` (via Compose/scripts) | Sim | Porta de escuta do Next.js. Padrão: `3000`. |
| `API_INTERNAL_URL` | `apps/api` (schema completo) e `apps/web` (`src/lib/env.ts`, apenas estas duas) | Sim | Alvo do rewrite `/api/*` do Next.js (ADR-014) e das chamadas server-side de `apps/web`. |
| `APP_ORIGIN` | `apps/api` e `apps/web` | Sim | Origem pública única; usada na checagem `Origin`/`Referer` (defesa CSRF) e como `baseURL` do Playwright. |
| `DATABASE_URL` | `apps/api` | Sim | Conexão da aplicação, papel **restrito** `pharos_app` (nunca DDL, nunca `UPDATE`/`DELETE` em `audit_event`). |
| `DATABASE_MIGRATION_URL` | `apps/api` (Prisma CLI) | Sim | Conexão de migração, papel **owner** `pharos_owner`. Lida via `directUrl` no `schema.prisma` — sobrescrever só `DATABASE_URL` ao rodar uma migração não muda o alvo real (`docs/local-environment.md` D-18). |
| `TEST_DATABASE_URL` | Harness de integração/contrato (`apps/api/test/integration/support/env.ts`) | Sim para rodar as suítes | Conexão restrita contra `pharos_grc_test`. O harness exige que o nome termine em `_test`. |
| `TEST_DATABASE_MIGRATION_URL` | Harness de integração/contrato | Sim para rodar as suítes | Conexão owner contra `pharos_grc_test`. |
| `REDIS_URL` | `apps/api` | Opcional em dev/teste; **obrigatória e não vazia em produção** | Cache de validação de sessão, cache de permissão/escopo, contadores de rate limit — nunca autoritativo (ADR-002/003/004). Vazio → adaptador em memória (D-2). |
| `SESSION_COOKIE_NAME` | `apps/api` | Sim | Nome do cookie de sessão opaco, `httpOnly`. Padrão: `pgrc_session` (deve casar com o `securityScheme` dos contratos OpenAPI). |
| `SESSION_COOKIE_SECURE` | `apps/api` | Sim | Flag `Secure` do cookie. `false` **somente** para HTTP local; obrigatoriamente `true` quando `NODE_ENV=production` (validado no schema). |
| `SESSION_COOKIE_SAMESITE` | `apps/api` | Sim | Política `SameSite`. Padrão: `lax`. |
| `SESSION_IDLE_TIMEOUT_MINUTES` | `apps/api` | Sim | Expiração por inatividade (FR-014). Padrão: `30`. |
| `SESSION_ABSOLUTE_LIFETIME_HOURS` | `apps/api` | Sim | Duração absoluta da sessão. Padrão: `12`. |
| `PASSWORD_MIN_LENGTH` | `apps/api` | Sim | Tamanho mínimo de senha local (FR-006). Padrão: `12`. |
| `PASSWORD_REQUIRE_COMPLEXITY` | `apps/api` | Sim | Exige classes de caractere mistas. Padrão: `true`. |
| `ARGON2_MEMORY_COST` / `ARGON2_TIME_COST` / `ARGON2_PARALLELISM` | `apps/api` | Sim | Parâmetros do argon2id (ADR-001). Padrões: `19456` / `2` / `1`. |
| `LOG_LEVEL` | `apps/api` | Sim | Nível pino (`fatal`..`trace`). Padrão dev: `debug`. |
| `LOG_PRETTY` | `apps/api` | Sim | Log legível localmente (`pino-pretty`). `false` fora de ambientes interativos. |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` | `apps/api` | Sim | Orçamento global de rate limit (`@nestjs/throttler`), distinto do throttling de autenticação abaixo. |
| `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS` | `apps/api` | Sim | Tentativas falhas por conta antes do bloqueio (FR-008). Padrão produção: `5`. |
| `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` | `apps/api` | Sim | Tentativas falhas por origem (IP), todas as contas somadas. Padrão produção: `20` — deliberadamente maior que o limite por conta, para não bloquear um NAT corporativo inteiro (D-6). |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `apps/api` | Sim | Janela de contagem. Padrão: `300`. |
| `AUTH_LOCKOUT_MINUTES` | `apps/api` | Sim | Duração do bloqueio. Padrão: `15`. |
| `ATTACHMENT_STORAGE_DRIVER` | `apps/api` | Sim | Adaptador de armazenamento por trás de `FileStorageProvider`. Só `local` existe hoje. |
| `ATTACHMENT_STORAGE_PATH` | `apps/api` | Sim quando `ATTACHMENT_STORAGE_DRIVER=local` | Raiz do adaptador local. |
| `ATTACHMENT_MAX_SIZE_BYTES` | `apps/api` | Sim | Limite por arquivo (FR-097). Padrão: `26214400` (25 MiB). |
| `ATTACHMENT_ALLOWED_MIME_TYPES` | `apps/api` | Sim | Lista de MIME types permitidos, separada por vírgula. |
| `SEED_DEV_FIXTURES` | Seed (`apps/api/prisma/seed/`) | Sim | Habilita a fixture de desenvolvimento (um usuário por papel de sistema, árvore de duas unidades organizacionais). Deve ficar `false` fora de desenvolvimento local. |
| `SEED_ADMIN_EMAIL` | Seed | Sim para semear | Identificador da conta administradora semeada. Padrão: `admin@example.local`. |
| `SEED_ADMIN_PASSWORD` | Seed | Sim para semear, **sem padrão** | Senha inicial da conta administradora, com `mustChangePassword=true`. O seed deve **falhar**, não cair para um padrão, se ausente ou fora da política de senha. Nunca commitar o valor. |

Variáveis lidas apenas por `docker-compose.yml`/`docker-compose.test.yml` (nunca pela aplicação
Node — `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`, `TEST_POSTGRES_HOST_PORT`,
`TEST_REDIS_HOST_PORT`, `POSTGRES_DB`, `TEST_POSTGRES_DB`, `POSTGRES_SUPERUSER_PASSWORD`,
`POSTGRES_OWNER_USER`/`_PASSWORD`, `POSTGRES_APP_USER`/`_PASSWORD`) estão documentadas em
`.env.example`, seção final, e não repetidas aqui.

### 2.2 Primeiro login

Ao final da seção anterior, faça login em `http://localhost:3000` com o e-mail definido em
`SEED_ADMIN_EMAIL` (padrão `admin@example.local`) e a senha que você atribuiu a
`SEED_ADMIN_PASSWORD` — **nunca** um valor fixo neste ou em qualquer outro documento. O seed marca
essa conta com `mustChangePassword=true`, então o primeiro acesso força a troca de senha antes do
dashboard: o próprio formulário de login redireciona para **`/profile?mustChangePassword=true`**
(`apps/web/src/app/(public)/login/login-form.tsx`, verifica `identity.mustChangePassword` na resposta
de `/auth/login`), não para o dashboard. **Isso é esperado, não um erro** — só depois de trocar a
senha em `/profile` o resto da aplicação fica acessível.

A senha atribuída a `SEED_ADMIN_PASSWORD` precisa satisfazer a mesma política que qualquer senha do
produto (`PASSWORD_MIN_LENGTH`/`PASSWORD_REQUIRE_COMPLEXITY` em `apps/api/.env` — ver §2.1 abaixo); o
seed não relaxa a política para a conta bootstrap.

O que o seed cria, além do administrador: o catálogo completo de permissões, os papéis de sistema
(`Platform Administrator`, `Risk Manager`, `Risk Analyst`, `Risk Approver`, `Auditor`, `Read Only`,
mais os papéis adicionados pelos módulos de Incidentes/Problemas), uma unidade organizacional raiz
e a versão padrão de metodologia de risco 5×5. Ver `docs/architecture/database.md` para a política completa de
seed e `apps/api/prisma/seed/` para os arquivos-fonte.

---

## 3. Alternativa com Docker Compose

`docker-compose.yml` sobe quatro serviços: `postgres` (17-alpine), `redis` (7-alpine), `api` e
`web`, buildados a partir de `docker/api.Dockerfile`/`docker/web.Dockerfile`. As portas de host
padrão (`5433` para Postgres, `6379` para Redis) foram escolhidas deliberadamente para não colidir
com um PostgreSQL nativo na porta padrão `5432` — ver o comentário de cabeçalho do próprio arquivo.

```bash
cp .env.example .env
# defina SEED_ADMIN_PASSWORD em .env — o arquivo de exemplo o deixa em branco de propósito
docker compose up -d --build
docker compose ps      # os quatro serviços devem ficar "healthy"/"running"
```

Migração e seed rodam a partir do **host**, contra a porta publicada do contêiner — **nunca** via
`docker compose exec` (ver limitações abaixo):

```bash
pnpm --filter @pharos/api exec prisma migrate deploy
pnpm --filter @pharos/api exec prisma db seed
```

`docker-compose.test.yml` é uma stack isolada (Postgres + Redis, dados em `tmpfs`, portas `5434`/
`6380`) usada pelas suítes de integração/contrato/E2E, sem serviços `api`/`web` — as aplicações
rodam no host contra essa stack. Tem `name: pharos-grc-test` explícito para nunca ser confundida
com `docker-compose.yml` pelo nome de projeto padrão do Compose (ambos residem no mesmo diretório).

**Limitações conhecidas, com status verificado (`docs/local-environment.md` D-1 e seu addendum em
`quickstart.md` §2, datado 2026-09-11):**

- **F-12/F-14 (imagem `api` travando em loop de crash, `.env` aninhado na imagem)** — registrados
  como **resolvidos** pelo addendum de `quickstart.md`: a imagem `api` empacotada não trava mais em
  loop e nenhuma imagem embute um `.env` aninhado. Este documento não reverificou isso por conta
  própria (política de leitura-somente desta sessão de documentação) — trate como resolvido, mas
  confirme com um `docker compose up -d --build` real antes de depender disso para algo crítico.
- **F-13** — dividido em duas metades pelo mesmo addendum: a metade "a validação de boot falha com
  `SESSION_COOKIE_SECURE=false`" **nunca foi verdadeira como descrita**, porque
  `docker-compose.yml` já força `SESSION_COOKIE_SECURE=true` para o serviço `api`. A segunda
  metade — "um navegador recusaria o cookie `Secure` sobre `http://localhost`" — foi **medida como
  falsa especificamente para Chromium** (login completo, cookie armazenado e limpo, ponta a ponta).
  Firefox/Safari/Chrome publicado não foram exercitados. O que continua genuinamente em aberto: essa
  stack não tem terminador TLS, então nada além de `localhost` funciona sem um proxy reverso na
  frente.
- `docker compose exec api pnpm exec prisma migrate deploy`/`db seed` (a forma que aparecia em
  `quickstart.md` antes do addendum) **nunca funcionou e não pode funcionar**: a imagem de runtime
  de `docker/api.Dockerfile` não embarca nem `pnpm` nem a CLI do Prisma. A forma correta é sempre a
  partir do host, contra a porta publicada — exatamente os dois comandos acima.
- A coleção ICU `pt-BR-x-icu`, usada na ordenação do registro de riscos, foi confirmada presente na
  imagem `postgres:17-alpine`.

---

## 4. Comandos úteis

Todos verificados contra o `package.json` real de cada pacote (nunca inventados).

### Raiz do monorepo (`pnpm -r --if-present run <script>` na maioria dos casos)

| Comando | O que roda de fato |
|---|---|
| `pnpm dev` | `pnpm -r --parallel --if-present run dev` — sobe todo pacote com script `dev` em paralelo. |
| `pnpm build` | `pnpm -r --if-present run build` — build em ordem topológica (design-system → api-types → api/web). |
| `pnpm lint` | `pnpm -r --if-present run lint` — inclui as regras de fronteira `core/` vs `modules/` (`eslint-plugin-boundaries`, ADR-011). |
| `pnpm typecheck` | `pnpm -r --if-present run typecheck` — TypeScript estrito em cada pacote. |
| `pnpm format` / `pnpm format:check` | `prettier --write .` / `prettier --check .` na raiz. |
| `pnpm test` | `pnpm -r --if-present run test` — todo pacote com script `test`. |
| `pnpm test:unit` / `test:integration` / `test:contract` / `test:e2e` | Delegam ao script de mesmo nome em cada pacote que o declarar (ver tabela de `apps/api`/`apps/web` abaixo). |
| `pnpm db:migrate` / `db:generate` / `db:seed` | Atalhos que delegam para `@pharos/api` (`prisma migrate deploy`\* / `prisma generate` / `prisma db seed`) — \*ver nota abaixo, o script real de `apps/api` chama `prisma migrate dev`, não `deploy`; use `pnpm --filter @pharos/api exec prisma migrate deploy` diretamente para o fluxo seguro descrito na seção 2 e em `docs/local-environment.md` D-17. |

### `apps/api`

| Comando | O que roda |
|---|---|
| `pnpm --filter @pharos/api dev` | `nest start --watch` |
| `pnpm --filter @pharos/api build` | `nest build` (emite para `dist/src/main.js` — `tsconfig.json` define `rootDir: "./"`) |
| `pnpm --filter @pharos/api start` | `node dist/src/main.js` — o que roda em produção/CI, não `nest start`. |
| `pnpm --filter @pharos/api lint` | `eslint` sobre `src/`, `test/` e `prisma/seed/`, `--max-warnings=0`. |
| `pnpm --filter @pharos/api typecheck` | `tsc --noEmit -p tsconfig.json`. |
| `pnpm --filter @pharos/api test` | `vitest run` (execução ampla, todos os specs que o Vitest padrão descobrir). |
| `pnpm --filter @pharos/api test:unit` | `vitest run test/unit` — domínio puro, sem I/O (scoring de risco, tabela de transição de ciclo de vida, SoD, política de senha, resolução de escopo). |
| `pnpm --filter @pharos/api test:integration` | `vitest run --config vitest.integration.config.ts` — contra PostgreSQL/Redis reais. |
| `pnpm --filter @pharos/api test:contract` | `vitest run --config vitest.contract.config.ts` — superfície HTTP via supertest. |
| `pnpm --filter @pharos/api run db:generate` | `prisma generate` — obrigatório após clone e após qualquer mudança de schema. |
| `pnpm --filter @pharos/api run db:migrate` | `prisma migrate dev` — **uso local, cria migração nova a partir de mudança no schema**. Para aplicar migrações já commitadas (clone limpo, CI, produção), use `prisma migrate deploy` diretamente (`pnpm --filter @pharos/api exec prisma migrate deploy`), nunca `db:migrate` — `migrate dev` pode gerar uma migração nova indesejada. |
| `pnpm --filter @pharos/api run db:seed` | `prisma db seed` → `ts-node --transpile-only prisma/seed/index.ts` (bootstrap de um contexto Nest real, não `tsx` — motivo documentado no cabeçalho de `prisma.config.ts`: `tsx`/esbuild não implementa `emitDecoratorMetadata`, necessário para a injeção de dependência do Nest). |
| `pnpm --filter @pharos/api run db:seed:performance -- --count=50000` | `ts-node --transpile-only prisma/seed/performance.seed.ts` — carga de volume (50k riscos em ~25s medidos), **nunca contra `pharos_grc`**, só base descartável/teste. `--reset` remove o que a fixture criou. |
| `pnpm --filter @pharos/api run openapi:generate` | `ts-node --transpile-only scripts/generate-openapi.ts` — regenera `apps/api/openapi.json` a partir dos decorators do NestJS (reflexão, nível de rota apenas — D-14). |
| `pnpm --filter @pharos/api run openapi:check` | `ts-node --transpile-only scripts/check-openapi.ts` — falha se `openapi.json` commitado estiver desatualizado frente à reflexão atual. |

### `apps/web`

| Comando | O que roda |
|---|---|
| `pnpm --filter @pharos/web dev` | `next dev --turbopack`. Não tem `.env` próprio por padrão — exporte `API_INTERNAL_URL`/`APP_ORIGIN` no shell antes de rodar isoladamente (`src/lib/env.ts` falha alto e imediatamente se ausentes). |
| `pnpm --filter @pharos/web build` | `next build`. **Nunca rode com o dev server ativo na mesma porta/`.next`** — `docs/local-environment.md` D-16: os dois processos escrevem no mesmo diretório `.next`, e rodar o build por cima corrompe o cache do dev server (500 em toda rota, sem recuperação automática). Requer `API_INTERNAL_URL`/`APP_ORIGIN` no ambiente (o build falha em `next.config.ts` sem eles) — CI define ambos no job `build`. |
| `pnpm --filter @pharos/web start` | `next start` — o que roda em produção/CI (nunca `next dev`). |
| `pnpm --filter @pharos/web lint` | `eslint .` |
| `pnpm --filter @pharos/web typecheck` | `tsc --noEmit -p tsconfig.json` |
| `pnpm --filter @pharos/web test` / `test:unit` | `vitest run` — os dois scripts são idênticos. |
| `pnpm --filter @pharos/web test:e2e` | `playwright test`. Requer `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` exportados no shell — sem eles, `apps/web/e2e/support/admin-session.ts` pula (`test.skip`) os cenários autenticados **fora do CI**, e o suite reporta sucesso tendo rodado quase nada (`docs/local-environment.md` D-22, "Trap 4"). Verifique a contagem de `skipped`, não só o código de saída. |
| `pnpm --filter @pharos/web test:e2e:ci-parity` | `node scripts/run-ci-parity.mjs` |
| `node apps/web/scripts/ui-capture.mjs <dir-de-saída> [--theme=light|dark] [--width=1440] [--height=N]` | Ferramenta de captura renderizada com Playwright, instrumento padrão do laço de UI do CLAUDE.md §18.1/§18.13. |

### `packages/design-system` e `packages/api-types`

| Comando | O que roda |
|---|---|
| `pnpm --filter @pharos/design-system build` | `tsc -p tsconfig.json` → `dist/` (gitignored). **`apps/web` importa o pacote pelo `dist/` buildado, não pelo código-fonte** — rodar os testes/dev de `apps/web` sem antes buildar o design system falha com `Failed to resolve import "@pharos/design-system/components"` em dezenas de arquivos simultaneamente; isso é um passo de bootstrap faltando, não uma regressão de código (D-22, "Trap 1"). O pacote não tem suíte de testes própria por decisão registrada (`docs/local-environment.md` D-9) — seus componentes são testados via `apps/web/src/components/design-system.test.tsx`. |
| `pnpm --filter @pharos/api-types run generate` | `node scripts/generate.mjs` — gera `src/generated/*.ts` a partir dos contratos OpenAPI escritos à mão em `specs/*/contracts/*.openapi.yaml` (não a partir de `apps/api/openapi.json` — D-14), via `openapi-typescript`. |
| `pnpm --filter @pharos/api-types run build` | `tsc -p tsconfig.json` → `dist/` (gitignored, consumido por `apps/api` e `apps/web` via `workspace:*`). |
| `pnpm --filter @pharos/api-types run typecheck` | `tsc --noEmit -p tsconfig.json` |

### Gate adicional executado pelo CI (sem atalho de script na raiz)

| Comando | O que roda |
|---|---|
| `pnpm audit --audit-level=high --ignore-registry-errors` | Falha só em advisory HIGH/CRITICAL; MODERATE/LOW ficam visíveis no log mas não quebram o job (racional documentado no cabeçalho de `.github/workflows/ci.yml`). |

Ver `docs/guides/testing.md` para a estratégia de testes completa e o detalhamento de cada job do CI.

---

## 5. Estrutura do monorepo, em 10 linhas

```
apps/api/            NestJS — core/ (transversal) + modules/<domínio> + grc/ (núcleo GRC compartilhado)
apps/web/             Next.js App Router — src/app/ (rotas) + src/features/<domínio> + src/lib/
packages/design-system/   Tokens e componentes (Tailwind 4 + shadcn/ui), build para dist/, sem strings de usuário
packages/api-types/       Tipos TypeScript gerados dos contratos OpenAPI hand-authored em specs/*/contracts
specs/NNN-<slug>/         Cada fase: spec.md, plan.md, tasks.md, contracts/, data-model.md, STATE.md
docs/                      Documentação viva (este diretório)
docker/, docker-compose*.yml  Infraestrutura containerizada, alternativa ao ambiente nativo
prisma/ (dentro de apps/api)  schema.prisma, migrations/, seed/
```

Detalhamento completo de limites de módulo, pontos de extensão e regras de dependência:
[`docs/architecture.md`](../architecture.md).

---

## 6. Como implementar uma nova funcionalidade no PharosGRC

Fluxo real observado nas fases já concluídas (`specs/003-controls-management/` até
`specs/010-action-plan-surface/`), ancorado em CLAUDE.md §14/§16 (Requisito → Especificação →
Arquitetura → Plano → Tarefas → Implementação → Testes → Revisão) e §19 (política permanente de
arquitetura de domínio GRC).

### 6.1 Especificação

Toda funcionalidade de negócio nova começa em `specs/NNN-<slug>/`, numerada sequencialmente, usando
os skills `speckit-specify` → `speckit-clarify` → `speckit-plan` → `speckit-tasks` (o pipeline já em
uso neste repositório — ver `specs/009-indicators-reports/`, `specs/010-action-plan-surface/`).
Nenhuma implementação começa a partir de uma ideia informal (CLAUDE.md §16). A especificação declara
explicitamente, por CLAUDE.md §19.2, como o módulo se relaciona com Unidade Organizacional, Risco,
Controle, Ativo, Processo, Evidência, Ação, Achado e Auditoria — "não se relaciona com nada" é uma
resposta válida, mas precisa estar escrita.

### 6.2 Modelagem de dados

Alterações de schema em `apps/api/prisma/schema.prisma`, seguidas de uma migração Prisma
forward-only. Ver [`docs/architecture/database.md`](../architecture/database.md) para o modelo completo, a política de
migração e a política de seed. Regras que já custaram tempo real e valem a pena internalizar antes
de tocar em uma migração:

- `prisma migrate deploy`/`migrate status` nunca revalidam o checksum de uma migração já aplicada —
  nunca edite uma migração no lugar depois da primeira aplicação real (`docs/local-environment.md`
  D-17).
- Comandos de migração leem `DATABASE_MIGRATION_URL`, nunca `DATABASE_URL` — sobrescrever só a
  primeira não muda o alvo real (D-18).
- Toda tabela com escopo organizacional carrega esse escopo diretamente na própria tabela, mesmo
  quando derivável por relação (AGENTS.md, "Authorization and scope") — autorização nunca depende
  de um join.

### 6.3 Contrato OpenAPI

O contrato é escrito à mão em `specs/NNN-<slug>/contracts/<dominio>.openapi.yaml` **antes** da
implementação do controller — é a fonte de verdade de campo, não `apps/api/openapi.json` (que é
apenas reflexão dos decorators do NestJS, nível de rota, D-14). Depois de implementado:

1. `packages/api-types` regenera a partir desse contrato (`pnpm --filter @pharos/api-types run
   generate && ... run build`) — o CI tem um job dedicado (`api-types-check`) que falha se o
   diretório `packages/api-types/src` ficar desatualizado frente aos contratos.
2. `apps/api/test/contract/contract-coverage.spec.ts` — todo `{method, path}` declarado no novo
   contrato precisa aparecer em `apps/api/openapi.json`, e a fonte precisa ser adicionada à lista de
   contratos que esse teste varre (`CONTRACT_SOURCES`). Este é o gate que existe especificamente
   porque, uma vez (F-31 em `docs/deferred-findings.md`), dois endpoints contratados e usados pelo
   frontend nunca chegaram a existir na API, e nenhum outro gate percebeu.
3. `pnpm --filter @pharos/api run openapi:check` continua sendo o detector de deriva em nível de
   rota — não substitui o passo 2, é um gate diferente sobre uma superfície diferente.

### 6.4 Módulo de backend

Novo diretório `apps/api/src/modules/<dominio>/`, nas quatro camadas `domain → application →
infrastructure → presentation`, com um módulo de composição próprio que importa de `core/` (nunca
o inverso) e não importa diretamente de outro `modules/**` — a fronteira é imposta por
`eslint-plugin-boundaries` (ADR-011), falha de build, não convenção de revisão. `incidents` e
`controls` (`apps/api/src/modules/incidents/`, `apps/api/src/modules/controls/`) são referências
limpas e recentes da forma: entidades e ports em `domain/`, casos de uso em `application/`
(incluindo subpastas `links/`, `collaboration/` quando fizer sentido), repositórios Prisma em
`infrastructure/`, controllers e DTOs em `presentation/`.

Dentro desse módulo:

- **Permissões**: um arquivo `<dominio>-permissions.ts` exportando as definições e ampliando o
  registro de permissões via `declare module`; uma linha em `combinePermissionDefinitions(...)`.
  Ver [`docs/architecture/security.md`](../architecture/security.md).
- **Auditoria**: um allow-list de campos auditáveis por `AuditEntityType`, registrado no construtor
  do módulo — nunca gravação de auditoria fora da mesma transação da mudança. **Endpoint só-leitura
  não registra evento de auditoria** — auditoria é sempre atrelada a uma mudança de estado (CLAUDE.md
  §8: "eventos relevantes", nunca leitura); um caso de uso de listagem/consulta não chama o serviço de
  auditoria em ponto algum. Exemplo real dessa forma: `ListAssetIncidentLinksUseCase`
  (`apps/api/src/modules/assets/application/list-asset-incident-links.usecase.ts`), atrás de
  `GET /assets/{assetId}/incidents` — não grava nenhum evento.
- **Escopo organizacional**: o repositório estende `ScopedRepository<...>`, todo método passando
  por `withScope` — nunca uma query que redetermina o escopo a partir de um id fornecido pelo
  cliente.
- **Mensagens pt-BR**: toda string de usuário nova entra em `apps/web/src/lib/messages/<dominio>.ts`
  (frontend) e `apps/api/src/shared/messages/user-messages.ts` (mensagens de erro/validação vindas
  do backend) — nunca embutida em componente ou controller (CLAUDE.md §11.1).

**Exemplo concreto de endpoint só-leitura entre dois domínios** ("listar X por Y", sem escrita): o
par `GET /assets/{assetId}/incidents` (lista Incidentes vinculados a um Ativo, leitura reversa de um
vínculo que `modules/incidents` é quem escreve) é o template mais próximo de qualquer novo endpoint
de listagem por relacionamento. Backend: controller em
`apps/api/src/modules/assets/presentation/asset.controller.ts` (`@RequirePermission('asset:view')`,
`@Get(':assetId/incidents')` — a mesma permissão do recurso pai, sem permissão própria, porque é
leitura), caso de uso `list-asset-incident-links.usecase.ts` acima, lendo por uma porta de domínio
(`apps/api/src/shared/grc-ports/incident-asset-link-read.port.ts`) em vez de o módulo `assets`
importar `modules/incidents` diretamente (ADR-011). Contrato:
`specs/006-assets-processes/contracts/assets.openapi.yaml`, operação `listAssetIncidentLinks`.
Frontend: `apps/web/src/features/assets/api.ts` + `asset-linked-entities-section.tsx`
(`AssetLinkedIncidentsSection` — busca própria, embutida como seção da tela de detalhe do Ativo, não
como rota nova). Documentado com mais contexto em `docs/modules/assets-processes.md` e
`docs/modules/incidents-problems.md`.

### 6.5 Feature de frontend

Novo diretório `apps/web/src/features/<dominio>/` (padrão observado: `components/`, `hooks/`, mais
`api.ts`/`types.ts` conforme o domínio precisa). Uma **rota nova** sob
`apps/web/src/app/(app)/<dominio>/` exige uma entrada em
`apps/web/src/components/shell/navigation-registry.ts` — trocando `status: 'planned'` por
`status: 'implemented'` com `href` real e a permissão exigida, se a rota já existia como placeholder,
ou adicionando a entrada do zero. Uma listagem que só reaparece **embutida como seção de uma tela de
detalhe já existente** (ex.: incidentes vinculados na tela de um Ativo — sem rota própria, sem link de
navegação principal) **não** precisa de entrada no registro de navegação: não é navegação nova, é
conteúdo adicional de uma tela que já tem a sua. Confirme qual dos dois casos é o seu antes de tocar
em `navigation-registry.ts`.

Toda navegação — rota nova ou não — usa exclusivamente `Link` (`@/components/navigation/link`) para
cliques e `useNavigate()` (`@/components/shell/navigation-pending`) para navegação disparada pelo
próprio código; nunca `next/link`/`useRouter()` diretamente (ADR-023, bloqueado por lint — ver
[`docs/architecture/frontend.md`](../architecture/frontend.md) §3).

Consumir apenas os tipos gerados por `@pharos/api-types`, nunca uma cópia manual do contrato. Ver
[`docs/architecture/frontend.md`](../architecture/frontend.md) para a arquitetura completa de `apps/web` e
[`docs/architecture.md`](../architecture.md#worked-example-adding-module-number-two) para o exemplo
passo a passo verificado de um módulo de negócio inteiro sendo plugado sem tocar em `core/`, no shell
ou em outro módulo.

### 6.6 Design System

Componentes de interface novos ou reutilizáveis (não específicos de uma única tela) entram em
`packages/design-system`, nunca como estilo isolado por página (CLAUDE.md §18.3). Toda string
visível ao usuário chega por prop, nunca hardcoded no pacote (CLAUDE.md §18.3, D-10 em
`docs/local-environment.md`) — o pacote não tem strings pt-BR fixas nem strings em inglês fixas.

### 6.7 Testes

Camadas mínimas, cada uma um gate real de CI, não uma aspiração:

- **Unitário** (`apps/api test:unit`, `apps/web test:unit`) — domínio puro, sem I/O.
- **Integração** (`apps/api test:integration`) — contra PostgreSQL/Redis reais.
- **Contrato** (`apps/api test:contract`) — toda autorização e escopo declarados no contrato,
  exercitados via HTTP real. `docs/local-environment.md` D-11: todo endpoint novo carrega teste de
  contrato cobrindo no mínimo a regra de autorização declarada em prosa, o caso não-autenticado
  (401), e a forma da resposta de sucesso — mesmo quando a planilha de tarefas não lista essa tarefa
  explicitamente.
- **E2E** (`apps/web test:e2e`, Playwright) — jornada real em navegador, incluindo o varredura de
  acessibilidade (`@axe-core/playwright`) nos temas claro e escuro.

Ver [`docs/guides/testing.md`](./testing.md) para a estratégia completa e o mapeamento de cada job do CI.

### 6.8 Verificação renderizada (CLAUDE.md §18)

Nenhuma mudança substancial de interface está concluída porque compila, builda ou passa em teste
unitário — precisa ser inspecionada na aplicação renderizada. Use `node
apps/web/scripts/ui-capture.mjs <dir-de-saída>` para capturar a tela real com Playwright (temas
claro/escuro, larguras diferentes), responda ao portão de aceitação visual do CLAUDE.md §18.11
olhando a captura, e só então considere o trabalho pronto. Capturas vivem em `docs/reviews/ui/` e
não são artefato de produção.

### 6.9 Atualização de documentação

Ao fechar uma fase: atualizar `STATE.md` da própria spec com o que foi entregue e o que ficou em
aberto; registrar uma ADR em `docs/architecture/decisions.md` se a decisão for arquiteturalmente
relevante (CLAUDE.md §13.9); atualizar `docs/modules/` se um módulo novo ou alterado precisar de
documentação própria; atualizar CLAUDE.md §17 (registro de evolução do produto) quando a fase
concluída mudar o que o roteiro descreve como feito.

### 6.10 Anti-padrões que criam uma segunda arquitetura

Cada um abaixo já é proibido por uma regra concreta — não é opinião de estilo:

| Anti-padrão | Por que é proibido |
|---|---|
| Tabela genérica `related_entity(type, id)` ou discriminador em string livre para relacionar dois domínios GRC | CLAUDE.md §19.3 permite só dois mecanismos: tabela de ligação explícita e nomeada (quando o vínculo tem significado próprio, com seu próprio tipo de entidade de auditoria), ou um registro de tipo fechado (enum verificado em compilação) para uma capacidade transversal que se anexa a muitos tipos. O Probo tentou mecanismos semi-genéricos quatro vezes e reverteu todas — evidência em `docs/history/probo-benchmark.md`. |
| Criar uma segunda entidade/tabela de "tarefa" ou "plano de ação" dentro de um módulo novo | `Action` é a única capacidade de ação/tarefa da plataforma (CLAUDE.md §19.6, §17 item 15) — tratamento de risco, achado, incidente e remediação de conformidade consomem a mesma, nunca um sistema paralelo. Cinco sistemas independentes de tarefa é o defeito que a ordem de implementação existe para evitar. |
| Duplicar `Control` por `Framework`, ou fazer `Requirement` referenciar mais de uma `FrameworkVersion` | CLAUDE.md §19.5 — `Requirement` pertence a exatamente uma versão de framework; `Control` não pertence a framework algum; a ligação é N:M. |
| Armazenar nível de risco, estado de conformidade ou qualquer estado derivado como campo editável, com uma segunda implementação de cálculo em outro lugar | CLAUDE.md §19.7 — estado derivado é sempre calculado por **um único** ponto no código (ex.: `RiskScoringService`), nunca duplicado nem gravado como valor independente do que o sustenta. |
| Ignorar `ScopedRepository`/`withScope` e montar a query de escopo organizacional manualmente em um módulo novo | AGENTS.md ("Authorization and scope") — a autorização nunca depende de join nem de um id fornecido pelo cliente; o escopo é resolvido uma vez e passado adiante, nunca rederivado. |
| Verificação de permissão só no frontend (esconder um botão), sem checagem equivalente no backend | AGENTS.md — controle de UI é conveniência, nunca controle de segurança; a decisão é sempre do servidor. CLAUDE.md §12 exige autorização no backend. |
| String de usuário nova hardcoded em um componente ou controller, em vez de nos catálogos centralizados | CLAUDE.md §11.1/§18.7 — toda string nova é pt-BR e entra em `apps/web/src/lib/messages/` ou `apps/api/src/shared/messages/user-messages.ts`. |
| Introduzir um segundo framework de componentes de UI (Material UI, Ant Design, Chakra, Bootstrap, Mantine…) ou uma segunda biblioteca de teste de navegador | CLAUDE.md §18.4/§18.2 — a arquitetura de frontend aprovada é fixa (Next.js, Tailwind, shadcn/ui, Radix, Lucide, TanStack Table, Recharts); Playwright é o único mecanismo de verificação em navegador renderizado. |
| Ponto de extensão que compila mas nunca foi chamado por código de produção real, usado como se já fosse capacidade | CLAUDE.md §19.10 — o projeto já pagou sete vezes pelo mesmo padrão (algo que parecia coberto porque existia e nunca tinha sido executado). Antes de depender de um ponto de extensão, exercite-o pelo menos uma vez. |
| Registrar um mecanismo de IA que grava dados usando identidade vinda da saída do modelo, ou sem tipo de ator distinto e sem portão de revisão humana | CLAUDE.md §19.9 — identidade sempre vem do contexto do servidor; ação de IA é auditável, atribuível e passa por revisão humana antes de escrever. |

---

## 7. Convenções de Git / commits

O histórico deste repositório (`git log`) segue **conventional commits** de forma consistente —
`feat(...)`, `fix(...)`, `test(...)`, `docs(...)`, `refactor(...)`, `style(...)` — com escopo entre
parênteses nomeando o pacote ou área afetada (`feat(web): ...`, `fix(api,web): ...`,
`docs(015): ...` referenciando o número da spec). A mensagem de assunto após o tipo/escopo tende a
ser descritiva do efeito observável da mudança, não apenas do mecanismo ("a role assignment answers
with the assignment, not the person" em vez de "fix bug in role controller"). Siga esse padrão: tipo
convencional, escopo entre parênteses, assunto no imperativo/descritivo, em inglês (mensagens de
commit são identificador técnico, não interface de usuário — CLAUDE.md §11.1 não se aplica a elas).

Regras adicionais já em vigor neste projeto (CLAUDE.md §14, AGENTS.md):

- Mudanças pequenas e coesas; nada de commit que mistura áreas não relacionadas.
- Revisar o diff resultante antes de commitar; confirmar que nenhum arquivo fora do escopo da
  tarefa foi alterado.
- Nunca commitar segredo, mesmo de desenvolvimento — `.env`/`apps/api/.env` estão fora do controle
  de versão; só `.env.example` é versionado, com valores de desenvolvimento explicitamente
  rotulados como tal.
