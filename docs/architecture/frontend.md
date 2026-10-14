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
| `frontend/packages/design-system/` | Tokens e componentes compartilhados de interface, no pacote `@vertice/design-system`. |
| `packages/api-types/` | Tipos gerados do contrato OpenAPI, compartilhados entre frontend e backend. |

O pacote Next.js conserva o identificador `@vertice/web`; comandos pnpm que filtram por esse nome
continuam válidos após a mudança de diretório.

## Integração com a API

A interface usa REST e consome os tipos do pacote `@vertice/api-types`. O `next.config.ts` encaminha
`/api/*` para `API_INTERNAL_URL`, configurada pelo ambiente. Regras de autorização e validação de
negócio permanecem no backend.

## Identidade da interface

A marca apresentada ao usuário é **Vértice GRC**, com textos em pt-BR centralizados em
`frontend/src/lib/messages/`. Nome, descrição e título do login vêm do catálogo `auth.ts`;
o shell usa o catálogo `shell.ts`.

O símbolo é um V geométrico vetorial, em duas faces, usado pelo login e pelo shell em
`frontend/src/components/branding/vertice-symbol.tsx`. As cores seguem os tokens de marca do
Design System, inclusive no tema escuro. O carregador mantém o V e anima três pequenos losangos;
`prefers-reduced-motion` desativa a animação sem esconder o indicador ou seu rótulo acessível.

Os SVGs positivos e invertidos ficam em `frontend/public/brand/`; o favicon é
`/brand/favicon.svg`. O wordmark da aplicação é texto, para preservar tipografia e acessibilidade.
O login usa geometria decorativa em SVG e conteúdo genérico sobre governança, sem identidade de
uma instituição ou imagem astronômica. Capturas autenticadas exigem `SEED_ADMIN_EMAIL` e
`SEED_ADMIN_PASSWORD` fornecidos pelo ambiente, sem conta institucional predefinida.

## Workspace e empacotamento

O workspace pnpm inclui `frontend` e `frontend/packages/*`. O pacote `@vertice/design-system` é uma
dependência do frontend; `packages/api-types` permanece no nível raiz por ser compartilhado com o
backend. O container web é construído por `docker/web.Dockerfile` a partir do contexto da raiz do
repositório.

Comandos usuais:

```sh
pnpm --filter @vertice/web dev
pnpm --filter @vertice/web test
pnpm --filter @vertice/web test:e2e
```
