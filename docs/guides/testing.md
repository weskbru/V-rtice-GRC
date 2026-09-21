# Testes

Fonte de verdade para estratégia de testes do PharosGRC: onde cada suíte vive, como rodar cada uma,
que ambiente ela exige, e o que o CI executa. Descreve os mecanismos que o código e a configuração
implementam hoje — não é um relatório de execução, e não afirma que qualquer suíte está "verde" no
momento da leitura. Para contagens de passagem/falha específicas de uma rodada, ver
`docs/deferred-findings.md` (achados F-*) e os `STATE.md` de cada fase em `specs/`.

Setup do ambiente (instalação, variáveis, bootstrap de um clone limpo) está em
`docs/guides/development.md` e `docs/local-environment.md` (D-1..D-23) — este documento assume o ambiente
já provisionado e foca em **como testar**.

---

## 1. Mapa das suítes

| Camada | Onde fica | Convenção de nome | Comando |
|---|---|---|---|
| Unitário (API) | `apps/api/test/unit/**/*.spec.ts`, `apps/api/src/**/*.spec.ts` | `<assunto>.spec.ts` | `pnpm --filter @pharos/api run test:unit` |
| Unitário (Web) | `apps/web/src/**/*.test.{ts,tsx}` (colocado junto do código) | `<arquivo>.test.tsx` | `pnpm --filter @pharos/web run test:unit` |
| Integração (API) | `apps/api/test/integration/**/*.spec.ts` | `<assunto>.spec.ts` | `pnpm --filter @pharos/api run test:integration` |
| Contrato (API) | `apps/api/test/contract/**/*.spec.ts` | `<recurso>.spec.ts` | `pnpm --filter @pharos/api run test:contract` |
| E2E (navegador) | `apps/web/e2e/*.spec.ts` | `<fluxo>.spec.ts` | `pnpm --filter @pharos/web run test:e2e` |
| Acessibilidade | `apps/web/e2e/accessibility.spec.ts` (dentro da suíte E2E, não uma suíte separada) | — | mesmo comando acima, filtrando o arquivo |
| Guardas estruturais | espalhadas em `apps/api/test/unit/*-guard.spec.ts`, `*-boundary.spec.ts`, `*-no-delete*.spec.ts`, `contract-coverage.spec.ts` | ver §2/§3 | mesmos comandos de unitário/contrato |

`packages/design-system` **não tem executor de teste próprio, por decisão** (D-9,
`docs/local-environment.md`): seus componentes são montados e testados a partir de
`apps/web/src/components/design-system.test.tsx`, através do barrel `@pharos/design-system/components`,
usando o Vitest + Testing Library de `apps/web`. Não crie um segundo executor dentro do pacote —
adicione o teste do novo componente a esse arquivo.

### 1.1 Unitário — API

- **Onde**: `apps/api/test/unit/**/*.spec.ts` (a maioria) e ocasionalmente `apps/api/src/**/*.spec.ts`
  (mesmo diretório do código, quando faz sentido para um teste muito próximo da unidade — ambos os
  padrões estão no `include` de `apps/api/vitest.config.ts`).
- **Convenção**: `<assunto-em-kebab-case>.spec.ts`. Casos de uso ganham sufixo `.usecase.spec.ts`
  (ex.: `create-report-definition.usecase.spec.ts`); entidades de domínio, `.entity.spec.ts`.
- **Quando criar**: para toda regra de domínio pura — sem I/O, sem banco, sem container Nest. Matriz
  de pontuação de risco, tabela de transição de ciclo de vida, regra de SoD, política de senha,
  resolução de conjunto de escopo, cálculo de indicador, classificação de mapeamento, etc.
- **Comando**: `pnpm --filter @pharos/api run test:unit` (equivale a `vitest run test/unit`).
  `pnpm --filter @pharos/api run test` roda `vitest run` puro, que hoje resolve para o mesmo
  `include` de `vitest.config.ts` (`test/unit/**/*.spec.ts` + `src/**/*.spec.ts`) — **nunca** aponta
  para `test/integration`/`test/contract`, que têm configs (e `globalSetup`) próprios. Esse `include`
  foi deliberadamente estreitado (ver o cabeçalho de `apps/api/vitest.config.ts`) depois que o glob
  amplo `test/**/*.spec.ts` passou a casar também com specs de integração/contrato quando alguém
  rodava `vitest run` puro — sem o `globalSetup` (migração + reset) dessas suítes, contra qualquer
  `DATABASE_URL` que estivesse setada no momento.
- **Ambiente**: nenhum — `environment: 'node'`, sem banco, sem Redis, sem container Nest
  (`passWithNoTests: true`, `globals: false`).
- **Dependências de build**: se o teste importa `@pharos/api-types` (via `dist/`, não via alias de
  path) ou é executado no CI logo após um checkout limpo, `packages/api-types` precisa estar
  compilado primeiro (`pnpm --filter @pharos/api-types run build`) — ver
  `test/unit/api-types-dist-resolution.spec.ts` em §3.

### 1.2 Unitário — Web

- **Onde**: `apps/web/src/**/*.test.{ts,tsx}`, colocado ao lado do arquivo que testa (ex.:
  `src/app/(app)/dashboard/page.test.tsx`, `src/app/(app)/profile/profile-view.test.tsx`). Não há um
  diretório `test/` separado para esta suíte.
