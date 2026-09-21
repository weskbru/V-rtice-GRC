# Diagnóstico de problemas

Guia de diagnóstico para problemas comuns ao rodar o PharosGRC localmente. Cada item cobre apenas o
que está confirmado pelo código, pela configuração ou por um achado registrado (`D-x` em
`docs/local-environment.md`, `F-x` em `docs/deferred-findings.md`) — referência sempre incluída. Para
setup inicial, ver `docs/guides/development.md`. Para estratégia e comandos de teste, ver `docs/guides/testing.md`.

Correções não destrutivas vêm primeiro em cada item; um passo destrutivo, quando existe, vem por
último e com aviso explícito.

---

## API não sobe

### Sintoma: processo lança um erro de validação de ambiente e encerra imediatamente

```
Invalid ... environment configuration:
  - <VAR>: <mensagem>
```

**Causa provável**: `apps/api/src/infrastructure/config/env.schema.ts` é o **único** arquivo
autorizado a ler `process.env` neste projeto, e é passado a `ConfigModule.forRoot({ validate })` — o
Nest se recusa a inicializar com uma configuração que não consegue validar. A mensagem lista **todas**
as violações de uma vez, não só a primeira.

**Como diagnosticar**: leia a mensagem completa — cada linha nomeia a variável e o problema
específico. Confirme se `apps/api/.env` existe (D-22 Trap 2: `apps/api/prisma.config.ts` roda
`dotenv/config` e todo comando `pnpm --filter @pharos/api` é executado com `cwd=apps/api`, então
**só `apps/api/.env` é lido** — um `.env` só na raiz do monorepo não basta para este processo).

**Como corrigir**: `cp .env.example apps/api/.env` (há um único `.env.example`, na raiz — não existe
`apps/api/.env.example` separado) e preencha as variáveis apontadas, incluindo `SEED_ADMIN_PASSWORD`
(a seed se recusa a rodar sem ela). Nunca registre o valor de um secret em nenhum documento.

Duas regras cruzadas específicas que produzem esta mesma mensagem:

- `SESSION_COOKIE_SECURE` deve ser `true` quando `NODE_ENV=production` — ver "Login falha" abaixo
  para a armadilha oposta (cookie `Secure` sobre HTTP puro).
- `REDIS_URL` é obrigatório e não pode ser vazio quando `NODE_ENV=production` (D-2).

### Sintoma: `EADDRINUSE` na porta 3001

**Causa provável**: outro processo (uma instância anterior de `nest start --watch`, ou o container
Docker) já está escutando na porta `API_PORT` (padrão `3001`).

**Como diagnosticar**: verifique o que está escutando na porta (`netstat`/gerenciador de tarefas no
Windows) antes de qualquer outra coisa.

**Como corrigir**: pare o processo anterior. Não altere `API_PORT` como atalho — `APP_ORIGIN`/
`API_INTERNAL_URL` e a configuração do Playwright assumem `3001`/`3000` (ver `.env.example`).

### Sintoma: `Cannot find module '.prisma/client/default'` ou erro equivalente ao importar `@prisma/client`

**Causa provável**: o cliente Prisma gerado não está commitado (é gitignored) e precisa ser gerado
localmente após cada `pnpm install` num clone novo ou após uma mudança de schema.

**Como diagnosticar**: confirme que `apps/api/node_modules/.prisma` (ou o equivalente dentro do
virtual store do pnpm) não existe ou está desatualizado frente a `apps/api/prisma/schema.prisma`.

**Como corrigir**: `pnpm --filter @pharos/api run db:generate` (equivalente a `prisma generate`).

### Sintoma: banco inacessível — API não consegue conectar ao PostgreSQL

**Causa provável**: o ambiente padrão de desenvolvimento roda contra o PostgreSQL **nativo** na porta
`5432`, não contra o Docker Compose (D-1) — se o serviço nativo não estiver rodando, ou se
`DATABASE_URL`/`DATABASE_MIGRATION_URL` apontarem para um host/porta errados, a API não conecta. Se
em vez disso você estiver usando Docker Compose, lembre que os arquivos de compose usam portas
deliberadamente diferentes (`5433` para dev, `5434` para teste) para nunca colidir com a instância
nativa.

