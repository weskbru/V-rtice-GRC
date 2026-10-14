# Matrix — Convergência e Saneamento de Implementação

**Feature**: `007-implementation-remediation` · **Spec**: [spec.md](./spec.md)

Estado: vocabulário fechado — `confirmado` (medido/lido no código nesta leitura ou citado com
evidência já registrada), `hipótese` (raciocinado, não medido), `resolvido no código` (a leitura do
código mostra a correção já presente), `custo aceito` (defeito real, decisão de não corrigir,
registrada), `capacidade futura` (não é dívida — roadmap). Onde este documento não pôde verificar
pessoalmente contra o código nesta sessão, isso é dito explicitamente na coluna Evidência — nada é
apresentado como medido sem tê-lo sido.

**Atualização**: as Frentes E e F, que carregavam itens PENDENTE DE MEDIÇÃO nesta seção, foram
medidas ao longo desta mesma sessão (research.md D-17 a D-20 para E; D-12/D-20/D-23 a D-25 para F).
As linhas abaixo já refletem os vereditos medidos, exceto onde uma linha específica ainda cita
"não medido nesta sessão" — o que é dito explicitamente célula a célula, nunca presumido.

---

## 1 — C1 a C7 (diagnóstico `docs/history/implementation-debt-review.md`)

| ID | Origem | Requisito/ADR | Evidência no HEAD | Estado | Impacto | Correção | Frente | Dependências | Prova de aceitação |
|---|---|---|---|---|---|---|---|---|---|
| C1 | debt-review §2 | CLAUDE.md §19.6, Constituição VII | `mirror-action-status-from-origin.usecase.ts` não chama `assertLegalActionTransition`; `update-treatment-action.usecase.ts` o invoca sem gate | confirmado | duas autoridades de dado, duas regras de transição para o mesmo trabalho | D-1 a D-6 (research.md) — convergência completa | A | migração antes de qualquer outra escrita em `risk_treatment_actions` | `tasks.md` T-A: transição ilegal aceita hoje pela rota de Riscos passa a `422`, mesmo teste nas duas rotas |
| C2 | debt-review §2 | Constituição VI, F-24 | 4 cópias do predicado + 1 cópia do relógio (`prisma-action.repository.ts:260-263`) | confirmado | painel/listagem podem discordar sobre o que está atrasado | D-7 — um predicado, um relógio, um fragmento SQL | A | depois de C1 (a tabela de origem muda) | teste de equivalência TypeScript/SQL/Prisma-where, ontem/hoje/amanhã × 4 status |
| C3 | debt-review §2 | Constituição XIII, F-3/F-18/F-19 | gerador cobre 5/10 documentos (`generate.mjs:51-61`); nenhum validador de payload existe | confirmado | uma mudança de campo de resposta nos 5 domínios não cobertos não é detectada por gate nenhum | D-8, D-9 — geração completa + validador ajv | B | nenhuma (independente de A/D) | renomear campo em qualquer operação coberta faz o validador falhar; CI de atualidade falha com árvore suja |
| C4 | debt-review §2 | ADR-011, F-25 | `eslint.config.mjs` classifica 14 tipos; `*.module.ts`/`app.module.ts`/`main.ts`/`permission-catalogue.ts` não casam com nenhum | confirmado | ponto cego exatamente onde um módulo novo mais erra primeiro | D-10 — tipo `composition` + `no-unknown-files` + isolamento parcial de `grc/` | C | nenhuma | importação proibida nova (module-domain arbitrário → grc-infrastructure) falha; controle positivo (composition → qualquer camada) passa |
| C5 | debt-review §2 | AGENTS.md (escopo nunca por JOIN), F-44 #1/#2 | `risk.module.ts:61,80,198` liga porte morto; `ControlAssessmentRepository.listAssessmentIdsInScope:152-154` decide por JOIN | confirmado | código morto + violação de uma regra já ratificada | D-11 — remoção + denormalização aditiva | D | depois de A no `schema.prisma` (mesmo arquivo) | contêiner sobe sem o porte; leitura de escopo em `control_assessments` não faz JOIN; teste Controle→Ativo fora de escopo existe e falha antes da correção |
| C6 | debt-review §2 | Constituição IX, F-16/F-43/F-48 | **medido** (D-17 a D-20): F-48 tinha a aritmética errada (contava requisições totais, não falhas); a execução real custa 8 falhas + 14 sucessos = 22 requisições contra teto de 20 falhas/300s — uma execução cabe, a terceira consecutiva estoura. Auxiliar ainda confunde 429/500/rede/senha errada na mesma asserção (F-43, confirmado verbatim). Grafo de CI transforma falha upstream em pulo silencioso a jusante (D-18, novo, ver F-64) | confirmado, corrigido | suíte não termina verde localmente sem correr risco de mascarar regressão real; CI pode ler "pulado" como aprovação | D-17 a D-20 (research.md) — cinco passos, nesta ordem | E | — | execução Chromium única, `retries:0`, ≤2 falhas medidas; job de agregação falha quando upstream falha |
| C7 | debt-review §2 | Constituição XIV, F-42/F-51 | quickstarts de 002/003/005 citam `db:migrate:dev`, inexistente; **a correção original de F-51 também estava errada** (D-27): `db:migrate` existe mas roda `prisma migrate dev`, que o próprio cabeçalho de `schema.prisma:57-72` proíbe contra banco real (o diff de sombra não entende o particionamento manual de `audit_event`); sem `README.md` raiz (confirmado); `pnpm test` na raiz não roda os 532 testes do web (sem script `test`) nem protege os testes de banco da API (`vitest.config.ts` default varre integração/contrato sem `globalSetup` nem `singleFork`) (D-26) | confirmado, com uma correção sobre a própria correção anterior | roteiro de validação falha na primeira linha ou, pior, corre contra banco real sem proteção; `pnpm test` corre suítes de banco sem migração/reset e com paralelismo total — a mesma corrida que as configs dedicadas existem para evitar | os quickstarts 002/003/005/006 migram para `pnpm --filter @vertice/api exec prisma migrate deploy` (006 tinha sido "corrigido" antes para `db:migrate`, que também está errado); `vitest.config.ts` da API estreita `include` para `test/unit/**`; `apps/web` ganha script `test`; quickstart 001 troca `pnpm test` pelos quatro comandos reais; `README.md` novo; `default-planned-areas.ts` (D-15); roadmap/arquitetura corrigidos por adendo (D-28); checkboxes de 002/003/004 reconciliados (D-29) | G | nenhuma | os quatro quickstarts citam `migrate deploy`; `pnpm test` cobre honestamente "todo unit do workspace"; `README.md` existe |

