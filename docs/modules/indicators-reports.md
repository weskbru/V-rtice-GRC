# Indicadores e Relatórios

## Status

**IMPLEMENTADO** (núcleo de cálculo, catálogo de indicadores, limiar/notificação de rompimento,
série histórica, relatório multi-domínio com exportação CSV) com **PARCIAL** em três superfícies de
UI que o backend já expõe integralmente. Fase 7 do roteiro (`docs/architecture/grc-roadmap.md`),
declarada concluída no commit `d31e140` (`specs/009-indicators-reports/STATE.md` §14.5).

| Item | Estado | Evidência |
|---|---|---|
| Catálogo fechado de 11 métricas + calculador único | IMPLEMENTADO | `indicator-metric-catalog.ts`, `indicator-calculation.service.ts` |
| Valor atual por métrica (`GET /indicators/{metricKey}/current`) | IMPLEMENTADO | `indicator.controller.ts` |
| Série histórica + registro manual de medição | IMPLEMENTADO (tela existe) | `indicator-history-section.tsx` chama `createMeasurement`/`listMeasurements` |
| Limiar + notificação de rompimento | IMPLEMENTADO | `create-indicator-measurement.usecase.ts` |
| Configuração de `IndicatorDefinition` (criar/editar limiar, responsável) | **PARCIAL** — API completa, **sem tela** | ver `docs/modules` §"Telas" e achado 1 abaixo |
| Relatório multi-domínio + exportação CSV | IMPLEMENTADO (execução e criação); **edição sem tela** | `report-form.tsx` só cria; `ReportController.update` existe sem chamador web |
| `Action` com origem `INDICATOR` | **PARCIAL** — backend/BD completos, **inatingível pela web** | achado 3 abaixo (contrato `grc-foundation.openapi.yaml` desatualizado) |
| Guarda estrutural SC-005 (sem coluna paralela de tarefa/arquivo/aprovação) | IMPLEMENTADO | `apps/api/test/unit/indicators-reports-no-parallel-columns-guard.spec.ts` |
| E2E dedicado (`indicators.spec.ts`/`reports.spec.ts`) | **NÃO EXISTE** — coberto dentro de `accessibility.spec.ts` (varredura a11y, dois temas) e `dashboard.spec.ts` (um fluxo real) | ver §"Testes importantes" |

**Itens em aberto herdados do fechamento da fase** (verificados nesta revisão contra
`docs/deferred-findings.md`, ainda ABERTOS em 2026-09-14):

- **F-57** — `pnpm audit` acusa 2 vulnerabilidades moderadas em `vitest`/`@vitest/mocker` (Path
  Traversal via `@vitest/mocker` Redirect Mock), abaixo do limiar `--audit-level=high` do portão.
  Dependência de teste, sem caminho de execução em produção. Não corrigido enquanto a CI remota
  segue bloqueada por billing (F-58). `docs/deferred-findings.md` linha 2229.
- **F-59** — `ThrottlerGuard` global (`THROTTLE_LIMIT=100`/`60s`, por IP) derruba jornadas E2E longas
  sob concorrência, inclusive tentativas de login. Mitigação verificada (um único worker Playwright
  → 129/129 aprovados); nenhuma das três opções de configuração permanente foi decidida.
  `docs/deferred-findings.md` linha 2298.
- **Exposição de contraste no formulário de Ativos** — idêntica à corrigida em Processos
  (`disabled:opacity-50` no botão de envio até o fetch de unidades organizacionais resolver, abaixo
  de 4,5:1 no tema escuro). Reproduzida 5/5 em `ProcessForm` e corrigida lá; `AssetForm` carrega a
  mesma exposição mas não foi alcançado no estado transitório certo pela varredura desta fase —
  **deliberadamente não corrigido às cegas**. `specs/009-indicators-reports/STATE.md` §14.6.

**Achados novos desta revisão** (não corrigidos, apenas registrados — ver corpo do documento e
relatório final para evidência completa):