**Como diagnosticar**: confirme qual PostgreSQL o `.env` em uso realmente aponta (nativo `5432` vs.
Compose `5433`/`5434`) e se esse serviço está de fato no ar.

**Como corrigir**: suba o serviço correspondente (serviço do Windows/nativo, ou `docker compose up -d
postgres`) e confirme a porta em `DATABASE_URL`.

### Sintoma: container `api` do Docker Compose reinicia em loop

**Causa histórica (F-12, RESOLVIDO em 2026-09-11)**: o estágio de build do `docker/api.Dockerfile`
rodava `prisma generate` **antes** de `pnpm deploy --legacy`, e o cliente gerado ficava para trás no
virtual store do workspace em vez de acompanhar a árvore de dependências que `pnpm deploy` recria —
o container subia sem `.prisma/client` e morria em `Cannot find module '.prisma/client/default'`.
Verificado como corrigido: a imagem empacotada foi construída e iniciada contra PostgreSQL/Redis
reais e `/health/ready` respondeu `{"status":"ok"}`.

**Se isto reaparecer**: confirme, dentro da imagem construída, se `node_modules/.prisma` existe
(`docker run --rm <imagem> ls node_modules/.prisma` ou equivalente) — esse é o sintoma exato que F-12
documentou. Se existir e o container ainda cair, o problema é outro; não presuma que é F-12
recorrendo sem essa confirmação.

---

## Web não sobe

### Sintoma: `EADDRINUSE` na porta 3000

**Causa provável**: outro processo (`next dev` de uma sessão anterior, ou `next start`) já ocupa a
porta `WEB_PORT` (padrão `3000`).

**Como corrigir**: pare o processo anterior antes de iniciar um novo.

### Sintoma: `next.config.ts` falha ao carregar com `Invalid apps/web environment configuration`

```
Failed to load next.config.ts
Error: Invalid apps/web environment configuration:
  - API_INTERNAL_URL: API_INTERNAL_URL is required (see .env.example) — the ADR-014 rewrite has no default target.
  - APP_ORIGIN: APP_ORIGIN is required (see .env.example).
```

**Causa**: `apps/web/next.config.ts` importa `src/lib/env.ts`, que valida `API_INTERNAL_URL`/
`APP_ORIGIN` no carregamento do módulo e lança de forma síncrona — `next build`/`next dev` falham
antes de compilar qualquer coisa. `apps/web` não tem `.env` próprio por padrão nesta configuração, e
o `.env` da raiz do monorepo **não** é lido por `next build`/`next dev`.

**Como corrigir**: passe as duas variáveis na linha de comando (D-22 Trap 3):

```bash
API_INTERNAL_URL=http://localhost:3001 APP_ORIGIN=http://localhost:3000 pnpm --filter @pharos/web run build
```

ou crie `apps/web/.env` com as mesmas duas variáveis, se preferir um arquivo permanente (não é a
forma adotada/verificada no histórico deste projeto, mas é equivalente).

### Sintoma: aplicação volta erro 500 em toda rota, inclusive `/`, depois de rodar o build

**Causa (D-16)**: `pnpm --filter @pharos/web run build` e `pnpm --filter @pharos/web run dev` escrevem
no **mesmo** diretório `apps/web/.next`. Rodar o build enquanto o servidor de desenvolvimento está de
pé corrompe esse cache, e o processo em execução não se recupera sozinho.

**Como diagnosticar**: confirme se o `dev` estava rodando quando o `build` foi executado.

**Como corrigir**: pare qualquer processo servindo a porta 3000, apague `apps/web/.next`, e inicie o
`dev` novamente (ou rode o `build` isolado, sem o `dev` de pé). Regra permanente: nunca rode o build
com o servidor de desenvolvimento no ar; se a aplicação precisa continuar disponível para alguém, use
um checkout separado.

