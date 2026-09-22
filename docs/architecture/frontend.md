# Frontend — `apps/web`

Documento de manutenção da aplicação web do PharosGRC: arquitetura do App Router, shell
autenticado, navegação e o Design System (`packages/design-system`). Não é catálogo visual de
componentes — para isso use a Ferramenta de captura renderizada (§6) e o próprio código.

Este documento segue CLAUDE.md §11.1 (idioma pt-BR na interface) e §18 (política de UI/UX
permanente). Todo trecho de código citado aqui foi verificado no código-fonte em
2026-09-14; nomes de arquivo e caminhos são reais, não inventados.

---

## 1. Stack e estrutura do app

- **Next.js 15.5** (`apps/web/package.json`), **App Router** (`src/app/`), React 19, TypeScript.
- **Tailwind CSS 4, configuração CSS-first** — não existe `tailwind.config.js`; o tema é definido
  em `@theme`/`:root` dentro de `packages/design-system/src/styles/globals.css`, importado por
  `apps/web` com um único `@import '@pharos/design-system/styles';`.
- Sem middleware (`middleware.ts` não existe no projeto): a sessão é resolvida em
  `src/app/(app)/layout.tsx`, um Server Component `async` que chama
  `fetchCurrentSession()` (`src/lib/server-session.ts`) encaminhando o cookie da requisição
  recebida (ADR-014) e redireciona para `/login` antes de renderizar qualquer pixel protegido.
- **Origem única** (ADR-014): o navegador só fala com a própria origem do Next.js. `next.config.ts`
  reescreve `/api/:path*` para `API_INTERNAL_URL` (validado em `src/lib/env.ts`) — nunca URL
  absoluta/cross-origin —, então o cookie de sessão httpOnly permanece first-party e não há
  configuração de CORS.

### 1.1 Mapa de rotas

Dois grupos de rota:

- **`src/app/(public)/login/page.tsx`** — tela pública de login.
  A composição visual Proteu, seu símbolo vetorial e a proveniência do asset fornecido estão em
  [Login — referência Proteu](../brand/login-proteus.md). O formulário mantém a leitura direta do
  DOM de D-21, com mostrar/ocultar senha local e bloqueio de submissões concorrentes; endpoints,
  resolução de sessão e redirecionamentos permanecem no fluxo existente.
- **`src/app/(app)/`** — tudo autenticado, renderizado dentro de `AppShell`
  (`src/components/shell/app-shell.tsx`). Cada módulo GRC é um diretório com `page.tsx` (lista) e,
  quando aplicável, `[id]/page.tsx` (detalhe) e `new/page.tsx` (criação):

| Módulo | Rota base | Detalhe | Criação |
|---|---|---|---|
| Dashboard | `/dashboard` | — | — |
| Riscos | `/risks` | `/risks/[id]` | `/risks/new` |
| Ações (plano de ação compartilhado, CLAUDE.md §17 item 15) | `/actions` | `/actions/[id]` | — (criada a partir da origem: risco, achado, etc.) |
| Controles | `/controls` | `/controls/[id]` | `/controls/new` |
| Ativos | `/assets` | `/assets/[id]` | `/assets/new` |
| Processos | `/processes` | `/processes/[id]` | `/processes/new` |
| Incidentes | `/incidents` | `/incidents/[id]` | `/incidents/new` |
| Problemas | `/problems` | `/problems/[id]` | `/problems/new` |
| Compliance | `/compliance` | `/compliance/[frameworkId]`, `/compliance/[frameworkId]/versions/[versionId]`, `/compliance/[frameworkId]/versions/new` | `/compliance/new` |
| Auditoria | `/audits` | `/audits/[auditId]` | `/audits/new` |
| Indicadores | `/indicators` | `/indicators/[metricKey]` | — |
| Relatórios | `/reports` | — (execução em diálogo) | `/reports/new` |
| Administração — Usuários | `/admin/users` | — (diálogos) | — |
| Administração — Papéis | `/admin/roles` | — (painel lateral) | — |
| Administração — Organização | `/admin/organization` | — (árvore) | — |
| Perfil | `/profile` | — | — |

Todas as rotas de `(app)/` acima **existem hoje** (verificado em `find src/app -name page.tsx`);
não há rota "planejada" sem arquivo. A lista de módulos GRC ainda não construídos (Auditoria já
está construída; nada resta pendente do roteiro de CLAUDE.md §1/§17 além de decisão de produto
futura) não aparece aqui porque não tem rota.

### 1.2 Server vs. Client Components

Não há uma regra única "lista é server, detalhe é client" — o padrão real, verificado em
múltiplos módulos (Controles, Riscos, Ativos):

- **Rotas de lista** (`.../page.tsx`) são **Client Components** (`'use client'`) porque o corpo da
  tela lê `useSearchParams()` (o estado do catálogo mora na query string, ver §3.6) — o que o
  Next.js exige dentro de um `<Suspense>`. Exemplo, `src/app/(app)/controls/page.tsx`:

  ```tsx
  'use client';
  // ...
  export default function ControlsPage(): React.JSX.Element {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={controls.register.pageTitle} ... />
        <Suspense fallback={<LoadingState variant="table" rows={10} .../>}>
          <ControlCatalogView />
        </Suspense>
      </div>
    );
  }
  ```

