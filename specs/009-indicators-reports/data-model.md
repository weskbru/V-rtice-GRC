# Data Model — Gestão de Indicadores e Gestão de Relatórios

**Feature**: `009-indicators-reports` · **Spec**: [spec.md](./spec.md) ·
**Research**: [research.md](./research.md)

**O que este documento não modela, deliberadamente**: nenhuma coluna de valor "atual" em
`IndicatorDefinition` (research.md D-2 — o valor atual nunca é armazenado). Nenhuma coluna de
unidade organizacional em `IndicatorDefinition`/`ReportDefinition` (research.md D-8 — são
definições compartilhadas, a execução carrega o escopo). Nenhuma tabela de histórico para
`ReportDefinition` (spec.md FR-028 — só o indicador individual tem série histórica). Nenhuma
tabela de tarefa, arquivo ou aprovação própria (spec.md SC-005).

---

## §1 — Duas tabelas novas de domínio

### `indicator_definitions`

```
id                      uuid                    PK, default uuid(7)
code                    text                    UNIQUE — 'IND-2026-0001' (R-008, research.md D-9)
metric_key              "IndicatorMetricKey"    NOT NULL, UNIQUE — registro fechado, §3 abaixo
name                    text                    NOT NULL
description             text                    NOT NULL
owner_user_id           uuid                    NOT NULL, FK -> users (Restrict)
threshold_comparator    "IndicatorThresholdComparator"  NULL — preenchido junto com threshold_value, ou nenhum dos dois (Invariant T1)
threshold_value         numeric                 NULL — idem
is_active               boolean                 NOT NULL DEFAULT true — desativação, nunca exclusão (FR-003)
created_by_user_id      uuid                    NOT NULL, FK -> users (Restrict)
created_at              timestamptz             NOT NULL DEFAULT now()
updated_at              timestamptz             NOT NULL (auto)
```

**Invariant T1** (domain-enforced, não CHECK — a mesma técnica que `Finding.closureJustification`
já usa): `threshold_comparator`/`threshold_value` são preenchidos juntos, ou nenhum dos dois. Nunca
um sem o outro — um comparador sem valor (ou vice-versa) não tem significado avaliável.

**`metric_key` é `UNIQUE`**: no máximo uma `IndicatorDefinition` por chave do catálogo fechado (§3).
Uma `IndicatorDefinition` é **configuração opcional** de uma chave que já existe e já é
consultável independentemente dela — `GET /indicators/{metricKey}/current` (US1) funciona mesmo
quando nenhuma linha desta tabela existe ainda para aquela chave (nesse caso, sem limiar
configurado e sem `ownerUserId` a notificar, FR-019). Isto evita a ambiguidade que uma cardinalidade
N:1 (várias definições por chave, cada uma com seu próprio limiar/responsável) introduziria em
`POST /indicators/{metricKey}/measurements` (§2, abaixo): "qual das definições concorrentes decide
se este ponto rompeu o limiar, e quem é notificado?" deixa de ser uma pergunta, porque só pode
existir uma resposta.

**Sem `org_unit_id`** (research.md D-8): `IndicatorDefinition` é uma definição compartilhada, visível
a qualquer chamador com `indicator:view`, o mesmo padrão que `Framework`/`FrameworkVersion` já
seguem para configuração de plataforma que não é "de uma unidade".

**Sem exclusão** (FR-003): um indicador que deixa de ser relevante é desativado
(`is_active = false`), nunca apagado — o mesmo padrão que `Asset`/`Process`/`Control` já seguem
(`is_active`/`ControlStatus`).

### `report_definitions`

```
id                      uuid           PK, default uuid(7)
code                    text           UNIQUE — 'RPT-2026-0001'
name                    text           NOT NULL
description             text          NOT NULL
metric_keys             "IndicatorMetricKey"[]  NOT NULL, não vazio — validado na aplicação (Prisma não impõe "array não vazio")
is_active               boolean        NOT NULL DEFAULT true
created_by_user_id      uuid           NOT NULL, FK -> users (Restrict)
created_at              timestamptz    NOT NULL DEFAULT now()
updated_at              timestamptz    NOT NULL (auto)
```

**Sem `org_unit_id`**, mesma razão de `indicator_definitions` (research.md D-8, spec.md A-5).