- **Convenção**: `<arquivo>.test.tsx` (componente/página) ou `.test.ts` (lib/hook puro).
- **Quando criar**: para todo componente de apresentação, hook, função de `src/lib/` e lógica de
  formulário/estado que não dependa de um navegador real (Radix com portal/pointer-capture pesado é
  coberto por Playwright, não aqui — ver o comentário de cabeçalho de
  `apps/web/vitest.config.ts`).
- **Comando**: `pnpm --filter @pharos/web run test:unit` (idêntico a `test`, ambos `vitest run`).
- **Ambiente**: `jsdom` (`apps/web/vitest.config.ts`), com `setupFiles: ['./vitest.setup.ts']`.
  `vitest.setup.ts` registra `cleanup()` do Testing Library manualmente em `afterEach` (necessário
  porque `test.globals` está desligado — o auto-registro do Testing Library depende de um
  `afterEach` global) e faz polyfill mínimo de `ResizeObserver`/`hasPointerCapture` para primitivos
  Radix.
- **Dependência de build**: importa o **pacote compilado** `@pharos/design-system` (`dist/`, que é
  gitignored) — em um clone limpo ou no CI, rode `pnpm --filter @pharos/design-system run build`
  antes, ou toda importação de `@pharos/design-system/components` falha em cascata (D-22 Trap 1,
  `docs/local-environment.md`: medido diretamente, 77 de 110 arquivos falhando com
  `Failed to resolve import`, corrigido só pelo build do pacote).

### 1.3 Integração — API

- **Onde**: `apps/api/test/integration/**/*.spec.ts`.
- **Convenção**: `<assunto>.spec.ts`, nomeando o comportamento verificado contra banco real (ex.:
  `risk-concurrency.spec.ts`, `audit-append-only.spec.ts`, `session-lifecycle.spec.ts`).
- **Quando criar**: para tudo que só pode ser provado com PostgreSQL/Redis reais — transação e
  rollback de auditoria, conflito de bloqueio otimista, trigger `BEFORE TRUNCATE`/`BEFORE UPDATE OR
  DELETE` do `audit_event`, invariantes de constraint do banco, concorrência real.
- **Comando**: `pnpm --filter @pharos/api run test:integration` (usa
  `vitest.integration.config.ts` explicitamente via `--config`).
- **Ambiente**: PostgreSQL real, banco `pharos_grc_test` (D-4, `docs/local-environment.md`) —
  **nunca** o banco de desenvolvimento `pharos_grc`. `test/integration/support/env.ts` recusa
  ativamente rodar se `TEST_DATABASE_URL`/`TEST_DATABASE_MIGRATION_URL` não terminarem em `_test`
  (guarda estrutural, não apenas convenção). `globalSetup`
  (`test/integration/support/global-setup.ts`) roda **uma vez** por invocação da suíte: aplica
  `prisma migrate deploy` (nunca `migrate dev` — o motor de diff do Prisma não entende o
  particionamento manual de `audit_event`) e depois `TRUNCATE` de toda tabela mutável, em ordem
  segura de FK, **exceto `audit_event`** (que é append-only por desenho — ver o comentário de
  `resetMutableTestData` em `support/database-roles.ts` para o mecanismo de desabilitar/reabilitar o
  próprio guard de `TRUNCATE` só ao redor desse reset administrativo).
- **Paralelismo**: `fileParallelism: false`, `pool: 'forks'`, `singleFork: true` — todo o arquivo
  roda sequencialmente, em um processo, porque a suíte inteira compartilha um único banco real.
  Testes individuais usam dado único por teste (`uniqueTestMarker`, IDs gerados), nunca assumem que
  uma tabela está vazia no meio da execução — só o `globalSetup` estabelece esse estado, uma vez.
- **Timeouts**: `testTimeout`/`hookTimeout` de 30s (migração + round-trip real de Postgres é mais
  lento que teste puro).

**Cautela de contrato ao escolher um prefixo para `uniqueTestMarker` (F-45, classe ainda ABERTA)**:
`uniqueTestMarker(prefix)` gera `prefix.length + 37` caracteres. Um prefixo de exatamente seis
caracteres produz 43 caracteres base64url — o mesmo formato que
`information-disclosure.spec.ts` usa para reconhecer um token de sessão vazado
(`RAW_SESSION_TOKEN`, `/^[A-Za-z0-9_-]{43}$/`) — e um marcador de teste com essa forma pode ser
lido como um falso positivo de vazamento de sessão. `be6b734` moveu os dez prefixos de seis
caracteres existentes para sete ou oito, mas **corrigiu instâncias, não a causa**: nada impede um
prefixo novo de seis caracteres de reintroduzir a colisão. Ao escrever um `uniqueTestMarker` novo,
evite prefixo de exatamente seis caracteres, ou confirme contra `RAW_SESSION_TOKEN` antes de
assumir que o marcador é inofensivo.

### 1.4 Contrato — API

- **Onde**: `apps/api/test/contract/**/*.spec.ts`.
- **Convenção**: `<recurso>.spec.ts`, um arquivo por área de contrato (ex.: `risk-register.spec.ts`,
  `admin-roles.spec.ts`, `audit-engagements.spec.ts`). `contract-coverage.spec.ts` é o portão em si,
  não um teste de recurso — ver §2.