- **Rotas de detalhe** (`.../[id]/page.tsx`) são normalmente **Server Components `async`**, um
  wrapper fino que lê o segmento dinâmico (`params: Promise<{ id: string }>` — API assíncrona do
  Next 15) e delega a um Client Component (`*-detail-view.tsx`) que faz o trabalho de fato.
  Exemplo, `src/app/(app)/controls/[id]/page.tsx`:

  ```tsx
  import { ControlDetailView } from './control-detail-view';

  export default async function ControlDetailPage({
    params,
  }: {
    params: Promise<{ id: string }>;
  }): Promise<React.JSX.Element> {
    const { id } = await params;
    return <ControlDetailView controlId={id} />;
  }
  ```

  O comentário do próprio arquivo explica o motivo: evitar que `ControlDetailView` precise de
  `useParams` (mesma forma usada por `(app)/risks/[id]/page.tsx`).

- **`(app)/layout.tsx`** é o único Server Component que resolve dados de verdade no servidor (a
  sessão). O restante da árvore autenticada — `AppShell`, `Header`, `Sidebar`, todo módulo — é
  Client Component.

### 1.3 Busca de dados

**Não há TanStack Query, SWR nem nenhuma biblioteca de cache de dados** (verificado:
`apps/web/package.json` não lista `@tanstack/react-query` nem `swr`; nenhum arquivo em `src`
importa `useQuery`). O padrão é:

1. Cada módulo de negócio tem seu próprio `src/features/<módulo>/api.ts` — uma camada fina e
   tipada sobre `apiClient` (`src/lib/api-client.ts`), mirrorando as convenções de
   `features/risks/api.ts`.
2. A tela busca dados com `useEffect` + `useState`, guardando `loading`/`error`/`rows` localmente
   e comparando uma "chave de requisição" derivada do estado da URL para saber se o resultado
   exibido corresponde ao pedido atual (`resolvedRequestKey !== requestKey` em
   `control-catalog-view.tsx`). Toda requisição em voo é cancelável por uma flag `cancelled` no
   `useEffect` (evita `setState` depois de desmontar/depois de uma resposta obsoleta chegar por
   último).
3. `apiClient` (ADR-009) normaliza toda resposta de erro não-2xx como RFC 9457
   `application/problem+json` em `ApiProblem` — nunca stack trace, nunca corpo bruto do servidor —
   e uma tela captura `ApiError` para alimentar `ErrorState` do Design System.

### 1.4 Estado — a URL é o estado do catálogo

Todo catálogo/registro (filtros, ordenação, página, tamanho de página, item selecionado para
Quick View) guarda seu estado **na query string**, nunca em `useState` isolado do componente.
O mecanismo comum vive em `src/lib/register/url-state.ts` (`useUrlQueryCommit`,
`useDebouncedSearchParam`) e cada módulo tem seu próprio hook fino por cima
(`src/features/controls/hooks/use-catalog-state.ts` é o exemplo comentado; o mesmo padrão existe
em `risks`, `assets`, `incidents` etc. — cada hook decide apenas o que é conhecimento do próprio
domínio: quais enums, quais campos de `sort`, quais defaults).

Duas regras já documentadas no próprio código, e que valem para qualquer tela nova:

- **`router.replace`, nunca `push`**, para escrever a query string atual — um registro não deve
  empilhar uma entrada de histórico por clique de filtro.
- Mudar filtro/busca/ordenação **reseta a página** (`resetPage` default `true`); mudar apenas
  página, tamanho de página, a visão (cartões/tabela) ou a seleção **não** reseta.

Ver §3.6 para por que essa escrita de query string **não passa pelo `useNavigate`/loader**
institucional.

### 1.5 Loading / erro / vazio

Três estados compartilhados do Design System, usados de forma consistente:

- **`LoadingState`** (`@pharos/design-system/components`) — esqueletos de tabela/cartão/formulário.
  É o indicador de espera mais usado no produto e continua sendo o padrão para conteúdo com forma
  conhecida (uma tabela que vai chegar, um formulário que vai chegar) — **não** foi substituído
  pelo loader institucional (§4).
- **`ErrorState`** — renderiza exatamente o formato `ApiProblem` (título, detalhe, `correlationId`)
  vindo do `apiClient`; nunca mostra o que o servidor não mandou nesse formato.
- **`EmptyState`** — estado vazio de registro/lista, com ação primária quando aplicável.

---

## 2. Shell autenticado

Composição em `src/components/shell/app-shell.tsx`, montada por `(app)/layout.tsx`:

```
AuthProvider (contexto de identidade, alimentado pela sessão resolvida no servidor)
 └─ NavigationPendingProvider (loader institucional, §4)
     ├─ skip link (WCAG 2.4.1)
     ├─ Sidebar
     ├─ Header
     ├─ <main id="main-content"> conteúdo da rota </main>
     ├─ NavigationPendingOverlay
     ├─ SessionExpiredDialog
     └─ PasswordChangeRequiredRedirect
```