1. `IndicatorDefinition` não tem tela de criação/edição — `indicatorsApi.createDefinition` existe no
   cliente mas não tem nenhum chamador; `getDefinition`/`updateDefinition`/`listMetricKeys` (rotas
   do backend desde T068) nem têm wrapper no cliente web.
2. `ReportDefinition` não tem tela de edição — `PATCH /reports/{reportId}` existe e funciona, mas
   `report-form.tsx` (única tela) só cria, e o próprio comentário de cabeçalho do componente está
   desatualizado (afirma que `updateReportDefinition` "deliberadamente não foi implementado").
3. `ActionOriginType` em `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`
   nunca foi estendido com `INDICATOR` — o mesmo defeito que o cabeçalho de
   `create-action-request.dto.ts` documenta ter corrigido duas vezes antes (`CONTROL_ASSESSMENT`,
   depois `INCIDENT`/`PROBLEM`) se repete pela terceira vez. O tipo gerado para a web
   (`@pharos/api-types`) e o mapa de rótulos (`apps/web/src/lib/messages/actions.ts`) não incluem
   `INDICATOR`, então a web não consegue exibir, rotular ou criar uma `Action` dessa origem, embora
   o banco, o DTO (`@IsIn(Object.values(Prisma.ActionOriginType))`) e o acessor
   (`IndicatorActionOriginAccessor`) já a aceitem.

## Objetivo

Fornecer um catálogo fechado de métricas GRC computadas sob demanda (nunca armazenadas como campo
editável), com histórico append-only, limiar configurável com notificação de rompimento, e
relatórios que compõem várias métricas de domínios diferentes em uma única execução, exportável em
CSV. É o exemplo canônico do CLAUDE.md §19.7 (estado derivado, calculador único).

## Entidades principais

| Modelo Prisma | Campos-chave | Observações |
|---|---|---|
| `IndicatorDefinition` (`indicator_definitions`) | `id`, `code` (`IND-AAAA-NNNN`), `metricKey` (`@unique`), `name`, `description`, `ownerUserId`, `thresholdComparator?`, `thresholdValue?` (Decimal), `isActive`, `createdByUserId` | Configuração opcional de uma chave do catálogo. Sem `orgUnitId` (organização inteira). Sem exclusão — só `isActive=false`. Invariante T1: `thresholdComparator`/`thresholdValue` juntos ou nenhum, validado em domínio, não em `CHECK`. `schema.prisma:3336`. |
| `IndicatorMeasurement` (`indicator_measurements`) | `id`, `metricKey`, `value?` (Decimal), `valueByBucket?` (Json), `breached`, `computedAt`, `computedByUserId` | Append-only — sem `updatedAt`, sem UPDATE/DELETE. Sem FK para `IndicatorDefinition` (grava mesmo sem definição configurada). Invariante M1: exatamente um de `value`/`valueByBucket`. Índice `[metricKey, computedAt]`. `schema.prisma:3388`. |
| `ReportDefinition` (`report_definitions`) | `id`, `code` (`RPT-AAAA-NNNN`), `name`, `description`, `metricKeys` (array de `IndicatorMetricKey`), `isActive`, `createdByUserId` | Sem `orgUnitId`, sem tabela de histórico (relatório é reexecutado, nunca "congelado"). `metricKeys` é array do enum fechado, não junção — decisão registrada em `data-model.md` §1/§6. `schema.prisma:3430`. |

**Enums fechados**: `IndicatorMetricKey` (11 valores, `schema.prisma:3287`),
`IndicatorThresholdComparator` (`GTE`/`GT`/`LTE`/`LT`, sem `EQ`/`NEQ` — `schema.prisma:3306`).

`ActionOriginType` ganhou o valor `INDICATOR` (`schema.prisma:2302`), em migração própria separada
da fundação (`20260912000000_action_origin_type_add_indicator`), com `originId` apontando para
`IndicatorDefinition.id`.

## Estados / ciclo de vida

Não há máquina de estados clássica — nem `IndicatorDefinition` nem `ReportDefinition` têm transição
de status além de `isActive`. O fluxo relevante é o **cálculo sob demanda com avaliação de limiar**,
sempre pelo mesmo caminho:

```
Caller (GET .../current | POST .../measurements | GET /reports/{id}/run)
  -> resolve escopo (ScopeFilter) uma vez
  -> IndicatorCalculationService.calculate({ metricKey, scope, definition })
       -> despacha para 1 dos 11 *IndicatorMetricProvider (por metricKey, nunca por branch interno)
       -> evaluateThresholdBreach(comparator, value, thresholdValue)   [mesma chamada, nunca 2ª passada]
  -> resultado { value | valueByBucket, breached }
       -> GET current: devolve, nunca persiste
       -> POST measurement: persiste em IndicatorMeasurement (INSERT-only)
            -> se breached=true: NotificationService.notify(owner) dentro da MESMA transação
       -> GET report/run: repete o cálculo para cada metricKey do relatório, item a item
            (uma permissão de origem ausente => available:false no item, nunca 403 do relatório inteiro)
```

Evidência: `apps/api/src/modules/indicators/application/indicator-calculation.service.ts:149-180`,
`apps/api/src/modules/indicators/application/create-indicator-measurement.usecase.ts:75-158`.

## Regras de negócio relevantes

- **Calculador único** (CLAUDE.md §19.7): `IndicatorCalculationService` é o único ponto que mapeia
  `metricKey -> provider` e o único que chama `evaluateThresholdBreach`. Nenhum `*Provider` é
  exportado de `IndicatorsModule` — a DI do Nest torna a chamada direta a um provider
  estruturalmente inalcançável fora do serviço (`indicator-calculation.service.ts:10-24`).
- **Limiar nunca recalculado**: `IndicatorMeasurement.breached` é gravado exatamente como calculado
  no instante da medição e nunca recomputado depois, mesmo se a `IndicatorDefinition` mudar de
  limiar (`schema.prisma:3400-3404`, `research.md` D-7).
- **Notificação de rompimento**: dispara exatamente uma vez por medição com `breached=true`,
  endereçada ao `ownerUserId` da definição, dentro da mesma transação da medição+auditoria
  (`create-indicator-measurement.usecase.ts:165-183`). Primeiro produtor real de
  `NotificationService` no código (CLAUDE.md §19.10).
- **Medição manual exige escopo `GLOBAL`**: `POST /indicators/{metricKey}/measurements` rejeita com
  `403` antes de qualquer leitura de tabela-fonte se o escopo resolvido do chamador não for
  `{ kind: 'GLOBAL' }` (`create-indicator-measurement.usecase.ts:64-68`, `research.md` D-6).
- **`COMPLIANCE_PERCENTAGE` é a única métrica organização-inteira**: todas as outras 10 têm
  `scopeApplicability: 'ORGANIZATIONAL_UNIT'` (`indicator-metric-catalog.ts:73-77`,
  `research.md` D-8 — `Requirement`/`FrameworkVersion` não têm coluna de unidade).
- **CSV**: serialização manual (sem dependência nova — `research.md` D-10), RFC 4180, cabeçalho fixo
  `metricKey,label,available,value,scopeApplicability`; item `BY_BUCKET` vira
  `bucket=count;bucket=count`; item indisponível ou sem dado nunca é distinguível de zero medido —
  sempre coluna vazia (`export-report-csv.usecase.ts`).
- **Relatório nunca falha por permissão parcial**: um `metricKey` cuja permissão de origem o
  chamador não possui aparece com `available: false` no item, não derruba a execução inteira
  (`report-permissions.ts`, `apps/api/test/integration/report-run-partial-permission.spec.ts`).
- **Sem exclusão** em nenhuma das três tabelas — `IndicatorDefinition`/`ReportDefinition` usam
  `isActive`; `IndicatorMeasurement` é INSERT-only, sem qualquer caminho de UPDATE/DELETE.

## Telas

Rotas reais (`apps/web/src/app/(app)/`):

