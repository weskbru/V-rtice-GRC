# Contract changes — Convergência e Saneamento de Implementação

**Feature**: `007-implementation-remediation` · **Spec**: [../spec.md](../spec.md) ·
**Data model**: [../data-model.md](../data-model.md)

Este documento descreve as mudanças de contrato que esta fase exige. **Não edita** os YAML das
fases 001-006** — isso é tarefa de implementação (`tasks.md`, frente A/C), revisada aqui antes de
tocar os arquivos. Cada entrada nomeia o documento afetado, a operação, o esquema, o código de
status e a nota de migração para quem consome a API.

Não existe consumidor externo desta API (instalação única, v1 — spec.md Assumption A-2), então
nenhuma das mudanças abaixo exige um período de descontinuação nem versionamento de rota — mas cada
uma é, ainda assim, uma mudança de contrato deliberada, documentada, não uma quebra silenciosa.

---

## 1. `specs/001-grc-platform-foundation/contracts/risks.openapi.yaml`

### 1.1 `RiskTreatmentAction.id` passa a significar `Action.id`

**Operações afetadas**: `GET /risks/{riskId}/treatment-actions`,
`POST /risks/{riskId}/treatment-actions`, `PATCH /risks/{riskId}/treatment-actions/{actionId}`.

**Mudança**: o campo `id` do esquema `RiskTreatmentAction` (linha ~2040) e o parâmetro de caminho
`actionId` (já presente, linha 688) passam a identificar a `Action` compartilhada, não a linha de
`risk_treatment_actions`. A forma JSON do esquema **não muda** — continua um `uuid` — apenas o valor
que ele identifica. Nenhum campo é adicionado ou removido no esquema `RiskTreatmentAction` por esta
mudança específica (a mudança de `POST`/`PATCH` está descrita em 1.2 e 1.3 abaixo).

**Razão**: research.md D-2. Duas identidades para o mesmo item de trabalho é a duplicação que esta
convergência remove; a listagem por essa identidade passa a incluir toda `Action` de origem
`RISK_TREATMENT`, com ou sem linha de vínculo — hoje três ações assim são invisíveis.

**Nota de migração para clientes**: qualquer código que armazenava o `id` retornado por
`GET/POST /risks/{riskId}/treatment-actions` para uso posterior contra `/actions/{id}` já
funcionava por coincidência apenas quando a linha de vínculo existia e nunca tinha sido a forma
suportada; a partir desta fase, esse uso passa a ser suportado e estável.

### 1.2 `POST /risks/{riskId}/treatment-actions` grava dois eventos de auditoria

**Mudança de comportamento, sem mudança de esquema de resposta**: a criação passa a gravar
`risk.treatment_action_created` (entidade `RISK_TREATMENT_ACTION`, a linha de vínculo) **e**
`action.created` (entidade `ACTION`). Nenhum campo de resposta muda; a mudança é observável apenas
via `GET /audit-events` ou `GET /risks/{riskId}/history` (este último inalterado — ver §2).

### 1.3 `UpdateRiskTreatmentActionRequest` ganha `reopenReason`

**Esquema alterado** (linha ~2094):

```diff
 UpdateRiskTreatmentActionRequest:
   type: object
   minProperties: 1
   additionalProperties: false
   properties:
     title: { ... }
     description: { ... }
     responsibleUserId: { ... }
     dueOn: { ... }
     status:
       allOf:
         - $ref: '#/components/schemas/TreatmentActionStatus'
       description: |
         The change is attributed to the acting user with a timestamp and audited (FR-074a).
+    reopenReason:
+      type: [string, 'null']
+      minLength: 1
+      description: |
+        Required when `status: OPEN` reopens an action currently `COMPLETED` (D-R3). Ignored
+        (may be omitted or null) for every other transition.
```

**Novo motivo de `422`** na mesma operação (o código de status `422` já está declarado na operação —
`components/responses/UnprocessableEntity` — apenas o motivo é novo): reabrir uma ação `COMPLETED`
sem `reopenReason`, ou tentar uma transição que a tabela de legalidade de `Action` recusaria (por
exemplo, `CANCELLED -> COMPLETED`, ou `OPEN -> COMPLETED` sem passar por `IN_PROGRESS` quando a
tabela de legalidade exigir esse caminho — a tabela exata é a que `action.entity.ts` já define e
esta fase não altera).

**Razão**: research.md D-3. Hoje a rota de Riscos aceita 11 pares de transição que
`POST /actions/{id}/transitions` já recusa.