### Sintoma: import de `@pharos/design-system/components` falha em massa nos testes ou no dev

**Causa (D-22 Trap 1)**: `apps/web` consome o pacote `@pharos/design-system` **compilado**
(`dist/`, gitignored), não a fonte diretamente. Num clone limpo, ou depois de editar o design system
sem recompilar, toda importação falha com `Failed to resolve import
"@pharos/design-system/components"`. Medido diretamente: 77 de 110 arquivos de teste falhando dessa
forma até o pacote ser construído.

**Como corrigir**: `pnpm --filter @pharos/design-system run build`. Repita sempre que editar algo
dentro de `packages/design-system` e o resultado não aparecer no app consumidor.

---

## Migrations pendentes / divergência de checksum

### Sintoma: `prisma migrate deploy` reporta "No pending migrations to apply" mas o comportamento não bate com o schema esperado

**Causa (D-17)**: `prisma migrate deploy`/`migrate status` **nunca revalidam o checksum de uma
migração já aplicada** — só migrações pendentes são comparadas contra o arquivo em disco. Se um
arquivo de migração foi editado **depois** de já ter sido aplicado uma vez (por exemplo, por um
processo concorrente rodando `globalSetup` enquanto o arquivo ainda estava em edição), o banco fica
permanentemente em desacordo com o repositório, e todo comando de rotina continua reportando "tudo
certo".

**Como diagnosticar** (nunca confie no banner impresso pela ferramenta — D-17/D-18 documentam os dois
casos em que ele mentiu): consulte `_prisma_migrations` diretamente.

```sql
SELECT migration_name, checksum, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC;
```

Compare o `checksum` da linha mais recente com o checksum real do arquivo em
`apps/api/prisma/migrations/<nome>/migration.sql` (o Prisma CLI calcula isso internamente; duas linhas
para o mesmo nome de migração, com checksums diferentes, é o sintoma direto).

**Como corrigir, para o banco de teste (descartável) — recriar o schema do zero**: esta é a única
correção verificada neste projeto para um banco já divergente, e é destrutiva — use apenas em
`pharos_grc_test`, nunca em `pharos_grc`:

```sql
-- ATENÇÃO: destrutivo. Só contra pharos_grc_test, como o papel owner.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION pharos_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE pharos_grc_test TO pharos_app;
GRANT USAGE ON SCHEMA public TO pharos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pharos_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pharos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pharos_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pharos_app;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
```

Depois, `prisma migrate deploy` reaplica tudo do zero (mirroring `docker/postgres/init/01-roles.sql`).
**Regra permanente daqui em diante**: nunca deixe um arquivo de migração "em rascunho" dentro da
pasta real e rastreada enquanto qualquer outro processo (CI, outro desenvolvedor, outro agente) possa
rodar `migrate deploy` contra o mesmo banco.

---

## `DATABASE_MIGRATION_URL` — comando de migração atingiu o banco errado

### Sintoma: uma migração destinada ao banco de teste foi aplicada ao banco de desenvolvimento (ou vice-versa), apesar de `DATABASE_URL` ter sido sobrescrita corretamente

**Causa (D-18)**: `schema.prisma` declara `url = env("DATABASE_URL")` e
`directUrl = env("DATABASE_MIGRATION_URL")`. Todo comando `prisma migrate *`
(`deploy`/`status`/`diff`) conecta via `directUrl` — **nunca** via `url`. Sobrescrever só
`DATABASE_URL` na linha de comando não muda o banco que a migração realmente atinge; o Prisma cai de
volta para o que `DATABASE_MIGRATION_URL` resolver a partir do `.env`. O próprio banner "Datasource"
impresso pelo CLI **não é prova do contrário** — ele exibe `url`, não `directUrl`.

**Como diagnosticar**: nunca confie no banner. Consulte o banco diretamente (`psql`) para confirmar
qual instância recebeu a mudança.

