# PharosGRC

Plataforma corporativa de Governança, Riscos e Compliance (GRC), em desenvolvimento incremental por
módulo. Interface em português do Brasil; identificadores técnicos em inglês (`CLAUDE.md` §11.1).

> **Status, 2026-09-14**: onze módulos de negócio implementados — Gestão de Riscos, Controles,
> Compliance, Auditoria e Achados, Ativos, Processos, Incidentes, Problemas, Dashboard, Indicadores
> e Relatórios — sobre a fundação de plataforma e o núcleo GRC compartilhado (Evidência/Ação/
> Achado). O roteiro planejado (Fases 0–7 de `docs/architecture/grc-roadmap.md`) está concluído;
> cinco fases adicionais de refinamento seguiram (`specs/011` a `specs/015`), todas fechadas — a
> última (`specs/015`, Superfície de Papéis e Permissões) encerrou nesta mesma data com regressão
> final verde e zero bloqueadores. Estado exato, o que é parcial/planejado e pendências conhecidas:
> **[`docs/STATE.md`](docs/STATE.md)**.

**Comece por [`docs/HANDOVER.md`](docs/HANDOVER.md)** — visão geral, como subir o ambiente e a
ordem de leitura recomendada para o primeiro dia. Este arquivo não duplica a documentação
existente — aponta para ela. O índice completo vive em **[`docs/README.md`](docs/README.md)**.

## Banco de dados externo

Por padrão, `docker compose up` não inicia um PostgreSQL local. A API usa somente `DATABASE_URL`
do `.env` para acessar o banco configurado. `DATABASE_MIGRATION_URL` fica disponível para a
administração separada das migrações e é opcional no startup da API. O PostgreSQL local segue
disponível opcionalmente com `docker compose --profile local-db up -d postgres`.

Para inicializar uma vez um banco externo vazio pelo DBeaver, gere e execute
[`database/postgres/bootstrap-pharos-grc.sql`](database/postgres/bootstrap-pharos-grc.sql):

```powershell
python database/postgres/generate-bootstrap.py
```

O script aplica as migrações Prisma em ordem e grava seus checksums no histórico Prisma. O servidor
PostgreSQL precisa ter `citext` e `pg_trgm` disponíveis. A fonte da verdade continua em
`database/prisma/migrations`; gere novamente o bootstrap quando essas migrações mudarem.

## Stack

NestJS + TypeScript (API), Next.js + TypeScript + Tailwind + shadcn/ui (web), PostgreSQL + Prisma,
Redis, REST/OpenAPI, Vitest + Playwright. Docker/Docker Compose para empacotamento. Detalhes e
decisões em `CLAUDE.md` §3–§4.

## Estrutura do repositório

```
frontend/       Next.js e Design System — features/ por módulo e componentes de interface
backend/        NestJS — core/, grc/ (núcleo GRC compartilhado), modules/ (domínios de negócio), testes e Dockerfile
database/       Schema Prisma, migrations e inicialização PostgreSQL
packages/       Pacotes compartilhados entre frontend e backend (api-types)
docker/         Dockerfile da aplicação web
specs/          Especificação, plano, tarefas e contratos OpenAPI, por fase
docs/           Arquitetura, decisões, ambiente local, findings — ver docs/README.md
```

## Para começar

O guia de configuração atual a partir de uma máquina limpa (requisitos, `.env`, banco,
migrations, seed, API e web) é [`docs/guides/development.md`](docs/guides/development.md), e o roteiro do
primeiro dia é [`docs/HANDOVER.md`](docs/HANDOVER.md). Os arquivos `quickstart.md` dentro de
`specs/<fase>/` (por exemplo,
[`specs/001-grc-platform-foundation/quickstart.md`](specs/001-grc-platform-foundation/quickstart.md))
são registros históricos de cada fase e podem não refletir o ambiente atual.

Comandos de repositório inteiro (rodam por workspace via `pnpm -r`):

```
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test            # unitários (backend/test/unit, frontend)
pnpm test:integration
pnpm test:contract
```

Migração de banco é sempre pelo workspace da API — nunca `prisma migrate dev` contra um banco
real (`database/prisma/schema.prisma`, cabeçalho): `pnpm --filter @pharos/api exec prisma migrate
deploy`.

## Documentação

- **[docs/HANDOVER.md](docs/HANDOVER.md)** — comece aqui: visão geral, como subir o ambiente, ordem
  de leitura recomendada, conceitos-chave.
- **[docs/STATE.md](docs/STATE.md)** — fotografia do que existe hoje: módulos, o que é parcial ou
  planejado, pendências conhecidas.
- **[docs/README.md](docs/README.md)** — índice completo: arquitetura, ADRs, ambiente local,
  findings, revisões de interface. Ponto de partida real para qualquer trabalho neste repositório.
- **[CLAUDE.md](CLAUDE.md)** / **[AGENTS.md](AGENTS.md)** — regras do produto e de engenharia.
- **[docs/deferred-findings.md](docs/deferred-findings.md)** — registro canônico de defeitos e
  débitos conhecidos, datado e citando evidência. Revalidar contra o código antes de tratar como
  pendente.
- **[docs/local-environment.md](docs/local-environment.md)** — decisões e armadilhas de ambiente
  local (Windows/Docker/Prisma incluídos).

Documentos de arquitetura usam correção por adendo datado, nunca apagam a decisão original —
consulte a data e as anotações posteriores antes de tratar qualquer trecho como estado atual.
