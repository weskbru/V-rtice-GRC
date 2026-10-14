Status: provisional — descreve a configuração local da distribuição Vértice GRC.

# Desenvolvimento local

Use Node.js 22 ou superior, pnpm na versão fixada em `package.json`, Docker e Python 3 para
regenerar o bootstrap SQL. Trabalhe em uma cópia da branch `github/vertice-grc`.

## Configuração

Copie `.env.example` para `.env`, revise as variáveis e configure a senha de seed apenas quando
for criar o administrador. Os valores do exemplo são para desenvolvimento local e não devem ser
usados em implantação pública. `.env` permanece ignorado pelo Git.

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
docker compose --profile local-db up -d postgres redis
```

A API precisa de `DATABASE_URL` com o papel restrito `vertice_app`. Migrações usam
`DATABASE_MIGRATION_URL` com `vertice_owner`. Confira o destino antes de aplicar migrações:

```powershell
pnpm --filter @vertice/api exec prisma migrate deploy
```

Prisma lê o ambiente do diretório da API. Ao executar o comando nesse workspace, forneça as
variáveis na sessão ou em `backend/.env`, também ignorado. Use os valores locais do exemplo,
conforme [database.md](../architecture/database.md).

Para iniciar os servidores, forneça as mesmas variáveis ao processo da API e execute:

```powershell
pnpm --filter @vertice/api dev
pnpm --filter @vertice/web dev
```

## Validação

```powershell
pnpm --filter @vertice/api-types build
pnpm --filter @vertice/design-system build
pnpm typecheck
pnpm lint
pnpm test:unit
```

Os testes de integração, contrato e navegador precisam de uma instância PostgreSQL isolada
terminada em `_test`, com URLs distintas para os papéis de aplicação e proprietário. Seu setup
aplica migrações e limpa tabelas; nunca aponte esses testes para um banco em uso.
O Compose `docker-compose.test.yml` oferece uma instância temporária para esse fim.

## Publicação

Configure a implantação com segredos externos e adapte os exemplos Kubernetes ao seu ambiente.
Consulte [github-publication.md](../github-publication.md) antes de reaproveitar configurações ou
migrações de outra instalação.