**Como corrigir**: sempre sobrescreva **as duas** variáveis juntas:

```bash
DATABASE_URL="$TEST_DATABASE_URL" DATABASE_MIGRATION_URL="$TEST_DATABASE_MIGRATION_URL" \
  pnpm exec prisma migrate deploy
```

Prefira, sempre que possível, `pnpm run test:integration`/`test:contract` — o `globalSetup` dessas
suítes já faz esse mapeamento internamente e é o caminho testado.

---

## Valores de enum "inertes" no banco

### Sintoma: `SELECT enum_range(NULL::"AlgumEnum")` no banco mostra um valor que não existe em `schema.prisma`

**Causa (D-19)**: PostgreSQL não tem `ALTER TYPE ... DROP VALUE`. Se uma migração que estendia um enum
foi aplicada a um banco (por engano, tipicamente via D-18) e depois corrigida **antes de ser
commitada**, o banco já aplicado fica carregando o valor extra para sempre — mesmo que o arquivo
commitado nunca o tenha declarado.

**Por que normalmente não precisa de correção**: um valor de enum não utilizado é inerte — nenhuma
linha real o usa, e nenhum código escreve para ele (se escrevesse, o acessador correspondente
existiria e o valor estaria de fato declarado no schema). Não é risco de integridade nem de
autorização, só divergência cosmética entre "o que o arquivo declara" e "o que este banco específico
pode fisicamente armazenar".

**Como corrigir, se realmente necessário**: a única forma de fazer o banco "esquecer" o valor é a
receita destrutiva de D-17 (`DROP SCHEMA public CASCADE`, reaplicar do zero) — normalmente não vale a
pena só por isto.

---

## `pnpm` não encontrado / versão errada / dependências nativas (argon2, engines do Prisma)

### Sintoma: `pnpm: command not found`, ou erro de binding nativo ao usar `argon2`, ou `pnpm install --frozen-lockfile` se comporta diferente do esperado

**Causa provável**: a versão de `pnpm` usada localmente diverge da fixada pelo projeto
(`PNPM_VERSION: "10.34.5"` em `.github/workflows/ci.yml`), ou os pacotes com scripts de build nativo
não foram autorizados a rodar. `package.json` (raiz) declara explicitamente, em `pnpm.
onlyBuiltDependencies`, quais pacotes têm permissão de rodar script de instalação/build nativo:
`@swc/core`, `esbuild`, `unrs-resolver`, `@scarf/scarf`, `@prisma/client`, `@prisma/engines`,
`prisma`, `argon2`. Um `pnpm install` que pule esse passo (por exemplo, um pnpm major diferente com
comportamento de allowlist distinto) deixa o binding nativo de `argon2` (usado para hash de senha) ou
os engines do Prisma ausentes.

**Como diagnosticar**: confirme a versão instalada (`pnpm --version`) contra `PNPM_VERSION` do CI.
Verifique se `node_modules/argon2`/`node_modules/.prisma` têm o binário nativo presente.

**Como corrigir**: instale a versão de `pnpm` fixada pelo projeto e rode `pnpm install
--frozen-lockfile` novamente a partir de um estado limpo. Nunca edite `onlyBuiltDependencies` para
"resolver" um erro pontual sem entender por que um pacote passou a precisar dele — é uma lista de
permissão de segurança (executar script arbitrário de um pacote de terceiro no install), não um
detalhe de conveniência.

---

## Variáveis obrigatórias ausentes, de forma geral

Toda variável que `apps/api/src/infrastructure/config/env.schema.ts` exige e não recebeu produz a
mensagem de validação descrita em "API não sobe" acima, listando **cada** violação de uma vez —
sempre leia a mensagem inteira antes de corrigir uma variável de cada vez.

Para `apps/web`, o conjunto exigido é bem menor: só `API_INTERNAL_URL`/`APP_ORIGIN`
(`apps/web/src/lib/env.ts`) — todo o resto do `.env.example` pertence à API.

---

## Login falha / cookie de sessão não persiste

