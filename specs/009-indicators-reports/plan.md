# Implementation Plan: Gestão de Indicadores e Gestão de Relatórios

**Branch**: `009-indicators-reports` · **Spec**: [spec.md](./spec.md)

**Sem implementação nesta entrega.** Este plano descreve como a fase deveria ser implementada
quando aprovada — nenhum arquivo fora de `specs/009-indicators-reports/` foi criado ou alterado
para produzi-lo.

---

## Summary

Dois módulos de negócio novos, somente leitura em relação aos nove domínios já implementados
(Risco, Controle, Conformidade, Auditoria, Achado, Ativo, Processo, Ação, Incidente, Problema), com
duas escritas próprias pequenas: a definição de um indicador/relatório (metadado compartilhado,
sem coluna de unidade organizacional — research.md D-8) e o registro explícito, organização
inteira, de um ponto de histórico (research.md D-6). Generaliza o mecanismo de agregação que o
Dashboard já prova para Risco (`DashboardQueryService`) para os outros oito domínios, através de um
catálogo fechado de métricas (`IndicatorMetricKey`, research.md D-4) — nunca uma consulta genérica.
Encerra o mecanismo de "área planejada" do Dashboard, que hoje está desatualizado para
`PROBLEMS`/`INCIDENTS` (Achado 1, `spec.md`).

## Technical Context

**Stack**: NestJS/TypeScript (API), Next.js/TypeScript/Tailwind/shadcn (web), Prisma/PostgreSQL,
Redis (não usado por esta fase — nenhum requisito pede cache), Vitest/Playwright — sem nenhuma
dependência nova (research.md D-10: nenhuma biblioteca de exportação; A-2/A-3: nenhum agendador).

**Módulos consumidos, não recriados**: `grc/action` (US4, `ActionOriginType += INDICATOR`),
`core/notifications` (US3, primeiro produtor real de `NotificationService`), `grc/shared/domain/
entity-code.service.ts` (códigos `IND-`/`RPT-`), `grc/shared/domain/overdue.service.ts`
(`ACTION_OVERDUE_COUNT`), `core/organizations` (`ScopeResolverService`, toda leitura escopada),
`core/authorization` (seis permissões novas), `core/dashboard` (retirada de área planejada
obsoleta), e uma porta/serviço de leitura por domínio-fonte já existente (`DashboardQueryPort` para
Risco; consultas próprias equivalentes de Controle/Conformidade/Auditoria/Achado/Ativo/Processo/
Incidente/Problema — nenhuma nova capacidade de consulta é inventada, cada `IndicatorMetricProvider`
delega ao que já existe).

**Testing**: contrato (um teste por operação, antes da implementação — mesma disciplina de toda
fase anterior), integração (nove testes de paridade escopo — SC-001, um por domínio-fonte; mais o
teste de `breached`/notificação, SC-003), unitário (catálogo de métricas fechado, `IndicatorMetricKey`
exaustivo — o mesmo padrão que `FindingStatus`/`ControlStatus` já tiveram desde a Fase 1/2), E2E
(um caminho de Indicador, um de Relatório, um de escopo organizacional negado — mesma cobertura
mínima que `005`/`006`/`008` já estabeleceram), acessibilidade (axe, dois temas, conteúdo real).

## Constitution Check

- **§19.2** — relações declaradas explicitamente para as duas contrapartes com toda contraparte
  GRC nomeada em CLAUDE.md, incluindo "não se relaciona" onde é a resposta (`spec.md`, seção
  "Relações declaradas").
- **§19.3** — nenhum terceiro mecanismo de relacionamento. `Indicator`/`Report` leem através de
  consultas próprias de cada domínio-fonte (nunca uma tabela `related_entity`), e o único
  relacionamento de posse novo (`ActionOriginType += INDICATOR`) usa o registro de tipo fechado já
  estabelecido.
- **§19.4** — critério de admissão do núcleo aplicado por escrito: `Indicator`/`Report` **não**
  entram no núcleo GRC compartilhado (`grc/**`) — falham o segundo teste (nenhum outro domínio os
  consome; eles é que consomem todos os outros), então vivem em `modules/**`, exatamente como
  `docs/history/grc-domain-blueprint.md:125` já classifica ("Indicadores e Relatórios" na
  tabela de domínios de negócio, não na de núcleo compartilhado).
- **§19.7** — todo valor de indicador é calculado por `IndicatorCalculationService`
  (`IndicatorMetricProvider` por chave), nunca armazenado como campo editável em paralelo
  (research.md D-2). `breached` é recalculado a cada `IndicatorMeasurement`, nunca lido de um campo
  cacheado.