- **Quando criar**: **sempre que uma tarefa adiciona ou muda um endpoint HTTP** (D-11 — regra
  obrigatória, independente de a tarefa listar um item de teste ou não). Todo contract test deve
  afirmar, no mínimo: (1) a regra de autorização declarada em prosa para o endpoint, incluindo que um
  chamador sem a permissão exigida é recusado, e que um endpoint documentado como "sessão
  autenticada; sem permissão adicional" realmente é aceito por um usuário autenticado com **zero**
  permissões; (2) um chamador **não autenticado** recebe 401; (3) a forma da resposta de sucesso bate
  com o contrato — para endpoint paginado, o envelope `{data, meta}` explícito, com valores reais de
  paginação.
- **Comando**: `pnpm --filter @pharos/api run test:contract` (usa `vitest.contract.config.ts`
  explicitamente via `--config`).
- **Ambiente**: exercita a superfície HTTP real via `supertest` contra um `AppModule` totalmente
  inicializado (exatamente como `main.ts` configura), contra o **mesmo** banco `pharos_grc_test` e o
  **mesmo** `globalSetup` de migração/reset da suíte de integração (`vitest.contract.config.ts`
  reaponta explicitamente para `test/integration/support/global-setup.ts`). Mesmo `fileParallelism:
  false`/`singleFork: true`/timeouts de 30s.
- **Toda resposta é validada estruturalmente**: `test/contract/support/auto-validate-responses.ts`
  aplica `additionalProperties: false` do schema de resposta contra **toda** requisição que qualquer
  teste de contrato faça — é a guarda automática, sem custo de manutenção, que pega um campo
  vazando por acidente de mapeamento (ver o achado F-73 em `docs/deferred-findings.md` para um
  exemplo real de campo a mais detectado por esse mecanismo).

### 1.5 E2E — Playwright

- **Onde**: `apps/web/e2e/*.spec.ts`. Suporte compartilhado em `apps/web/e2e/support/` (fixtures de
  sessão, provisionamento de usuário, reporter de execução).
- **Convenção**: `<fluxo-ou-tela>.spec.ts` (ex.: `risk-register.spec.ts`, `audit-engagement.spec.ts`,
  `admin-roles.spec.ts`). `smoke.spec.ts` é o fluxo mínimo de fumaça.
- **Quando criar**: para todo fluxo de usuário ponta a ponta através da interface real — navegação,
  formulário, diálogo, vínculo entre módulos GRC, ciclo de vida completo na tela. Ver §6 para o
  conjunto mínimo por tipo de mudança.
- **Comando**: `pnpm --filter @pharos/web run test:e2e` (= `playwright test`, `apps/web/playwright.config.ts`).
  Para rodar contra uma build de produção (paridade com CI, ver §5.6):
  `pnpm --filter @pharos/web run test:e2e:ci-parity` — sobe `next build` + `next start` e passa
  `PLAYWRIGHT_SKIP_WEB_SERVER=true` sozinho, derrubando o servidor ao final mesmo se um teste falhar
  (`apps/web/scripts/run-ci-parity.mjs`).
- **Ambiente**: `apps/web/playwright.config.ts` — `baseURL` vem de `APP_ORIGIN` (validado por
  `apps/web/src/lib/env.ts`, que também exige `API_INTERNAL_URL`; ambos lançam erro síncrono se
  ausentes/malformados). `globalSetup: './e2e/support/global-setup'` roda **antes de qualquer
  worker**: reporta se a aplicação respondendo em `APP_ORIGIN` é servidor de desenvolvimento ou
  build de produção (ver §5.6/F-71), espera a API responder em `/api/v1/health/ready`, e faz a
  **rotação única** da senha obrigatória (`mustChangePassword`) do administrador bootstrap
  (`SEED_ADMIN_EMAIL`) e das contas fixture (`SEED_DEV_FIXTURES=true`) — deliberadamente, para
  eliminar a corrida de vários workers tentando rotacionar a mesma conta compartilhada ao mesmo
  tempo.
  - **Variáveis exigidas**: `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` para qualquer cenário
    autenticado (ver `requireSeedCredentials` em `e2e/support/admin-session.ts` — localmente faz
    `test.skip`, em CI **lança e falha** a suíte, nunca pula silenciosamente: F-33). Sem essas duas
    variáveis, a suíte "passa" quase vazia — sempre confira a contagem de `skipped`, nunca só o
    código de saída (D-20/D-22 Trap 4).
  - `webServer` só sabe iniciar `apps/web` (`pnpm dev`) — nunca `apps/api`. Localmente, a API
    precisa já estar rodando (Docker Compose ou `nest start --watch`) antes de rodar E2E. Em CI,
    `PLAYWRIGHT_SKIP_WEB_SERVER=true` desativa esse bloco inteiro e o próprio job sobe API e web
    manualmente (ver §4).
- **Workers e contas**: `workers: 4`, fixo. Cada worker provisiona sua **própria** identidade
  administrativa sob demanda (`signInAsWorkerAdmin`, chaveada por `testInfo.workerIndex`, garantida
  única por toda a execução por Playwright) — não existe mais um pool fixo de contas pré-semeadas
  (D-17/research.md passo 3, aposentando o fix original de F-16). `auth.spec.ts` é a única exceção
  deliberada: provisiona uma conta nova a cada execução (`provisionAuthJourneyAccount`), porque
  exercita a própria jornada de primeiro login — reutilizar qualquer conta já tocada invalidaria a
  premissa do teste.