- **`data-app-shell`** no contêiner raiz é o seletor que a folha de estilo base usa para travar a
  rolagem do documento (`html`/`body` não rolam; só `<main>` rola) — páginas públicas não têm esse
  marcador e rolam normalmente. Coberto por `e2e/shell-scroll.spec.ts` (F-66/F-67): qualquer
  conteúdo que escape para o `<body>` (uma tabela `sr-only`, um popper do Radix, a região de toast)
  não pode devolver uma segunda barra de rolagem ao documento.

### 2.1 Navegação lateral (`Sidebar`)

`src/components/shell/navigation-registry.ts` é o **único ponto de extensão nomeado** pelo qual um
módulo aparece no menu — `Sidebar` e `Header` renderizam exclusivamente a partir dessa lista, sem
nome de módulo, rota ou ícone fixo em nenhum dos dois. Cada entrada é uma união discriminada
verificada em compilação (`satisfies readonly NavigationEntry[]`):

```ts
// status: 'implemented' — link real
{ id: 'controls', label: shell.navigation.modules.controls, icon: ShieldCheck,
  requiredPermission: 'control:view', status: 'implemented', href: '/controls' }

// status: 'planned' — SEM href; compila erro se tiver href
{ id: 'algum-modulo-futuro', label: ..., icon: ..., status: 'planned' }
```

- `requiredPermission` é **advisory only** (ADR-003) — oculta a entrada quando o chamador não tem a
  permissão, mas o servidor decide de forma independente e incondicional em todo request
  (`src/lib/permissions.ts`, ver aviso no próprio arquivo: "THIS HOOK IS NOT A SECURITY BOUNDARY").
- Entrada `'planned'` nunca vira link morto — aparece desabilitada e claramente rotulada.
- **Hoje, todas as 15 entradas do registro estão `status: 'implemented'`** — não há entrada
  `'planned'` no repositório (verificado lendo o arquivo inteiro); o roteiro de CLAUDE.md §17
  está concluído.
- `src/components/shell/navigation-sections.ts` agrupa visualmente as entradas (Dashboard sem
  cabeçalho, "GRC" e "Administração") **sem** alterar gating/permissão — é camada puramente de
  apresentação sobre o `id` já estável do registro.
- A barra lateral colapsa automaticamente abaixo de 1024px (mesmo breakpoint `lg` que o conteúdo
  da página usa) e a escolha manual do usuário (`userCollapsed`) sobrevive a essa faixa estreita e
  volta ao normalizar a largura — nunca reseta a preferência em silêncio.

### 2.2 Cabeçalho, menu do usuário, tema

- **`Header`** (`src/components/shell/header.tsx`) hospeda o `ThemeToggle` e o `UserMenu`.
- **`ThemeToggle`** (`src/components/shell/theme-toggle.tsx`) usa `next-themes`; os dois ícones
  (Sol/Lua) sempre renderizam e a visibilidade é decidida por CSS reagindo à classe `.dark`
  ancestral — nunca por ramificar em `resolvedTheme` no render (que é `undefined` no primeiro
  render do cliente e produziria flash/mismatch).
- **`UserMenu`** (`src/components/shell/user-menu.tsx`) e o popover de notificações usam links
  reais (`<Link insideDismissingOverlay>`, §4) para preservar clique do meio/"abrir em nova
  aba"/"copiar link", já que o Radix desmonta o conteúdo do menu ao selecionar.
- **Expiração de sessão na interface**: `SessionExpiredDialog`
  (`src/components/shell/session-expired-dialog.tsx`) se registra em
  `setUnauthorizedHandler` (`src/lib/api-client.ts`). Como não existe token para introspecção no
  cliente (ADR-002), um `401` em qualquer chamada é o único sinal — o diálogo abre uma
  reautenticação **no lugar**, sem navegar, então nada que o usuário digitou na tela é perdido;
  só "entrar como outra pessoa" navega de fato para `/login`.
- **Troca de senha obrigatória**: `MandatoryPasswordChangeGuard` no backend nega tudo (exceto uma
  lista mínima) com `403` tipado; `PasswordChangeRequiredRedirect`
  (`src/components/shell/password-change-required-redirect.tsx`) e o próprio `apiClient` tratam
  esse tipo específico levando a `/profile?mustChangePassword=true`.

---

## 3. Navegação (crítico)

PharosGRC tem uma abstração de navegação própria e **obrigatória**, construída em
`specs/014-institutional-loader/`. Ela existe para que o loader institucional (§4) cubra toda
navegação sem que cada tela precise lembrar disso.

### 3.1 O `<Link>` do produto

**`src/components/navigation/link.tsx`** — idêntico a `next/link` em tudo que um chamador observa
(mesmas props, mesmo `<a>` real, mesmo prefetch, mesmo comportamento sob `asChild`/`Slot`). A única
adição é `LinkPendingSignal`, que reporta o `useLinkStatus().pending` do próprio link ao overlay do
shell.

```tsx
// FAZER
import { Link } from '@/components/navigation/link';
<Button asChild><Link href="/controls/new">Novo controle</Link></Button>

// NÃO FAZER — bloqueado por lint (ver §3.3)
import Link from 'next/link';
```