---

## 2 — V1 a V6 (diagnóstico `docs/history/implementation-debt-review.md` §3)

| ID | Origem | Requisito/ADR | Evidência no HEAD | Estado | Impacto | Correção | Frente | Dependências | Prova de aceitação |
|---|---|---|---|---|---|---|---|---|---|
| V1 | debt-review §3, F-26 | Constituição II/III | **medido** (D-20): nível de provedor, 250 iterações/ramo/tamanho — ramos não se sobrepõem em tamanho nenhum (+0,38ms a 64KiB, +5,44ms a 8MiB). HTTP real, 20 pares/tamanho: impraticável a explorar em arquivos pequenos (~10.600-647.000 amostras necessárias, limitador de taxa impede), **praticamente explorável a 8MiB** (~39 pares para 3σ, dentro do limite, sob 1 minuto) | **confirmado por medição** | oráculo de existência entre escopos, real e explorável perto do teto de 25MiB; residual dentro da mesma unidade organizacional nomeado, não fechado | D-20 — partição por `parentAccess.organizationalUnitId`, já resolvido em `UploadService.execute`; chaves antigas nunca reescritas | F | — | upload de arquivo grande com conteúdo duplicado em outra unidade: chave particionada; `organizationalUnitId` indefinido tem compartimento próprio |
| V2 | debt-review §3 | Constituição IV | medido nesta sessão: login real em 2026-09-10 22:34:53 produziu `session.created` com `actor_user_id`/`session_id` NULOS; 1466/1466 linhas do tipo, no total | confirmado | violação ativa de auditabilidade de autenticação | D-13 — enriquecer via `RequestContextEnricherPort` já existente | G | nenhuma | login real produz `session.created` com ambos os campos populados; nenhuma linha histórica reescrita |
| V3 | debt-review §3, F-5 | Constituição IX | `global-setup.ts` migra mas não semeia o banco de teste de integração; nenhum spec de integração presume linha pré-existente | **respondida (D-20): ausência de semeadura global está CORRETA, não é defeito** — uma semeadura global recriaria o estado mutável compartilhado que já custou F-16/F-45 | nenhum — F-5 é resíduo estreito (`reference-data.spec.ts` cria sua própria linha), não defeito de semeadura | o que permanece em escopo é provar o SCRIPT de semeadura (idempotência, baseline de permissão, invalidação de cache) contra banco descartável | E | — | semeadura roda duas vezes contra banco descartável sem falhar nem duplicar |
| V4 | debt-review §3, F-12/F-13/F-14 | Constituição III/XII, Restrições de Tecnologia | **medido nesta sessão contra o HEAD atual** (D-23/D-24): F-12 RESOLVIDO (imagem construída, subida contra Postgres/Redis reais, `NODE_ENV=production`+`SESSION_COOKIE_SECURE=true`, `/health/ready` saudável); F-14 RESOLVIDO (duas imagens buscadas de ponta a ponta, nenhum `.env` presente); F-13 dividido — metade de boot fechada pelo próprio `docker-compose.yml` (já força `SESSION_COOKIE_SECURE=true`), metade de navegador medida FALSA para Chromium (cookie `Secure` armazenado/reconhecido/limpo sobre `http://localhost`) | **confirmado por medição — F-12 e F-14 resolvidos; F-13 dividido; documentos desatualizados** | nenhum bloqueio real de instalação do zero permanece; ausência de TLS genuinamente aberta para não-`localhost` | D-23/D-24 — corrigir `docs/deferred-findings.md` e `quickstart.md` (D-25: comandos de migração Docker nunca funcionaram, forma de host verificada) | F/G | — | checkout limpo → login/logout Chromium real; `docs/deferred-findings.md` e quickstart corrigidos |
| V5 | debt-review §3, F-44 #3 | nenhum — decisão deliberada | `PATCH /controls/{controlId}` não trava por `RETIRED`; decisão registrada como deliberada em F-44 #3, com portão explícito na Fase 4 (concluída, `005-audit-findings`) | confirmado, **decisão já tomada, portão já vencido** | um controle aposentado ainda aceita edição descritiva | **fora das sete frentes** — a Fase 4 já é a dona do portão e já concluiu; decisão pendente de ser tomada explicitamente por quem primeiro consumir controle aposentado como prova de auditoria | — | Fase 4 concluída (`005-audit-findings`) | nenhuma nesta fase — registrado para não ser esquecido, não para ser corrigido aqui |
| V6 | debt-review §3 | Constituição XIV | triagem completa dos 52 achados | ver Seção 3 abaixo | — | triagem individual, não resumo | G | nenhuma | toda linha da Seção 3 tem veredito e evidência próprios |