- **Retries**: `2` em CI, `0` localmente.
- **Reporter/portão de execução**: `execution-ledger-reporter` (último da lista de reporters,
  deliberadamente) imprime DISCOVERED / EXECUTED / PASSED / FAILED / FLAKY / SKIPPED / NOT RUN /
  INTERRUPTED e **recusa classificar a execução como verde se algum teste descoberto não rodou** —
  existe porque os reporters padrão contam "não rodou" como um token amarelo abaixo de "falhou", e
  uma execução pode sair com código 0 tendo testes descobertos que nunca executaram (F-72). Ao ler o
  resultado de uma rodada E2E, leia o ledger, não só "X failed".

### 1.6 Acessibilidade

Não é uma suíte separada — é `apps/web/e2e/accessibility.spec.ts`, dentro da suíte E2E, usando
`@axe-core/playwright` contra a aplicação **real e rodando** (nunca marcação estática ou mock).
Regras: tags `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` (não o conjunto completo de "boas práticas" do
axe, que vai além do contrato AA). Cada varredura roda duas vezes — tema claro e tema escuro
(`gotoWithDarkTheme`, que semeia `localStorage` antes do primeiro paint, replicando o mecanismo real
de um usuário com preferência salva). Todo cenário autenticado compartilha **uma** sessão por
worker, assinada uma vez em `beforeAll` (`signInAsWorkerAdmin`) — o arquivo é `mode: 'serial'`
internamente por isso, não por limitação de paralelismo entre arquivos.

**Achado resolvido (F-71, RESOLVIDO 2026-09-14)**: uma incompatibilidade de hidratação (`useId`
posicional do React 19 deslocado sob HTML transmitido em streaming) fazia o botão de disclosure do
`FilterBar` reportar `aria-controls` apontando para um elemento inexistente —
`aria-valid-attr-value`, `impact: critical`. Medido antes da correção: ~3,3% dos carregamentos sob
`next dev --turbopack`; **0 em 165** sob build de produção no Chromium; **3 em 4** sob build de
produção **no Firefox** — ou seja, o defeito **chegava a produção**, dependendo do motor. A
correção manteve o elemento do painel presente em **toda** passagem de render, ocultando-o com o
atributo `hidden` em vez de desmontá-lo — nunca removendo o atributo ARIA nem enfraquecendo o
teste. O mesmo mecanismo apareceu, medido separadamente, em `MultiSelectFilter` e
`ColumnVisibilityMenu` — o defeito irmão de F-71 (F-74), também corrigido e registrado em
`docs/deferred-findings.md`. Ver `docs/architecture/frontend.md` §4.3 para o mecanismo e a regra geral para
quem estende o Design System, e §1.7 abaixo para as guardas estruturais que passaram a proteger o
comportamento diretamente.

**Ponto cego conhecido do instrumento de acessibilidade**: `aria-valid-attr-value` (a regra do axe
que detectaria `aria-controls` pendurado) rebaixa para "needs review" — não falha — qualquer
elemento que também carregue `aria-haspopup`. `MultiSelectFilter` e `ColumnVisibilityMenu` têm
`aria-haspopup`; o botão de disclosure do `FilterBar` não tinha, e foi exatamente por isso que só
ele chegou a falhar alguma varredura antes da correção — os outros dois chegaram a produção com o
mesmo defeito sem nenhum portão de acessibilidade deste projeto acusar. "Zero violações" de uma
varredura axe nunca prova ausência de defeito nessa classe — só ausência do que a regra escolhe
opinar sobre.

### 1.7 Guardas estruturais

Testes que provam uma propriedade da **arquitetura**, não de um caso de negócio — geralmente uma
varredura estática do sistema de arquivos ou uma verificação de invariante, sem I/O de banco. Vivem
em `apps/api/test/unit/` (rodam com o comando de unitário) ou em `apps/api/test/contract/` quando a
propriedade é sobre a superfície HTTP registrada. Lista não exaustiva, mas cobrindo toda guarda
estrutural corrente relevante:

| Arquivo | O que protege |
|---|---|
| `apps/api/test/contract/contract-coverage.spec.ts` | D-11: toda operação contratada (`*.openapi.yaml`) está registrada na aplicação — ver §2 |
| `apps/api/test/contract/information-disclosure.spec.ts` | Varredura inversa: toda rota **registrada** tem cobertura de autenticação/autorização/vazamento — complementa `contract-coverage` |
| `apps/api/test/unit/controls-risk-module-boundary.spec.ts` | `modules/risk` e `modules/controls` nunca se importam diretamente (ADR-020) |
| `apps/api/test/unit/compliance-controls-risk-module-boundary.spec.ts` | `modules/compliance` nunca importa `modules/controls`/`modules/risk` (nem o inverso) |
| `apps/api/test/unit/audit-engagements-module-boundary.spec.ts` | `modules/audit-engagements` nunca importa Risco/Controles/Compliance (nem o inverso) |
| `apps/api/test/unit/finding-grc-ports-boundary.spec.ts` | `grc/finding` nunca importa `modules/risk`/`modules/controls` diretamente — só via `shared/grc-ports/*` |
| `apps/api/test/unit/asset-process-table-access-boundary.spec.ts` | Nenhum módulo além de `modules/assets`/`modules/processes` lê as tabelas `assets`/`processes` diretamente |
| `apps/api/test/unit/asset-process-write-implies-read.spec.ts` | Pareamento de permissão escrita→leitura para Ativo/Processo |
| `apps/api/test/unit/link-usecase-target-scope-guard.spec.ts` | Generaliza o fix de F-46 (escopo do alvo) a todo `Link*UseCase`, não só às duas instâncias originalmente reportadas |
| `apps/api/test/unit/control-link-permission-pairing.spec.ts` / `finding-link-permission-pairing.spec.ts` | Pareamento de permissão nos vínculos de Controle/Achado |
| `apps/api/test/unit/action-model-convergence-guard.spec.ts` | Todo `ActionOriginType` tem um `ActionOriginAccessor` registrado — nenhum modelo paralelo de tarefa por módulo (§19.6 CLAUDE.md) |
| `apps/api/test/unit/indicators-reports-no-parallel-columns-guard.spec.ts` | SC-005: nenhuma tabela de Indicadores/Relatórios duplica coluna de tarefa/arquivo/aprovação em paralelo ao núcleo GRC |
| `apps/api/test/unit/registered-entity-type-validator.spec.ts` / `entity-registry.spec.ts` | `entityType` de anexo/comentário é validado contra o registro **vivo**, não uma lista fixa |
| `apps/api/test/unit/assets-processes-contract-no-deletion.spec.ts` / `audit-contract-no-deletion.spec.ts` / `finding-no-delete.spec.ts` | Prova estrutural de que não existe operação de exclusão (nem no contrato, nem no código) para os domínios que a decidiram sem soft/hard delete |
| `apps/api/test/unit/seeded-role-description-content.spec.ts` | Guarda contra reincidência de F-32: descrição de papel semeado é texto de produto, não nota de engenharia |
| `apps/api/test/unit/role-privilege-classification-boundary.spec.ts` | ADR-021: a classificação de privilégio de papel é inalcançável a partir de qualquer decisão de acesso real (não é ponto de extensão morto) |
| `apps/api/test/unit/admin-roles-route-order.spec.ts` | Ordem de declaração das rotas de `AdminRolesController` — uma rota literal (`/admin/roles/summary`) nunca fica inalcançável atrás de uma rota parametrizada (`/admin/roles/:roleId`) |
| `apps/api/test/unit/api-types-dist-resolution.spec.ts` | `@pharos/api-types` resolve via `dist/` sob resolução de módulo comum (Node/bundler), não só via alias de path do TypeScript |
| `apps/api/test/integration/role-administer-user-boundary.spec.ts` | `role:administer` nunca alcança uma rota de usuário além da única exceção documentada (F-73) — e a exceção não vira álibi (verifica que a rota realmente chega ao handler) |
| `apps/api/test/integration/system-role-immutability.spec.ts` | Papel de sistema não pode ser alterado/excluído |
| `apps/api/test/integration/pairing-invariant-check-constraints.spec.ts` | Invariantes de pareamento aplicadas como `CHECK` constraint no próprio banco, não só em código |

**Como adicionar uma guarda nova**: siga o mesmo método — varredura de texto sobre especificadores de
import (resolvendo relativos para caminho absoluto antes de classificar), nunca uma dependência nova
de parser. `action-model-convergence-guard.spec.ts` e `controls-risk-module-boundary.spec.ts` são as
referências mais citadas pelos próprios arquivos acima como modelo a seguir. Isso complementa, nunca
substitui, `eslint-plugin-boundaries` (`apps/api/eslint.config.mjs`).

**Guardas estruturais equivalentes existem do lado do web**, fora desta tabela (que cobre só
`apps/api/test/`):

| Arquivo | O que protege |
|---|---|
| `apps/web/src/lib/role-display-name.single-catalogue.test.ts` | Varre a árvore de produção inteira e falha se qualquer arquivo fora de `common.roleDisplayNames` chavear um objeto por nome de papel semeado — o próprio detector é validado exigindo exatamente doze acertos contra `common.ts` |
| `apps/web/src/components/design-system-register-chrome.test.tsx` | Comportamento observável (papéis, nomes acessíveis, `aria-expanded`/`aria-controls`, foco) de `FilterBar`, `MultiSelectFilter`, `ColumnVisibilityMenu`, `PaginationFooter`, `ResultsToolbar`, `CardGrid` — a moldura de exploração que toda tela de registro GRC compõe; nunca classe CSS ou forma de DOM, então uma reforma visual que preserva o comportamento mantém o teste verde |
| `apps/web/src/app/(app)/profile/profile-view.test.tsx` | Monta a tela real de Perfil e afirma pt-BR para os doze papéis semeados, nenhum nome em inglês armazenado, e um papel customizado impresso como digitado |

---

## 2. D-11 e o portão de cobertura de contrato

**A regra (D-11, `docs/local-environment.md`)**: toda tarefa que adiciona ou muda um endpoint HTTP
**deve** adicionar um contract test — mesmo que a lista de tarefas não peça um. Nasceu de uma medição
real: 10 de 21 operações implementadas não tinham teste nenhum, e duas tinham defeitos reais
invisíveis nesse ponto cego (`GET /risk-methodology` devolvia 403 para todo mundo).

**O mecanismo automatizado (`contract-coverage.spec.ts`, T093/F-31)**: compara, por nome
(`MÉTODO /caminho`), toda operação declarada nos contratos `*.openapi.yaml` hand-authored contra toda
rota que o Nest efetivamente registrou (lida do `apps/api/openapi.json` comitado, a reflexão em nível
de rota do que o `@nestjs/swagger` gerou dos decorators — mantida fresca pelo portão separado
`openapi:check`, D-14). Uma operação **contratada e nunca implementada** falha aqui, nomeada
explicitamente — exatamente a classe de defeito que F-31 documentou três vezes recorrendo (auditoria,
Incidentes/Problemas, Indicadores/Relatórios — ver o cabeçalho do próprio arquivo para o histórico
completo de cada recorrência).