### Sintoma: `POST /api/v1/auth/login` responde `200`, mas a próxima requisição autenticada é recusada como se a sessão não existisse

**Causa provável**: `SESSION_COOKIE_SECURE=true` sobre HTTP puro (`http://localhost:...`). Um cookie
marcado `Secure` é recusado pelo próprio navegador quando a conexão não é HTTPS — ele nunca é
armazenado nem reenviado, mesmo que o servidor o tenha emitido com sucesso. `curl` não reproduz isso
(não aplica a semântica de `Secure`), então uma verificação por linha de comando pode parecer correta
enquanto um navegador real fica travado.

**Como diagnosticar**: confirme o valor de `SESSION_COOKIE_SECURE` no `.env` em uso e se a aplicação
está sendo acessada via `http://` ou `https://`. `env.schema.ts` já força `SESSION_COOKIE_SECURE=true`
quando `NODE_ENV=production` — então este sintoma tende a aparecer especificamente quando alguém usa
valores de produção (`.env.example`) contra um ambiente local servido em HTTP puro.

**Como corrigir**: para desenvolvimento local sobre HTTP, mantenha `SESSION_COOKIE_SECURE=false` (o
padrão documentado em `.env.example` para esse caso) — nunca mude isso para "corrigir" login local,
já que o efeito contrário (cookie não persiste) é o esperado quando o valor certo para o ambiente é
usado errado. Nunca defina `SESSION_COOKIE_SECURE=true` sem TLS de verdade na frente da aplicação.

**Nota relacionada (F-13, `docs/deferred-findings.md`)**: a stack Docker Compose já força
`SESSION_COOKIE_SECURE=true` para o serviço `api` mesmo sem terminador TLS na frente. Medido como
funcional especificamente no **Chromium** (`localhost` é uma das exceções que os navegadores
baseados em Chromium aplicam à semântica de `Secure`) — Firefox, Safari e qualquer host que não seja
`localhost` **não foram verificados** e podem reproduzir exatamente o sintoma acima. Não generalize
"funciona no Docker Compose" a partir de um teste feito só no Chromium.

### Sintoma: requisição de mutação (`POST`/`PUT`/`PATCH`/`DELETE`) volta `403` com mensagem de origem rejeitada

**Causa**: `CsrfMiddleware` (`apps/api/src/infrastructure/http/csrf.middleware.ts`, ADR-002) exige que
o cabeçalho `Origin` (ou `Referer`, como alternativa) de toda requisição que muda estado bata
**exatamente** com `APP_ORIGIN` configurado no servidor. Um cliente que não seja o navegador real da
aplicação (uma ferramenta de teste que não define `Origin`, ou um `APP_ORIGIN` configurado com
scheme/host/porta diferente do que o navegador realmente usa) é recusado.

**Como diagnosticar**: confira nos logs de segurança do servidor a mensagem "Rejected a state-changing
request with a missing/mismatched Origin" e compare o `Origin` enviado com `APP_ORIGIN` configurado.

**Como corrigir**: garanta que `APP_ORIGIN` bate exatamente com a URL usada no navegador (incluindo
porta). Para chamadas feitas fora do navegador (scripts, harness de teste), envie o cabeçalho `Origin`
explicitamente igual a `APP_ORIGIN` — é o que `apps/web/e2e/support/global-setup.ts` faz para o
contexto de requisição do Playwright, que por padrão não define esse cabeçalho como um navegador real
faria.

---

## Limite de requisições (429)

### Sintoma: `429` com corpo RFC 9457, `"title": "Muitas requisições"`, durante login repetido ou durante uma suíte E2E longa

**Causa — dois mecanismos independentes**:

1. **Limitador de autenticação** (`AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`/`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS`,
   F-48) — por conta e por origem, especificamente em `/auth/login`.