---

## 3 — F-1 a F-52, triados individualmente

Cada linha cita a evidência que já existe em `docs/deferred-findings.md` (a maioria já data e
assina seu próprio veredito) mais qualquer verificação adicional feita nesta sessão. Onde o
achado já carrega `RESOLVIDO`/`RESOLVED` no próprio arquivo, esta tabela carrega essa data —
**não foi reexecutado o teste correspondente nesta sessão de especificação**, o que é dito
explicitamente na coluna Estado.

| ID | Reproduz hoje? | Estado | Evidência | Frente / próximo passo |
|---|---|---|---|---|
| F-1 | Não | resolvido no código, per `docs/history/implementation-debt-review.md` §4 | `apps/web/src/lib/messages/risks.ts` já usa mapas tipados por união (citado no diagnóstico; não reaberto nesta sessão) | nenhuma — item confirmado fechado |
| F-2 | Parcial | resolvido no código (`StatusBadge`/`RiskScore`), `LoadingState` tem decisão própria | debt-review §4 | nenhuma — não reabrir a checagem de todo `role="status"` |
| F-3 | Parcialmente | confirmado — decisão D-14 já tomada (gerar do YAML autorado), mas cobertura ainda 5/10 | `generate.mjs:51-61` | B — fechado por FR-014/FR-015/FR-016 |
| F-4 | Sim | confirmado, custo aceito parcialmente (Chromium é a cobertura real) | `docs/deferred-findings.md` F-4; não medido de novo nesta sessão | E — FR-025e exige a declaração explícita de cobertura |
| F-5 | Parcial | **respondido (D-20)**: a ausência de semeadura global está CORRETA, não é defeito — ver V3 acima. Resíduo estreito: `reference-data.spec.ts` insere sua própria linha de referência, forma contornada válida | `global-setup.ts` (citado); D-20 | E — FR-025f, provar o script de semeadura (idempotência, baseline) contra banco descartável |
| F-6 | Não | RESOLVIDO 2026-09-05 (achado original) | `docker/web.Dockerfile`, verificação completa registrada no próprio achado | nenhuma |
| F-7 | Não | RESOLVIDO 2026-09-07 | três pontos de extensão hoje reais, per o próprio achado | nenhuma |
| F-8 | Parcial | parcialmente resolvido 2026-09-07; `core/users`/`core/configuration` seguem ausentes | achado próprio, não reaberto nesta sessão | fora de escopo — nenhuma das sete frentes o exige |
| F-9 | Sim | confirmado, custo aceito, dono é T163 (histórico mesclado) | achado próprio | fora das sete frentes — não verificado se T163 já existe |
| F-12 | Não | **RESOLVIDO, medido nesta sessão (D-23)** — `docker/api.Dockerfile` roda um segundo `prisma generate` contra a árvore implantada; imagem construída e subida com sucesso, `/health/ready` saudável | medição do coordenador, D-23 | G — marcar resolvido em `docs/deferred-findings.md` e corrigir `quickstart.md`, que ainda diz o contrário |
| F-13 | Parcial | **dividido nesta sessão (D-24)**: metade de boot fechada pelo próprio Compose (nunca reproduz num `docker compose up` real); metade de navegador medida **falsa para Chromium** (cookie `Secure` funciona sobre `http://localhost`); ausência de TLS genuinamente aberta | medição do coordenador, D-24 | G — corrigir achado em duas metades, preservar a parte aberta |
| F-14 | Não | **RESOLVIDO, medido nesta sessão (D-23)** — `.dockerignore` ancora em toda profundidade; duas imagens buscadas de ponta a ponta, nenhum `.env` presente | medição do coordenador, D-23 | G — marcar resolvido |
| F-15 | Sim (por desenho da semeadura) | confirmado, custo aceito, dono T175/`platform.seed.ts` | achado próprio | fora das sete frentes |
| F-16 | Não | RESOLVIDO — pool de contas por worker (citado pelo próprio F-48 como já corrigido) | `admin-session.ts`, per F-48 | nenhuma |
| F-17 | Não medido nesta sessão | confirmado-histórico, dono T203 | achado próprio | fora das sete frentes |
| F-18 | Não (recategorizado) | resolvido/recategorizado — D-14 | mapeadores emitem `null` explícito; a alegação original de "campo ausente" não se sustenta | G — FR-029 corrige `docs/deferred-findings.md` |
| F-19 | Sim | confirmado | `dist/index.d.ts` importa `./generated/*`, nunca emitido por `tsc` | B — FR-016 |
| F-20 | N/A | custo aceito, não é defeito — o próprio achado diz "nenhum dono" | achado próprio | nenhuma |
| F-21 | Não | RESOLVIDO 2026-09-07 | `theme-provider.tsx` montado, `theme-toggle.tsx` real | nenhuma — mas ver F-30 abaixo, que esta resolução torna live |
| F-22 | Não | resolvido — fechado pela verificação F-23 | achado próprio, verdicto "pass" no re-run | nenhuma |
| F-23 | Parcial | #1 resolvido, #2 custo estrutural aceito, #3 confirmado aberto (catálogo pt-BR sem extensão por módulo) | achado próprio, atualizado 2026-09-07 | #3 fora das sete frentes — candidato a fase própria futura |
| F-24 | Sim | confirmado — é C2 | ver linha C2 acima | A |
| F-25 | Sim | confirmado — é C4 | ver linha C4 acima | C |
| F-26 | Hipótese | confirmado como hipótese não medida — é V1 | ver linha V1 acima | F |
| F-27 | Não medido nesta sessão | confirmado-histórico, trivial | achado próprio | fora das sete frentes |
| F-28 | Não | resolvido — o próprio F-39 já cita "o fix do gráfico depois do F-28" como fato consumado | referência cruzada F-39 | nenhuma |
| F-29 | Sim, generalizado | confirmado-histórico, **generalizado nesta sessão de uma tela para nove pontos de chamada em seis módulos** — ver F-66 | achado próprio + F-66/D-22 | H — a correção de F-66 é a forma sistêmica que absorve F-29 |
| F-30 | **Reaberto por consequência de F-21** — não medido nesta sessão | confirmado-histórico, **ESCALADO**: o próprio achado dizia "hoje não afeta ninguém" porque o tema escuro era inalcançável (F-21 aberto); F-21 foi resolvido em 2026-09-07, então o tema escuro **é** alcançável desde então, e este contraste de link falho em AA **provavelmente já afeta usuário real** | achado próprio + a resolução de F-21 já registrada acima; **não verificado com navegador nesta sessão** | fora das sete frentes desta fase — recomendado como próxima tarefa de acessibilidade, sinalizado aqui para não ser perdido de novo |
| F-31 | Não | RESOLVIDO 2026-09-06 | rotas `PUT :riskId/causes`/`:consequences` existem, teste espelho existe | nenhuma |
| F-32 | Não medido nesta sessão | confirmado-histórico | achado próprio | fora das sete frentes |
| F-33 | Não | RESOLVIDO 2026-09-07 | job `test-e2e` em CI, `requireSeedCredentials` lança em vez de pular | nenhuma |
| F-34 | Não | RESOLVIDO 2026-09-08 | `assignment-line.ts`/`.service.ts`, `GET /users?assignableForOrgUnitId=` | nenhuma |
| F-35 | Não | RESOLVIDO 2026-09-07 | `docker/web.Dockerfile` copia `public/`, verificado com imagem construída | nenhuma |
| F-36 | Sim | confirmado — é C1 | ver linha C1 acima | A |
| F-37 | Não | **RESOLVIDO — confirmado pelo coordenador nesta sessão, não marcado ainda em `docs/deferred-findings.md`** | `schema.prisma` linhas 2798-2810: `model FindingRiskLink` existe, com as duas FKs (`findingId`/`riskId`), `linkedAt`/`linkedByUserId`, o par de desvínculo suave (`unlinkedAt`/`unlinkedByUserId`) e `onDelete: Restrict` — confirmado pelo coordenador diretamente contra o arquivo. O texto de F-37 em `docs/deferred-findings.md` ainda afirma, no presente, que "não há vínculo Finding-para-Risco de tipo algum: nem tabela de ligação, nem coluna `riskId`, nem registro de tipo fechado". Essa frase era verdadeira quando escrita em 2026-09-07 e foi tornada falsa pela Fase 4 (`005-audit-findings`), que construiu a tabela. É exatamente a classe de defeito que esta missão existe para corrigir: um achado fechado no código que continua aberto no registro — deixá-lo aberto mandaria o próximo leitor construir algo que já existe | **G — correção de front confirmada** (não apenas "reportada"): marcar F-37 como resolvido em `docs/deferred-findings.md`, com data e esta evidência, **preservando o texto original** (nunca apagar o histórico do achado) |
| F-38 | Não medido nesta sessão | confirmado-histórico, decisão pendente (auditar DENIED por escopo ou reescrever FR-030) | achado próprio | fora das sete frentes — decisão de produto, não desta convergência |
| F-39 | Não medido nesta sessão | resolvido, per o próprio texto atualizado do achado (fix commitado) | achado próprio | nenhuma |
| F-40 | Não | RESOLVIDO — D-14 confirma | `features/evidence/types.ts`/`features/findings/types.ts` corrigidos, per achado atualizado | G — FR-030 marca a data no achado |
| F-41 | Não medido nesta sessão | confirmado-histórico, análise estática, nenhum código mudado ainda | achado próprio | fora das sete frentes |
| F-42 | N/A | é uma observação de mecanismo (dois padrões recorrentes), não um defeito único | achado próprio | referenciado por esta própria fase como razão de existir (F-42 é o padrão; C1-C7 são instâncias) |
| F-43 | Sim | confirmado — é parte de C6 | ver linha C6 acima | E |
| F-44 | Sim (3 itens) | #1 e #2 confirmados = C5; #3 = V5 acima | ver linhas C5/V5 | D / fora das sete frentes (V5) |
| F-45 | Não medido nesta sessão | confirmado-histórico, corrigido de causa (o achado já se autocorrigiu quanto à causa raiz) | achado próprio | fora das sete frentes — teste de isolamento entre arquivos, não desta convergência |
| F-46 | Não | RESOLVIDO 2026-09-08 | `control-link.usecase.ts` via `ControlDirectoryPort` + `isOrgUnitWithinScope`, teste dedicado | nenhuma |
| F-47 | Não | RESOLVIDO 2026-09-08 | `table.tsx` com `tabIndex={0}` no wrapper rolável | nenhuma |
| F-48 | Sim, mas com aritmética corrigida | confirmado — é C6; **a cifra original do achado estava errada** (contava requisições totais como falhas; a medida real é 8 falhas/22 requisições contra teto de 20 falhas) — ver D-17 | ver linha C6 acima | E |
| F-49 | Não | RESOLVIDO 2026-09-09 | `asset-link.usecase.ts`/`process-link.usecase.ts` via `AssetDirectoryPort`/`ProcessDirectoryPort` + guarda estrutural genérica | nenhuma |
| F-50 | Não | RESOLVIDO 2026-09-10 | `pnpm.overrides` para `multer`/`js-yaml` seletivo | nenhuma |
| F-51 | Sim, e a correção registrada para ele estava errada | confirmado — é parte de C7; **a renomeação para `db:migrate` não corrige nada** (D-27): esse script roda `prisma migrate dev`, que o cabeçalho do próprio `schema.prisma` proíbe contra banco real; a forma certa é `prisma migrate deploy` direto, como o quickstart 001 já usa e como esta sessão verificou funcionando. Ganhou também um irmão provado (F-67/D-25) nos comandos de migração Docker do quickstart 001 | ver linha C7 acima | G |
| F-52 | Não | RESOLVIDO 2026-09-10 | `test.setTimeout(120_000)` no `beforeAll` de acessibilidade, medido e comentado | nenhuma |