**Como adicionar um contrato novo a este portão**, quando uma fase nova introduz um
`*.openapi.yaml`:

1. Implemente **todas** as operações do contrato antes de (ou na mesma mudança que) adicionar a
   entrada — nunca "contrato agora, rota depois". Adicionar a entrada antes de terminar a
   implementação deixa o portão vermelho de propósito, nomeando o que falta (aceitável só durante o
   próprio desenvolvimento da fase, nunca mesclado assim).
2. Adicione `{ dir: <DIRETÓRIO_DO_CONTRATO>, file: '<arquivo>.openapi.yaml' }` ao array
   `CONTRACT_SOURCES` em `apps/api/test/contract/contract-coverage.spec.ts`.
3. Rode o teste — a primeira asserção (contagem total de operações analisadas) vai falhar dizendo o
   número real. **Leia esse número da falha, nunca calcule por soma manual** (o próprio arquivo
   documenta essa disciplina: cada adição histórica ao total registra explicitamente que o número
   veio de uma execução que falhou, não de aritmética).
4. Atualize o número esperado nessa primeira asserção para o valor lido.
5. A segunda asserção (nenhuma operação contratada ausente do registro) deve passar se o passo 1 foi
   seguido.

O parser é um scanner de linha propositalmente simples (não uma lib de YAML) — depende da estrutura
compartilhada por todos os contratos hand-authored: uma seção `paths:` de topo, cada caminho como
`  /algo:` (2 espaços), cada método como `    get|post|put|patch|delete:` (4 espaços), e exatamente
um `servers: - url: ...`. Reformatar um contrato fora dessa forma quebra o parser, não o defeito que
ele mede.

---

## 3. Fixtures e dados de ambiente por suíte

| Suíte | Precisa de seed? | Precisa de banco resetado? | Provisionamento |
|---|---|---|---|
| Unitário (API/Web) | Não | Não | Nenhum — sem I/O |
| Integração (API) | Não (usa fixtures próprias por teste) | Sim, automático via `globalSetup` | `uniqueTestMarker`/IDs únicos por teste; nunca assume tabela vazia fora do reset inicial |
| Contrato (API) | Não | Sim, automático via `globalSetup` (mesmo mecanismo da integração) | Idem |
| E2E (Playwright) | **Sim** — precisa de `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; `SEED_DEV_FIXTURES=true` para os specs que dependem de papéis fixture (`grc-foundation`, `problems`, `risk-approval`, `risk-history`) | Não é resetado pela suíte — usa o banco como está | `e2e/support/global-setup.ts` rotaciona a senha obrigatória uma vez; identidades administrativas são provisionadas sob demanda por worker (`signInAsWorkerAdmin`) através da API real de administração, nunca por linha pré-semeada |

**A suíte de integração/contrato nunca aponta para o banco de desenvolvimento** — `test/integration
/support/env.ts` recusa ativamente qualquer `TEST_DATABASE_URL`/`TEST_DATABASE_MIGRATION_URL` que
não termine em `_test` (D-4).

**Variáveis que `playwright.config.ts` exige** (via `apps/web/src/lib/env.ts`): `API_INTERNAL_URL`,
`APP_ORIGIN`. Para cenários autenticados, adicionalmente `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
(lidas diretamente de `process.env` por `e2e/support/admin-session.ts`, **não** validadas por
`env.ts`) — sem elas, a suíte roda quase vazia e sai com código 0 (D-20/D-22 Trap 4): sempre confira
a contagem de `skipped`.

**Contas de teste se acumulam** (F-70, `docs/deferred-findings.md`): não existe endpoint de exclusão
de usuário, e apagar direto no banco esbarraria na trilha de auditoria imutável — toda conta criada
por um E2E é permanente por desenho. Ver `docs/guides/troubleshooting.md` se isso interferir num
diagnóstico.

---

## 4. CI (`.github/workflows/ci.yml`)

Roda em todo `push` e `pull_request`; `test-e2e-firefox`/`test-e2e-webkit` rodam **apenas** em
`workflow_dispatch` manual.