| Rota | Arquivo | Descrição |
|---|---|---|
| `/indicators` | `indicators/page.tsx` → `IndicatorCatalogView` | Catálogo das 11 métricas com `MetricCard`, valor atual e paginação de definições configuradas. |
| `/indicators/[metricKey]` | `indicators/[metricKey]/indicator-detail-view.tsx` | Valor atual + metadados da definição (se existir) + aba "Histórico" com série (`IndicatorHistorySection`), incluindo botão de registrar nova medição manual. |
| `/reports` | `reports/page.tsx` → `ReportCatalogView` | Registro de relatórios salvos. |
| `/reports/new` | `reports/new/page.tsx` → `ReportForm` | Criação (nome, descrição, checklist dos 11 metricKeys). **Sem equivalente de edição.** |

**Não existe**: tela de criação/edição de `IndicatorDefinition` (limiar, responsável) nem tela de
edição de `ReportDefinition`, apesar de ambas as operações existirem na API (ver achados 1/2 no
topo do documento). Execução de relatório (`GET /reports/{id}/run`, JSON ou CSV) é acionada por
`ReportRunDialog` a partir do registro.

## Permissões

| Chave | Ação | Uso |
|---|---|---|
| `indicator:view` | VIEW | Listar/ler definição, valor atual, histórico, catálogo de chaves. Sempre combinada com a permissão de leitura do domínio-fonte (`sourcePermission` do catálogo), checada dinamicamente dentro do use case, não por decorator estático. |
| `indicator:create` | CREATE | `POST /indicators` (criar definição). |
| `indicator:edit` | EDIT | `PATCH /indicators/{id}` e `POST /indicators/{metricKey}/measurements`. |
| `report:view` | VIEW | Listar/ler definição de relatório, executar (`run`). |
| `report:create` | CREATE | `POST /reports`. |
| `report:edit` | EDIT | `PATCH /reports/{id}`. |

Evidência: `apps/api/src/modules/indicators/domain/indicator-permissions.ts`,
`apps/api/src/modules/reports/domain/report-permissions.ts`. Navegação principal gateada por
`indicator:view`/`report:view` (`apps/web/src/components/shell/navigation-registry.ts:188-206`).

## API

Contratos: `specs/009-indicators-reports/contracts/indicators.openapi.yaml` (8 operações),
`.../reports.openapi.yaml` (5 operações) — ambos registrados em
`apps/api/test/contract/contract-coverage.spec.ts` (linhas 295-296).

**`/indicators`** (`indicator.controller.ts`):

| Método | Rota | Use case |
|---|---|---|
| GET | `/indicators` | `ListIndicatorDefinitionsUseCase` |
| POST | `/indicators` | `CreateIndicatorDefinitionUseCase` |
| GET | `/indicators/metric-keys` | `ListIndicatorMetricKeysUseCase` |
| GET | `/indicators/{definitionId}` | `GetIndicatorDefinitionUseCase` |
| PATCH | `/indicators/{definitionId}` | `UpdateIndicatorDefinitionUseCase` (não altera `metricKey`) |
| GET | `/indicators/{metricKey}/current` | `GetIndicatorCurrentValueUseCase` |
| POST | `/indicators/{metricKey}/measurements` | `CreateIndicatorMeasurementUseCase` |
| GET | `/indicators/{metricKey}/measurements` | `ListIndicatorMeasurementsUseCase` |

**`/reports`** (`report.controller.ts`):

| Método | Rota | Use case |
|---|---|---|
| GET | `/reports` | `ListReportDefinitionsUseCase` |
| POST | `/reports` | `CreateReportDefinitionUseCase` |
| GET | `/reports/{reportId}` | `GetReportDefinitionUseCase` |
| PATCH | `/reports/{reportId}` | `UpdateReportDefinitionUseCase` |
| GET | `/reports/{reportId}/run` | `RunReportUseCase` + `ExportReportCsvUseCase` (JSON padrão; `?format=csv` ou `Accept: text/csv`) |

## Catálogo de métricas

`INDICATOR_METRIC_CATALOG` (`apps/api/src/modules/indicators/domain/indicator-metric-catalog.ts`)
— 11 chaves, 11 classes de provider (`indicator-calculation.service.ts:59-71`), uma por chave:

| `IndicatorMetricKey` | Provider (classe) | Domínio-fonte | `sourcePermission` | Formato | Escopo |
|---|---|---|---|---|---|
| `RISK_TOTAL_BY_LEVEL` | `RiskTotalByLevelProvider` | Risco | `risk:view` | BY_BUCKET | Unidade org. |
| `RISK_TREATMENT_OVERDUE_COUNT` | `RiskTreatmentOverdueCountProvider` | Risco | `risk:view` | SINGLE_VALUE | Unidade org. |
| `CONTROL_INACTIVE_COUNT` | `ControlInactiveCountProvider` | Controle | `control:view` | SINGLE_VALUE | Unidade org. |
| `COMPLIANCE_PERCENTAGE` | `CompliancePercentageProvider` | Conformidade | `compliance:view` | SINGLE_VALUE | **Organização inteira** |
| `AUDIT_ENGAGEMENT_OPEN_COUNT` | `AuditEngagementOpenCountProvider` | Auditoria | `audit-engagement:view` | SINGLE_VALUE | Unidade org. |
| `FINDING_OPEN_COUNT_BY_SEVERITY` | `FindingOpenCountBySeverityProvider` | Achado | `finding:view` | BY_BUCKET | Unidade org. |
| `ASSET_INACTIVE_COUNT` | `AssetInactiveCountProvider` | Ativo | `asset:view` | SINGLE_VALUE | Unidade org. |
| `PROCESS_INACTIVE_COUNT` | `ProcessInactiveCountProvider` | Processo | `process:view` | SINGLE_VALUE | Unidade org. |
| `ACTION_OVERDUE_COUNT` | `ActionOverdueCountProvider` | Ação | `action:view` | SINGLE_VALUE | Unidade org. |
| `INCIDENT_OPEN_COUNT_BY_SEVERITY` | `IncidentOpenCountBySeverityProvider` | Incidente | `incident:view` | BY_BUCKET | Unidade org. |
| `PROBLEM_OPEN_COUNT_BY_SEVERITY` | `ProblemOpenCountBySeverityProvider` | Problema | `problem:view` | BY_BUCKET | Unidade org. |

**Confirma a alegação do CLAUDE.md §17 item 14 ("onze provedores de métrica atrás de um único
calculador")**: contagem real de classes de provider = 11 (o arquivo `risk-indicator-metric-provider.ts`
sozinho exporta duas classes), uma por `IndicatorMetricKey`, exatamente como descrito.

## Relações com outros módulos

Somente **leitura** — nenhum provider grava em domínio alheio. Cada provider lê diretamente a
tabela-fonte do seu domínio (Risco, Controle, Conformidade, Auditoria/Achado, Ativo, Processo, Ação,
Incidente, Problema), nunca por junção genérica.

- **`Action` com origem `INDICATOR`**: `IndicatorActionOriginAccessor`
  (`apps/api/src/modules/indicators/application/collaboration/indicator-action-origin-accessor.ts`)
  registra `resolveEditableOrigin`/`resolveViewableOrigin`/`resolveOriginScope`/
  `listOriginIdsInScope` para `ActionOriginType.INDICATOR` junto a `ActionOriginResolverPort`.
  `originId` é o id da `IndicatorDefinition`; como ela não tem `orgUnitId`, `resolveOriginScope`
  checa só existência (organização inteira), e o `Action.orgUnitId` obrigatório é herdado da
  unidade atual do responsável pela definição. **Backend e banco completos** — ver achado 3 (topo
  do documento) sobre a lacuna de contrato que torna essa origem inatingível pela web.
- **Comentário** (`CommentableEntityType`): `IndicatorParentRecordAccessor` registra `INDICATOR`
  para comentários em `IndicatorDefinition` (`indicator-parent-record-accessor.ts`).
  Deliberadamente **sem** `INDICATOR` em `AttachableEntityType` (anexo) — decisão registrada no
  próprio cabeçalho do arquivo (FR-033: "somente `INDICATOR`" em `CommentableEntityType`, nunca em
  attachments).