- **§19.9** — não aplicável: nenhuma IA nesta fase.
- **§19.10** — `NotificationService` (US3) é o primeiro produtor real desta capacidade — exercitado
  por teste de integração real (SC-003), nunca só "existe e compila".
- **§11.1/§18.7** — todo texto novo em `apps/api/src/shared/messages/indicators.ts`/`reports.ts` e
  `apps/web/src/lib/messages/indicators.ts`/`reports.ts` (FR-040).

---

## Project Structure

### Documentation (this feature)

```text
specs/009-indicators-reports/
├── spec.md              # o quê, por quê, e as sete perguntas de escopo decididas
├── plan.md              # este arquivo
├── research.md          # D-1 a D-13, decisões com alternativas rejeitadas
├── data-model.md        # entidades, enums fechados, invariantes, resumo de escopo por operação (§8)
├── contracts/
│   ├── indicators.openapi.yaml
│   └── reports.openapi.yaml
└── tasks.md             # tarefas, incluindo os critérios de aceitação visual explícitos (§18.12)
```

Sem `quickstart.md` nesta entrega — o mesmo raciocínio que `008-incidents-problems/plan.md` já
registrou: quickstart é o roteiro **executável**, e não há o que executar até
`/speckit-implement` começar.

### Source Code (repository root)

```text
apps/api/src/
├── modules/
│   ├── indicators/                       # NOVO
│   │   ├── domain/                       # IndicatorDefinition, IndicatorMeasurement, IndicatorMetricKey,
│   │   │                                 # IndicatorThresholdComparator, IndicatorMetricCatalog (D-4)
│   │   ├── application/
│   │   │   ├── indicator-calculation.service.ts   # ÚNICO calculador (§19.7) — chama um
│   │   │   │                                       # IndicatorMetricProvider por chave
│   │   │   ├── metric-providers/          # um arquivo por domínio-fonte, cada um delegando à porta/
│   │   │   │                              # serviço já existente daquele módulo — nunca reimplementa
│   │   │   ├── create-indicator-definition.usecase.ts
│   │   │   ├── get-indicator-current-value.usecase.ts
│   │   │   ├── create-indicator-measurement.usecase.ts   # exige escopo GLOBAL (D-6)
│   │   │   └── list-indicator-measurements.usecase.ts
│   │   ├── infrastructure/                # repositórios Prisma de IndicatorDefinition/Measurement;
│   │   │                                  # IndicatorActionOriginAccessor (US4, D-5)
│   │   └── presentation/                  # controller + DTOs + mappers
│   └── reports/                           # NOVO
│       ├── domain/                        # ReportDefinition
│       ├── application/
│       │   ├── run-report.usecase.ts      # chama IndicatorCalculationService por metricKey,
│       │   │                              # nunca uma segunda implementação (FR-025)
│       │   └── export-report-csv.usecase.ts
│       ├── infrastructure/                # repositório Prisma de ReportDefinition
│       └── presentation/                  # controller + DTOs + mappers + serialização CSV (D-10)
├── core/dashboard/domain/
│   └── default-planned-areas.ts           # ALTERADO — remove PROBLEMS/INCIDENTS (FR-038, fecha o Achado 1)
├── core/notifications/                    # SEM alteração de código — primeiro CHAMADOR real vem de
│                                          # `modules/indicators` (US3)
└── grc/
    ├── action/                            # ALTERADO — ActionOriginType += INDICATOR, acessor (D-5)
    └── shared/domain/entity-code.service.ts   # ALTERADO — prefixos 'IND' e 'RPT' (D-9)

apps/api/prisma/
├── migrations/                            # ADITIVA — três tabelas (indicator_definitions,
│                                          # indicator_measurements, report_definitions), quatro
│                                          # enums novos (IndicatorMetricKey,
│                                          # IndicatorThresholdComparator + extensões de
│                                          # AuditEntityType/ActionOriginType/CommentableEntityType/
│                                          # EntityCodePrefix) — nenhuma coluna alterada em tabela
│                                          # existente
└── seed/platform.seed.ts                  # ALTERADO — seis permissões novas; "Read Only" ganha
                                           # indicator:view/report:view (research.md D-13)

apps/web/src/
├── app/(app)/indicators/                  # NOVO — catálogo de definições, valor atual, histórico
├── app/(app)/reports/                     # NOVO — catálogo de definições, execução, exportação CSV
├── features/indicators/                   # NOVO — types, api, componentes (cartão de métrica,
│                                          # badge de rompimento, gráfico de tendência)
├── features/reports/                      # NOVO — idem
├── lib/messages/indicators.ts             # NOVO — catálogo pt-BR
├── lib/messages/reports.ts                # NOVO — idem
└── components/shell/navigation-registry.ts   # ALTERADO — 'indicators'/'reports' saem de 'planned'
```