| Job | Gatilho | O que roda | Serviços |
|---|---|---|---|
| `install` | push/PR | Aquece o cache pnpm (`pnpm install --frozen-lockfile`) | — |
| `lint` | após `install` | `pnpm run lint` (inclui as regras de fronteira `eslint-plugin-boundaries`, ADR-011) | — |
| `format-check` | após `install` | `pnpm run format:check` | — |
| `typecheck` | após `install` | `pnpm run typecheck` | — |
| `test-unit` | após `install` | Build de `@pharos/design-system` e `@pharos/api-types`, depois `pnpm run test:unit` (API + Web) | — |
| `audit` | após `install` | `pnpm audit --audit-level=high --ignore-registry-errors` — só HIGH/CRITICAL falha o job (LOW/MODERATE aparecem no log, não derrubam o portão — F-57 é exatamente esse caso) | — |
| `build` | após `install` | `pnpm run build` (todo o monorepo, ordem topológica) | — |
| `openapi-check` | após `install` | `openapi:check` — regenera `openapi.json` em processo e falha se divergir do comitado (D-14) | Postgres |
| `api-types-check` | após `install` | Regenera `packages/api-types/src` a partir dos contratos e falha se a árvore ficar suja | — |
| `test-integration` | após lint/format/typecheck/test-unit/audit | `pnpm run test:integration` | Postgres 17, Redis 7 |
| `test-contract` | após lint/format/typecheck/test-unit/audit | `pnpm run test:contract` | Postgres 17, Redis 7 |
| `test-e2e` (chromium) | após lint/format/typecheck/test-unit/audit | Build de produção completo, migra, semeia (`SEED_DEV_FIXTURES=true`), sobe API + Web (`next start`), roda Playwright `--project=chromium` | Postgres 17, Redis 7 |
| `test-e2e-firefox` | **só `workflow_dispatch`** | Idêntico ao acima, `--project=firefox`, com seus próprios serviços isolados | Postgres 17, Redis 7 (próprios, não compartilhados com o job chromium) |
| `test-e2e-webkit` | **só `workflow_dispatch`** | Idêntico, `--project=webkit --workers=1` (ver nota abaixo) | Postgres 17, Redis 7 (próprios) |
| `ci-required` | sempre (`if: always()`) | Portão único: falha se qualquer job acima (exceto os dois de `workflow_dispatch` fora desse gatilho) não for `success` — inclusive `skipped` conta como falha aqui | — |

**Checks obrigatórios**: a branch protection deve nomear apenas `ci-required`, nunca os jobs
individuais — eles compartilham as mesmas cinco dependências (`lint`, `format-check`, `typecheck`,
`test-unit`, `audit`), e se uma delas ficar vermelha o GitHub reporta os jobs dependentes como
`skipped`, não `failed`; um branch protection que listasse só os jobs finais por nome teria mostrado
um PR "aprovável" mesmo com esse buraco (já aconteceu — F-33, F-52, F-50).

**Cada job de banco provisiona os dois papéis ADR-005** (`pharos_owner`/`pharos_app`) rodando
`docker/postgres/init/01-roles.sql` via `psql` manualmente — containers de serviço do GitHub não
montam `/docker-entrypoint-initdb.d` como o `docker-compose.yml` local faz.

### 4.1 Ressalvas conhecidas do CI (com referência ao achado)

- **`test-e2e-webkit` roda hoje com `--workers=1`** (flag TEMPORÁRIA introduzida no commit
  `44e1e04`, **ainda presente e deliberadamente mantida** após revisão em 2026-09-14 sob F-72/F-59 —
  não revertida). A razão registrada no próprio arquivo: a evidência disponível aponta para o
  `ThrottlerGuard` global (F-59) como mecanismo suficiente para produzir exatamente o padrão de
  falha observado sob concorrência, e remover o `--workers=1` hoje removeria o único limite de
  concorrência que o CI tem sobre o motor que já travou uma vez, sem responder à pergunta aberta. O
  passo recomendado (não executado) é um `workflow_dispatch` com a linha como está e outro sem ela,
  comparando os dois ledgers de execução (`execution-ledger-reporter`) — nunca reverter em silêncio
  em qualquer direção.
- **F-59, RESOLVIDO 2026-09-19** — o `ThrottlerGuard` global (`THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS`,
  contado por IP) derruba jornadas E2E longas com `429`, distinto do limitador de login (F-48). O job
  `test-e2e` eleva `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`/`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` (login) mas
  **não** `THROTTLE_LIMIT` — decisão formal: rodar a suíte E2E local completa com `--workers=1`
  contra um banco de desenvolvimento volumoso, em vez de alterar o teto (ver
  `docs/deferred-findings.md` F-59 para a medição completa, 168/168 aprovados).
- **F-71, RESOLVIDO 2026-09-14** — a violação crítica de acessibilidade (`aria-valid-attr-value` no
  `FilterBar`) que reproduzia sob `next dev --turbopack` localmente **e**, mais grave, sob build de
  produção no **Firefox**, está corrigida (ver §1.6 acima) — o job Firefox, que só roda sob
  `workflow_dispatch`, era a única forma de medir essa exposição; continua valendo a nota de que o
  CI de push/PR normal não constrói o cenário sob esse motor, então uma regressão futura na mesma
  área só apareceria de novo sob execução manual.
- **F-72, RESOLVIDO** — a suíte E2E completa passou inteira numa única execução na regressão final
  de `specs/015-roles-permissions-surface/` (Chromium 198/198, mais `admin-roles` Firefox+WebKit
  32/32 — ver `docs/STATE.md` §10). O `execution-ledger-reporter` continua sendo a forma correta de
  confirmar isso (§1.5) — uma falha isolada ainda pode cancelar dezenas de testes seguintes sem que
  o relatório padrão do Playwright deixe isso óbvio, então releia o ledger, não só "X failed", em
  toda execução futura.
- **F-57, RESOLVIDO 2026-09-19** — `pnpm audit` reportava 2 advisories `moderate` em
  `vitest`/`@vitest/mocker` (dependência de teste, não de produção); o portão `audit` (limiar
  `--audit-level=high`) já ficava verde por desenho, e a correção (bump para `vitest@4.1.11`) fechou
  o advisory em si, não só o limiar.

---

## 5. Problemas comuns ao executar testes

Resumo rápido — ver `docs/guides/troubleshooting.md` para diagnóstico e correção detalhados de cada item.