`insideDismissingOverlay` (prop extra) é para um link dentro de um overlay do Radix que desmonta ao
selecionar (menu da conta, popover de notificações) — nesse caso a navegação é delegada ao
`useNavigate()` do shell em vez de depender de `useLinkStatus`, que deixaria de existir no instante
em que a navegação começa.

### 3.2 Navegação programática — `useNavigate()`

**`src/components/shell/navigation-pending.tsx`** exporta `useNavigate()`, substituto de
`useRouter().push/replace/back/refresh`:

```tsx
// FAZER
import { useNavigate } from '@/components/shell/navigation-pending';
const navigate = useNavigate();
navigate('/controls/abc123');
navigate.back();
navigate.refresh();

// NÃO FAZER — bloqueado por lint (ver §3.3)
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/controls/abc123');
```

Fora do shell autenticado (a tela de login) não há provider nem overlay — `useNavigate` degrada
para um `router.push` simples, a navegação acontece, só não mostra nada.

### 3.3 A regra de lint que impede o desvio

`eslint.config.mjs` (raiz do monorepo), bloco escopado a `apps/web/**/*.{ts,tsx,js,jsx}`:

```js
'no-restricted-imports': ['error', { paths: [
  { name: 'next/link', importNames: ['default'],
    message: "Import { Link } from '@/components/navigation/link' instead — ..." },
  { name: 'next/navigation', importNames: ['useRouter'],
    message: "Use useNavigate() from '@/components/shell/navigation-pending' for navigation ..." },
]}]
```

Só dois arquivos têm `eslint-disable-next-line no-restricted-imports` justificado: o próprio
`link.tsx` (é o wrapper) e o próprio `navigation-pending.tsx` (é a porta de `useNavigate`). Todo o
resto do código de `apps/web` importa através dessas duas portas — **59 arquivos** migraram quando
a regra foi introduzida (`specs/014-institutional-loader/STATE.md` §5).

**O que quebra se alguém contornar a abstração**: uma tela que importe `next/link`/`useRouter`
diretamente passa a navegar **fora** do mecanismo que o loader institucional lê — nenhum erro
aparece, a navegação funciona normalmente, mas essa tela específica nunca mostra o indicador de
espera numa navegação lenta, silenciosamente. Foi por isso que a cobertura virou regra de lint em
vez de convenção documentada (medido: convenção sozinha não escala).

### 3.4 Por que não `loading.tsx`

Avaliado e descartado com medição em build de produção
(`specs/014-institutional-loader/STATE.md` §2.1.1): o `loading.tsx` nativo por segmento pisca
(32ms de flash numa navegação rápida, sem atraso próprio), **substitui** a tela anterior em vez de
sobrepor (o `<main>` medido durante uma navegação lenta continha o texto do fallback, não a tela de
origem), e faz `useLinkStatus` voltar a `false` na hora — o loader institucional simplesmente nunca
apareceria com um `loading.tsx` presente. Não existe `loading.tsx` em rota alguma do repositório.

### 3.5 Atualização de query string NÃO é navegação

Os dez+ hooks de estado de catálogo (§1.4) continuam chamando `router.replace(pathname?query)`
diretamente, com `eslint-disable-next-line no-restricted-imports` explicando o motivo em cada
arquivo: escrever a query string da **tela atual** (filtro, ordenação, paginação) não é trocar de
tela, e levantar um loader de página inteira sobre uma mudança de filtro seria um defeito, não uma
melhoria. `src/lib/register/url-state.ts` é o único lugar que faz essa chamada — nenhum módulo novo
deve reimplementá-la.

### 3.6 O sinal em si

Dois sinais do próprio roteador, agregados em um overlay:

1. `useLinkStatus()` (Next 15.3+), lido de dentro do `<Link>` que iniciou a navegação.
2. `useTransition()` em volta de `router.push`, vivendo no `NavigationPendingProvider` (nunca
   desmonta), entregue como `useNavigate()` — cobre navegação que o produto dispara sozinho (após
   criar um registro, ao sair, na expiração de sessão).

`NavigationPendingOverlay` só aparece depois de um atraso de 200ms (`useDelayedVisibility`,
`packages/design-system/src/lib/use-delayed-visibility.ts`, genérico — serve qualquer espera, não
só navegação) e permanece visível por no mínimo 400ms uma vez mostrado, para não piscar. Cobre
`absolute inset-0` dentro do invólucro do `<main>` — nunca a barra lateral, que continua utilizável
para uma segunda navegação substituir a primeira.

Cobertura provada por `apps/web/e2e/navigation-loader.spec.ts` (11 cenários: barra lateral, cartão
do Dashboard, linha de registro, botões que são links, menu da conta/notificações, navegação
programática, voltar/avançar sem loader preso, teclado, `prefers-reduced-motion`).

---

## 4. Design System

### 4.1 Quatro camadas, cada uma com um critério de "o que entra aqui"