---

## 4 — Achados novos desta sessão (continuando a numeração de `docs/deferred-findings.md`, que termina em F-52)

**Nenhum destes é escrito em `docs/deferred-findings.md` nesta sessão** — ficam registrados apenas
aqui, como o mandato desta rodada exige; editar aquele arquivo é tarefa de implementação da Frente G,
com dono próprio.

| ID novo | Achado | Evidência | Frente | Estado |
|---|---|---|---|---|
| F-53 | O painel anuncia `CONTROLS` como área planejada, embora o módulo esteja em produção desde a Fase 2 | `core/dashboard/domain/default-planned-areas.ts:43-46`; `GET /api/v1/dashboard` medido pelo coordenador devolvendo `{CONTROLS, PLANNED}` | G | confirmado — corrigido por D-15/FR-025a |
| F-54 | Repositório sem `README.md` na raiz | confirmado ausente no HEAD medido; `docs/README.md` existe e está atual | G | confirmado — corrigido por D-16/FR-025b |
| F-55 | `packages/api-types` gerado está desatualizado no HEAD medido | `pnpm --filter @vertice/api-types run generate` sai 0 mas deixa 4 arquivos modificados (spec.md, tabela de contexto medido) | B | confirmado — corrigido por FR-014/FR-015 |
| F-56 | `session.created` sem atribuição de ator/sessão em 100% das linhas medidas | mesma evidência de V2 acima — registrado aqui também porque o mandato da missão o lista nominalmente como achado novo, não apenas como item V | G | confirmado — é V2/D-13 |
| F-57 | Três `Action` com `originType=RISK_TREATMENT` sem linha de vínculo, invisíveis a toda tela de Riscos | citado em decisions-opus.md D-R2, medido contra o banco de desenvolvimento pelo coordenador | A | confirmado — corrigido por FR-002/FR-003 |
| F-58 | Uma quinta cópia de "hoje, UTC, sem hora" além das quatro que F-24 já contava | `grc/action/infrastructure/prisma-action.repository.ts:260-263`, função local `todayDateOnlyUtc` | A | confirmado — corrigido por D-7/FR-010 |
| F-59 | `prisma/seed/performance.seed.ts` escreve `risk_treatment_actions` via `createMany`, contornando o caso de uso | `performance.seed.ts:681` | A | confirmado — corrigido por FR-009 |
| F-60 | `grc/<capacidade>` não tem isolamento mútuo entre `infrastructure`/`presentation`, ao contrário de `modules/<nome>` | `eslint.config.mjs:231-251` — políticas `grc-*` não templatizam `captured.capability` de volta, diferente das políticas `module-*` (linhas 184-226) | C | confirmado — corrigido por D-10/FR-021 |
| F-61 | `ControlAssessmentRepository.listAssessmentIdsInScope` decide escopo por JOIN | `control-assessment.repository.ts:152-159` | D | confirmado — corrigido por D-11/FR-024 |
| F-62 | Falta o teste comportamental de Controle→Ativo fora de escopo (Controle→Processo já tem) | citado em decisions-opus.md D-R11; não relido arquivo a arquivo nesta sessão para confirmar a ausência exata do teste irmão | D | confirmado por decisão do coordenador — corrigido por FR-025 |
| F-64 | O grafo de CI transforma uma falha upstream em pulo silencioso a jusante: os quatro jobs que dependem de banco compartilham as mesmas cinco dependências, e um pulo lê como se fosse aprovação | `.github/workflows/ci.yml` — os quatro jobs (`test-integration`, `test-contract`, `test-e2e`, `test-e2e-cross-browser`) declaram `needs: [lint, format-check, typecheck, test-unit, audit]`; F-50 é o precedente concreto (o gate `audit` ficou vermelho e levou os jobs de teste com ele) | E | confirmado — corrigido por D-18: job de agregação final com `if: always()` |
| F-68 | `pnpm test` na raiz não roda os 532 testes do web (sem script `test`) e o `pnpm test` da API varre integração/contrato sem `globalSetup` nem `singleFork` — a corrida que as configs dedicadas existem para evitar | `apps/web/package.json` (sem script `test`); `apps/api/vitest.config.ts` `include` varre `test/**`; cabeçalho de `vitest.integration.config.ts` já chama a config padrão de "unit only" — contradição confirmada pelo coordenador | G | confirmado — corrigido por FR-031a/D-26 |
| F-69 | `grc-roadmap.md` descreve Fases 2-5 no futuro (já entregues); `architecture.md` tem três afirmações factualmente erradas (só um módulo de negócio quando há seis; lista de capacidades do núcleo contradiz a própria seção "known gaps"; exemplo de "módulo número dois" já é o sete) | confirmado pelo coordenador, leitura direta dos dois documentos | G | confirmado — corrigido por adendo datado, FR-031c/D-28, nunca reescrita |
| F-70 | `specs/002`, `003`, `004` têm 85/85, 60/60, 71/71 tarefas desmarcadas sem nota, contradizendo CLAUDE.md §17 (que lista as três como concluídas); 13/13 amostras verificadas eram feitas-mas-não-marcadas | confirmado pelo coordenador; ambiguidade genuína no T071 de 004 (relatório sobre `ControlEffectivenessPort` nunca escrito) | G | confirmado — corrigido por FR-031d/D-29, reconciliação datada, nenhuma caixa por inferência |
| F-71 | `prisma migrate deploy`/`migrate status` nunca revalidam o checksum de uma migração JÁ aplicada contra o conteúdo atual do arquivo — um banco pode divergir do repositório indefinidamente, com todo comando reportando verde | encontrado e verificado pelo coordenador em 2026-09-11, contra `vertice_grc_test`: dois registros em `_prisma_migrations` para a mesma migração, checksums diferentes, um `rolled_back_at`, um `finished_at`; `migrate deploy` seguinte devolveu "No pending migrations to apply" sem erro; `docs/local-environment.md` D-17 tem a evidência completa e a regra permanente ("nunca editar uma migração em vigor na pasta rastreada real depois da primeira tentativa real de aplicação") | A (achado); nenhuma frente — é uma lição operacional, não um item de código a corrigir | confirmado — registrado em D-17; banco de teste reconstruído do zero (`DROP SCHEMA public CASCADE` + recriação) em vez de migração corretiva, verificado de ponta a ponta (69 tabelas → 0 → 69, checksum único e correto, enum retirado confirmado ausente) |
| F-67 | Os comandos de migração Docker do quickstart 001 (linhas 91-92) nunca funcionaram — a imagem de runtime não embarca `pnpm` nem `prisma` | verificado dentro da imagem construída pelo coordenador; forma de host verificada funcionando contra o banco do Compose (`pnpm --filter ./apps/api exec prisma migrate deploy`/`db seed`) — D-25, irmão de F-51 | G | confirmado, provado (não mais suspeitado) — corrigido por FR-025g |
| F-65 | `grc-foundation.openapi.yaml` declara `openapi: 3.1.0` mas usa `nullable: true` (sintaxe 3.0) em 15 pontos; os outros nove contratos usam a forma 3.1 | linhas 796, 801, 806, 807, 811, 840, 855, 858, 886, 893, 894, 939, 949, 950, 954 — confirmado pelo coordenador contra os dez documentos | B | confirmado — **pré-requisito bloqueante** do validador de payload (D-9/D-21/FR-017a), não faxina; sem a correção o validador recusaria `null` legítimo em `Action.completedAt/reopenedAt/description`, `Finding.closedAt`, `Evidence.archivedAt` |
| F-66 | Nove pontos de chamada de seletor de vínculo, em seis módulos de frontend, buscam página fixa com termo vazio e nunca buscam de novo — nenhum avisa que a lista é parcial | `risk-controls-section.tsx:362,378,394`; `control-links-section.tsx:418,434`; `requirement-controls-section.tsx:111`; `audit-scope-control-picker.tsx:56`; `finding-links-section.tsx` (controle + risco, `ensureOptionsLoaded:192-203` cacheia busca vazia, `q` real nunca passado); causa raiz medida rodando a suíte Chromium completa (75/3/0, 8min42s) — não hipótese | H | confirmado, **encontrado rodando a suíte, não lendo o código** — corrigido por US9/FR-025k a FR-025o; mesma forma de F-29, generalizada de uma tela para nove pontos de chamada |
| F-63 | `FindingRiskLink` existe no schema, mas `docs/deferred-findings.md` F-37 continua descrevendo a relação Finding→Risco como inexistente | ver linha F-37 acima — confirmado pelo coordenador contra `schema.prisma:2798-2810` | G | **confirmado, correção de front G** (não apenas discrepância reportada): marcar F-37 resolvido, com data e evidência, preservando o texto original |