**Structure Decision**: mesma forma interna de `modules/incidents`/`modules/problems`
(domain/application/infrastructure/presentation). Nenhum porte compartilhado novo em
`shared/grc-ports/` — diferente de `008` (que precisou de `IncidentDirectoryPort` para um vínculo de
escrita entre dois módulos novos), esta fase só **lê**, através das portas/serviços que cada módulo
já expõe publicamente hoje (por exemplo, `DashboardQueryPort` de Risco já é injetável fora de
`modules/risk`; os módulos mais recentes seguem o mesmo padrão de expor um serviço de leitura).

---

## Riscos desta fase, e o que cada um exige

| Risco | Por que é real aqui | Mitigação exigida |
|---|---|---|
| **Reimplementar a regra de escopo por dentro de `IndicatorMetricProvider`, em vez de delegar à consulta que o módulo-fonte já tem** | É o caminho de menor esforço aparente ("já sei o nome da coluna, escrevo o `WHERE` aqui") e é exatamente como `specs/006-assets-processes/STATE.md` §3 registra que a leitura sem escopo nenhum aconteceu — um controller novo consultando direto, sem passar pelo caminho já escopado | Todo `IndicatorMetricProvider` **injeta** a porta/serviço de leitura já existente do módulo-fonte (`DashboardQueryPort`, `RequirementComplianceReaderService`, etc.) — nenhum provider escreve seu próprio `WHERE org_unit_id`. Revisão de código verifica isso arquivo por arquivo antes de aceitar cada provider |
| **A guarda de "nenhuma coluna de tarefa/anexo/aprovação em paralelo" (SC-005) nascer vácua**, como `specs/006-assets-processes/STATE.md` §2.4 registrou para `deleteMany` | Esta plataforma já teve uma guarda estrutural que nunca casaria com o código real, verde por acidente | A guarda desta fase é validada plantando deliberadamente um contra-exemplo (uma coluna `dueDate` fictícia em `IndicatorDefinition`, por exemplo) e confirmando que ela FALHA antes de ser aceita como passando contra o código real — mesma técnica que `006` já documentou como correção |
| **Notificação de rompimento nunca disparada em produção**, ponto de extensão que "existe mas não roda" (§19.10) | É a mesma classe de defeito que motivou a própria regra — `NotificationService` já ficou sem produtor por múltiplas fases | Teste de integração real (não unitário isolado) cria um `IndicatorMeasurement` que rompe o limiar e lê `notifications` pelo repositório real, sem substituir `NotificationService` por um mock nesse teste específico |
| **`GET /reports/{id}/run` reimplementar o cálculo de cada métrica**, em vez de chamar exatamente o mesmo caminho de `GET /indicators/{key}/current` | Tentador porque a resposta tem um formato ligeiramente diferente (por item, com `available`) | `RunReportUseCase` chama `IndicatorCalculationService` diretamente — nunca duplica a lógica de nenhum `IndicatorMetricProvider` |
| **Corrigir `default-planned-areas.ts` sem atualizar `shared/messages/dashboard.ts`**, deixando `plannedAreaLabels.PROBLEMS`/`INCIDENTS` órfãos como já aconteceu com `CONTROLS` | O órfão de `CONTROLS` já é evidência de que essa segunda edição foi esquecida uma vez | A tarefa que remove o registro remove também as duas chaves órfãs do catálogo de mensagens, na mesma tarefa — não deixa um terceiro órfão para uma fase futura encontrar |

---

## Phase 0 — Research

Concluída: [research.md](./research.md). D-1 a D-13, cada uma com alternativa rejeitada e citação
de arquivo/linha. D-1/D-2/D-3/D-6/D-7/D-9-D-10/D-11-D-12 respondem, na ordem, as sete perguntas de
escopo que esta tarefa pediu para decidir.

## Phase 1 — Design & Contracts

Concluída: [data-model.md](./data-model.md), [contracts/](./contracts/). `data-model.md` §8 é o
resumo de escopo por operação exigido pela tarefa — nenhuma leitura cruzada de domínio sem
predicado explícito de escopo, ou justificativa registrada para a única exceção (Conformidade).

## Phase 2 — Tasks

[tasks.md](./tasks.md). Organizada por user story (US1-US6). Inclui, para US6 (interface), critérios
de aceitação explícitos por CLAUDE.md §18.12 — hierarquia visual, estados de interação,
responsividade, acessibilidade, reuso do Design System e verificação renderizada com Playwright —
não deixados implícitos.