**Sem tabela de junção `report_definition_indicators`**: `metric_keys` é um array de um tipo enum
fechado, não uma FK para outra tabela — `IndicatorMetricKey` não é uma linha de banco (é um valor
de enum, como `RiskLevel`), então não há "linha" para uma tabela de junção referenciar. Uma FK real
existiria se `Report` referenciasse `IndicatorDefinition.id` (a definição salva) em vez da chave da
métrica — decisão explícita, abaixo (§6, nota de projeto).

---

## §2 — Uma tabela nova de histórico, append-only

### `indicator_measurements`

```
id                          uuid                    PK, default uuid(7)
metric_key                  "IndicatorMetricKey"    NOT NULL — a chave do catálogo (§3), NÃO uma FK
                                                     para o id de uma `indicator_definitions`
                                                     específica (ver nota abaixo)
value                       numeric        NULL — preenchido quando a métrica produz um único número (Invariant M1)
value_by_bucket             jsonb          NULL — preenchido quando a métrica produz uma distribuição (ex.: por nível/severidade — Invariant M1)
breached                    boolean        NOT NULL — calculado no momento da criação (research.md D-7), nunca recalculado depois
computed_at                 timestamptz    NOT NULL DEFAULT now()
computed_by_user_id         uuid           NOT NULL, FK -> users (Restrict)
```

**Por que `metric_key`, não `indicator_definition_id`**: `IndicatorMeasurement` é gravado no
momento de `POST /indicators/{metricKey}/measurements` (FR-011), que não exige que uma
`IndicatorDefinition` exista para aquela chave (ver §1, acima — a definição é configuração
opcional). Referenciar `metric_key` diretamente, do mesmo tipo enum que
`report_definitions.metric_keys` já usa, mantém um ponto de medição gravável independentemente de
alguém ter configurado nome/limiar/responsável para aquela chave — o valor calculado existe de
qualquer forma (US1); o que depende da definição existir é só a avaliação de `breached` (que,
sem definição, é sempre `false`, FR-019) e a notificação de rompimento (US3, que sem definição não
tem `ownerUserId` a notificar e portanto não dispara). `metric_key` **não é** uma FK de banco (não
há tabela `indicator_metric_keys`) — é validado contra o enum pelo próprio tipo da coluna, o mesmo
mecanismo que garante que `report_definitions.metric_keys` nunca carregue um valor fora do
catálogo.

**Invariant M1**: exatamente um de `value`/`value_by_bucket` é preenchido, nunca os dois nem
nenhum — qual dos dois depende do próprio `metric_key` do ponto (§3, coluna `shape`): uma métrica
de contagem única, como `COMPLIANCE_PERCENTAGE`, usa `value`; uma métrica por distribuição, como
`RISK_TOTAL_BY_LEVEL`, usa `value_by_bucket` com uma chave por valor do enum correspondente — o
mesmo formato "zero-filled" que `RiskProfileRecord.byResidualLevel` já usa,
`dashboard-query.port.ts:54-58`).

**Sem `org_unit_id`, sem `code`**: todo `IndicatorMeasurement` é, por construção, organização
inteira (research.md D-6) — não há unidade a registrar. Não tem código próprio pela mesma razão que
`RequirementApplicabilityDeclaration`/`FrameworkVersion` não têm (research.md D-14 de
`004-compliance-management`): o par `(metric_key, computed_at)` já é um identificador natural e
estável para exibição.

**Sem `updated_at`**: não existe operação que atualize uma linha desta tabela — omitir a coluna é
mais honesto que declará-la e nunca escrevê-la (SC-002).

**Índice**: `@@index([metricKey, computedAt])` — todo acesso a este recurso é "histórico de um
indicador, ordenado no tempo" (FR-015); nenhuma consulta faz sentido sem o primeiro filtro.

---

## §3 — `IndicatorMetricKey` (registro fechado, research.md D-4)

```prisma
enum IndicatorMetricKey {
  RISK_TOTAL_BY_LEVEL
  RISK_TREATMENT_OVERDUE_COUNT
  CONTROL_INACTIVE_COUNT
  COMPLIANCE_PERCENTAGE
  AUDIT_ENGAGEMENT_OPEN_COUNT
  FINDING_OPEN_COUNT_BY_SEVERITY
  ASSET_INACTIVE_COUNT
  PROCESS_INACTIVE_COUNT
  ACTION_OVERDUE_COUNT
  INCIDENT_OPEN_COUNT_BY_SEVERITY
  PROBLEM_OPEN_COUNT_BY_SEVERITY
}
```

