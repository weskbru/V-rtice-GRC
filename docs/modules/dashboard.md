# Dashboard GRC

## Status

**IMPLEMENTADO** como tela inicial da plataforma (`/dashboard`), multi-domínio, com dois endpoints
próprios e composição condicionada a permissão. Não é módulo de negócio no sentido de CLAUDE.md §4
(não tem entidade, não persiste nada) — é camada de agregação de leitura.

Não consta como fase numerada em CLAUDE.md §17: foi entregue como correção pontual
(`specs/011-dashboard-platform-view/`, duas iterações registradas em `STATE.md`), fora da sequência
de fases do roteiro (Fases 0–7, já concluído antes desta frente começar).

Itens em aberto, com evidência atual:

| Item | Situação | Evidência |
|---|---|---|
| F-28 (varredura axe media gráfico antes de renderizar) | **Fechado** — corrigido na causa (`accessibilityLayer={false}` no Recharts) e na guarda (a varredura espera `svg.recharts-surface`) | `apps/web/src/features/dashboard/components/risk-level-chart.tsx:26-36`, `apps/web/e2e/accessibility.spec.ts:622-660`; classificado "resolvido" em `specs/007-implementation-remediation/matrix.md:81` |
| F-30 (contraste do link do card no tema escuro) | Referenciava `DashboardMetricCard`, componente **removido** na reforma de `specs/011` (`STATE.md` §2.6) — achado tecnicamente obsoleto, sem card equivalente revalidado nesta tela | `docs/deferred-findings.md:792-818`; `specs/011-dashboard-platform-view/STATE.md` §2.6 |
| Aprovações pendentes sem caminho de "aguardando esta pessoa" | Aberto, decisão de produto fora do escopo desta frente | `specs/011-dashboard-platform-view/STATE.md` §6 |
| `GET /dashboard` permanece em `modules/risk`, não migrado | Aberto, decisão deliberada (não estritamente necessário) | `STATE.md` §6, §2.2 |
| Ativos e Processos sem card no dashboard | Aberto, retirados por só publicarem uma métrica ("inativos") | `STATE.md` §7.1, §7.6 |
| E2E de escopo organizacional específico do dashboard | Existe (`dashboard.spec.ts`, 2 testes: visão ampla vs. Risk Analyst), mas não cobre todo domínio individualmente — cobre por omissão de card | `apps/web/e2e/dashboard.spec.ts` |

## Objetivo

Polish visual de 20/09/2026: Atenção usa uma superfície quente discreta; Visão dos
módulos usa uma superfície neutra próxima ao fundo. Nos cards de atenção, ícone e
lavagem contextual distinguem aprovação (âmbar), atraso (vermelho), prazo próximo
(azul), revisão de risco (teal), incidente (coral) e problema (violeta). No microajuste final, a faixa lateral acompanha a família do ícone; zero e
ausência de dados continuam neutros. Indicadores em alerta deixa de ser renderizado
na seção de atenção, sem alteração da fonte de dados. São seis colunas no desktop
e três no tablet. Os atalhos passam a ter 36px de altura, ícones de 16px e texto de 14px. Ações rápidas vem depois dos gráficos,
com os mesmos destinos e permissões. Hero, ModuleCards e gráficos não mudaram.

Tela inicial pós-login: "entender o estado geral, ver o que precisa de atenção agora, ir para o
lugar certo" — não um registro, não BI (comentário de cabeçalho de
`apps/web/src/app/(app)/dashboard/page.tsx:6-10`).

Domínios hoje representados na tela renderizada (confirmado no código, não na intenção da spec):
Riscos, Ações (Planos de Ação), Incidentes, Problemas, Controles, Compliance, Auditoria (engajamentos
e achados), Indicadores. Ativos e Processos **não** aparecem (retirados deliberadamente, ver tabela
acima). Confirma CLAUDE.md §11: "Dashboard GRC", não dashboard exclusivo de riscos.

## Entidades principais

**Nenhuma.** O dashboard não possui modelo Prisma próprio — confirmado por busca no schema
(`apps/api/prisma/schema.prisma`, nenhum `model` com "Dashboard" no nome). É inteiramente uma
camada de agregação de leitura sobre dados de outros módulos e sobre o catálogo de indicadores
(`IndicatorCalculationService`, CLAUDE.md §19.7).

## Arquitetura em duas localizações (`core/dashboard` vs `modules/dashboard`)

As duas pastas existem por razões **diferentes e não relacionadas entre si** — não é uma divisão
domínio/aplicação da mesma capacidade. Rastreado por import real, não por suposição:

### `apps/api/src/core/dashboard/`

Contém só `dashboard.module.ts` e `domain/planned-area-registry.ts` +
`domain/default-planned-areas.ts`. É um **registro genérico de "áreas planejadas"** — que módulos
GRC futuros ainda não têm `modules/**` próprio — no mesmo padrão de
`core/comments/domain/entity-registry.ts` (`registerAttachableEntityType`). `DashboardModule` não
tem controllers nem providers de negócio; seu único efeito é chamar
`registerDefaultPlannedAreas()` no boot (hoje registrando **zero** entradas — Problemas, Incidentes
e Controles saíram do registro quando ganharam módulo próprio, `default-planned-areas.ts:16-39`).

**Quem consome `core/dashboard`**: `modules/risk/application/get-dashboard.usecase.ts:48`
(`import { getPlannedAreas } from '../../../core/dashboard/domain/planned-area-registry'`) — ou
seja, é `modules/risk` que lê o registro do `core/`, nunca o contrário
(`core/**` nunca importa `modules/**`, ADR-011). `modules/dashboard` **não importa
`core/dashboard` em lugar nenhum** — confirmado lendo os quatro arquivos de
`modules/dashboard/**` por inteiro.

### `apps/api/src/modules/dashboard/`

Um módulo de negócio independente que serve `GET /dashboard/summary`, o agregado
multi-domínio (métricas do catálogo de indicadores + seis blocos `breakdowns`). Importa
diretamente (nunca via `@Global()`): `AuthorizationModule`, `OrganizationsModule`, `IndicatorsModule`,
`ActionModule` (`grc/action`, capacidade de núcleo GRC, ADR-016),
`IncidentMetricsModule`/`ProblemMetricsModule`/`ControlMetricsModule`/`ComplianceSummaryModule`/
`IndicatorMonitoringModule` (portas de fronteira `shared/grc-ports/**`)
(`dashboard-summary.module.ts:52-87`).

### Conclusão sobre a divisão

Não é "domínio em `core`, aplicação em `modules`" da mesma capacidade — são **duas capacidades de
dashboard genuinamente distintas**, cada uma com seu próprio dono:

1. `GET /dashboard` (áreas de Risco + `plannedAreas`) pertence a `modules/risk`, que **usa** o
   registro genérico de `core/dashboard` para a lista de áreas planejadas.
2. `GET /dashboard/summary` (catálogo de indicadores + `breakdowns`) é o módulo `modules/dashboard`,
   que não tem relação de import com `core/dashboard`.

A razão dessa separação está documentada nos próprios cabeçalhos de arquivo
(`get-dashboard-summary.usecase.ts:1-20`, `dashboard-summary.module.ts:1-16`): `core/**` nunca pode
importar `modules/**` (ADR-011), e guardas de arquitetura já existentes
(`controls-risk-module-boundary.spec.ts`, `compliance-controls-risk-module-boundary.spec.ts`,
`audit-engagements-module-boundary.spec.ts`) impedem estender o caso de uso de `modules/risk` para
ler Controles, Compliance ou Auditoria. Por isso o resumo entre domínios precisou de um módulo de
negócio próprio — nunca poderia morar em `core/`.

Ambos os módulos (`core/dashboard.DashboardModule` e `modules/dashboard.DashboardSummaryModule`)
são registrados de forma independente em `apps/api/src/app.module.ts:9,36,72,157`.

## Regras de negócio relevantes

- **Nenhum cálculo é duplicado.** `GET /dashboard/summary#metrics` é o catálogo fechado de onze
  `IndicatorMetricKey` avaliado por `IndicatorCalculationPort`, o mesmo calculador único da
  plataforma (CLAUDE.md §19.7) que `modules/reports` também consome
  (`get-dashboard-summary.usecase.ts:21-29`).
- **Permissão por omissão, nunca zerada** (exceto `GET /dashboard`, que zera — ver abaixo). Uma
  chave sem permissão do domínio de origem **não é calculada** e **não aparece** no array; um bloco
  de `breakdowns` sem a permissão do domínio dono é `undefined` por inteiro
  (`get-dashboard-summary.usecase.ts:30-48`, §223-237 do mesmo arquivo).
- **Exceção**: `GET /dashboard` (áreas de Risco, em `modules/risk`) **zera** em vez de omitir para
  quem não tem `risk:view`/`risk:approve` — decisão herdada da spec original (comentário do próprio
  `get-dashboard.usecase.ts:11-37`), distinta e mais antiga que a disciplina "omitido, nunca
  zerado" adotada em `GET /dashboard/summary`.