2. **`ThrottlerGuard` global** (`THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS`, contado por IP, aplicado a
   **toda** rota — F-59, RESOLVIDO 2026-09-19) — pode recusar qualquer chamada, inclusive login, sob
   volume alto e concorrente (vários workers Playwright na mesma máquina competem pelo mesmo teto).
   Decisão formal: `--workers=1` para bateria E2E local completa contra banco volumoso, contra
   servidores recém-reiniciados (uma execução longa contra servidor já carregado pode travar mesmo
   com um único worker — ver `docs/local-environment.md` D-24, item 3).

**Como diagnosticar**: confira o corpo da resposta 429 — o `type` RFC 9457 e o `detail` indicam qual
dos dois mecanismos recusou. Um 429 em `/auth/login` especificamente após várias tentativas erradas é
o limitador de autenticação; um 429 em qualquer outra rota (ou em `/auth/login` sob carga paralela
alta, sem tentativas erradas correspondentes) é o `ThrottlerGuard` global.

**Como corrigir**:

- **Nunca** reduza `THROTTLE_LIMIT`/`AUTH_RATE_LIMIT_*` de produção para fazer um teste passar — são
  controles de segurança contra abuso (CLAUDE.md §12/AGENTS.md: nunca desabilitar controle de
  segurança para acomodar teste).
- Para o limitador de autenticação em execução **local** de E2E: alinhe `apps/api/.env` com os
  valores que o job de E2E do CI já usa (D-23) — `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS=200`,
  `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=1000`. Isso é **local ao ambiente de teste E2E**, nunca um valor de
  produção — `.env.example` continua com `5`/`20`.
  - Por que isso é seguro e não é enfraquecer o controle: a suíte E2E legitimamente gera uma
    tentativa "falha" de login por design (tenta a senha já rotacionada primeiro, cai para a original
    só se necessário — ver `docs/guides/testing.md` §1.5), multiplicada por vários workers reutilizando a
    mesma conta ao longo de muitos arquivos de spec mais retries do CI; o valor de produção (`5`/`20`)
    nunca foi dimensionado para esse padrão de tráfego automatizado.
- Para o `ThrottlerGuard` global (F-59): **nenhuma mitigação permanente foi decidida ainda**. A única
  mitigação verificada até agora é reduzir a concorrência de workers do Playwright
  (`--workers=1` — é exatamente o que `test-e2e-webkit` faz hoje no CI, ver `docs/guides/testing.md` §4.1).
  Não há variável de ambiente documentada para elevar `THROTTLE_LIMIT` só para E2E — se isso for
  necessário, é uma decisão de configuração de ambiente de teste ainda em aberto (ver F-59 em
  `docs/deferred-findings.md` para as opções consideradas e não adotadas).

---

## Design System desatualizado no app consumidor

Ver "Web não sobe" → "import de `@pharos/design-system/components` falha em massa" acima — a causa e
a correção são as mesmas: `apps/web` consome o `dist/` compilado do pacote, nunca a fonte
diretamente. Depois de qualquer edição em `packages/design-system`, rode
`pnpm --filter @pharos/design-system run build` antes de esperar ver o efeito em `apps/web` (dev,
build ou testes).

---

## Diferenças entre build de desenvolvimento e de produção

### Sintoma: uma varredura de acessibilidade acusava violação crítica (`aria-valid-attr-value`) no botão de disclosure do `FilterBar`, de forma intermitente

**Causa (F-71, RESOLVIDO em 2026-09-14)**: incompatibilidade de hidratação (`useId` posicional do
React 19, deslocado pelo enxerto de HTML transmitido em streaming sob `<Suspense>`). Medido antes da
correção: ~3,3% dos carregamentos sob `next dev --turbopack`; **0 em 165** sob build de produção no
**Chromium**; mas **3 em 4** sob build de produção no **Firefox** — ou seja, o defeito **não era
exclusivo do servidor de desenvolvimento** e chegava ao usuário, dependendo do motor. O mesmo
mecanismo apareceu, medido separadamente, em `MultiSelectFilter` e `ColumnVisibilityMenu` — o
defeito irmão de F-71 (F-74), também corrigido (ver `docs/deferred-findings.md`).

