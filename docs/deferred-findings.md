# Deferred findings — PharosGRC

Real problems found during review that were deliberately **not** fixed at the moment of discovery,
because fixing them there would have expanded a task's scope past what it was dispatched to do. Each
entry names the task that should absorb it. This file exists so a finding is not lost between the
review that found it and the task that owns it; it is not a backlog of ideas, only of confirmed
findings.

## F-1 — RESOLVIDO (data desconhecida, confirmado 2026-09-18 no saneamento 023) — Enum-mirroring label maps are typed too loosely to fail on a missing translation

**Found**: 2026-09-05, reviewing the D-10 labels-prop change.
**Where**: `apps/web/src/lib/messages/risks.ts` — `RISK_LEVEL_LABELS` and `statusLabels` are typed
`Record<string, string>`, and `riskLevelBadge.levelName` falls back to `?? level`.

**Why it matters**: the message catalogs were built so that a missing key is a **compile error** —
that is the mechanism protecting the permanent pt-BR guarantee (D-8, Constitution Principle X). A
`Record<string, string>` mirroring a Prisma enum defeats it: add a value to `RiskStatus` or
`RiskLevel` and nothing fails to build, no test fails, and a Brazilian user is shown the raw
identifier (`UNDER_TREATMENT`) on screen. The failure is silent, user-facing, and in the exact
category the catalog was created to make impossible.

**Not a regression introduced by D-10** — the pattern pre-dates it in this file.

**Owner**: the next task touching `apps/web/src/lib/messages/`. Type these maps against the
corresponding union (`Record<RiskLevel, string>` / `Record<RiskStatus, string>`) and drop the
fallback, so an untranslated enum value cannot compile. Phase 8 (US6, risk lifecycle) works directly
on statuses and should not land before this is closed.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings): a correção já
está no arquivo. `apps/web/src/lib/messages/risks.ts` tem `RISK_LEVEL_LABELS: Record<RiskLevel,
string>` e `RISK_STATUS_LABELS: Record<RiskStatus, string>`, ambos tipados contra os unions da
aplicação, sem `?? level`/`?? status`. O cabeçalho do próprio arquivo já documenta a correção citando
este achado. Não foi possível determinar exatamente quando isso aconteceu (nenhum commit dedicado
identificado por mensagem), mas o estado atual satisfaz integralmente o critério do achado — nenhuma
ação necessária. Fecho aqui com a data em que confirmei, não a data em que a correção
provavelmente aconteceu.

## F-2 — RESOLVIDO (T203, confirmado 2026-09-18 no saneamento 023) — `role="status"` on text that is present at first render, not announced

**Found**: 2026-09-05, by the agent writing the `RiskMatrix`/`RiskScore` tests — reported honestly
rather than papered over.
**Where**: `RiskScore`'s not-yet-assessed message (`packages/design-system/src/components/risk/risk-score.tsx`);
the same pattern already exists in `LoadingState` and `StatusBadge`.

**Why it matters**: `role="status"` is a live region, and live regions only announce content that
changes *after* mount. When the message is rendered statically — which is the case on risk detail —
a screen-reader user gets no proactive announcement. The text is still reachable in browse mode, so
this is a gap in emphasis, not in access. It is worth naming because "this risk has not been
assessed" is a load-bearing statement in a product whose entire output is a risk judgement.

**Owner**: T203 (accessibility audit and remediation to WCAG 2.1 AA). Decide there whether these are
live regions at all, or plain text that should stop claiming to be.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings): T203 decidiu —
`RiskScore`, `RiskLevelBadge` e `StatusBadge` não carregam `role="status"` (cada um com comentário
próprio citando "T203, F-2"); `LoadingState` mantém `role="status"` porque o conteúdo dele muda de
verdade depois da montagem, com um comentário explicando exatamente essa distinção. Decisão tomada e
aplicada de forma consistente nos quatro componentes — nenhuma ação necessária.

## F-3 — RESOLVIDO (2026-09-11, 007-implementation-remediation Frente B — marcador de cabeçalho adicionado 2026-09-18) — `packages/api-types` cannot produce useful types from the document it is generated from

**Found**: 2026-09-05, verifying the US4 OpenAPI regeneration.
**Where**: `apps/api/openapi.json` (generated), `packages/api-types/`, and the task **T205**.

**The facts, measured**: the generated document has 17 paths and 6 component schemas, and **all 6 have
zero properties** — every one is `{"type":"object","properties":{}}`. No DTO in this codebase carries
`@ApiProperty`, and the generator reflects decorators, so it can describe which routes exist but not a
single field of any request or response.

**Why it matters**, two distinct consequences:

1. `openapi:check` is a **route-level** drift detector, not a contract-level one. It catches an added,
   removed or renamed route. It cannot catch a renamed, retyped or deleted DTO field — the drift most
   likely to break a client silently. It is still worth keeping green; it should just not be described,
   or relied on, as protecting the API contract.
2. **T205 as written will not deliver what depends on it.** `apps/web/src/lib/api-client.ts` and
   `apps/web/src/lib/permissions.ts` both carry comments promising the real types arrive "once T205
   lands". Regenerating `packages/api-types` from this document yields types with empty request and
   response bodies — the package would exist, build, and provide nothing.

**Not caused by US4**, and deliberately not fixed here: the fix is a fork in the road that belongs to
whoever executes T205, and choosing it now would be unapproved scope. The options, so that task starts
from evidence rather than rediscovering this:

- annotate every DTO with `@ApiProperty` — makes the reflected document authoritative, at the cost of
  duplicating each field's shape next to the `class-validator` decorators that already describe it;
- generate `packages/api-types` from the hand-authored `specs/001-grc-platform-foundation/contracts/*.openapi.yaml`
  instead, which are already complete and are the contracts the project treats as authoritative — and
  keep the decorator-reflected document purely as the route-level drift check it actually is;
- drop `packages/api-types` and keep hand-written types in `apps/web`, which is what the frontend does
  today and what it has shipped US2 and US3 on.

The middle option is the one that matches how this project already assigns authority (`docs/local-environment.md`
D-5: the hand-authored spec wins where the two disagree), but it is T205's decision to make.

**Also fixed in passing** (needed to unblock a required gate, kept): `packages/api-types/scripts/generate.mjs`
passed a raw Windows path to `openapiTS()`, whose resolver read it as a foreign URL scheme and silently
returned an empty document. It now passes `pathToFileURL(...)`. The package had therefore **never**
generated successfully on this machine — the committed `api.d.ts` was still the bootstrap placeholder.

> **RESOLVED, 2026-09-11** (007-implementation-remediation, Frente B). T205's decision is made, and
> it is the middle option this finding already named as the one that matches D-5: `generate.mjs`'s
> `DOCUMENTS` array now lists all ten hand-authored contracts (`auth`, `admin`, `platform`, `risks`,
> `grc-foundation`, `controls`, `compliance`, `audit`, `assets`, `processes` —
> `packages/api-types/scripts/generate.mjs`), never `apps/api/openapi.json`. Consequence 2 (T205
> delivering empty bodies) is closed: `dist/generated/*.d.ts` now carries real, non-empty request/
> response shapes for every contract, proven by `apps/api/test/unit/api-types-dist-resolution.spec.ts`.
> Consequence 1 stands exactly as written — `openapi:check` is still a route-level drift detector
> against the decorator-reflected document, which is still structurally empty, and this finding's own
> distinction between the two documents is why the generator was pointed at the other one. **This
> finding's own evidence was gathered against the reflected/decorator document** — the layer that
> looked like the natural source for a generator named `api-types` — when the contracts this project
> already treats as authoritative (D-5) were the correct layer to generate from all along; recorded
> here because the same misdirection is easy to repeat the next time someone reaches for
> `apps/api/openapi.json` expecting it to describe a field.

## F-4 — RESOLVIDO como ambiente (2026-09-19, rodada 023) — E2E genuinely verifies two browsers, not three

**Found**: 2026-09-05, running the full Playwright suite for US4.

- **WebKit on Windows**: Playwright's `fill()` on the login form's e-mail field does not take, reproduced
  identically on the untouched `auth.spec.ts` in isolation. Every WebKit spec is therefore blocked at
  sign-in. Environmental, not caused by any application change.
- **Firefox**: `risk-create.spec.ts` flakes under 5-way parallel load on this machine; passes cleanly in
  isolation immediately afterwards.

**Why it matters**: `playwright.config.ts` declares three browser projects, so the suite *looks* like it
covers three. It covers Chromium reliably, Firefox with a load-dependent flake, and WebKit not at all.
Anyone reading "E2E passing" is entitled to assume more than is true — the same shape of mistake as F-3,
where a gate's name promised more than the gate delivered.

**Owner**: T207 (run the quickstart validation scenarios end to end) and T203. Decide there whether to fix
the WebKit environment, pin the suite to the browsers it actually verifies, or run WebKit only in CI on a
platform where it works. Leaving three projects declared while one never runs is the one option that
should not survive.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do coordenador:
fechar como ambiente, com evidência do que a CI de fato roda hoje). O "Owner" original já apontava a
opção certa — "run WebKit only in CI on a platform where it works" — e é exatamente essa a que o
projeto tomou, não como decisão nova desta rodada, mas como algo que já estava implementado sem o
cabeçalho deste achado ter sido atualizado.

**O que a CI de fato roda hoje** (`.github/workflows/ci.yml`, lido nesta rodada):

- **`test-e2e` (Chromium)**: `runs-on: ubuntu-latest`, `if:` implícito — roda em **todo** push e
  pull request (linha ~646, `pnpm --filter @pharos/web exec playwright test --project=chromium`).
  Este é o único navegador coberto automaticamente.
- **`test-e2e-firefox`/`test-e2e-webkit`**: ambos `runs-on: ubuntu-latest`,
  `if: github.event_name == 'workflow_dispatch'` (linhas 892/1056) — rodam **só** sob disparo
  manual, deliberadamente, nunca em push/PR. O cabeçalho do arquivo (linhas 14-18) e o comentário
  de cabeçalho de `test-e2e-webkit` (citados no próprio achado, "why they are two separate jobs")
  documentam a razão desde `3b8d69f`/`22021d2`.
- **`test-e2e-webkit` roda com `--workers=1`** (linha 1249) — a flag "TEMPORÁRIA" que CLAUDE.md §17
  item 13 registra como "ainda não revertida". Confirmado nesta rodada: não é esquecimento — há uma
  revisão datada dentro do próprio arquivo ("Reviewed 2026-09-14 (F-72). KEPT, and here is the
  reasoning", linhas 1215-1244) explicando por que foi mantida (a evidência aponta PARA
  concorrência, não contra ela — F-59's `ThrottlerGuard` compartilhado por IP explica o padrão de
  falha "target page has been closed") e nomeando o próximo passo real: um par de execuções
  `workflow_dispatch`, uma com a flag e uma sem, comparando os dois relatórios — não uma reversão
  silenciosa.
- Todo Windows nesta máquina de desenvolvimento nunca roda WebKit/Firefox via CI — só via
  `pnpm --filter @pharos/web exec playwright test`, local, onde os dois defeitos originais deste
  achado (o `fill()` do WebKit no Windows, o flake do Firefox sob paralelismo) permanecem
  verdadeiros e são exatamente por isso que são ambiente, não produto: `test-e2e-firefox`/
  `test-e2e-webkit` nunca rodam neste sistema operacional.

**A divisão por engine (`22021d2`) já foi exercitada por `workflow_dispatch` real** — quatro vezes,
todas em 2026-09-11, medido via `gh run list --workflow=ci.yml --event=workflow_dispatch` nesta
rodada: `34594939253`, `34603016921`, `34610189725`, `34617754814`, todas posteriores ao commit
`22021d2` (11:05:28 do mesmo dia). CLAUDE.md §17 item 13 registra "nunca foi verificada por um
`workflow_dispatch` real" — isso não é mais exato; existiu, com resultado real. A execução mais
recente (`34617754814`, inspecionada com `gh run view`) mostra exatamente o padrão que a revisão
F-72 já previa: `test:e2e (chromium)` **verde** (12m14s), `test:e2e (webkit)` **vermelho** (25m26s,
falhando em "Run Playwright (webkit)"), `test:e2e (firefox)` também vermelho — a mesma instabilidade
de engine sob volume que este achado documentou desde 2026-09-05, agora reproduzida em CI Linux
real, não só nesta máquina Windows. Isso não é regressão nova: é o mesmo achado (F-4), a mesma causa
provável (F-59), confirmando-se num ambiente diferente.

**Por que fecha como ambiente, e não como pendência de correção**: o achado original pedia uma
decisão entre três caminhos — consertar o ambiente WebKit, fixar a suíte nos navegadores que
realmente verifica, ou rodar WebKit só onde funciona. A arquitetura de CI atual já escolheu e
implementou o terceiro caminho, com justificativa registrada em código. O que resta — WebKit/Firefox
ainda instáveis mesmo em CI Linux sob volume — é a MESMA classe de instabilidade que F-59 já
nomeia e cuja mitigação (reduzir paralelismo) já está parcialmente aplicada (`--workers=1` no job
webkit) e formalmente registrada como decisão pendente de uma segunda medição
(`workflow_dispatch` comparativo), não como algo que este achado, sozinho, ainda precisa decidir.

## F-5 — RESOLVIDO como decisão confirmada (2026-09-19, rodada 023) — The test database is migrated but never seeded

**Found**: 2026-09-05, while covering the reference-data endpoints.
**Where**: `apps/api/test/integration/support/global-setup.ts`.

The setup runs `prisma migrate deploy` but never `prisma db seed`. So `risk_categories`, `risk_types`
and `risk_origins` are **empty** in `pharos_grc_test` while the development database `pharos_grc` has
5/2/4 release-seeded rows. `reference-data.spec.ts` works around it by inserting its own rows per test,
mirroring existing fixture conventions.

**Why it matters**: development and test disagree about what baseline data exists. A test can pass
against rows it created itself while the real seeded data has different properties — different codes,
different ordering, different active/inactive mix — and nothing would notice. It also means the seed
itself is exercised only in development, never by the suite, despite seed idempotency being a property
this project has deliberately verified by hand before.

**Not urgent and not a production defect** — the workaround is sound and no other spec depends on those
tables. But the divergence should be a decision, not an accident: either the test database is seeded and
specs build on that baseline, or it is deliberately empty and every spec owns its data. Right now it is
empty by omission.

**Owner**: T207 (quickstart validation end to end), or the next task touching the integration harness.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do coordenador:
investigar e concluir qual dos dois lados é verdade). O achado original já colocava a pergunta
certa — "either the test database is seeded and specs build on that baseline, or it is deliberately
empty and every spec owns its data" — sem responder qual das duas é a realidade. Investigado agora,
não presumido: **é a segunda. Nenhuma suíte lê o seed de dados de referência; todo consumidor cria
os próprios.**

`apps/api/test/integration/support/global-setup.ts` continua rodando só `prisma migrate deploy` +
`resetMutableTestData`, nunca `prisma db seed` — confirmado por leitura, comportamento inalterado
desde 2026-09-05. A pergunta real era se algo DEPENDE disso. Varredura completa, não amostral:

- **`grep -rln "risk_categories\|riskCategory\|risk_types\|riskType\b\|risk_origins\|riskOrigin\b"
  apps/api/test`** retorna nove arquivos além de `reference-data.spec.ts`:
  `dashboard.spec.ts`, `information-disclosure.spec.ts`, `risk-audit.spec.ts`,
  `risk-history.spec.ts`, `risk-immutability.spec.ts`, `risk-lifecycle.spec.ts` (contrato),
  `risk-approval.spec.ts`, `risk-history.spec.ts`, `risk-transition-concurrency.spec.ts`
  (integração), e `support/database-roles.ts`.
- **Cada um dos que precisam de uma categoria/tipo/origem real cria a própria via
  `prisma.client.riskCategory.create(...)`** — confirmado com
  `grep -rn "riskCategory\.\(find\|create\)" apps/api/test/`: **13 ocorrências, todas `.create`,
  zero `.find*`** contra uma linha pré-existente, em `dashboard.spec.ts:143`,
  `information-disclosure.spec.ts:421`, `reference-data.spec.ts:117,127,137`,
  `risk-audit.spec.ts:83`, `risk-history.spec.ts:72` (contrato), `risk-immutability.spec.ts:69`,
  `risk-lifecycle.spec.ts:100`, `risk-approval.spec.ts:93`, `risk-history.spec.ts:128,328`
  (integração) e `risk-transition-concurrency.spec.ts:80` — no mesmo padrão que
  `reference-data.spec.ts`'s próprio cabeçalho já documentava para si mesmo ("no other spec file in
  this suite touches these three tables (verified by grep)"), agora verificado para a suíte
  inteira, não só para a alegação do próprio arquivo sobre si mesmo.
- **Papéis, permissões e usuários seguem o mesmo padrão** — `createLocalUserFixture`/
  `createUserFixture` (`support/fixtures.ts`) criam usuário e credencial por teste; nenhuma
  suíte consulta um papel ou permissão semeados por nome esperando que `platform.seed.ts` os tenha
  colocado lá.

**Conclusão**: sobra de configuração, não dívida. O comentário "empty by omission" do achado
original estava certo sobre o SINTOMA e errado sobre o RISCO — não há decisão pendente porque não
há consumidor esperando o seed. Rodar `prisma db seed` no `global-setup` não destravaria nada; só
adicionaria tempo de execução e um segundo lugar para o seed divergir do que cada spec já cria por
conta própria.

**Evidência de execução**: suíte de contrato completa (58 arquivos/827 testes) e de integração
completa (59 arquivos/297 testes) verificadas verdes nesta mesma rodada (ver F-57), sem `prisma db
seed` ter rodado em nenhuma das duas — a prova operacional de que nada falha por falta dele.

**Não fechado por remoção de aviso**: o comentário do achado sobre "seed idempotency ... never
exercised by the suite" permanece verdadeiro e não é o que este achado pedia para resolver — o seed
de desenvolvimento (`platform.seed.ts`) continua exercitado só manualmente/em CI via
`prisma db seed` explícito, nunca pela suíte de contrato/integração. Isso é uma lacuna de cobertura
do PRÓPRIO seed, não do banco de teste, e não é o que F-5 media.

## F-6 — RESOLVED 2026-09-05

`docker/web.Dockerfile` now builds: `apps/web/next.config.ts` sets `output: "standalone"` gated behind
a `DOCKER_BUILD=1` build arg (native `next build` on this Windows machine cannot create the symlinks
standalone tracing needs and was verified to fail outright unconditionally); `apps/web/public/` was
confirmed unused anywhere and is deliberately left uncopied. Verified past "it builds" into "it runs":
both images built, the full compose stack reached healthy, migrations and the seed applied to the
containerized PostgreSQL, and a real sign-in through the containerized web app against a containerized
API returned real seeded data. See D-1 in `docs/local-environment.md` for the full verification and
F-12/F-13/F-14 below for what that verification found still broken elsewhere in the stack.

## F-7 — RESOLVED 2026-09-07 — ADR-011 claimed seven extension points were "proven"; three did not exist

**Found**: 2026-09-05, writing `docs/architecture.md` (T206) — the first time anyone read the design
documents and the code end to end together.

ADR-011 listed seven extension points "each already exercised by Risk Management so they are proven
rather than theoretical". Four are real: the permission seed registry, the navigation registry,
`AuditRecorder`, and the scoped repository base. **Three were not built at all**: the dashboard card
contribution point (the dashboard declares literal arrays inline; there is no registry), the
comments/attachments entity-type registry, and the notification port (both US9 / Phase 11 — `core/`
has no `comments`, `files` or `notifications` capability directory).

**Why it matters**: SC-011 — "a new GRC module can be added without changing the shell, `core/` or Risk
Management" — is the whole argument that this architecture will survive ten more modules. An ADR
asserting the mechanism is proven, when three sevenths of it is absent, is the most expensive kind of
documentation error: it is believed, and it is believed precisely by the person about to build module
number two.

**Corrected**, not deferred: the ADR-011 paragraph now separates what is exercised today from what is
designed, and points at T199 and Phase 11 for the missing pieces. The architectural decision did not
change — only a false claim about the present.

**Was open, owned by T206a**: that task built a throwaway probe module exercising every extension
point and then removed it — the thing that converts SC-011 from intent into evidence.

**Resolved**: 2026-09-07. All three previously-missing extension points are now real, each proven by
production code rather than a probe. The dashboard card contribution point is
`core/dashboard/domain/planned-area-registry.ts`'s `registerPlannedArea`/`getPlannedAreas` (fixed
during F-22/F-23, T206a's own re-run). The comments/attachments entity-type registry is real and now
has a second registrant beyond Risk Management: `grc/evidence`'s `EvidenceModule` calls
`registerAttachableEntityType('EVIDENCE', ...)` (`CommentableEntityType` still has only `RISK` — see
`docs/architecture.md`'s "Comments and attachments" section for that distinction, kept accurate
rather than rounded up). The notification port's directory exists — `core/notifications/**`, full
`domain → application → infrastructure → presentation` — though, per the blueprint's own honest
accounting, it is "infraestrutura pronta, sem produtor": built, not yet fed by anything. That is a
real, separate gap (nothing produces a notification yet), not the absence F-7 originally found.

## F-8 — RESOLVIDO (item 1 em 2026-09-07; item 2 — documentação já corrigida, reconciliado 2026-09-19, rodada 023, Lote C) — Two other design documents run ahead of the code (expected, but worth naming)

Found alongside F-7, and deliberately **not** corrected at the time, because unlike F-7 these
described future work rather than asserting a present state. Both have since moved, independently
of each other, and are annotated below rather than closed outright — neither is fully cleared.

- **ADR-006's risk lifecycle and approval state machine** is design only. No `risk-lifecycle.ts`,
  `transition-preconditions.ts` or `Approval` handling exists; Phase 8 (US6, T147-T162) is entirely
  unchecked. A reader of `research.md` alone would reasonably believe it is built.

  > **Cleared, 2026-09-07**: no longer design-only. `modules/risk/domain/risk-lifecycle.ts` and
  > `domain/transition-preconditions.ts` implement the full transition table with approval gates;
  > `domain/approval.ts` models the approval itself, driven by
  > `application/approvals/request-approval.usecase.ts` and `decide-approval.usecase.ts`. Segregation
  > of duties is enforced twice — in the application layer and by the database's own
  > `approvals_decided_by_requester_check` CHECK constraint. See `docs/architecture.md`'s "Known gaps
  > and honest limits" section, which states this plainly rather than assuming it from the ADR.

- **`CLAUDE.md` §4 and plan.md's Core capability list** name `users`, `files`, `notifications` and
  `configuration` as core capabilities. Those directories do not exist; user administration currently
  lives inside `identity`.

  > **Partially cleared, 2026-09-07**: `core/files` and `core/notifications` now exist, each with the
  > full `domain → application → infrastructure → presentation` layering (the former built for
  > comments/attachments, the "Shared GRC Foundation" phase's `EVIDENCE` registration among its real
  > callers; the latter built but still without a producer — see F-7's resolution above).
  > `core/users` and `core/configuration` remain genuinely absent — user administration still lives
  > inside `identity` via `UserDirectoryPort`, and no configuration capability has started. A future
  > module should still check the tree before assuming either exists.

**Why record them**: both are legitimate forward-looking specifications. The risk is a reader treating
a specification as an inventory. `docs/architecture.md` now states plainly, for each extension point,
whether it is implemented today or planned — that document, not the ADRs, is the accurate account of
what exists.

**Resolução do item 2, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do
coordenador: corrigir a documentação, não o código). Reverificado contra o código atual, não
presumido: `ls apps/api/src/core/` — nove diretórios (`audit`, `authorization`, `comments`,
`dashboard`, `files`, `identity`, `notifications`, `organizations`, `sessions`), nenhum
`core/users`, nenhum `core/configuration`. A afirmação de "ainda genuinamente ausentes" continua
verdadeira hoje.

**O que já corrige a documentação — não precisou de edição nova**: os dois documentos que
efetivamente rastreiam estado atual já dizem isto com precisão:

- `docs/architecture.md:911-913`: "Still genuinely missing: `core/users` (user administration lives
  partly inside `identity`, via `UserDirectoryPort`) and `core/configuration`, neither of which has
  started. A future module should not assume `core/users` or `core/configuration` exists."
- `docs/STATE.md:76-82`, seção "O que está planejado ou não existe": lista explicitamente
  "Configurações (CLAUDE.md §4, capacidade Core) — não existe `apps/api/src/core/configuration/`"
  e "`core/users` como diretório próprio — administração de usuário vive hoje dentro de
  `core/identity`... Não é um gap funcional..., é uma nota de organização de código" — a mesma
  distinção que o achado original já fazia.

**Por que `CLAUDE.md` §4 em si não precisou de edição**: o próprio `CLAUDE.md`, na abertura do
documento, já declara que "Onboarding e estado atual não vivem neste arquivo — vivem em
`docs/HANDOVER.md`... e `docs/STATE.md`" — o §4 é arquitetura/visão (o desenho de longo prazo do
Core), não uma alegação de estado presente, e o projeto já separa deliberadamente as duas coisas em
documentos diferentes. A dívida documental que este achado media não estava em `CLAUDE.md` ter uma
lista aspiracional — estava em `docs/STATE.md`/`docs/architecture.md` (os documentos que existem
precisamente para dizer o que há hoje) não terem essa ressalva. Eles já têm, verificado agora, não
presumido da nota de 2026-09-18.

## F-12 — RESOLVIDO (2026-09-11, 007-implementation-remediation — marcador de cabeçalho adicionado 2026-09-18) — `docker/api.Dockerfile`'s packaged image crash-loops: the generated Prisma client never reaches `pnpm deploy`'s output

**Found**: 2026-09-05, closing F-6 and running the full compose stack for the first time with both
application containers present.

The `api` container as built and run exactly per `docker-compose.yml` crash-loops immediately:
`Error: Cannot find module '.prisma/client/default'`, thrown while loading
`audit-recorder.service.js` (a provider Nest instantiates eagerly, so the process dies before it can
serve a single request). Confirmed by inspecting the built image directly: `node_modules/.prisma` does
not exist anywhere in it. `docker/api.Dockerfile`'s build stage runs `prisma generate` *before*
`pnpm --filter ./apps/api deploy --prod --legacy /workspace/deploy/api` — but the generated
`.prisma/client` directory lands beside `@prisma/client` inside the **workspace's** pnpm virtual store
(`.pnpm/@prisma+client@.../node_modules/.prisma/client`, confirmed present there in the `build` stage),
and `pnpm deploy --legacy` re-resolves `deploy/api`'s dependency tree from the content-addressable
store rather than cloning the workspace's current (generate-mutated) `node_modules` state, so that
directory is silently left behind. Every request path that touches Prisma is affected, not just audit.

**Why it matters**: this is the second of the two claims in F-6 ("the API image builds and runs") that
this pass's own verification could not confirm — it builds, but does not run. Until this is fixed,
`docker compose up` never produces a working API container, regardless of the web image.

**Not fixed here**: `docker/api.Dockerfile` and `apps/api` are outside this pass's surface (owned
concurrently). The likely fix is running `prisma generate` again *after* `pnpm deploy`, targeting the
deploy output directory directly, rather than relying on the pre-deploy generate's output surviving the
copy.

**Verification workaround used only to prove the rest of the stack (not a fix, not shipped)**: this
pass ran the Dockerfile's own intermediate `build` target (`docker build --target build`, which still
has the generate output and full devDependencies) as a throwaway container network-aliased `api`, to
reach and validate migrations, seed and a real authenticated request through the web container. The
image produced by the Dockerfile's actual `runtime` target, as authored, was never made to serve a
request.

**Owner**: the next task touching `docker/api.Dockerfile` or `apps/api`'s Prisma packaging, or T207.

> **RESOLVED, 2026-09-11** (007-implementation-remediation). Measured directly, not inferred: the
> packaged `api` image was built and started against real PostgreSQL/Redis (no `build`-target
> workaround this time), and its own `/health/ready` returned `{"status":"ok"}` — the crash-loop this
> finding names no longer reproduces. `specs/001-grc-platform-foundation/quickstart.md`'s 2026-09-11
> addendum records the same verification. Not independently re-diagnosed which side of the `prisma
> generate`/`pnpm deploy` ordering this describes changed; recorded as resolved on the observed
> symptom (a serving container), which is what this finding's own "Why it matters" names as the bar.

## F-13 — RESOLVIDO (boot-validation e navegador já corrigidos em 2026-09-11; TLS reclassificado como fora de escopo 2026-09-19, rodada 023) — `docker-compose.yml`'s `NODE_ENV=production` plus `.env.example`'s `SESSION_COOKIE_SECURE=false` default fail the API's own boot validation

**Found**: 2026-09-05, same verification pass as F-12, while constructing a working `api` process to
test against.

`docker-compose.yml` hardcodes `NODE_ENV: production` for the `api` service. `.env.example` — the file
`docs/local-environment.md`/quickstart.md's setup instructions say to copy to `.env` — defaults
`SESSION_COOKIE_SECURE=false` ("`false` ONLY for local HTTP development"). `env.schema.ts` correctly
refuses to boot with that combination: `SESSION_COOKIE_SECURE must be true when NODE_ENV=production.`
Following the documented setup verbatim (`Copy-Item .env.example .env`, then `docker compose up -d
--build`) therefore never produces a running `api` container — a second, independent reason `docker
compose up` fails end-to-end today, on top of F-12.

**Why it matters**: setting `SESSION_COOKIE_SECURE=true` to pass validation does not actually make the
stack usable from a real browser — nothing in `docker-compose.yml` terminates TLS, so a browser at
`http://localhost:3000` would receive a `Secure` cookie it refuses to store or send back. Curl-based
verification does not hit this (curl does not enforce `Secure`), which is exactly why this pass's own
sign-in proof did not surface it as a blocker, but a human following quickstart.md with a real browser
would be stuck either way: `false` refuses to boot, `true` boots but the browser silently drops the
session cookie.

**Not fixed here**: deciding between a TLS-terminating reverse proxy in front of the compose stack,
relaxing the production check for a documented local-compose profile, or accepting that this compose
stack is verified by curl/API tools only (never a real browser) until TLS exists, is a session/security
architecture decision, not a build-configuration one — outside this pass's `apps/web`/`docker/web.
Dockerfile` surface.

**Owner**: whoever next makes `docker compose up` a documented human (not just curl) validation path —
T207 is the natural candidate.

> **SPLITS IN TWO, 2026-09-11** (007-implementation-remediation). Measured, not inferred, against the
> current `docker-compose.yml` and a real Chromium session — this finding's own two halves no longer
> share one verdict.
>
> **Boot-validation half — never true as stated.** `docker-compose.yml:96` already sets
> `SESSION_COOKIE_SECURE: "true"` on the `api` service unconditionally, regardless of `.env`'s own
> `SESSION_COOKIE_SECURE=false` default — the file's own comment at line 87 names this finding and
> explains why (`NODE_ENV=production` forces the matching value here). Following the documented setup
> verbatim does not hit `env.schema.ts`'s refusal today. Whether this override already existed when
> F-13 was measured on 2026-09-05, or was added since, was not re-investigated; what is verified is
> that the boot-validation failure this half describes does not occur against the compose file as it
> stands now.
>
> **Browser-refusal half — measured FALSE, for Chromium specifically.** A real Chromium engine signed
> in through the rendered login form against the compose stack, over `http://localhost`, and stored,
> sent back, and cleared the session cookie correctly through a full login-to-logout cycle — the
> `Secure` refusal this half predicted did not happen. Chromium does not apply the `Secure` attribute's
> usual restriction to `localhost`, treating it as a secure context regardless of scheme. **Scope is
> exactly Chromium**: Firefox, Safari and a non-`localhost` published hostname were not exercised, and
> nothing here should be read as clearing those.
>
> **What remains genuinely open**: this stack has no TLS-terminating reverse proxy, so nothing beyond
> `localhost` — a real deployment hostname, any browser, any origin — has been verified and should not
> be assumed to work. That part of this finding's own "Not fixed here" stands unchanged.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do coordenador:
"torne o perfil local coerente consigo mesmo, não toque em semântica de produção"). Reaudita contra
o código atual, não contra a descrição original de 2026-09-05: os dois perfis locais já são
internamente coerentes, e não há mais nenhuma incoerência de configuração a corrigir.

- **Perfil nativo** (`pnpm dev`, sem Docker): `.env.example:22` define `NODE_ENV=development`;
  `.env.example:124` define `SESSION_COOKIE_SECURE=false`, com o comentário nas linhas 108-123
  explicando exatamente por que — desenvolvimento em `http://localhost` puro. `development` +
  `false` nunca aciona a validação de `env.schema.ts:186-190` (`SESSION_COOKIE_SECURE must be true
  when NODE_ENV=production`), que só dispara quando `NODE_ENV=production`. Coerente por
  construção.
- **Perfil `docker compose`**: `docker-compose.yml:76` fixa `NODE_ENV: production` para o serviço
  `api`, e `docker-compose.yml:96` fixa `SESSION_COOKIE_SECURE: "true"` no MESMO serviço,
  incondicionalmente — um override que já existia (ou foi acrescentado) antes de 2026-09-11 e está
  documentado no comentário de `docker-compose.yml:77-95`, citando este achado pelo nome. `.env`
  copiado literalmente de `.env.example` e `docker compose up` não aciona mais a recusa de boot —
  já medido e registrado acima ("Boot-validation half — never true as stated", 2026-09-11).
  Confirmado nesta rodada que `REDIS_URL` (a outra checagem de `NODE_ENV=production`,
  `env.schema.ts:176-180`) também é sempre fornecida pelo Compose (`docker-compose.yml`, serviço
  `api`, variável `REDIS_URL: redis://redis:6379`) — não há uma terceira checagem de produção sem
  cobertura.
- **A metade de navegador** já foi medida FALSA para Chromium em `localhost` (acima, 2026-09-11) —
  login, armazenamento e limpeza do cookie `Secure` funcionam de ponta a ponta pela UI real.
- **A parte "genuinely open" (proxy TLS)** deixa de ser tratada como pendência deste achado. O
  próprio cabeçalho de `docker-compose.yml` (linha 3) descreve o arquivo como "From-scratch
  development environment for PharosGRC" — infraestrutura de desenvolvimento local, nunca o
  caminho de implantação de produção (que não existe neste repositório hoje e não está
  especificado — CLAUDE.md §16 proíbe implementar o que não foi especificado). Exigir terminação
  TLS de um compose explicitamente rotulado como ambiente de desenvolvimento, nunca exposto além de
  `localhost` por design, não é uma incoerência de perfil — é uma pergunta sobre uma topologia de
  implantação de produção que ainda não existe. Fica fora do escopo deste achado, não escondida:
  se um dia este repositório ganhar um caminho de implantação real, TLS/`Secure` nesse caminho é
  responsabilidade desse trabalho, não deste arquivo de desenvolvimento.

Não houve mudança de código — os dois perfis já estavam corretos; só o cabeçalho deste registro
nunca foi atualizado para refletir a resolução de 2026-09-11 nem a reclassificação da parte de TLS.
`docker`/Docker Desktop não está disponível nesta máquina agora (`docker ps` falha ao conectar ao
daemon), então a reverificação desta rodada é leitura de código (`docker-compose.yml`,
`.env.example`, `env.schema.ts`), não uma nova execução do stack — a execução real já está
registrada acima, datada 2026-09-11, com evidência de `curl`/Chromium.

## F-14 — RESOLVIDO (2026-09-11, 007-implementation-remediation — marcador de cabeçalho adicionado 2026-09-18) — `.dockerignore`'s `.env`/`.env.*` rules do not exclude nested files; both application images bake in developer dotfiles

**Found**: 2026-09-05, same verification pass, while diagnosing why the web container's `/api/*` proxy
target did not match `docker-compose.yml`'s configured value (see the D-1 update in
`docs/local-environment.md` for that specific consequence and its fix).

`.dockerignore`'s header states its purpose is that "no secret belongs ... baked into an image layer"
and lists bare `.env`/`.env.*` patterns. Verified directly (`docker build` with a throwaway Dockerfile
that just runs `find . -iname ".env*"` over the build context): `apps/web/.env` and `apps/api/.env` —
both real, gitignored, developer-local files with live configuration values — are present in the build
context and were confirmed baked into the built `api` and `web` images. Only the repository-root
`.env`/`.env.example` sit at the depth these patterns actually exclude; a nested `.env` does not match
Docker's ignore-pattern evaluation the way the file's own comment assumes.

**Why it matters**: this is exactly the failure mode CLAUDE.md §12 names ("proteção de secrets", "nunca
armazenar secrets no código-fonte"). Today's values are dev-only and low-stakes, but the mechanism
meant to prevent this is silently not doing so, for *both* application images, and would bake in
whatever a developer's local `.env` happens to contain the next time either image is built. It also
caused a real functional bug this pass had to route around at the Dockerfile level rather than rely on:
`apps/web/.env`'s local-dev `API_INTERNAL_URL=http://localhost:3001` was what the web image's build
picked up instead of `docker-compose.yml`'s intended value, until this pass added explicit build
`ARG`s that take precedence regardless of what a stray `.env` file contributes.

**Not fixed here**: `.dockerignore` is not in this pass's authorized surface (only `docker-compose.yml`,
`docker-compose.test.yml`, `docker/web.Dockerfile` and `apps/web/next.config.ts` are). The likely fix is
anchoring or restating the patterns (e.g. `**/.env`, `**/.env.*`) so they match at every depth, matching
what the file's own comment already assumes they do.

**Owner**: whoever next touches `.dockerignore`, `docker/api.Dockerfile` or `docker/web.Dockerfile` —
flagging this alongside F-12 since both were found while building the same images.

> **RESOLVED, 2026-09-11** (007-implementation-remediation). `.dockerignore` now anchors the patterns
> at every depth exactly as this finding's own "likely fix" proposed: lines 45-48 carry both the bare
> and `**/`-prefixed forms (`.env`, `.env.*`, `**/.env`, `**/.env.*`), with `!.env.example`/
> `!**/.env.example` re-allowing the safe template files, and a header comment naming this finding
> directly (`apps/api/.env` and `apps/web/.env` were being baked into both images). Building the
> packaged `api` image this session and inspecting it directly confirmed no nested `.env` present —
> the same verification method this finding itself used.

## F-9 — RESOLVIDO (decisão de design, já executada em T163; fechado com evidência 2026-09-19, rodada 023) — An assessment records the date it claims, not the instant it was recorded

**Found**: 2026-09-05, implementing the US6 lifecycle preconditions.

`RiskAssessment` carries `assessedOn` (`@db.Date`) and no creation timestamp. `assessedOn` is business
data the assessor asserts and can backdate; it is not a record fact. So the `UNDER_REVIEW → ASSESSED`
precondition ("a new assessment was recorded during the review") can only be evaluated at day
granularity — implemented as "assessed on or after the UTC day the risk entered review", documented in
`application/lifecycle/reassessed-during-review.ts`.

**Why it is not urgent**: ordering is still deterministic — `id` is `uuid(7)`, which embeds a
millisecond timestamp, and `previousAssessmentId` chains assessments explicitly. And the instant a row
was actually created *is* recorded, in `audit_event.occurredAt` (ADR-005), which is the system of record
for "when did this happen" by design.

**Why it is worth naming**: the precondition cannot cheaply reach the audit trail, so it settles for a
day-granularity approximation — an assessment recorded earlier the same day, before review began,
satisfies it. In an audit-bearing product the difference between "the date the assessor claims" and
"the instant the platform recorded it" is exactly what a reviewer asks about, and right now only one of
the two is reachable from the risk domain.

**Owner**: **T163** (merged chronological history across assessments, decisions, transitions, approvals
and ownership changes) hits this directly — it must decide which timestamp orders the merged timeline,
and say so in the interface rather than silently mixing asserted dates with recorded instants. Changing
the schema is not obviously right: adding a creation instant to an append-only table duplicates what the
audit trail already holds.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do coordenador:
granularidade escolhida, não defeito). T163 já respondeu exatamente à pergunta que este achado deixou
em aberto, e já estava implementado quando o achado foi escrito — só nunca reconciliado no cabeçalho.

- **O contrato já declara a granularidade como intencional**:
  `specs/001-grc-platform-foundation/contracts/risks.openapi.yaml:1950-1952` tipa `assessedOn` como
  `type: string, format: date` (não `date-time`) — o próprio contrato nunca prometeu mais que um dia
  de resolução para este campo.
  `apps/api/prisma/schema.prisma:1276` (`assessedOn DateTime @map("assessed_on") @db.Date`) e o
  comentário do modelo em `schema.prisma:1262-1265` documentam explicitamente a distinção entre
  `assessedOn` (data de negócio, asserida) e o instante gravado.
- **A linha do tempo mesclada (T163) nunca confunde as duas**: `apps/api/test/integration/
  risk-history.spec.ts:307-320` (achado citado pelo próprio nome no comentário do teste, linha 307:
  "F-9: the two ASSESSMENT entries carry the ASSERTED `assessedOn` separately from the RECORDED
  `occurredAt` — never flattened into one") prova, com um teste de integração real contra Postgres,
  que: (1) a ORDENAÇÃO da linha do tempo mesclada usa `occurredAt` — o instante gravado — para toda
  entrada, inclusive `ASSESSMENT`; (2) `assessedOn` aparece como um campo SEPARADO, visível apenas em
  entradas do tipo `ASSESSMENT`, nunca ausente nelas e sempre `null` em qualquer outro tipo de
  entrada. Isso é exatamente a decisão que o "Owner" original deste achado pedia — "decidir qual
  timestamp ordena a linha do tempo mesclada, e dizer isso na interface em vez de misturar
  silenciosamente datas asseridas com instantes gravados" — só que já tomada e já testada antes deste
  achado ser reconciliado.
- **A alternativa que o achado descartava também não foi tomada**: o schema não ganhou um segundo
  timestamp de criação em `RiskAssessment` — `occurredAt` na linha do tempo mesclada já vem de
  `audit_event` (ADR-005), exatamente a fonte que o próprio achado nomeia como "o sistema de registro
  para 'quando isso aconteceu' por design". Nenhuma duplicação foi introduzida.

Não houve mudança de código nesta rodada — a resolução já existia. Verificação: leitura de
`risk-history.spec.ts:270-320`, cujo `expectedTypeSequence` (linha 272-283) e as asserções acima
foram lidas diretamente, não assumidas; suíte de integração completa validada nesta mesma rodada
(59/59 arquivos, 297/297 testes, ver F-57 abaixo) inclui este arquivo.

## F-15 — RESOLVIDO (seed já corrigido em `3cf3fe0`, T179/US8; consumidor real corrigido 2026-09-19, rodada 023, Lote B) — The seeded fixtures make the segregation-of-duties scenario impossible to enact

**Found**: 2026-09-05, writing the US6 approval E2E (T152), whose scenario is literally "an analyst
requests acceptance and a second user approves it".

`Risk Analyst` and `Risk Approver` are seeded on **sibling** organizational units (`DIV-A-TEAM-1` and
`DIV-A-TEAM-2`) with disjoint `UNIT` scope grants. Scope expands to descendants, never to ancestors, so
there is no organizational unit under which both can see the same risk — and the Analyst's own org-unit
picker offers only their own unit. The two roles that exist precisely to demonstrate segregation of
duties cannot both act on one risk.

The E2E therefore uses the Platform Administrator (global scope, holds `risk:approve`) as the second
user. That is an honest substitute — two genuinely different people, and the domain rule and the
database CHECK are both exercised — but it is not the scenario the task describes, and it is documented
at length in the spec's header rather than hidden.

**Why it matters beyond the test**: this is the second time the seed has made its own intended scenario
unreachable. The first was `Risk Analyst` lacking `risk:transition`, fixed when T152 was first written.
A seed that cannot demonstrate the product's central control is a demo that fails in front of a
customer, not just a test inconvenience.

**Owner**: T175 (the US8 administration E2E, which creates scoped users and verifies their granted and
denied actions) or whoever next touches `apps/api/prisma/seed/platform.seed.ts`. The fix is small —
place the approver where they can actually see the analyst's risks, e.g. grant `Risk Approver` scope on
the shared parent (`DIV-A`) rather than a sibling leaf — but it changes seeded scope, so it should be a
deliberate change with the E2E updated to use the real pair.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote B, decisão do coordenador:
corrigir de forma aditiva, restrita a `SEED_DEV_FIXTURES`, sem tocar seed de produção, e habilitar o
teste que usa a fixture — CLAUDE.md §19.10). Meio caminho já estava andado; a outra metade era um
gap real, corrigido agora.

- **O seed já estava corrigido, desde `3cf3fe0` (T179/US8, aditivo, só sob `SEED_DEV_FIXTURES`)**:
  `apps/api/prisma/seed/platform.seed.ts:1284` declara
  `SHARED_ANALYST_APPROVER_UNIT_ROLE_NAMES = new Set(['Risk Analyst', 'Risk Approver'])`, que
  sobrepõe o round-robin genérico só para esses dois papéis, colocando ambos em `teamA1` — a mesma
  unidade — em vez de unidades irmãs. Nenhum outro papel de fixture, nenhum papel/permissão/unidade
  de produção foi tocado; a mudança nunca sai do bloco `seedDevFixtures`, gated por
  `assertDevFixturesAllowed` (recusa a execução inteira se `SEED_DEV_FIXTURES=true` com
  `NODE_ENV=production`).
- **O gap real que restava**: `apps/web/e2e/risk-approval.spec.ts` (T152), o cenário que o achado
  nomeia como "solicitante ≠ aprovador", continuava usando o Platform Administrator como o segundo
  usuário — um substituto documentado, honesto, mas não o par de papéis real. Ninguém tinha
  atualizado o teste depois que o seed passou a permitir o par real, exatamente o "fixture que
  ninguém exercita é intenção, não capacidade" que a instrução desta rodada citou. Corrigido nesta
  rodada: o teste agora assina como `fixture-risk-approver@pharosgrc.local`
  (`signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskApprover)`), removendo o substituto e o
  cabeçalho do arquivo foi reescrito para descrever o estado real do seed em vez do antigo
  (unidades irmãs, cenário inatingível). Analista e Aprovador continuam com conjuntos de permissão
  disjuntos (`risk:transition` sem `risk:approve`, e vice-versa) — segregação de função por
  permissão, agora exercida pelo par nomeado real, não por um substituto.
- **Ambiente desta máquina**: `SEED_DEV_FIXTURES=false` aqui (D-24) — o `global-setup` desta mesma
  execução anuncia explicitamente "skipping fixture account (riskAnalyst)" e "(riskApprover)". Isso
  não impediu a verificação: as duas contas de fixture já existiam neste banco de desenvolvimento de
  vida longa, criadas por uma sessão anterior com `SEED_DEV_FIXTURES=true` — o `global-setup` só
  pula a CRIAÇÃO quando a flag está desligada, nunca apaga o que já existe. A verificação abaixo é
  real, não simulada, mas depende dessa coincidência de ambiente, não da flag desta execução.

**Verificação ao vivo, 2026-09-19** (servidores locais, `:3001`/`:3000`, `--workers=1
--project=chromium`, senha rotacionada D-24): `risk-approval.spec.ts` completo — **1/1 passou**
(31.1s), exercitando a jornada real ponta a ponta: Analista cria e solicita aprovação, sai, Aprovador
(a conta de fixture nomeada, não mais o Administrator) entra, vê a solicitação, decide. `pnpm
--filter @pharos/web run typecheck`/`lint` e `pnpm format:check` (raiz) limpos.

**Se `SEED_DEV_FIXTURES=false` e as contas não existirem** (a situação padrão numa máquina nova, por
D-24): o teste falha na primeira tentativa de login, não passa silenciosamente — o comportamento já
documentado e aceito como ambiente para todo spec desta pasta que depende de fixture, não uma
regressão desta correção.

## F-16 — RESOLVIDO (data desconhecida, confirmado 2026-09-18 no levantamento definitivo) — E2E flakiness under parallel workers is a shared-account race, not "load"

**Found**: 2026-09-05, running the full suite for US8. This **refines F-4**, which attributed the
flakiness to parallel load. Load is the trigger; it is not the cause.

Almost every spec signs in through `signInAsAdmin`, i.e. as the **same** seeded account — and that
helper permanently **rotates** the account's password on first use (`${SEED_ADMIN_PASSWORD}-E2E-1`).
With several workers signing in as that one account concurrently, they race over its password state:
one worker rotates while another is mid-authentication, and the loser fails with a password mismatch.
Reproduced twice at 2 workers on `risk-history.spec.ts` and `risk-treatment.spec.ts` — both untouched
by that pass — and both pass cleanly in isolation. Confirmed **not** a lockout: `failed_attempts = 0`
in the database at the time.

**Why it matters more than a flake**: a suite that only passes serially cannot be trusted to fail
honestly. Every future red run invites the answer "just a flake, rerun it", which is exactly how a real
regression gets waved through. It also caps CI wall-clock at one worker forever.

**The fix is a test-harness design change**, not a retry: give each spec (or each worker) its own
account rather than sharing one whose credentials mutate. The seed already creates distinct fixture
users per role, so the material exists.

**Owner**: T207 (quickstart validation end to end) or whoever next touches `apps/web/e2e/support/`.
Fold F-4's browser-coverage question in at the same time — the two are the same conversation about what
the suite actually verifies.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings — levantamento
definitivo): a correção prescrita já está no arquivo. `signInAsWorkerAdmin`
(`apps/web/e2e/support/admin-session.ts`) dá a cada worker sua própria identidade
Platform-Administrator-equivalente, provisionada uma vez e reaproveitada via `storageState` — o
comentário do próprio arquivo cita "F-16, retirado para provisionamento por execução por D-17/
research.md step 3" explicitamente. Confirmado por busca: só 2 chamadores ainda usam a conta
compartilhada `signInAsAdmin` no repositório inteiro, e um deles é `auth.spec.ts`, que precisa da
conta bootstrap real para exercitar a própria jornada de primeira autenticação (razão documentada no
próprio arquivo) — não uma sobrevivência do defeito. Nenhuma ação necessária.

## F-17 — NÃO REPRODUZ (tentativa real em 2026-09-18, saneamento 023) — Radix Select leaves its listbox open in Firefox

**Found**: 2026-09-05, writing the US8 administration E2E. Selecting an option several items down a
Radix `Select` leaves the listbox open indefinitely **in Firefox only**, reproduced in isolation rather
than only under parallel load. Worked around in the new spec by selecting the first option, matching
what `risk-create.spec.ts` already does; the root cause was not investigated.

**Why record it**: the workaround is in the tests, so the **product** defect — if it is one — is still
present for a Firefox user on every screen with a long Select. That includes the organization tree's
unit picker and the risk form. Someone should establish whether this is a Radix/Firefox interaction, a
version issue, or something this project does to those components.

**Owner**: T203 (accessibility audit and remediation), which already has to exercise these screens.

**Tentativa de reprodução, 2026-09-18** (rodada 023, saneamento de findings, instrução explícita do
usuário: só corrigir se reproduzir de verdade). Reproduzi contra o Select real de "Unidade
organizacional" no formulário de criação de risco (`/risks/new`), em Firefox real (Playwright,
`firefox.launch()`, não Chromium): (1) clique direto numa opção várias posições abaixo — listbox
fechou normalmente; (2) navegação por teclado (`ArrowDown` × 7 + `Enter`) — listbox fechou
normalmente; (3) busca por digitação (`type-ahead`) — listbox fechou normalmente. Nenhuma das três
reproduziu. `@radix-ui/react-select` instalado hoje é `2.3.x` — bem mais novo que o que provavelmente
existia em 2026-09-05 quando o achado foi registrado; a hipótese mais provável é que uma atualização
de dependência já corrigiu isso, mas não encontrei um commit específico de upgrade para confirmar
a data exata. **Não corrigido** porque não há mais nada a corrigir dentro do escopo medido — mantenho
o registro aberto, não fechado, porque só testei um Select (o de unidade organizacional) e não a
varredura completa que T203 ainda descreve como dona deste achado; um Select diferente, ou uma
combinação de interação ainda não tentada, poderia ainda reproduzir.

## F-18 — RESOLVIDO 2026-09-18 (rodada 023, saneamento de findings) — The frontend's hand-written types say "present and null"; the API sends nothing at all

**Found**: 2026-09-06, generating `packages/api-types` from the hand-authored contracts (T205/D-14) and
diffing the result against `apps/web`'s hand-written mirrors. Systemic, not isolated.

The contracts mark a number of fields **optional** — they may be absent from the response body. The
hand-written frontend types mark the same fields **required but nullable** (`T | null`, never `?`).
Verified against the implementation rather than inferred: `risk-query.service.ts`'s mapper emits
`category: toReferenceDataRefOrUndefined(...)` and `inherentScore: row.inherent_score ?? undefined`, and
`JSON.stringify` omits an `undefined` property. So the field genuinely is not in the payload, while
`apps/web/src/features/risks/types.ts` declares `readonly category: ReferenceDataRef | null`.

**The contract is right and the hand-written types are wrong.** Confirmed instances: `RiskSummary`'s
`category`, `responsible`, `inherentScore`, `inherentLevel`, `residualScore`, `residualLevel`,
`lastAssessedOn`, `updatedAt`; `RiskAssessment`'s `controlsConsidered`, `rationale`,
`previousAssessmentId`, `levelChange`; `SessionMetadata`'s `ipAddress`, `userAgent`; `OwnProfile`'s
`jobTitle`, `primaryOrgUnit`, `lastLoginAt`.

**Latent, not live — checked, not assumed.** No code compares these fields to `null`; the call sites use
optional chaining and `??`, which tolerate both. The hazard is what the type system permits: a future
`if (risk.inherentScore !== null)` would typecheck, read `undefined !== null` as true, and treat an
unassessed risk as one carrying a score. The types currently promise a field is always present when it
is not.

**Owner**: whoever adopts `packages/api-types` in `apps/web`. That adoption must settle this first —
otherwise it either forces non-null assertions everywhere or surfaces the mismatch as a wall of errors.
The fix is to correct the hand-written types to optional, not to change the API: emitting `null` for an
absent value would be a contract change, and the contracts are authoritative (D-5, D-14).

**Auditoria campo-a-campo, 2026-09-18** (rodada 023, saneamento de findings — mandato revisado do
usuário: findings abertos precisam chegar a conclusão com prova, não ficar em "decisão pendente").
Comecei a auditoria antes de editar — a mesma disciplina que fechou F-1/F-2/F-29/F-68 como já
corrigidos neste mesmo saneamento — e a lista original do achado **estava errada em mais lugares do
que apenas um campo**, confirmando por que a auditoria tinha de vir antes da edição, não depois.

**`RiskSummary` — 8 campos genuinamente precisavam da correção (1 a mais do que a lista original, 1
a menos)**:

- **`updatedAt` é um desvio confirmado da lista**: listado como precisando virar opcional, mas
  `risk-query.service.ts:508` faz `updatedAt: row.updated_at` — sem `?? undefined`, sempre presente.
  O tipo `updatedAt: string` (obrigatório) já estava correto e **não foi tocado**.
- **`nextReviewOn` faltava na lista original**: `risk-query.service.ts:502` faz
  `nextReviewOn: row.next_review_on ?? undefined` — igual aos outros sete, mas nunca citado no texto
  original do achado. Encontrado só ao ler o mapeador inteiro, não a lista.
- Os sete restantes — `category`, `responsible`, `inherentScore`, `inherentLevel`, `residualScore`,
  `residualLevel`, `lastAssessedOn` — confirmados com `?? undefined`/`toReferenceDataRefOrUndefined`/
  `toUserRefOrUndefined` em `risk-query.service.ts:487-502` e `risk.repository.ts:437-449`.

**`RiskAssessment`, `SessionMetadata`, `OwnProfile` — a lista original estava errada em TODOS os
onze campos que citava; nenhum precisava de correção**:

- `RiskAssessment`: `assessment-response.mapper.ts:74-77` — `controlsConsidered` é sempre um array
  (nunca omitido, mesmo vazio), `rationale`/`previousAssessmentId` são passagem direta sem `??
  undefined` (o valor `null` do banco atravessa como `null` de verdade), `levelChange` é sempre um
  objeto (`toLevelChange` retorna `{previousInherentLevel: null, ...}` mesmo sem avaliação anterior,
  nunca omite a chave). Os quatro tipos atuais já estavam certos.
- `SessionMetadata`/`OwnProfile`: `auth.controller.ts:96-197` — `jobTitle: profile.jobTitle ?? null`,
  `primaryOrgUnit: profile.primaryOrgUnit ?? null`, `lastLoginAt: ... : null`,
  `ipAddress: ... ?? null`, `userAgent: ... ?? null` — todos os cinco caem para `null` explícito,
  nunca para `undefined`/ausência. Os cinco tipos atuais já estavam certos.

**Correção aplicada**: `apps/web/src/features/risks/types.ts`, os oito campos de `RiskSummary`
passaram de `T | null` (obrigatório) para `T?` (opcional, sem `| null` — `exactOptionalPropertyTypes`
deste workspace torna a chave ausente OU o tipo real, nunca `undefined` explícito). Dois pontos de
código de produção ajustados para o novo formato no LOCAL de consumo, não alargando um helper
compartilhado: `risk-overview.tsx` (`formatDate(risk.lastAssessedOn ?? null)`/`(risk.nextReviewOn ??
null)`) e `risk-summary-row.tsx` (`levelTone(risk.inherentLevel ?? null)`/`(risk.residualLevel ??
null)`) — `formatDate`/`levelTone` continuam aceitando `T | null` sem mudança, já que outros
chamadores podem legitimamente ter um `null` de verdade. Doze arquivos de teste tinham fixtures
que fixavam esses oito campos em `null` explicitamente — corrigidos para omitir a chave (o `?:` sem
`undefined` explícito exige omissão, não atribuição), um caso especial em `risk-card.test.tsx`
resolvido por desestruturação em vez de atribuição.

**Prova**: `apps/web` typecheck limpo; `apps/web` unit completo, 221 arquivos/1472 testes, incluindo
os 27 arquivos/197 testes do módulo de Riscos especificamente.

**Por que não foi preciso um quinto tipo tocado**: a auditoria confirmou que só `RiskSummary` tinha
o defeito real — os outros três grupos de tipo já estavam corretos, e editá-los (aplicando a lista
original às cegas) teria introduzido o mesmo defeito ao contrário: um campo hoje corretamente
obrigatório passando a aceitar ausência sem necessidade.

## F-19 — RESOLVIDO (2026-09-11, evidência já registrada no corpo; marcador de cabeçalho adicionado 2026-09-19, rodada 023, Lote C) — `packages/api-types` cannot be resolved except through the TypeScript path alias

**Found**: 2026-09-06, alongside F-18. Pre-existing, not introduced by the regeneration.

`dist/index.d.ts` imports `./generated/auth` and its siblings, but `tsc` never emits those into `dist/`
— declaration files pass through as inputs rather than being emitted. Nothing notices today because
every in-repo consumer resolves the package through `tsconfig.base.json`'s path mapping straight to
`src/`. It would break the moment anything resolves it by ordinary node or bundler resolution.

**Owner**: whoever first consumes the package from outside the workspace path mapping — which is the
same adoption work F-18 blocks.

> **RESOLVED, 2026-09-11** (007-implementation-remediation, Frente B). Measured, not inferred:
> `apps/api/test/unit/api-types-dist-resolution.spec.ts` calls `createRequire(__filename).resolve('@pharos/api-types')`
> — plain Node/CommonJS resolution, no `tsconfig.base.json` path mapping involved — and asserts the
> result matches `dist/index.js`, never `src/`. `packages/api-types/dist/generated/*.d.ts` (ten files,
> one per contract) exist on disk and are real, non-empty declaration files: `tsc -p tsconfig.json`
> does emit them today. Nothing in the package's own `tsconfig.json` changed to make this true — the
> emission always worked once the generator (F-3) actually produced non-empty `src/generated/*.ts` for
> `tsc` to compile; the bootstrap placeholder F-3 also names is what made this look broken. First
> consumer from outside the workspace path mapping is now this very test, in `apps/api`.

**Reconciliação, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do coordenador:
verificar de novo e fechar com evidência, não confiar cegamente na nota de 2026-09-11). Re-verificado
contra o estado atual, não presumido a partir da nota acima: `packages/api-types/package.json` tem
`"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }` e
`"main"`/`"types"` apontando para `dist/` — resolução normal de pacote, não mapeamento de path do
TypeScript. `packages/api-types/dist/generated/` tem os dez arquivos `.d.ts`/`.js` reais, não vazios.
`apps/api/test/unit/api-types-dist-resolution.spec.ts` rodado isoladamente nesta rodada:
**4/4 testes passaram**. O achado está obsoleto — só o cabeçalho nunca recebeu o marcador.

## F-20 — NOTA PERMANENTE, NÃO É DEFEITO (o próprio registro diz "Owner: none... standing caution rather than an open defect" — marcador de cabeçalho adicionado 2026-09-18) — Append-only tables make any fixture that writes to them permanently irreversible

**Found**: 2026-09-06, building the 50,000-risk performance fixture (T200). Learned the hard way, on the
development database.

`risk_treatment_decisions` and `approvals` each carry a `BEFORE UPDATE OR DELETE` trigger that refuses
`DELETE` **unconditionally — for every role, including the owner**, because a trigger fires regardless of
who issues the statement. Combined with `ON DELETE RESTRICT` from those tables to `risks`, any fixture
that writes a treatment decision or an approval can never be removed: the decision blocks deleting the
risk, and the risk in turn blocks deleting the users and organizational units it references. The whole
graph is stuck.

This is the append-only guarantee working exactly as designed — the same property that makes the audit
trail defensible. It is not a defect. But it has a consequence nobody had written down: **a reversible
fixture cannot touch those tables**, and discovering that after the fact means contaminating a database
permanently.

**What it cost here**: an early run against the development database `pharos_grc` left 200 `PERF-` risks
and 132 undeletable treatment decisions. Removing them required temporarily disabling the trigger inside
a transaction — done deliberately by the coordinator, scoped strictly to `PERF-`/`perf-` prefixed rows,
with the 277 real risks and 102 real assessments verified untouched before and after, and the trigger
proven re-armed afterwards by attempting a `DELETE` as the application role and being refused. The
performance fixture was redesigned to write only to `risk_assessments` and `risk_treatment_actions`,
both genuinely reversible.

**The rule this establishes for future task authors**: before writing a fixture or a seed, check whether
any table it touches is append-only. If it is, either do not write to it, or accept that the data is
permanent and say so in the fixture's own documentation. Never test a destructive-reset path for the
first time against a database someone is using.

**Owner**: none — this is recorded as a standing caution rather than an open defect. The trigger stays
as it is.

## F-21 — RESOLVED 2026-09-07 — The dark theme exists and no user can reach it

**Found**: 2026-09-06, auditing contrast in both themes (T203).

`packages/design-system` defines a complete dark palette, every component is theme-aware, and the dark
tokens were measured at AA contrast (17.73:1 light / 16.11:1 dark for the core pairing). But **no
`ThemeProvider` is mounted anywhere in `apps/web`**, and there is no toggle. The audit had to force
`.dark` onto `<html>` to scan it at all.

So the product ships a fully-built, verified dark theme that is unreachable — dead code that looks like
a feature. Either it should be reachable, or the tokens are maintenance nobody is paid for.

**Not fixed**: mounting a theme provider and adding a toggle is a new user-facing feature, not
accessibility remediation, and T203's scope is remediation. Deciding to ship a theme switch is a product
call.

**Owner**: a product decision first, then whoever implements it. If the answer is "not in v1", the
honest follow-up is to say so in `docs/architecture.md` so the next reader does not assume the theme is
live.

**Resolved**: 2026-09-07 — `apps/web/src/components/shell/theme-provider.tsx` is mounted in
`apps/web/src/app/layout.tsx`, and `apps/web/src/components/shell/theme-toggle.tsx` gives the user a
real switch. The theme is reachable.

## F-22 — RESOLVIDO (2026-09-07, superado pelo re-run F-23 — marcador de cabeçalho adicionado 2026-09-18) — SC-011 was tested for the first time and FAILED

**Found**: 2026-09-06, executing T206a — building a real second business module, wiring it through
every extension point, running it against real HTTP and PostgreSQL, then removing it. This is the task
that was supposed to convert SC-011 from intent into evidence, and the evidence is negative.

SC-011: *"a new GRC module can be added without changing the shell, `core/` or Risk Management."*
**It does not hold.** Two extension points required exactly the surgery SC-011 forbids, demonstrated
rather than argued:

1. **Comments and attachments reject a registered entity type at the HTTP boundary.**
   `core/comments/presentation/dto/{create-comment-request,list-comments-query}.dto.ts` and
   `core/files/presentation/dto/{upload-attachment-request,list-attachments-query}.dto.ts` each declare
   `const COMMENTABLE_ENTITY_TYPE_VALUES: readonly CommentableEntityType[] = ['RISK']` and validate
   against that literal. The **registry works perfectly** — a probe record's comment was correctly
   authorized against its own parent, refused for a caller holding full `risk:view` but not
   `probe:view`, and refused for the right permission in the wrong organizational unit. But
   `class-validator` returns 400 before the registry is ever consulted. A module can register
   correctly and still be unusable without editing four `core/` files.

2. **The dashboard's planned areas are a closed union and a literal array inside Risk Management.**
   `PlannedAreaKey = 'PROBLEMS' | 'INCIDENTS' | 'CONTROLS'` and `PLANNED_AREAS` live in
   `modules/risk/application/get-dashboard.usecase.ts`. Contributing a card requires editing Risk
   Management, editing `shared/messages/user-messages.ts`, and breaking a Risk Management contract test
   that asserts the array has exactly three known keys. F-7 recorded that the frontend dashboard had
   this flaw; T197 built the backend and **inherited it**.

**A third result, not a failure but worth more than either**: `registerPermissionDefinitions()` had
**never been called by anything**. Risk Management's `risk:*` identifiers are hardcoded directly in
`core/authorization/domain/permissions.ts`. The probe was its first real caller, and using it
immediately exposed a genuine bug in a shared test fixture that snapshotted the permission list at
import time, before any module constructor had run. That fix was kept, independent of the probe.

**Why this matters beyond a checkbox**: SC-011 is the entire justification for the core/modules split,
the boundary lint and the registries — the argument that module number two costs a fraction of module
number one. Ten further modules are planned. Shipping this criterion as satisfied on inspection, when a
real probe needed core surgery, would have licensed all ten on a promise nobody had tested. This is the
second time this exact claim proved overstated; F-7 was the first.

**Status**: being fixed now, not deferred — see the follow-up commit. T206a stays unticked until a
re-run of the probe passes without touching `core/`, the shell or Risk Management.

**Permanent residue**: `PROBE_RECORD` remains in `AuditEntityType`, `AttachableEntityType` and
`CommentableEntityType`. PostgreSQL has no `ALTER TYPE ... DROP VALUE`; the probe's table and every
other trace were removed and verified.

**Update, 2026-09-07**: the re-run is F-23, below — verdict pass. The "third result" here
(`registerPermissionDefinitions()` never called by anything) did not end in that function getting a
real caller; it ended in the function being retired. `docs/architecture.md`'s Permissions section
now documents the replacement directly: static aggregation (`src/permission-catalogue.ts` plus
`declare module` augmentation) rather than a runtime registry, chosen because the runtime approach
could not work for the seed script's standalone Nest context. `grc/evidence`, `grc/action` and
`grc/finding` all declare their permissions through that static aggregator, not through
`registerPermissionDefinitions()`.

## F-23 — RESOLVIDO (custos #1/#2 fechados 2026-09-07; #3 — catálogo de mensagens por módulo — implementado e fechado 2026-09-19, rodada 023) — SC-011 passed, and a real module still pays three costs the probe did not

**Found**: 2026-09-06, re-running T206a after the F-22 fixes. **The verdict is a pass**: the probe module
exercised every extension point through real HTTP against real PostgreSQL and modified exactly **one**
file outside its own tree — the permitted navigation-registry entry — plus additive migrations. Zero
edits to `core/`, to `modules/risk/`, to the shell beyond that entry, or to any pre-existing test.

But the probe avoided two costs a **permanent** module cannot, and the honest record is what those are.

**1. A closed-count assertion taxed every future module — fixed.** `test/contract/dashboard.spec.ts`
asserted `toHaveLength(3)` on `plannedAreas`. The re-run demonstrated this rather than inferring it: it
temporarily wired the probe into `AppModule`, exactly as a real module would, and the assertion failed
with "expected length 3, got 4". The probe only escaped because Vitest isolates the module graph per
spec file. Now relaxed to "contains the baseline, no duplicates" — a closed-count check turns an
extension point into an edit-this-test-too tax, the same trap F-1 named for the enum-label maps.

**2. Prisma forces a shared-file edit for any relation to a core entity — structural, accepted.** A
module whose records reference `User` or `OrganizationalUnit` must add a reciprocal back-relation field
to those models inside `schema.prisma`; Prisma's validator refuses a one-sided relation. No registry
pattern can fix this — it is a property of a single-file relational schema. It is purely additive and
touches no behaviour, so it is accepted as a cost of the ORM rather than an architectural failure. Worth
knowing before someone is surprised by it.

**3. The pt-BR catalog has no per-module extension mechanism — the real remaining gap.**
`apps/api/src/shared/messages/user-messages.ts` is one shared file, and Risk Management's strings already
sit in a `risk:` block inside it. Permissions, audit allow-lists, the entity registry and now planned
areas all have per-module registration; messages do not. The probe sidestepped this by hardcoding a
validation message inline in its own DTO — **which violates D-8 and CLAUDE.md §11.1**. A real module
cannot make that trade: it must either break the centralization rule or edit the shared file. So SC-011
holds for everything except the one rule this project treats as permanent.

**Owner for #3**: this is the natural next extension point — a per-module message catalog merged the way
the other registries are, so a module contributes its own pt-BR strings from its own tree. Recommended,
not yet scheduled; it is a refactor of a large shared file and deserves its own task rather than being
folded into a review pass.

**Also worth its own task, from the first probe run**: `registerPermissionDefinitions()` still has no
caller in product code — Risk Management's `risk:*` identifiers are hardcoded in
`core/authorization/domain/permissions.ts`. An extension point exercised only by a throwaway probe is
how F-7 and F-22 both happened.

**Update, 2026-09-07 — costs #1 and #2 status unchanged; #3 confirmed real by a permanent module,
not just predicted; the "also worth its own task" note is resolved by replacement.** The "Shared GRC
Foundation" phase is the second real module this project has built, and it landed exactly where this
finding predicted:

- **#3 materialized precisely as forecast.** `grc/evidence`, `grc/action` and `grc/finding` each
  added their own block (`evidence:`, `action:`, `finding:`) directly inside the same shared
  `apps/api/src/shared/messages/user-messages.ts` — the "must... edit the shared file" branch of this
  finding's own prediction, not the D-8 violation the throwaway probe took instead. The gap is
  confirmed, not merely still theoretical; no per-module message-catalog mechanism has been built.
- **The `registerPermissionDefinitions()` note is moot, not fixed.** The function was not given a
  caller — it was retired in favor of static aggregation (see F-22's update, above). A future reader
  should not go looking for a caller that was never going to be added.

**Resolução do custo #3, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do
coordenador: verificar se o catálogo por módulo existe e reconciliar). Existe, dos dois lados, e o
próprio código já cita este achado pelo nome — não é uma correção nova desta rodada, é reconciliação
do cabeçalho.

- **API**: `apps/api/src/shared/messages/user-messages.ts:39-49` documenta a correção explicitamente
  — "F-23 #3 (`docs/deferred-findings.md`): a single 690-line file forced every module ... to edit
  the same catalog as every other module. This file is now composition only: each area owns its own
  strings in its own file ... and is composed into `USER_MESSAGES` below." `find
  apps/api/src/shared/messages -type f` confirma 23 arquivos, um por módulo/capacidade
  (`risk.ts`, `controls.ts`, `compliance.ts`, `incidents.ts`, `problems.ts`, `assets.ts`,
  `processes.ts`, `action.ts`, `findings.ts`, `audit-engagements.ts`, `indicators.ts`,
  `reports.ts`, `evidence.ts`, mais os de núcleo `admin.ts`/`identity.ts`/`organizations.ts`/
  `comments.ts`/`notifications.ts`/`attachment.ts`/`dashboard.ts` e os sem dono único
  `problem-details.ts`/`common.ts`/`validation.ts`), com `user-messages.ts` reduzido a 407 linhas de
  composição, não mais um arquivo monolítico de 690.
- **Web**: `apps/web/src/lib/messages/` já segue o mesmo padrão — um arquivo por módulo
  (`risks.ts`, `incidents.ts`, `problems.ts`, `controls.ts`, `assets.ts`, `processes.ts`,
  `actions.ts`, `compliance.ts`, `audit-engagements.ts`, `findings.ts`, `indicators.ts`,
  `reports.ts`, `evidence.ts`, `admin.ts`, `dashboard.ts`, `shell.ts`, `profile.ts`, `auth.ts`,
  `errors.ts`, `validation.ts`, `common.ts`), composto via `index.ts`, com
  `no-internal-identifiers.test.ts` guardando a higiene do catálogo.

O mecanismo que o "Owner for #3" pedia — "a per-module message catalog merged the way the other
registries are, so a module contributes its own pt-BR strings from its own tree" — existe hoje nos
dois lados da pilha. Nenhuma mudança de código nesta rodada.

## F-24 — RESOLVIDO (2026-09-11, 007-implementation-remediation Frente A — marcador de cabeçalho adicionado 2026-09-18) — "Overdue" is written by hand in four places, and I accepted a claim that it was one

**Found**: 2026-09-06, by the T209 architecture review. Verified independently by the coordinator.

`status NOT IN ('COMPLETED','CANCELLED') AND due_on < today` appears as hand-written SQL in
`dashboard-query.service.ts` **twice** (lines ~242 and ~273) and in `risk-query.service.ts` (~413),
alongside the TypeScript definition in `domain/risk-overdue.ts`'s `isOverdueTreatmentAction`. Four
encodings of one rule.

**This is a live Constitution VI violation**, and the failure mode is concrete: adding a status such as
`DEFERRED` requires finding and editing three SQL copies, and missing one makes the dashboard disagree
with the register about which actions are overdue — the exact class of disagreement the register/
dashboard agreement test was written to prevent, arriving through a door that test does not watch.

**How it got here, which matters more than the defect**: the US5 brief required one shared definition,
the agent delivered one TypeScript function and one SQL fragment, and I accepted it. That was true at
the time. T197 then added two more copies, and I verified T197's *numbers* without re-checking this
*property*. A rule enforced by review rather than by construction decays the moment the reviewer stops
looking — which is the argument for extracting a shared SQL fragment rather than adding a comment.

**Owner**: the next task touching either query service. The fix is small: one exported `Prisma.Sql`
fragment built next to `isOverdueTreatmentAction`, imported by both services, with a test asserting the
two agree on a boundary case.

> **RESOLVED, 2026-09-11** (007-implementation-remediation, Frente A, D-7 — cited by
> `docs/architecture/grc-roadmap.md`'s own Fase-5 addendum). The exported fragment landed as
> `OVERDUE_ELIGIBLE_ACTION_STATUSES` in `apps/api/src/grc/shared/domain/overdue.service.ts` (the one
> shared kernel file `Action` was built around, T011/002-shared-grc-foundation), with
> `overdueEligibleActionStatusSqlList()` generating the SQL text from that same array on every call.
> `dashboard-query.service.ts`'s `getOverdueActions`/`getTreatmentActionsSummary` and
> `risk-query.service.ts`'s overdue predicate all call it now — zero hand-written `IN ('OPEN',
> 'IN_PROGRESS')` literals remain in either file, each one's own comment says so and names this
> finding. `apps/api/test/integration/overdue-eligible-status-consolidation.spec.ts` is the test this
> finding asked for, proving the call sites agree on a boundary case. `modules/risk/domain/risk-overdue.ts`'s
> own `isOverdueTreatmentAction` — the fourth of the original four copies — was deleted outright
> (callers now import `isActionOverdue` from the shared file instead); only `isOverdueReview`, a
> genuinely different rule, remains in that file.

## F-25 — RESOLVIDO (data desconhecida, confirmado 2026-09-18 no saneamento 023) — The boundary lint is blind to exactly the file a new module gets wrong first

**Found**: 2026-09-06, T209 architecture review, verified by running `eslint --stdin` probes twice.

`eslint-plugin-boundaries` classifies elements by path — `src/{core,modules}/<name>/{domain,application,infrastructure,presentation}/**`. A NestJS **composition root** matches none of those: `app.module.ts`, `main.ts`, and each module's own `<name>.module.ts` sit outside every classified layer, so the rules never fire there. The probe confirmed it: the rule triggers correctly inside a classified layer and stays silent for a composition-root file.

**Why this is the worst possible blind spot**: a module's `*.module.ts` is precisely where cross-boundary wiring appears first — importing another module's provider, reaching into `core/` internals, registering something it should not. `docs/architecture.md` presents the lint as the safety net that makes ADR-011 enforced rather than conventional. For the one file where a second module is most likely to err, it is not.

**Owner**: T206a's successor, or whoever builds module number two. Extending the config to classify composition roots and constrain their imports is the fix; until then, `*.module.ts` files need human review on any cross-module change.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings): `apps/api/
eslint.config.mjs` já implementa exatamente a correção descrita, citando F-25 e `research.md D-10`
diretamente no próprio comentário de cabeçalho. Uma categoria de ARQUIVO `composition` (`boundaries/
files`, não `boundaries/elements` — o comentário explica por que elementos não funcionam para
arquivos individuais) classifica `app.module.ts`, `main.ts`, todo `*.module.ts` e os poucos arquivos
irmãos na mesma profundidade; `boundaries/no-unknown-files` está ativo e as políticas de
`boundaries/dependencies` já referenciam `categories: 'composition'` tanto como origem quanto como
destino permitido. `pnpm lint` (rodado nesta mesma sessão, workspace inteiro) passa limpo — nenhuma
ação necessária.

## F-26 — RESOLVIDO (já corrigido em `ed0753c`, 2026-09-11; reconciliado 2026-09-19, rodada 023, Lote B) — Attachment deduplication is a cross-scope existence oracle

**Found**: 2026-09-06, T208 security review. **Medium.** Reasoned from the code path; not measured.

`LocalDiskStorageProvider` keys blobs by SHA-256 of their content, globally, with no per-organization
partition. An upload whose bytes already exist anywhere in the platform short-circuits instead of
writing. So an authenticated caller who possesses a candidate file can learn whether that **exact
content already exists somewhere they cannot see** — a different organizational unit, another tenant's
evidence — by observing the response time. Content-addressed storage is otherwise a good choice; the
leak is that deduplication crosses a boundary the rest of the platform enforces strictly.

The review states plainly that it argued this from the code path and did **not** measure the timing
difference. Confirming it needs a multipart harness at realistic file sizes.

**Owner**: measure it first — if the difference is not observable in practice the priority drops sharply.
If it is, the fix is to partition the storage key by organizational scope, accepting the loss of
cross-scope deduplication, which is a price this product should be willing to pay.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote B, decisão do coordenador:
corrigir tornando o dedup consciente de escopo; investigar o mecanismo antes de mexer). Investigação
prévia confirmou: já corrigido, exatamente pelo caminho que o "Owner" original pedia, incluindo a
etapa de medição primeiro, em `ed0753c` (2026-09-11, mesma sessão que fechou F-12/F-13).

- **Medição feita antes da correção, como o achado original exigia**: `specs/007-implementation-
  remediation/research.md` D-12/D-R20 registra a medição em dois níveis — no provedor (250
  iterações por ramo/tamanho: os ramos "conteúdo novo" e "já armazenado" não se sobrepõem em nenhum
  tamanho testado, diferença mínima +0,38ms a 64 KiB) e sobre HTTP real, do ponto de vista de um
  atacante (20 pares por tamanho): a 8 MiB a diferença já é praticamente explorável (~N=5 para um
  desvio padrão, dezenas de pares, minutos, dentro do limite de taxa da própria plataforma) — perto
  do teto de 25 MiB, exatamente onde evidência de GRC vive. A premissa do achado foi confirmada, não
  presumida.
- **O mecanismo, investigado antes de qualquer mudança**: é hash de conteúdo (SHA-256), na camada de
  armazenamento (`LocalDiskStorageProvider`, `apps/api/src/core/files/infrastructure/
  local-disk-storage-provider.ts`) — exatamente as duas perguntas que a instrução desta rodada
  pedia para responder primeiro.
- **A correção é exatamente "o dedup só considerar o que o chamador já poderia enxergar"**: a chave
  de armazenamento passou a ser particionada pela unidade organizacional que `UploadService.execute`
  já resolve no servidor (`parentAccess.organizationalUnitId` — nenhuma resolução nova, nenhuma
  fronteira de confiança nova) — `org/<orgUnitId>/sha256/<checksum>` em vez de `sha256/<checksum>`
  global; `unscoped/sha256/<checksum>` para tipo de entidade-pai sem escopo próprio, seu próprio
  balde explícito, nunca compartilhado com outro ator (`local-disk-storage-provider.ts:142-158`).
  Conteúdo idêntico entre unidades diferentes volta a ser escrito duas vezes, deliberadamente — o
  preço aceito em research.md D-12. `Attachment.checksumSha256` não mudou (é fato sobre os bytes,
  nunca sobre a chave); chaves `sha256/...` históricas continuam resolvendo sem reescrita.
- **Residual nomeado, não escondido, e coerente com o modelo de escopo do produto**: o próprio código
  (linhas 50-58) e o `research.md` documentam que a correção fecha o oráculo ENTRE unidades, não
  DENTRO da mesma unidade — alcançar o ponto de medição já exige acesso de leitura a alguma entidade
  do tipo declarado naquela unidade, e esta plataforma escopa visibilidade por unidade organizacional
  em todo lugar, não por registro individual. O residual não atravessa uma fronteira que o resto do
  produto já não imponha — coerente com a razão que a instrução desta rodada deu para a escolha desta
  solução em vez de tempo constante ou desligar o dedup.
- **Teste que prova exatamente o critério de aceitação declarado**: `apps/api/test/contract/
  attachment-storage-partition.spec.ts` — duas uploads de conteúdo idêntico sob duas unidades
  organizacionais diferentes produzem dois objetos armazenados distintos, com `checksumSha256`
  idêntico nos dois. Contra o código anterior à correção, este teste falha (confirmado pelo próprio
  commit, não presumido).

**Verificação ao vivo, 2026-09-19**: `attachment-storage-partition.spec.ts` isolado — **1/1 teste
passou** (20.42s), contra banco real.

Nenhuma mudança de código nesta rodada — a medição, a correção e o teste já existiam desde
2026-09-11. Só o cabeçalho deste registro nunca foi atualizado.

## F-27 — RESOLVIDO 2026-09-18 (rodada 023, saneamento de findings) — A comment claims a verification that does not exist

**Found**: 2026-09-06, T209 architecture review, verified by the coordinator.

`apps/api/src/modules/risk/domain/methodology.schema.ts` states that its `RiskLevelValue` /
`RiskLevel` string-identity property is "verified in this file's own test". There is no test file for
`methodology.schema.ts`. `test/unit/risk-scoring.spec.ts` imports the type and uses it, but asserts
nothing about that identity.

Trivial in isolation. Recorded because it is the signature failure of this codebase in miniature — a
claim of verification with nothing behind it — and because the next reader has no way to tell it apart
from the many comments here that *are* backed by a test they name. Either write the parity test or drop
the sentence.

**Owner**: the next task touching `methodology.schema.ts`.

**Resolução**: escrita a prova que faltava, não apagada a frase —
`apps/api/test/unit/methodology-schema-risk-level-parity.spec.ts` (2 testes), introspectando
`Prisma.dmmf.datamodel.enums` (mesmo padrão de `action-model-convergence-guard.spec.ts`, sem conexão
com banco) para confirmar que `RISK_LEVEL_VALUES` é idêntico, na mesma ordem, ao enum `RiskLevel` de
`schema.prisma`. O comentário de `methodology.schema.ts` agora nomeia o arquivo de teste real em vez
de "this file's own test". `apps/api` unit: 71 arquivos/663 testes verdes, incluindo o novo.

## F-28 — RESOLVIDO (T198, confirmado 2026-09-18 no levantamento definitivo) — The dashboard charts have a real accessibility violation, and I committed them claiming zero

**Found**: 2026-09-06, T207's full E2E run. Reproduced identically on Chromium, Firefox and WebKit.

Each chart wraps Recharts in `<div aria-hidden="true">`, and Recharts renders its `<svg>` with
`role="application"` and `tabindex="0"`. A focusable element inside an `aria-hidden` container is the
`aria-hidden-focus` rule: a keyboard user can tab into something a screen reader is told does not
exist.

**Why the earlier scan missed it, which is the part worth keeping**: T198's accessibility check waited
for the chart card and asserted its visually-hidden data table was in the DOM, then scanned. The table
renders before the SVG does. So axe measured a dashboard whose charts had not yet rendered and
truthfully reported zero violations of a thing it had not seen. I accepted "0 violations across 22
scenarios" and committed it. The number was real; the scope behind it was not — the same distinction
D-11 records for test counts, arriving in a different costume.

**The fix is not just the markup**: the accessibility spec must wait for the rendered `<svg>`, not a
sibling that appears first, or it will keep certifying charts it never looked at.

**Owner**: being fixed now.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings — levantamento
definitivo): ambas as metades da correção estão no código. `risk-level-chart.tsx`'s próprio
comentário cita F-28 diretamente: `accessibilityLayer={false}` impede o Recharts de construir sua
própria camada de acessibilidade concorrente (`role="application"`/`tabIndex={0}` no `<svg>`) em vez
de tentar remover esses atributos depois. `e2e/accessibility.spec.ts` (varredura de "Histórico" do
indicador) espera explicitamente por `svg.recharts-surface` — não só o rótulo da aba, não só a
tabela acessível — com um comentário citando "F-28's exact chart shape" e explicando por que esperar
apenas a tabela (que monta antes do SVG) mediria um gráfico que ainda não renderizou. Nenhuma ação
necessária.

## F-29 — RESOLVIDO (data desconhecida, confirmado 2026-09-18 no saneamento 023) — `admin-access.spec.ts` fails deterministically as the dev directory grows

**Found**: 2026-09-06, T207. Reproduced at one worker, zero concurrency — so not the F-16 race.

The spec creates a user and then locates it with `getByText(email)`. The users list is sorted
alphabetically by name and paginated, so as the development database accumulates users the new row is
pushed off page one and the locator finds nothing. The test passes on a small database and fails on a
realistic one — the worst failure profile, because it looks like flakiness and is actually a
correctness assumption about data volume.

**Owner**: the next task touching `apps/web/e2e/`. Search or filter for the created user rather than
assuming it lands on the first page.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings): a correção
prescrita já está no arquivo. `apps/web/e2e/admin-access.spec.ts` (linhas ~222-235) usa a busca do
próprio registro (`page.getByLabel('Buscar usuários').fill(email)`) para restringir a lista antes de
`getByText(email)`, com um comentário citando F-29 explicitamente e explicando a mesma razão deste
achado. Não localizei o commit exato, mas o mecanismo prescrito está implementado e corresponde ao
pedido — nenhuma ação necessária.

## F-30 — RESOLVIDO (data desconhecida, confirmado 2026-09-18 no levantamento definitivo) — The dashboard link fails AA contrast in dark mode, on a theme no user can reach

**Found**: 2026-09-06, closing F-28. Confirmed pre-existing by stashing every local change and
reproducing against untouched `HEAD`.

`DashboardMetricCard`'s "Ver registro de riscos" link measures **3.37:1** against the dark card, below
the 4.5:1 AA threshold. The cause is visible in one glance at `packages/design-system/src/styles/globals.css`:
`--primary` is `oklch(54.6% 0.245 262.881)` in **both** themes, while `--card` goes from white to
`oklch(21%)`. A blue chosen to sit on white is used unchanged on near-black.

**The fix is not the obvious one.** `--primary` is also the *background* of primary buttons, with white
`--primary-foreground` on top. Lightening it for dark mode fixes the link and breaks the button. What
this needs is a separate token for "primary used as text on a surface", applied at the call sites that
use it that way — a design-system change with browser verification, not a value tweak.

**Why it is recorded rather than fixed before handover**: **F-21** — no `ThemeProvider` is mounted
anywhere in `apps/web` and there is no toggle, so **no real user can reach the dark theme at all**. The
audit only saw this by forcing `.dark` onto `<html>`. The defect is genuine and will matter the moment a
theme switch ships; today it affects nobody. Fixing it now would mean a design-system token change,
unverifiable through the product, to remedy a screen no one can open.

**Owner**: whoever implements the theme switch (F-21) — the two are the same piece of work, and shipping
the switch without this would put a failing contrast ratio in front of a real user for the first time.

**One operational note it also surfaced**: `accessibility.spec.ts` runs `mode: 'serial'`, so this single
failure aborts every later test in the file. That masks results rather than reporting them — worth
revisiting when the spec next gets attention.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings — levantamento
definitivo, e agora relevante de verdade: F-21 — o tema escuro — está resolvido, então esta tela é
alcançável por um usuário real). Exatamente a correção "não óbvia" que este achado já previa:
`packages/design-system/src/styles/globals.css` agora declara `--primary-on-surface` como um token
separado de `--primary` (o comentário do arquivo nomeia os dois papéis: "background" vs. "texto/
ícone/anel sobre uma superfície"). No tema escuro, `--primary-on-surface: #6ca6e0` mede 5,79:1 contra
o cartão — acima do limiar AA de 4,5:1 que este achado mediu falhando em 3,37:1. Os componentes que
antes usavam `text-primary` para o link ("Ver registro de riscos", hoje em
`dashboard-stat-card.tsx`/`dashboard-module-card.tsx` depois da fase 011 de Dashboard) usam
`text-primary-on-surface`. Nenhuma ação necessária.

## F-31 — RESOLVED 2026-09-06 — Two contracted endpoints were never implemented, and nothing could have noticed

**Found**: 2026-09-06, by the product owner during acceptance testing — not by any gate.

`PUT /risks/{riskId}/causes` and `PUT /risks/{riskId}/consequences` are defined in
`contracts/risks.openapi.yaml`, and `apps/web/src/features/risks/api.ts` calls both. **Neither exists in
the API.** The causes-and-consequences editor is mounted, renders, and cannot save — a whole feature is
dead on arrival, and the owner found it in the first minutes of using the product.

A mechanical comparison of all four contract files against the registered routes gives **78 contracted,
76 implemented** — exactly these two. So the defect is not systemic. **The blindness is.**

**Why every gate missed it**, which is the finding worth keeping:

- **D-11** requires a contract test for every endpoint — but it is written from the implementation
  outward. An endpoint that was never built has no route to test, so no test is missing.
- **T202's** information-disclosure sweep asserts it covers every operation in `apps/api/openapi.json` —
  a document generated by reflecting the decorators that exist. It proves the sweep is exhaustive over
  what is implemented, which is precisely the wrong direction for this failure.
- **`openapi:check`** compares the generated document to itself. It cannot see the hand-authored
  contracts at all (F-3).
- The frontend calls the routes, so a **404 at runtime** was the only signal — and no E2E covered
  causes and consequences.

Every check pointed outward from the code. Nothing pointed inward from the contract.

**The fix is one test**: enumerate the operations in `specs/001-grc-platform-foundation/contracts/*.openapi.yaml`
and assert each is registered. That is the mirror image of the sweep T202 already has, and it belongs
next to it.

**Being fixed now**, along with the two endpoints themselves.

**Resolved**: 2026-09-06 — `PUT :riskId/causes` and `PUT :riskId/consequences` both exist in
`apps/api/src/modules/risk/presentation/risk.controller.ts`, alongside the contract-coverage test
described above.

## F-32 — RESOLVIDO (2026-09-14) — Seeded role descriptions are developer notes, in English, on an administration screen

**Found**: 2026-09-06, inspecting the rendered Administration screens during the UI phase. No gate could
have caught it: the strings are not in the frontend at all.

`apps/api/prisma/seed/platform.seed.ts` seeds each role with a `description`, stored in the database and
rendered verbatim to administrators. They are written for developers and they cite internal documents:

> "Read access to risks plus the audit trail, across the whole organization — data-model.md §3:
> 'Auditor (read plus audit:view, global scope)'."
> "Captures and assesses risks within their organizational scope, and may REQUEST an approval-gated
> lifecycle transition (risk:transition — ADR-006). Deliberately excludes risk:approve (see Risk
> Approver) so the same person cannot both request and decide an approval-gated transition (FR-029a)…"

Three problems in one string, in descending order of seriousness:

1. **They cite internal specification artifacts** — `data-model.md §3`, `ADR-006`, `FR-029a` — on a
   screen a customer's administrator reads. That is internal structure leaking into the product.
2. **They are in English**, on a permanently pt-BR interface (Constitution X, D-8, §18.7).
3. **They explain the design's reasoning rather than the role's effect.** An administrator choosing a
   role needs to know what it lets someone do, not why the architect separated two permissions.

**Note the boundary D-8 already drew**: seeded role *names* ("Risk Analyst", "Platform Administrator")
are technical identifiers and stay English by prior decision. Descriptions are prose shown to a user and
are not covered by that exception.

**Not fixed inside the UI wave, deliberately.** These live in seeded data, so correcting them changes the
seed and the rows an existing database already holds — a data change, not a restyle. §18.9 is explicit
that a visual improvement which appears to require a functional change stops being cosmetic; doing it
quietly inside a UI pass is exactly what that rule forbids.

**Owner**: a small, separate change — rewrite each description as one plain pt-BR sentence saying what
the role permits, drop every internal citation, and confirm the seed updates existing rows rather than
only inserting new ones.

### Resolução — 2026-09-14

**Corrigido.** As **12** descrições de papel semeado em `apps/api/prisma/seed/platform.seed.ts` foram
reescritas como prosa de produto em pt-BR. As 7 que a medição da fase 015 marcou
(`specs/015-roles-permissions-surface/STATE.md` §9) perderam toda referência a artefato de
especificação e todo identificador de permissão cru; as outras 5, já limpas, foram encurtadas para o
mesmo teto. O conjunto de permissões de **nenhum** papel mudou, e `Role.name` de nenhum papel mudou —
a correção é exclusivamente de texto.

**Comprimento, antes → depois** (caracteres, medidos no banco): Problem Manager 599 → 197;
Risk Analyst 528 → 164; Incident Manager 492 → 185; Risk Approver 456 → 174; Control Owner 407 → 172;
Compliance Manager 356 → 143; Control Approver 327 → 151; Platform Administrator 324 → 154;
Auditor 272 → 184; Risk Manager 230 → 167; Audit Lead 215 → 191; Read Only 213 → 164. Teto adotado:
**200**, que é o que cabe nas duas linhas `line-clamp-2` do cartão da tela "Papéis e permissões".

**O conhecimento não foi perdido.** Todo o racional que estava na string persistida — por que
`risk:approve` é deliberadamente excluída do Risk Analyst, por que Control Owner nunca atesta a
própria verificação (C1/C2), por que Incident Manager cobre o ciclo inteiro e Problem Manager tem a
segregação aplicada por usuário no domínio, por que Compliance Manager não tem segregação alguma —
foi **movido para comentário de código** ao lado de cada definição, marcado `F-32`. CLAUDE.md §11.1
permite comentário de código em qualquer idioma; o que ela proíbe é isso na interface.

**A armadilha que não era uma**: F-60 registra que o seed nunca reposiciona um **usuário** já
existente (`user.upsert` com `update: {}`). Verificado antes de escrever qualquer texto:
`upsertSystemRoles` **já** incluía `description` no `update` do upsert de papel, então a reescrita
alcançou o banco existente sem nenhuma mudança de mecanismo. Confirmado por consulta direta ao banco
de desenvolvimento, antes e depois de `npm run db:seed` — as 12 linhas passaram das strings antigas
(as de 599/528 caracteres) para as novas, sem recriar o banco.

**Guarda**: `apps/api/test/unit/seeded-role-description-content.spec.ts` (38 testes). Falha se alguma
descrição semeada voltar a citar artefato de especificação (`*.md`, `FR-nnn`, `D-nn`, `ADR-nnn`,
`Tnnn`, `USn`, `§`, `invariante P3`, `C1/C2`, nome de diretório de spec), trouxer identificador de
permissão cru (verificado contra o catálogo **real**, `getAllPermissionDefinitions()`, nunca uma
lista copiada à mão), passar de 200 caracteres, ou perder a distinção "quem executa × quem decide"
entre Risk Analyst/Risk Approver e Control Owner/Control Approver. Não-vacuidade provada de duas
formas: (1) os detectores rodam contra as **7 strings pré-correção reais**, citadas desta entrada, e
cada uma precisa ser pega; (2) reintroduzindo, uma de cada vez, `research.md D-13` em Compliance
Manager, `control:approve` em Control Approver e 46 caracteres a mais no limite — cada injeção
derrubou exatamente o cenário correspondente, e nenhuma outra.

**Fora desta correção, e ABERTO**: as 70 descrições de **permissão**, que continuam em inglês. Ver
F-63 abaixo.

## F-33 — RESOLVED 2026-09-07 — CI never runs the browser suite, and the accessibility suite skips itself in silence

**Found**: 2026-09-06, closing the UI/UX phase. Two defects in the same family: a gate that reports
success without testing what it claims to.

**CI has no end-to-end job at all.** `.github/workflows/ci.yml` defines ten jobs — install, lint,
format, typecheck, unit, audit, build, openapi, integration, contract — and **zero** mentions of
Playwright or e2e. All eleven E2E specs, including `accessibility.spec.ts` and its twenty-two WCAG
scenarios, run only when a person runs them by hand.

So every accessibility guarantee this phase established — the dialog focus restoration, the chart fix
after F-28, the contrast work, the keyboard-focus states — is unprotected. A regression reaches `main`
undetected. It also explains why F-16's shared-account race hurt so much locally and never once appeared
in CI: CI never ran the specs that race.

**And the accessibility suite skips itself when unconfigured.** Its authenticated describe block carries
`test.skip(!seedEmail || !seedPassword, ...)`. Run without `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` and
it reports **"3 passed, 19 skipped"** — a green exit code covering 14% of the suite. The coordinator hit
exactly this while verifying the phase and nearly recorded the result as a pass.

A conditional skip is reasonable for a developer without a seeded backend. It is not reasonable in CI,
where an unset variable would silently retire the suite. If those specs run in CI, the absence of the
credentials must **fail**, not skip.

**Why this is the same mistake this project keeps making**: `openapi:check` describes routes and not
fields (F-3); the sweep proved coverage of implemented endpoints and could not see a contracted one that
was never built (F-31); axe certified charts that had not rendered (F-28). Each looked like protection
and was not. This one is the largest of them, because it is the gate the whole UI policy in CLAUDE.md
§18 depends on.

**Owner**: an E2E job in CI. The compose stack exists and works, so the ingredients are there — Postgres,
Redis, migrations, seed, the API, the web app, and Playwright's browsers. Non-trivial but bounded, and
until it exists §18.1's promise that UI work is "rendered, inspected and verified" holds only for
whoever remembers to run it.

**Resolved**: 2026-09-07 — `.github/workflows/ci.yml` now has a `test-e2e` Chromium job on every push,
plus a `test-e2e-cross-browser` job on `workflow_dispatch`; the credential skip now throws in CI via
`requireSeedCredentials` in `apps/web/e2e/support/admin-session.ts` instead of skipping silently. A
real CI run passed 34/34, with `accessibility.spec.ts` executing (not skipping) for 5.2 minutes.

## F-34 — RESOLVED 2026-09-08 — The scoped owner picker was empty, not slow: three layers disagreed about who may be assigned

**Found**: 2026-09-06, when `admin-access.spec.ts` began failing on a combobox that had worked for days.

**Root cause corrected 2026-09-08.** The original diagnosis below was wrong, and it is left in place
rather than deleted because the way it was wrong is the more useful record.

### What was originally concluded (and why it was wrong)

The finding attributed the failure to directory **size**:

> The "Gestor do risco" combobox on `/risks/new` must render the whole directory, and it now times out
> under Playwright. So a test-hygiene gap has become an application performance problem.

That reading was reached from a true observation — 37 of 44 users really were orphaned E2E fixtures — and
a plausible mechanism was fitted to it. Nobody then asked the combobox what it actually received.

It received **nothing**. The directory the failing caller saw was not large; it was **empty**.

The clue that should have broken the size theory was available the whole time: the same combobox, on the
same database, worked for the administrator. A directory too large to render would have failed for
everyone. It failed only for the scoped user, which is a filtering symptom, not a volume one.

### The actual defect

Three layers held three different answers to "who may own a risk", and no layer owned the question:

| Layer | Rule it applied |
|---|---|
| `GET /users` (`prisma-user-directory.repository.ts`) | `primaryOrgUnitId IN caller's scope` — a **browse** rule |
| `RiskForm` | whatever that listing returned |
| `CreateRiskUseCase` | `assertUserActive(ownerUserId)` — **any** active user |

Organizational scope expands to descendants and never to ancestors (FR-025b). So a user scoped to a leaf
unit saw only users whose PRIMARY unit was that same leaf or below. Measured on the development database
on 2026-09-08: for `DIV-A-TEAM-1`, **zero** active users qualified. Their own manager, one level up, was
invisible by construction — and so were the **25 active users carrying no `primaryOrgUnitId` at all**,
because `IN (...)` never matches NULL in SQL.

`ownerUserId` is `required` in the contract. So the form was unfillable, and risk creation was impossible
from the UI for exactly the narrowly-scoped analyst the Risk Analyst role exists to serve — while the API
would have happily accepted the very assignment the interface refused to offer. The UI had invented a
rule stricter than the domain's, and enforced it by omission.

It also failed **silently**: `risk-register-filters.tsx` deliberately swallowed reference-data errors and
degraded to empty option lists, so "nobody is assignable", "you lack permission" and "the request broke"
all rendered as the same blank dropdown.

### Why the original fix could never have worked

A teardown was built against the size theory — deactivate the user the spec creates, so the directory
stops growing. It is a good hygiene change and it stays. But it could not have fixed this failure, because
shrinking a directory does not repopulate one that is empty for scope reasons. Effort was spent on the
wrong cause, and the test stayed red.

This is the project's recurring class again, in its purest form: **a conclusion written down and never
re-executed against reality**. The entry was even careful about its own arithmetic (see the note on
re-measured counts below) — precision about the wrong quantity.

### The fix

One authoritative rule, in one place, consumed by both sides:

- `core/organizations/domain/assignment-line.ts` — the **assignment line** of unit U is U, its ancestors
  and its descendants. Siblings excluded: upward to a manager, downward to a sub-team, never sideways.
- `core/organizations/application/assignment-line.service.ts` — resolves it, and guards that a caller may
  only ask about a unit already within their own scope (so the ancestor walk cannot become a
  general-purpose people search).
- `GET /users?assignableForOrgUnitId=<U>` returns that set, **plus active users with no primary unit** —
  a user recorded against no unit is not confined to one, so they are assignable anywhere.
- `CreateRiskUseCase`/`UpdateRiskUseCase` enforce the same rule on write, including when an update moves
  a risk to a unit where the current owner would no longer be assignable.
- `RiskForm` requests the assignment listing for the unit selected in the form, and reports a failed load
  as a failure instead of as an empty list.

The browse rule survives unchanged where browsing is what is meant — the register's owner *filter* still
uses the caller's own scope.

### The original volume observation, which remains true and unresolved

37 of 44 users were orphaned E2E fixtures (re-measured 2026-09-08: 53 users, 40 E2E-related, 27 matching
`e2e-scoped`). Only 13 of the original 37 were ever deletable — the rest are referenced by risks or by
`audit_event` rows, and the audit trail is append-only by design (**F-20**), so those references are
permanent. That is untidy but is no longer known to break anything, and it is not why the combobox failed.

(The counts in the original entry were re-measured against the database before it was committed: 44 users,
37 orphans, 24 referenced, 13 deletable. An earlier draft said 10 and 15 — figures that did not sum to 37.
A findings log whose arithmetic does not hold is worth less than no log. The lesson this entry adds is
that arithmetic discipline is not the same as causal discipline: these numbers were right and the
conclusion drawn from them was not.)

## F-35 — RESOLVED 2026-09-07 — The web image drops the brand assets, on reasoning that was true when it was written

**Found**: 2026-09-07, while correcting stale architecture documentation during the Probo benchmark.

`docker/web.Dockerfile` deliberately does **not** copy `apps/web/public/`, and says why in a comment:

> `apps/web/public/` does not exist in this project (F-6: no favicon, image or other static asset is
> referenced anywhere in `apps/web/src`)

That was accurate when written. It stopped being accurate during the Phase 2 UI work, which created
four brand assets — `favicon.svg`, `pharos-mark.svg`, `pharos-logo.svg`, `pharos-logo-inverse.svg` —
now referenced from `app/layout.tsx` (favicon), `app/(public)/login/page.tsx` and
`components/shell/sidebar.tsx`.

So a containerized deploy would serve the login screen and the application shell with a broken brand
mark, and no favicon. Local development is unaffected, which is exactly why nobody noticed: the native
toolchain serves `public/` directly.

**The interesting part is the failure mode, not the fix.** The comment was not wrong; it went stale. It
recorded a *reason* ("no static asset is referenced") rather than a *condition to re-check*, and the
reason silently expired when a later phase added the assets. A commented-out `COPY` line guarded by
prose is invisible to every gate in this project — no test, no lint, no build, no `openapi:check` can
see it, because the image builds perfectly and the assets are simply absent at runtime.

This is the same class recorded seven times already: something that looked settled because it was
written down, and was never re-executed against reality. It is also self-inflicted — the phase that
added the brand assets is the phase that should have revisited the file whose comment reasoned about
their absence.

**Not fixed here.** The architecture/benchmark phase that found it is documentation-only by its own
terms and must not change code, contracts or infrastructure.

**Owner**: the next task touching `docker/` or the deployment path. The fix is small — restore the
`COPY --from=build --chown=pharos:pharos /workspace/apps/web/public ./apps/web/public` line the comment
already spells out, and delete the stale reasoning — but it should land with a check that actually
exercises the built image serving `/brand/pharos-mark.svg`, or it will go stale again the next time the
premise changes.

**Resolved**: 2026-09-07 — `docker/web.Dockerfile`'s runtime stage now runs
`COPY --from=build --chown=pharos:pharos /workspace/apps/web/public ./apps/web/public`. The comment
above it no longer states a reason that can silently expire; it states a condition to re-check
(`git ls-files apps/web/public`) before ever removing the line again. Verified past "it builds": built
the unmodified (stale) Dockerfile first and confirmed `/brand/pharos-mark.svg` and `/brand/favicon.svg`
(the exact path `app/layout.tsx` requests) both returned Next.js's HTML 404 page from a running
container; rebuilt with the fix and confirmed both now return `HTTP 200`, `Content-Type: image/svg+xml`,
with real SVG bytes (`<svg xmlns=...>`) — same for `pharos-logo.svg` and `pharos-logo-inverse.svg`. No
other file carried the same stale premise: `docker/api.Dockerfile` never mentions `public/` or F-6,
`.dockerignore` does not exclude `apps/web/public`, and CI (`.github/workflows/ci.yml`) does not build
either Docker image so had nothing to go stale. `docs/local-environment.md`'s D-1 entry is a dated
verification record of what was true on 2026-09-05, not a live assertion, and is out of this task's
touched-files scope — left as-is.

## F-36 — RESOLVIDO (janela fechada em `e693480`, 2026-09-11, antes da Fase de Incidentes começar; reconciliado 2026-09-19, rodada 023, Lote C) — The Action coexistence window: risk treatment can push the shared Action into states its own API would reject

**Found**: 2026-09-07, Phase 6 (Polish) closeout of the "Shared GRC Foundation" feature (T084),
while documenting `grc/`'s extension points for `docs/architecture.md`.

**Where**: `apps/api/src/grc/action/application/mirror-action-status-from-origin.usecase.ts`, called
from `apps/api/src/modules/risk/application/treatment-actions/update-treatment-action.usecase.ts`
whenever a `RiskTreatmentAction` with a linked `Action` (`actionId`) changes status.

**What it is, in the implementer's own words (already in the code, not hidden)**:
`MirrorActionStatusFromOriginUseCase`'s header states plainly that it performs an "UNCHECKED mirror
write" and does not call `TransitionActionUseCase` — `Action`'s own `transitionAction` endpoint,
which enforces `action.entity.ts`'s legality table (`assertLegalActionTransition`) and Invariant A2
(a non-empty `reason` to reopen a completed action). `UpdateRiskTreatmentActionRequest`
(`contracts/risks.openapi.yaml`) has neither of those gates — it never has, since before this
feature existed — so a caller may set `TreatmentActionStatus` to any value in one `PATCH`, with no
`reason` field at all.

**The concrete cost**: for the duration of this coexistence window, a `RiskTreatmentAction`'s
mirrored `Action` can reach a state — e.g. reopened from `COMPLETED` with no reason supplied by the
caller (the mirror stamps a fixed, honest, attributable `reopenReason` itself, so the row is never
silently inconsistent, but the caller supplied none) — that `POST /actions/{id}/transitions` would
have rejected outright as a direct request. Two paths to the same table, one gated, one not, for as
long as `RiskTreatmentAction` exists alongside `Action`.

**Why this was accepted, not fixed, in this phase**: this is exactly the cost R-003 named and
accepted in advance — forcing the legacy risk route through `Action`'s own transition gate would be
a real behavior change for the risk module (FR-018's own "mesmas telas, mesmas rotas, mesmas
respostas" guarantee), which this phase is not authorized to make. The alternative — leaving the two
representations to drift independently — was rejected earlier in the design; that is what the
mirror write exists to prevent.

**The milestone that closes it, restated so it is not lost**: `tasks.md`'s own "Implementation
Strategy" section already names this precisely: the fase that retires `RiskTreatmentAction` and
points the risk module's own routes at `Action` directly must precede the Incidents phase; if
Incidents starts first, this debt stops being temporary and R-003's decision needs to be revisited,
not repeated. Recorded here as the durable pointer: the convergence migration — drop
`RiskTreatmentAction`, route risk's own treatment endpoints through `Action` directly, and with it
collapse the four independent copies of the overdue predicate that **F-24** already names — must
land before Incidents starts, or this finding needs to be re-opened and R-003 re-decided rather than
silently carried forward again.

**Owner**: whoever starts the Incidents module. Check this finding and the "Marco de convergência"
note in `specs/002-shared-grc-foundation/tasks.md` first; do not begin Incidents against the
current dual-write state without an explicit decision to accept it further.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do coordenador:
investigar contra a superfície de Ação entregue; se a janela fechou, é reconciliação). Investigado
contra o código atual: a janela fechou, exatamente pelo caminho que este achado já previa como o
marco de fechamento — "the convergence migration — drop `RiskTreatmentAction`['s own status
authority], route risk's own treatment endpoints through `Action` directly" — e fechou **antes** da
Fase de Incidentes começar, não depois, então a condição de re-abertura que o achado descrevia
("se Incidentes começar primeiro, esta dívida para de ser temporária") nunca se aplicou.

- **Quando**: commit `e693480` ("Action passa a ser a unica autoridade do item de trabalho de
  tratamento"), 2026-09-11 — dentro da mesma frente (007-implementation-remediation) que fechou
  F-12/F-13/F-24/F-26, e antes de `008-incidents-problems` (que CLAUDE.md §17 item 13 registra como
  posterior).
- **O mecanismo antigo não existe mais**: `MirrorActionStatusFromOriginUseCase`/
  `MirrorActionFieldsFromOriginUseCase` — os dois arquivos que faziam a "escrita espelho NÃO
  VERIFICADA" que este achado media — foram **deletados**, não apenas contornados. Confirmado por
  `find`: nenhum arquivo `mirror-action-*` existe hoje em `apps/api/src`.
- **O caminho novo, lido em `apps/api/src/modules/risk/application/treatment-actions/
  update-treatment-action.usecase.ts`**: mudança de campo chama `UpdateActionUseCase.execute`
  diretamente; mudança de `status` chama `TransitionActionUseCase.execute` diretamente — a MESMA
  tabela de legalidade (`assertLegalActionTransition`) e o mesmo invariante de motivo de reabertura
  que `POST /actions/{id}/transitions` já aplicava, nunca uma segunda tabela mais permissiva. O
  próprio comentário do arquivo (linhas 7-15) documenta isso como decisão D-1/D-3, citando
  explicitamente "the 11 pairs the risk route used to accept and Action's own endpoint would reject
  now return 422 here too, on the SAME table, not a second one" — o custo exato que este achado
  media, fechado.
- **`RiskTreatmentAction` não foi apagado da tabela, foi rebaixado a linha de vínculo pura** —
  `risk_treatment_actions` continua existindo no schema (não era isso que o achado pedia para
  remover), mas `UpdateTreatmentActionUseCase` só a usa para `findLink`/
  `upsertTreatmentDecisionLink` (a associação com uma decisão de tratamento), nunca mais para status
  ou campos de trabalho — exatamente "route risk's own treatment endpoints through Action directly".
- **Teste que prova a convergência, já existente**: `apps/api/test/integration/
  risk-action-convergence.spec.ts`, cujo próprio cabeçalho diz "This file REPLACES the previous
  coexistence-window suite ... it no longer has a mirror to test, and testing 'the mirror drifts by
  design' would be testing a defect this same migration fixed". Rodado isoladamente nesta rodada:
  **5/5 testes passaram**.

Nenhuma mudança de código nesta rodada, nenhum marco arquitetural novo construído — só reconciliação
do registro contra uma convergência que já tinha acontecido.

## F-37 — RESOLVIDO (2026-09-08 — marcador de cabeçalho adicionado 2026-09-18) — Finding has no relationship to Risk, though the spec's own acceptance criteria describe one

**Found**: 2026-09-07, Phase 6 (Polish) closeout of the "Shared GRC Foundation" feature (T084).

**Where**: `specs/002-shared-grc-foundation/spec.md`, User Story 3, Acceptance Scenario 4: a finding
linked to a risk should appear "entre seus vínculos" when that risk is consulted, without the Risk
module needing to know the finding's own originating module.

**What actually exists**: `data-model.md` §1's own overview diagram gives `Finding` exactly two
relationships — `Finding` to `Action` (1:N) and `Finding` to `Evidence` (N:M, via `EvidenceLink`,
`subjectType: FINDING`). There is no `Finding`-to-`Risk` link of any kind: no join table, no
`riskId` column, no closed-enum registry linking a finding to the risk it concerns.
`apps/web/src/features/findings/components/findings-panel.tsx`'s own header names the consequence
and the workaround directly: the panel embedded in the risk detail screen lists findings by the
risk's own organizational unit (`GET /findings?orgUnitId=`), not by any persisted Finding-to-Risk
link — "a real, non-fabricated scope (every finding shown genuinely belongs to the risk's
organizational unit)," in that file's own words, but not the relationship Acceptance Scenario 4
describes. Querying a risk's own linked findings, as the scenario implies, is not possible through
any endpoint this contract defines.

**Why this was not fixed here**: this task's hard constraint forbids adding a table, column or enum
value beyond what `contracts/grc-foundation.openapi.yaml` and `data-model.md` already define, and
neither defines a `Finding`-to-`Risk` link. Introducing one now would be new schema and a new query
surface built without the spec/plan/tasks review CLAUDE.md §16 requires for anything beyond what was
already decomposed into tasks.

**Verdict**: this is a genuine gap between the approved spec and the shipped data model, not a
misreading of either document — data-model.md's own §1 diagram is the place this should have been
caught before implementation began, and was not. Acceptance Scenario 4 of User Story 3 is not
satisfied by the current implementation.

**Owner**: whoever next touches `Finding`'s data model (plausibly the same task that does the R-003
convergence in **F-36**, since both touch how GRC entities point at `Risk`). Options to weigh then,
not decided here: (a) a real `FindingRiskLink` join entity, the "two domains relate and the link has
its own meaning" mechanism CLAUDE.md §19.3 already sanctions; (b) accept the org-unit-scoped panel as
the permanent answer and correct spec.md's Acceptance Scenario 4 to match, rather than carrying a
contradiction between spec and implementation indefinitely. Either is a legitimate outcome; leaving
the contradiction unexamined is not.

> **RESOLVED, 2026-09-08 — this finding has denied a real relationship since the next day it was
> written, and stood uncorrected until 2026-09-11.** Option (a) above is exactly what Phase 5
> (`specs/005-audit-findings/`) shipped, one day after this finding was recorded: migration
> `20260908110300_finding_control_risk_links_baseline` (commit `f9e5e5b`, the same backend commit
> CLAUDE.md §17 item 11 credits with "vínculos achado↔controle/risco") adds `FindingRiskLink`
> (`finding_risk_links`) as a real, named join table — `schema.prisma:2833` — with its own
> `linkedByUser`/`unlinkedByUser` audit trail, exactly the mechanism CLAUDE.md §19.3 sanctions, not a
> generic relation table. `FindingRelationshipController`
> (`apps/api/src/grc/finding/presentation/finding-relationship.controller.ts`) exposes
> `GET/POST /findings/{findingId}/risks` and the matching unlink route, backed by
> `LinkFindingRiskUseCase`/`ListFindingRiskLinksUseCase`/`UnlinkFindingRiskUseCase`
> (`application/links/link-finding-risk.usecase.ts`). Querying a risk's own linked findings, which
> this finding said "is not possible through any endpoint this contract defines," has been possible
> since that commit. Acceptance Scenario 4 of User Story 3 is satisfied. Nothing in this project
> flagged the contradiction for three days because this finding was never marked resolved when the
> very next phase closed it — recorded as its own small instance of the pattern F-42 already names.

## F-38 — RESOLVIDO (já corrigido em `501b369`, 2026-09-07; reconciliado 2026-09-19, rodada 023, Lote B) — Organizational-scope denial on an existing record is never audited as DENIED, despite FR-030's own wording

**Found**: 2026-09-07, Phase 6 (Polish) closeout of the "Shared GRC Foundation" feature (T083), while
running `specs/002-shared-grc-foundation/quickstart.md` scenario 3 against the live application and
checking `audit_event` for the DENIED row the scenario's own SQL asks for.

**What was verified directly**: signed in as a real, non-global-scope user (the seeded Risk Analyst
fixture) and issued `GET /evidence/{id}` and `POST /evidence/{id}/links` against an evidence record
genuinely outside that user's organizational scope. Both correctly returned 404, byte-for-byte
identical in shape to a request against a truly nonexistent id (SC-005 holds). Neither request
produced a new row in `audit_event` with `outcome = 'DENIED'` — confirmed by querying `audit_event`
immediately before and after each call.

**Why**: `grc/evidence`'s (and `grc/action`'s, `grc/finding`'s) scoped repository enforces
organizational scope as a SQL-level predicate inside `findById(scope, id)`, returning `null` for an
out-of-scope row exactly as it would for a genuinely missing one; the use case then raises
`NotFoundDomainError` directly. This path never touches `OrgScopeEnforcerService.assertAccessible` —
the one component in this codebase (`core/organizations/application/org-scope-enforcer.service.ts`)
that, on refusal, calls `AuditOrgScopeDenialRecorder` and writes the `organization.denied.out_of_scope`
DENIED row. `grc/shared/domain/org-scope.ts`'s own header comment explains, correctly, why
`assertAccessible` is the wrong tool for a CREATE-time scope check (no existing record's existence
would be disclosed) — but that reasoning does not apply to a `GET`/`PATCH`/link of an EXISTING
out-of-scope record, which is exactly the case `assertAccessible` exists for and which the scoped-
repository pattern quietly bypasses instead.

**This is not new to Phase 6 or to `grc/`.** `OrgScopeEnforcerService.assertAccessible` is called
from nowhere in `modules/risk` either — it is referenced only in its own file, in a fixture-based
unit test that exercises it directly (`test/integration/audit-denied.spec.ts`, T040b), and in the
`grc/**` comments that explain why it is deliberately not called there. Risk's own read/update use
cases have the identical "return null on scope mismatch, throw `NotFoundDomainError`, no DENIED row"
shape. This is CLAUDE.md §19.10's exact failure class — a mechanism that compiles and is proven to
work in isolation, but is never actually exercised by production code — pre-dating this phase,
inherited rather than introduced by it.

**Why FR-030 reads as violated**: spec.md's FR-030 requires that actions denied for lack of
permission or for scope both be audited. What is actually true today: a permission denial (403,
`PermissionGuard`) is audited (the contract suite's own denial test proves exactly this half). A
scope-based denial disguised as 404 (FR-032's own non-disclosure requirement) is never audited as
DENIED anywhere in this codebase, in any module. The tasks that were actually written and run for
this phase (T020, T024 in `tasks.md`) only ever tested the permission half — scope-denial auditing
was never required by a task, so no test caught the gap, and no code closes it.

**Not fixed here**: this task's hard constraint forbids adding a table/column/enum value, and fixing
this properly means either wiring the scoped-repository's null-on-scope-mismatch result through
`AuditOrgScopeDenialRecorder` (a real code change to a widely-shared base class, touching every
module, not a Phase 6 polish-scope change) or deciding explicitly that non-disclosed scope denials
are intentionally not audited — in which case FR-030's wording needs correcting, not the code.
Either is a real decision for the task that owns it, not something to make silently here.

**Owner**: whoever next revisits `core/organizations` or FR-030's own wording. Decide one of: (a)
route the scoped-repository's scope-miss result through `AuditOrgScopeDenialRecorder` platform-wide,
so every module gets it at once and stays consistent with the pattern already proven correct for
permission denials; or (b) narrow FR-030 to say what is actually true: permission denials are
audited, scope-based non-disclosure is not, by design, because auditing it would need to happen deep
inside a repository that today has no dependency on the audit subsystem at all.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote B, decisão do coordenador:
corrigir, comportamento de autorização inalterado, reutilizar desfecho `DENIED` existente se
houver). Investigação prévia obrigatória confirmou: option (a) já foi executada — no dia seguinte ao
achado, não nesta rodada. `git log -- .../org-scope-enforcer.service.ts` mostra um único commit além
do inicial: `501b369` (2026-09-07, "fix(foundation): assurance hardening — close six freeze
blockers"), cujo próprio texto nomeia este achado sem citá-lo pelo número: "Organizational-scope
denial was never audited — zero rows in 3,310 real events spanning the project's history — though
FR-030 says denial by permission or by scope must be. The mechanism existed and had never been
called ... Now wired through 15 use cases."

- **Nenhum enum/migração novo foi necessário, então nenhuma pausa para decisão era exigida**:
  `AuditOutcome.DENIED` já existia antes deste achado (usado por negação de permissão,
  `audit-permission-denial-recorder.ts`), e `AuditOrgScopeDenialRecorder`/`OUT_OF_SCOPE_ACTION =
  'organization.denied.out_of_scope'` (`apps/api/src/core/organizations/infrastructure/
  audit-org-scope-denial-recorder.ts`) já existiam como infraestrutura pronta, só sem chamador —
  exatamente o `DENIED` equivalente que a instrução pedia para reutilizar.
- **O mecanismo real**: `OrgScopeEnforcerService.assertExistingRecordAccessible`
  (`apps/api/src/core/organizations/application/org-scope-enforcer.service.ts:146-169`) resolve a
  unidade organizacional REAL do registro via uma busca não-escopada só neste caminho de exceção;
  se o registro não existe (`undefined`), lança `NotFoundDomainError` **sem** gravar auditoria — a
  distinção exata que a instrução exige, provada de novo abaixo, não presumida. Se existe mas fora
  de escopo, grava o `DENIED` e lança o mesmo erro. O comportamento externo (404, corpo
  byte-idêntico) nunca muda — é exatamente o "acrescentar registro, não mudar decisão" pedido.
- **Cobertura, medida por `grep`, não pelo texto do commit de 2026-09-07**: `assertExistingRecordAccessible`
  hoje tem chamadores em Risco, Evidência, Achado (os quatro módulos originais do commit) **e**
  Ativos, Processos, Controles, Incidentes, Problemas, Engajamentos de Auditoria — todo módulo
  construído DEPOIS de 2026-09-07 adotou o mesmo mecanismo, cada um com um comentário próprio
  citando "F-38's mechanism" explicitamente (`get-incident.usecase.ts:6`,
  `get-problem.usecase.ts:7`, `get-control.usecase.ts:7`, `get-asset.usecase.ts:7`,
  `get-audit-engagement.usecase.ts:7`, entre outros). A cobertura é maior hoje do que o commit
  original entregou, não porque esta rodada ampliou — porque cada fase seguinte já seguiu o padrão
  por conta própria.
- **Teste que prova exatamente o contrato pedido, já existente**: `apps/api/test/contract/
  org-scope-denial-audit.spec.ts` (764 linhas, cita F-38 no cabeçalho) cobre leitura, atualização,
  transição de ciclo de vida e criação de vínculo, em Risco/Evidência/Ação/Achado, provando as três
  propriedades exatas que a instrução pediu: (1) acesso fora de escopo grava exatamente UMA linha
  `organization.denied.out_of_scope` com `outcome: DENIED`; (2) a mesma requisição contra um id
  genuinamente inexistente NÃO grava nada (a auditoria nunca vira o oráculo que a não-divulgação
  proíbe); (3) os dois corpos 404 são byte-idênticos em `type`/`title`/`detail`.

**Verificação ao vivo, 2026-09-19**: `test/contract/org-scope-denial-audit.spec.ts` isolado —
**15/15 testes passaram** (24.34s), contra banco real, com todos os guards/filtros ativos.

Nenhuma mudança de código nesta rodada — o mecanismo, a cobertura e o teste já existiam. Só o
cabeçalho deste registro nunca foi atualizado.

## F-39 — RESOLVIDO (confirmado 2026-09-18 no levantamento definitivo) — `EntityTabs` overflows with no scroll affordance, and hides the two newest tabs by default

**Found**: 2026-09-07, this assurance audit, inspecting the risk detail screen's tab strip at 1440px
and 768px.

`packages/design-system/src/components/entity/entity-tabs.tsx` renders its tab strip inside a bare
`overflow-x-auto` container — scrollable by touch, trackpad or shift-scroll, but with no fade, no
chevron, no scrollbar hint that there is anything beyond the fold. The risk detail screen
(`apps/web/src/app/(app)/risks/[id]/risk-detail-view.tsx`) registers twelve tabs, in this order:
`overview`, `causes-consequences`, `assessment`, `controls`, `treatment`, `action-plans`, `history`,
`audit`, `attachments`, `comments`, `evidence`, `findings`. At 1440px, "Achados" (`findings`) sits
beyond the fold with zero visual cue; at 768px only 6 of the 12 tabs are visible at default scroll.
The two tabs hidden are, not by coincidence, the two this same phase added — `evidence` and
`findings` are confirmed the last two entries registered, both landing in commit `115bf2a`.

**Why it matters**: this reproduces the exact shape of F-28 (the dashboard accessibility scan that
measured a screen before its charts existed) — a shared primitive that was correct the day it was
built and wrong the day a real consumer's tab count crossed a threshold nobody tested against.
Every future module that adds an `EntityTabs` consumer inherits the same risk until the primitive
itself carries a scroll affordance; today it depends on each consumer happening to stay under
whatever count fits one viewport.

**Status**: being fixed now, as of this writing. The working tree (uncommitted) already carries a
real fix — the component's own new header comment labels it "Scroll affordance (assurance-audit
Fix 2)": a `useHorizontalOverflow()` hook driving `ResizeObserver`-backed
`canScrollBack`/`canScrollForward` state, conditionally-rendered edge-fade divs and
`ChevronLeft`/`ChevronRight` buttons, with a matching test. Not marked resolved here because it is
not yet committed, and because the durable point is the primitive's own former blind spot, not this
one patch — the next consumer to push `EntityTabs` past a new width/count threshold is the real test
of whether the fix generalizes.

**Owner**: whoever commits the pending fix; re-verify against a rendered screen per §18.1, not just
the new test, before calling it closed.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings — levantamento
definitivo): o patch que este achado já descrevia como "no working tree, ainda não commitado" está
commitado e é o mecanismo atual. Lido diretamente em
`packages/design-system/src/components/entity/entity-tabs.tsx` nesta mesma sessão (durante a
investigação de F-66 causa 3): `useHorizontalOverflow()` — `ResizeObserver` sobre o contêiner e seu
conteúdo, `canScrollBack`/`canScrollForward`, faixas de esmaecimento condicionais e botões
`ChevronLeft`/`ChevronRight` — exatamente como descrito. Nenhuma ação necessária.

## F-40 — RESOLVIDO (confirmado 2026-09-18 no levantamento definitivo) — Evidence and Finding's hand-written frontend types promise an `OrgUnitRef.code` field their API never sends

**Found**: 2026-09-07, this assurance audit, cross-checking `packages/api-types`'s generator against
the "Shared GRC Foundation" phase's own contract.

`packages/api-types/scripts/generate.mjs`'s `DOCUMENTS` array, as shipped in commit `115bf2a`, lists
only the four `001-grc-platform-foundation` contracts (`auth`, `admin`, `platform`, `risks`) —
`specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml` was never added. The phase
that created three new domains shipped with zero generated-type coverage for any of them;
`apps/web/src/features/{evidence,findings,actions}/types.ts` are all hand-written instead, the same
pattern F-3/F-18/F-19 already named for Risk.

This produced a concrete instance of exactly the type lie F-18 already found. `features/risks/types.ts`'s
`OrgUnitRef` requires `code: string` — that domain's API does return it. `features/evidence/types.ts`
and `features/findings/types.ts` both import THIS `OrgUnitRef` — the wrong one — instead of declaring
their own. Confirmed against the actual mappers: `apps/api/src/grc/evidence/presentation/dto/evidence-response.mapper.ts`
and `.../grc/finding/presentation/dto/finding-response.mapper.ts` both serialize `orgUnit` as
`{ id, name }` only; `code` is never sent for either domain. `features/actions/types.ts` avoided the
same mistake — it declares its own, correctly-scoped `{ id, name }` `OrgUnitRef`, with a comment
naming the divergence from `risks/types.ts`'s own. Two of the three new domains carry the lie; the
third does not, for no reason a type system enforced — it happened to be written correctly.

**Why it matters**: the same latent hazard F-18 already named for Risk — a future
`if (evidence.orgUnit.code === ...)` would typecheck and silently read `undefined` as a real code —
plus a cost specific to this instance: whoever eventually adopts `packages/api-types` in `apps/web`
(F-18/F-19's own owner) now inherits three more hand-written files needing the same reconciliation,
not one.

**Status**: found and partially addressed by this same audit. The working tree (uncommitted) already
regenerates `packages/api-types` with a fifth namespace, `GrcFoundation`, from the 002 contract, and
the generator's own new header comment names this exact divergence by hand. But
`features/evidence/types.ts` and `features/findings/types.ts` themselves are untouched — they still
import the risks-domain `OrgUnitRef`. The generator fix alone does not close this: something still
has to switch both files to a correctly-shaped type and delete the borrowed import.

**Owner**: whoever lands the pending `packages/api-types` work — the generator half is done; the two
consuming files are not.

**Verificado como já corrigido, 2026-09-18** (rodada 023, saneamento de findings — levantamento
definitivo): `apps/web/src/features/evidence/types.ts` e `.../findings/types.ts` cada um declara
hoje seu próprio `OrgUnitRef` a partir do gerador (`GrcFoundation.components['schemas']['OrgUnitRef']`,
`{id, name}`, contract-backed), com um comentário citando "assurance-audit Fix 3" e explicando o erro
anterior (importar o `OrgUnitRef` do domínio de Risco, que tem `code` e os dois não têm). O import
emprestado não existe mais em nenhum dos dois arquivos. Nenhuma ação necessária.

## F-41 — RESOLVIDO conforme o escopo decidido pelo coordenador — apresentação corrigida com código; ausência de rate limit confirmada como real e fechada como limitação conhecida, não como pendência (2026-09-19, rodada 023, Lote C) — A malformed JSON body never gets a correlation id, is never rate-limited, and surfaces a raw English parser message inside a pt-BR problem document

**Found**: 2026-09-07, this assurance audit, tracing NestJS 11.2.3's own bootstrap order against
`apps/api/src/app.module.ts`'s middleware/guard registration. Static analysis only — no server was
started to avoid side effects, so this is a strongly-evidenced code-path finding, not an observed
HTTP response; no existing test in `apps/api/test/` exercises this path either.

**Where**: `apps/api/src/infrastructure/logging/request-context.ts` (`RequestContextMiddleware`),
`apps/api/src/app.module.ts` (registers it via `consumer.apply(...).forRoutes('*')`, and
`ThrottlerGuard` via `APP_GUARD`), `apps/api/src/infrastructure/http/problem-details.filter.ts`.

`RequestContextMiddleware`'s own doc comment says it "must run before everything else" so a
correlation id is available to every guard, pipe, interceptor and the exception filter. True
relative to Nest's own request pipeline, not relative to Express's body-parser:
`@nestjs/core@11.2.3`'s `NestApplication.init()` calls `registerParserMiddleware()` (installs
`express.json()`) before `registerRouter()` — the call that mounts `RequestContextMiddleware`, from
`AppModule.configure()`. Body-parser sits earlier in the Express middleware stack than the
middleware documented to run "before everything else."

When a client sends malformed JSON, `express.json()` throws a `SyntaxError` synchronously into
`next(err)`. Express error propagation skips every ordinary middleware after that point — including
`RequestContextMiddleware`, mounted later — and jumps straight to the one error-handling middleware
Nest installs last of all, in `@nestjs/core`'s `routes-resolver.js`'s `registerExceptionHandler()`,
whose own `mapExternalException` explicitly names this case ("SyntaxError is thrown by Express
body-parser when given invalid JSON") and converts it to `new BadRequestException(err.message)` —
preserving the original message verbatim.

Three consequences, all following mechanically from that ordering:

1. `RequestContextStore` was never populated for this request, so `ProblemDetailsFilter.catch()`'s
   `RequestContextStore.get()?.correlationId ?? 'unknown'` falls back to the literal string
   `'unknown'`, and the `x-correlation-id` response header (set only inside
   `RequestContextMiddleware`) is never sent. This error class is unattributable in logs and in the
   response itself — the one guarantee the correlation id exists to provide.
2. `ThrottlerGuard` — a Nest guard that only runs once a request reaches a matched route's handler
   pipeline — never executes, because the request never gets that far. A flood of malformed-JSON
   `POST`s is not rate-limited by anything.
3. `ProblemDetailsFilter.fromHttpException()`'s `extractDetail()` reads `record.message` off the
   `BadRequestException` body — the raw V8/body-parser string (e.g. "Unexpected token ... in JSON at
   position N"), in English — and returns it as `detail`, while `title` is correctly pt-BR
   (`STATUS_TITLES[400]`). The result is one RFC 9457 document with a Portuguese title and an
   English, implementation-revealing detail.

**Why it matters**: this filter's own stated hard rule (FR-107/FR-108) forbids a raw internal message
reaching a client — this is exactly that, for one easily-triggered error class. CLAUDE.md §12 names
logs and audit as security-relevant; an error class that structurally cannot carry a correlation id
is invisible to the correlation this project otherwise relies on end to end.

**Not fixed here**: no code was changed to verify this, and `apps/`/`packages/`/`docker/` are outside
this documentation pass's authorized surface regardless. No fix exists in the working tree either,
committed or otherwise, as of this writing.

**Owner**: whoever next touches `RequestContextMiddleware` or the global exception filter. The fix
likely has two independent parts: (a) map `SyntaxError`/`URIError` in `ProblemDetailsFilter` to a
fixed, generic pt-BR detail the way `PayloadTooLargeException` is already special-cased, rather than
trusting `HttpException.getResponse()`'s message; (b) decide whether a correlation id can be assigned
earlier than Nest's own body-parser registration allows — a genuine architecture question, since it
means a correlation id existing outside Nest's own `configure()`-based middleware mechanism.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do coordenador:
corrigir a parte de apresentação; verificar a parte de rate limit e fechar essa metade separadamente
se já obsoleta). As duas partes, tratadas separadamente como a decisão pediu:

**1. Apresentação — corrigida, exatamente pela opção (a) que o "Owner" original já apontava,
sem tocar a opção (b) (arquitetura de middleware).**

- **`correlationId`**: `apps/api/src/infrastructure/http/problem-details.filter.ts`'s `catch()`
  trocou o fallback `?? 'unknown'` por `?? randomUUID()` — o mesmo mecanismo que
  `RequestContextMiddleware` já usa para gerar o id em condições normais — e passou a fixar o
  cabeçalho `x-correlation-id` (`CORRELATION_ID_HEADER`, reexportado de `request-context.ts`) na
  resposta incondicionalmente, não só quando o middleware roda. Isso resolve a inconsistência #1 do
  achado (nem corpo nem cabeçalho carregavam um id de verdade) sem mexer na ordem de registro de
  middleware do Nest — a pergunta de arquitetura (b) continua sem decisão, deliberadamente.
- **`detail` em inglês**: acrescentado um novo ramo em `fromHttpException`, no mesmo padrão
  defensivo já usado para `PayloadTooLargeException` — mas por FORMATO, não por `instanceof`
  (o corpo malformado chega como `BadRequestException` comum, indistinguível por tipo do que a
  própria aplicação lança). Detecção: `status === 400` com `record.title`/`record.detail` ambos
  ausentes — confirmado por `grep -rn "new BadRequestException(" apps/api/src --include=*.ts | grep
  -v spec` (27 ocorrências) que
  **todo** chamador desta base de código passa um objeto literal com `title`/`detail` explícitos;
  a única forma de chegar aqui com esses dois campos ausentes é o caminho externo do
  `mapExternalException` do próprio `@nestjs/core`. Substituído por
  `USER_MESSAGES.server.malformedRequestBody` — nova mensagem pt-BR em
  `apps/api/src/shared/messages/problem-details.ts` (catálogo centralizado, §11.1). `title` já
  chegava correto em pt-BR antes desta correção (via `STATUS_TITLES[400]`) — confirmado por leitura
  do código, não presumido; nenhuma mudança foi necessária ali.
- **Fronteira do §11.1 respeitada**: a URI `type`
  (`https://pharosgrc.dev/problems/http-400`) continua em inglês, intocada — é identificador técnico,
  não interface, exatamente como §11.1 exige. Verificado no teste novo (abaixo).
- **Nenhum teste afirmava o texto antigo**: `grep` em `apps/api/test` por "Unexpected token",
  "malformed", "SyntaxError", "invalid JSON" não encontrou nenhum teste de contrato ou integração
  que dependesse da mensagem inglesa antiga ou do literal `'unknown'` — nada precisou acompanhar a
  correção porque nada a contradizia.
- **Teste novo, provando o comportamento (o achado registrava que nenhum existia)**:
  `apps/api/test/unit/problem-details.filter.spec.ts` (novo) — reproduz exatamente a forma que
  `mapExternalException` produz (`new BadRequestException(rawString)`, nunca o objeto que este
  código já usa), sem envolver `RequestContextStore.run(...)` (reproduzindo a ausência real de
  contexto), e prova: `detail` nunca contém o texto do parser; `detail` é a mensagem pt-BR fixa;
  `title` é pt-BR; `type` continua em inglês; `correlationId` não é `'unknown'`, casa um formato de
  UUID, e o cabeçalho `x-correlation-id` carrega o MESMO valor do corpo. Um segundo teste prova que,
  quando o contexto já existe, o id publicado é reaproveitado sem alteração — o caminho normal
  continua intocado. **2/2 passou.**
- **Verificação ao vivo, contra a API real, reconstruída e reiniciada para refletir o código
  atual** (o processo que já estava rodando servia `dist/` de uma build anterior a esta sessão —
  `pnpm --filter @pharos/api run build` seguido de reinício): `POST /api/v1/auth/login` com corpo
  JSON malformado agora devolve `x-correlation-id` real, `detail: "O corpo da requisição não pôde
  ser interpretado como JSON válido."`, `title: "Requisição inválida"`, `correlationId` igual ao
  cabeçalho — confirmado por `curl` direto, corpo e cabeçalhos inspecionados.

**2. Ausência de rate limit — confirmada ainda verdadeira hoje, NÃO obsoleta, registrada como
limitação conhecida, fora do alcance desta correção.**

Medido ao vivo, não presumido: 110 requisições `POST` consecutivas com corpo JSON malformado contra
`/api/v1/auth/login` — **as 110 voltaram `400`, nenhuma voltou `429`**, apesar de
`THROTTLE_LIMIT=100`/`THROTTLE_TTL_SECONDS=60` estar ativo nesta mesma instância. Controle no mesmo
processo, na mesma janela: 110 requisições `GET /api/v1/risk-categories` (corpo válido, chega ao
`SessionGuard`, portanto ao `ThrottlerGuard`) — as cinco últimas voltaram `429`, exatamente no limiar
esperado. O contraste prova que o limitador está vivo e funcionando normalmente para rotas que ele
alcança, e genuinamente nunca alcança o caminho do corpo malformado — a causa mecânica que o achado
original já isolou (o `express.json()` lança antes de o roteador do Nest resolver um handler, e todo
guard — incluindo `ThrottlerGuard` — só roda depois disso) continua verdadeira na versão atual do
Nest (`@nestjs/core@11.2.3`, inalterada).

**Não corrigido, deliberadamente**: mover onde um id de correlação/limitador poderia interceptar
antes do `express.json()` exigiria reordenar o bootstrap do Nest ou registrar um middleware Express
cru fora do mecanismo `configure()` do Nest — exatamente a "pergunta de arquitetura genuína" que o
"Owner" original já nomeava como fora do alcance de uma correção pontual, e a instrução desta rodada
não pediu essa reconstrução. Registrado como limitação conhecida, com a causa mecânica e a medição
acima como evidência — não presumida, não um contorno frágil inventado.

## F-42 — RESOLVIDO (todas as instâncias registradas, confirmado 2026-09-18) — The recurring pattern behind F-39–F-41: a fix that does not reach its sibling, and a comment that does not survive the fact it recorded

**Found**: 2026-09-07, this assurance audit, while investigating F-39–F-41 above and re-reading
several already-resolved findings for this same documentation pass. Recorded on its own because the
individual instances above are symptoms; the two mechanism gaps behind them are not new to this
phase and will keep producing instances until something structural changes.

**Mechanism 1 — a fix applied in one place is not propagated to its sibling**, confirmed with three
concrete pairs, all found during this audit and, as of this writing, fixed only in the uncommitted
working tree:

- **404 re-keying.** `core/files/application/attachment-access.ts`'s `assertAttachmentAccessible`
  re-throws a scope/permission refusal keyed by the ATTACHMENT's own id, never the parent's — the
  mechanism that keeps "attachment does not exist" and "attachment exists but its parent fell out of
  scope" byte-identical (FR-030/FR-032). `modules/risk/application/collaboration/risk-evidence-subject-accessor.ts`'s
  `RiskTreatmentDecisionEvidenceSubjectAccessor` — registered for
  `EvidenceSubjectType.RISK_TREATMENT_DECISION`, added in this same "Shared GRC Foundation" phase —
  did not do this: an out-of-scope parent risk surfaced `NotFoundDomainError('Risco', decision.riskId)`,
  a different entity, a different label, and a UUID the caller never supplied. Same codebase, same
  pattern, same author intent, one sibling missing it.
- **The attachments panel.** `apps/web/src/features/risks/components/risk-attachments-section.tsx`
  exists; `apps/web/src/features/evidence/components/evidence-attachments-section.tsx` did not,
  until this pass. Evidence is exactly as attachable as Risk
  (`registerAttachableEntityType('EVIDENCE', ...)`, `docs/architecture.md`'s "Comments and
  attachments" section) — the backend registry was extended correctly; the frontend panel that makes
  it usable was not.
- **The live scope re-check.** `grc/evidence/application/evidence-link-visibility.service.ts`
  re-resolves a link's subject visibility on every read, live, never trusting a stored value —
  documented as deliberate in its own header. `grc/action`'s equivalent did not exist: `Action.orgUnitId`
  is stamped once at creation from its origin and never revisited, so a custodian who lost scope
  over the origin (e.g. a risk reassigned to another unit) kept full read/write access to the action
  derived from it, while the origin's new custodian was 404'd on the very same row — a genuine,
  confirmed authorization gap (FR-030), not a hypothetical.

All three pairs share one shape: an invariant was correctly built once, and the registries this
project relies on (`EvidenceSubjectResolverPort`, `AttachableEntityType`, the origin-resolver
pattern) make a SECOND instance trivial to register — but registering a new type does not re-derive
the invariants the FIRST instance had to learn the hard way. The registry pattern (§19.4/ADR-016,
ADR-008) solves "where does the code for a new type live"; it does not solve "does the new type's
code satisfy the same invariant the existing types already had to."

**Mechanism 2 — a comment records a reason, and the reason expires without anything re-checking
it**, confirmed at different stages of staleness — some already caught and fixed (evidence the
pattern recurs even after being named once), one caught by this pass, one still open:

- `docker/web.Dockerfile`'s former "`public/` does not exist in this project" comment — already
  found and fixed as **F-35**. Cited here not as a live defect but as the first confirmed instance of
  this exact mechanism: a true reason, stated as fact, that a later phase's own work silently
  invalidated.
- `apps/api/src/modules/risk/presentation/dto/risk-response.mapper.ts`: "`pendingApprovalDetail`
  remains `null` by construction — it belongs to US6 (lifecycle/approvals), whose write path does
  not exist yet." US6 shipped (`application/approvals/request-approval.usecase.ts`,
  `decide-approval.usecase.ts`, both real) in a commit that itself touched this very file — and left
  the comment, and the hardcoded `null`, exactly as they were. Not cosmetic staleness: a risk with a
  genuine pending approval request today has no `pendingApprovalDetail` in its own detail response,
  because nothing was ever asked to revisit this mapper once the write path it names actually
  arrived. Unfixed, in the committed code and in the working tree alike, as of this writing.
- `schema.prisma`'s "(Invariant E3, domain-enforced)" on `Evidence.archivedAt`/`archivedByUserId`
  overstates what exists, next to invariants that genuinely earn the label: E1 and E2 each have a
  real function in `grc/evidence/domain/evidence.entity.ts` (`assertEvidenceHasSubstance`,
  `assertValidUntilNotBeforeCollectedOn`) that throws on violation. E3 has no such function — the
  pairing holds only because `EvidenceRepositoryPort.archive()` is the sole method that writes either
  field, and its signature happens to require both. That is real, but it is enforcement by there
  being only one call site today, not a named guard the way E1/E2 are; a future second call site (a
  bulk-restore path, an admin override) would have nothing stopping it from writing one field alone,
  and the comment gives no hint that this is a weaker guarantee than its neighbors.
- `docker/api.Dockerfile`'s committed migrate-command comment offers
  `docker compose run --rm api pnpm --filter ./apps/api exec prisma migrate deploy` as a working
  example, with no caveat — but the `runtime` stage is built via `pnpm ... deploy --prod --legacy`,
  which excludes devDependencies, so there is no `prisma` CLI in that image for the command to
  invoke. The comment describes a command that cannot work against the image it names, and gives no
  hint a reader could notice before trying it. (The uncommitted working tree already corrects this,
  citing F-12/F-13; not yet landed as of this writing.)

**What would actually catch mechanism 1**: a conformance test suite bound to the registry itself, not
to any one registrant. For each port with more than one real implementation
(`EvidenceSubjectResolverPort`, `ActionOriginResolverPort`, `AttachableEntityType`/`CommentableEntityType`),
one shared test — "every registered accessor re-keys a downstream 404 to its own subject's id/label,"
"every registered attachable type has a frontend panel," "every registered origin type re-resolves
scope live rather than trusting a stored snapshot" — run once per registrant automatically, rather
than once per module by whoever remembers to write it again. **Honest limit**: this only catches an
invariant someone already thought to add to the shared suite. A third sibling still needs a human to
notice a NEW invariant belongs in the suite at all, and to back-fill it onto the first two. It turns
"propagate the fix N times" into "propagate the fix once, into a test" — real, but not zero, and it
does nothing for the first time an invariant is discovered.

**What would actually catch mechanism 2**: the convention this project already invented once, ad hoc,
to fix F-35 — turn a comment's stated REASON into a stated, falsifiable CONDITION next to it (a file
path, a grep, a query), the way F-35's own fix now reads "before ever removing the line again"
against `git ls-files apps/web/public`. This could be partially mechanized: a CI grep flagging source
comments matching a small set of present-tense negative-claim phrasings ("does not exist," "not
yet," "no such," "has not been") and requiring a companion checkable condition, failing otherwise.
**Honest limit**: this is a phrasing heuristic, not a fact-checker — it will miss differently-worded
claims and flag harmless ones, and even a comment that DOES carry a checkable condition still needs
someone to actually run that check periodically; nothing proposed here does that on its own. It turns
"a stale claim is invisible until someone reads it very carefully" into "a stale-shaped claim is
visible, and someone still has to look" — a review nudge, not a guarantee.

**Owner**: no single task owns this — it is a standing practice question for whoever next designs a
shared-registry extension point or writes a comment stating why something is currently absent. Both
proposals above are recommendations, not decisions; neither is implemented by this documentation
pass.

**Instances resolved, 2026-09-18** (mandate-change zero-open-findings pass): every concrete instance
this finding named is now fixed in the current codebase, verified by reading the code, not the
finding text:

- 404 re-keying — `RiskTreatmentDecisionEvidenceSubjectAccessor`
  (`apps/api/src/modules/risk/application/collaboration/risk-evidence-subject-accessor.ts:122-123`)
  now catches `NotFoundDomainError` and re-throws keyed to the treatment decision's own id/label,
  never the parent risk's.
- Attachments panel — `apps/web/src/features/evidence/components/evidence-attachments-section.tsx`
  exists, with its own test file.
- Live scope re-check for `Action` — `assert-action-origin-in-scope.ts`
  (`apps/api/src/grc/action/application/assert-action-origin-in-scope.ts`) now re-resolves the
  origin's current organizational unit live via `ActionOriginResolverPort#resolveOriginScope` on
  every `GetAction`/`UpdateAction`/`TransitionAction` call, exactly the fix this finding described as
  missing, with its own header explicitly citing the breach.
- `docker/api.Dockerfile`'s migrate-command comment (lines 11-28) has been corrected and now cites
  F-12/F-13 explicitly.
- `apps/api/src/modules/risk/presentation/dto/risk-response.mapper.ts`'s `pendingApprovalDetail` is
  no longer hardcoded `null` — it is wired to `GetRiskDetailUseCase.pendingApprovalDetail`
  (lines 32-41, 189-190), with its own header dated "assurance Fix 4."
- `schema.prisma`'s `Invariant E3` comment (`Evidence.archivedAt`/`archivedByUserId`) overstated its
  own enforcement (called it "domain-enforced" next to E1/E2, which have a real guard function and,
  for E1, a DB `CHECK`). Corrected today to state plainly that E3 holds only because
  `EvidenceRepositoryPort.archive()` is the sole call site and both parameters are required — the
  exact honest-limit this finding named. This was the one instance still open; fixed as a one-line
  comment correction, no behavior changed.

The two structural proposals (a conformance-test suite bound to each shared registry; a CI grep for
present-tense negative-claim comments) remain unimplemented and are still standing practice
recommendations, not defects — the "Owner" paragraph above is unchanged.

## F-43 — RESOLVIDO (já corrigido em `aaa8dcb`, 2026-09-11; reconciliado 2026-09-19, rodada 023) — The E2E sign-in helper reports a rate-limit as "wrong password", and fails the suite on it

**Found**: 2026-09-08, while validating the F-34 fix, after running the E2E suite several times in a row.

`signInAsWorkerAdmin` (`apps/web/e2e/support/admin-session.ts`) tries the seeded password first. When that
attempt does not reach `/dashboard` within 10s it asserts:

```ts
await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
```

That assertion encodes one explanation for a failed sign-in — the password was already rotated — and
treats every other explanation as a suite failure. There is at least one other, and it is routine: the
login throttle. The captured page at failure reads

> **Muitas tentativas. Tente novamente mais tarde.**

so the helper was staring at a perfectly correct application response and failing because it was not the
sentence it expected. Four specs (`risk-treatment`, `risk-history`, `risk-register`, `accessibility`) went
red at once from this, all with the misleading message `element(s) not found` pointing at a wrong-password
string — which reads exactly like a broken login screen and is nothing of the sort.

**Not a product defect.** The throttle firing after repeated runs is the security control behaving as
designed (CLAUDE.md: 5 wrong attempts, 15-minute lock; plus per-window rate limiting). The defect is that
the harness cannot tell "throttled" from "wrong password" and picks the wrong one.

**Why CI does not see it**: CI seeds a fresh database per run, so the first attempt succeeds and this
branch never executes. It reproduces only on a long-lived development database where a previous run has
already rotated the password — which is also the only place the suite gets run repeatedly enough to trip
the throttle. Same environmental split already recorded for **F-34** and **F-12**.

**Owner**: the next task touching `apps/web/e2e/support/`. The fix is to branch on what the page actually
says — treat the throttle message as "wait and retry", not as a failed assertion — and to widen the two
hard timeouts (10s navigation, 5s assertion), which are also too tight on a loaded machine. Asserting the
wrong-credentials text at all is optional; the helper's real job is to end up signed in.

**Non-blocking**: it costs local re-runs, never correctness, and never CI.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A): já estava corrigido, três
dias antes desta reconciliação, por `aaa8dcb` (11/09/2026, "identidade de administrador por
execucao, diagnostico real do login e correcao do script de teste") — nunca marcado no cabeçalho
deste registro. Confrontado com o código atual, não com a descrição do finding: o texto acima
descreve um `admin-session.ts` que não existe mais.
`apps/web/e2e/support/admin-session.ts` hoje tem um tipo fechado `LoginAttemptOutcome`
(linhas 90-97) com um ramo por resultado HTTP real — `success` (200), `invalid_credentials` (401),
`rate_limited` (429, com `retryAfterSeconds` lido do cabeçalho `Retry-After`), `server_error` (5xx,
corpo capturado — F-72), `misconfigured` (qualquer outro status), `network_error` (requisição
enviada e nunca respondida) e `not_submitted` (a requisição nunca saiu do navegador — D-21). A
submissão real (`submitSignIn`, linhas 200-297) lê o status da resposta de
`POST /api/v1/auth/login` via `page.waitForResponse` — nunca mais o texto renderizado na tela — e
`attemptWithRateLimitBackoff` (linhas 324-347) trata especificamente `rate_limited` esperando o
`Retry-After` do servidor e tentando de novo, em vez de reportar falha. `grep -rn "E-mail ou senha
incorretos" apps/web/e2e/` encontra uma única ocorrência, um comentário histórico em
`global-setup.ts:36` explicando o mecanismo de corrida que motivou a reescrita — não há mais
nenhuma asserção de string fixa no caminho de login. Os dois timeouts fixos que o "Owner" acima
pedia para alargar (10s de navegação, 5s de asserção) também não existem mais nesta forma:
`submitSignIn` usa `waitForResponse` com timeout de 15s, e `attemptFullSignIn` usa
`page.waitForURL` com timeout de 10s — dimensionados para o fluxo real, não para uma asserção de
texto.

Verificação ao vivo, 2026-09-19, API e web locais (não Docker) em `:3001`/`:3000`, banco existente
(`SEED_DEV_FIXTURES=false`), senha rotacionada (D-24): `apps/web/e2e/auth.spec.ts` completo,
`--workers=1 --project=chromium` — **2/2 passou** (41.6s), incluindo o próprio ramo de login
mandatório de troca de senha que exercita `submitSignIn`/`attemptFullSignIn` fim a fim.

## F-44 — RESOLVIDO (os três portões já foram cumpridos; fechado com evidência 2026-09-19, rodada 023) — Dívida aceita da Fase 2 (Controles), com dono e portão

**Registrada**: 2026-09-08, ao fechar o backend do módulo de Controles.

Três itens conhecidos, nenhum bloqueante, todos com portão explícito. Registrados aqui em vez de
corrigidos porque nenhum deles afeta correção, segurança ou integridade — e porque o roadmap não
para por dívida não bloqueante.

### 1. `ControlRegistryPort.list()` ficou sem chamador

`GET /controls` mudou de dono do módulo de Riscos para o de Controles (a transferência que o
próprio texto do endpoint antigo previa). `RegistryController.listControls` foi removido, mas
`ControlRegistryPort`/`PrismaControlRegistryRepository` continuam existindo — `findById` ainda é
usado por `LinkControlUseCase`, e apenas o método `.list()` ficou órfão.

Código morto que compila e nunca é executado é exatamente o que §19.10 trata: não é capacidade, é
intenção. **Portão**: remover junto com a próxima alteração que tocar esse repositório. Não vale
uma mudança própria agora.

### 2. Um `SELECT` escopado duplicado entre `ControlLookupPort` e `ControlRepositoryPort`

As frentes de catálogo e de verificação/vínculos correram em paralelo. A segunda declarou um
`ControlLookupPort` próprio e estreito em vez de depender do `ControlRepositoryPort` da primeira,
que ainda estava em construção e cuja injeção era incerta no momento. O resultado é uma consulta
escopada de controle escrita duas vezes.

É a classe F-42 (uma mecânica em dois lugares), em escala pequena: as duas leem a mesma tabela com
o mesmo predicado de escopo. Não diverge hoje; pode divergir quando o predicado mudar. **Portão**:
unificar na próxima alteração que toque o escopo de leitura de controle — e o teste que provar a
unificação vale mais que a unificação em si.

Vale registrar a causa: a duplicação não veio de desenho, veio de dois agentes em paralelo sem
poder depender um do trabalho inacabado do outro. Paralelização tem esse custo, e ele é aceitável
desde que fique escrito em vez de virar folclore.

### 3. Um controle `RETIRED` ainda aceita edição dos campos descritivos

`PATCH /controls/{controlId}` não tem trava por estado de ciclo de vida — diferente do Risco, que
tem `assertBusinessContentEditable`. Nem a especificação nem o contrato restringem editar a
descrição de um controle descontinuado, e a decisão foi deliberada, não esquecimento.

O argumento a favor de manter: corrigir a redação de um controle aposentado não reescreve
histórico — o histórico de verificações, transições e vínculos permanece imutável, e a edição é
auditada com valor anterior e posterior. O argumento contra: "aposentado" costuma significar
"congelado" para quem audita.

**Portão**: a Fase 4 (Auditoria e Achados) é quem tem a informação para decidir — é lá que um
auditor externo passa a ler controles descontinuados como prova. Decidir agora seria decidir sem o
consumidor real.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do coordenador:
verificar os três portões e fechar). Os três itens foram conferidos contra o código atual, não
contra a redação original — os três portões já foram cumpridos:

1. **`ControlRegistryPort.list()`** — não ficou apenas sem chamador, foi **removido por inteiro**.
   `find apps/api/src -iname "*control-registry*"` não encontra nenhum arquivo; `grep -rn "class
   ControlRegistryPort" apps/api/src` não encontra nenhuma declaração. Foi substituído por
   `ControlDirectoryPort` (`apps/api/src/shared/grc-ports/control-directory.port.ts`), cujo
   cabeçalho (linhas 32-46) documenta que `LinkControlUseCase` passou a resolver o controle por
   esta porta nova — "not `ControlRegistryPort`, which never carried `orgUnitId` at all" — no
   mesmo trabalho que fechou **F-46** (mesmo registro, RESOLVIDO 2026-09-08), embora aquele
   registro não cite F-44 pelo nome. Código morto zero, não apenas o método órfão.
2. **`SELECT` duplicado entre `ControlLookupPort` e `ControlRepositoryPort`** —
   `apps/api/src/modules/controls/infrastructure/control-scoped-repository.ts:31-39` mostra a
   decisão real tomada: `findOrgUnitIdUnscoped` foi consolidado em **um único lugar**
   (`ControlScopedRepository`, a base comum das duas implementações concretas), com o cabeçalho do
   arquivo (linhas 9-19) documentando que a fusão dos dois PORTOS em si foi **rejeitada
   deliberadamente** — "the narrow lookup must never start paying for `ControlRepositoryPort`'s
   full aggregate read plus an effectiveness computation on every scope check". Confirmado que
   nenhuma das duas classes concretas reimplementa o método:
   `control-lookup.repository.ts:61` e `control.repository.ts:102` têm ambas o mesmo comentário
   apontando para a implementação única na base. A duplicação que o achado media (a mesma consulta
   escrita duas vezes) não existe mais — resolvida por composição, não por fusão dos portos, que é
   uma resposta válida e mais estreita ao mesmo problema.
3. **Controle `RETIRED` aceita edição de campos descritivos** — a Fase 4 (`005-audit-findings`), o
   consumidor nomeado pelo próprio portão, já teve essa informação na mesa ao desenhar o escopo de
   engajamento de auditoria: `specs/005-audit-findings/research.md:44-46` registra como fato
   verificado no código, não presumido, que "`Control` não tem essa imutabilidade — nome, descrição,
   dono e demais campos descritivos são editáveis durante toda a vida operacional do controle,
   independente de status" — e a decisão registrada em seguida (D-2) resolve o problema sem exigir
   que `Control` congele: o escopo do engajamento aponta para a linha imutável
   (`FrameworkVersion`/`Requirement`), nunca para o conceito mutável, precisamente PORQUE Controle
   pode mudar. `apps/api/src/modules/controls/application/update-control.usecase.ts:9-18` continua
   sem trava de status, com sua própria justificativa (CLAUDE.md §2, não implementar o que a
   especificação não pede). O consumidor real leu o problema e decidiu não travar Controle — uma
   decisão tomada com informação, que é exatamente o que este portão exigia, não uma omissão.

Nenhuma mudança de código nesta rodada — os três portões já tinham sido atravessados por trabalho
anterior; só o cabeçalho deste registro nunca foi atualizado.

## F-45 — RESOLVIDO (issue 2 corrigida na raiz em 2026-09-18; issue 1 corrigida em 2026-09-19, rodada 023, Lote C) — Two pre-existing cross-file races in the shared contract/integration test database, exposed (not caused) by a longer test run

**Registrada**: 2026-09-08, ao fechar o backend do módulo de Compliance (Fase 4/5,
004-compliance-management, T032-T057).

> **Causa corrigida em 2026-09-08.** A redação original dizia que "a suíte de contrato roda todos
> os arquivos de teste em paralelo (Vitest, sem `fileParallelism: false`)". **Isso é falso**:
> `apps/api/vitest.contract.config.ts` define `fileParallelism: false` **e**
> `poolOptions.forks.singleFork: true` desde que foi criado. A suíte é sequencial, num único fork.
>
> A distinção não é acadêmica: uma corrida se resolve serializando — o que já estava feito — e
> essa leitura teria mandado o próximo leitor "consertar" algo que já era verdade. O problema real
> é **contaminação de estado entre arquivos**, dependente de ordem e não de concorrência: cada
> arquivo grava no mesmo banco, truncado uma única vez no início da execução inteira e nunca entre
> arquivos, e asserções que comparam listas globais inteiras ou presumem que uma linha cai na
> primeira página começam a falhar conforme a execução cresce.
>
> É a terceira causa registrada errada encontrada nesta sessão. As três tinham a mesma forma:
> plausíveis, escritas com confiança, nunca reexecutadas contra a realidade.

A suíte de contrato roda todos os arquivos **sequencialmente, num único fork**, contra o **mesmo**
banco de teste, truncado uma única vez no início da execução inteira
(`test/integration/support/global-setup.ts`) — nunca entre arquivos. Duas asserções pré-existentes,
em arquivos que este trabalho não tocou, assumem implicitamente que nenhum outro arquivo grava nas
mesmas tabelas globais durante a mesma execução. Isso já era falso antes desta entrega; só não
havia se manifestado.

### 1. `test/contract/reference-data.spec.ts` — `GET /risk-categories` compara a lista inteira

A asserção `expect(body.map((item) => item.id)).toEqual(activeIds)` espera que a resposta contenha
**exatamente** as duas categorias que o próprio `beforeAll` criou — mas nove outros arquivos
(`dashboard.spec.ts`, `risk-audit.spec.ts`, `risk-history.spec.ts`, `risk-immutability.spec.ts`,
`risk-lifecycle.spec.ts`, `information-disclosure.spec.ts`, mais três em `test/integration/`)
também criam `RiskCategory` ativa, na mesma tabela nunca truncada entre arquivos. O comentário de
cabeçalho do próprio arquivo ("no other spec file in this suite touches these three tables,
verified by grep") já estava desatualizado quando escrito — pelo menos `information-disclosure.spec.ts`
já criava uma `RiskCategory` própria antes desta entrega.

### 2. `test/contract/information-disclosure.spec.ts` — o padrão de "token de sessão bruto" colide com um código de unidade organizacional de outro arquivo

O padrão `RAW_SESSION_TOKEN` (`/^[A-Za-z0-9_-]{43}$/`) existe para pegar um token de sessão
vazado, mas `uniqueTestMarker(prefix)` produz `${prefix}-${randomUUID()}` — e dois arquivos
completamente alheios a Compliance, `attachment-validation.spec.ts` (`uniqueTestMarker('av-org')`)
e `permission-invalidation.spec.ts` (`uniqueTestMarker('pi-org')`), usam um prefixo de exatamente
dois caracteres, produzindo `"av-org-" + uuid`/`"pi-org-" + uuid` = exatamente 43 caracteres do
alfabeto base64url — uma colisão estrutural com o padrão, não um vazamento real. O sweep
`AdminOrgUnitsController_list` lista unidades organizacionais **de toda a plataforma**, sem filtro
por arquivo, então a colisão aparece sempre que esse `GET` roda depois que aquelas fixtures já
existem no banco compartilhado.

### Por que isto apareceu agora

Nenhuma das duas falhas depende de código de Compliance: nenhuma tabela ou lógica que este trabalho
escreveu tem relação com `risk_categories` ou `organizational_units`. O que mudou foi o tempo de
execução — `information-disclosure.spec.ts` ganhou doze novas chamadas de sweep (operações 10,
12, 14-23) e um arquivo de contrato novo (`compliance-mapping-and-state.spec.ts`) passou a rodar
na mesma leva — deslocando o intervalo em que os workers paralelos se sobrepõem o suficiente para
que as duas colisões pré-existentes, sempre estruturalmente possíveis, realmente se manifestem.
Confirmado por reexecução: a suíte inteira passa (521/521) em algumas execuções e falha
nessas duas asserções em outras, sem nenhuma mudança de código entre uma tentativa e outra —
exatamente a assinatura de uma corrida de dados compartilhados, não de uma regressão funcional.

**Por que não foi corrigido aqui**: as duas asserções pertencem a arquivos de Risco/Administração
fora do escopo desta tarefa, e CLAUDE.md §14 pede mudanças pequenas e coesas — não alterações não
relacionadas dentro de uma entrega de Compliance. Corrigir a causa raiz (isolamento real por
arquivo, ou geração de marcador que nunca produza 43 caracteres, ou uma asserção que filtre pelos
próprios ids criados em vez de comparar a resposta inteira) é trabalho de teste, não de produto, e
toca arquivos que times diferentes possuem.

**Portão**: a próxima tarefa que tocar `test/contract/reference-data.spec.ts` ou
`test/contract/information-disclosure.spec.ts` deveria: (a) em `reference-data.spec.ts`, filtrar a
resposta pelos ids que o próprio teste criou em vez de comparar a lista inteira; (b) em
`uniqueTestMarker`, ou nos dois arquivos que usam prefixo de 2 caracteres, evitar produzir
exatamente 43 caracteres — ou tornar o padrão de detecção sensível a contexto (como já feito para
`checksumSha256`) em vez de a um comprimento de string coincidente.

**Non-blocking**: nenhuma das duas é uma falha de segurança real nem uma regressão de Risco ou
Controles — é fragilidade de isolamento entre arquivos de teste, sensível ao tempo total da
execução. Reportado por exigência de CLAUDE.md §13.9/SC-006 ("investigar, nunca ajustar"), não
corrigido por estar fora do escopo desta entrega.

### Nota (2026-09-14, `be6b734`) — instâncias corrigidas, classe continua aberta

`uniqueTestMarker(p)` produz `p.length + 37` caracteres: um prefixo de **seis** caracteres produz
exatamente 43, colidindo com `RAW_SESSION_TOKEN`. Dez sítios de chamada sob `apps/api/test` estavam
sobre esse número (confirmado por diff: `au-org`→`adm-org`, `au-dup`→`adm-dup`, `at-org`→`att-org`,
`cm-org`→`cmt-org`, `fix-f2`→`fix-f02` em dois arquivos, `av-org`→`aval-org`, `draft2`→`draft-2`,
`io-inc`→`iop-inc`, `io-prb`→`iop-prb`, `pi-org`→`perm-org`). Os dez prefixos foram alongados para
sete ou oito caracteres.

**Dito às claras, como o próprio commit registra**: o flake **não reproduziu** durante a medição —
três execuções de contrato antes da mudança deram verde, três depois deram verde, então a taxa de
sucesso não mostra melhora nenhuma e nenhuma vitória de taxa está sendo reivindicada aqui. A
justificativa é que o gatilho é **determinístico**, não probabilístico — a colisão depende do
comprimento do prefixo, não de tempo — e o histórico registrado de disparo (F-45 original, F-54).

**A classe continua aberta.** O diff de `be6b734` toca apenas os dez arquivos de teste que usavam um
prefixo problemático — `test/contract/support/...` (onde `uniqueTestMarker` é implementado) e o
padrão `RAW_SESSION_TOKEN` em `information-disclosure.spec.ts` **não foram tocados**. Nenhuma guarda
estrutural foi acrescentada. O próximo prefixo novo de exatamente seis caracteres, em qualquer
arquivo futuro, reproduz a colisão — exatamente como F-54 já havia demonstrado ser o padrão depois da
"correção" original de F-45. O portão continua sendo o mesmo (b) já registrado acima: tornar
`uniqueTestMarker` incapaz de emitir 43 caracteres, ou tornar `RAW_SESSION_TOKEN` sensível a
contexto. Ver F-54 para o histórico de recorrência.

### Issue 2 (colisão de marcador) — RESOLVIDO NA RAIZ, 2026-09-18 (rodada 023, saneamento de findings)

Exatamente o portão (b) que esta entrada — e a nota de `be6b734` acima — vinham pedindo desde
2026-09-08. `apps/api/test/integration/support/env.ts`'s `uniqueTestMarker` agora garante
estruturalmente que o total nunca seja 43 caracteres: se `${prefix}-${randomUUID()}` chegar a 43,
um caractere extra é acrescentado. Isso torna a colisão impossível para **qualquer** comprimento de
prefixo, para sempre — não mais um remendo por instância (dez sítios em `be6b734`, quatro prefixos
nesta e em F-54). Regressão completa: suíte de contrato 58 arquivos/827 testes, suíte de integração
59 arquivos/297 testes, ambas verdes, incluindo `information-disclosure.spec.ts` especificamente.
Commit local `84253f7` (branch `023-detail-nav-performance`, ainda sem push).

### Issue 1 (comparação de lista inteira) — RESOLVIDA, 2026-09-19 (rodada 023, saneamento de findings, Lote C)

Exatamente o portão que esta entrada vinha pedindo desde 2026-09-08. As três ocorrências de
`expect(body.map((item) => item.id)).toEqual(activeIds)` em `test/contract/reference-data.spec.ts`
(uma por bloco `describe` — categorias, tipos, origens) foram substituídas por uma função
compartilhada, `expectOwnActiveIdsInSortOrder(body, ownActiveIds)`: filtra a resposta pelos ids que
o próprio bloco criou (`body.map(...).filter((id) => ownActiveIds.includes(id))`) e compara esse
subconjunto, na ordem em que a resposta os devolveu, contra `ownActiveIds`.

**Por que isto prova exatamente o que a asserção original provava, sem enfraquecer nada**: as duas
garantias do texto do teste ("retorna exatamente as categorias ativas... em ordem de `sortOrder`")
continuam verificadas — se uma das duas linhas do próprio teste estivesse ausente da resposta, o
`.filter()` produziria um array mais curto, e a comparação falharia; se as duas estivessem fora de
ordem relativa, `.filter()` preserva a ordem da resposta, então a comparação também falharia. O que
deixou de ser assumido é a exclusividade da tabela inteira — nunca uma garantia real do contrato ou
do código, só um acidente de quando o teste foi escrito sozinho.

**Prova de que o defeito era real, não hipotético — medida nos dois sentidos, não presumida**: o
`beforeAll` de `GET /risk-categories` ganhou uma linha ativa adicional, deliberadamente não
pertencente ao teste (`Categoria de outro arquivo (ruído deliberado)`), simulando exatamente o que
os outros nove arquivos já fazem numa execução completa. Revertendo temporariamente a asserção para
a forma antiga (`toEqual` contra a lista inteira) e rodando o arquivo: **falha**, com o erro
`AssertionError: expected [...3 itens] to deeply equal [...2 itens]` — reproduzindo ao vivo a classe
exata de falha que este achado descreve. Com `expectOwnActiveIdsInSortOrder`: **10/10 testes
passam**, incluindo esse cenário com ruído. A reversão foi só para a verificação; o arquivo ficou
com a correção.

`pnpm --filter @pharos/api run typecheck` limpo.

## F-46 — RESOLVIDO (2026-09-08) — Risk→Control link never checked the referenced control's organizational scope (ADR-020 part 4, Risk→Control direction)

**Found**: 2026-09-08, closing the ADR-020 part 5 security gap (`control:view` not enforced on the
referenced side of `Risk→Control`/`Compliance→Control` links).

**What it was**: `LinkControlUseCase`
(`apps/api/src/modules/risk/application/links/control-link.usecase.ts`) resolved the referenced
control via `ControlRegistryPort.findById` — a lookup that never carried `orgUnitId` at all — and
checked only that the control existed, was active, and (after the part-5 fix) that the actor held
`control:view`. It never compared the control's organizational unit against the actor's resolved
scope. Concretely: an actor holding `risk:treat` and `control:view`, scoped to unit A, could link a
risk in unit A to a control belonging to a **different** unit B — a control they could not
otherwise read the detail of via `GET /controls/{id}` (itself scope-checked). `GET
/risks/{riskId}/controls` would then hand that actor B's control id, code and name: a scope leak,
because a valid identifier is information. `shared/grc-ports/control-directory.port.ts` had
documented the gap precisely for a long stretch — the port carried `orgUnitId` for exactly this
future check, and stated plainly that `LinkControlUseCase` never consulted it.

This was not the same gap the 2026-09-08 part-5 task closed: `control:view` (can the actor see
controls of this KIND at all) and organizational scope (can the actor see THIS control) are
independent axes, exactly like every other scoped resource in this platform (ADR-004). That task
closed the permission axis for both link directions and closed the scope axis for
`Compliance→Control` (`LinkRequirementToControlUseCase`'s own `isControlWithinScope` check), but
left `Risk→Control`'s scope axis open — named here as F-46 so it would not be forgotten.

**What closed it**: `LinkControlUseCase` now resolves the control through `ControlDirectoryPort`
directly (not `ControlRegistryPort`, which never exposed `orgUnitId` and is left bound/unused
rather than deleted, reported per §19.10) and checks `control.orgUnitId` against the actor's
resolved scope via the shared `isOrgUnitWithinScope` predicate
(`grc/shared/domain/org-scope.ts`) — the same building block `LinkRequirementToControlUseCase`'s
sibling checks already use elsewhere in the codebase, not a new helper. A control with
`orgUnitId: null` is treated as visible only to a `GLOBAL`-scoped actor, matching the Compliance
module's own null-handling exactly. The check runs BEFORE any write and is folded into the SAME
`ValidationDomainError`/message as "does not exist", "inactive" and "lacks `control:view`" — four
causes, one indistinguishable refusal, matching `LinkRequirementToControlUseCase`'s own shape
byte-for-byte.

`UnlinkControlUseCase` was deliberately NOT given the same check — the control behind a `linkId`
was already fully disclosed (id, code, name) by the very listing (`GET /risks/{riskId}/controls`,
`risk:view` only) the caller had to read to obtain that `linkId`, so there is no oracle left to
close on that path, and refusing unlink on scope would strand links an org restructuring later
moved out of scope. See `control-link.usecase.ts`'s own header for the full reasoning.

**Proof**: `test/integration/risk-control-link.spec.ts` — a new describe block covering an
out-of-scope control vs. a nonexistent control (same error, same `errors[]`, and a link-row count
asserted before AND after the rejected attempt, never only after), a `null`-`orgUnitId` control
refused for a UNIT-scoped actor, and an in-scope control succeeding. Existing fixtures in that
file, in `test/contract/risk-relationships.spec.ts` and in `test/contract/risk-detail.spec.ts` that
created controls with no `orgUnitId` and expected the link to succeed were updated to create the
control within the acting fixture's own organizational unit — they were passing only because the
check this finding describes was missing.

**Records corrected alongside this fix**: `specs/003-controls-management/research.md` D-4 (the
false claim that `modules/risk` "already" verified control scope before this refactor — corrected
in place, original claim kept visible) and `docs/architecture/decisions.md` ADR-020 (part 4's
addenda now hold for both link directions).

## F-47 — RESOLVIDO (2026-09-08) — `Table`'s scrollable wrapper had no keyboard access once its content genuinely overflowed

**Found**: 2026-09-08, T085 (005-audit-findings) — `e2e/accessibility.spec.ts` scanning the audit
engagement detail's new "Achados" tab (`EngagementFindingsSection`), waiting for a real, rendered
row before scanning per this file's own standing rule (F-28's lesson).

**What it was**: `apps/web/src/components/ui/table.tsx`'s `Table` primitive wraps its `<table>` in
a `<div data-slot="table-container" className="relative w-full overflow-x-auto">` with no
`tabIndex`. Axe's `scrollable-region-focusable` (WCAG 2.1.1/2.1.3, **serious**) flags exactly this
shape: a region that scrolls horizontally but has no focusable descendant and no `tabindex` of its
own is unreachable by keyboard alone. `EngagementFindingsSection`'s table (seven columns — Código,
Título, Categoria, Severidade, Prioridade, Status, Identificado em) is the first consumer of this
shared primitive wide enough to genuinely overflow a standard viewport; the other 15 call sites
across Risks, Controls, Compliance and Admin (`grep -rl "from '@/components/ui/table'"
apps/web/src`) never happened to overflow, so the same latent defect had gone undetected in all of
them — this is real and pre-existing, not something 005-audit-findings introduced, only the first
screen to surface it.

**What closed it**: `packages/design-system`'s own `DataTable` component had already found and
fixed the IDENTICAL defect in its own scroll wrapper (`tabIndex={0}`, that component's own
comment names the exact same axe rule). `Table` now carries the same one-line, already-proven fix
in the shared primitive itself, covering this call site and the other 15 at once, per this
project's own rule that a fix "generalizes to every call site sharing the vulnerable pattern"
(AGENTS.md, "Tests" — written for a security fix, the same principle applied here to an
accessibility one). Recorded in `docs/local-environment.md` D-15 as a fifth deliberately-modified
shadcn primitive.

**Proof**: `e2e/accessibility.spec.ts`'s new "Achados" tab scans (light and dark) — see T085,
`specs/005-audit-findings/tasks.md` — reproduced the violation against the code before this fix and
pass against the code after it.

## F-48 — RESOLVIDO (2026-09-19, rodada 023) — a suíte E2E completa não cabe no orçamento local de 20 tentativas de login por 5 min

**Encontrado**: 2026-09-08, ao validar T083–T085 (005-audit-findings) rodando
`npx playwright test --project=chromium` inteiro contra o ambiente local.

**Sintoma**: a suíte completa nunca termina verde localmente. O número de testes que passam varia
entre execuções (25 passaram/4 falharam/28 não rodaram; depois 4 passaram/40 não rodaram), e as
falhas trazem a mensagem enganosa de F-43 ("Neither the seeded nor the rotated password
authenticated") ou simplesmente não rodam. **Cada spec passa isolado** — verificado individualmente
para `risk-create`, `audit-engagement`, `audit-engagement-scope`, e a `accessibility.spec.ts`
inteira em série (38/38).

**Causa, medida e não suposta**: `apps/api/.env` define
`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=20` por `AUTH_RATE_LIMIT_WINDOW_SECONDS=300`, contados por
ORIGEM — e todo login da suíte vem da mesma origem. Uma execução completa gasta, no mínimo: 4
logins de administrador de worker (um por worker, `workers: E2E_ACCOUNTS_PER_PROJECT = 4`), mais
os `signInAsSeededUser`/`signInAsFixtureUser` não cacheados de `admin-access`,
`audit-engagement-scope`, `grc-foundation`, `risk-approval` e `risk-history`, mais os logins de
`auth.spec.ts` — que inclui **tentativas deliberadamente inválidas** (`GENERIC_SIGN_IN_ERROR`), e
tentativa inválida também conta no limite. O total fica em torno de 20: às vezes cabe, às vezes
não, e qualquer reexecução dentro dos mesmos 5 minutos estoura com certeza.

**Por que só aparece localmente**: `playwright.config.ts` usa `retries: process.env.CI ? 2 : 0`.
Em CI as duas retentativas mascaram o estouro; localmente, não há nenhuma.

**O que NÃO é**: não é defeito de produto, não é corrida entre workers (F-16, já resolvido com o
pool de contas por worker), e não é regressão de 005-audit-findings — as seis varreduras novas de
`accessibility.spec.ts` aproximaram o limite, mas a tensão existia com 19 testes e o mesmo
`beforeEach`.

**O que já foi feito** (2026-09-08, nesta mesma sessão): `signInAsWorkerAdmin`
(`e2e/support/admin-session.ts`) passou a cachear o `storageState` do worker após o PRIMEIRO login
real e restaurá-lo nas chamadas seguintes, com verificação e queda para login real se a sessão não
estiver viva. Isso tirou ~24 logins de `accessibility.spec.ts` sozinha (um por teste → um por
worker) e fez essa suíte passar 38/38 em série, onde antes falhava no 19º com 19 sem rodar. Também
tornou verdadeira a afirmação do próprio cabeçalho daquele arquivo — que já dizia "signed in once
in `beforeAll` ... reused rather than repeated" enquanto o código logava a cada teste.

**O que falta, e o portão**: os logins de `signInAsSeededUser`/`signInAsFixtureUser` continuam sem
cache, e `auth.spec.ts` legitimamente precisa de tentativas reais (é o spec que exerce a jornada de
autenticação). Duas saídas possíveis, nenhuma delas "aumentar o limite" — **rebaixar um controle de
segurança para um teste passar é exatamente o que o AGENTS.md proíbe**:

1. estender o mesmo cache por e-mail a `signInAsSeededUser`, deixando `auth.spec.ts` fora dele
   explicitamente; ou
2. isolar `auth.spec.ts` em um projeto Playwright próprio, com origem distinta, para que suas
   tentativas inválidas não consumam o orçamento das demais.

**Não bloqueia**: CI é verde, cada spec passa isolado, e a suíte de acessibilidade inteira passa em
série. Custa reexecuções locais e produz uma mensagem de falha que mente sobre a causa (F-43).

> **Aritmética corrigida, 2026-09-11** (007-implementation-remediation, Frente E — investigação, sem
> alteração de código). O parágrafo "Causa" acima soma tentativas de login BEM-SUCEDIDAS (os 4 logins
> de administrador de worker, os `signInAsSeededUser`/`signInAsFixtureUser` não cacheados) junto com
> as tentativas deliberadamente inválidas de `auth.spec.ts`, como se todas consumissem o orçamento de
> `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS`. **Isso não é o que o código faz.** Verificado diretamente em
> `apps/api/src/core/identity/application/login-throttle.service.ts`: só `recordFailedAttempt`
> (linha 141) chama `rateLimitCache.increment(originKey(...), ...)`. `recordSuccessfulAttempt` (linha
> 177) só grava o sucesso no `UserDirectoryPort` — nunca toca `rateLimitCache`. Um login bem-sucedido
> tem custo **zero** no contador de origem, sempre, para qualquer conta.
>
> O orçamento de 20 tentativas em 300s é consumido apenas por **tentativas que falham** — não por
> "todo login da suíte vindo da mesma origem" como o texto original diz. Numa execução contra um
> banco de teste recém-semeado (como a CI), os logins de worker-admin e de `signInAsSeededUser`
> nunca falham, então nunca tocam o contador — e é exatamente por isso que a CI nunca vê este
> problema, sem precisar da explicação de `retries` que o texto original dá (essa explicação
> permanece verdadeira como segunda camada de proteção, mas não é a primeira). O que de fato
> consome o orçamento numa reexecução local: (1) as tentativas deliberadamente inválidas de
> `auth.spec.ts`; e (2) exatamente o cenário que **F-43** já nomeia — contra um banco de
> desenvolvimento de vida longa, onde uma execução anterior já rotacionou a senha semeada,
> `signInAsWorkerAdmin` tenta a senha semeada PRIMEIRO, ela falha (uma tentativa falha por worker,
> até 4), e só então tenta a senha rotacionada. Cada rodada de reexecução local soma essas falhas
> reais ao contador de origem; os logins bem-sucedidos ao redor delas nunca somaram nada.
>
> O sintoma registrado (a suíte nunca fecha verde localmente, F-43 mascarando a causa) permanece
> real e sem correção — só a explicação de POR QUE o orçamento estoura estava errada. O portão e as
> duas saídas propostas (cache por e-mail, ou isolar `auth.spec.ts` num projeto próprio) continuam
> válidos: ambos reduzem o número de tentativas que **falham**, que é a quantidade que realmente
> importa.

> **Atualização, 2026-09-11** (009-indicators-reports, Fase 7). O ambiente local desta sessão rodava
> `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`/`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` em `5`/`20` — os valores de
> **produção** — enquanto `.github/workflows/ci.yml` já eleva os dois para `200`/`1000` só no job de
> E2E, com um comentário próprio explicando por que (harness de login que sempre gasta uma tentativa
> falha, conta de worker reusada entre arquivos, todos os workers no mesmo IP de loopback). É
> exatamente essa diferença de configuração — não uma diferença de comportamento do produto — que faz
> este achado doer em ambiente local e nunca ter aparecido na CI. Detalhe completo, com os valores
> exatos e a citação do comentário da CI, em `docs/local-environment.md` **D-23**. Isto **não** é
> enfraquecimento de controle de segurança: os valores de produção em `.env.example` continuam
> `5`/`20`, intocados. Separadamente, **F-59** (novo, mesma sessão) documenta um segundo limitador —
> o `ThrottlerGuard` global de abuso, distinto deste — que também derruba jornadas E2E; os dois
> mecanismos coexistem e não devem ser confundidos.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do coordenador:
alinhar `.env.example` ao perfil que a CI já ratificou para este exato workload, em vez de
reaplicar D-23 manualmente a cada sessão). D-23 já tinha identificado a correção certa e já a
tinha aplicado — mas só ao processo em execução daquela sessão, nunca ao arquivo-modelo do
repositório, então ela nunca sobrevivia a um `git clone`, a um reinício de máquina ou a uma sessão
nova (a própria nota datada de 2026-09-14 em D-23 registra exatamente isso acontecendo de novo).
A correção agora está no lugar que sobrevive a todos os três: `.env.example`.

**O que mudou**: `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS` `5 → 200` e `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS`
`20 → 1000` em `.env.example` (raiz do repositório), com o comentário de cada variável reescrito
citando este achado e explicando o mecanismo (não é relaxamento de segurança — é o template de
desenvolvimento parar de ser mais restritivo que o perfil que `.github/workflows/ci.yml` já usa e
aprovou para os três jobs `test-e2e*`, linhas 723-725/961-963/1124-1126). `AUTH_RATE_LIMIT_WINDOW_SECONDS`
(`300`) e `THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS` (`100`/`60`) **não mudaram** — CI usa esses mesmos
valores em **todo** job, `test-e2e*` incluído (confirmado por leitura de
`.github/workflows/ci.yml`, seis blocos de ambiente, linhas 282-286/436-440/550-554/708-725/
956-963/1119-1126: só `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`/`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` divergem
entre o grupo `test-e2e*` e os demais; `THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS` são `100`/`60` nos
seis blocos, sem exceção) — não havia nada para alinhar ali, já estava alinhado.

**Produção não é tocada, verificado, não presumido**: `.env.example:9-11` já afirma, desde antes
desta rodada, que "In production every value is supplied by the deployment environment or a secret
manager, never by a checked-in file" — este arquivo nunca alimenta produção, então mudar seu
default é uma mudança de perfil de desenvolvimento pura. `env.schema.ts:126-127` só exige
`AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`/`ORIGIN_ATTEMPTS >= 1` e `ORIGIN_ATTEMPTS >= ACCOUNT_ATTEMPTS`
(linha 220) — `1000 >= 200` satisfaz a validação sem alteração de código.

**`docs/local-environment.md` D-23 atualizado no mesmo commit**: a nota datada de 2026-09-14
("D-23 não foi aplicado nesta máquina de referência... a variável não persiste entre máquinas,
reinícios ou sessões") deixa de descrever o estado atual — o default agora vem do próprio
`.env.example`. Uma nota nova documenta que um `.env` **já existente e gitignorado** (como o desta
mesma máquina, medido com `5`/`20` ainda hoje) não é tocado automaticamente por esta mudança —
só um novo `Copy-Item .env.example .env` (ou uma edição manual) recebe o novo default; isso é
esperado, o arquivo é intencionalmente não versionado, e o mesmo texto passou a valer para F-59
logo abaixo.

**Este é um achado fechado por reconciliação de registro, não por código novo em `apps/api`**:
nenhum comportamento do backend mudou — só o valor-modelo que um `.env` copiado passa a receber.

## F-49 — RESOLVIDO (2026-09-09) — Risk→Asset and Risk→Process never checked the referenced target's organizational scope, F-46's own two identical siblings

**Found**: 2026-09-08, `specs/006-assets-processes/spec.md`'s own "Contexto medido" — counted
directly against the repository: `isOrgUnitWithinScope` appeared 5 times in
`modules/risk/application/links/control-link.usecase.ts` (closed by F-46, same day) and **0** times
in `asset-link.usecase.ts`/`process-link.usecase.ts`, in the same directory.

**What it was**: `LinkAssetUseCase`/`LinkProcessUseCase` resolved the referenced asset/process
through `AssetRegistryPort`/`ProcessRegistryPort` — the Fase 1 minimal-registry lookup, which never
carried `orgUnitId` at all — and checked only `isActive`. An actor scoped to unit A could link a
risk in unit A to an asset or process belonging to unit B, and `GET /risks/{riskId}` would then hand
that actor B's asset/process id, code and name: the same "a valid identifier is information" leak
F-46 closed for `Risk→Control` the same day, left open here because `Asset`/`Process` had no owning
module yet to expose a scope-carrying port from (006-assets-processes' own precondition).

**What closed it** (006-assets-processes, Fase 5, T034/T035): once `modules/assets`/
`modules/processes` existed with `AssetDirectoryPort`/`ProcessDirectoryPort`
(`shared/grc-ports/`, ADR-020 part 3), `LinkAssetUseCase`/`LinkProcessUseCase` were switched to
resolve the target through those ports instead, and now check `orgUnitId` against the actor's
resolved scope via the same `isOrgUnitWithinScope` predicate `LinkControlUseCase` uses — byte-for-
byte the same null-handling (`orgUnitId === null` visible only to `GLOBAL` scope), folded into the
same `ValidationDomainError` as "does not exist"/"inactive". ADR-020 part 5 was also extended here:
creating either link now additionally requires `asset:view`/`process:view` on the referenced side —
permissions that did not exist before this fase, so this is not a fix to something that regressed,
it is the first point at which the requirement became satisfiable.

**Regression guard, generalized, not just re-proven for these two**: `test/unit/
link-usecase-target-scope-guard.spec.ts` (T040) fails if ANY `Link*UseCase` class in
`modules/risk/application/links/` or `modules/controls/application/links/` omits the
`isOrgUnitWithinScope` call — not only the two named here. Confirmed to fail, by name, against the
pre-fix state of `asset-link.usecase.ts`/`process-link.usecase.ts` before accepting it (AGENTS.md:
"generalizes to every call site sharing the vulnerable pattern, not only the reported instance").

**Extended to `LinkControlToAssetUseCase`/`LinkControlToProcessUseCase` as well, in the same
change — after this paragraph first said the opposite.**

The original text here argued the two `modules/controls` pairs should be deferred, because they
"already had the scope check" and adding `asset:view`/`process:view` there would be a separately
reviewed widening, outside T034/T035's named files.

That reasoning was **wrong, and it was wrong in a specific and recognisable way**: it is the same
reasoning that produced the defect this very finding is about. F-46 closed `Risco→Controle` and
left `Risco→Ativo` and `Risco→Processo` open — same directory, same day — because those were not
the files it named. Deferring the two `Controle→*` pairs here would have closed two siblings and
left two, for the second time, inside the feature written to correct the first time.

It also contradicted this feature's own design: `data-model.md` §10 lists `control:edit` +
`asset:view` for those pairs and explicitly flags the second as missing, so part 5 was a stated
requirement, not a widening.

Both were therefore closed in the same change, folded into the same single refusal so the four
pairs cannot diverge in shape. `link-usecase-target-scope-guard.spec.ts` gained a second
assertion covering **part 5** across every `Link*UseCase` in both modules, verified to fail
against the deferred state (it named `LinkControlToAssetUseCase`) before being accepted. A guard
covering only part 4 stayed green through the entire deferral.
## F-50 — RESOLVIDO (2026-09-10) — o gate `audit` da CI ficou vermelho por quatro advisories HIGH, um deles num caminho de execução real do produto

**Encontrado**: 2026-09-10, na CI que rodou depois do commit `e5cc72f`. Todos os outros jobs verdes;
`audit` vermelho, e `contract`, `integration` e os dois de E2E pulados por dependerem dele.

**Causa, medida e não suposta**: `pnpm audit --audit-level=high --ignore-registry-errors` saía com
código 1 por quatro advisories HIGH em duas dependências transitivas:

| Pacote | Versão | Caminho | Corrigido em |
|---|---|---|---|
| `multer` | 2.2.0 | `apps/api > @nestjs/platform-express > multer` | >= 2.3.0 |
| `js-yaml` | 4.3.1 | `packages/api-types > openapi-typescript > @redocly/openapi-core > js-yaml` | >= 4.3.2 |

Três dos quatro eram do `multer` (negação de serviço por nome de campo multipart, por vazamento de
descritor em upload abortado, e por índice de array excessivo). **Não era dependência só de
desenvolvimento**: `apps/api/src/core/files/presentation/attachment.controller.ts` usa
`FileInterceptor`, então é caminho alcançável por usuário autenticado.

**Por que subir o NestJS não resolvia**: verificado contra o registro npm, versão a versão.
`@nestjs/platform-express@11.2.3` fixa `multer` em `2.2.0` exato, e a mais recente publicada,
`12.0.1`, fixa **a mesma** `2.2.0`. Nenhuma release 11.x ou 12.x traz `multer` corrigido. Um upgrade
de major do framework teria sido mudança grande, arriscada, e não corrigiria o advisory.

**O que fechou**: dois `pnpm.overrides` no `package.json` da raiz — o mesmo mecanismo que o commit
`91aae4c` já usava para `postcss` e `deepmerge-ts`, e que é do mesmo commit que criou este gate
(T204). `multer` como override global, porque só existe um caminho na árvore.

**A decisão que não é óbvia**: `js-yaml` **não** foi fixado globalmente. `@nestjs/swagger@11.4.7`
fixa `js-yaml` em `5.3.0` exato — major diferente, **fora** da faixa vulnerável (`>=4.0.0 <4.3.2`).
Um override global teria rebaixado silenciosamente uma dependência de produção de 5.x para 4.x sem
nenhum ganho de segurança. Usada a sintaxe seletiva do pnpm, `"@redocly/openapi-core>js-yaml"`, que
corrige só o caminho vulnerável e deixa o `@nestjs/swagger` intocado.

**Evidência**: lockfile alterado em 22 linhas, tocando exatamente dois blocos de pacote
(`multer@2.2.0` → `2.3.0`; `js-yaml@4.3.1` removido por deduplicação para o `4.3.2` que a árvore já
resolvia). Audit passou a sair 0, com 2 advisories `moderate` restantes, abaixo do limiar do gate.
`test/contract/attachments.spec.ts` + `attachment-access.spec.ts` (17/17) e
`test/integration/attachment-validation.spec.ts` (4/4) confirmam que o comportamento de limite de
tamanho do multer sobreviveu ao bump — esse último exercita literalmente `limits.fileSize`.

**O que NÃO é**: não é defeito do produto, e não é falha de gate. O gate fez exatamente o que foi
construído para fazer, no primeiro advisory HIGH que apareceu depois de existir.

## F-51 — RESOLVIDO (2026-09-11) — três quickstarts de fases anteriores mandavam rodar um script de migração que não existe

**Encontrado**: 2026-09-10, validando a Fase 7 de 006-assets-processes.

**Sintoma**: `pnpm --filter @pharos/api run db:migrate:dev` falha com
`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`. Os scripts de banco que existem em `apps/api/package.json` são
`db:generate`, `db:migrate` (que é `prisma migrate dev`), `db:seed` e `db:seed:performance`.

**Onde**, sem corrigir:

- `specs/002-shared-grc-foundation/quickstart.md:14`
- `specs/003-controls-management/quickstart.md:14`
- `specs/005-audit-findings/quickstart.md:16`

`specs/006-assets-processes/quickstart.md:24` tinha a mesma linha e **foi corrigida** na fase que a
encontrou. `001` e `004` não têm o problema.

**Por que importa mais do que parece**: o `quickstart.md` é o roteiro de validação executável de uma
fase, e a primeira linha do §0 é a que um leitor novo roda primeiro. Ele falha de imediato, e a
mensagem do pnpm não sugere qual é o nome certo.

**Por que passou despercebido por quatro fases**: a validação manual de cada fase partiu de um banco
já migrado e, na prática, pulou o §0 — a mesma forma da lição do CLAUDE.md §18.1, agora aplicada à
documentação. Um roteiro só está verificado nas linhas que alguém realmente executou.

**Quem absorve**: a próxima tarefa que tocar em qualquer um desses três roteiros. Correção é de uma
linha por arquivo; foi deixada fora de 006 para não expandir o escopo daquela fase a documentos de
outras três.

> **RESOLVIDO, 2026-09-11** (007-implementation-remediation, Frente G), **e a linha de 006 citada
> acima como "corrigida" não estava — corrigida de novo agora.** Os três roteiros abertos aqui
> (`002`, `003`, `005`) foram corrigidos para
> `pnpm --filter @pharos/api exec prisma migrate deploy` (forma de implantação, aditiva, nunca
> `prisma migrate dev`). Verificado contra `schema.prisma:57-72`: esse arquivo proíbe explicitamente
> `db:migrate`/`prisma migrate dev` contra um banco real — exatamente o script que este achado já
> dizia existir (`db:migrate`, "que é `prisma migrate dev`"), e exatamente o script para o qual a
> correção de 006 apontava. **A "correção" de `006` que este achado credita não fechou o problema —
> trocou um script inexistente por um script existente e proibido.** `specs/006-assets-processes/quickstart.md:24`
> foi corrigida de novo, para a mesma forma `exec prisma migrate deploy`, com uma nota no próprio
> arquivo explicando o que havia de errado na correção anterior. Nenhum dos cinco roteiros de fase
> (`001`–`006`, exceto `004` que nunca teve o problema) hoje manda executar `prisma migrate dev`
> contra um banco real.
## F-52 — RESOLVIDO (2026-09-10) — o `beforeAll` da suíte de acessibilidade raspava o teto de 30s, e a falha ficou escondida atrás de um job pulado

**Encontrado**: 2026-09-10, na primeira execução da CI em que o job `test:e2e (chromium)` realmente
rodou nesta fase.

**Sintoma na CI**: `"beforeAll" hook timeout of 30000ms exceeded`, nas três tentativas
(`retries: 2`). Como o bloco está em `test.describe.configure({ mode: 'serial' })`, a falha do hook
derrubou o describe inteiro: `1 failed · 52 did not run · 25 passed`. O teste nomeado como "failed"
era só o primeiro da fila (`dashboard has no axe violations (light)`) — **nenhuma violação de
acessibilidade estava envolvida**.

**Causa, medida e não suposta**: o `beforeAll` dirige cerca de 15 submissões de formulário pela
interface real — risco, ativo, processo, dois vínculos, evidência, achado de risco, engajamento de
auditoria, escopo, início, achado do engajamento — porque é exatamente esse markup populado que as
varreduras axe precisam ver (F-28). Cronometrado nesta máquina: **27,16s contra o teto padrão de
30s, margem de 9%**. A T056 desta fase acrescentou o ativo, o processo e os dois vínculos a um hook
que já vinha raspando o limite. O log da CI mostra o estouro ainda dentro da criação da evidência,
ponto que a mesma execução local alcança por volta de 17s — a CI já estava ao menos 1,8x mais lenta
antes de começar o resto do trabalho.

**Por que só apareceu agora**: `test:e2e` depende do job `audit`, que estava vermelho desde antes
(F-50). Enquanto o `audit` falhava, `contract`, `integration` e os dois de E2E ficavam **pulados**.
O defeito estava latente desde a T056, mascarado por outra falha. É a mesma lição do §18.1 do
CLAUDE.md numa forma nova: um portão vermelho esconde o próximo portão.

**O que fechou**: `test.setTimeout(120_000)` dentro do próprio hook, com a medição e o raciocínio
do número escritos no comentário. **Orçamento de montagem de fixture, não asserção** — nenhuma
varredura axe, nenhuma regra e nenhuma expectativa mudou. Criação mais barata via `page.request`
foi considerada e rejeitada: é precisamente o markup renderizado pela interface que o axe precisa
varrer, e trocar a via arriscaria a garantia que o hook existe para dar.

**Verificação**: 56/56 no Chromium localmente, nenhum pulado, rodado pelo coordenador além do
agente.

## F-53 — RESOLVIDO (2026-09-11) — quatro contratos hand-authored divergiam da implementação real, achados por um validador de payload real, não por leitura

**Encontrado**: 2026-09-11, 007-implementation-remediation, Frente B (Contracts and types), ao
estender `packages/api-types` para os dez contratos e ligar um validador de payload real (Ajv
2020-12 + `ajv-formats`) em cima da suíte de contrato existente de 48 arquivos, em vez de escrever
168 requisições novas à mão. O validador envolve `res.json`/`res.send` de cada resposta HTTP real
contra o schema OpenAPI correspondente, por operação — nunca uma amostra construída à mão. Todos os
quatro achados abaixo vieram de resposta HTTP real divergindo do próprio contrato, verificado contra
o código de implementação antes de decidir qual lado corrigir (nenhum foi corrigido cegamente no
sentido "fazer o código bater com o contrato" ou vice-versa).

**Finding A — `FieldError.code` era obrigatório e nenhum caminho de erro jamais o populava.**
`specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`'s `FieldError` schema exigia
`code` desde sua introdução; `ValidationFieldError`
(`apps/api/src/shared/errors/domain-error.ts`) só carrega `field`/`message`, e o tipo de erro do
frontend nunca lê `code`. Relaxado para opcional — decidido como relaxamento do contrato, não como
implementação retroativa: uma taxonomia de código de validação por campo é capacidade futura real,
mas precisa de especificação própria e de um consumidor que precise dela, não uma linha que ninguém
lê hoje. Mesmo fix espelhado em `platform.openapi.yaml`.

**Finding B — um `EntityTypeQuery` compartilhado escondia que `/comments` e `/attachments` governam
dois registros diferentes.** `core/comments/domain/entity-registry.ts` já mantém
`registerCommentableEntityType`/`registerAttachableEntityType` como **dois registros
independentes por desenho** (o próprio `schema.prisma` comenta: "Risk is registered as both
attachable and commentable today, but a future module need not be both") — mas
`platform.openapi.yaml` descrevia os dois com um único `EntityType`/`EntityTypeQuery`
compartilhado, o que afirma implicitamente que todo tipo aceito por um é aceito pelo outro.
`EVIDENCE` é anexável, não comentável — a asserção era falsa para pelo menos um tipo real. Dividido
em `CommentableEntityType`/`AttachableEntityType` e seus `...Query` correspondentes, nomeados pelos
dois registros do próprio backend, não por conveniência — a correção mínima cogitada primeiro
(acrescentar `EVIDENCE` a um enum compartilhado) foi rejeitada por implicar algo falso do produto
(que comentários em Evidência seriam aceitos). `PROBE_RECORD` deliberadamente excluído de ambos os
novos schemas (resíduo permanente de F-22/F-23, nunca um tipo real).

**Finding C — `Permission.action` no contrato só tinha os nove verbos originais; o banco já tinha
onze.** `PermissionAction` (`schema.prisma`) ganhou `LINK`/`CLOSE` pela migração
`20260907085000_permission_action_add_grc_foundation` (002-shared-grc-foundation, ADR-008: "closed
platform enums grow by reviewed migration") — o schema OpenAPI nunca foi atualizado para
acompanhar. `admin.openapi.yaml`'s `Permission.action` enum estendido para os onze valores atuais,
citando a migração como fonte. O mesmo padrão de deriva que **F-24** já nomeou para lógica
duplicada, agora achado em um contrato: uma mudança aditiva e legítima no banco, e um documento
irmão que não foi convidado a acompanhar.

**Finding D — `Notification.body` era `string` não-nulo; a implementação sempre envia `null` quando
ausente.** `notification.service.ts`'s próprio `body?: string | undefined` na criação, e
`notification-response.mapper.ts`'s `body: record.body ?? null` na resposta — verificado
diretamente, não assumido. Corrigido para `type: [string, 'null']`, na mesma forma FR-017a já
adotada em `grc-foundation.openapi.yaml` (3.1 `type` array em vez de `nullable: true`).

**Por que registrado como achado e não só como diff silencioso**: os quatro passaram despercebidos
por um ou mais ciclos de fase inteiros porque nenhum gate os cobria — `openapi:check` (F-3) é
route-level, não contract-level, e nenhum teste de contrato validava o corpo real da resposta contra
o schema antes desta frente existir. O mecanismo que os achou (`apps/api/test/contract/support/
auto-validate-responses.ts`, `payload-validator.ts`, `openapi-documents.ts`) é permanente — mantido
como scaffolding de cobertura, não removido após esta rodada — e roda automaticamente contra os 48
arquivos de contrato existentes via um `afterEach` de módulo, sem precisar de edição em nenhum deles.

**Verificação**: 655/655 testes de contrato passando após as quatro correções, `packages/api-types`
regenerado sem diff pendente contra os dez contratos.

## F-54 — RESOLVIDO (2026-09-11) — a mesma colisão de marcador do F-45 reapareceu com prefixos novos, e o padrão de dois caracteres continua sem guarda

**Encontrado**: 2026-09-11, 007-implementation-remediation, Frente B, rodando a suíte de contrato
completa após ligar o validador automático de payload.

`uniqueTestMarker(prefix)` (`test/contract/support/...`) produz `${prefix}-${randomUUID()}` — 43
caracteres exatos quando `prefix` tem dois caracteres, colidindo estruturalmente com o padrão
`RAW_SESSION_TOKEN` (`/^[A-Za-z0-9_-]{43}$/`) que `information-disclosure.spec.ts` usa para pegar
um token de sessão vazado — exatamente o mecanismo que **F-45** já documentou para `av-org`/
`pi-org`. Esta sessão, arquivos de contrato novos usando os prefixos de dois caracteres `au-org`
(Audit) e `cm-org` (Compliance) produziram a mesma colisão de 43 caracteres, confirmando que **F-45
identificou uma classe de defeito, não uma instância isolada** — o padrão continua sem guarda
estrutural (nem no formato do marcador, nem na detecção do sweep), então qualquer prefixo novo de
exatamente dois caracteres reintroduz a colisão.

**Não corrigido na causa raiz aqui**: mesma razão que F-45 já registrou — a correção pertence a
`uniqueTestMarker`/ao padrão `RAW_SESSION_TOKEN`, arquivos fora do escopo desta frente
(`packages/api-types`, contratos e o harness de validação). Contornado localmente nos dois arquivos
novos apenas o suficiente para não produzir falso positivo nesta rodada.

**Por que "RESOLVIDO" e não "ABERTO" como F-45**: resolvido no sentido de **confirmado e registrado
como recorrência**, não no sentido de causa raiz corrigida — a causa raiz é a mesma de F-45, ainda
aberta lá. Este achado existe para que a próxima ocorrência (o próximo prefixo de dois caracteres)
não seja tratada como descoberta nova.

**Portão**: o mesmo de F-45 (b) — mudar `uniqueTestMarker` para nunca produzir exatamente 43
caracteres, ou tornar `RAW_SESSION_TOKEN` sensível a contexto — mas agora com quatro instâncias
confirmadas (`av-org`, `pi-org`, `au-org`, `cm-org`) em vez de duas, o que deveria pesar a favor de
corrigir a causa na próxima tarefa que tocar qualquer um dos dois arquivos, em vez de continuar
descobrindo instâncias uma de cada vez.

> **Nota (2026-09-14, `be6b734`)**: verificado que as duas instâncias que esta entrada registrou —
> `au-org` em Audit e `cm-org` em Compliance — já não existem mais sob esses nomes em
> `audit-engagements.spec.ts`/`compliance-mapping-and-state.spec.ts`; o contorno local que esta
> entrada já descrevia as removeu antes de 2026-09-14. `be6b734` alongou **outras duas** instâncias
> que coincidem no mesmo prefixo de dois caracteres por acaso, em arquivos sem relação com Audit ou
> Compliance: `au-org` em `apps/api/test/contract/admin-users.spec.ts` (de "admin **u**sers", não
> "**au**dit") → `adm-org`, e `cm-org` em `apps/api/test/contract/comments.spec.ts` (de
> "**c**o**m**ments", não "**c**o**m**pliance") → `cmt-org` (ver a nota datada em F-45 acima, que
> lista os dez sítios corrigidos na mesma sessão). Isto é exatamente a recorrência que esta entrada
> preveniu contra tratar como descoberta nova — a classe continua a mesma de F-45, ainda aberta.

> **A classe foi corrigida na raiz, 2026-09-18** (rodada 023, saneamento de findings): ver F-45,
> seção "Issue 2 — RESOLVIDO NA RAIZ" acima. `uniqueTestMarker` agora garante estruturalmente que o
> total nunca seja 43 caracteres, para qualquer prefixo — a recorrência que esta entrada existia para
> registrar não pode mais acontecer, seja qual for o próximo prefixo de dois OU seis caracteres que
> um arquivo futuro escolher.

## F-55 — RESOLVIDO (Controles já corrigido antes desta rodada; Compliance corrigido 2026-09-19, rodada 023) — Controles e Compliance nunca ganharam E2E ou varredura de acessibilidade próprios, ao contrário de todo módulo posterior

**Encontrado**: 2026-09-11, 007-implementation-remediation, Frente G, reconciliando
`specs/003-controls-management/tasks.md` e `specs/004-compliance-management/tasks.md` contra
evidência real (ver as notas datadas no topo de cada arquivo).

**Medido, não suposto**: `git show --stat 9912968` (fechamento de Controles) e `git show --stat
8f0452d` (fechamento de Compliance) não tocam nenhum arquivo em `apps/web/e2e/`. Confirmado também
pelo estado atual do diretório: nenhum spec ali (`admin-access`, `assets-processes`,
`audit-engagement`, `auth`, `grc-foundation`, `risk-*`, `smoke`, `accessibility`) tem um caminho
dedicado à página `/controls`, `/controls/{id}`, `/compliance` ou a qualquer uma das telas de
Compliance (biblioteca normativa, mapeamento, migração, aplicabilidade). `accessibility.spec.ts`
varre a aba "Controles vinculados" **embutida** em risco/ativo/processo (linhas 625, 854, 918) —
nunca o catálogo de Controles nem qualquer tela de Compliance isoladamente.

**Por que é notável**: toda fase de módulo de negócio posterior — Auditoria e Achados (005,
`STATE.md`, T083–T085) e Ativos e Processos (006, "E2E, escopo organizacional e acessibilidade nos
dois temas", CLAUDE.md §17 item 12) — entregou os três junto com o backend. Controles (item 9) e
Compliance (item 10) são as duas únicas fases de módulo de negócio no roteiro atual sem isso, e
CLAUDE.md §17 as lista como concluídas sem qualificar a lacuna. A captura renderizada manual (§18.1)
foi feita para Controles (`docs/reviews/ui/controls-{light,dark}/`) — não substitui verificação
automatizada repetível, apenas prova que a tela existiu naquele momento.

**Não é regressão silenciosa**: nenhuma das duas fases afirma ter entregue E2E ou axe para suas
próprias telas — a lacuna é honesta por omissão, não uma afirmação falsa como F-28/F-33 foram. O
problema é que CLAUDE.md §17 não distingue "concluído com os três pilares" de "concluído sem eles",
e um leitor razoável assume o padrão que as fases vizinhas estabeleceram.

**Owner**: quem próximo tocar `apps/web/e2e/` para Controles ou Compliance — não precisa ser uma
tarefa isolada; a forma mais barata é estender `audit-engagement-scope.spec.ts` (que já cria um
controle real via `/controls/new`) com as etapas restantes do ciclo de vida, e adicionar as telas de
Compliance à mesma bateria de `accessibility.spec.ts` que já cobre os demais módulos.

**Controles, resolvido antes desta rodada**: `apps/web/e2e/control-detail.spec.ts` já existe (E2E
completo de criação, seções, edição em overlay, ciclo de vida e verificação) e `accessibility.spec.ts`
já varre o catálogo de Controles isoladamente ("control catalog has no axe violations (light/dark)",
mais o painel de filtros) — confirmado presente ao ler o arquivo nesta rodada, antes de qualquer
mudança.

**Compliance, resolvido nesta rodada (2026-09-19, Lote A)**: a lacuna real que restava. Adicionado,
deliberadamente enxuto — a tela existe e é navegável, então é cobertura, não funcionalidade nova,
igual F-59/F-48 trataram atrito de ambiente, não regra de negócio:

- **`apps/web/e2e/compliance.spec.ts`** (novo) — E2E mínimo: cadastra um framework pela biblioteca
  normativa (`/compliance/new`), chega ao detalhe, confirma a aba "Versões" honestamente vazia
  ("Nenhuma versão cadastrada"), e confirma que o framework criado é encontrável de volta no
  registro pela sua busca por nome — não por posição na lista, porque este banco local já carrega
  dezenas de frameworks acumulados de sessões anteriores e o registro pagina por código ascendente
  por padrão (medido diretamente: as duas primeiras versões desta asserção, sem a busca e sem
  primeiro abrir a aba "Versões", falharam contra a aplicação real — "Nenhuma versão cadastrada" está
  atrás de uma aba separada, não sob "Visão geral"; e o framework novo cai na página 2 de 2, não na
  1). Versões, requisitos, migração de mapeamento e aplicabilidade — as telas mais profundas — ficam
  deliberadamente fora, na fila de revisão visual (§18.1), como o "Owner" original já antecipava.
- **`apps/web/e2e/accessibility.spec.ts`** — duas varreduras novas, no mesmo padrão de
  `waitForControlCatalogContent`: "compliance framework register has no axe violations (light/dark)".

**Verificação ao vivo, 2026-09-19** (servidores locais nativos, `:3001`/`:3000`, banco de
desenvolvimento existente, `--workers=1 --project=chromium`, senha rotacionada D-24):
`compliance.spec.ts` completo — **1/1 passou** (28.3s), depois de duas iterações que a aplicação
real corrigiu (a aba errada, depois a paginação); as duas novas varreduras de `accessibility.spec.ts`
(filtradas com `-g "compliance framework register"`) — **2/2 passaram** (1.3min), **zero violações
WCAG 2.1 AA** nos dois temas. `pnpm format:check`, `pnpm --filter @pharos/web run typecheck` e
`pnpm --filter @pharos/web run lint` limpos sobre os dois arquivos.

## F-56 — CORRIGIDO (2026-09-19, rodada 023, Lote C — decisão do coordenador, regra de corte por exposição real medida) — o padrão `Controller` do formulário compartilhado perde valor digitado antes da hidratação, e provavelmente em todo formulário que o usa, não só no login

**Encontrado**: 2026-09-11, corrigindo D-21 (`apps/web/e2e/support/admin-session.ts`) no formulário
de login (`apps/web/src/app/(public)/login/login-form.tsx`). Medido em navegador real, com CDP
(`Emulation.setCPUThrottlingRate`), não inferido do código.

**O defeito, reproduzido duas vezes por dois mecanismos distintos**: um valor digitado num campo
antes da hidratação terminar pode ser silenciosamente descartado no instante em que a hidratação
finalmente comete — sem qualquer sinal para quem digitou. Numa conexão ou dispositivo lento isto é
real, não só um artefato de timing de CI: as quatro capturas WebKit que D-21 cita mostram exatamente
isso, em navegador real (ainda que sob throttle).

1. **`Controller` (o `FormField` de `@/components/ui/form`, usado no resto do produto)** prende o
   `value` do DOM ao estado do React. Até a hidratação comitar, esse estado ainda é o default vazio,
   então o primeiro render controlado após a hidratação força o DOM de volta a `''`.
2. **`register(...)` do react-hook-form (a API "não controlada", baseada em ref) não é suficiente
   sozinha** — verificado por medição direta contra uma página com throttle, não por teoria:
   `register(name)` devolve uma nova identidade de função de `ref` a cada render, então o React
   desanexa e reanexa o `ref` do DOM a cada re-render do componente (não só na montagem) — e o
   callback de `ref` do react-hook-form, ao (re)anexar, escreve seu valor **internamente rastreado**
   de volta no nó do DOM, para suportar `setValue`/`reset()` programáticos. Como nenhum `onChange`
   havia chegado ao estado interno do react-hook-form ainda (nada estava ouvindo antes da
   hidratação), esse valor rastreado ainda é o default vazio — então o primeiro (re)anexo pós-
   hidratação sobrescreve o DOM do mesmo jeito que o caminho controlado, só que por um mecanismo
   diferente.

**A única fiação que sobrevive** é um `useRef` de objeto — estável entre renders, então o React
toca o DOM exatamente uma vez, na montagem, e nunca mais — combinada com ler o valor ao vivo do DOM
no momento do submit, em vez de confiar em qualquer cópia rastreada por framework. Nem `Controller`
nem `register` oferecem essa garantia. O formulário de login foi reescrito para usar essa fiação,
sem react-hook-form como intermediário, validando diretamente contra o mesmo `zodSchema`
(`loginSchema.safeParse`) — nada sobre como as credenciais são tratadas, transmitidas ou reportadas
mudou (FR-007 intacto).

**Por que isto é maior que o login**: qualquer formulário construído com o padrão `Controller` do
`FormField` compartilhado tem a mesma janela — login é o pior caso porque é o ponto de entrada frio
que todo mundo encontra primeiro (nunca há uma navegação client-side anterior que já tenha
hidratado o shell), mas qualquer página alcançada por link direto ou por atualização da página tem
a mesma exposição. Isto não foi auditado em nenhum outro formulário do produto — é uma hipótese bem
fundamentada a partir de dois mecanismos medidos, não uma varredura confirmada campo a campo.

**Não corrigido esta noite, deliberadamente**: o pipeline estava bloqueado e a máquina com pouco
espaço em disco quando isto foi encontrado; reescrever cada formulário do produto não estava no
escopo do trabalho de login e não deveria ser decidido sob essa pressão. Registrado aqui para que
quem pegar isto não precise redescobrir os dois mecanismos.

**Divergência introduzida, documentada aqui por completude**: o formulário de login agora é o único
formulário do produto que não usa a biblioteca de formulário compartilhada (`react-hook-form` +
`@/components/ui/form`) — usa `useRef` puro e valida contra o schema Zod diretamente. Isso é
divergência entre telas, e CLAUDE.md trata divergência não documentada como defeito (§18.3, §18.12).
A divergência é justificada pelo mecanismo #2 acima (nem `Controller` nem `register` resolvem o
problema que motivou a mudança), mas nenhum outro formulário foi migrado — login diverge sozinho até
que a decisão abaixo seja tomada.

**Owner**: decisão de arquitetura de frontend antes de qualquer correção em massa. Três caminhos,
para quem herdar isto não partir do zero:

- levar o padrão `useRef` + leitura direta do DOM no submit para o `FormField` compartilhado em si
  (ou para uma variante dele), tornando-o a wiring padrão de todo formulário e eliminando a
  divergência do login pela raiz — maior superfície de mudança, mas resolve a causa para o produto
  inteiro de uma vez;
- auditar cada formulário existente (Riscos, Controles, Compliance, Auditoria e Achados, Ativos e
  Processos, administração) medindo se a janela é alcançável na prática antes de decidir mudar
  algo — nem todo formulário é o ponto de entrada frio que o login é, e o custo de reescrever pode
  não valer a pena onde a janela nunca é exercitada por um usuário real;
- aceitar a divergência do login como caso especial permanente (é literalmente o único formulário
  pré-autenticação, então é o único que sempre recebe uma hidratação fria) e não estender a mudança
  a formulários que só são alcançados depois que o shell já hidratou uma vez.

Qualquer um dos três é uma decisão de produto/arquitetura, não uma correção mecânica — ver §14 e
§16.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote C). O coordenador tomou a
decisão que o "Owner" acima deixava em aberto, com uma regra de corte adicional que os três
caminhos originais não previam: **a exposição real depende de o campo estar interativo no instante
literal da hidratação, não só de a rota ser alcançável por URL direta.**

**Medição, campo a campo, antes de qualquer mudança de código**: toda tela `.../new` do produto
(dez rotas: `assets`, `audits`, `compliance`, `compliance/[frameworkId]/versions/new`, `controls`,
`incidents`, `problems`, `processes`, `reports`, `risks`) renderiza um formulário diretamente na
primeira pintura, mas isso sozinho não basta — o mecanismo do defeito exige que o usuário consiga
efetivamente digitar no campo durante a janela de hidratação, e um `<input disabled>` não aceita
teclado, em nenhum navegador.

- **Sete formulários** (`AssetForm`, `AuditEngagementForm`, `ControlForm`, `IncidentForm`,
  `ProblemForm`, `ProcessForm`, `RiskForm`) desabilitam **todo** campo — inclusive o campo de
  título/nome — via `disabled={submitting || loadingReferenceData}`, com `loadingReferenceData`
  começando `true` e só virando `false` depois de um `useEffect` (que só roda pós-hidratação) mais
  uma ida-e-volta de rede. Confirmado, campo a campo, que nenhum desses sete tem um único
  `<Input>`/`<Textarea>` fora dessa variável `disabled`. Na janela literal de hidratação esses
  campos estão desabilitados — o usuário não consegue digitar neles, então não há valor para a
  hidratação descartar. Não expostos.
- **`FrameworkVersionForm`** (`compliance/[frameworkId]/versions/new`) fica atrás de uma tela de
  carregamento inteira (`LoadingState`) até um `fetch` da própria versão terminar — o formulário
  nem monta antes disso. Não exposto, pelo mesmo raciocínio.
- **Dois formulários genuinamente expostos**: `FrameworkForm` (`/compliance/new`) e `ReportForm`
  (`/reports/new`) — nenhum dos dois tem qualquer gate de carregamento; `name`/`description` ficam
  habilitados desde o primeiro paint, exatamente como o login estava. Confirmado usando
  `form.register(...)`, o mesmo mecanismo #2 que o diagnóstico original mediu como insuficiente.

**Caminho seguido**: o segundo dos três originais ("auditar cada formulário existente... nem todo
formulário é o ponto de entrada frio que o login é"), com o resultado medido — 2 formulários
expostos, não ~10 — caindo dentro do critério do coordenador ("até ~10 rotas: aplique o padrão de
D-21 só nelas").

**Correção aplicada, idêntica ao padrão do login**: `apps/web/src/features/compliance/components/
framework-form.tsx` e `apps/web/src/features/reports/components/report-form.tsx` — `name`/
`description` migrados de `form.register(...)` para `useRef` puro (estável entre renders, o React
nunca reanexa), lidos diretamente do DOM no submit em vez de confiar no estado rastreado pelo
`react-hook-form`. Os demais campos (`origin`/`metricKeys`) permanecem em `Controller` sem
alteração — um `Select`/`Checkbox` Radix não pode ser operado antes do próprio JS hidratar, então
nunca estiveram expostos, e reescrevê-los só acrescentaria risco sem fechar nada. Erros de campo
para `name`/`description` passaram a um estado local (`fieldErrors`), já que deixaram de ser
rastreados pelo `react-hook-form`; erros do servidor (409/422/400) continuam distribuídos para o
campo certo, local ou via `form.setError`, sem perda de cobertura.

**Divergência do F-19/F-23 original reduzida, não eliminada**: o produto agora tem três formulários
fora do padrão compartilhado `Controller`/`FormField` (login, framework, report) em vez de um. A
mesma nota de divergência documentada (CLAUDE.md §18.3/§18.12) se aplica aos três — nenhuma
convenção nova, mesma wiring `useRef` + leitura direta do DOM que o login já usa.

**Teste que prova, mesma técnica do D-21 original**: `framework-form.test.tsx` e
`report-form.test.tsx` ganharam cada um um teste que define `.value` diretamente no nó do DOM
(contornando `fireEvent.change`, que despacha um evento sintético que o React observa e mascararia
exatamente este defeito) e confirma que o valor chega à chamada de criação — reproduzindo, em teste
de componente, a mesma classe de evidência que a auditoria original mediu em navegador real com
throttle de CPU. `pnpm --filter @pharos/web run test:unit` — **221 de 221 arquivos, 1474 de 1474
testes** (1472 + os 2 testes novos), sem nenhuma regressão. `typecheck`/`lint`/`format:check`
limpos.

**O que isto não fecha**: os sete formulários gated e o `FrameworkVersionForm` não foram tocados —
não precisavam, pela mesma medição acima, mas se algum deles algum dia perder seu gate de
carregamento (por exemplo, se `loadingReferenceData` passar a `false` por padrão numa refatoração
futura), a exposição volta a existir e este raciocínio precisa ser reaplicado a ele
especificamente. Não é uma auditoria que se mantém válida para sempre sem revisão.

## F-57 — RESOLVIDO (2026-09-19, rodada 023) — `pnpm audit` reporta 2 vulnerabilidades moderadas em `vitest`/`@vitest/mocker`, abaixo do limiar do portão

**Encontrado**: 2026-09-11, na bateria local desta sessão (reconstrução do ambiente após a árvore de
trabalho local anterior ter se corrompido numa transferência de SSD e o repositório ter sido
recuperado do GitHub).

**Sintoma, medido**: `pnpm audit --audit-level=high --ignore-registry-errors` sai com código 0 — o
mesmo comando e o mesmo limiar que o portão `audit` da CI usa — mas reporta 2 advisories `moderate`,
os dois do mesmo aviso: "Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock",
afetando `vitest` e `@vitest/mocker` nas versões `>=2.1.0 <4.1.11`.

**Impacto**: dependência de desenvolvimento apenas — `vitest`/`@vitest/mocker` são o test runner,
sem caminho de execução alcançável em produção, diferente do F-50 (`multer`, atrás de um
`FileInterceptor` real). Fica abaixo do limiar `--audit-level=high` do portão por desenho, então o
gate de CI continua verde quanto a isto.

**Por que não corrigido agora**: subir `vitest` atravessaria as suítes de unidade da API e da web (no
mínimo) num momento em que a CI remota está bloqueada por billing (F-58) e não pode confirmar a
mudança de forma automatizada. Decisão do coordenador: não introduzir uma variável nova de risco sem
a rede de segurança da CI disponível para reexecutar tudo. O risco prático de deixar a versão atual
por ora foi avaliado como baixo.

**O que resolveria**: subir `vitest` (e sua dependência `@vitest/mocker`) para `>= 4.1.11`, com a
suíte inteira reexecutada — typecheck, lint, unidade de API e de web, contrato, integração e E2E —
já que um bump do test runner pode mudar comportamento de mock/transformação em qualquer arquivo de
teste, não só nos que usam a funcionalidade do advisory.

**Owner**: a próxima tarefa que tocar `package.json`/dependências de teste, ou quando a CI remota for
restabelecida — o que vier primeiro.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, decisão do coordenador:
corrigir, já que existe versão publicada que fecha as duas vulnerabilidades). `apps/api/
package.json`: `vitest` `3.2.7 → 4.1.11` (o mínimo que satisfaz `>= 4.1.11`, sem saltar até `5.0.1`,
que `apps/web` já usa — `@vitest/mocker` é resolvido transitivamente pelo `vitest` novo, sem entrada
própria em `package.json`). `pnpm audit` depois da mudança: **"No known vulnerabilities found"**
— as duas moderadas fecharam.

**Efeito colateral do major bump, corrigido no mesmo commit**: Vitest 4 removeu `test.poolOptions`
inteiramente (aviso de depreciação confirmado ao rodar a suíte antes da correção: "`test.poolOptions`
was removed in Vitest 4. All previous `poolOptions` are now top-level options"). `apps/api/
vitest.integration.config.ts` e `apps/api/vitest.contract.config.ts` usavam
`poolOptions.forks.singleFork: true` deliberadamente, para garantir um único processo/conexão contra
o Postgres de teste compartilhado (comentário original do arquivo: "removes any need to reason about
connection-pool exhaustion or cross-file ordering races"). Substituído por `maxWorkers: 1` — o mapa
oficial de migração do Vitest 4 (`https://v4.vitest.dev/guide/migration`, "pool rework") documenta
`singleFork`/`singleThread` como equivalentes a `maxWorkers: 1, isolate: false`, mas os dois arquivos
usam **só** `maxWorkers: 1`, deliberadamente sem `isolate: false` — a garantia que este projeto
sempre precisou foi "um processo, uma conexão por vez", nunca "compartilhar registro de módulo entre
arquivos de teste", e `isolate: false` relaxaria uma garantia que ninguém pediu. Ambos os arquivos
ganharam um comentário citando este achado e explicando a distinção.

**Suíte inteira reexecutada, como o "O que resolveria" original pedia**:

- **Unidade da API**: 72 arquivos/743 testes, todos passando.
- **Integração**: 59 arquivos/297 testes, todos passando — confirma que `maxWorkers: 1` reproduz
  exatamente o comportamento de processo único que `singleFork` dava.
- **Contrato**: 58 arquivos/827 testes, todos passando, numa execução solo e limpa (uma execução
  concorrente acidental deste mesmo agente, contra o mesmo banco, produziu 3 falhas espúrias em
  `reference-data.spec.ts` por colisão de dados entre as duas execuções — descartada, não é evidência
  desta correção; a execução solo é a que conta).
- **`typecheck`/`lint`** (raiz): limpos, sem erro nem aviso, nos quatro workspaces.
- **E2E**: não faz parte deste achado — `apps/web` já estava em `vitest@5.0.0`, não tocado por esta
  mudança, e Playwright é a ferramenta de E2E, não Vitest.

**Owner original ("quando a CI remota for restabelecida") não bloqueou esta correção**: F-58 (CI
bloqueada por billing) segue em aberto, mas a bateria local completa acima é evidência equivalente,
na mesma linha que F-58 já registra como aceitável enquanto o bloqueio externo persiste.

## F-58 — BLOQUEADO (externo) — CI remota falha por bloqueio de billing do GitHub, não por defeito de código; seis commits nunca foram verificados por CI

**Encontrado**: 2026-09-11, investigando por que as execuções mais recentes de CI apareciam
vermelhas.

**Sintoma, medido**: `gh run list` e a API de anotações do GitHub mostram que as três runs mais
recentes falharam todas com a MESMA anotação literal, no job `install (pnpm cache)`, em 1 a 2
segundos, com todos os demais jobs `skipped`:

> "The job was not started because recent account payments have failed or your spending limit needs
> to be increased. Please check the 'Billing & plans' section in your settings"

| Run | Commit | Evento | Resultado |
|---|---|---|---|
| `34632387285` | `795343b` | push | falha por billing |
| `34629248303` | `2a39b52` | push | falha por billing |
| `34621583173` | `44e1e04` | push | falha por billing |

A última run verde conhecida é `34615908956`, commit `4b18978`, evento `push`.

**Consequência**: os commits `d1bc2cb`, `44e1e04`, `19d73f7`, `6267cff`, `2a39b52` e `795343b` nunca
foram verificados por CI — nenhum deles tem uma execução de CI bem-sucedida contra si.

**Por que isto não é um defeito de código e não autoriza parar o desenvolvimento**: a falha ocorre
antes de qualquer job de verificação começar (o próprio job `install` nunca chega a instalar nada) e
é idêntica, palavra por palavra, nas três runs — não há variação que sugira causa técnica no
repositório. É bloqueio externo, exige ação humana (pagamento ou aumento do limite de gasto na conta
de billing do GitHub) e nenhuma mudança de código ou configuração deste repositório o resolve.

**O que substitui a evidência de CI enquanto o bloqueio persistir**: a bateria local completa
executada nesta mesma sessão — audit, format:check, typecheck, lint, unidade de API e de web,
openapi:check, api-types:check, integração e build (API, web, `api-types`, design system), todos
verificados passando, mais contrato, onde uma falha real foi encontrada e está em correção por outro
agente (ver `specs/008-incidents-problems/STATE.md` §11.6). Bateria local não é substituto perfeito de
CI — não cobriu E2E nesta rodada — mas é a evidência disponível enquanto a CI remota não roda.

**Owner**: quem tiver acesso à conta de billing do GitHub do projeto. Nenhuma ação de código resolve
isto.

## F-59 — RESOLVIDO (2026-09-19, rodada 023 — decisão de configuração formalizada) — o limitador global de requisições da API (`ThrottlerGuard`) derruba jornadas E2E longas, distinto do limitador de login que F-48 já documenta

**Encontrado**: 2026-09-11, rodando `apps/web/e2e/audit-engagement.spec.ts` isoladamente, com captura
de rede real (`page.on('response')` temporário, depois revertido). Reproduzido 3 de 3 vezes.

**Sintoma, medido**:

1. `POST /api/v1/findings/{findingId}/controls` → **201**, vínculo criado corretamente.
2. O refetch imediato `GET /api/v1/findings/{findingId}/controls?includeWithdrawn=false` → **429**,
   corpo RFC 9457 com `"type": "https://pharosgrc.dev/problems/http-429"`,
   `"title": "Muitas requisições"`, `"detail": "ThrottlerException: Too Many Requests"`.

Com quatro workers Playwright em paralelo, a suíte completa de Chromium terminou em **20 aprovados, 9
falhas, 88 não executados**. A maior parte das falhas tem sintoma consistente com o mesmo mecanismo:
timeout de navegação, `beforeAll` estourando, `signOut` nunca encontrando o menu da conta — tudo
compatível com respostas 429 em `GET /auth/session` e rotas equivalentes.

**Causa**: o `ThrottlerGuard` **global** (`APP_GUARD` em `apps/api/src/app.module.ts`), configurado
por `THROTTLE_LIMIT=100` e `THROTTLE_TTL_SECONDS=60`. A contagem é por cliente (IP), não por worker —
todos os workers de Playwright rodando na mesma máquina competem pelo mesmo teto. Uma única jornada
longa, sozinha, já estoura o teto; com paralelismo, o problema se agrava.

**Distinção explícita de F-48**: este é um achado **diferente** do limitador de login que F-48
documenta. F-48 trata de `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS`/`AUTH_RATE_LIMIT_WINDOW_SECONDS`
(tentativas de autenticação, por origem). Este achado é o `ThrottlerGuard` genérico de abuso, aplicado
a **toda rota** da API, e sua manifestação aqui é em rotas de leitura/escrita fora de login (achados,
controles). Não é reabertura de F-48 — é um segundo mecanismo de limitação com o mesmo tipo de
sintoma (429 durante E2E).

**Por que importa**: o mecanismo, sozinho, já é suficiente para explicar boa parte das 9 falhas e das
88 tarefas não executadas na bateria E2E desta sessão (ver `specs/009-indicators-reports/STATE.md`),
sem precisar presumir defeito de produto em cada teste que falhou.

**O que NÃO foi feito, e por quê**: `THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS` **não foram alterados**. É
controle de segurança contra abuso, e a regra do projeto proíbe enfraquecer um controle de segurança
só para fazer um teste passar (CLAUDE.md §12, mesmo princípio que F-48 já respeita para o limitador de
login). Os cabeçalhos da resposta 429 (`Retry-After`, `RateLimit-*`) **não foram capturados** — o
logger temporário usado para esta investigação só lia status e corpo da resposta. Registrado como NÃO
VERIFICADO: para confirmar o comportamento completo (e uma eventual janela de retentativa), seria
preciso reproduzir com um interceptor que também leia esses cabeçalhos.

**Opções possíveis, nenhuma decidida** — decisão de configuração de ambiente de teste, em aberto:

1. elevar o teto do `ThrottlerGuard` apenas no ambiente de E2E, como a CI já faz para o limitador de
   login (ver `docs/local-environment.md` D-23);
2. isentar rotas de leitura (`GET`) do limitador global;
3. reduzir o volume de requisições que uma única jornada E2E emite (menos refetches redundantes).

**Owner**: quem retomar a estabilização da suíte E2E completa — a mesma frente que já possui F-48.

**Atualização — 2026-09-12, fechamento da Fase 7 (`009-indicators-reports`), commit `d31e140`**:
evidência nova, que confirma o mecanismo acima como suficiente para derrubar a suíte completa em
paralelo neste banco, e estabelece uma mitigação verificada. Texto original acima preservado sem
alteração.

**Três execuções, medidas pelo coordenador em série**:

1. **4 trabalhadores (o padrão), contra servidor de desenvolvimento**: 23 aprovados, 96 não
   executados.
2. **4 trabalhadores, contra build de produção**: 10 aprovados, 105 não executados. Esta execução
   testou — e desmentiu — a hipótese de que o modo de desenvolvimento agravava o problema por
   dobrar chamadas via reexecução de efeito: o resultado piorou contra produção, não melhorou.
3. **1 trabalhador, mesmo build de produção**: **129 de 129, sem nenhuma falha**.

**Causa, confirmada por log da API, não por suposição**: o mesmo `ThrottlerGuard` global
(`THROTTLE_LIMIT=100` por `THROTTLE_TTL_SECONDS=60`, por IP) recusava com **429** — inclusive as
tentativas de **login**, o que produzia o sintoma enganoso de testes voltando à tela de entrada com
"esperado `/dashboard`, recebido `/login`" (a mesma classe de sintoma que F-43 documenta para o
limitador de autenticação, mecanismo diferente). O log da API registrou milhares de
`ThrottlerException` durante as execuções paralelas.

**Por que a CI passa com o mesmo limite, e este ambiente local não passava**: este banco de
desenvolvimento carrega dados acumulados de todas as sessões de trabalho (cerca de 200 riscos, mais
de 100 usuários), e o harness de E2E pagina até encontrar o que procura — a mesma condição de fundo
que `docs/local-environment.md` D-20 já registrou para a busca de papéis. Num banco recém-semeado
como o da CI, a mesma jornada emite uma fração das requisições que emite aqui, e por isso nunca se
aproxima do teto de 100/60s.

**Decisão do coordenador**: `THROTTLE_LIMIT` continua **não alterado**. A CI mantém esse valor em
100 para o próprio job de E2E, então elevá-lo localmente seria **divergir** dela, não igualá-la —
ao contrário do limitador de autenticação, onde a CI declara valores próprios de job e o ambiente
local passou a reproduzi-los (D-23, citado acima). Reduzir a concorrência para um único trabalhador
Playwright ataca a taxa de requisições diretamente, sem enfraquecer nenhum controle: o próprio
`playwright.config.ts` documenta, no comentário de cabeçalho de `workers`, que o número de
trabalhadores é uma escolha de vazão, não um requisito de segurança.

**Estado das três opções listadas acima**: continuam **sem decisão tomada** — nenhuma das três foi
adotada. A mitigação verificada nesta rodada (reduzir a concorrência para um trabalhador) é uma
**quarta via**, que ataca a concorrência da execução de teste em vez do volume de requisições por
jornada (opção 3) ou do teto do limitador (opções 1/2), e por isso não substitui a decisão de
configuração permanente que as três opções originais ainda aguardam. Os cabeçalhos da resposta 429
(`Retry-After`, `RateLimit-*`) continuam **não capturados** — a medição desta rodada leu status e
contagem de aprovações/falhas por execução, não cabeçalhos de resposta individuais.

**Detalhe completo**: `specs/009-indicators-reports/STATE.md` §14.3/§14.4.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote A, mesma decisão do
coordenador que fechou F-48, "mesma raiz": os dois são atrito de limite de taxa contra a suíte E2E
completa rodando localmente contra um banco de desenvolvimento de vida longa e volumoso). A
"quarta via" que a atualização de 2026-09-12 já media — reduzir a concorrência do Playwright para
um trabalhador — deixa de ser mitigação verificada sem decisão e passa a ser a decisão formal:

- **`THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS` permanecem intocados** (`100`/`60`). Confirmado nesta
  rodada, por leitura de `.github/workflows/ci.yml`: os **seis** blocos de ambiente do workflow
  (as três suítes de teste estático mais os três jobs `test-e2e*`) trazem exatamente `THROTTLE_LIMIT:
  "100"` e `THROTTLE_TTL_SECONDS: "60"`, sem uma única exceção — ao contrário do limitador de login
  (F-48), a CI nunca ratificou um perfil diferente para este mecanismo no job de E2E. Não havia
  "perfil já aprovado pela CI" para alinhar aqui — alinhar seria inventar um valor que a própria CI
  nunca usou, o oposto do que D-23 fez para F-48.
- **Nenhuma das opções 1/2/3 originais foi adotada** — continuam registradas acima como não
  tomadas, por precisão histórica, não porque ainda estejam em aberto como decisão pendente: a via
  que fecha este achado é a quarta, já medida.
- **A decisão formal é a concorrência**: rodar a suíte E2E completa localmente, contra um banco de
  desenvolvimento de vida longa, com `--workers=1`. A medição que já estava registrada acima
  (2026-09-12) é a prova: 4 trabalhadores contra build de produção = 10 aprovados/105 não
  executados; 1 trabalhador, mesmo build = **129 de 129, sem falha**. Nenhuma nova execução foi
  necessária nesta rodada para reabrir essa prova — ela já satisfazia o padrão de evidência antes
  de o cabeçalho ser reconciliado.
- **Por que isto é aceitável como decisão permanente, não só mitigação temporária**:
  `playwright.config.ts` já documenta, no comentário do próprio `workers`, que o número de
  trabalhadores é escolha de vazão, não requisito de segurança — reduzir a um trabalhador para uma
  execução local completa não altera nenhum controle, só a taxa na qual os testes o exercitam. CI
  continua usando seu próprio paralelismo (a divisão por navegador, `22021d2`) porque roda contra um
  banco recém-semeado por execução, onde o mesmo volume de requisições nunca se aproxima do teto —
  o mesmo mecanismo que a seção "Por que a CI passa" acima já explica.

**O que isto NÃO fecha**: os cabeçalhos de resposta `Retry-After`/`RateLimit-*` continuam não
capturados (permanece registrado como não verificado, sem mudança nesta rodada); a suíte completa
com o paralelismo padrão (4 trabalhadores) continua não recomendada localmente contra um banco de
desenvolvimento volumoso — a orientação operacional, a partir de agora, é `--workers=1` para essa
combinação específica, não uma correção que torne o paralelismo padrão seguro nela.

**Atualização — 2026-09-19, medição corrente do coordenador (rodada 023, fechamento de F-56)**:
`accessibility.spec.ts` inteiro, `--workers=1`, projeto Chromium, build de produção, **servidores
recém-reiniciados**: **168 de 168 aprovados em 8,3 minutos, código de saída 0** — evidência mais
atual que o 129/129 registrado acima (medição anterior, com menos testes; as duas varreduras de
Compliance acrescentadas pelo F-55 estão contadas nos 168 de agora).

Na mesma janela, uma execução separada com `--workers=1` **travou duas vezes**, sem progresso, CPU
quase zero — mas contra servidores que já haviam servido uma sessão inteira de tráfego de teste
acumulado (uma bateria paralela de 822 testes, mais duas invocações). Reiniciar os dois servidores do
zero e repetir o mesmo comando de trabalhador único resolveu, de forma limpa e rápida (2/2 em 6,8s;
1/1 em 9,1s) — e a medição de 168/168 acima confirma o caso geral contra servidor fresco.

**A propriedade é da carga acumulada do servidor, não do paralelismo.** `--workers=1` continua sendo
a política correta deste achado, e **funciona** — o que não funciona é execução longa, com qualquer
número de trabalhadores, contra um servidor que a própria sessão já sobrecarregou por horas. Não ler
uma travada sob `--workers=1` como motivo para subir o paralelismo de volta — isso desfaria
exatamente o que este achado fechou. A mitigação é reiniciar os dois servidores antes de uma bateria
local completa, não aumentar o número de trabalhadores. Detalhe completo:
`docs/local-environment.md` D-24, item 3.

## F-60 — RESOLVIDO (2026-09-19, rodada 023, Lote B) — o seed nunca reposiciona a unidade organizacional de um usuário que já existe no banco

**Encontrado**: 2026-09-11, por consulta direta ao banco de desenvolvimento durante a Fase 7
(009-indicators-reports).

**Sintoma, medido**: as contas `fixture-risk-analyst@pharosgrc.local` e
`fixture-risk-approver@pharosgrc.local`, neste banco de desenvolvimento, carregam um
`primaryOrgUnitId` anterior à correção **F-15** — que no código do seed de hoje força as duas contas
para `DIV-A-TEAM-1`. As duas contas acumularam um `OrgScopeGrant` adicional sobre `DIV-A-TEAM-1`
(porque `ensureUnitScopeGrant` só adiciona concessão, nunca remove), então o **escopo** delas cobre a
unidade corretamente, mas o **`primaryOrgUnitId`** — que é o campo que a verificação de atribuição
consulta — continua apontando para a unidade antiga.

**Causa**: `apps/api/prisma/seed/platform.seed.ts` (por volta da linha 1232) faz `user.upsert` com
**`update: {}`**. Consequência: nenhum campo de uma linha de usuário **já existente** é atualizado por
uma nova execução do seed — só uma linha recém-criada recebe a colocação (`primaryOrgUnitId`) que o
código atual determina.

**Por que importa**: uma correção feita no código do seed (como F-15) pode **nunca alcançar um banco
de desenvolvimento já existente**, mesmo depois de rodar o seed de novo — o efeito da correção só
aparece de fato num banco recriado do zero. Isto já custou tempo real de investigação nesta sessão
(um sintoma que parecia regressão de autorização era, na verdade, um banco de desenvolvimento
desatualizado em relação ao seed) e vai custar de novo em qualquer sessão futura que reutilize um
banco de desenvolvimento de vida longa.

**O que NÃO foi feito, e por quê**: o `upsert` não foi alterado nesta sessão — mudar o comportamento
de `update` no seed (por exemplo, para reaplicar `primaryOrgUnitId` e outros campos posicionais em
toda execução) é decisão de design do seed que precisa considerar todos os campos que hoje dependem
de `create`-only por reflexo, não só o caso observado, e não estava no escopo do trabalho desta
sessão (Fase 7, indicadores e relatórios).

**Owner**: a próxima tarefa que tocar `platform.seed.ts`, ou quem for depurar um sintoma de
autorização/escopo que "deveria" ter sido corrigido por uma mudança de seed já mesclada — comece
verificando `primaryOrgUnitId` diretamente no banco antes de suspeitar do código de autorização.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote B, decisão do coordenador:
corrigir com o menor alcance possível — só as contas que o próprio seed semeia, nunca usuário
arbitrário — e registrar em log quando algo muda).

- **O que mudou**: em `apps/api/prisma/seed/platform.seed.ts`, o laço de `seedDevFixtures` que cria
  os seis usuários de fixture agora consulta a linha existente por e-mail ANTES do upsert; se
  `primaryOrgUnitId` diverge do que este seed calcula (`orgUnit.id`), imprime
  `[platform.seed] Reconciling primaryOrgUnitId for <email>: <antigo> -> <novo>.` e o `upsert`
  passa a carregar `update: { primaryOrgUnitId: orgUnit.id }` em vez de `update: {}`.
  `fullName`/`status` continuam `create`-only, sem mudança — só o campo que o achado mediu como
  divergente foi reconciliado, nenhuma resincronização geral.
- **Por que é seguro contra usuário arbitrário**: o `where` é sempre o e-mail
  `fixture-<slug>@pharosgrc.local` que a própria função gera — nenhum outro caminho do produto
  atribui esse padrão de e-mail a uma conta real, então esta consulta estruturalmente nunca pode
  encontrar (e portanto nunca pode reposicionar) uma conta que não seja deste seed. O administrador
  de bootstrap (`upsertBootstrapAdmin`) e o resto do seed continuam com `update: {}`, intocados —
  o comentário da própria função já explicava, antes desta correção, por que a posição do
  administrador de bootstrap não deve ser sobrescrita num re-run (pode ter sido movida
  deliberadamente por um operador), e essa razão vale igualmente aqui: só a conta de fixture, cuja
  identidade inteira é gerada por este arquivo, é candidata a reconciliação.
- **Seed de produção intocado**: a mudança inteira vive dentro de `seedDevFixtures`, que só executa
  sob `SEED_DEV_FIXTURES=true` **e** `NODE_ENV !== 'production'` (`assertDevFixturesAllowed` recusa
  a execução inteira se as duas condições coexistirem) — nenhum papel, permissão ou unidade raiz de
  produção foi tocado.

**Verificação ao vivo, 2026-09-19, contra o banco de desenvolvimento real** (não o banco de teste
isolado — este é exatamente o cenário que o achado mede, um banco de vida longa com drift
acumulado):

1. **Drift confirmado antes da correção**: consulta direta ao banco mostrou
   `fixture-risk-analyst@pharosgrc.local` com `primaryOrgUnitId = da1d9355-...` e
   `fixture-risk-approver@pharosgrc.local` com `bbb8a339-...` — nenhum dos dois igual ao id real de
   `DIV-A-TEAM-1` (`f604bfff-...`), confirmando que esta MESMA máquina, usada durante todo o
   Lote A/B desta rodada, carregava exatamente o drift que o achado descreve.
2. **Rodando `SEED_DEV_FIXTURES=true pnpm --filter @pharos/api run db:seed`**: reconciliou **seis**
   contas de fixture, não só as duas que o achado nomeia — `fixture-platform-administrator`,
   `fixture-risk-manager`, `fixture-risk-analyst`, `fixture-risk-approver`, `fixture-auditor`,
   `fixture-read-only` — cada uma com sua própria linha de log mostrando o valor antigo e o novo.
   `fixture-risk-analyst` e `fixture-risk-approver` convergiram para o MESMO id
   (`f604bfff-...`, `DIV-A-TEAM-1`) — a correção do F-15 finalmente alcançou este banco, exatamente
   o sintoma que este achado previu.
3. **Persistência confirmada**: consulta direta pós-seed confirma os dois `primaryOrgUnitId` iguais
   a `f604bfff-...`.
4. **Idempotência confirmada**: rodando o seed uma segunda vez, imediatamente depois, produz **zero**
   linhas `Reconciling` — nada mais diverge, exatamente o comportamento esperado de um seed
   convergente.

`pnpm --filter @pharos/api run typecheck` e `pnpm --filter @pharos/api run lint` limpos.

---

## F-61 — CORRIGIDO (2026-09-13, F4/S-08) — a aba "Achados" do detalhe do risco dispara duas requisições por achado ao montar, e o limitador global recusa parte delas na cara do usuário

**Correção**: `FindingLinksSection` (`apps/web/src/features/findings/components/finding-links-section.tsx`)
agora só busca controles/riscos quando a própria seção entra (ou está prestes a entrar, `rootMargin`
de 200px) na viewport — um `IntersectionObserver` por achado, que ativa a busca exatamente uma vez e
nunca desativa (rolar para longe e voltar não refaz a requisição), preservando o comportamento visível
ao usuário: os vínculos continuam aparecendo sem exigir clique algum, só adiados até estarem
efetivamente relevantes na tela. Ambiente sem `IntersectionObserver` (navegador antigo; o próprio
`vitest.setup.ts` deste projeto, que só faz polyfill de `ResizeObserver`) cai para o comportamento
antigo — busca imediata — nunca para "nunca carrega".

Medido ao vivo (`RSK-2026-0871`, unidade raiz "PharosGRC", 1440×900, `page.on('request')`): ao montar
a aba, 2 requisições de vínculo (antes: 150-350); após rolar até o fim da lista, 6. Efeito colateral
documentado abaixo (a pré-checagem de evidência do diálogo de encerramento) deixa de competir com a
carga anterior pela mesma razão — o volume concorrente que a fazia falhar não existe mais no
carregamento inicial.

Teste de regressão: `finding-links-section.test.tsx`, describe `"FindingLinksSection viewport gating
(S-08)"` — falha sem a correção (fetch dispara antes da interseção) e passa com ela; comprovado
revertendo a linha do guard (`if (!active) return;`) e reexecutando a suíte nos dois estados.

O texto abaixo é o registro original do defeito, preservado como histórico.

---

### F-61 (histórico) — a aba "Achados" do detalhe do risco dispara duas requisições por achado ao montar, e o limitador global recusa parte delas na cara do usuário

**Sintoma, medido em navegador renderizado em 2026-09-12** (risco `RSK-2026-0001`, banco de
desenvolvimento com 44 achados na unidade organizacional):

```
44x  200  /api/v1/findings/{id}/controls
44x  200  /api/v1/findings/{id}/risks
12x  429  /api/v1/findings/{id}/controls
12x  429  /api/v1/findings/{id}/risks
```

Na tela, cada achado recusado mostra **duas faixas de erro em vermelho** — "Não foi possível
carregar os controles vinculados a este achado." e "Não foi possível carregar os riscos vinculados a
este achado." — lado a lado com achados que carregaram normalmente. O leitor não tem como
distinguir "falhou por excesso de requisições" de "este achado está quebrado".

**Causa**: `FindingLinksSection` é renderizado **incondicionalmente** para cada achado da lista em
`findings-panel.tsx`, e cada instância busca controles e riscos ao montar. O custo é linear no
número de achados da unidade, e não há nada no componente que o limite. As recusas são `429` do
`ThrottlerGuard` global — **F-59**, do qual esta é a primeira manifestação medida em produto, não
apenas em suíte E2E.

**O que NÃO é**: não é defeito de autorização, de escopo nem dos endpoints de vínculo — 88 das 112
requisições responderam `200` com dado correto. Também **não** foi introduzido pelo trabalho de
Plano de Ação de 2026-09-12: `FindingCorrectiveActions`, acrescentado nessa data ao mesmo painel,
monta **sob demanda** e dispara zero requisição enquanto o achado está recolhido — deliberadamente,
para não ser a terceira requisição por linha. O defeito ficou mais visível porque a mesma tela
passou a ser olhada de perto, não porque mudou.

**Por que não foi corrigido junto**: a correção óbvia — carregar os vínculos sob demanda, como a
seção nova já faz — **muda o comportamento da tela** (os vínculos deixam de aparecer sem clique) e
isso é decisão de produto sobre a aba de Achados, não consequência técnica do trabalho de Plano de
Ação. Alternativas legítimas existem (uma rota de leitura em lote, paginação do painel, carregar os
vínculos só dos achados visíveis) e escolher entre elas exige medir o uso real. **Nunca** afrouxar
`THROTTLE_LIMIT` para esconder isto: o limite está certo, quem está errado é o volume.

**Owner**: a próxima tarefa que tocar a aba de Achados do detalhe do risco. Comece reproduzindo com
o script de captura contra um banco com dezenas de achados na mesma unidade — com poucos achados o
defeito não aparece, que é exatamente por que ele sobreviveu até agora.

## F-62 — CORRIGIDO (2026-09-13, `specs/013-stabilization-audit` S-03 a S-05) — `ConfirmDialog` não devolve o foco ao fechar, e duas telas administrativas remontam a tabela a cada mudança de estado

**Correção, na abstração compartilhada**: `useDialogFocusRestore`
(`packages/design-system/src/lib/use-restore-focus.ts`), usado por `components/ui/dialog.tsx` e por
`ConfirmDialog`, captura o elemento anterior na fase de render (antes de qualquer `autoFocus`) e
resolve item de menu para o gatilho do menu por `aria-labelledby`; `DataTable` chama `cell`/`header`
como função de render, então colunas recriadas a cada render não remontam mais as células. Os três
mecanismos que esta entrada previa (`ConfirmDialog`, remontagem por colunas, menu → diálogo) — e um
quarto encontrado na auditoria (`autoFocus` num campo do diálogo) — ficaram cobertos sem alterar as
telas consumidoras. Regressão: `dialog.test.tsx`, `design-system-confirm-dialog-focus.test.tsx`,
`data-table-cell-identity.test.tsx` e `e2e/dialog-focus-and-size.spec.ts`, cada um comprovado falhando
sem a correção. Registro completo: `specs/013-stabilization-audit/STATE.md` §4.3.

O texto abaixo é o registro original, preservado como histórico.

### F-62 (histórico)

**Encontrado**: 2026-09-13, no refinamento da tela "Papéis e permissões"
(`specs/012-admin-roles-screen/STATE.md`), medindo `document.activeElement` numa sessão Playwright
contra a aplicação em execução.

**Sintoma medido** (tela `/admin/roles`, papel personalizado sem usuários, menu da linha →
"Excluir" → `Escape`): o foco termina em `<body>`. Um usuário de teclado volta ao início da página
depois de cancelar uma exclusão.

**Causa**: `packages/design-system/src/components/confirm-dialog.tsx` é construído direto sobre
`@radix-ui/react-dialog`, **sem** a captura e restauração de foco que `apps/web/src/components/ui/dialog.tsx`
recebeu em D-15 (`docs/local-environment.md`). É o mesmo defeito que D-15 corrigiu nos diálogos
comuns: o Radix devolve o foco a um `Dialog.Trigger` que nenhuma chamada registra. `ConfirmDialog`
tem 33 arquivos chamadores em `apps/web/src`.

**Defeito vizinho, mesma medição**: uma tabela cujas colunas são reconstruídas a cada render remonta
todas as células (`flexRender` monta cada `cell` como componente, e uma função nova é um tipo novo),
então o botão que abriu um diálogo é substituído e a restauração de foco de `dialog.tsx` — que só
foca um elemento ainda presente no documento — cai em `<body>`. Na tela de papéis isso foi medido e
corrigido (`useMemo` em `role-admin-view.tsx`). `user-admin-view.tsx`, `my-actions-view.tsx` e
`report-catalog-view.tsx` constroem colunas com ações por render e **não** foram medidos. Abrir um
diálogo direto do `onSelect` de um item de menu tem uma terceira variante do problema (o diálogo
registra o item de menu, que some na animação de saída); a tela de papéis passou a abrir o diálogo
só depois de o menu devolver o foco ao gatilho.

**Por que não foi corrigido junto**: corrigir `ConfirmDialog` muda o comportamento de todas as
confirmações da plataforma, e as outras telas pertencem a outros módulos — fora do escopo de uma
revisão tela a tela. **Nenhum teste de acessibilidade existente cobre fechamento de `ConfirmDialog`**,
por isso passou.

**Owner**: a próxima tarefa de acessibilidade transversal, ou a revisão visual da tela "Usuários".
Replicar em `ConfirmDialog` o `onOpenAutoFocus`/`onCloseAutoFocus` de `dialog.tsx`, acrescentar um
teste E2E que feche uma confirmação por `Escape` e verifique o foco no gatilho, e medir as três
telas acima com o mesmo roteiro.

## F-63 — RESOLVIDO (parte 2, descrições de PAPÉIS, em 2026-09-14; parte 1, catálogo de PERMISSÕES, em 2026-09-18) — texto voltado ao usuário em inglês e referências internas de especificação no catálogo de permissões e nas descrições de papéis

**Encontrado**: 2026-09-13, no refinamento da tela "Papéis e permissões", lendo a resposta real de
`GET /admin/permissions` e `GET /admin/roles`.

**O que a tela mostra**:

1. **As 70 descrições de permissão estão em inglês** ("View risk records within the caller's
   organizational scope."). Elas vêm dos registros de permissão de domínio da API
   (`apps/api/src/modules/risk/domain/risk-permissions.ts` e mais sete arquivos `*-permissions.ts`),
   são persistidas no catálogo e aparecem em três lugares da interface: o diálogo de detalhes do
   papel, a lista de permissões ao criar/editar um papel e o diálogo de papéis do usuário. Viola
   CLAUDE.md §11.1 ("Texto em inglês voltado ao usuário não pode ser reintroduzido").
2. **Descrições de papéis semeados citam artefatos internos**: "FR-006 (spec.md,
   008-incidents-problems)", "data-model.md §4, FR-017/FR-018", "research.md D-13" — 26 ocorrências
   em `apps/api/prisma/seed/platform.seed.ts`. São justificativas de engenharia, não texto para um
   administrador.

**Por que não foi corrigido junto**: a tarefa de refinamento proibiu explicitamente alterar o
catálogo de permissões, o banco e o seed, e pediu para não alterar as descrições semanticamente. A
interface agora dá a cada permissão um **verbo em pt-BR** e agrupa por **área** em pt-BR (catálogo
`admin.roles.permissionCatalog` na web), sempre ao lado do identificador técnico real, e mostra a
descrição do catálogo como texto secundário. A causa continua no catálogo.

**Owner**: uma tarefa própria de conteúdo do catálogo. Traduzir as descrições nos registros de
domínio (o seed de permissões sincroniza a partir deles; verificar como a sincronização trata uma
descrição alterada antes de assumir) e reescrever as descrições dos papéis semeados sem as
referências internas, preservando o significado. Lembrar que o seed é idempotente e **não**
reescreve registros existentes sem decisão explícita (ver F-60 para o mesmo padrão).

### Estado por parte — 2026-09-14

**Parte 2 (item 2 acima, descrições de PAPÉIS): RESOLVIDA.** As 12 descrições de papel semeado foram
reescritas como prosa de produto em pt-BR, o racional de engenharia foi movido para comentário de
código, e uma guarda estrutural impede a reincidência. O registro completo — textos, comprimentos
antes/depois, mecanismo de convergência e prova de não-vacuidade — está na seção "Resolução" de
**F-32**, que é a mesma causa vista de outro ângulo; esta entrada não o duplica.

Uma dúvida levantada pelo texto original acima foi respondida por medição, e a resposta é o oposto
do que ele supunha: para **papéis**, `upsertSystemRoles` **já** reconciliava `description` no
`update` do upsert. O padrão de F-60 (`update: {}`, só insere) vale para `user.upsert`, **não** para
`role.upsert`. A reescrita alcançou o banco de desenvolvimento existente sem nenhuma mudança de
mecanismo, confirmado por consulta direta antes e depois do seed.

**Parte 1 (item 1 acima, as 70 descrições de PERMISSÃO em inglês): continua ABERTA**, deliberadamente
fora do escopo da correção de 2026-09-14. Ela é uma tarefa de natureza diferente e de raio maior:
o texto não está no seed, e sim em oito arquivos `*-permissions.ts` dos registros de domínio
(`apps/api/src/**/domain/*-permissions.ts`), de onde `upsertPermissions` o sincroniza — esse upsert
**já** carrega `description` no `update`, então a tradução converge sozinha assim que os registros
mudarem, mas a mudança atravessa oito módulos de domínio e não um único arquivo de seed. As três
superfícies que exibem esse texto (diálogo de detalhes do papel, lista de permissões ao criar/editar
papel, diálogo de papéis do usuário) continuam mostrando inglês.

**Owner da parte que resta**: uma tarefa própria de tradução do catálogo de permissões. Ao executá-la,
vale replicar a guarda de F-32 (`seeded-role-description-content.spec.ts`) sobre
`getAllPermissionDefinitions()` — hoje **nada** impede que uma permissão nova nasça com descrição em
inglês.

**Parte 1 — RESOLVIDA em 2026-09-18** (rodada 023, saneamento de findings, commit `37c112a`).
Traduzidas as 74 descrições de permissão (não 70 — a contagem original subestimou; a varredura real
achou 14 arquivos de registro, não 8: `core/authorization/domain/permissions.ts` mais 13
`*-permissions.ts`) para pt-BR, preservando `identifier`/`resource`/`action` em inglês por §11.1's
próprio carve-out. Onde uma descrição citava artefato interno de especificação
(`data-model.md`/`research.md`/`spec.md FR-nnn`), a prosa foi reescrita em linguagem de produto em
vez de traduzida ao pé da letra. Guarda estrutural nova, replicando o padrão de F-32:
`apps/api/test/unit/permission-description-content.spec.ts` (80 testes) — verifica que toda
`description` de `getAllPermissionDefinitions()` está em pt-BR e não cita artefato interno,
impedindo a reincidência que a nota acima previa. `upsertPermissions` já sincronizava `description`
no `update`, então a tradução converge no banco de desenvolvimento sem mudança de mecanismo, mesmo
padrão confirmado por Parte 2.

## F-64 — RECLASSIFICADO E MOVIDO (2026-09-19, rodada 023, Lote C) — pedido de capacidade de produto, não defeito; movido para `docs/architecture/grc-roadmap.md` §6 — achado produzido por engajamento de auditoria não tem caminho de gestão na interface quando a unidade não tem risco

**Encontrado**: 2026-09-13, auditoria de estabilização (`specs/013-stabilization-audit` S-09, agente A4),
reproduzido ao vivo.

**Sintoma**: toda gestão de achado — encerrar, mover para remediação, reabrir, arquivar, vincular
controle/risco, evidência — só existe em `FindingsPanel`, montado apenas no detalhe do risco, que
lista achados por `GET /findings?orgUnitId=<unidade do risco>`: coincidência de unidade
organizacional, não o vínculo `FindingRiskLink` que a fase 005 criou. `EngagementFindingsSection`
(dentro do engajamento que produziu o achado) só lista e cria. Um achado de engajamento cuja unidade não
tenha nenhum risco fica sem nenhum botão que o gerencie, embora o servidor suporte tudo; e um achado
aparece na aba de um risco com o qual não tem relação alguma.

**Por que não foi corrigido na estabilização**: é a mesma classe de CLAUDE.md §17 item 15 (Planos de
Ação) — capacidade no servidor sem superfície —, e corrigir exige decidir onde a gestão vive e passar a
listar por vínculo (rotas reversas `GET /risks/{id}/findings`/`GET /controls/{id}/findings` não existem
no contrato). Trabalho de especificação (§16), não correção pontual.

**Owner**: uma especificação própria, no molde de `specs/010-action-plan-surface`, reutilizando os
diálogos de achado existentes.

**Reclassificação, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do
coordenador: isto é pedido de capacidade de produto, não defeito — o sistema faz hoje o que foi
especificado, e CLAUDE.md §16 proíbe construir sem especificação; mover para onde vivem decisões de
produto, fechar aqui apontando para lá, sem apagar a ideia). Conteúdo integral movido, com a
evidência, para `docs/architecture/grc-roadmap.md` §6 (novo addendum datado 2026-09-19) — o mesmo
documento que já registra a decisão equivalente para o item 15 do CLAUDE.md §17 (a superfície de
Plano de Ação). Fechado aqui: zera o registro de defeitos sem apagar a ideia, que é a diferença
entre saneamento e maquiagem.

## F-65 — CORRIGIDO (2026-09-19, rodada 023, Lote C) — upload acima de 32 MB ainda falha devagar pela origem web

**Encontrado**: 2026-09-13, na correção de S-02 (`specs/013-stabilization-audit` §4.2).

**Sintoma**: `experimental.middlewareClientMaxBodySize` foi fixado em 32 MB (acima do limite de negócio de
25 MB) para que o rewrite do Next pare de truncar uploads válidos. Um arquivo acima de 32 MB volta ao
comportamento antigo: corpo truncado pelo proxy, a API esperando bytes que não chegam, `500` em texto
puro depois de 30 s. Entre 25 e 32 MB a API recusa rápido com `413`.

**Por que o teto não é maior**: o clone do corpo empurra cada pedaço também para um `PassThrough` que
ninguém lê durante o proxy, mantendo até o teto de bytes em memória no servidor web por requisição,
antes de qualquer autenticação.

**Owner**: a próxima tarefa sobre anexos. Caminho provável: a interface verificar o tamanho do arquivo
antes de enviar, com o limite exposto pelo servidor (hoje ele só existe em `apps/api/.env`).

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do coordenador:
corrigir se couber; recusar o corpo antes do clone se possível). Coube: `apps/web/src/middleware.ts`
(novo — este app não tinha nenhum middleware antes) intercepta `POST /api/v1/attachments` e lê só o
cabeçalho `Content-Length` (nunca consome/clona o corpo) **antes** de o Next resolver o rewrite
externo que aciona o clone descrito acima — um corpo acima de 32 MB (o mesmo teto de
`middlewareClientMaxBodySize`, não um segundo número escolhido à parte) é recusado ali, na hora, com
um `413` `application/problem+json` real, e nunca chega ao mecanismo de clone/proxy.

- **Por que isto é caminho seguro, não um contorno frágil**: middleware do Next.js roda
  estruturalmente antes da resolução de rewrite (é o próprio mecanismo pelo qual um rewrite pode ser
  expresso via `NextResponse.rewrite()`) — não é suposição, é a ordem documentada do framework. A
  verificação usa só `request.headers.get('content-length')`, nunca lê o corpo, então não introduz
  um segundo ponto de buffer.
- **Por que `Content-Length` não é o limite de segurança, só o atalho rápido**: o cabeçalho é
  fornecido pelo cliente e pode faltar (transferência em chunks) ou mentir — um upload real do
  navegador (`FormData`/`File`) sempre o define corretamente, mas se estiver ausente ou for inválido
  a requisição simplesmente segue o caminho já existente, sem alteração. O `multer` da API
  (`ATTACHMENT_MAX_SIZE_BYTES`, `limits.fileSize`) continua sendo a única autoridade real sobre o
  limite — exatamente como já era para todo corpo abaixo de 32 MB hoje (CLAUDE.md §19.7/§19.8: um
  único calculador, nunca duplicado).
- **Texto da resposta, mesmo significado que a API já dá para o caso irmão (25-32 MB)**: novo par
  `payloadTooLargeTitle`/`fileTooLarge` em `apps/web/src/lib/messages/errors.ts` — catálogo
  centralizado, §11.1 — espelhando literalmente `problemTitle.payloadTooLarge`/
  `attachment.fileTooLarge` do lado da API, com comentário citando a razão do espelhamento
  deliberado. Nenhuma string nova inventada; a mesma frase, pega uma camada antes.
- **Escopo mínimo**: `matcher` do middleware é a rota literal `/api/v1/attachments` — não todo
  `/api/*` — porque anexo é o único upload que passa por este proxy (CLAUDE.md §19.6). Nenhuma outra
  rota é tocada.

**Teste que prova, estendendo a suíte que já existia para o intervalo vizinho**:
`apps/web/e2e/attachment-upload-size.spec.ts` ganhou um terceiro cenário — 40 MB, acima do teto —
provando `413`, corpo `application/problem+json` com o mesmo texto pt-BR da API, e tempo de resposta
abaixo do orçamento de 15s (contra os ~30s do defeito original). **Verificação ao vivo**:
`--workers=1 --project=chromium` — **2/2 passaram** (24.2s no total para os dois cenários deste
arquivo, incluindo o novo) — confirmando que o corpo acima do teto agora falha rápido, não mais
lento.

`pnpm --filter @pharos/web run typecheck`/`lint` limpos.


## F-66 — RESOLVIDO/NÃO REPRODUZ (causa 2 em 2026-09-13; causas 1 e 3 em 2026-09-18) — transbordo horizontal a 390 px em sete telas

**Encontrado**: 2026-09-13, smoke final da auditoria de estabilização
(`specs/013-stabilization-audit` §6), medido com Playwright e identificado elemento a elemento. Nenhum
dos arquivos envolvidos foi alterado pela auditoria.

**Causas, com o elemento medido:**

1. **Barras de resultado dos registros** (Riscos, Controles, Ativos, Processos, Auditoria; o mesmo
   padrão existe em Problemas): o grupo "ordenação + alternância Cards/Tabela" (`flex items-center
   gap-3` em `*-register-results-bar.tsx`) não quebra linha e mede 395–427 px — o `main` rola na
   horizontal. O padrão está duplicado em seis arquivos, um por módulo.
2. ~~**Dashboard**: a tabela acessível dos gráficos (`features/dashboard/components/chart-data-table.tsx:31`)
   recebe `sr-only` diretamente no `<table>`; uma tabela ignora a largura de 1 px e mede 384 px, criando
   rolagem horizontal do **documento** inteiro no celular.~~ — **RESOLVIDO em 2026-09-13**, ver abaixo.
3. **Estrutura organizacional**: texto sem ponto de quebra (dado longo) estoura o cartão de concessões de
   escopo (`scope-grants-panel.tsx`, 525 px).

> **Causa 2 — RESOLVIDO (2026-09-13)**, junto com F-67. A medição original estava certa no sintoma e
> incompleta na causa: não é só a largura de 1 px que a tabela ignora. Uma caixa de tabela trata
> `width` **e** `height` como mínimos e cresce até o conteúdo, e o CSS deixa `overflow` em caixa de
> tabela **indefinido** — o Chrome o ignora. `sr-only` no `<table>` deixava, portanto, um
> `position:absolute` de ~384 px de largura por várias centenas de altura, que o `clip` tornava
> invisível mas que continuava ocupando espaço nos **dois** eixos. Correção: `sr-only` passou para um
> `<div>` invólucro, que honra as três propriedades; a tabela continua no DOM e legível por leitor de
> tela, dentro de uma caixa que mede 1 px de verdade. Guarda:
> `apps/web/e2e/shell-scroll.spec.ts`, cenário "the dashboard's accessible chart tables take up no
> space", que verifica que nenhum `<table>` carrega `sr-only` em si mesmo e que o invólucro mede
> ≤ 1 px nos dois eixos. A varredura de acessibilidade do Dashboard foi reexecutada nos dois temas,
> como esta entrada exigia, e continua sem violações.

> **Causa 3 — RESOLVIDO 2026-09-18** (rodada 023, saneamento de findings). A causa real **não** era
> "texto sem ponto de quebra" em `scope-grants-panel.tsx` — foi medida corretamente no SINTOMA (525 px)
> mas incompleta na causa, mesmo padrão do fechamento da causa 2. Medido diretamente (Playwright,
> Chromium, 390 px): o elemento mais largo da tela não era texto algum — era o `<p>` de placeholder
> "Selecione um usuário para ver e gerenciar seu escopo." e, junto com ele, cada `<li>` da árvore de
> unidades, todos em 499-525 px. Causa raiz:
> `organization-admin-view.tsx`'s `<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,
> 1.2fr)]">` não tinha `grid-template-columns` NENHUM abaixo de `lg` — uma única coluna implícita,
> dimensionada pelo conteúdo, nunca presa à viewport; qualquer nome longo em QUALQUER filho (árvore de
> unidades OU painel de escopo) alargava a grade inteira. Correção: `grid-cols-1` no breakpoint base
> (`lg:` mantém as duas colunas inalterado). Depois: nenhum elemento excede 390 px. Guarda:
> `apps/web/e2e/shell-scroll.spec.ts`, cenário "the organization admin screen does not overflow
> sideways at 390px (F-66 causa 3)" — mede a caixa delimitadora de cada elemento dentro de `<main>`
> diretamente (não `document.documentElement.scrollWidth`, que o `overflow-hidden` do shell (T203)
> mascara: confirmado ao vivo revertendo a correção e medindo — o scroll do documento ficava em 390
> mesmo com a grade em 525 px por dentro; só a medição direta de caixa pegou a regressão). Falha
> reproduzida contra o código pré-correção (525.15625 px, exatamente o valor original desta entrada) e
> volta a passar depois.

> **Causa 1 — NÃO REPRODUZ, medido 2026-09-18** (rodada 023, saneamento de findings, mesma disciplina
> da causa 3: medir os 6 arquivos, não confiar na descrição). Os seis `*-register-results-bar.tsx`
> descritos aqui **não existem mais como arquivos separados** — em algum momento entre 2026-09-13 e
> hoje, os dez módulos que hoje mostram uma barra de resultados (Ações, Ativos, Auditoria,
> Compliance, Controles, Incidentes, Problemas, Processos, Relatórios, Riscos) convergiram para UM
> componente compartilhado, `packages/design-system/src/components/data-table/results-toolbar.tsx`
> (`ResultsToolbar`), cujo próprio `<div>` raiz já usa `flex flex-wrap` e cujo grupo de controles
> (`children`) também. Medido diretamente (Playwright, Chromium, 390 px, os seis módulos que este
> achado nomeia — Riscos, Controles, Ativos, Processos, Auditoria, Problemas): elemento mais largo
> dentro de `<main>` em **326px** nos seis, em ambos os temas (claro e escuro);
> `document.documentElement.scrollWidth - clientWidth` em **0** nos seis; confirmado visualmente por
> captura de tela real do registro de Riscos — a barra de resultados quebra para uma segunda linha
> sob a contagem "1.789 riscos", sem rolagem alguma. Nenhum código foi alterado por esta entrada: a
> consolidação em `ResultsToolbar` (trabalho de outra rodada, não identificada) já resolveu a causa
> antes de esta ter sido revisitada. Mantida como **NÃO REPRODUZ**, não "corrigida aqui" — mesma
> distinção que F-77 registra, pelo mesmo motivo.

**Owner**: nenhum — as três causas estão fechadas ou não reproduzem.

---

## F-67 — FECHADO em `6825430` — o documento ganhava uma segunda barra de rolagem quando qualquer coisa alta entrava em `<body>`

**Encontrado**: 2026-09-13, ao investigar a causa 2 de F-66.

**O que foi medido**: o shell autenticado é preso ao viewport — `<main>` é a única região que rola
conteúdo de página — mas isso era invariante **implícita**: valia enquanto nada mais dentro de
`<body>` tivesse altura. Qualquer coisa que fizesse portal para `<body>` dava altura rolável ao
documento, e o sintoma era o relatado: uma segunda barra de rolagem à direita e rolagem que continua
para uma área vazia abaixo do shell.

**Fechamento**: `6825430` corrigiu a causa concreta (`ChartDataTable` aplicava `sr-only` ao próprio
`<table>`, que ignora `width`/`height`/`overflow` e escapava do `overflow-hidden` do shell) e trouxe
a guarda de propriedade de rolagem para o repositório, verde: `apps/web/e2e/shell-scroll.spec.ts`,
incluindo o cenário "stray body content", que antes falhava. Esta entrada registrava, enquanto
estava aberta, que essa guarda existia em rascunho e estava vermelha — não está mais.

---

## F-68 — RESOLVIDO (2026-09-14, saída 1) — a descrição de um papel de sistema tinha dois donos, e o seed vencia em silêncio

**Encontrado**: 2026-09-14, corrigindo F-32. A correção precisava saber se o `update` do
`role.upsert` reconcilia `description` (reconcilia). A pergunta seguinte — "então quem mais escreve
nesse campo?" — revelou o defeito.

**Medido no código, não inferido**:

- `apps/api/prisma/seed/platform.seed.ts`, `upsertSystemRoles`: o `update` do upsert reescreve
  `description` em **toda** execução do seed, convergindo para o literal do arquivo. Correto e
  deliberado — é o que fez a correção de F-32 alcançar um banco já existente.
- `apps/api/src/core/authorization/application/role-admin.service.ts`, `update`: recusa `name` e
  `permissionIdentifiers` num papel `isSystem` (`USER_MESSAGES.admin.systemRoleImmutable`), mas
  **aceita `description`** — a guarda não a inclui. O campo é gravado por
  `roleRepository.updateFields` e o evento `role.updated` é registrado normalmente na trilha de
  auditoria.

**Consequência**: um administrador pode editar, pelo produto, a descrição de um papel semeado; a
edição é auditada; e a **próxima execução do seed a apaga**, restaurando o literal do arquivo — sem
gravar `audit_event` algum, porque uma execução de seed não tem identidade atuante (decisão
documentada no cabeçalho de `platform.seed.ts`, ADR-005). A trilha de auditoria, lida depois, mostra
a edição do operador e **não** mostra a reversão: o histórico afirma um estado que o banco não tem
mais. Isso é exatamente a classe de problema que CLAUDE.md §8 e a imutabilidade da trilha existem
para evitar.

**Gravidade**: baixa em frequência (exige que alguém edite a descrição de um dos 12 papéis de
sistema e que o seed rode depois), real em natureza (silenciosa, e sobre o registro de auditoria).
Nenhum dado operacional se perde; o que se perde é a coerência entre trilha e estado.

**Não corrigido nesta fase, e por quê**: há três saídas plausíveis e nenhuma é óbvia —
(1) `RoleAdminService.update` passa a recusar também `description` num papel `isSystem`, tornando o
arquivo de seed o dono único e declarado; (2) o seed deixa de reescrever `description` quando a
linha existente diverge do literal, tornando o operador o dono e aceitando que uma correção como a
de F-32 não alcance mais um banco existente (o custo que F-60 já descreve); (3) o campo ganha
proveniência e o seed só sobrescreve o que ele mesmo escreveu. Escolher entre elas é decisão de
produto sobre autoridade de dado, sujeita a CLAUDE.md §16, e a fase que a encontrou tinha escopo de
conteúdo de texto — corrigir RBAC dentro dela era explicitamente proibido. A asimetria está
registrada em comentário no próprio `upsertSystemRoles`, para que ninguém a redescubra depurando.

**Owner**: a próxima tarefa que tocar `RoleAdminService` ou a administração de papéis. Comece
decidindo quem é o dono do campo; a implementação, em qualquer das três saídas, é pequena.

### Resolução — 2026-09-14, **saída 1**: o arquivo de seed é o dono único e declarado

A decisão de produto foi tomada: **um papel de sistema é controlado pela plataforma, inteiro.** Não
foi a saída 2 (o seed deixaria de convergir e uma correção como a de F-32 não alcançaria mais um
banco existente) nem a saída 3 (proveniência por campo, que acrescentaria estado paralelo ao que já
sustenta o dado — CLAUDE.md §19.7). Nenhuma migração, nenhuma mudança de schema, **e o seed continua
reconciliando `description` em toda execução**, exatamente como antes.

**Servidor.** `apps/api/src/core/authorization/application/role-admin.service.ts`, `update`: a
guarda passou a incluir `command.description !== undefined`. As três alterações — `name`,
`description`, `permissionIdentifiers` — são recusadas com `422` num papel `isSystem`, **inclusive
quando o valor enviado é idêntico ao armazenado**: a regra é sobre quem pode escrever, não sobre o
valor mudar. `USER_MESSAGES.admin.systemRoleImmutable` passou a nomear os três campos, e esse texto
é o `detail` do corpo RFC 9457.

**Interface.** O painel de `/admin/roles` não oferece mais "Editar papel" para um papel de sistema:
um controle cujo salvamento o servidor recusa em toda tentativa é uma promessa que o produto não
pode cumprir, e a que ele cumpria (só a descrição) era o próprio defeito. No lugar, "Ver definição"
abre os mesmos três campos **somente leitura** — `readOnly`, nunca `disabled`, porque `opacity-50`
tornava o nome o texto mais fraco do painel (015 §3) — cada um com a razão escrita ao lado, sob um
aviso único no topo, e um rodapé com **"Voltar" e nenhum salvar**. A razão também aparece no estado
de leitura, ao lado das ações, para que ninguém precise abrir a folha para descobri-la.
`useRoleEditor.submit` recusa localmente um alvo travado e **não emite requisição alguma**.

**Provas** (reversão executada e restaurada em cada caso):

- `apps/api/test/integration/system-role-immutability.spec.ts` — 11 testes. Recusa de `name`,
  `description`, `permissionIdentifiers` e dos três juntos; descrição idêntica à armazenada;
  **nenhum `audit_event` escrito para uma edição recusada** (o coração de F-68); `DELETE` com
  `detail` diferente; papel personalizado aceitando os três; e as causas vizinhas distinguíveis —
  identificador de permissão inexistente (mesmo status, mesmo `type`, `detail` diferente), nome
  duplicado (409 com `type` de conflito) e corpo vazio (400). Com o defeito reintroduzido no
  serviço, 3 de 11 falham; com apenas a mensagem trocada por outra do mesmo arquivo, 5 de 11 falham
  — que é precisamente o que o teste de contrato, asserindo só status, não via.
- `apps/api/test/contract/admin-roles.spec.ts` — a asserção `description → 200` foi **invertida**
  para `422`, e o teste passou a conferir que a linha fica intacta depois das três tentativas.
- `apps/web/src/features/admin/components/roles/role-admin-view.test.tsx` — o teste "sends ONLY the
  description when saving a system role" foi **substituído** por um estritamente mais forte: a tela
  não oferece salvar para um papel de sistema e **não emite `PATCH` algum**.
- `apps/web/src/features/admin/components/roles/role-edit-fields.test.tsx` — "leaves the description
  editable" virou "locks the description too, legibly, with its own reason".
- Verificação renderizada: `apps/web/scripts/ui-capture.mjs --surface=roles`, temas claro e escuro,
  1440 e 390 px, com o passo `10-edit-system-locked` atualizado para o novo fluxo.

**Contrato.** `specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`, `updateRole`:
descrição e resposta `422` reescritas para a regra nova; `packages/api-types` regenerado pelo script
(`api-types-check`), diff restrito a comentários de documentação. `apps/api/openapi.json` **não
mudou** — ele é refletido do Nest, não dos contratos hand-authored, e `openapi:check` segue limpo.

**Fica aberto, e não é desta entrada**: quatro cenários de `apps/web/e2e/` ainda dirigem o fluxo
antigo (dois em `admin-roles.spec.ts`, dois em `accessibility.spec.ts`) e falharão até serem
atualizados — `apps/web/e2e/**` estava fora do território da tarefa que fechou este achado. A lista
exata está no relatório dessa tarefa.

> **Nota, 2026-09-18** (rodada 023, saneamento de findings): esta nota estava desatualizada. Os quatro
> cenários já foram atualizados — pelo commit `b1632bd`, o mesmo dia deste fechamento, fora do escopo
> da tarefa que fechou o achado mas dentro do mesmo dia de trabalho. Confirmado rodando os quatro
> agora: `admin-roles.spec.ts` — "a protected (system) role opens as a read-only definition, with no
> save to press (FR-031, F-68)", "no PATCH is ever sent while reading a system role definition
> (F-68)", "the server refuses a system role rename regardless of what the client sends (FR-033)" (os
> comentários dos dois primeiros já citam F-68/`b1632bd` diretamente); `accessibility.spec.ts` — "admin
> role definition sheet, on a locked system role, has no axe violations" (claro e escuro). 3+2=5
> cenários passando, cobrindo os quatro que esta nota citava (a terceira linha de `admin-roles.spec.ts`
> cobre RENAME e DELETE juntos). Nenhuma ação necessária.

## F-69 — RESOLVIDO como aceito, com justificativa (2026-09-19, rodada 023, Lote C) — no WebKit, clicar num botão não deixa o foco nele, e a restauração de foco dos painéis restaura para `<main>`

**Encontrado**: 2026-09-14, na primeira execução de Firefox e WebKit sobre os specs de papéis
(`015/STATE.md` §13 item 8 registrava que toda a medição do projeto era Chromium). Firefox não
revelou nada: 15/15 e 14/14 na primeira tentativa. WebKit revelou três falhas, todas de restauração
de foco, todas no caminho do **mouse**.

**Medido, não inferido.** A medição foi feita sobre um controle que não desmonta nada — o botão de
disclosure "Filtros" — justamente para excluir ciclo de vida do React da explicação:

| Motor | `document.activeElement` após clicar num `<button>` |
|---|---|
| Chromium | o próprio botão |
| Firefox | o próprio botão |
| WebKit | `<main tabindex="0">` — e continua assim mesmo quando o botão é explicitamente focado antes; o clique o desfoca |

**Consequência no produto**: `DetailPanel` (`packages/design-system/src/components/detail-panel.tsx`)
e `sheet.tsx` capturam `document.activeElement` no momento da montagem. No WebKit, no caminho do
mouse, o que está ali é `<main>` — então os dois restauram corretamente para `<main>`. Eles estão
fazendo exatamente o que foram escritos para fazer; o que difere é o que o navegador reporta.

**O caminho do teclado devolve o foco corretamente nos três motores**, e isso é afirmado
incondicionalmente por dois testes. É o caminho do mouse que diverge.

**Gravidade**: baixa. Não há perda de dado, não há vazamento, e o usuário de teclado — que é quem a
SC 2.4.3 protege — está correto em todos os motores. O que se perde é conveniência para quem clica
no WebKit.

**Não corrigido, e por quê**: a correção certa é o chamador passar o elemento gatilho explicitamente,
como o Radix faz, em vez de o painel adivinhar por `document.activeElement`. Isso é mudança em
`packages/design-system`, com 34+ chamadores de `ConfirmDialog` e dois de `DetailPanel` — escopo
próprio. Um remendo só na tela de papéis divergiria de todo painel irmão, que é o defeito que
CLAUDE.md §18.12 existe para impedir.

**Guarda existente**: `expectMouseFocusReturn`, em `apps/web/e2e/admin-roles.spec.ts`, afirma o
comportamento **medido** de cada motor. Ela falha se o Chromium regredir **e** falha se o WebKit
mudar — o comentário diz "apague este ramo, não o afrouxe". Nenhum `skip`, nenhuma asserção
enfraquecida.

**Resolução, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do coordenador:
investigar o mecanismo compartilhado da fase 013 antes de aceitar a conclusão do achado; corrigir se
couber num lugar só, fechar como aceito se exigir mudança por chamador).

- **O mecanismo compartilhado existe, e é exatamente um lugar só**:
  `packages/design-system/src/lib/use-restore-focus.ts` — `resolveDialogRestoreTarget` é a única
  função que resolve o alvo de restauração, usada tanto por `useDialogFocusRestore` (diálogos Radix)
  quanto por `DetailPanel` diretamente (`detail-panel.tsx:129`,
  `resolveDialogRestoreTarget(document.activeElement)`). Um só arquivo, não 53 cópias — a fase 013
  já fez a parte de centralização que o "Owner" original presumia ainda faltar.
- **Por que mesmo assim não cabe uma correção só ali, investigado, não presumido**: a entrada da
  função é sempre `document.activeElement`. O comportamento medido pela própria tabela do achado —
  WebKit relata `<main>` como `activeElement` depois de um clique de mouse num `<button>`, mesmo com
  o botão focado explicitamente antes — é a mesma característica de plataforma que a Safari/WebKit
  mantém há anos: cliques de mouse em controles que não são campo de formulário não movem o foco,
  a menos que "Acesso total pelo teclado" esteja ativado no sistema (comportamento documentado do
  WebKit, independente deste código). Consequência: no momento em que `resolveDialogRestoreTarget`
  roda, a informação "o botão foi clicado" **já não existe** em lugar nenhum que `document
  .activeElement` possa expor — não é um caso que a função possa detectar e corrigir por
  inferência, porque o dado de entrada nunca chega a carregar o fato.
- **A alternativa que tornaria isto corrigível num lugar só — e por que foi rejeitada**: um listener
  global de `pointerdown`/`mousedown` em fase de captura, dentro do próprio
  `use-restore-focus.ts`, rastreando "o que foi realmente clicado" independente do que o motor
  decide focar, tornaria a correção centralizável sem tocar nenhum chamador. Rejeitada
  deliberadamente: trocaria a fonte de verdade de "o que o navegador realmente focou" (confiável,
  nativa, correta hoje nos três motores para o caminho de teclado) por uma heurística nova, ativa
  globalmente, para os **três** motores — inclusive Chromium e Firefox, que já funcionam
  corretamente — para corrigir um sintoma de gravidade baixa, restrito ao mouse, restrito ao WebKit
  (que nem roda nesta máquina, F-4), e que não afeta o usuário de teclado que a SC 2.4.3 protege.
  O risco de regressão introduzido nos dois motores que já funcionam supera o ganho de conveniência
  no motor que não funciona.
- **A correção real permanece a que o achado já identificava**: o chamador passar o elemento
  gatilho explicitamente (como o próprio Radix faz), não o painel adivinhar por
  `document.activeElement`. Contagem de chamadores reconferida nesta rodada, não presumida do
  achado original: `grep -rl "ConfirmDialog" apps/web/src --include=*.tsx` — **36** arquivos;
  `grep -rl "DetailPanel" apps/web/src --include=*.tsx` — **17** arquivos. 53 pontos de chamada
  precisariam mudar sua própria assinatura de uso, não só o `use-restore-focus.ts` compartilhado —
  exatamente a classe "mudança por chamador" que a instrução desta rodada pediu para não decidir
  sozinho.

**Aceito, com a justificativa acima, registrada e não escondida**: gravidade baixa (sem perda de
dado, sem vazamento), usuário de teclado correto nos três motores, WebKit não roda nesta máquina de
desenvolvimento (F-4), e a guarda existente (`expectMouseFocusReturn`) já afirma o comportamento
medido sem afrouxar nada — continua fazendo exatamente esse trabalho. Nenhuma mudança de código
nesta rodada.

## F-70 — RESOLVIDO como propriedade de ambiente (mitigação de privilégio mínimo em vigor desde 2026-09-18; fechado 2026-09-19, rodada 023, Lote C) — contas de E2E se acumulam no banco, e uma suíte as cria detendo o papel mais privilegiado

**Encontrado**: 2026-09-14, ao conferir o estado do banco depois das execuções cross-browser. A
contagem de usuários subiu de 196 para 208 num dia — **nenhuma delas criada pelos specs novos desta
fase**, que criam apenas papéis e os excluem.

**Medido**: `apps/web/e2e/problems.spec.ts` provisiona contas `E2E Problem Completer …` e as deixa
no banco permanentemente. Elas aparecem na aba Usuários do painel de papéis — visíveis nas capturas
de revisão — **detendo `Platform Administrator`**, o papel que a fase 015 classifica como
privilegiado por conceder `role:administer`, `user:administer` e `org_unit:administer`.

**Causa estrutural**: não existe endpoint que exclua usuário
(`apps/api/src/core/identity/presentation/admin-users.controller.ts` tem `GET/POST/PATCH`,
`PUT roles`, `DELETE sessions` — e nada mais), e apagar direto no banco esbarraria em
`auditEventsAsActor`. Destruir trilha de auditoria para limpar dado de teste é o que CLAUDE.md §8 e
§18.9 proíbem. Então toda conta que um E2E cria é permanente, por desenho.

> **Correção (2026-09-14)**: a contagem acima está incompleta. `AdminUsersController` tem **oito**
> rotas, não cinco: `GET` (lista), `POST` (criar), `GET :userId` (detalhe), `PATCH :userId`,
> **`PUT :userId/status`**, `PUT :userId/password`, `DELETE :userId/sessions` e `PUT :userId/roles`.
> O parêntese original omitia `PUT .../status` e `PUT .../password` inteiramente. A conclusão do
> parágrafo não muda — nenhuma das oito é `DELETE :userId`, então "não existe endpoint que exclua
> usuário" continua verdadeiro —, mas a lista que a sustentava estava incompleta.

**Gravidade**: baixa em ambiente de desenvolvimento, **relevante como padrão**. É a mesma classe de
F-34. O ponto que a torna digna de registro não é o volume — é que a conta descartável nasce com o
papel de maior privilégio da plataforma, em vez do menor que serviria ao teste.

**Não corrigido**: `apps/web/e2e/problems.spec.ts` não pertencia a esta fase, e a decisão de fundo —
se a plataforma deve ter desativação/expurgo de identidade de teste, e como conciliá-la com a
imutabilidade da trilha — é decisão de produto sujeita a CLAUDE.md §16.

**Mitigação de baixo custo, se o defeito de fundo continuar aberto**: provisionar essas contas com o
menor papel que o cenário exigir, em vez de `Platform Administrator`.

> **Nota (2026-09-14)**: este achado é sobre **contas de usuário**, e só sobre isso. É diferente do
> "catraca" de `assets-processes.spec.ts:329`, corrigido em `bbae4bc` (ver resolução de F-72 acima):
> ali, a unidade organizacional raiz semeada acumulou 113 registros de `Asset` e 97 de `Process` por
> execuções repetidas de E2E e de `ui-capture.mjs`, o que é acumulação de **registros de domínio**,
> não de identidade — o mesmo mecanismo de F-29, sem relação com o papel que uma conta detém. A
> mensagem de commit de `bbae4bc` descreve essa acumulação como "ratcheted there by F-70", o que
> conflita os dois fenômenos; esta nota existe para que o próximo leitor não repita a confusão. F-70
> continua **ABERTO**, exatamente sobre o problema real de identidade: contas de E2E descartáveis
> nascendo com o papel mais privilegiado da plataforma.

> **Mitigação aplicada, 2026-09-18** (rodada 023, saneamento de findings, grupo 1 — local e seguro):
> exatamente a mitigação de baixo custo que este achado já prescrevia. `apps/web/e2e/problems.spec.ts`
> provisionava a conta descartável "E2E Problem Completer" com o papel `Platform Administrator`
> (`role:administer`/`user:administer`/`org_unit:administer`) para uma tarefa que só faz duas coisas:
> ver `/actions` e transicionar uma ação própria (`action:view`/`action:edit`). Trocado para o papel
> semeado `Problem Manager`, que já tem exatamente esses dois — nenhum papel novo criado. A função que
> provisiona a conta (antes `provisionGlobalAdmin`, hard-coded em "Platform Administrator") passou a
> aceitar o nome do papel como parâmetro (`provisionUserWithRole`), preservando escopo `GLOBAL`
> (metadado `globalScope` do seed não é imposto em runtime por `POST /admin/users` — confirmado, sem
> referência sob `core/authorization`/`core/identity`). Prova: `problems.spec.ts` completo, 5/5,
> incluindo o cenário que usa esta conta para completar a ação e permitir o fechamento do problema
> (segregação de função P3). **A causa raiz — não existir expurgo/desativação de identidade de teste —
> continua aberta**, por ser exatamente a decisão de produto que este achado já registrava como fora
> do escopo de correção mecânica (CLAUDE.md §16); não inventada aqui.

**Fechamento, 2026-09-19** (rodada 023, saneamento de findings — Lote C, decisão do coordenador:
fechar como propriedade de ambiente — a acumulação é consequência de a suíte rodar contra banco de
desenvolvimento persistente, a mitigação de privilégio mínimo já está em vigor, e expurgo
destrutivo de identidade é proibido por CLAUDE.md §8/§18.9, não uma correção pendente).

- **A propriedade, registrada como tal, não como defeito**: qualquer suíte E2E que provisiona uma
  conta real através da API administrativa real (a única forma correta, por CLAUDE.md §19.8 — nunca
  um caminho de dados paralelo) deixa uma linha `User` permanente sempre que rodar contra um banco
  que não é recriado do zero a cada execução — que é exatamente como este banco de desenvolvimento
  opera, deliberadamente, para permitir reexecução rápida entre sessões. Isso não é específico de
  `problems.spec.ts`; é verdade para `signInAsWorkerAdmin`, `provisionAuthJourneyAccount` e todo
  outro provisionamento deste diretório — `apps/web/e2e/support/admin-session.ts:833-840`
  ("Expected debris") já registra, para o caso irmão de `e2e-auth-journey-<uuid>@pharosgrc.local`,
  que "finding a pile of them is expected, not a leak to chase down".
- **A mitigação que estava em aberto já foi aplicada** (nota de 2026-09-18 acima): o papel mais
  privilegiado da plataforma deixou de ser o padrão para uma conta descartável — `problems.spec.ts`
  prova, ao vivo, que o papel mínimo que o cenário exige já é suficiente.
- **Por que a causa raiz não vira tarefa de código nesta rodada**: expurgo destrutivo de identidade
  esbarraria em `auditEventsAsActor` — apagar a linha do usuário apagaria (ou orfanizaria) a trilha
  de auditoria que suas ações escreveram, exatamente o que CLAUDE.md §8 ("histórico deve ser
  preservado quando necessário para fins de auditoria") e §18.9 (auditoria e sua imutabilidade nunca
  mudam silenciosamente) proíbem. Uma capacidade de "desativação" sem apagar histórico é decisão de
  produto real — precisaria de especificação própria (§16) — não algo a inventar dentro de um
  saneamento de registro.

Fechado: a propriedade está nomeada, a mitigação está em vigor e provada, e o que resta é
explicitamente decisão de produto futura, não dívida de correção.

## F-71 — RESOLVIDO (2026-09-14) — incompatibilidade de hidratação no shell autenticado deixa `aria-controls` apontando para elemento inexistente — **reproduz em produção no Firefox**

**Encontrado**: 2026-09-14, na travessia final da fase de correções de `/admin/roles`. Duas fases
anteriores já haviam relatado "aviso de hidratação intermitente" e o classificado como artefato de
desenvolvimento; a travessia mediu a **consequência**, que não é cosmética.

**Medido ao vivo**, não inferido:

- `/admin/roles`, `/risks` e `/controls` carregam com divergência de `useId` entre servidor e
  cliente — servidor `id="_R_75esnebmqaitmlb_"` contra cliente `id="_R_1pbn5ritmiitmlb_"`. A
  primeira divergência está no gatilho Radix do menu da conta, **no shell**, acima da página.
- Consequência observada em `/risks`, estável por 5 s: o botão "Filtros" fica com
  `aria-expanded="true"` e `aria-controls` apontando para um elemento **que não existe no
  documento**.
- Isso é violação WCAG 4.1.2, regra axe `aria-valid-attr-value`, **impact: critical**. É a causa
  das duas falhas de varredura de painel de filtro observadas em execução longa.

**Não causado pela fase de correções**: `filter-bar.tsx` e o shell não foram tocados. Mas a adoção
do `FilterBar` colapsável em `/admin/roles` **ampliou a exposição**, porque acrescentou mais um
consumidor do mesmo padrão de disclosure.

**O que falta para fechar o diagnóstico**: confirmar contra `next build` + `next start`. A medição
disponível foi feita com o servidor de desenvolvimento, e D-16 proíbe rodar o build com o dev server
de pé. Um `useId` divergente pode ser artefato de HMR — ou não ser, e neste caso a violação chega ao
usuário. **A pergunta não está respondida, e é a primeira coisa a fazer.**

**Gravidade**: se reproduzir em produção, é alta — violação crítica de acessibilidade em pelo menos
três telas, invisível para quem não usa tecnologia assistiva.

### Resolução — 2026-09-14 — a pergunta foi respondida: **não reproduz em build de produção**

O diagnóstico que faltava foi feito. O achado acima está **correto no que mediu** e é preservado
integralmente; o que muda é a classificação. A divergência de `useId` é real, a consequência
descrita é real, e **ambas só foram observadas no servidor de desenvolvimento** (todas as
reproduções, com `next dev --turbopack`). Num build de produção
(`next build` + `next start`), o mesmo laço de medição não a produziu **nenhuma vez em 165
carregamentos**, inclusive sob estrangulamento deliberado de CPU e rede.

**Protocolo**: `apps/web/.next` apagado antes de cada troca de modo (D-16 respeitado — o servidor de
desenvolvimento foi derrubado e a porta 3000 conferida vazia antes de construir, nunca presumida);
build com `API_INTERNAL_URL`/`APP_ORIGIN` na linha de comando (D-22 Trap 3); API de desenvolvimento
de pé na 3001 o tempo todo; nenhum bundle de desenvolvimento reaproveitado. Por carregamento
medem-se três coisas: o HTML **cru do servidor** (buscado com os mesmos cookies, sem JavaScript), o
DOM **depois da hidratação**, e o DOM **depois de abrir o painel de filtros** — mais o console do
navegador.

**Números medidos, um carregamento = uma das três telas (`/admin/roles`, `/risks`, `/controls`):**

| Ambiente | Carregamentos | `aria-controls` sem alvo | Erro de hidratação no console |
|---|---:|---:|---:|
| `next dev --turbopack`, frio, sem estrangulamento | 36 | **4** | **4** |
| `next dev --turbopack`, quente, sem estrangulamento | 133 | 0 | 0 |
| `next dev --turbopack`, CPU 6× | 36 | 0 | 0 |
| `next dev --turbopack`, CPU 6× + rede ~3G | 36 | **3** | **3** |
| `next dev` (webpack), **frio**, sem estrangulamento | 36 | 0 | 0 |
| `next dev` (webpack), quente, CPU 6× | 36 | 0 | 0 |
| **`next build` + `next start`, sem estrangulamento** | **129** | **0** | **0** |
| **`next build` + `next start`, CPU 6× + rede ~3G** | **36** | **0** | **0** |

Desenvolvimento com Turbopack: **8 falhas em ~244 carregamentos (≈3,3 %)**. Produção: **0 em 165**.
A uma taxa de 3,3 %, 165 carregamentos limpos seguidos têm probabilidade ≈0,4 % — a diferença entre
os dois ambientes não é ruído de amostragem.

**Varredura axe (`@axe-core/playwright`, `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`), painel de filtros
aberto, nos dois temas, nas três telas:**

- desenvolvimento: `/risks` **1 violação** em claro e 1 em escuro, `/controls` 1 em claro —
  `aria-valid-attr-value`, `impact: critical`, nó `.px-3\.5` (o botão de divulgação),
  `Invalid ARIA attribute value: aria-controls="_R_2ainebmqaitmlbH1_"`;
- produção: **0 violações** nas três telas, nos dois temas.

**Os identificadores exatos do achado original foram reproduzidos**, o que confirma que se trata do
mesmo defeito e não de outro parecido: em desenvolvimento, `/admin/roles` deu servidor
`_R_75esnebmqaitmlb_` contra painel cliente `_R_1pbn5ritmiitmlbH1_`, e `/risks` deu botão
`_R_2ainebmqaitmlbH1_` contra painel `_R_iklritmiitmlbH1_` — os mesmos valores registrados acima e
em `specs/015-roles-permissions-surface/STATE.md` §20.3.

**Causa raiz confirmada, com o diff do React em mãos** (capturado inteiro, não inferido). A primeira
divergência está de fato no gatilho Radix do menu da conta, exatamente onde o achado original disse:

```
<button data-slot="dropdown-menu-trigger" aria-label="Menu da conta de …" type="button"
+   id="radix-_R_29iitmlb_"      (cliente)
-   id="radix-_R_96aitmlb_"      (servidor)
```

e, mais abaixo na mesma árvore, o `FilterBar`:

```
<label
+   htmlFor="_R_1pbn5ritmiitmlb_"      <input
-   htmlFor="_R_75esnebmqaitmlb_"      +   id="_R_1pbn5ritmiitmlb_"
                                       -   id="_R_75esnebmqaitmlb_"
<button type="button" aria-expanded={false}
+   aria-controls="_R_1pbn5ritmiitmlbH1_"
-   aria-controls="_R_75esnebmqaitmlbH1_"
```

Ou seja: **a árvore inteira** — shell e página — recebe identificadores de `useId` deslocados, não
um componente específico. `useId` do React 19 é **posicional**: deriva do caminho até o nó na
árvore. O deslocamento começa acima de tudo o que a aplicação escreve, num ponto do enxerto entre a
raiz cliente do App Router e o HTML transmitido em fluxo. Todas as três telas transmitem o conteúdo
do registro fora de ordem (`<div hidden id="S:0">` no HTML do servidor, presente igualmente nos dois
modos), porque `/risks/page.tsx` e as suas equivalentes colocam a view do registro atrás de um
`<Suspense>` — a corrida é entre a chegada desse pedaço transmitido e o início da hidratação. Isso
explica por que o estrangulamento **de rede** é o que reabre a janela (3/36) enquanto o de CPU
sozinho não (0/36): o que importa é o atraso do fluxo de HTML em relação ao JavaScript, não a
lentidão do dispositivo.

A partir daí a consequência é mecânica, e é o que torna o sintoma visível: o React diz
explicitamente *"This won't be patched up"* para atributos. O botão **conserva o `aria-controls` do
servidor**; o painel só existe depois do clique e nasce com o `id` do **cliente**. Enquanto o painel
fica fechado os dois ambientes exibem um `aria-controls` sem alvo — o axe tolera isso pela sua
exceção documentada para `aria-expanded="false"` —, mas ao abrir, em desenvolvimento, o alvo
continua sem existir, e aí a violação é legítima.

**Hipóteses descartadas, cada uma com o motivo:**

- **Turbopack contra webpack** (a hipótese de que `dev` usa Turbopack e `build` usa webpack
  explicaria tudo) — **sugestiva, não estabelecida**, e é honesto dizê-lo. O que se mediu: no
  **mesmo** estado frio que deu 4/36 no Turbopack, o webpack deu **0/36** — se as taxas fossem
  iguais, 36 carregamentos limpos seguidos teriam ≈1,5 % de probabilidade, o que é indício, não
  prova, com uma amostra só. Nas condições em que o webpack pôde ser medido a quente (sem
  estrangulamento e com CPU 6×, 0/72), o **Turbopack também deu 0/72** — essas condições não
  discriminam nada. E a condição que reproduz com mais força, rede ~3G, **não pôde ser executada**
  no webpack: em desenvolvimento ele serve ~2260 módulos separados e `networkidle` nunca assenta
  dentro do tempo de navegação. O discriminador que ficou **provado** é outro, e é o que importa:
  **servidor de desenvolvimento contra build de produção**, sob estrangulamento idêntico (3/36
  contra 0/36).
- **`suppressHydrationWarning` no `<html>` mascarando remontagem** — descartada. Ele existe
  (`apps/web/src/app/layout.tsx`) e é exigido pelo `next-themes`, mas suprime o aviso **daquele nó**;
  o aviso que interessa foi emitido normalmente, com o diff completo, no `<button>` do menu da conta.
  Nenhum aviso foi escondido nesta investigação.
- **Componente do shell renderizando por estado só-cliente** — descartada. O diff do React não mostra
  nenhum ramo presente de um lado e ausente do outro: mostra o **mesmo** elemento com identificadores
  diferentes, e a diferença atravessa componentes sem relação entre si (Radix e `FilterBar`), o que é
  deslocamento de contexto de árvore, não renderização condicional.
- **`FilterBar` chamando `useId()` em ordem diferente entre os dois passes** — descartada.
  `filter-bar.tsx` chama `useId()` duas vezes, incondicionalmente, no topo do corpo do componente
  (linhas 143-144); e a divergência começa **acima** dele, no shell.
- **Artefato do arnês de captura (classificação C)** — descartada. A medição é comportamental —
  `document.getElementById(botão.getAttribute('aria-controls'))` no DOM real — e o mesmo arnês, com
  o mesmo código, dá 0 em produção e >0 em desenvolvimento.

**Classificação: (B) — exclusivo do servidor de desenvolvimento.** Não chega ao usuário. A gravidade
cai de "alta se reproduzir" para **operacional**: polui a medição local de acessibilidade.

**Nada foi corrigido no produto, deliberadamente.** A causa está no enxerto de hidratação do
App Router sob transmissão em fluxo, não em código desta casa; e mexer no `FilterBar` para
contornar um defeito que não existe em produção seria exatamente o remendo que §18.9 e §16 proíbem.

**Consequência para F-72**: as duas varreduras de painel de filtro que aquele achado cita como
falhando em execução longa têm **esta** causa, e ela é do ambiente. Isso não fecha F-72 — restam
`assets-processes.spec.ts:329`, os quatro primeiros de `admin-roles` no Firefox e, sobretudo, o
agravante real daquele achado (o portão que cancelou 73 testes e relatou "1 failed").

**O que o CI já faz certo, e onde fica a exposição**: `.github/workflows/ci.yml` constrói e sobe a
aplicação com `next start` e passa `PLAYWRIGHT_SKIP_WEB_SERVER=true` nos três jobs de E2E — o portão
de acessibilidade do CI **nunca** rodou contra o servidor de desenvolvimento e nunca esteve exposto a
isto. Quem está exposto é o caminho **local** padrão: `apps/web/playwright.config.ts` tem
`webServer: { command: 'pnpm dev' }`, e `pnpm dev` é `next dev --turbopack`.

**Recomendação (não executada — `playwright.config.ts` e `e2e/` são território de outra frente)**:
verificação local de acessibilidade deve reproduzir o que o CI faz, e não precisa de mudança nenhuma
de configuração para isso — basta subir a aplicação construída e apontar o Playwright para ela:

```bash
pnpm --filter @pharos/web run build      # com o dev server derrubado (D-16)
pnpm --filter @pharos/web exec next start
PLAYWRIGHT_SKIP_WEB_SERVER=true pnpm --filter @pharos/web exec playwright test
```

**Observação lateral, registrada e não corrigida**: com o painel **fechado**, `aria-controls` aponta
para um `id` que não existe — nos dois ambientes, em todos os carregamentos medidos, porque
`filter-bar.tsx` só monta o painel quando aberto. O axe aceita isso pela exceção de
`aria-expanded="false"`, e por isso nenhum portão acusa. Manter o painel sempre montado e apenas
oculto resolveria ao mesmo tempo essa referência pendente e a exposição descrita acima, já que botão
e painel passariam a nascer do **mesmo** passe de render. **Não foi feito**: é mudança de um
primitivo do Design System que dez telas compõem, e cabe a uma decisão própria sob §16, não a um
efeito colateral de uma investigação de causa.

### Reabertura (2026-09-14) — a reclassificação estava errada sobre o alcance: reproduz em produção, no Firefox

A resolução acima mediu corretamente e concluiu além do que mediu. Os **165 carregamentos limpos de
produção eram todos de um único motor**, o Chromium. Ninguém rodou a mesma medição nos outros dois.

Medido no mesmo dia, contra `next build` + `next start`, na varredura do painel de filtros:

| Motor | Produção |
|---|---|
| Chromium | **0 falhas** — 3 tentativas isoladas e 1 execução completa. Consistente com a resolução acima |
| **Firefox** | **3 ocorrências em 4 medições** — 1 na execução completa, 2 de 3 isoladas |
| WebKit | não mensurável localmente: a fixture compartilhada de `accessibility.spec.ts` não completa (a criação de relatório nunca navega) |

A violação é idêntica à do ambiente de desenvolvimento: `aria-valid-attr-value`, **impact:
critical**, nó `.px-3\.5`, `Invalid ARIA attribute value: aria-controls="_R_4klubr99fdbH1_"`.

**Conclusão corrigida**: o defeito **não é exclusivo do servidor de desenvolvimento**. Ele é
**dependente de motor**, e no Firefox **chega ao build de produção** — ou seja, ao usuário. A causa
raiz identificada na investigação original permanece válida e explica isto: o `useId` posicional do
React desloca-se no enxerto de hidratação sobre HTML transmitido em streaming, e a janela para isso
depende do escalonamento de cada motor. Chromium fecha essa janela quase sempre em produção;
Firefox não.

**O que isto promove a caminho de correção**: a "observação lateral" registrada logo acima deixa de
ser lateral. Manter o painel **sempre montado e apenas oculto** faz botão e painel nascerem do mesmo
passe de render, o que elimina tanto a referência pendente com o painel fechado quanto a divergência
de `id` no Firefox. É a correção indicada.

**Continua sem correção nesta entrada**, porque `filter-bar.tsx` é primitivo do Design System
composto por dez telas: exige regressão em todas elas, e a decisão é de §16. Nenhum atributo ARIA
foi removido, nenhum aviso de hidratação foi escondido.

**Lição de método, registrada porque este repositório já pagou por ela**: "0 em 165" é uma medição
forte e foi honesta — mas a conclusão que dela se tirou ("artefato de desenvolvimento") extrapolou a
população medida. A pergunta que faltou não era estatística, era de escopo: *um motor só responde
por "produção"?*

### Resolução — 2026-09-14 (`d85a7a6`) — o painel passa a existir em toda passagem de render, oculto por `hidden`

**O que mudou.** `filter-bar.tsx`
(`packages/design-system/src/components/data-table/filter-bar.tsx`) deixou de montar o painel só
quando aberto. O **elemento** do painel agora existe em toda passagem de render e é ocultado pelo
atributo `hidden`; o **conteúdo** dele continua só montando quando aberto — só o elemento muda,
porque o defeito inteiro vivia em dois atributos (`aria-controls` do botão e o `id` que ele nomeia).
A alternativa registrada acima ("manter o painel sempre montado") foi implementada primeiro e
quebrou `requirement-list-section.test.tsx` em menos de um minuto de suíte: uma opção oculta
rotulada "Não atendido" tornou um `getByText` sobre o estado de conformidade da linha ambíguo — nada
que um usuário visse mudou, e um teste real quebrou. Na forma final esse teste passa sem alteração.

`hidden` basta porque o `preflight` do Tailwind deste repositório já carrega
`[hidden]:where(:not([hidden='until-found'])) { display: none !important }` — lido no arquivo, não
presumido — então a classe de exibição é descartada e o navegador aplicaria a regra de qualquer
forma. É o `display:none` que mantém o painel fechado fora da ordem de tabulação e fora da árvore de
acessibilidade; `aria-hidden` ou recorte fora da tela deixariam os controles ainda alcançáveis por
teclado, o que seria pior que o defeito corrigido. Nenhum atributo ARIA foi removido, nenhum
`suppressHydrationWarning`, nenhum aviso de hidratação escondido, nenhuma dependência nova.

**Evidência medida** (produção, 4 cargas concorrentes, 40 por tela por motor, antes → depois):

| Medição | Antes | Depois |
|---|---:|---:|
| `aria-controls` pendurado, painel **fechado** (3 motores) | **232 de 232** | **0** |
| `aria-controls` pendurado, painel **aberto**, Firefox | **59 de 76** | **0** |
| Portão do projeto (Firefox) | DISCOVERED 15 / EXECUTED 11 / PASSED 6 / FAILED 5 / NOT RUN 4 | Chromium+Firefox: **30 descobertos, 30 executados, 30 passaram** |

Mesmo nó e mesmo identificador do achado original, confirmando que é o mesmo defeito e não um
parecido.

**Lição de método** (par da lição de reabertura registrada acima): a reabertura corrigiu um erro de
**população** — um motor só não representa produção. Esta resolução encontrou o par dele, um erro de
**instrumento**: o portão não ficava calado porque a tela estava correta, ficava calado porque a
regra `aria-valid-attr-value` se recusa a opinar na presença de `aria-haspopup` (ver F-74, achado
irmão nos mesmos moldes). "Zero violações" só significa algo depois de perguntar o que a ferramenta
se recusa a examinar.

**`disclosure-group.tsx` NÃO recebeu esta correção**, deliberadamente.
`packages/design-system/src/components/disclosure-group.tsx` tinha, antes desta resolução, um
comentário afirmando "fechado significa fora do documento, igual ao `FilterBar`" — essa premissa
deixou de ser verdadeira no instante em que `FilterBar` passou a ocultar em vez de desmontar. O
comentário foi reescrito (só comentário, nenhum comportamento) para registrar que `DisclosureGroup`
tem o **mesmo mecanismo latente** e continua **sem correção**: montar sempre o conteúdo, ali, tornaria
o catálogo de permissões inteiro parte de toda renderização — para os três consumidores de
`/admin/roles` (`apps/web/src/features/admin/components/roles/role-detail-panel.tsx`,
`role-edit-fields.tsx` e `role-permissions-tab.tsx`), isso é o painel de permissões completo, não um
punhado de controles de filtro. A troca de custo/exposição é diferente da de `FilterBar`, e decidir
por ela é decisão de CLAUDE.md §16, não efeito colateral desta correção. Se `DisclosureGroup` for
algum dia composto numa rota que transmite HTML em streaming com o painel abrível, o mecanismo que
produziu F-71 se aplica a ele identicamente — registrado no próprio comentário do componente.

## F-72 — RESOLVIDO (2026-09-14) — a suíte E2E não passa inteira numa execução única, e o portão de acessibilidade mascara isso

**Encontrado**: 2026-09-14, na regressão final, ao medir o que fases anteriores mediram fatiado.

**Medido**: a execução completa de E2E em Chromium deu **123 passaram / 1 falhou / 73 não
executaram**. Fatiada, tudo passa — 196 verdes mais 1 isolado. **Nenhuma execução única passou a
suíte inteira.** Três specs independentes falham apenas em sessão longa e passam isolados:
`assets-processes.spec.ts:329`, as duas varreduras de painel de filtro (ver F-71) e os quatro
primeiros de `admin-roles` no Firefox.

**O agravante, e a razão de isto ser um achado e não uma nota**: o `mode: 'default'` aplicado ao
bloco de papéis de `accessibility.spec.ts` **não o desacopla de verdade**. Uma falha no teste nº 45
cancelou os 73 seguintes — **as 14 varreduras de papéis inclusive**. O relatório do Playwright disse
"1 failed", quando o que aconteceu foi "1 falhou **e o portão de papéis não foi medido**".

Esta é a mesma classe de F-28: um portão que reporta honestamente sobre algo que não chegou a ver.
A diferença é que aqui o número parece bom.

**Consequência prática**: qualquer afirmação de "E2E verde" baseada numa execução única precisa ser
lida com o número de testes **executados**, não só o de falhas. Um `197/197` obtido fatiando não é a
mesma coisa que um `197/197` numa passada.

**Não corrigido**: separar o que é instabilidade de sessão longa (limitador global F-59? estado
acumulado de banco? vazamento de contexto de navegador?) do que é o defeito de F-71 exige
investigação própria. Acrescentar `retries` ou fatiar o job de CI esconderia o problema em vez de
responder à pergunta — e "o limite está certo, quem está errado é o volume" (F-59) vale aqui também.

### Resolução — 2026-09-14 (`bbae4bc`) — a causa era herança de `mode: 'serial'`, não sessão longa

**Causa raiz, medida com uma sonda de quatro testes em vez de presumida**: `mode: 'serial'` é
**herdado** — um `describe` filho não consegue sair dele. Quando um teste falha, o Playwright sobe a
árvore procurando uma suíte serial e cancela o resto **daquela suíte inteira** — e com `configure` no
nível do arquivo, a subida sempre encontrava o arquivo inteiro. O `mode: 'default'` que uma fase
anterior tinha aplicado ao bloco de papéis descrevia como ele roda, não a qual grupo ele pertence, e
por isso não desacoplava nada. Não era `maxFailures`, não era `globalSetup`, não era o `beforeAll`
compartilhado.

**Correção**: o `configure` serial moveu para dentro do único bloco que de fato compartilha a fixture
cara. Login e o bloco de papéis ficam fora dele. Nenhum `skip`, nenhum `retries`, nenhum
`maxFailures`, nenhum "continuar apesar do erro".

**Novo instrumento**: `execution-ledger-reporter.ts`
(`apps/web/e2e/support/execution-ledger-reporter.ts`) imprime DISCOVERED · EXECUTED · PASSED ·
FAILED · FLAKY · SKIPPED · NOT RUN · INTERRUPTED, nomeia cada teste dos dois últimos grupos e confere
que os grupos somam o total descoberto — a partir da própria classificação do Playwright
(`generateSummary`), para que os dois nunca possam discordar. Ele falha o processo quando o veredito
não é verde, então uma execução com zero falhas mas um teste que nunca rodou termina com código de
saída diferente de zero. Também fecha a Armadilha 4 de D-22: um skip por credencial ausente ganha
linha própria e derruba o veredito.

O próprio instrumento pegou um buraco nele mesmo no primeiro uso real: um `globalSetup` lançou
exceção, zero testes foram coletados, todo grupo leu 0, e ele imprimiu VERDE sobre um `failed` do
Playwright — exatamente a classe de F-72 reproduzida pela guarda escrita para preveni-la. Corrigido,
e registrado no próprio arquivo em vez de remendado em silêncio.

**A "instabilidade de sessão longa" não era isso.** `assets-processes.spec.ts:329` filtra pela
unidade organizacional raiz semeada, que hoje sustenta 113 ativos e 97 processos, e o registro
recém-criado caia na página 5 de 5 — a mesma forma de F-29, cuja causa é a acumulação de registros de
Ativo/Processo por execuções repetidas de E2E e de `ui-capture.mjs` (ver a nota datada em F-70
abaixo: **este é um "catraca" diferente do de F-70** — sobre registros de domínio Ativo/Processo, não
sobre contas de usuário; a mensagem de `bbae4bc` atribui esta acumulação a F-70 por engano, e a
correção deste texto é exatamente para não perpetuar essa confusão). Tornou-se permanente no dia em
que aquela unidade passou de 25 registros; "só falha em
sessão longa" era coincidência de agenda de execução, não concorrência real. Corrigido ordenando pela
última atualização através do controle real da tela, mais uma asserção de que a caixa de busca está
vazia, para que o caminho de busca não vire silenciosamente o caminho de listagem.

**Medido, `bbae4bc`**: com a mesma seleção de testes (`--grep`) dos dois lados e uma falha injetada —
estrutura antiga: 19 descobertos, 1 executado, 18 NOT RUN (as 14 varreduras de papéis entre eles);
estrutura nova: 19 descobertos, 15 executados, 14 passaram, 4 não rodaram (só o resto do bloco que
falhou). E, sem falha injetada, a "Run E": **198 descobertos, 198 executados, 198 passaram, 0 não
rodaram, saída 0** — pelo próprio registro deste projeto, a primeira vez que a suíte Chromium inteira
executou e passou numa única passagem. `specs/015-roles-permissions-surface/STATE.md` §15.2 tinha
registrado que nenhuma execução única jamais passava inteira; deixou de ser verdade.

**Snapshot de fechamento — regressão final em 2026-09-14, HEAD `be6b734`** (números reportados pela
sessão de implementação; registrados aqui como instantâneo datado, não como afirmação permanente —
ver aviso no topo deste documento sobre não requerer nova execução para reabrir um achado já
fechado): Web unit 1013/1013 (confirmado por mensagem de commit de `d85a7a6`), API unit 661/661
(confirmado por mensagem de commit — "API unit 656 → 661"), integração 297/297 (confirmado — "Integration
295 → 297" em `5b56eea`, "integration 59 / 297" em `be6b734`), contrato 827/827 (confirmado — "Contract
58 files / 827 tests" em `be6b734` e `d85a7a6`), E2E Chromium 198/198 (confirmado pela Run E de
`bbae4bc` acima), `admin-roles` Firefox+WebKit 32/32, 105 varreduras axe com zero falhas,
lint/typecheck/format:check/openapi:check limpos, nenhum teste "not run" inesperado. Os dois últimos
números do parágrafo (32/32 e as 105 varreduras) e os quatro portões de qualidade **não** foram
reproduzidos de forma independente por quem escreve este registro — não há execução de teste nesta
sessão de documentação — e ficam como o relato da sessão de implementação, coerente com o que o
histórico de commits permite conferir.

## F-73 — RESOLVIDO (2026-09-14) — `PUT /admin/users/{userId}/roles` devolvia dados pessoais a quem tem apenas `role:administer`

**Encontrado**: 2026-09-14, ao escrever a guarda de 2A (`role:administer` não implica
`user:administer`). A varredura percorre **toda** operação `/api/v1/admin/users**` registrada em
`apps/api/openapi.json` — não uma lista escrita à mão — e exige `403` para quem não tem
`user:administer`. Uma operação respondeu `2xx`, legitimamente.

**Medido**: `PUT /admin/users/{userId}/roles` é declarado no contrato
(`specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`, tag `Roles`) como exigindo
**`role:administer`**, e não `user:administer` — diferente de todas as demais rotas de usuário. A
escolha é deliberada e está documentada no cabeçalho de `AdminUsersController`: atribuir papel é
administração de papel, não de usuário.

**O problema não é a permissão exigida, é a resposta.** A rota devolve `UserDetailResponse` —
`fullName`, `email`, `jobTitle`, `status`, `primaryOrgUnit`, `roles` e `scopeGrants`. Ou seja, um
operador que tem `role:administer` e **não** tem `user:administer` obtém, por esta rota, exatamente
a classe de dado que FR-018/FR-019/FR-020 existem para manter fora do alcance dele. A tela de papéis
respeita a fronteira e não monta o componente que lista pessoas; esta rota a contorna sem querer.

**Atenuante real**: para chamar a rota é preciso já conhecer o `userId`, e a superfície é um usuário
por requisição — não é enumeração. Nada aqui é vazamento em massa.

**Guardado, não corrigido**: o teste
`apps/api/test/integration/role-administer-user-boundary.spec.ts` **fixa esta rota como a única
exceção**. Se uma segunda rota de usuário passar a ser alcançável por `role:administer`, o teste
falha nomeando-a. E um caso separado prova que esta rota alcança o próprio handler (404 para usuário
inexistente) em vez de ser recusada por permissão — para que a exceção não vire um álibi.

**Por que não corrigido nesta rodada**: estreitar a resposta é mudança de contrato — trocar
`UserDetailResponse` por algo que devolva só o que a operação precisa confirmar (o conjunto de
papéis resultante). Isso é decisão de produto sob CLAUDE.md §16, com impacto em `api-types`, no
portão de contrato e em qualquer consumidor, e a rodada em curso era de saneamento de guardas, não
de redesenho de contrato.

**Saída recomendada**: devolver, desta operação, apenas a identificação mínima e a lista de papéis
resultante — nunca `email`, `jobTitle`, `primaryOrgUnit` nem `scopeGrants`. Quem precisa do detalhe
do usuário já tem `GET /admin/users/{id}`, corretamente protegido por `user:administer`.

### Correção (2026-09-14) — minimização de representação, não remodelagem de autorização

> "A autorização para administrar atribuições de papéis permanece `role:administer`. A correção
> restringe a representação retornada pela operação e não amplia nem reduz a capacidade de
> autorização."

**O que mudou.** A operação passou a responder o esquema novo `UserRoleAssignment`
(`specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`) em vez de `UserDetail`: dois
campos, `userId` e `roles` (cada papel com `id` e `name`), e `additionalProperties: false`. Nada
mais. O `userId` é o próprio parâmetro de caminho que o chamador já forneceu, e identidade de papel
é exatamente o que `role:administer` já lê inteira por `GET /admin/roles` — ou seja, a resposta não
entrega ao chamador nenhum dado que ele já não pudesse obter legitimamente. No servidor, o
`replaceRoles` de `AdminUsersController` mapeia por `toUserRoleAssignmentResponse`
(`core/identity/presentation/dto/admin-user-response.mapper.ts`), construída listando os dois campos
explicitamente e **não** por remoção de chaves de `toUserResponse` — um campo acrescentado a
`UserResponse` amanhã não pode vazar por herança.

**O que não mudou**, e foi verificado em vez de assumido: `@RequirePermission('role:administer')`
continua na rota; `PermissionGuard` não foi tocado; `GET /admin/users/{userId}`, `PATCH
/admin/users/{userId}` e `PUT /admin/users/{userId}/status` continuam exigindo `user:administer` e
recusando (`403`) a identidade que detém só `role:administer` — inclusive para o mesmo usuário-alvo
a quem ela acabou de atribuir um papel com sucesso.

**Consumidores, levantados por busca e não por memória.** O único chamador de produção é
`apps/web/src/features/admin/components/users/user-roles-dialog.tsx`, cujo pai
(`user-admin-view.tsx`) descarta o argumento de `onSaved` e recarrega a lista. Nenhum campo da
resposta era lido por ninguém, então a minimização não empurrou consumidor algum para outro
endpoint nem criou requisição extra. Os demais usos são de fixture (`apps/web/e2e/admin-roles.spec.ts`
verifica só `ok()`/status) e de teste de API. O tipo do cliente web passou a ser `UserRoleAssignment`
(`features/admin/types.ts`), o que torna a fronteira também estática: não há campo pessoal a ler.

**Prova.** `apps/api/test/integration/role-administer-user-boundary.spec.ts` — a mesma guarda que
fixa esta rota como a única exceção alcançável — ganhou dois casos. O primeiro atribui um papel a um
usuário real, com uma identidade que detém `role:administer` e **não** `user:administer`, e afirma o
**conjunto exato de chaves** da resposta (`['roles','userId']`, e `['id','name']` em cada papel), não
uma lista de campos proibidos: a forma exata falha também para um campo que ninguém pensou em
proibir. O segundo prova que as rotas que de fato devolvem `UserDetail` continuam fechadas para essa
identidade. `apps/api/test/contract/admin-users.spec.ts` afirma o mesmo conjunto exato no nível de
contrato. E há uma terceira guarda, automática e sem custo de manutenção: o
`additionalProperties: false` do esquema é validado pelo harness de resposta
(`test/contract/support/auto-validate-responses.ts`) em **toda** requisição que qualquer teste faça a
esta operação.

**Não-vacuidade, medida.** (1) Revertendo o mapeamento para `toUserDetailResponse`: integração
1 falhou / 7 passaram, contrato 1 falhou / 8 passaram — com o validador de esquema apontando
`additionalProperty: "scopeGrants"` por conta própria. (2) Acrescentando à resposta minimizada um
campo que nenhuma lista negra citaria (`lastLoginAt`): as duas guardas falham, a asserção de
conjunto com `expected ['lastLoginAt','roles','userId'] to deeply equal ['roles','userId']`. Ambas
restauradas em seguida.

`apps/api/openapi.json` não precisou ser regenerado — ele reflete decoradores NestJS no nível de
rota e não carrega esquema de resposta (D-14); `openapi:check` confirmou que continua atual.
`packages/api-types` foi regenerado pelo script do projeto.

## F-74 — RESOLVIDO (2026-09-14, `d85a7a6`) — `MultiSelectFilter` e `ColumnVisibilityMenu` tinham o mesmo `aria-controls` pendurado de F-71, e o axe não via porque `aria-haspopup` desativa a regra

**Encontrado**: 2026-09-14, investigando F-71 — ao considerar manter o painel do `FilterBar` sempre
montado em vez de ocultá-lo, ficou claro que `MultiSelectFilter`
(`packages/design-system/src/components/data-table/multi-select-filter.tsx`) e
`ColumnVisibilityMenu` (`packages/design-system/src/components/data-table/column-visibility-menu.tsx`)
têm gatilhos com a mesma forma: `aria-controls` nomeando um popover que só nasce quando aberto.

**Medido, não presumido**: com o painel do `FilterBar` mantido sempre montado (a alternativa
descartada em F-71), os gatilhos desses dois componentes passariam a ser renderizados no HTML do
servidor pela primeira vez — mesmo defeito, um nível abaixo. Medido diretamente: **22 de 32** cargas
Firefox, quatro gatilhos, com `aria-controls` pendurado **com o popover aberto**.

**E este já alcançava produção, sem que nenhum portão visse.** A regra axe `aria-valid-attr-value`
rebaixa `aria-controls` para "needs review" (não relata violação) em qualquer elemento que também
carregue `aria-haspopup` — presente nos dois componentes, ausente no botão de divulgação do
`FilterBar`, que é exatamente por isso que só o botão de divulgação já tinha falhado algum portão.
Nas cinco telas com `FilterBar` inline, esses gatilhos **já eram renderizados no servidor** antes de
qualquer coisa desta correção. Medido contra o build de produção **pré-correção**, em `/incidents`:
**25 de 32** cargas Firefox com `aria-controls` pendurado, e o axe reportando **zero violações** —
um defeito real de acessibilidade, em produção, que nenhum portão deste projeto poderia ter
reportado, porque a regra que deveria acusá-lo se cala na presença de `aria-haspopup`.

**Correção**: mesmo tratamento de F-71 — o elemento do popover passa a existir em toda passagem de
render, oculto por `hidden`; o conteúdo continua só montando quando aberto. Depois: **0 de 96**
cargas, nos três motores.

**Lição, e é a mesma do fechamento de F-71**: "zero violações" do axe não cobre um elemento que
carrega `aria-haspopup` para esta regra — o rebaixamento para "needs review" nunca aparece como
falha, então um portão que só conta falhas relata limpo sobre um defeito real.

## F-75 — RESOLVIDO 2026-09-18 (rodada 023, saneamento de findings) — não existe E2E cobrindo a linha de papéis da tela de Perfil

**Encontrado**: 2026-09-14, verificando cobertura de teste da tela de Perfil ao fechar a fase 015.

**Medido**: `apps/web/e2e/auth.spec.ts` navega para `/profile` e afirma apenas que o e-mail do
usuário está visível (`await expect(page.getByText(email)).toBeVisible()`); nenhum outro spec sob
`apps/web/e2e/` visita `/profile`. A linha "Papéis" do cartão de identidade
(`apps/web/src/app/(app)/profile/profile-view.tsx`) — a que ADR-022 e `09d9e50` passaram a resolver
por `roleDisplayName`, e cujo comportamento em pt-BR está provado apenas por
`profile-view.test.tsx` (teste de unidade, DOM simulado) — nunca é exercitada num navegador real.

**Gravidade**: baixa a moderada. O comportamento tem prova de unidade real (`09d9e50` acrescentou
`profile-view.test.tsx`, que não existia antes), mas nenhuma prova de navegador — a mesma lacuna de
classe que F-28 (gráficos do dashboard) e a violação de `aria-controls` de F-71 exploraram: um defeito
visível só em DOM real, não em teste simulado, não teria guarda nenhuma aqui.

**Não corrigido**: acrescentar esse E2E estava fora do escopo das tarefas que fecharam F-71/F-72/F-73
nesta sessão de documentação, que é documentação, não implementação (regra do próprio agente que
escreve este registro). Fica para a próxima tarefa que tocar `apps/web/e2e/auth.spec.ts` ou a tela de
Perfil: cobrir, com uma identidade que detenha um dos seis papéis que só `common.roleDisplayNames`
traduzia corretamente depois de `09d9e50` (por exemplo, Compliance Manager ou Audit Lead — a mesma
recomendação que `09d9e50` já tinha deixado registrada, sem chegar a executá-la, por indisponibilidade
do ambiente de verificação renderizada naquele momento).

**Resolução**: `apps/web/e2e/auth.spec.ts` ganhou o teste "the profile screen shows a role name
translated to pt-BR, not the raw English seed value (F-75)" — exatamente a recomendação registrada:
provisiona uma conta com o papel "Compliance Manager" (um dos seis que `09d9e50` corrigiu),
autentica através do fluxo real de primeira sessão (`signInAsFreshlyProvisionedUser`), abre
`/profile` e confirma que a linha "Papéis" mostra "Gestor de Compliance" — nunca o literal em inglês
"Compliance Manager". Prova em DOM real, fechando exatamente a lacuna que a entrada descrevia
(F-28/F-71's própria classe: defeito visível só em DOM real). `apps/web/e2e/auth.spec.ts` completo:
2/2.

## F-76 — RESOLVIDO 2026-09-18 (rodada 023, saneamento de findings) — comentário de `admin-roles.spec.ts:40` cita um arquivo de teste que nunca existiu

**Encontrado**: 2026-09-14, conferindo referências cruzadas de `apps/web/e2e/admin-roles.spec.ts`
contra o disco.

**Medido**: o comentário de cabeçalho do arquivo, na tabela que mapeia cenário → onde é provado, diz
para os cenários 5 e 6 (recusa de renomear/trocar permissões de papel de sistema):
`` `apps/api/test/integration/role-admin.spec.ts` ``. Esse arquivo **nunca existiu** —
`git log --all -- apps/api/test/integration/role-admin.spec.ts` não retorna nenhum commit. Os
cenários 5 e 6 vivem, de fato, na suíte de **contrato**:
`apps/api/test/contract/admin-roles.spec.ts:249` e `:266`.

`specs/015-roles-permissions-surface/STATE.md` **já registra** este mesmo defeito (linha ~228, na
tabela de cenários servidor-vs-navegador): "a primeira versão desta tabela estava errada em dois
deles: citava um `apps/api/test/integration/role-admin.spec.ts` que **não existe**... Corrigido antes
de este documento ser fechado". Ou seja, a tabela **dentro do STATE.md** já foi corrigida; o
comentário **dentro do arquivo de teste** (`apps/web/e2e/admin-roles.spec.ts:40`) nunca foi.

**Por que isto fica registrado aqui e não corrigido**: `apps/web/e2e/admin-roles.spec.ts` é código de
teste — comentário incluído —, fora do território desta sessão de documentação, que é
proibida de editar código, teste ou comentário de teste. A correção é de uma linha, trivial: trocar
a referência por `apps/api/test/contract/admin-roles.spec.ts:249,266`. Fica para a próxima tarefa que
tocar esse arquivo.

**Resolução**: exatamente a correção de uma linha já prescrita, com evidência de que a nova
referência é correta antes de escrevê-la (`apps/api/test/contract/admin-roles.spec.ts:249-266`
confirmado como o teste "refuses every write to a system role — name, description and permission set
alike (422)", que cobre os cenários 5 e 6). `apps/web/e2e/admin-roles.spec.ts:40` agora cita
`apps/api/test/contract/admin-roles.spec.ts:249,266`. Suíte completa de `admin-roles.spec.ts`: 16/16.

---

## F-77 — NÃO REPRODUZ (medido ao vivo em 2026-09-18, saneamento 023) — o anel de foco de teclado não pinta em nenhum controle baseado no `Button` desta casa, em todo o produto

**Encontrado**: 2026-09-16, durante a verificação renderizada de `specs/016-risk-detail-experience`,
ao conferir se os atalhos novos da coluna contextual continuavam operáveis por teclado depois de
virarem link.

**Medido**, com `Tab` real (não `.focus()` programático, que não dispara `:focus-visible` no
Chromium) e leitura de estilo computado do `document.activeElement`:

| Elemento | Tela | `outline-style` | camadas de `box-shadow` |
|---|---|---|---|
| Atalho "Registrar avaliação" (introduzido pela fase 016) | detalhe de risco | `none` | todas transparentes |
| Botão "Editar" | detalhe de risco | `none` | todas transparentes |
| Botão "Novo risco" | **registro de riscos — tela não tocada pela fase 016** | `none` | todas transparentes |
| Link "Controles" do menu lateral | **shell — não tocado pela fase 016** | `none` | **pintadas**: `rgb(255,255,255) 0 0 0 2px, rgb(23…)` |

Em todos os casos `el.matches(':focus-visible')` retorna `true` — o estado é reconhecido; o que não
acontece é a pintura. As classes envolvidas são
`focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`: `outline-none`
zera o contorno nativo, `outline-width` fica em 3px e `outline-color` recebe a cor do anel, mas
`outline-style` permanece `none`, e as camadas de anel em `box-shadow` resolvem transparentes. O
resultado é que **o contorno nativo do navegador é removido e nada é pintado no lugar.**

O menu lateral é a prova de que o problema não é do tema nem do navegador: ali o anel pinta, porque
aquele componente tem tratamento de foco próprio, e não o do `Button`.

**Por que não foi corrigido na fase 016**: é pré-existente e vale para o produto inteiro — a fase
mediu o mesmo resultado em `/risks` e no shell, telas que ela nunca abriu. Os controles que ela
introduziu herdaram o tratamento que todo `Button` já tinha; ela preservou o comportamento, não o
piorou (CLAUDE.md §18.8 exige preservar ou melhorar). Corrigir significa alterar a aparência de
foco de **todas** as telas do produto de uma vez, o que é mudança visual ampla e merece decisão,
plano e verificação renderizada próprios — não um conserto de fim de rodada dentro de um trabalho
escopado a uma tela.

**Por que nenhuma guarda pegou isto**: `@axe-core/playwright` não avalia visibilidade de foco —
2.4.7 (Focus Visible) não é uma regra que o axe decide automaticamente. Os testes de teclado desta
casa verificam **onde** o foco está (`toBeFocused`), nunca se ele é **visível**. Um teste que passa
contra o código certo e contra o errado não protege nada (CLAUDE.md §18.8); estes passam contra os
dois.

**Como confirmar antes de corrigir**: `Tab` real até o controle, depois ler
`getComputedStyle(document.activeElement)` e conferir `outlineStyle` e `boxShadow`. Comparar com o
link do menu lateral, que é o caso que funciona. Medir nos dois temas — esta medição foi feita
apenas no tema claro.

**Impacto**: WCAG 2.1 SC 2.4.7 (Focus Visible), nível AA, que `CLAUDE.md` §18.8 lista entre as
garantias a preservar. Afeta qualquer pessoa que navegue por teclado, em todas as telas do produto.

**Medição ao vivo antes de qualquer correção, 2026-09-18** (rodada 023, saneamento de findings,
instrução explícita do usuário: medir de verdade antes de decidir grupo, `Tab` real, nunca
`.focus()` programático). Reproduzi a metodologia exata do achado — `Tab` real seguido de leitura de
`getComputedStyle` do `document.activeElement` — contra o **mesmo botão "Editar" do detalhe de
risco** que a tabela original mediu como `outline-style: none` com todas as camadas de `box-shadow`
transparentes.

**Resultado: não reproduz.** `box-shadow` computado:
`oklab(0.310152 -0.0199116 -0.0555648 / 0.5) 0px 0px 0px 3px` — uma cor real, opacidade 50%, halo de
3px, não transparente. Confirmado visualmente por captura de tela real do botão focado (não apenas
lido via CSS, como o usuário pediu): o anel azul-marinho é claramente visível ao redor do botão.
`:focus-visible` também `true`, como antes.

**Uma armadilha de medição descoberta no processo, registrada para não se repetir**: a PRIMEIRA
tentativa, lendo o estilo computado imediatamente após o `Tab`, capturou um valor de opacidade
minúsculo (`0.0165` em vez de `0.5`, halo de `0.098px` em vez de `3px`) — pareceria "quase
transparente" se relatado sem investigar mais. A classe base do `Button` inclui `transition-all`
(Tailwind), então o `box-shadow` do anel ANIMA de 0 até o valor final ao ganhar foco; ler o estilo
computado no mesmo instante do evento de teclado captura um quadro no meio da transição, não o
estado assentado. Esperar ~400-500ms antes de ler resolve isso — tempo bem abaixo do que um usuário
percebe como "o anel não apareceu". **Isso pode ser exatamente o que aconteceu na medição original
de 2026-09-16** — a tabela daquele achado não registra ter esperado a transição assentar antes de
ler `outlineStyle`/`boxShadow`, e meus próprios números pré-espera batem com a descrição "todas
transparentes" da tabela original.

Testado: botão "Editar" (detalhe de risco, o elemento nomeado no achado), botão "Filtros" (registro
de riscos, `<button>` puro), link "Novo risco" (`Button asChild` envolvendo um `<Link>`) — os três
pintam corretamente depois de assentar, nos dois temas (claro e escuro).

**Não corrigido, porque não há mais nada para corrigir no que foi medido**: nenhuma mudança de
código foi feita neste achado. Mantenho **ABERTO → NÃO REPRODUZ**, não fechado como
"resolvido", porque (1) não identifiquei o commit/mudança que resolveu isto entre 2026-09-16 e agora
— pode ter sido uma atualização de dependência (Tailwind/Radix) alheia a qualquer correção
intencional, e (2) só testei três controles, dois temas, uma resolução — não a varredura completa
que T203 ainda é dono de fazer. Se um controle específico ainda mostrar o anel realmente ausente
(não apenas em transição), isso é um achado novo e mais estreito, não este.

**Corroboração independente, 2026-09-18** (o coordenador, medindo por conta própria antes de aceitar
"não reproduz" num achado de acessibilidade aberto há dois meses). A primeira tentativa do
coordenador **contradisse** a medição acima — `box-shadow` transparente em todas as amostras, no
mesmo botão "Editar". A causa: o instrumento truncava `cs.boxShadow` em 60 caracteres, e a camada do
anel é a **quarta** — as três primeiras (transparentes por padrão do Tailwind) foram lidas como se
fossem a resposta inteira. Refeita sem truncar, a mesma transição foi capturada em três pontos no
tempo, confirmando com números exatos a hipótese de "quadro intermediário" acima:

```
t=0ms     oklab(0 0 0 / 0)                    0px 0px 0px 0px      ← início da transição
t=50ms    oklab(0.310152 … / 0.3478)          0px 0px 0px 2.0868px ← meio da transição
t=120ms+  oklab(0.310152 … / 0.5)             0px 0px 0px 3px      ← assentado, pinta
--tw-ring-shadow: 0 0 0 calc(3px + 0px) color-mix(in oklab, #17324d 50%, transparent)
```

O anel pinta — 50% de opacidade, 3px, estável a partir de ~120ms — confirmado agora por **duas
medições independentes**. Em t=0 a camada está em `0 / 0` a 0px, exatamente o que uma leitura no
instante do `Tab` captura; a medição original de 2026-09-16 quase certamente fez isso, sem esperar a
transição assentar.

**Que fique explícito, para quem ler este registro depois**: **nenhum código foi alterado por esta
entrada.** Isto não é "corrigido" — é "o defeito relatado não existe hoje, e eis por que a medição
original o viu". Duas pessoas, dois instrumentos, o mesmo erro de medição (ler no instante do evento
contra um componente com `transition-all`) reproduzido de forma independente — o registro serve
agora como aviso para a próxima medição de foco visível deste projeto, não apenas para este achado.

---

## F-78 — RESOLVIDO 2026-09-18 (rodada 023, saneamento de findings) — o backoff de login dos E2E engole o próprio diagnóstico quando o `Retry-After` excede o timeout do teste

**Encontrado**: 2026-09-16, investigando as falhas da regressão completa de
`specs/016-risk-detail-experience`.

**Medido**: `attemptWithRateLimitBackoff` (`apps/web/e2e/support/admin-session.ts`) existe para
transformar um bloqueio de limitador numa mensagem clara — "as credenciais foram recusadas",
"o backend devolveu 500", e assim por diante. Mas ele **espera o `Retry-After` do servidor antes de
lançar**. Quando esse valor é maior que o timeout do teste, o teste estoura primeiro, e o que o
relatório mostra é um `Test timeout of 30000ms exceeded` mudo, apontando para uma linha de clique
qualquer — exatamente a informação que o helper foi escrito para não deixar acontecer.

Foi o que produziu `dashboard.spec.ts:80` e `indicators.spec.ts:547` como "timeout" na corrida de
2026-09-16. A causa real só apareceu ao rodar isolado com timeout maior: a página estava parada no
login, exibindo "Muitas tentativas. Tente novamente mais tarde." — limite **por conta**
(`AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`, 5 por 300s) contra `fixture-risk-analyst@pharosgrc.local`, uma
identidade que nesta máquina não autentica de todo modo (D-24, `docs/local-environment.md`).

**Por que importa mais do que parece**: um diagnóstico engolido faz uma falha de ambiente parecer
uma falha de produto, e vice-versa. Nesta mesma corrida, dois testes que pareciam "timeout de
ambiente" (`audit-engagement.spec.ts:89`, `grc-foundation.spec.ts:100`) eram regressão real da
fase 016 — e dois que pareciam do mesmo grupo eram mesmo ambiente. Sem medir um a um, os quatro
teriam recebido o mesmo rótulo, e metade dele estaria errada.

**Correção provável**: lançar o erro diagnóstico **antes** de esperar o `Retry-After`, ou limitar a
espera a uma fração do timeout restante do teste. Não foi feito aqui porque `admin-session.ts` é
usado pela suíte inteira e a mudança merece sua própria verificação.

**Resolução, 2026-09-18** (rodada 023, saneamento de findings): a primeira opção — deliberadamente,
não a segunda. Calcular "fração do timeout restante" exigiria saber quanto do timeout já foi
consumido por passos anteriores do MESMO teste, o que `TestInfo` não expõe de forma estável — e
teria mudado o COMPORTAMENTO de tempo desta função, num helper que a suíte inteira usa. A correção
aplicada **não muda timing nem semântica de retentativa nenhuma** — só torna o diagnóstico visível
**antes** da espera começar, via `console.log` e `test.info().annotations.push(...)` (aparece no
relatório HTML mesmo que o teste estoure depois). Um leitor de um teste com timeout agora vê "F-78:
login rate-limited... aguardando Ns" em vez de um `Test timeout` mudo apontando para uma linha de
clique qualquer.

Verificação: `apps/web/e2e/auth.spec.ts` completo (2/2, caminho comum de login inalterado) — não
forcei um 429 real deliberadamente (evitar consumir o orçamento de tentativas de outros testes,
D-24). O ramo `rate_limited` em si não teve sua lógica alterada, só ganhou duas linhas antes da
espera já existente.

---

## F-79 — RESOLVIDO 2026-09-18 (commit `066bb03`) — o botão "Cancelar" do `ControlForm` navegava para fora da tela quando composto dentro do novo painel em overlay

**Encontrado**: 2026-09-18, durante a Fase C de `021-control-detail-experience` (edição em
overlay), ao medir se a afordância de fechar do `ControlEditPanel` ficava visível sem rolar.

**Medido**: `ControlForm` (`apps/web/src/features/controls/components/control-form.tsx:671-678`)
tem seu próprio botão "Cancelar", cujo `onClick` chama `navigate.back()` — navegação real de
histórico do navegador, não um `onCancel` recebido por prop (diferente de `ActionEditForm`, que foi
desenhado desde o início para viver dentro de um overlay e recebe `onCancel` do seu próprio
`ActionEditPanel`). Esse botão sempre existiu e é usado sem problema nos dois contextos originais de
`ControlForm` — a página `/controls/new` e o antigo swap inline dentro da aba "Visão geral" — porque
em ambos "voltar" e "fechar a edição" coincidiam.

Fase C move a edição para `ControlEditPanel` (`Sheet` + `DetailPanel mode="overlay"`), que **não**
é uma navegação — não empilha uma entrada de histórico. Reproduzido diretamente: partindo de
`/controls` (registro), abrindo `/controls/{id}`, abrindo o painel de edição e clicando
"Cancelar" — a URL final é `/controls` de novo, o painel desaparece porque a página inteira mudou,
não porque o overlay fechou. O `X` do `Sheet` (topo-direita) e `Escape` continuam corretos: fecham o
overlay e devolvem o foco a "Editar", permanecendo em `/controls/{id}` — só o "Cancelar" do próprio
formulário se comporta diferente dos outros dois.

**Por que não foi corrigido na hora em que foi encontrado**: a instrução original da Fase C foi
"`ControlForm` inalterado" — certa antes de o overlay existir (os dois contextos originais de
`ControlForm`, `/controls/new` e o antigo swap inline, faziam "voltar" e "fechar a edição"
coincidirem). O coordenador reproduziu o achado, concordou que o overlay é criação desta própria
rodada e revisou a instrução: não entregar conscientemente uma divergência entre afordâncias
vizinhas que a própria implementação nova criou.

**Impacto, enquanto esteve aberto**: um usuário que abria "Editar" num controle e clicava
"Cancelar" (em vez do `X` ou `Escape`) era levado de volta ao registro de controles, perdendo a
tela de detalhe que estava olhando — surpreendente, mas não destrutivo (nenhum dado era perdido; a
edição realmente não era salva).

**Correção aplicada**: `ControlForm` ganhou um `onCancel?: () => void` **opcional** (mirando o
contrato que `ActionEditForm` já tinha), usado no lugar de `navigate.back()` quando fornecido —
`navigate.back()` continua sendo o padrão quando `onCancel` não é passado, então `/controls/new`
permanece byte-a-byte com o comportamento de antes (confirmado por render real: "Cancelar" em
`/controls/new` ainda volta para `/controls`). `ControlEditPanel` passa
`onCancel={() => onOpenChange(false)}` — a MESMA função que `Escape` e o `X` do `Sheet` já chamam
via `onOpenChange`, não um segundo mecanismo. Confirmado por render real: partindo de `/controls`,
abrindo `/controls/{id}`, abrindo "Editar" e clicando "Cancelar" — a URL permanece em
`/controls/{id}`, o painel fecha, e o foco volta para "Editar", idêntico ao que `Escape`/`X` já
faziam. Cobertura nova: `control-form.test.tsx` (o padrão `navigate.back()` sem `onCancel`, e o
`onCancel` fornecido substituindo `navigate.back()`) e `control-edit-panel.test.tsx` (o painel liga
`ControlForm.onCancel` ao mesmo `onOpenChange(false)`).

---

## F-80 — RESOLVIDO 2026-09-18 (commit `0318010`) — o `StatusBadge` da "Efetividade" renderiza como barra de largura total em `ControlOverview`

**Encontrado**: 2026-09-18, durante a Fase B de `022-asset-detail-experience`, ao construir o
próprio card "Situação" do Ativo com a mesma composição `CardContent className="flex flex-col
gap-3"` seguida de um `StatusBadge` como primeiro filho — o padrão que `ControlOverview`'s própria
"Efetividade" já usa (`apps/web/src/features/controls/components/control-overview.tsx:98-104`).

**Medido**: capturado por render real contra um controle DRAFT/NOT_ASSESSED em `/controls/{id}`
(1440px, tema claro) — o badge "Não avaliado" ocupa a largura inteira do card, como uma barra,
em vez do pill compacto que o mesmo `StatusBadge` renderiza em qualquer outro lugar do produto
(cabeçalho, tabelas, chips de filtro). Causa: um contêiner `flex flex-col` estica um filho sem
largura intrínseca para a largura total do eixo cruzado por padrão (`align-items: stretch`),
independentemente do `display: inline-flex` do próprio `StatusBadge` — `align-items`/`align-self`
atuam na caixa do item flex, não no `display` do conteúdo interno. Reproduzível com qualquer
`StatusBadge` colocado como filho direto de um `flex flex-col` sem `self-start`/`items-start`.

**Impacto**: puramente visual — nenhuma funcionalidade, dado ou acessibilidade textual afetada (o
rótulo continua correto e legível); o badge apenas lê como uma barra de destaque em vez de um selo
compacto, quebrando a consistência visual que `StatusBadge` tem em todo o resto do produto
(CLAUDE.md §18.3/§18.12). Confirmado presente também no card "Situação" do Ativo antes desta
correção — corrigido ali com `className="self-start"` no próprio `StatusBadge`
(`asset-lifecycle-actions.tsx`), porque é código desta mesma rodada. `ControlOverview` não foi
tocado: pertence a `021-control-detail-experience`, já revisado e fechado, e esta descoberta não é
mandato para reabri-lo sem aprovação (CLAUDE.md §14 — não misturar correção não relacionada em uma
rodada de outro módulo).

**Área provável / correção sugerida** (histórico, ver resolução abaixo): `apps/web/src/features/
controls/components/control-overview.tsx`, o `<StatusBadge>` dentro do card "Efetividade" —
adicionar `className="self-start"` (ou `items-start` no `CardContent` que o envolve) resolve da
mesma forma que resolveu aqui. Vale também auditar qualquer outro `StatusBadge` futuro composto
diretamente dentro de um `flex flex-col` sem `self-start`, já que o padrão tende a ser copiado por
semelhança visual entre módulos (CLAUDE.md §18.12).

**RESOLVIDO em 2026-09-18**, mesmo dia do achado, a pedido do coordenador — que mediu o próprio
achado lado a lado (largura do badge / largura do cartão: Controle 726px/776px = 94%, contra o
6% do card "Situação" do Ativo já corrigido) e determinou que "não reabrir módulo anterior" é
regra sobre não mexer para parecer artificialmente igual, não sobre deixar defeito real de pé —
o mesmo raciocínio já usado para corrigir, durante a fase de Problemas, uma tabela ilegível a
390px em Incidentes.

**Correção aplicada**: `className="self-start"` no `<StatusBadge>` de
`control-overview.tsx` (linha do card "Efetividade") — a mesma uma linha usada no card "Situação"
do Ativo, nada mais alterado neste arquivo.

**Varredura pelo mesmo padrão** (`StatusBadge` como filho direto de um `flex flex-col` sem
`self-start`/`items-start`) em todo `apps/web/src/features`, nos módulos citados pelo coordenador
mais os demais já entregues: Incidentes (`incident-overview.tsx`, `incident-card.tsx`,
`incident-register-columns.tsx`) e Problemas (`problem-overview.tsx`, `problem-card.tsx`,
`problem-register-columns.tsx`) — limpos, todo `StatusBadge` neles é filho de uma célula de
tabela, de um `<dd>` via `DetailField`, ou de um `flex flex-wrap items-center` (nunca de um
`flex flex-col` puro). Riscos e Planos de Ação **não** estavam limpos — dois defeitos reais
adicionais, do mesmo padrão, encontrados e corrigidos na mesma rodada:

- `apps/web/src/features/risks/components/risk-register-columns.tsx` — coluna "Próxima revisão",
  badge "Revisão vencida" dentro de `<div className="flex flex-col gap-1">`. Medido antes da
  correção: badge 154px dentro de um contêiner de 154px (esticado); depois: 86,3px dentro de
  124,3px (pílula).
- `apps/web/src/features/actions/components/my-actions-columns.tsx` — coluna "Prazo" de "Planos
  de Ação", badge "Atrasada" dentro do mesmo tipo de `<div className="flex flex-col gap-1">`.
  Medido antes: 144px dentro de 144px (esticado); depois: 47,8px dentro de 85,8px (pílula).

Também varridos e confirmados limpos, sem alteração necessária: `risk-card.tsx`,
`risk-quick-view.tsx`, `control-card.tsx`, `control-quick-view.tsx`,
`risk-incident-problem-links-section.tsx`, `pending-approval-badge.tsx` — todo `StatusBadge`
neles já vive num `flex flex-wrap items-center`, numa célula de tabela, ou num `<div>` sem
contexto flex algum.

**Regressão**: `vitest run` dos três módulos tocados (`controls`, `risks`, `actions`) verde, sem
teste alterado — a mudança é só uma classe CSS, nenhuma asserção de teste dependia da largura do
badge. Confirmado por medição renderizada (não pelo olho) que os três badges caíram na faixa de
pílula compacta, igual a qualquer outro `StatusBadge` do produto — números acima.

---

## F-81 — RESOLVIDO 2026-09-18 (rodada 023, saneamento de findings) — `action-plan.spec.ts` perde a linha recém-criada por paginação, mesma classe de F-70/F-72

**Encontrado**: 2026-09-18, durante a regressão da Fase E de `022-asset-detail-experience` —
`action-plan.spec.ts` foi incluído na rodada porque o varrimento do F-80 tocou
`my-actions-columns.tsx` (coluna "Prazo"). Falhou de forma idêntica em duas execuções seguidas
(`--workers=1`, mesmo motivo nas duas), o gatilho que esta casa usa para "pare e relate" em vez de
insistir.

**Medido**: `creates an action inside a risk, finds it centrally, edits it, transitions it and
reads its trail` cria uma ação nova, aplica os filtros "Origem: Tratamento de risco" + "Somente
atrasadas" no registro `/actions` e espera `getByRole('row').filter({ hasText: actionTitle
}).toHaveCount(1)`. O snapshot da página no momento da falha (`error-context.md`) mostra
`status: "1–25 de 37"` — 37 linhas passam pelo filtro, paginadas a 25 por página, e a ação recém-
criada não está entre as 25 da página 1. O teste nunca ordena por "mais recente" nem lida com
paginação antes de procurar a linha — ele assume que o resultado filtrado cabe numa página só.

**Causa provável**: é a MESMA classe de defeito que `docs/local-environment.md`/
`assets-processes.spec.ts` já registraram para Risco e Ativo/Processo (F-70/F-72): um banco de
desenvolvimento de longa duração acumula ações de execuções anteriores de E2E sem nenhuma limpeza,
e o filtro "Tratamento de risco" + "Somente atrasadas" — que antes cabia numa página — cruzou o
limiar de 25 linhas em algum momento entre a última vez que este spec foi validado e agora. Não é
regressão de código: nenhuma mudança desta rodada tocou ordenação, paginação ou filtro do registro
de Ações — o único arquivo tocado por esta rodada no módulo de Ações foi `my-actions-columns.tsx`
(`className="self-start"` no badge "Atrasada" da coluna "Prazo", puramente CSS, confirmado sem
relação com contagem de linhas ou paginação).

**Impacto**: o teste é falso-negativo sob o volume atual do banco local — ele passaria contra um
banco mais vazio e falhará de novo, de forma crescente, à medida que mais execuções acumulam mais
ações "Acao de plano E2E …" (o mesmo padrão "mtyjp7te", "mu2mxvm6" etc. visto no snapshot). Não foi
possível confirmar se isso também acontece em CI (banco efêmero, recriado a cada execução) — pode
ser um problema exclusivo deste ambiente de desenvolvimento de longa duração, exatamente como
F-70/F-72 documentam para os registros de Risco/Ativo/Processo.

**Área provável / correção sugerida**: `apps/web/e2e/action-plan.spec.ts`, antes da asserção da
linha 134 (`const centralRow = ...`) — ordenar o registro por "Última atualização — decrescente"
(o mesmo padrão que `assets-processes.spec.ts` já adotou para o mesmo problema, com o mesmo
comentário explicando F-72/F-70) antes de procurar a linha, ou aumentar "Itens por página" para
100. Fora do escopo desta rodada corrigir — pertence ao módulo de Planos de Ação, não a Ativos, e
`022-asset-detail-experience` termina a sequência sem módulo seguinte para assumir a correção.

**Resolução, 2026-09-18** (rodada 023, saneamento de findings). **A correção sugerida acima não se
aplica** — verificado antes de implementar, não presumido: `use-actions-register-state.ts`'s próprio
comentário de cabeçalho confirma que `GET /actions` **não tem `sort` nem busca livre**, só `status`,
`originType`, `overdue`, `onlyMine`, `page`, `pageSize`, `view` — o truque "ordenar por mais recente"
que `assets-processes.spec.ts` usa para a mesma classe de problema não tem onde se apoiar aqui.
Aumentar `pageSize` foi explicitamente proibido (instrução do usuário) e não resolveria de qualquer
forma — a contagem (medida em 105 no momento da correção, adiante de 37 quando o achado foi escrito)
só cresce a cada execução de E2E local, então qualquer limite fixo se tornaria insuficiente de novo.

A correção real: `findRowAcrossPages`, um helper local ao spec (`action-plan.spec.ts`), percorre a
paginação da própria `DataTable` compartilhada — clica "Próxima página" repetidamente até achar a
linha ou esgotar as páginas (teto de 20 páginas = 500 linhas, generoso, nunca esperado ser atingido),
usando o resumo de resultados (`role="status"`, "1–25 de N") como sinal de assentamento depois de
cada clique. Determinístico sobre o próprio registro que o teste cria, nunca sobre ordem ou acúmulo
do banco; nunca enfraquece a asserção (`expect(row).toHaveCount(1)` continua exigindo exatamente uma
correspondência). Aplicado às três ocorrências do mesmo padrão no arquivo — a que o achado mediu e
as duas outras equivalentes mais adiante no mesmo teste, que tinham o mesmo defeito latente, não
corrigi-las teria sido exatamente a classe F-42 já nomeada neste documento ("uma correção que não
alcança sua irmã").

**Um defeito real de temporização foi descoberto e corrigido no processo, não presumido**: a
primeira versão do helper usava `row.count()` como instantâneo único (sem repetição), e uma corrida
genuína apareceu ao vivo — depois de reselecionar o combobox "Status", a query ainda não tinha
assentado no momento da primeira checagem, e o `expect(locator).toHaveCount(1)` original (que o
helper substitui) absorvia essa espera de graça por causa de seu próprio polling; um `count()`
instantâneo não. Corrigido trocando por `expect(row).toHaveCount(1, { timeout: 3_000 })` dentro do
laço — uma espera limitada, não um instantâneo, antes de decidir "não está nesta página".

Prova: `action-plan.spec.ts` completo, 3/3, com o teste principal reexecutado duas vezes seguidas
para confirmar estabilidade (não uma coincidência) — a contagem real no ambiente de desenvolvimento
deste agente cresceu de 37 (quando o achado foi escrito) para 39-67 durante a depuração desta própria
correção, exercitando o caminho de múltiplas páginas de verdade a cada execução.

---

## F-82 — RESOLVIDO 2026-09-19 (rodada 024, `024-dashboard-v2` Fase E) — Os três cartões de "Distribuições" não expunham heading algum

**Encontrado**: 2026-09-19, pelo coordenador, extraindo o esquema de títulos da página `/dashboard`
renderizada ao validar a Fase D. "O que requer atenção agora" expõe 7 `<h3>` (um por
`DashboardStatCard`), "Visão dos módulos" expõe 8 `<h3>` (um por `DashboardModuleCard`),
"Distribuições" não expõe heading nenhum para seus três cartões ("Riscos por nível (residual)",
"Riscos por status", "Planos de ação por status").

**Evidência**: `DashboardChartCard`
(`apps/web/src/features/dashboard/components/dashboard-chart-card.tsx`) usava `CardTitle`
(`apps/web/src/components/ui/card.tsx`), que renderiza um `<div data-slot="card-title">`, nunca um
elemento de heading. Confirmado contra o baseline `3b3251f` (antes de qualquer fase de
`024-dashboard-v2`) que a chamada já era assim — não é regressão desta rodada, é pré-existente desde
que `DashboardChartCard` foi criado.

**Impacto**: quem navega por lista de títulos de leitor de tela (o modo de navegação rápida mais
comum numa página densa) alcançava as outras quinze superfícies da tela e pulava direto por cima dos
três gráficos — o conteúdo textual (descrição, tabela acessível `sr-only`) continuava alcançável por
navegação linear ou por marco, mas não pelo caminho mais usado. Lacuna de descoberta, não de
conteúdo.

**Correção**: local a `dashboard-chart-card.tsx`, sem tocar o primitivo compartilhado `CardTitle`
(usado pelo produto inteiro — mudar seu elemento de saída estava fora de cogitação nesta rodada).
O cartão passou a renderizar um `<h3>` de verdade com as mesmas classes que `CardTitle` já aplicava
(`leading-none font-semibold`, mais `text-base` do call site), então o resultado visual é
byte-idêntico e a semântica ficou correta. Os três pontos de chamada em `page.tsx` não precisaram de
nenhuma mudança — o heading é interno ao componente.