| Camada | Caminho | O que vive aqui | Critério |
|---|---|---|---|
| Primitivos shadcn/ui | `apps/web/src/components/ui/` | Botão, Input, Dialog, Select, Tabs, Tooltip, Command, Sheet... gerados pelo CLI do shadcn (`apps/web/components.json`) | Mantidos byte-idênticos à saída do CLI, **exceto** seis arquivos deliberadamente modificados por acessibilidade/idioma (D-15 em `docs/local-environment.md`): `dialog.tsx`, `select.tsx`, `avatar.tsx`, `sheet.tsx`, `checkbox.tsx`, `table.tsx`. Não regenerar esses seis às cegas. |
| Design System | `packages/design-system/src/components/` | Padrões compostos reutilizáveis entre módulos: `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog`, `StatusBadge`, `DataTable` e o resto de `data-table/`, `RiskLevelBadge`/`RiskMatrix`/`RiskScore`, `form/` (`FormField`, `FormSection`, `SearchablePicker`), `entity/` (`EntityHeader`, `EntityTabs`), `timeline/`, `collaboration/`, `DisclosureGroup`, `MetricCard`, `TrendChart`, `PharosLoader` | Reuso por **2 ou mais módulos**; nenhum conhecimento de domínio de negócio; nenhuma chamada de API própria; **nenhuma string voltada ao usuário hardcoded** — todo texto entra por prop (D-10) |
| Compartilhado de app | `apps/web/src/components/` | `shell/` (App Shell inteiro), `navigation/link.tsx`, `directory/` (`UserPicker`, `UserMultiSelectFilter` — busca de usuário no diretório), `register/` (`SortSelect`, `ToolbarSelect`) | Reusado entre módulos, mas acoplado à aplicação Next.js (rotas, sessão, mensagens pt-BR) — não pode viver no Design System porque depende de `apps/web` |
| Módulo específico | `apps/web/src/features/<módulo>/` | `api.ts`, `types.ts`, `hooks/`, `components/` — tudo que só aquele domínio conhece | Conhecimento de domínio (enums, regras de negócio, formato de código) |

`UserPicker` é um exemplo concreto do porquê da camada 3: é um adaptador fino sobre
`SearchablePicker` do Design System, mas conhece o endpoint `GET /users` e a lógica de
`assignableForOrgUnitId` — conhecimento de aplicação/domínio, então mora em `apps/web`, não no
pacote (`specs/013-stabilization-audit/STATE.md` §4.5).

O pacote **nunca** depende de `apps/web` — a direção de dependência é sempre a mesma
(`packages/design-system/README.md`).

### 4.2 Tokens e tema

`packages/design-system/src/tokens/` (`colors.ts`, `spacing.ts`, `typography.ts`, `radius.ts`,
`elevation.ts`, `motion.ts`) e os custom properties CSS em `src/styles/globals.css`. Tema claro/
escuro inteiramente por classe `.dark` num ancestral, aplicada por `next-themes`
(`src/components/shell/theme-provider.tsx`) — nunca por `prefers-color-scheme` isolado nem por
filtro CSS sobre um asset de marca (ver §2.1 do STATE do Dashboard: `invert()`/`brightness()` foi
tentado e descartado porque transformava o marinho da marca em laranja).

### 4.3 Padrões compartilhados e onde ficam

Sem catalogar prop a prop (ver o próprio arquivo para a API completa); apenas o quê e quando usar:

- **`PageHeader`** (`components/page-header.tsx`) — título, descrição e ações de uma tela; todo
  `page.tsx` de lista usa.
- **`LoadingState` / `EmptyState` / `ErrorState`** (`components/loading-state.tsx`,
  `empty-state.tsx`, `error-state.tsx`) — os três estados de §1.5.
- **`DataTable` e a família `data-table/`** (`FilterBar`, `MultiSelectFilter`,
  `ColumnVisibilityMenu`, `PaginationFooter`, `ResultsToolbar`, `ViewToggle`, tipos
  `SortingState`/`VisibilityState`) — wrapper sobre `@tanstack/react-table`
  (`@tanstack/react-table` 8.21.3, `packages/design-system/package.json`). Nunca
  ordena/filtra/pagina no cliente — cada tela busca só a página atual do servidor. `FilterBar`
  (modo `collapsible`), `MultiSelectFilter` e `ColumnVisibilityMenu` são disclosures cujo
  painel/popover permanece **presente em toda passagem de render**, ocultado com o atributo
  `hidden` enquanto fechado — nunca desmontado (F-71, corrigido; ver a regra geral logo abaixo).
  Comportamento coberto diretamente, não só por indireção de tela, em
  `apps/web/src/components/design-system-register-chrome.test.tsx`.

**Regra prática para quem estende o Design System**: um elemento referenciado por `aria-controls`
(disclosure, popover, painel de filtro, menu) precisa **existir em toda passagem de render** —
oculte com o atributo `hidden`, nunca desmonte o elemento referenciado enquanto o controle que o
abre continua montado. `@axe-core/playwright` não pega essa classe de defeito sozinho: a regra
`aria-valid-attr-value` rebaixa para "needs review" (não falha) qualquer elemento que também carregue
`aria-haspopup` — foi exatamente por isso que `MultiSelectFilter`/`ColumnVisibilityMenu` chegaram a
produção com o mesmo defeito de `FilterBar` sem nenhum portão deste projeto acusar (F-71/F-74, ver
`docs/guides/testing.md` §1.6 e `docs/guides/troubleshooting.md`).
- **`ConfirmDialog`** (`components/confirm-dialog.tsx`) — confirmação destrutiva/irreversível
  padrão, com restauração de foco (34 chamadores, corrigido em `specs/013-stabilization-audit`
  S-04/F-62 — ver §4.5).