---

## 5 — Cauda: capacidades de roadmap, não dívida desta fase

Itens que uma leitura apressada poderia confundir com correção pendente, e que não são: são
avanço de produto, fora da definição de "convergência" desta especificação (CLAUDE.md §16 — não
implementar a partir de ideia informal, sem spec própria).

- **Cartões reais do painel** para Controles, Conformidade, Auditoria, Ativos e Processos — Fase 7
  do roadmap (Indicadores e Relatórios). Esta fase apenas para de anunciar `CONTROLS` como planejado
  (F-53); não constrói os cartões.
- **`GET /risks/{riskId}/history` incluindo eventos `action.*`** — pergunta de produto legítima,
  levantada e explicitamente **não decidida** nesta fase (research.md D-5, correção do coordenador).
  O endpoint nunca incluiu esse tipo de evento; incluí-lo seria funcionalidade nova.
- **Catálogo pt-BR com extensão por módulo** (F-23 item 3) — gap real e confirmado por um segundo
  módulo real (`grc/evidence`, `grc/action`, `grc/finding` todos editam o mesmo arquivo
  compartilhado), mas é refatoração de mecanismo de extensão, não bug de comportamento — candidata a
  fase própria.
- **`session.expired` com o mesmo tratamento de `session.created`** — decisão explicitamente adiada
  (research.md D-13): a causa raiz medida é específica do login; medir `session.expired`
  separadamente é tarefa desta mesma frente (G) em `tasks.md`, mas a correção, se houver, não é
  presumida aqui.