### 5.1 429 (Muitas requisições) durante E2E

Dois limitadores independentes: o de login (`AUTH_RATE_LIMIT_*`, F-48, alinhado localmente pelo D-23)
e o `ThrottlerGuard` global (`THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS`, F-59, **sem mitigação
decidida** além de reduzir a concorrência de workers). Nunca abaixe/desative um limitador de
segurança para fazer um teste passar — ver `docs/guides/troubleshooting.md`.

### 5.2 Banco de teste não migrado

Se algo além de `pnpm run test:integration`/`test:contract` tentar acessar `pharos_grc_test`
diretamente (um `psql` manual, por exemplo), o `globalSetup` das suítes não roda e a base pode estar
sem as migrações mais recentes. Prefira sempre os comandos `pnpm` — eles migram e resetam sozinhos.

### 5.3 Especificidades de Firefox/WebKit

Só rodam em CI sob `workflow_dispatch`. WebKit está fixado em `--workers=1` (ver §4.1). F-69
documenta uma divergência de restauração de foco exclusiva do WebKit no caminho do mouse (guardada,
não corrigida — mudança de escopo de Design System). F-71, que reproduzia em produção
especificamente no Firefox, está resolvido (§1.6).

### 5.4 Servidor web de desenvolvimento vs build

`pnpm --filter @pharos/web run build` corrompe o `.next` se o `dev` estiver de pé ao mesmo tempo
(D-16) — pare o servidor antes de construir. Ver §5.6 abaixo para a relação disso com F-71.

### 5.5 Timing de hidratação

O formulário de login pode descartar um valor digitado antes da hidratação terminar (D-21) — já
corrigido no harness E2E (`fillLoginCredentials` relê e repreenche). Se um novo formulário
compartilhado apresentar o mesmo sintoma, é a generalização em aberto que F-56 documenta.

### 5.6 Servidor de desenvolvimento local mede uma aplicação diferente do CI

`playwright.config.ts` local sobe `pnpm dev` (`next dev --turbopack`) por padrão. O CI sempre
constrói e serve com `next start`. Isso importou especificamente para o diagnóstico de
acessibilidade que fechou F-71: rode `pnpm --filter @pharos/web run test:e2e:ci-parity` para medir
a mesma coisa que o CI mede, e leia a primeira linha do log de `global-setup.ts` (`BUILD MODE: ...`)
antes de tratar qualquer violação de acessibilidade observada localmente como defeito de produto —
o método continua válido para qualquer achado futuro da mesma classe, não só para F-71.

---

## 6. Como testar uma nova funcionalidade

Conjunto mínimo de testes por tipo de mudança — adicione, nunca substitua, o que a arquitetura da
área já exige:

| Tipo de mudança | Mínimo exigido |
|---|---|
| **Novo endpoint / endpoint alterado** | Contract test (D-11: autorização, 401 sem sessão, forma da resposta) **na mesma mudança** que a rota — nunca depois. Se o endpoint expõe uma regra de negócio nova, também integração se a prova depender de banco real (transação, concorrência, constraint). |
| **Regra de domínio nova** | Unitário puro (API), sem I/O — cobrindo limites/fronteiras da regra (não só o caminho feliz). |
| **Tela/fluxo novo na interface** | Unitário de componente (Web) para lógica/estado, **e** um E2E cobrindo o fluxo pela interface real — nunca só o unitário (§18.1 CLAUDE.md: mudança de interface precisa de inspeção renderizada, e o portão de aceitação visual em §18.11). Se a tela tem estado de aprovação, formulário obrigatório/opcional ou erro, inclua isso no E2E, não só no snapshot. |
| **Vínculo entre módulos GRC (ex.: Achado↔Controle)** | Guarda de fronteira de módulo se o vínculo introduzir um import novo entre domínios (padrão de `*-module-boundary.spec.ts`, §1.7); contract test dos dois lados do vínculo (criar e ler, nas duas direções se a leitura reversa existir); integração se o vínculo tiver invariante de banco (constraint de pareamento, unicidade). |
| **Permissão/escopo organizacional novo** | Contract test afirmando 403 para quem não tem a permissão **e** 200/201 para quem tem — nunca só um dos dois. Se o escopo organizacional é novo, teste de integração ou E2E provando que um alvo **fora** do escopo é recusado (não só que um alvo dentro do escopo funciona — ver o padrão de vazamento que `link-usecase-target-scope-guard.spec.ts` generaliza). |
| **Novo tipo anexável/comentável** | Registro no `entity-registry` real (`core/comments/domain/entity-registry.ts`) — nunca uma lista paralela — e um caso em `registered-entity-type-validator.spec.ts`/`entity-registry.spec.ts` provando que o tipo novo é rejeitado até ser registrado (§19.10 CLAUDE.md: ponto de extensão só conta depois de executado). |
| **Capacidade compartilhada nova (Action/Evidence/Finding)** | Guarda de convergência (padrão de `action-model-convergence-guard.spec.ts`) se a mudança introduzir um novo `OriginType`/acessador — nunca um modelo de tarefa paralelo por módulo. |

Antes de considerar a tarefa concluída: rode lint, typecheck e a suíte relevante localmente; para
qualquer mudança de interface substancial, siga o laço de §18.1 do CLAUDE.md (implementar → executar
→ inspecionar no navegador → capturar/verificar com Playwright → criticar → corrigir → verificar de
novo) antes de marcar como pronta.
