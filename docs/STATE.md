Status: vigente — fotografia do produto, não um changelog. Substituído/atualizado quando o estado
real mudar, não a cada commit.

# Estado do PharosGRC

**Última revisão**: 2026-09-14, `HEAD be6b734`. A superfície de Papéis e Permissões
(`specs/015-roles-permissions-surface/`) fechou nesta mesma janela, com regressão final verde e
zero bloqueadores — ver §10, "Última regressão registrada", para a fotografia numerada. Para
atualizar este documento: `git log -1`, revisitar cada tabela abaixo contra o código citado,
`grep '^## F-' docs/deferred-findings.md` para a lista de achados e seus marcadores de status
atuais, e reler o cabeçalho de cada `specs/NNN-*/STATE.md` desde a última revisão registrada aqui.

> **Nota datada, 2026-09-19 (rodada 023, saneamento total de findings)**: a §6 abaixo — a tabela de
> "Pendências conhecidas" — é uma fotografia de 2026-09-14 e está **desatualizada** quanto ao status
> de cada achado. Uma rodada de saneamento dedicada (Lotes A, B e C, ~40 commits em
> `023-detail-nav-performance`) revisitou o inventário inteiro de `docs/deferred-findings.md`
> item a item, com evidência de arquivo:linha ou execução real para cada um — não apagou nenhum
> achado, fechou cada um por correção de código, reconciliação (já estava corrigido antes, só o
> cabeçalho nunca foi atualizado), ou reclassificação honesta (obsoleto, decisão de design, limitação
> de ambiente, aceito com justificativa, ou pedido de capacidade de produto movido para
> `docs/architecture/grc-roadmap.md` §6). **Ao final desta rodada, `docs/deferred-findings.md` tinha
> exatamente UM achado aberto — F-56** (o padrão `Controller` do formulário compartilhado perde
> valor digitado antes da hidratação; a correção alcançaria 34+ pontos de chamada no Design System,
> deliberadamente deixada para decisão do coordenador, não desta rodada). Todo outro F-# listado como
> `ABERTO` na tabela de §6 abaixo — incluindo F-1, F-2, F-4, F-5, F-9, F-15, F-16, F-17, F-18, F-20,
> F-25, F-26, F-27, F-28, F-30, F-36, F-38 a F-45, F-48, F-55, F-57, F-59, F-60, F-64, F-65, F-69,
> F-70 — **já está fechado**. Consultar `docs/deferred-findings.md` diretamente para o texto e a
> evidência de cada fechamento; a tabela de §6 fica como registro histórico do que este documento
> media em 2026-09-14, não reescrita retroativamente.
>
> **Nota datada, 2026-09-19, mais tarde no mesmo dia**: o coordenador tomou a decisão que o
> parágrafo acima registrava como pendente. Medição campo a campo (não "reescrever os 34+ pontos de
> chamada às cegas"): das dez rotas `.../new` do produto, sete desabilitam todo campo até uma busca
> de dados assíncrona resolver — a janela de digitação pré-hidratação nunca fica aberta nelas,
> porque um campo `disabled` não aceita teclado. Só duas rotas tinham um campo genuinamente
> habilitado desde o primeiro paint, sem nenhum portão de carregamento: `compliance/new`
> (`FrameworkForm`) e `reports/new` (`ReportForm`). As duas foram corrigidas com a mesma wiring que
> o login já usa (`useRef` estável, leitura do DOM no submit), com teste de regressão na mesma
> técnica do D-21 original (`.value` definido direto no nó do DOM, contornando o evento sintético do
> React). **`docs/deferred-findings.md` tem agora ZERO achados abertos.** Ver F-56 no próprio ledger
> para o texto completo da medição e da correção, e `docs/local-environment.md` D-24 item 3 para uma
> medição relacionada, feita na mesma janela, sobre `--workers=1` do F-59 (não é o achado que estava
> aberto, mas foi verificada porque o coordenador a questionou durante o fechamento do F-56).

Este documento não repete o conteúdo de `docs/modules/*.md` — cita a conclusão e aponta para a
evidência.

---

## 1. O que existe hoje, em uma tela

- **Onze módulos de negócio** implementados sobre um núcleo de plataforma (`core/`) e um núcleo GRC
  compartilhado (`grc/`): Riscos, Controles, Compliance, Auditoria/Achados, Ativos, Processos,
  Incidentes, Problemas, Dashboard (agregação), Indicadores, Relatórios. Fecha as Fases 0–7 de
  `docs/architecture/grc-roadmap.md` — ver `docs/HANDOVER.md` para o diagrama de arquitetura.
- **Plano de Ação não é módulo** — é a capacidade compartilhada `Action` (`grc/action`), com
  superfície própria de interface desde `specs/010-action-plan-surface/` (CLAUDE.md §17 item 15).
- Trabalho pós-roteiro em cinco fases adicionais (`specs/011` a `specs/015`), nenhuma delas um
  módulo de negócio novo: visão de Dashboard como plataforma, refinamento visual de Papéis, uma
  auditoria de estabilização técnica, um loader de navegação institucional, e uma reconstrução da
  superfície de Papéis/Permissões — **fechada em 2026-09-14**, com regressão final verde e zero
  bloqueadores (§10 abaixo; `specs/015-roles-permissions-surface/STATE.md` é o registro completo).
- Interface 100% pt-BR (CLAUDE.md §11.1); identificadores técnicos em inglês.
- Arquitetura de origem única (ADR-014): `apps/web` faz *rewrite* server-side para `apps/api`, sem
  CORS, sem token visível ao cliente.

## 2. Módulos funcionais

| Módulo | Status | Evidência |
|---|---|---|
| Plataforma (Core) | IMPLEMENTADO, com 2 exceções nomeadas (ver §3) | [`docs/modules/platform.md`](./modules/platform.md) |
| Núcleo GRC compartilhado (Evidência/Ação/Achado) | IMPLEMENTADO | [`docs/modules/grc-core.md`](./modules/grc-core.md) |
| Gestão de Riscos | IMPLEMENTADO | [`docs/modules/risks.md`](./modules/risks.md) |
| Controles e Compliance | IMPLEMENTADO | [`docs/modules/controls-compliance.md`](./modules/controls-compliance.md) |
| Auditoria (Engajamentos) e Achados | IMPLEMENTADO | [`docs/modules/audit-engagements.md`](./modules/audit-engagements.md) |
| Ativos e Processos | IMPLEMENTADO | [`docs/modules/assets-processes.md`](./modules/assets-processes.md) |
| Incidentes e Problemas | IMPLEMENTADO | [`docs/modules/incidents-problems.md`](./modules/incidents-problems.md) |
| Indicadores e Relatórios | IMPLEMENTADO no núcleo; PARCIAL em 3 telas administrativas (ver §3) | [`docs/modules/indicators-reports.md`](./modules/indicators-reports.md) |
| Dashboard GRC | IMPLEMENTADO (agregação de leitura, não módulo de negócio) | [`docs/modules/dashboard.md`](./modules/dashboard.md) |

Nenhum módulo de negócio planejado em CLAUDE.md §1 está ausente por inteiro. O que resta PARCIAL ou
PLANEJADO está dentro de módulos já implementados, ou é capacidade de plataforma (§3/§4).

## 3. O que está parcial

Coletado dos próprios documentos de módulo — cada linha tem uma capacidade real por trás, não um
módulo inexistente:

| Onde | O que falta | Evidência |
|---|---|---|
| Plataforma — Sessões | Autoatendimento (listar/revogar as próprias sessões) — só existe "revogar tudo", administrativo | `docs/modules/platform.md` §5 |
| Plataforma — Auditoria | Sem navegador de trilha de auditoria em nível de plataforma — leitura só existe por módulo (`GET /risks/{id}/audit-events`, `GET /actions/{id}/audit-events`) | `docs/modules/platform.md` §6, `docs/architecture/security.md` |
| Indicadores | `IndicatorDefinition` (criar/editar limiar, responsável): `POST`/`PATCH /indicators` existem na API; **nenhuma tela chama** — `createDefinition` no cliente web não tem chamador | `apps/api/src/modules/indicators/presentation/indicator.controller.ts`, `apps/web/src/features/indicators/api.ts` |
| Relatórios | `ReportDefinition`: `PATCH /reports/{id}` implementado e funcional na API (desde T068); **sem tela de edição** e sem método `updateDefinition`/`getDefinition` no cliente web | `apps/api/src/modules/reports/presentation/report.controller.ts`, `apps/web/src/features/reports/api.ts` |
| Ação com origem Indicador | `ActionOriginType.INDICATOR` existe no schema Prisma (`enum ActionOriginType` teria essa 6ª origem), mas está deliberadamente adiado — não está no contrato (`specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`) nem no web (`features/actions/origin.ts`, `lib/messages/actions.ts`) | ver §7(b) abaixo |
| Núcleo GRC — painel de ações por origem | Incidente, Problema e Achado têm três cópias quase idênticas do mesmo painel (busca/tabela/formulário/transições), não extraídas | `docs/modules/grc-core.md`, `specs/010-action-plan-surface/STATE.md` §7 |

## 4. O que está planejado ou não existe

Itens de CLAUDE.md §1/§5/§4 sem implementação, verificados diretamente no código (não por
suposição):

- **LDAP, Active Directory, OIDC, SAML** (CLAUDE.md §5) — só `local` existe em
  `apps/api/src/core/identity/infrastructure/providers/`. A abstração de provedor
  (`AuthenticationProvider`) existe e compila, mas nunca foi exercitada por um segundo provedor —
  por CLAUDE.md §19.10, isso não conta como capacidade provada, só como ponto de extensão. Ver
  `docs/architecture/security.md`, seção "Abstração de provedor de identidade".
- **Configurações** (CLAUDE.md §4, capacidade Core) — não existe `apps/api/src/core/configuration/`.
  Apenas objetos de configuração por variável de ambiente, por módulo, em tempo de compilação (ex.
  `identity-settings.ts`). Nenhum mecanismo de feature flag, nenhuma tela de administração de
  configuração.
- **`core/users` como diretório próprio** — administração de usuário vive hoje dentro de
  `core/identity` (`UserDirectoryPort`), não em uma árvore `core/users/**` separada. Não é um gap
  funcional (a capacidade existe), é uma nota de organização de código.
- **Modelo multi-tenant de `Organization`** — não existe. O que existe é `OrganizationalUnit`, uma
  árvore de unidades organizacionais de caminho materializado dentro de **uma única** organização
  (ADR-004) — é a capacidade "Organizações" de CLAUDE.md §4, implementada como hierarquia interna,
  não como contêiner multi-tenant. Nenhum requisito registrado pede multi-tenância de verdade
  (múltiplas organizações-cliente isoladas num único deployment); citado aqui só porque a pergunta
  já surgiu antes.
- **Content-Security-Policy / X-Frame-Options em `apps/web`** — ver achado (a) em §7.
- **Varredura de malware em upload** — ausente, sem ADR registrando a decisão (ver achado (g) em
  §7).

## 5. Decisões arquiteturais vigentes

Índice completo em [`docs/architecture/decisions.md`](./architecture/decisions.md) (ADR-016 em
diante; ADR-001–015 vivem em `specs/001-grc-platform-foundation/research.md`, ainda válidas). As
duas mais recentes, aceitas em 2026-09-14 durante esta mesma revisão documental, formalizam
decisões que já estavam implementadas:

- **ADR-023** — navegação do frontend passa por abstração própria (`Link`/`useNavigate()`), nunca
  pela API nativa do Next.js diretamente; `loading.tsx` nativo avaliado e rejeitado (pisca,
  substitui a tela em vez de sobrepor). Ver `docs/architecture/frontend.md` §3.
- **ADR-024** — `packages/api-types` gera dos contratos hand-authored (`specs/*/contracts/*.openapi.yaml`),
  nunca do documento OpenAPI refletido (`apps/api/openapi.json`, que tem os 80 esquemas de
  componente vazios porque nenhum DTO usa `@ApiProperty`). O documento refletido continua útil só
  como detector de deriva de rota.

## 6. Pendências conhecidas (`docs/deferred-findings.md`)

`docs/deferred-findings.md` é a fonte viva — pelo menos 73 achados registrados (F-1 a F-73; F-10 e
F-11 nunca existiram, numeração pulada; o defeito irmão de F-71 (F-74), encontrado durante o
fechamento de `specs/015-roles-permissions-surface/`, foi registrado separadamente), a maioria já
`RESOLVIDO`/`CORRIGIDO`/`FECHADO`. Os que seguem em aberto
(`ABERTO`/`REABERTO`/`BLOQUEADO`/`PARCIALMENTE RESOLVIDO`, ou sem marcador de status na própria
entrada), verificados diretamente no documento nesta revisão:

| F-# | Resumo | Status |
|---|---|---|
| F-59 | `ThrottlerGuard` global derruba jornadas E2E longas sob concorrência real; sem decisão de mitigação tomada | ABERTO |
| F-58 | CI remota bloqueada por faturamento do GitHub (externo ao código) | BLOQUEADO (externo) |
| F-57 | 2 vulnerabilidades moderadas (`vitest`/`@vitest/mocker`) via `pnpm audit`, abaixo do teto que quebra o gate | ABERTO |
| F-70 | Contas de E2E se acumulam permanentemente no banco de dev — sem endpoint de exclusão de usuário | ABERTO |
| F-69 | No WebKit, clique em botão não deixa foco visível nele (diferença de motor, não defeito confirmado de produto) | ABERTO |
| F-66 | Transbordo horizontal a 390px em sete telas | PARCIALMENTE RESOLVIDO (causa 2 corrigida; causas 1 e 3 abertas) |
| F-65 | Upload acima de 32 MB falha devagar pela origem web (proxy do Next mantém bytes não lidos) | ABERTO |
| F-64 | Achado de engajamento de auditoria sem caminho de gestão quando a unidade organizacional não tem risco | ABERTO |
| F-63 | Texto de interface em inglês e referências internas de especificação vazando para a tela | PARCIALMENTE RESOLVIDO (parte 1 segue aberta) |
| F-60 | Seed nunca reposiciona a unidade organizacional de um usuário já existente no banco | ABERTO |
| F-56 | Padrão `Controller` de formulário compartilhado pode perder valor digitado antes da hidratação (confirmado só no login; outros formulários não auditados) | ABERTO |
| F-55 | Controles e Compliance nunca ganharam E2E nem varredura de acessibilidade dedicados | ABERTO |
| F-48 | Suíte E2E completa não cabe no orçamento local de tentativas de login | ABERTO |
| F-45 | Corrida entre arquivos de teste sob paralelismo (causa parcialmente corrigida, gap de fundo aberto) | ABERTO/não-bloqueante |
| F-44 | Dívida aceita da fase de Controles — 3 itens, cada um com dono e portão de remoção | ABERTO (deliberado) |
| F-43 | Helper de login do E2E relata limite de taxa como "senha errada" | ABERTO/não-bloqueante |
| F-42 | Padrão recorrente por trás de F-39–F-41 (tipos escritos à mão divergindo do contrato) | ABERTO (questão de prática, não instância única) |
| F-41 | Corpo JSON malformado não recebe `correlationId` | ABERTO |
| F-40 | Tipos de Evidência/Achado escritos à mão prometem `OrgUnitRef.code` que a API não envia sempre | ABERTO (parcialmente endereçado) |
| F-39 | `EntityTabs` transborda sem indicação de rolagem | ABERTO (estava "sendo corrigido" na própria entrada, sem confirmação posterior) |
| F-38 | Negação por escopo organizacional nunca é auditada como `DENIED` — só a metade de permissão é | ABERTO |
| F-36 | Janela de coexistência `RiskTreatmentAction`/`Action` — dívida aceita com marco de convergência | ABERTO no próprio documento; **a convergência de Ação já foi commitada em `specs/007-implementation-remediation/`** (migração `20260911000000_action_convergence_risk_treatment_actions`) — o marcador de F-36 pode estar desatualizado frente a esse commit; requer triagem para confirmar se o achado foi fechado sem atualizar o cabeçalho |
| F-30 | Link do dashboard falha contraste AA no tema escuro | ABERTO, mas referencia `DashboardMetricCard` — ver achado (e) em §7 |
| F-28 | Violação real de acessibilidade nos gráficos do dashboard, medida durante o commit que afirmava zero violações | Entrada termina em "sendo corrigido agora", sem marcador de fechamento posterior nesta própria entrada — mas `docs/modules/dashboard.md` e `specs/007-implementation-remediation/matrix.md:81` afirmam resolvido; inconsistência de registro, não de comportamento — requer sincronizar o cabeçalho do achado |
| F-27 | Comentário no código afirma uma verificação que não existe | ABERTO |
| F-26 | Deduplicação de anexo por hash é um oráculo de existência entre escopos | ABERTO (severidade média, não medida) |
| F-25 | O lint de fronteira é cego para exatamente o arquivo que um módulo novo costuma errar primeiro | ABERTO |
| F-20 | Tabelas append-only tornam qualquer fixture que escreve nelas permanentemente irreversível | Registrado como cautela permanente, sem dono — não é defeito a corrigir |
| F-18 | Tipos do frontend dizem "presente e nulo"; a API às vezes não envia o campo | ABERTO |
| F-17 | `Select` do Radix deixa o listbox aberto no Firefox | ABERTO |
| F-16 | Instabilidade de E2E sob workers paralelos é corrida de conta compartilhada, não "carga" | ABERTO |
| F-15 | As fixtures semeadas tornam o cenário de segregação de funções impossível de encenar de verdade | ABERTO |
| F-9 | Uma avaliação registra a data que ela afirma, não o instante em que foi de fato gravada | ABERTO |
| F-5 | Banco de teste é migrado mas nunca semeado — cada suíte cria sua própria fixture | ABERTO (convenção aceita, não bug ativo) |
| F-4 | E2E declara três navegadores e verifica genuinamente dois (WebKit não é exercitado localmente) | ABERTO |
| F-2 | `role="status"` em texto presente já na primeira renderização não é anunciado por leitor de tela | ABERTO |
| F-1 | Mapas de rótulo que espelham enum tipados fracamente o suficiente para não falhar numa tradução faltando | ABERTO — vale como lembrete de padrão para todo módulo novo |

Achados `RESOLVIDO`/`CORRIGIDO`/`FECHADO` (F-3 parcial, F-6, F-7, F-12, F-13 dividido, F-14, F-19,
F-21, F-22 (via F-23), F-24, F-31, F-32, F-33, F-34, F-35, F-37, F-46, F-47, F-49, F-50, F-51, F-52,
F-53, F-54, F-61, F-62, F-67, F-68, F-71, F-72, F-73, F-74) não estão listados aqui — ver o
documento para o texto completo caso precise da resolução histórica. F-71 (incompatibilidade de
hidratação no `FilterBar`, `aria-valid-attr-value`) e seu defeito irmão (F-74) em
`MultiSelectFilter`/`ColumnVisibilityMenu` foram corrigidos mantendo o elemento do painel
presente em toda passagem de render e ocultando-o com o atributo `hidden` — ver
`docs/architecture/frontend.md` §4.3 e `docs/guides/testing.md` §1.6/§5.3/§5.6 para o mecanismo e a verificação. F-72
(suíte E2E completa não passava inteira numa execução única) está resolvido: a regressão final de
`specs/015-roles-permissions-surface/` rodou a suíte Chromium inteira, e as extensões
Firefox/WebKit de `admin-roles`, numa única execução cada — ver §10.

## 7. Achados desta revisão documental (2026-09-14), ainda não registrados em `docs/deferred-findings.md`

Encontrados durante a escrita desta documentação, verificados diretamente no código. **Não
corrigidos por esta revisão — requerem triagem humana** para decidir se viram um F-número novo, uma
tarefa, ou uma decisão registrada de aceitar como estão.

**(a) `apps/web` não define Content-Security-Policy nem `X-Frame-Options`.**
`apps/web/next.config.ts` não tem função `headers()` nem qualquer configuração de CSP. `helmet()`
em `apps/api/src/main.ts` protege só as respostas JSON da API (`/api/v1/*`) — não o HTML/JS que o
próprio `apps/web` serve, que é a superfície real de XSS/clickjacking no navegador. Já citado como
lacuna conhecida em `docs/architecture/security.md`, "Lacunas conhecidas e não corrigidas" — repetido aqui porque
ainda não tem F-número.

**(b) `ActionOriginType.INDICATOR` existe no schema mas está ausente do contrato e do web.**
`apps/api/prisma/schema.prisma` documenta explicitamente, em comentário próprio (linhas ~361-364),
que `ActionOriginType += INDICATOR` foi **deliberadamente** deixado fora da migração que criou o
enum (research.md D-5, CLAUDE.md §19.10) — hoje o enum `ActionOriginType` em produção só tem
`RISK_TREATMENT, FINDING, CONTROL_ASSESSMENT, INCIDENT, PROBLEM` (5 valores, confirmado em
`schema.prisma` linhas 2277-2292 **e** em `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`
linha 822 **e** em `apps/web/src/features/actions/origin.ts` **e** em
`apps/web/src/lib/messages/actions.ts`). É consistente hoje (nada referencia `INDICATOR` como
origem em lugar nenhum), mas é a mesma lacuna que `docs/modules/indicators-reports.md` já registra
como PARCIAL: o backend de Indicadores cria `Action` com essa origem pretendida, sem caminho até a
UI. Decisão deliberada e datada, não drift silencioso — mas ainda sem F-número dedicado.

**(c) Telas de criação/edição ausentes apesar do endpoint existir** — ver §3 acima
(`IndicatorDefinition`, `ReportDefinition`).

**(d) `apps/web/src/lib/messages/index.ts` não agrega seis catálogos que existem e são usados.**
O arquivo reexporta só `actions, admin, auditEngagements, auth, common, dashboard, errors,
evidence, findings, indicators, profile, reports, risks, shell, validation` (14 catálogos). Omite
`assets`, `compliance`, `controls`, `incidents`, `problems`, `processes` — os seis arquivos existem
e são importados diretamente (`@/lib/messages/controls`, etc.) em todo o código, então nada quebra
hoje; é uma divergência real entre o comentário do próprio arquivo ("every user-facing string...
lives in one place") e o que ele de fato agrega. Já citado em `docs/architecture/frontend.md` §5.

**(e) F-30 referencia `DashboardMetricCard`, que não existe mais.**
O componente foi dividido em `DashboardChartCard` (`apps/web/src/features/dashboard/components/dashboard-chart-card.tsx`,
comentário do próprio arquivo: "Replaces `DashboardMetricCard`...") e `DashboardStatCard` durante o
rework de `specs/011-dashboard-platform-view/`. O achado de contraste original (link
"Ver registro de riscos" a 3.37:1 no tema escuro) nunca foi reavaliado contra os componentes novos —
pode já não se aplicar, pode se aplicar a um deles, ninguém mediu. F-21 (tema escuro inalcançável),
que F-30 citava como razão para adiar a correção, está resolvido desde 2026-09-07 (existe
`ThemeToggle` real) — outra premissa do achado original que também não foi revisitada.

**(f) Comentários de código desatualizados.**
- `apps/api/prisma/schema.prisma`, acima de `model Process` (linha ~1678) e `model Asset` (linha
  ~1700): "no Process/Asset Management module exists in this release (spec Out of Scope)" —
  **falso hoje**: `apps/api/src/modules/{assets,processes}/` existem como módulos completos desde
  `specs/006-assets-processes/`.
- `apps/web/src/features/reports/components/report-form.tsx` (linhas 6-9) e
  `apps/web/src/features/reports/types.ts` (linhas 16-20): afirmam que `updateReportDefinition`
  "existe no contrato mas é deliberadamente não implementado" — **falso hoje**:
  `apps/api/src/modules/reports/presentation/report.controller.ts` implementa `PATCH /reports/{id}`
  desde T068, com caso de uso real (`UpdateReportDefinitionUseCase`) por trás. O que continua
  verdadeiro é que **o web não chama** esse endpoint (ver §3) — só o comentário sobre o motivo está
  errado.

**(g) Sem varredura de malware em upload, sem ADR registrando a decisão.**
Confirmado: nenhuma referência a `clamav`/`virus`/`malware`/`scan` em `apps/api/src/core/files`, e
nenhuma ADR em `docs/architecture/decisions.md` discute a ausência como decisão deliberada. Duas
camadas de validação de conteúdo existem (lista de MIME permitida + farejamento de assinatura de
bytes — ver `docs/architecture/security.md`), mas nenhuma delas é varredura de malware.

## 8. Dívida técnica relevante

Além dos achados abertos em §6/§7:

- **Três cópias quase idênticas do painel de ações por origem** (Incidente, Problema, Achado) —
  extração avaliada e recomendada, não feita por conflito de frentes paralelas
  (`specs/010-action-plan-surface/STATE.md` §7).
- **`ControlRegistryPort.list()` órfão** e **leitura com escopo duplicada** (`ControlLookupPort` vs
  `ControlRepositoryPort`) — dois itens de F-44, cada um com portão de remoção na próxima vez que o
  repositório for tocado.
- **Controle `RETIRED` ainda aceita edição de campos descritivos** — F-44 item 3, adiamento
  deliberado até Auditoria precisar do contrário.
- **`GET /dashboard` ainda vive em `modules/risk`**, não em `modules/dashboard` — deliberado, não
  estritamente necessário mover (`docs/modules/dashboard.md`).
- **Exposição de contraste em `AssetForm`** idêntica à corrigida em `ProcessForm` — latente,
  deliberadamente não corrigida às cegas (`docs/modules/indicators-reports.md`).
- **Flag diagnóstica de worker único do WebKit** em `.github/workflows/ci.yml` (commit `44e1e04`) —
  **decisão datada, 2026-09-19 (rodada 023, reconciliação de documentação paralela)**: mantida
  deliberadamente, não esquecida. F-59 (limitador global sob concorrência local) está **fechado**
  desde esta mesma rodada — a menção anterior a "ligada a F-59 (ainda ABERTO)" estava desatualizada;
  os dois mecanismos são distintos (F-59 é o `ThrottlerGuard` local, esta flag é um ajuste de
  paralelismo do job WebKit na CI) e o fechamento de um não valida nem invalida o outro. F-72 (suíte
  E2E completa não passava numa execução única) está resolvido desde o fechamento de `specs/015`,
  mas isso também não revalida a flag por si só — o que a revalidaria é um `workflow_dispatch`
  comparativo real (com e sem a flag) contra o job WebKit da CI, e **F-58 registra que a CI remota
  está bloqueada por faturamento do GitHub**, tornando essa execução hoje impossível de obter. A
  flag permanece até o bloqueio do F-58 cair; quem retomar a CI remota depois disso é quem revisita
  esta decisão, com o `workflow_dispatch` comparativo como critério de remoção.
- **Sem E2E cobrindo a linha de papéis do Perfil (F-75)** — `apps/web/src/app/(app)/profile/profile-view.tsx`
  exibe os papéis do usuário logado em pt-BR (catálogo único `common.roleDisplayNames`, ver
  `docs/architecture/frontend.md` §5), com prova só no nível de componente
  (`apps/web/src/app/(app)/profile/profile-view.test.tsx`); nenhum spec em `apps/web/e2e/` navega
  até `/profile` e verifica essa linha em navegador. Lacuna, não regressão.
- **Referência morta em comentário de teste (F-76)**: `apps/web/e2e/admin-roles.spec.ts:40` cita
  `apps/api/test/integration/role-admin.spec.ts`, arquivo que nunca existiu neste repositório —
  achado do lado do código, pendente de correção (mover/renomear o comentário para o arquivo real
  de integração, `role-administer-user-boundary.spec.ts`, ou remover a referência).
- **Mecanismo latente de `aria-controls` pendurado em `DisclosureGroup`** — o mesmo defeito de
  hidratação que F-71 corrigiu em `FilterBar`/`MultiSelectFilter`/`ColumnVisibilityMenu` (F-74) também
  existe em `packages/design-system/src/components/disclosure-group.tsx`, mas **não foi corrigido**:
  esse componente desmonta o conteúdo quando fechado, e o consumidor real (o catálogo de permissões
  por módulo do detalhe de papel) tornaria a correção "manter montado, ocultar com `hidden`" cara —
  montaria o catálogo de permissões inteiro em toda carga de tela. Decisão registrada como troca
  deliberada (CLAUDE.md §16), não como pendência esquecida — mas o mecanismo continua lá, latente,
  até alguém decidir pagar o custo de montagem ou redesenhar o consumidor.
- **D-23 não aplicado na máquina de referência** (`docs/local-environment.md`) — o `.env` local
  mantém os limitadores de taxa de autenticação em valor de produção; quem depender de rodar E2E
  localmente contra essa máquina ainda esbarra em F-48/F-59 sem o ajuste que D-23 descreve.

## 9. Próximos trabalhos já identificados

- **CLAUDE.md §17**, bloco "Próximo passo real" (2026-09-12): o roteiro planejado (Fases 0–7) está
  concluído; o próximo passo é uma **decisão de produto**, não uma tarefa de implementação pronta
  para começar — evolução de um módulo existente, uma integração, ou um domínio GRC novo fora da
  lista de CLAUDE.md §1.
- **`specs/010-action-plan-surface/STATE.md` §7**: extração do painel de ações por origem (ver §8
  acima); criação de ação a partir da tela central é decisão deliberada de **não** fazer (R-009),
  não pendência.
- **`specs/015-roles-permissions-surface/STATE.md`**: fase **fechada em 2026-09-14**, com regressão
  final verde e zero bloqueadores (§10 abaixo). A onda que reabriu F-71 (incompatibilidade de
  hidratação do `FilterBar`) terminou com causa-raiz identificada e corrigida, e o defeito irmão em
  `MultiSelectFilter`/`ColumnVisibilityMenu` (F-74) encontrado e corrigido junto. Pendências reais
  que a fase deixou: gap de E2E na linha de papéis do Perfil (F-75), referência morta em
  `admin-roles.spec.ts:40` (F-76), e o mecanismo latente de `DisclosureGroup` — ver §8 acima.
- **Separação seed base / seed de demonstração — ponto de integração pendente, confirmado
  ausente.** `docs/architecture/database.md` §13/§14 registra explicitamente: não existe hoje nenhum arquivo,
  script ou referência a "demo seed"/"base seed" no repositório (`apps/api/prisma/seed/` tem
  `admin.seed.ts`, `index.ts`, `methodology.seed.ts`, `performance.seed.ts`, `platform.seed.ts`,
  `risk-reference.seed.ts` — nenhum split por finalidade demo/base). Quem for construir essa
  separação no futuro parte de `platform.seed.ts` (hoje a única fonte, `SEED_DEV_FIXTURES=true`
  controla só a fixture de desenvolvimento, não uma fixture de demonstração distinta) sem tocar no
  seed de produção existente.

## 10. Última regressão registrada

**Fotografia datada, não um estado permanente** — números medidos no fechamento de
`specs/015-roles-permissions-surface/` (2026-09-14, `HEAD be6b734`), a rodada de regressão final da
fase. Não atualizar por commits futuros sem medir de novo; se este documento for revisitado muito
depois desta data, trate estes números como históricos e confira `specs/015-roles-permissions-surface/STATE.md`
para a medição mais recente da própria fase.

| Suíte | Resultado |
|---|---|
| Unidade — Web | 1013/1013 |
| Unidade — API | 661/661 |
| Integração — API | 297/297 |
| Contrato — API | 827/827 |
| E2E — Chromium | 198/198 |
| E2E — `admin-roles`, Firefox + WebKit | 32/32 |
| Acessibilidade (`@axe-core/playwright`) | 105 varreduras, zero falhas |
| Lint / typecheck / `format:check` / `openapi:check` | Limpos |

Nenhum teste descoberto ficou sem executar (ver `execution-ledger-reporter`, §1.5 de
`docs/guides/testing.md`). Zero bloqueadores registrados no fechamento da fase.