Onze valores, um por linha da tabela de research.md D-4 — cobrindo os dez domínios de negócio de
D-3 (Auditoria/Achado conta como dois: `AUDIT_ENGAGEMENT_OPEN_COUNT` e
`FINDING_OPEN_COUNT_BY_SEVERITY`). Cada valor tem:

- **`sourcePermission`** — a permissão de leitura do domínio-fonte que FR-006 exige em conjunto com
  `indicator:view` (por exemplo, `risk:view` para as duas chaves de Risco).
- **`scopeApplicability`** — `'ORGANIZATIONAL_UNIT'` para as dez chaves cuja fonte tem
  `org_unit_id` próprio; `'ORGANIZATION_WIDE'` só para `COMPLIANCE_PERCENTAGE` (research.md D-8).
- **`shape`** — `'SINGLE_VALUE'` (`COMPLIANCE_PERCENTAGE`, `RISK_TREATMENT_OVERDUE_COUNT`,
  `AUDIT_ENGAGEMENT_OPEN_COUNT`, `CONTROL_INACTIVE_COUNT`, `ASSET_INACTIVE_COUNT`,
  `PROCESS_INACTIVE_COUNT`, `ACTION_OVERDUE_COUNT`) ou `'BY_BUCKET'` (`RISK_TOTAL_BY_LEVEL`,
  `FINDING_OPEN_COUNT_BY_SEVERITY`, `INCIDENT_OPEN_COUNT_BY_SEVERITY`,
  `PROBLEM_OPEN_COUNT_BY_SEVERITY`).

Este metadado por chave vive em código (`IndicatorMetricCatalog`, um mapa estático — não uma
tabela, porque não muda em runtime e não tem escopo organizacional próprio), não no banco — o
mesmo motivo que `RiskScoringService`/`requirement-compliance.service.ts` são funções puras sem
tabela de configuração própria: a regra de qual permissão/domínio uma chave usa é uma decisão de
código revisada por migração, nunca um dado editável por um usuário administrador.

**Adicionar uma décima segunda chave, no futuro**, exige: um valor de enum novo (migração aditiva,
ADR-008), uma entrada no `IndicatorMetricCatalog`, e um `IndicatorMetricProvider` que implementa a
consulta contra o domínio-fonte — nunca um parâmetro que o cliente possa compor livremente
(research.md D-4).

---

## §4 — `IndicatorThresholdComparator` (registro fechado)

```prisma
enum IndicatorThresholdComparator {
  GTE
  GT
  LTE
  LT
}
```

Quatro valores — maior-ou-igual, maior, menor-ou-igual, menor. Nenhum operador de igualdade
(`EQ`) ou diferença (`NEQ`): um limiar de indicador GRC é sempre "não deve passar de"/"não deve
cair abaixo de", nunca "deve ser exatamente" — igualdade exata contra um valor calculado (por
exemplo, uma contagem) seria frágil por natureza (o valor raramente para exatamente num número), e
nenhum requisito pede esse caso.

---

## §5 — Extensões a registros fechados já existentes

| Enum | Novo(s) valor(es) | Onde é usado | FR |
|---|---|---|---|
| `AuditEntityType` | `INDICATOR`, `INDICATOR_MEASUREMENT`, `REPORT` | trilha de auditoria de criação/edição de definição, e de cada ponto de medição | FR-013, FR-024, FR-032 |
| `ActionOriginType` | `INDICATOR` | `Action.originType` quando criada a partir de um indicador (US4) | FR-020 |
| `CommentableEntityType` | `INDICATOR` | `Notification.entityType` — link profundo da notificação de rompimento (FR-017) | FR-018 |
| `EntityCodePrefix` (`grc/shared`) | `'IND'`, `'RPT'` | `IndicatorDefinition.code`, `ReportDefinition.code` | FR-031 |
| `PermissionIdentifier` (declaração de tipo, não enum de banco) | `indicator:view`, `indicator:create`, `indicator:edit`, `report:view`, `report:create`, `report:edit` | autorização | FR-034 |

**`AttachableEntityType` não ganha `INDICATOR`/`REPORT`** (spec.md FR-033, decisão explícita): nenhum
requisito pede anexar um arquivo bruto a um indicador ou relatório; estender o registro sem
consumidor real repetiria CLAUDE.md §19.10.

**`ApprovableEntityType` não muda**: nenhum requisito pede sign-off na criação de indicador/relatório.

---

## §6 — Relacionamentos e integridade referencial