**Correção aplicada**: o elemento do painel/popover passou a existir em **toda** passagem de
render, ocultado com o atributo `hidden` enquanto fechado, em vez de ser desmontado — o botão que
o abre nunca mais referencia, via `aria-controls`, um elemento ausente do documento. Nenhum
atributo ARIA foi removido e nenhum teste foi enfraquecido. Ver `docs/architecture/frontend.md` §4.3 para o
mecanismo completo e a regra geral para quem estende o Design System.

**O método de diagnóstico abaixo continua válido** para qualquer achado futuro da mesma classe
(hidratação divergindo entre servidor de desenvolvimento e build de produção, ou entre motores):
primeiro, determine contra qual modo de build a medição foi feita —
`apps/web/e2e/support/global-setup.ts` imprime `BUILD MODE: DEVELOPMENT SERVER` ou `BUILD MODE:
PRODUCTION BUILD` como a primeira linha de log de qualquer execução E2E, antes de qualquer teste
rodar. Uma violação observada contra o servidor de desenvolvimento padrão (`pnpm dev`, o que
`playwright.config.ts` sobe por padrão localmente) não pode, sozinha, ser tratada como prova de
defeito em produção — e também não pode ser descartada automaticamente como "só desenvolvimento"
sem medir os três motores, porque foi exatamente essa suposição que deixou F-71 chegar à produção
no Firefox sem ser detectado.

```bash
pnpm --filter @pharos/web run test:e2e:ci-parity
```

Isso constrói (derrubando o dev server antes, respeitando D-16), sobe `next start` e aponta o
Playwright para ele com `PLAYWRIGHT_SKIP_WEB_SERVER=true` — a mesma forma que os três jobs de E2E do
CI usam. Teste nos três motores (`--project=chromium|firefox|webkit`) antes de concluir qualquer
coisa sobre um achado de hidratação novo — a lição registrada em F-71 é justamente que uma amostra
de "carregamentos limpos" num motor só não permite concluir nada sobre os outros.

**Limitação conhecida do instrumento, não do produto**: `@axe-core/playwright` não teria pego
sozinho o defeito irmão (F-74) em `MultiSelectFilter`/`ColumnVisibilityMenu`, mesmo antes da correção — a
regra `aria-valid-attr-value` rebaixa para "needs review" (não falha) qualquer elemento que também
carregue `aria-haspopup`, presente nesses dois componentes e ausente no botão de disclosure do
`FilterBar`. "Zero violações" numa varredura axe nunca prova ausência de `aria-controls` pendurado
— só ausência do que a regra escolhe opinar sobre.

---

## Falhas de E2E por variáveis de ambiente ausentes

### Sintoma: `playwright test` termina rápido, com a maioria dos testes `skipped` e código de saída 0

**Causa (D-20/D-22 Trap 4)**: `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` não exportadas no shell que
roda o Playwright. `requireSeedCredentials()` (`e2e/support/admin-session.ts`) chama `test.skip()`
fora do CI quando faltam — silenciosamente, por design, para permitir rodar um subconjunto sem backend
semeado. **Em CI a mesma função lança e falha a suíte** em vez de pular (F-33) — então este sintoma é
esperado só localmente.

**Como diagnosticar**: sempre leia a contagem de `skipped` no resumo do Playwright, nunca só o código
de saída. "4 passed, 113 skipped" em poucos segundos é o sintoma clássico de uma suíte que praticamente
não rodou, não de uma suíte rápida.

**Como corrigir**:

```bash
# a partir de apps/web, com API (3001) e web dev server (3000) já rodando
set -a && . ../../.env && set +a
PLAYWRIGHT_SKIP_WEB_SERVER=true pnpm exec playwright test --project=chromium
```

### Sintoma: provisionamento de papel/conta em E2E falha com "no such role", mesmo com o papel existindo no banco

