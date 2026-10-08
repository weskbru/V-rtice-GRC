# Frontend

Status: descreve a estrutura atual do frontend.

## Estrutura

O frontend está no diretório raiz `frontend/`, separado dos diretórios `backend/` e `database/`.

| Caminho | Responsabilidade |
|---|---|
| `frontend/src/app/` | Rotas Next.js e composição das páginas. |
| `frontend/src/features/` | Funcionalidades e telas organizadas por domínio de produto. |
| `frontend/src/components/` | Shell, navegação e componentes próprios da aplicação. |
| `frontend/src/lib/` | Cliente HTTP, autenticação, mensagens e utilitários compartilhados pela interface. |
| `frontend/e2e/` | Suítes Playwright e seus auxiliares. |
| `frontend/packages/design-system/` | Tokens e componentes compartilhados de interface, no pacote `@pharos/design-system`. |
| `packages/api-types/` | Tipos gerados do contrato OpenAPI, compartilhados entre frontend e backend. |

O pacote Next.js conserva o identificador `@pharos/web`; comandos pnpm que filtram por esse nome
continuam válidos após a mudança de diretório.

## Integração com a API

A interface usa REST e consome os tipos do pacote `@pharos/api-types`. O `next.config.ts` encaminha
`/api/*` para `API_INTERNAL_URL`, configurada pelo ambiente. Regras de autorização e validação de
negócio permanecem no backend.

## Workspace e empacotamento

O workspace pnpm inclui `frontend` e `frontend/packages/*`. O pacote `@pharos/design-system` é uma
dependência do frontend; `packages/api-types` permanece no nível raiz por ser compartilhado com o
backend. O container web é construído por `docker/web.Dockerfile` a partir do contexto da raiz do
repositório.

Comandos usuais:

```sh
pnpm --filter @pharos/web dev
pnpm --filter @pharos/web test
pnpm --filter @pharos/web test:e2e
```