- **Formulários** — `react-hook-form` (7.87) + `zodResolver` (`@hookform/resolvers/zod`) + schema
  Zod em `apps/web/src/lib/validation/<domínio>.ts`. `FormField`/`FormSection`
  (`components/form/`) são os invólucros compartilhados; `SearchablePicker` é a base genérica que
  `UserPicker` (camada de app) especializa. Exemplo real:
  `apps/web/src/features/assets/components/asset-form.tsx` (`useForm` + `Controller` +
  `zodResolver(assetFormSchema)`).
- **`StatusBadge`** (`components/status-badge.tsx`) e **`RiskLevelBadge`**
  (`components/risk/risk-level-badge.tsx`) — cor **nunca** é o único sinal: `StatusBadge` sempre
  renderiza um ícone (`CircleCheck`/`CircleAlert`/`CircleX`/`Info`/`MinusCircle`) junto com o rótulo
  textual obrigatório (CLAUDE.md §18.8, FR-091/SC-012 no próprio comentário do componente).
- **Toasts** — `FeedbackProvider`/`feedback` (`apps/web/src/components/shell/feedback-provider.tsx`),
  invólucro único sobre `sonner`; nenhuma tela deve importar `sonner`'s `toast` diretamente — é
  assim que os rótulos de acessibilidade em pt-BR (`closeButtonAriaLabel`/`containerAriaLabel`) e o
  comportamento ficam uniformes.
- **Card/KPI** — `MetricCard`, `SummaryStatCard`, `TrendChart`, `ThresholdBreachBadge`
  (`packages/design-system/src/components/`) — usados por Dashboard e telas de Indicadores.
- **Timeline/colaboração** — `timeline/` (`ActivityHistory`, `AuditTimeline`) e `collaboration/`
  (`CommentThread`, `AttachmentList`) — usados pelo painel de Evidência/Comentário/Anexo que
  aparece nos vários domínios GRC (núcleo compartilhado, CLAUDE.md §19.6).
- **`DisclosureGroup`** (`components/disclosure-group.tsx`) — seção recolhível com título
  obrigatório por prop e `meta` opcional (ex.: contagem). Ao contrário de
  `FilterBar`/`MultiSelectFilter`/`ColumnVisibilityMenu`, o conteúdo **desmonta** quando fechado —
  o mesmo mecanismo latente que produziu F-71 existe aqui (o botão referencia o conteúdo por
  `aria-controls`, que pode não existir dependendo de onde a hidratação deslocar o `useId`
  posicional), e **não foi corrigido**: o consumidor real é o catálogo de permissões por módulo do
  detalhe de papel, e montá-lo sempre — só ocultando com `hidden` — montaria esse catálogo inteiro
  em toda carga de tela. Troca deliberada, registrada em `docs/STATE.md` §8 (CLAUDE.md §16), não
  pendência esquecida — mas não copiar este componente como referência do padrão correto de
  disclosure; siga `FilterBar`/`MultiSelectFilter`/`ColumnVisibilityMenu` para isso.

### 4.4 Diálogos e foco

Todo diálogo modal (`Dialog`, `Sheet`, `ConfirmDialog`) usa o mesmo mecanismo de restauração de
foco, `useDialogFocusRestore` (`packages/design-system/src/lib/use-restore-focus.ts`): captura
`document.activeElement` na **fase de render**, via um componente-âncora montado como primeiro
filho do conteúdo do diálogo — antes de qualquer `autoFocus` de campo interno tomar o foco, e antes
de um item de menu que abriu o diálogo desmontar durante a animação de saída do menu. Se o elemento
capturado estiver dentro de `[role="menu"]`, é resolvido para o próprio gatilho do menu via
`aria-labelledby`. `DialogContent` tem `max-h-[90vh] overflow-y-auto` por padrão, sobrescrevível via
`className` (merge de classes Tailwind pelo `cn`). Histórico completo em
`docs/local-environment.md` D-15 e `specs/013-stabilization-audit/STATE.md` §4.3.

---

## 5. Mensagens pt-BR

`apps/web/src/lib/messages/` — um arquivo por área (`risks.ts`, `controls.ts`, `assets.ts`,
`incidents.ts`, `problems.ts`, `processes.ts`, `compliance.ts`, `audit-engagements.ts`,
`findings.ts`, `evidence.ts`, `actions.ts`, `indicators.ts`, `reports.ts`, `admin.ts`, `auth.ts`,
`common.ts`, `dashboard.ts`, `errors.ts`, `profile.ts`, `shell.ts`, `validation.ts`), cada um
`as const` — uma chave inexistente ou com typo é erro de compilação, não `undefined` renderizado.