**Causa histórica (D-20, já corrigida)**: o provisionamento buscava só a primeira página
(`page=1&pageSize=100`) de `GET /admin/roles` — um papel que ordenasse além da página 100 nunca era
encontrado. `findAdminRoleByName` (`e2e/support/admin-session.ts`) hoje pagina até encontrar o papel
ou esgotar `totalPages`. Se este sintoma reaparecer, confirme se algum chamador novo reimplementou a
busca de papel sem usar essa função compartilhada, em vez de presumir regressão no backend.

### Sintoma: banco de desenvolvimento acumula muitas contas `E2E ...` com o papel mais privilegiado

**Causa (F-70, RESOLVIDO 2026-09-19 como propriedade de ambiente)**: não existe endpoint de exclusão
de usuário, e excluir direto no banco esbarraria na trilha de auditoria imutável — toda conta criada
por um spec E2E é permanente por desenho, deliberadamente (CLAUDE.md §8/§18.9 proíbem expurgo
destrutivo de identidade). A mitigação de privilégio mínimo já está em vigor:
`apps/web/e2e/problems.spec.ts` foi migrado do papel `Platform Administrator` (o mais privilegiado)
para `Problem Manager`, o menor papel suficiente para o cenário — a causa raiz (nenhum
expurgo/desativação de identidade de teste) permanece, por ser decisão de produto futura, não dívida
de correção pendente.

**Como diagnosticar**: é esperado, não um vazamento a investigar — confirme contando usuários com
prefixo `E2E`/`fixture-`/`e2e-` antes de suspeitar de outra causa para o crescimento do banco.

**Como corrigir**: nenhuma correção estrutural existe hoje (é decisão de produto em aberto, sob
CLAUDE.md §16 — se a plataforma deve ter desativação/expurgo de identidade de teste). Mitigação
possível, não aplicada: provisionar essas contas específicas com o menor papel suficiente para o
cenário.

### Sintoma: campo de formulário de login mostra o texto digitado, mas o envio manda vazio (mais comum em WebKit sob throttling)

**Causa (D-21, já corrigida no harness)**: o formulário de login é controlado por `react-hook-form`,
mas não fica realmente ligado ao estado do React até a hidratação terminar — preencher o campo antes
disso grava no DOM diretamente, e o primeiro render controlado da hidratação sobrescreve com o estado
(ainda vazio) do formulário. `fillLoginCredentials` (`e2e/support/admin-session.ts`) já mitiga isso
relendo e repreenchendo o valor até ele "grudar". Se um formulário **diferente** apresentar o mesmo
sintoma, é a generalização em aberto documentada por **F-56** — não presuma que está coberta pelo
mesmo mecanismo.

---

## Seed falha sem `SEED_ADMIN_PASSWORD`

### Sintoma: `pnpm --filter @pharos/api run db:seed` (ou `prisma db seed`) falha exigindo uma senha

**Causa**: o seed (`apps/api/prisma/seed/platform.seed.ts`) se recusa, deliberadamente, a bootstrapar
um administrador sem senha explícita — nunca gera ou assume um valor padrão para uma credencial real.

**Como corrigir**: defina `SEED_ADMIN_PASSWORD` em `apps/api/.env` (a política de senha exige
comprimento mínimo e complexidade — ver `PASSWORD_MIN_LENGTH`/`PASSWORD_REQUIRE_COMPLEXITY` no mesmo
arquivo) antes de rodar o seed. Nunca registre o valor escolhido em nenhum documento deste
repositório.

**Nota relacionada (F-60, RESOLVIDO 2026-09-19, não é falha de seed mas confunde-se com uma)**: o seed usa `upsert`
com `update: {}` para usuários já existentes — uma correção feita no código do seed (como o
reposicionamento de unidade organizacional de F-15) nunca alcança uma linha de usuário que já existia
antes da correção, mesmo rodando o seed de novo. Um sintoma que parece regressão de
autorização/escopo, contra um banco de desenvolvimento de vida longa, pode na verdade ser isso —
verifique o campo relevante (ex.: `primaryOrgUnitId`) diretamente no banco antes de suspeitar do
código de autorização.