- **Escopo resolvido uma única vez por requisição** em cada endpoint
  (`ScopeResolverService.resolveScope` + `PermissionResolverService.getEffectivePermissions`,
  chamados uma vez e repassados a cada consulta — ADR-004).
- **A única aritmética no frontend** é somar buckets/status que já chegaram juntos numa mesma
  resposta (`apps/web/src/features/dashboard/summary.ts#bucketTotal`/`sumOf`) — nunca uma lista de
  registros baixada para contar tamanho.
- **`breakdowns` reaproveita cálculos existentes**, nunca uma segunda regra: eficácia de controle e
  estado de requisito de conformidade vêm do mesmo adaptador que os provedores de indicador já usam
  (`get-dashboard-summary.usecase.ts:58-87`).

## Telas

- **Rota**: `/dashboard` (`apps/web/src/app/(app)/dashboard/page.tsx`), tela pós-login. Sem outras
  rotas de dashboard (não há `/dashboard/[id]` nem sub-rotas).
- **Composição** (topo→base): cabeçalho com data do dia (`DashboardToday`) → seção "O que requer
  atenção agora" (até 6 `DashboardStatCard`, condicionais por permissão) → seção "Visão dos
  módulos" (até 8 `DashboardModuleCard`: Riscos, Planos de Ação, Incidentes, Problemas, Controles,
  Compliance, Auditoria, Indicadores) → seção de distribuição (até 3 gráficos: nível de risco
  residual, status de risco, planos de ação por status) → "Ações rápidas"
  (`DashboardQuickActions`) → "Módulos planejados" (só renderiza se o
  registro de `core/dashboard` tiver alguma entrada — hoje vazio, então a seção não aparece).
- **Gráficos**: `RiskLevelChart` (barras Recharts, nível residual), `ActionStatusDonut` (rosca
  Recharts, planos de ação por status), `RiskStatusChart` (tabela real, não Recharts — decisão
  deliberada por ter 8 categorias, várias zeradas, ver cabeçalho do arquivo).
- **Degradação explícita**: se `GET /dashboard` falha, tela inteira vai a estado de erro com retry;
  se só `GET /dashboard/summary` falha, a visão de risco permanece e um aviso indica possível
  incompletude (`page.tsx:109-138`, `dashboard.states.summaryUnavailable`).
- **Duas requisições por carregamento**, em paralelo (`Promise.allSettled`), nunca uma por módulo
  nem lista de registros baixada para contar.

## Permissões

O dashboard **não tem chave de permissão própria** — confirmado: nenhuma ocorrência de "dashboard"
em `apps/api/src/permission-catalogue.ts`. Ambos os endpoints usam `@NoPermissionRequired()`
(qualquer sessão autenticada pode chamar); a composição visível é decidida **dentro** de cada caso
de uso, por permissão de domínio de origem já existente:

| Permissão | Efeito na tela |
|---|---|
| `risk:view` | Áreas de risco em `GET /dashboard` deixam de ser zeradas; card "Riscos", gráficos de nível/status |
| `risk:approve` (+ `risk:view`) | Card "Aprovações pendentes" |
| `action:view` | Card "Planos de Ação", atalho "Minhas ações" |
| `incident:view` | Card "Incidentes", atalho de contagem |
| `incident:create` | Atalho "Registrar incidente" |
| `problem:view` | Card "Problemas" |
| `problem:create` | Atalho "Registrar problema" |
| `control:view` | Card "Controles" |
| `compliance:view` | Card "Compliance" |
| `indicator:view` | Card "Indicadores", atalho "Indicadores" |
| `report:view` | Atalho "Relatórios" |
| `risk:create` | Atalho "Registrar risco" (aponta para `/risks/new`) |

Fonte: `apps/api/src/modules/dashboard/application/get-dashboard-summary.usecase.ts:269-291` (server)
e `apps/web/src/app/(app)/dashboard/page.tsx` / `dashboard-quick-actions.tsx:35-72` (exibição
condicionada — lógica advisória, o servidor já filtrou).

## API

| Rota | Módulo dono | Operação | Observação |
|---|---|---|---|
| `GET /dashboard` | `modules/risk` (`presentation/dashboard.controller.ts`) | `getDashboard` | Áreas de risco + `plannedAreas`; zera por falta de permissão, não omite |
| `GET /dashboard/summary` | `modules/dashboard` (`presentation/dashboard-summary.controller.ts`) | `getDashboardSummary` | Catálogo de indicadores + `breakdowns`; omite por falta de permissão |