**Nota de migração para clientes**: uma chamada que hoje reabre uma ação concluída sem motivo, pela
rota de Riscos, passa a receber `422` em vez de `200`. É a correção — não uma regressão a
contornar.

### 1.4 `GET /risks/{riskId}/history` — confirmado inalterado

Verificado diretamente (`risk-history.service.ts` linhas 314 e 336): o endpoint lê apenas
`entity_type IN ('RISK', 'RISK_ASSESSMENT')` hoje, e continua assim depois desta fase. **Nenhuma
mudança de contrato aqui.** Ver research.md D-5 para a correção sobre por que isto não muda, e a
cauda de `matrix.md` para a pergunta de produto que fica em aberto (se o histórico do risco deveria
um dia mostrar eventos de ação).

---

## 2. `specs/001-grc-platform-foundation/contracts/platform.openapi.yaml`

### 2.1 `DashboardActionItem.actionId` passa a significar `Action.id`

**Operação afetada**: `GET /dashboard` (`overdueActions[].actionId`, esquema `DashboardActionItem`,
linha ~1051).

**Mudança**: `getOverdueActions` (`dashboard-query.service.ts`, ~linha 230) retorna hoje
`actionId: rta.id` — o id da linha de `risk_treatment_actions`. Depois da convergência (D-R2),
retorna o id da `Action` compartilhada. A forma do esquema não muda (continua `uuid`, obrigatório);
o significado do valor muda, na mesma direção que 1.1 acima — é o mesmo identificador, agora
consistentemente `Action.id` em toda superfície da API que o expõe.

**Razão de estar aqui e não só no contrato de Riscos**: este campo pertence a
`platform.openapi.yaml`, não a `risks.openapi.yaml` — é fácil de esquecer porque a origem do dado é
a mesma tabela. Citado explicitamente para que a tarefa de implementação (frente A) não corrija
apenas o contrato de Riscos e deixe este de fora.

### 2.2 `treatmentActions.{total,open,overdue}` — números vão mudar, esquema não

**Operação afetada**: `GET /dashboard` (`treatmentActions`, esquema em `DashboardAggregates`, linha
~983).

**Sem mudança de esquema.** Mudança de comportamento, documentada para que não seja relatada como
regressão (spec.md SC-002a): a contagem passa a ler `actions` por origem em vez de
`risk_treatment_actions`, e portanto passa a incluir as três `Action` com `originType=RISK_TREATMENT`
sem linha de vínculo, hoje invisíveis a este indicador. Medido no HEAD atual:
`{total: 73, open: 73, overdue: 37}` contra `risk_treatment_actions`, enquanto `actions` já contém
37 linhas — os números finais mudam, e essa mudança é a correção funcionando, não um defeito dela.

### 2.3 `plannedAreas` deixa de anunciar `CONTROLS`

**Operação afetada**: `GET /dashboard` (`plannedAreas`, esquema não muda — é um array de chave e
rótulo; muda apenas quais chaves o servidor registra).

**Sem mudança de esquema.** `CONTROLS` é removido do registro padrão
(`core/dashboard/domain/default-planned-areas.ts`) porque o módulo de Controles está em produção
desde a Fase 2 — anunciá-lo como planejado é uma afirmação falsa ao usuário (research.md D-15). Um
cliente que hoje itera `plannedAreas` e espera encontrar `CONTROLS` ali deixa de encontrá-lo; nenhum
teste de contrato deveria fixar esse conjunto como parte do esquema (apenas como dado de teste,
atualizável).

---

## 3. Contratos explicitamente NÃO alterados por esta fase

Registrado para que a tarefa de implementação não amplie o escopo por conta própria:

- `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml` (`/actions/**`) — nenhuma
  mudança de esquema. `GET /actions?originType=RISK_TREATMENT` já é a via pela qual as três ações
  órfãs se tornam visíveis; nenhum campo novo é necessário ali.
- `specs/003-controls-management/contracts/controls.openapi.yaml` — o saneamento de
  `ControlRegistryPort`/`ControlAssessmentRepository` (US5) é inteiramente interno; nenhuma operação,
  esquema ou código de status muda.
- `specs/004-compliance-management/contracts/compliance.openapi.yaml`,
  `specs/005-audit-findings/contracts/audit.openapi.yaml`,
  `specs/006-assets-processes/contracts/{assets,processes}.openapi.yaml` — sem mudança nesta fase;
  passam a ganhar cobertura de geração de tipos (US3) e de validação de payload (US3), o que não
  altera o próprio contrato, apenas o que o verifica.