- **`Finding` com relação direta a `Risk`**: **já existe** — `FindingRiskLink`, confirmado pelo
  coordenador (F-63/F-37 acima). O que fica de fora desta fase é apenas confirmar o consumo completo
  (se o painel de achados do risco já lê por esse vínculo, em vez do filtro por unidade organizacional
  que `findings-panel.tsx` descreve como contorno) — front G corrige o **registro** (marcar F-37
  resolvido); verificar o **consumo** de ponta a ponta é tarefa de quem próximo tocar aquele painel,
  não desta convergência.
- **Exigência de copiar `.env.example` para `.env` na raiz antes de `docker compose up`**: relatada
  por um agente de medição como lacuna genuína do caminho de instalação do zero. **Correção do
  coordenador, não achado**: já está documentada em `specs/001-grc-platform-foundation/quickstart.md:43`
  e em `docs/local-environment.md` (D-25). O único resíduo justo é uma frase no quickstart sobre a
  mensagem obscura que o Compose dá quando o passo é pulado — não uma correção de fluxo.
- **V5 (F-44 #3, edição de controle `RETIRED`)** — decisão já delegada à Fase 4, que já concluiu;
  registrado aqui para que a próxima leitura não presuma que esta fase deveria tê-la resolvido.
- Todo item listado no `## Out of Scope` de `spec.md`: novo módulo de negócio, relação
  Processo↔Ativo, multi-instituição, prova criptográfica de integridade de auditoria, novos
  provedores de identidade, IA/MCP.