- **Dashboard**: `IndicatorMonitoringAdapter` (implementa `IndicatorMonitoringPort`) lê, em duas
  consultas, toda `IndicatorDefinition` ativa e a medição mais recente por `metricKey`, para
  alimentar o cartão "Indicadores em alerta" do dashboard GRC
  (`apps/web/src/app/(app)/dashboard/page.tsx:289-298,497-513`).

## Eventos de auditoria

`AuditEntityType.INDICATOR` / `INDICATOR_MEASUREMENT` / `REPORT` (registrados em
`indicator-audit-allowlist.ts` / `report-audit-allowlist.ts`):

| Ação | Onde |
|---|---|
| `indicator.created` | `create-indicator-definition.usecase.ts:124` |
| `indicator.updated` | `update-indicator-definition.usecase.ts:164` |
| `indicator_measurement.created` | `create-indicator-measurement.usecase.ts:177` |
| `report.created` | `create-report-definition.usecase.ts:98` |
| `report.updated` | `update-report-definition.usecase.ts:117` |

## Testes importantes

| Camada | Arquivos |
|---|---|
| Unidade (domínio/calculador) | `apps/api/test/unit/indicator-metric-catalog.spec.ts`, `indicator-calculation-service.spec.ts`, `indicator-threshold.spec.ts`, `create-indicator-definition.usecase.spec.ts`, `create-indicator-measurement-notification.spec.ts`, `create-report-definition.usecase.spec.ts`, `run-report.usecase.spec.ts`, `export-report-csv.usecase.spec.ts`, `indicator-monitoring-adapter.spec.ts` |
| Guarda estrutural SC-005 | `apps/api/test/unit/indicators-reports-no-parallel-columns-guard.spec.ts` — lê o DMMF gerado do Prisma, censo exato de campos das 3 tabelas da fase, prova (por mutação manual documentada no próprio arquivo) que não vira teste vazio silenciosamente. |
| Integração | `apps/api/test/integration/indicator-action-origin.spec.ts`, `indicator-current-value-organizational-scope.spec.ts`, `indicator-measurement-notifications.spec.ts`, `indicator-measurements.spec.ts`, `report-run-organizational-scope.spec.ts`, `report-run-partial-permission.spec.ts` |
| Contrato | `apps/api/test/contract/contract-coverage.spec.ts` (8+5 operações cobertas) |
| E2E | **Sem spec dedicado.** Coberto dentro de `apps/web/e2e/accessibility.spec.ts` (varredura a11y de `/indicators`, `/indicators/[metricKey]`, `/reports`, `/reports/new`, tema claro e escuro) e `apps/web/e2e/dashboard.spec.ts` (um fluxo real: registra medição, navega a `/indicators/RISK_TOTAL_BY_LEVEL`, cria e executa um relatório em `/reports/new` → `/reports`). |

## Onde vive o código

- **API**: `apps/api/src/modules/indicators/` (domain/application/infrastructure/presentation),
  `apps/api/src/modules/reports/` (idem). Módulos: `indicators.module.ts`,
  `indicator-monitoring.module.ts` (wiring isolado para o dashboard), `reports.module.ts`.
- **Web**: `apps/web/src/features/indicators/`, `apps/web/src/features/reports/`,
  rotas em `apps/web/src/app/(app)/indicators/` e `.../reports/`.
- **Prisma**: `apps/api/prisma/schema.prisma` — `enum IndicatorMetricKey` (linha 3287),
  `enum IndicatorThresholdComparator` (3306), `model IndicatorDefinition` (3336),
  `model IndicatorMeasurement` (3388), `model ReportDefinition` (3430); `ActionOriginType.INDICATOR`
  (2302).
- **Mensagens pt-BR**: `apps/web/src/lib/messages/indicators.ts`, `.../reports.ts`,
  `apps/api/src/shared/messages/indicators.ts`.
- **Especificação**: `specs/009-indicators-reports/` (spec.md, plan.md, tasks.md, research.md,
  data-model.md, contracts/, STATE.md).
