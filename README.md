# Vértice GRC

Plataforma corporativa de Governança, Riscos e Compliance. Interface em português do Brasil,
com módulos de riscos, controles, compliance, auditoria, ativos, processos, incidentes,
problemas, indicadores e relatórios, apoiados pelo núcleo compartilhado de evidências e ações.

Esta distribuição contém configurações genéricas e destina-se a um banco novo. Consulte
[o escopo da publicação](docs/github-publication.md) antes de reaproveitar configurações ou
migrações de outra instalação.

## Para começar

Use Node.js 22 ou superior, a versão de pnpm fixada em `package.json` e Docker para os serviços
locais. O [guia de desenvolvimento](docs/guides/development.md) descreve configuração, execução
e testes.

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
docker compose --profile local-db up -d postgres redis
```

Os valores do `.env.example` são apenas para desenvolvimento local. `.env` e arquivos reais de
segredos ficam fora do Git. Runtime usa o papel PostgreSQL restrito `vertice_app`; migrações usam
`vertice_owner`, com uma URL distinta. Nenhum comando de publicação migra ou acessa uma
instalação existente.

## Stack e estrutura

NestJS e TypeScript na API, Next.js com Tailwind e shadcn/ui no frontend, PostgreSQL com Prisma,
Redis, REST/OpenAPI, Vitest e Playwright. Docker e Docker Compose empacotam os serviços.

| Diretório | Conteúdo |
|---|---|
| `frontend/` | Aplicação web, Design System e testes de navegador. |
| `backend/` | API, serviços de aplicação, núcleo GRC e testes. |
| `database/` | Schema Prisma, migrações e inicialização PostgreSQL. |
| `packages/api-types/` | Tipos do contrato OpenAPI compartilhados. |
| `docker/` e `k8s/` | Empacotamento e exemplos de implantação. |
| `specs/` | Especificações, contratos e registros de cada fase. |
| `docs/` | Guias e documentação de arquitetura disponíveis nesta distribuição. |

## Validação

```powershell
pnpm --filter @vertice/api-types build
pnpm --filter @vertice/design-system build
pnpm typecheck
pnpm lint
pnpm test:unit
```

Integração, contrato e E2E precisam de serviços isolados. Seus testes de banco aplicam migrações
e limpam tabelas; use exclusivamente um banco descartável terminado em `_test`, conforme o guia.

## Documentação

- [Índice](docs/README.md).
- [Desenvolvimento local](docs/guides/development.md).
- [Banco de dados](docs/architecture/database.md).
- [Frontend](docs/architecture/frontend.md).
- [Mapa do backend](docs/architecture/backend-map.md).
- [Distribuição para GitHub](docs/github-publication.md).
- [Regras de engenharia](AGENTS.md) e [políticas do produto](CLAUDE.md).

As especificações em `specs/` preservam decisões e critérios de cada fase. Os registros históricos
podem referenciar artefatos que não fazem parte desta distribuição; o índice lista os documentos
atuais disponíveis.