Contrato OpenAPI: **`specs/001-grc-platform-foundation/contracts/platform.openapi.yaml`** (schemas
`Dashboard`, `DashboardSummary`, `DashboardSummaryBreakdowns`, linhas ~421-493 e ~1030-1230).
`specs/011-dashboard-platform-view/` não tem pasta `contracts/` própria — só `STATE.md`; é um
registro operacional de correção pontual, não uma especificação com artefatos completos
(spec/plan/tasks/contracts).

## Relações com outros módulos

Somente leitura, em ambos os endpoints — nenhuma escrita, nenhum vínculo criado pelo dashboard:

| Domínio de origem | Consumido por | Mecanismo |
|---|---|---|
| Risco | `GET /dashboard` | `DashboardQueryPort` (`modules/risk`) |
| Ação (`grc/action`) | `GET /dashboard/summary` | `ActionRepositoryPort` — dependência direta permitida por ser capacidade de núcleo GRC (ADR-016) |
| Incidente | `GET /dashboard/summary` | `IncidentMetricsPort` (`shared/grc-ports`) |
| Problema | `GET /dashboard/summary` | `ProblemMetricsPort` |
| Controle | `GET /dashboard/summary` | `ControlMetricsPort` |
| Compliance | `GET /dashboard/summary` | `ComplianceSummaryPort` |
| Auditoria/Achado | `GET /dashboard/summary` (via catálogo de indicadores) | `IndicatorCalculationPort` |
| Indicadores | `GET /dashboard/summary` | `IndicatorCalculationPort` + `IndicatorMonitoringPort` |
| Ativo, Processo | **Nenhum** | Retirados da tela (métrica única "inativos" insuficiente, `STATE.md` §7.1/§7.6) |

Todo acesso cross-domínio passa por porta de fronteira (`shared/grc-ports/**`) ou por dependência
explícita de capacidade de núcleo GRC (`grc/action`) — nunca acesso direto ao Prisma de outro
módulo, nunca `@Global()` implícito.

## Eventos de auditoria