Para adicionar uma string nova: editar/estender o arquivo da área correspondente (ou criar um
novo, se for um módulo novo) e importar a fatia específica
(`import { controls } from '@/lib/messages/controls'`) — nunca embutir o literal no componente
(CLAUDE.md §11.1). `packages/design-system` **não** depende deste catálogo — seus componentes
recebem todo texto por prop.

**Rótulo de exibição de papel semeado**: `common.roleDisplayNames` (`apps/web/src/lib/messages/common.ts`)
é o **único** catálogo pt-BR dos doze papéis semeados — cross-cutting porque Administração →
Papéis e Perfil imprimem o mesmo nome, então vive em `common.ts`, não em `admin.ts`. O ponto de
tradução é `apps/web/src/lib/role-display-name.ts` (helper puro, ao lado de `lib/permissions.ts`),
que resolve com `Object.hasOwn` — um papel customizado (não seedado) imprime exatamente como
digitado, nunca `undefined`. Antes de 2026-09-14 existiam dois mapas (`admin.roles.displayNames` e
`profile.identity.roleLabels`, este cobrindo só seis dos doze papéis); o segundo foi removido, não
aliás — Perfil exibia os outros seis em inglês sem nenhum teste falhar, porque um `Record` com
fallback silencioso nunca acusa entrada faltando. Duas guardas estruturais protegem contra
recorrência: `apps/web/src/lib/role-display-name.single-catalogue.test.ts` (varre a árvore de
produção e falha se qualquer arquivo fora do catálogo canônico chavear um objeto por nome de papel
semeado) e `apps/web/src/app/(app)/profile/profile-view.test.tsx` (monta a tela real e afirma pt-BR
para os doze papéis, nenhum nome em inglês armazenado, e um papel customizado impresso como
digitado).

**`src/lib/messages/index.ts` está desatualizado**: reexporta apenas
`actions/admin/auditEngagements/auth/common/dashboard/errors/evidence/findings/indicators/profile/reports/risks/shell/validation` — **não** inclui `assets`, `compliance`, `controls`,
`incidents`, `problems` ou `processes`, embora esses seis arquivos existam e sejam usados
normalmente por import direto (`@/lib/messages/controls` etc.) em todo o código. Isso não quebra
nada hoje porque nenhum módulo depende do agregado `messages.*` para essas seis áreas, mas é uma
inconsistência real entre o comentário do arquivo ("every user-facing string... lives in one
place") e o que o arquivo de fato agrega — reportado aqui, não corrigido (fora do escopo desta
tarefa de documentação).

**Teste-guarda**: `src/lib/messages/no-internal-identifiers.test.ts` varre todos os catálogos
procurando identificadores internos (`FR-\d+`, `SC-\d+`, `ADR-\d+`, `T\d+`, `US\d`) dentro de
string literais que chegam à tela — não em comentários, onde citar um requisito continua sendo
prática correta. Nasceu de um defeito real: `FR-012` apareceu literalmente na tela de Ativos.

---

## 6. Acessibilidade e responsividade

- **`@axe-core/playwright`** contra a aplicação renderizada de verdade (nunca markup estático) —
  `apps/web/e2e/accessibility.spec.ts` roda as tags `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` e
  falha em qualquer violação encontrada nessas tags (exceções só por id, citadas explicitamente
  com o achado que as justifica — nunca por enfraquecer o `expect`). Cada cenário roda **nos dois
  temas** — claro (default) e escuro, semeado via `localStorage` antes da hidratação
  (`gotoWithDarkTheme`), não via manipulação de classe pós-`goto` (que só funcionava antes de
  existir `ThemeProvider`).
- **`apps/web/e2e/shell-scroll.spec.ts`** — geometria de rolagem do shell (§2): documento nunca
  rola, só `<main>`; nada que escape para `<body>` pode produzir uma segunda barra de rolagem.
- **`apps/web/e2e/navigation-loader.spec.ts`** — cobertura do loader institucional, incluindo
  `prefers-reduced-motion` (arcos estáticos e completos, sem animação).
- **Viewports suportados**: capturas e specs cobrem largura desktop (1440px/1920px), tablet
  (768px–1024px, breakpoint `lg` do shell) e mobile (390px) — ver `Sidebar` (§2.1) para o
  comportamento de colapso automático abaixo de 1024px.
- **Foco visível e navegação por teclado**: skip link (`#main-content`, WCAG 2.4.1) no topo do
  shell; `<main>` tem `tabIndex={0}` para satisfazer `scrollable-region-focusable` quando é
  rolável mas não tem conteúdo interativo próprio; restauração de foco em todo diálogo (§4.4).
- **Ferramenta de captura renderizada** (CLAUDE.md §18.13):
  `apps/web/scripts/ui-capture.mjs`.

  ```
  node scripts/ui-capture.mjs <dir-de-saida> [--theme=light|dark] [--width=1440]
  ```

  Existe também um modo `--surface=roles` para revisão de uma única tela em múltiplas larguras sem
  provisionar o conjunto inteiro de fixtures do sweep padrão — ver o cabeçalho do próprio script.
  Armadilhas já pagas (repetidas de CLAUDE.md §18.13, não reescritas aqui): usar
  `waitUntil: 'networkidle'` antes de preencher formulário; rótulos exatos com `getByLabel`, nunca
  regex ampla; `--theme=dark` não é `colorScheme` do browser — o script dirige o `ThemeToggle` real
  depois do login, porque o tema é uma classe `.dark` do `next-themes`, não
  `prefers-color-scheme`; `--height` maior que a página quando ela for mais alta que uma janela,
  senão o `fullPage` do Playwright pode produzir uma faixa em branco que parece defeito de layout
  e não é.