```
indicator_definitions
  (metric_key UNIQUE — §1) ── indicator_measurements.metric_key  (mesmo valor de enum, NUNCA uma FK
    de banco entre as duas tabelas — §2 explica por quê; a relação é lógica, resolvida em
    aplicação, não imposta por `FOREIGN KEY`)

report_definitions
  → metric_keys: IndicatorMetricKey[]  (validação de aplicação: cada elemento deve existir no
    enum — o próprio tipo do array já impede um valor fora do enum a nível de banco; a validação de
    aplicação cobre "não vazio", que o tipo de coluna não expressa)
```

**Nota de projeto — por que `report_definitions.metric_keys` e `indicator_measurements.metric_key`
referenciam a *chave* da métrica, nunca o `id` de uma `IndicatorDefinition`**: um relatório pede "o
total de riscos por nível", não "a linha de configuração específica que alguém criou para essa
métrica" — e, como `metric_key` já é `UNIQUE` em `indicator_definitions` (§1), referenciar a chave
ou referenciar o `id` da única definição daquela chave seriam equivalentes **se** uma definição já
existisse; a diferença real é que um ponto de medição e um item de relatório continuam válidos
mesmo que **nenhuma** `IndicatorDefinition` exista ainda para aquela chave (§1) — algo que uma FK
`NOT NULL` para `indicator_definitions.id` tornaria impossível. `GET /reports/{id}/run` (FR-025)
computa o valor de cada chave diretamente pelo mesmo caminho de US1
(`IndicatorCalculationService`), e `POST /indicators/{metricKey}/measurements` (FR-011) grava o
ponto, em ambos os casos sem exigir que uma `IndicatorDefinition` exista — limiar e notificação
(US3) são, por desenho, propriedades da **definição opcional** que alguém registrou para uma
chave, nunca uma propriedade da chave em si.

---

## §7 — Índices

```
@@unique([metricKey])                 -- indicator_definitions: no máximo uma definição por chave (§1)
@@unique([code])                      -- indicator_definitions, report_definitions (já coberto por UNIQUE de coluna)
@@index([metricKey, computedAt])      -- indicator_measurements: histórico ordenado (§2)
```

Nenhum índice de escopo organizacional (`org_unit_id`) nas três tabelas desta fase — nenhuma das
três tem essa coluna (research.md D-8, D-6). O escopo é aplicado nas consultas **às tabelas-fonte**
de cada domínio (`risks.org_unit_id`, `incidents.org_unit_id`, etc.), que já têm seus próprios
índices de escopo desde a fase que as criou.

---

## §8 — Resumo de escopo organizacional por operação (obrigatório — leitura cruzada de domínio é o
maior risco de vazamento desta fase)

| Operação | Tabela(s) consultada(s) | Predicado de escopo |
|---|---|---|
| `GET /indicators` (catálogo de definições) | `indicator_definitions` | nenhum — definição é compartilhada (D-8) |
| `GET /indicators/{key}/current`, exceto Conformidade | tabela-fonte do domínio (`risks`, `controls`, `audit_engagements`, `findings`, `assets`, `processes`, `actions`, `incidents`, `problems`) | `ScopeFilter` do chamador, na coluna `org_unit_id` própria daquela tabela — nunca por junção |
| `GET /indicators/{key}/current`, Conformidade (`COMPLIANCE_PERCENTAGE`) | `frameworks`/`framework_versions`/`requirements` | nenhum — a fonte não tem `org_unit_id` (D-8); a resposta declara `scopeApplicability: 'ORGANIZATION_WIDE'` |
| `POST /indicators/{key}/measurements` | `indicator_measurements` (escrita) + tabela-fonte (leitura, para calcular) | exige `ScopeFilter.kind === 'GLOBAL'` do chamador (D-6) — recusado com `403` caso contrário, antes de qualquer leitura de fonte |
| `GET /indicators/{key}/measurements` | `indicator_measurements` | exige `ScopeFilter.kind === 'GLOBAL'` do chamador (D-6) |
| `GET /reports/{id}/run` | `report_definitions` +, para cada `metricKey`, o mesmo caminho de `GET /indicators/{key}/current` | escopo do chamador, por item, idêntico à linha de `current` acima; item sem permissão de fonte marcado `available: false` (FR-026), nunca `403` da operação inteira |

Toda linha desta tabela decorre de FR-006/FR-007/FR-008/FR-009/FR-012/FR-014/FR-026 — nenhuma é
uma regra nova introduzida só aqui.