**Nenhum.** Confirmado por busca (`AuditService`/`recordAuditEvent`/`auditLog`/`AuditAction`) em
`apps/api/src/modules/dashboard/**`, `apps/api/src/core/dashboard/**` e no caso de uso/controller de
`GET /dashboard`: zero ocorrências. Documentado explicitamente no cabeçalho de
`get-dashboard.usecase.ts:5-6` ("No transaction and no audit entry — reads are not audited
(ADR-005)") e em `dashboard-summary.module.ts:36-38` ("No `AuditModule` import: this module
performs no writes and reads are not audited"). Consistente com o padrão do resto da plataforma
para leituras puras.

## Testes importantes

| Camada | Arquivo | Cobertura |
|---|---|---|
| Unidade (API) | `apps/api/test/unit/get-dashboard-summary.usecase.spec.ts` | 12 casos — filtragem por permissão, omissão vs. zerado, breakdowns |
| Unidade (API) | `apps/api/test/unit/get-dashboard-planned-areas.spec.ts` | Registro de áreas planejadas |
| Unidade (API) | `apps/api/test/unit/prisma-action-repository-dashboard-breakdowns.spec.ts` | Contagem de ações por status/vencimento |
| Integração | `apps/api/test/integration/dashboard-summary-breakdowns.spec.ts` | 3 casos, dados reais |
| Integração | `apps/api/test/integration/dashboard-summary-organizational-scope.spec.ts` | 1 caso — escopo organizacional |
| Contrato | `apps/api/test/contract/dashboard.spec.ts` (8 casos), `dashboard-summary.spec.ts` (9 casos) | Forma de resposta contra o OpenAPI |
| Contrato | `apps/api/test/contract/contract-coverage.spec.ts` | Garante que as duas operações de dashboard estão cobertas |
| Unidade (web) | `apps/web/src/features/dashboard/**/*.test.tsx`, `summary.test.ts` | Componentes e helpers de leitura |
| Unidade (web) | `apps/web/src/app/(app)/dashboard/page.test.tsx`, `dashboard-area-card.test.tsx` | Composição condicional da página |
| E2E | `apps/web/e2e/dashboard.spec.ts` | 2 testes — visão ampla (admin) vs. Risk Analyst, ausência de card por falta de permissão, ausência de links para registro individual |
| E2E/A11y | `apps/web/e2e/accessibility.spec.ts:640-660` | Varredura axe do dashboard, claro e escuro |

**Histórico do F-28 e guarda atual**: a varredura original (T198) esperava só a tabela acessível do
gráfico, que monta **antes** do `<svg>` do Recharts terminar de se medir — certificando "zero
violações" de uma tela cujos gráficos ainda não existiam. A correção teve duas partes, ambas
confirmadas no código atual:

1. **Instrumento de medição**: `accessibility.spec.ts:640-660` agora espera explicitamente por
   `page.locator('svg.recharts-surface').first()` estar visível antes de rodar o axe — comentário no
   próprio arquivo (linhas 622-639) nomeia o F-28 e explica por que a tabela sozinha não bastava.
2. **Causa raiz no componente**: `risk-level-chart.tsx` usa `accessibilityLayer={false}` no
   `BarChart` (Recharts liga isso por padrão e produz um `<svg role="application" tabIndex={0}>`
   mesmo dentro de um `<div aria-hidden="true">` pai — violação `aria-hidden-focus`); e
   `action-status-donut.tsx` usa `rootTabIndex={-1}` em cada `Pie` (mesma classe de violação, achada
   numa segunda rodada de captura renderizada, `STATE.md` §7.4). Em ambos os casos a alternativa
   acessível real é `ChartDataTable`, não o SVG decorativo.

Status: **fechado**, classificado "resolvido" em `specs/007-implementation-remediation/matrix.md:81`
com referência cruzada ao F-39 (que cita o fix do F-28 como fato consumado). Nenhum teste foi
enfraquecido para chegar lá — a asserção ficou mais estrita (espera o SVG real), não mais frouxa.

## Onde vive o código

- **API — `core/dashboard/`**: `apps/api/src/core/dashboard/dashboard.module.ts`,
  `domain/planned-area-registry.ts`, `domain/default-planned-areas.ts` (registro de áreas
  planejadas, hoje vazio).
- **API — `modules/dashboard/`**: `apps/api/src/modules/dashboard/dashboard-summary.module.ts`,
  `application/get-dashboard-summary.usecase.ts`, `presentation/dashboard-summary.controller.ts`,
  `presentation/dto/dashboard-summary-response.mapper.ts` (`GET /dashboard/summary`).
- **API — `modules/risk/`** (dono de `GET /dashboard`): `application/get-dashboard.usecase.ts`,
  `domain/ports/dashboard-query.port.ts`, `infrastructure/dashboard-query.service.ts`,
  `infrastructure/risk-dashboard-metrics.adapter.ts`, `presentation/dashboard.controller.ts`,
  `presentation/dto/dashboard-response.mapper.ts`, `risk-dashboard-metrics.module.ts`.
- **Web**: `apps/web/src/app/(app)/dashboard/page.tsx` (rota real), `dashboard-area-card.tsx`;
  `apps/web/src/features/dashboard/` (api.ts, types.ts, summary.ts, `components/*`).
- **Mensagens pt-BR**: `apps/web/src/lib/messages/dashboard.ts` (200 linhas); rótulos das áreas
  planejadas vêm de `apps/api/src/shared/messages/user-messages.ts`.
- **Contrato**: `specs/001-grc-platform-foundation/contracts/platform.openapi.yaml`.
- **Registro operacional**: `specs/011-dashboard-platform-view/STATE.md` (única fonte de spec desta
  frente — não há `spec.md`/`plan.md`/`tasks.md` para esta correção pontual).
- **Modelos Prisma**: nenhum (confirmado — dashboard é puramente agregação de leitura).

## Arte decorativa do hero (2026-09-19)

A composição visual do hero usa SVG inline em `dashboard-hero-illustration.tsx` e uma
paleta isolada em `dashboard-hero-illustration.module.css`: farol arquitetônico próprio,
feixe translúcido, três planos de colinas curvas e promontório rochoso. A marca oficial
não é utilizada como ilustração. Não há raster, dependência nova ou requisição de asset.

A paisagem ocupa a largura do hero com máscaras suaves; a torre mantém proporções fixas
no centro-direita. Abaixo de 1280px ficam apenas atmosfera e colinas de baixo contraste;
abaixo de 640px a atmosfera é removida e as colinas são ainda mais discretas. O tema
escuro possui paleta própria e feixe atenuado. A arte é `aria-hidden`, sem foco ou eventos
de ponteiro, contida pelo recorte do hero. Textos, dados e demais áreas não mudam.