---

## 7. Checklist para uma nova tela

Referência: o módulo **Controles** (`src/app/(app)/controls/`,
`src/features/controls/`) é o exemplo mais representativo de lista+detalhe hoje — comentários no
próprio código dizem explicitamente "mirroring `risk-register-view.tsx`"/"mirroring
`features/risks/hooks/use-register-state.ts` exactly", ou seja, é a aplicação deliberada do padrão
estabelecido por Riscos (CLAUDE.md §18.12), não uma variação. Uma tela nova de catálogo+detalhe
copia a forma deste módulo (ou do de Riscos, a origem do padrão):

1. **Rota** — `src/app/(app)/<módulo>/page.tsx` (lista, `'use client'`, `<Suspense>` em volta da
   view que lê `useSearchParams`) e `src/app/(app)/<módulo>/[id]/page.tsx` (detalhe, Server
   Component `async` que só lê `params` e delega a um `*-detail-view.tsx`).
2. **`src/features/<módulo>/api.ts`** — camada fina sobre `apiClient`, tipada contra
   `@pharos/api-types` quando existir contrato gerado.
3. **`src/features/<módulo>/types.ts`** — tipos do domínio (não confundir com os do contrato REST
   se forem gerados separadamente).
4. **`src/features/<módulo>/hooks/use-catalog-state.ts`** (ou nome equivalente) — estado do
   catálogo na URL, construído sobre `useUrlQueryCommit`/`useDebouncedSearchParam`
   (`@/lib/register/url-state`) — nunca reimplementar o commit/debounce.
5. **`src/features/<módulo>/components/`** — `*-catalog-view.tsx` (busca com `useEffect`,
   `PageHeader`, `ResultsToolbar`, `DataTable`/cartões, `PaginationFooter`, `LoadingState`/
   `ErrorState`/`EmptyState`), `*-register-columns.tsx`, `*-register-filters.tsx`, `*-form.tsx`
   (react-hook-form + Zod), `*-detail-view.tsx`.
6. **`src/lib/validation/<módulo>.ts`** — schema Zod do formulário.
7. **`src/lib/messages/<módulo>.ts`** — todo texto da tela, em pt-BR, nada embutido no componente.
8. **`src/components/shell/navigation-registry.ts`** — uma entrada nova, com ícone Lucide,
   `requiredPermission` e `href` (nunca tocar em `Sidebar`/`Header`/`(app)/layout.tsx` para isso).
9. **Navegação** — sempre `@/components/navigation/link` e `useNavigate()`
   (`@/components/shell/navigation-pending`), nunca `next/link`/`useRouter` diretamente (§3).
10. **Testes** — unitário de componente (Vitest + Testing Library) para formulário/colunas/estado;
    E2E (Playwright) cobrindo o fluxo principal, escopo organizacional quando aplicável, e
    incluído na varredura de `accessibility.spec.ts` se for uma superfície nova relevante.
11. **Verificação renderizada** (CLAUDE.md §18.1/§18.11) — capturar com `ui-capture.mjs` nos dois
    temas antes de considerar a tela concluída; passar pelo portão de aceitação visual de §18.11.

---

## Referências

- `docs/architecture/decisions.md` — ADRs citadas aqui (ADR-002 sessão, ADR-003 autorização,
  ADR-009 erros, ADR-014 origem única).
- `docs/local-environment.md` — D-9 (Design System sem test runner próprio), D-10 (strings só por
  prop), D-15 (seis primitivos shadcn modificados), D-16 (build vs. dev server), D-21 (hidratação
  do formulário de login).
- `specs/014-institutional-loader/STATE.md` — decisão e medição completas do loader institucional.
- `specs/011-dashboard-platform-view/STATE.md` — Dashboard como visão de plataforma, marca por
  tema.
- `specs/013-stabilization-audit/STATE.md` — foco em diálogos, `DataTable`, `UserPicker`,
  Turbopack em desenvolvimento, achados adiados (F-64 a F-66).
- `packages/design-system/README.md` — convenções do pacote (build, exports, Tailwind CSS 4).

### Extensões de composição do registro — Riscos V2 (2026-09-20)

`FilterBar.searchTrailing` é um slot opcional para controles de apresentação ao lado
da busca no modo recolhível. Esses controles permanecem disponíveis com os filtros
fechados. `PaginationFooter.showPageSize` e `DataTable.showPageSize` têm padrão
`true`; Riscos passa `false` porque oferece o mesmo seletor, com o mesmo estado de
URL, na linha de resultados. Outros consumidores mantêm o comportamento anterior.
Os testes de `design-system-register-chrome.test.tsx` cobrem os padrões e as opções.
