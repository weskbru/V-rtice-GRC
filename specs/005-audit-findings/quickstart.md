# Quickstart — Auditoria e Achados

Roteiro de validação executável. Prova que o módulo funciona ponta a ponta, não que ele compila.

Pré-requisitos: PostgreSQL local com o banco semeado, API e web em execução, e usuários com os
papéis necessários (`Audit Lead` para conduzir; `Auditor` para o cenário 8; `Risk Manager`/
`Control Owner` para preparar fixtures de risco/controle). Ver
`specs/001-grc-platform-foundation/quickstart.md` para o preparo do ambiente, que não muda nesta
fase.

---

## 0. Pré-condições

```bash
pnpm --filter @vertice/api exec prisma migrate deploy   # migrações aditivas desta fase (F-51/D-25: nunca `db:migrate` — esse script roda `prisma migrate dev`, proibido contra banco real por schema.prisma:57-72)
pnpm --filter @vertice/api run db:seed          # permissões e papéis novos
```

Confirme que as permissões novas entraram — se não estiverem, nenhum cenário abaixo passa:

```sql
SELECT identifier FROM permissions
WHERE identifier LIKE 'audit-engagement:%' OR identifier IN ('finding:remediate', 'finding:link')
ORDER BY identifier;
-- Esperado: 7 linhas — audit-engagement:{create,edit,scope,transition,view}, finding:remediate, finding:link.
```

```sql
SELECT r.name, p.identifier FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'Auditor' AND p.identifier = 'audit-engagement:view';
-- Esperado: 1 linha — o papel Auditor já existente ganhou a permissão nova (research.md D-7),
-- em vez de um segundo papel de leitura ter sido criado.
```

### 0.1 `If-Match` é obrigatório em toda escrita sobre o engajamento

**Registrado ao executar este roteiro de ponta a ponta (T082), contra a aplicação em execução.**
Nenhuma seção abaixo mencionava este cabeçalho, e seguir os passos literalmente devolve `400`
("O cabeçalho If-Match é obrigatório para esta operação") em vez do `422` esperado — o que se
parece com um defeito e não é.

`PATCH /audits/{id}` **e as três transições** (`/start`, `/complete`, `/cancel`) exigem
`If-Match` com o `ETag` atual do engajamento (concorrência otimista, research.md D-18; o contrato
declara o parâmetro em todas as quatro). Leia o `ETag` de um `GET /audits/{id}` imediatamente
antes:

```bash
ETAG=$(curl -sD - -o /dev/null "$API/audits/$AID" -b cookies.txt | awk 'tolower($1)=="etag:"{print $2}' | tr -d '')
curl -X POST "$API/audits/$AID/start" -b cookies.txt -H "If-Match: $ETAG" -H 'Content-Type: application/json' -d '{}'
```

O `ETag` muda a cada escrita bem-sucedida — releia-o entre uma transição e a seguinte. A interface
já faz isso; só o roteiro escrito é que não dizia.

**Divergência oposta não encontrada**: fora este cabeçalho, todos os cenários §2 a §7 responderam
exatamente o que o desenho prevê, verificados em execução — `PLANNING` na criação, `422` ao iniciar
sem escopo, `200/IN_PROGRESS` com escopo, `422` no `PATCH` depois de iniciado, achado com
`auditEngagementId` preenchido e o caminho manual com `null` (FR-008), `OPEN → IN_REMEDIATION` e a
segunda tentativa recusada (SC-002), fechamento sem evidência recusado com a mensagem de FR-010
(SC-003), e nenhuma rota `DELETE` de engajamento ou achado (FR-012).

---

## 1. O escopo sobrevive a uma revisão da norma (FR-006, research.md D-2)

O cenário mais importante desta fase, e o primeiro por isso.

1. Publique `FrameworkVersion` "2022" de um framework, com o requisito `A.5.16`. Anote os dois ids.
2. Abra um engajamento e adicione `A.5.16` ao seu escopo (`POST /audits/{id}/scope/requirements`).
3. Publique uma SEGUNDA versão do mesmo framework, "2023", com um requisito renumerado (não o
   mesmo `id` — uma cláusula nova, ainda que o texto seja parecido).
4. `GET /audits/{id}/scope`.

**Esperado**: o vínculo continua apontando para `A.5.16` da versão "2022", com o mesmo `label` e
`externalRef` de antes — a existência da versão "2023" não move, reescreve nem invalida o vínculo.

```sql
-- O vínculo aponta para a linha específica, nunca para o framework em abstrato.
SELECT requirement_id FROM audit_scope_requirements WHERE audit_engagement_id = :auditId;
-- O requisito apontado nunca mudou de conteúdo (imutabilidade garantida por trigger desde a Fase 3).
SELECT external_ref, title, updated_at FROM requirements WHERE id = :requirementId;
```

**Falha que este cenário procura**: um FK para `framework_id` em vez de `framework_version_id`/
`requirement_id` — o "FK ingênuo" que research.md D-2 nomeia e recusa desde o desenho. Se o escopo
"seguisse" a nova versão automaticamente, este cenário mostraria `A.5.16` mudando de versão ou
desaparecendo.

5. Tente adicionar ao escopo um requisito de uma versão ainda `DRAFT`.
   **Esperado**: `422`, `requirementId` recusado — nenhuma linha gravada.

```sql
SELECT count(*) FROM audit_scope_requirements WHERE requirement_id = :draftRequirementId;
-- Esperado: 0, antes e depois da tentativa.
```

---

## 2. Ciclo de vida do engajamento: cada estado tem consequência observável (FR-002, FR-003, FR-004)

1. Crie um engajamento. `GET /audits/{id}`. **Esperado**: `status: "PLANNING"`.
2. Tente `POST /audits/{id}/start` sem nenhum vínculo de escopo.
   **Esperado**: `422` — "sem escopo declarado" (FR-003).
3. Adicione um controle ao escopo. `POST /audits/{id}/start`.
   **Esperado**: `200`, `status: "IN_PROGRESS"`.
4. Tente `PATCH /audits/{id}` (mudar o objetivo) agora.
   **Esperado**: `422` — só editável em `PLANNING` (research.md D-3, D-13).
5. `POST /audits/{id}/complete`. **Esperado**: `200`, `status: "COMPLETED"`.
6. Tente `POST /audits/{id}/findings` sobre este engajamento concluído.
   **Esperado**: `422` — engajamento concluído não aceita achado novo (FR-004).
7. `GET /audits/{id}` de novo. **Esperado**: `200`, todos os campos legíveis normalmente — um
   engajamento concluído nunca fica opaco (FR-004, "permanece integralmente legível").

**Falha que este cenário procura**: um estado sem consequência — o mesmo defeito que este projeto
já quase enviou três vezes (`FindingStatus`, `DRAFT` de Controles, o quase-incidente de
Compliance). Cada uma das seis chamadas acima só passa se o estado correspondente realmente
habilitar ou proibir alguma coisa.

---

## 3. Achado a partir do engajamento mostra a origem, e o engajamento lista (SC-001)

1. Com o engajamento `IN_PROGRESS` do cenário 2 (ou um novo), `POST /audits/{id}/findings`.
   **Esperado**: `201`, `status: "OPEN"`, `auditEngagementId` presente no corpo.
2. `GET /audits/{id}/findings`. **Esperado**: o achado criado aparece na página.
3. Compare com um achado criado por `POST /findings` (o caminho manual da Fase 1, inalterado).
   **Esperado**: `auditEngagementId: null` nesse achado — o caminho manual continua funcionando sem
   alteração (FR-008).

```sql
SELECT code, audit_engagement_id FROM findings ORDER BY created_at DESC LIMIT 2;
-- Esperado: uma linha com audit_engagement_id preenchido, uma com NULL.
```

---

## 4. `OPEN → IN_REMEDIATION` é genuinamente alcançável (SC-002) — o cenário que fecha a dívida da Fase 1

Este é o cenário que a especificação nomeia como prova obrigatória — "verificável pelo teste que a
exercita, não pela tabela de transições".

1. Um achado em `OPEN` (do cenário 3, ou qualquer outro).
2. `POST /findings/{id}/start-remediation`.
   **Esperado**: `200`, `status: "IN_REMEDIATION"`.

```sql
SELECT action, previous_values->>'status' AS de, new_values->>'status' AS para
FROM audit_event
WHERE entity_type = 'FINDING' AND entity_id = :findingId
ORDER BY occurred_at DESC LIMIT 1;
-- Esperado: action = 'finding.remediation_started', de = 'OPEN', para = 'IN_REMEDIATION'.
```

3. Tente a mesma chamada de novo, sobre o mesmo achado (agora `IN_REMEDIATION`).
   **Esperado**: `422` — a aresta só parte de `OPEN`.

**Falha que este cenário procura**: exatamente a que o cabeçalho de `finding.entity.ts` documentou
desde a Fase 1 — a aresta declarada na tabela sem nenhuma operação que a percorra. Antes desta
fase, o único jeito de ver `IN_REMEDIATION` era `CLOSED → IN_REMEDIATION` (reabertura). Este
cenário prova o caminho direto `OPEN → IN_REMEDIATION`, pela primeira vez.

---

## 5. Fechar exige evidência (FR-010, SC-003) — regra aditiva sobre a existente

1. Um achado `IN_REMEDIATION`, com uma ação vinculada `COMPLETED` (satisfaz a Invariante F1
   existente desde a Fase 1) mas **sem nenhuma evidência anexada**.
2. `POST /findings/{id}/close`.
   **Esperado**: `422` — recusado, apesar de F1 estar satisfeita. Esta é a mudança de comportamento
   que research.md D-6 relata explicitamente: F1 sozinha deixou de bastar.
3. Anexe uma evidência ao achado (`POST /evidence/{evidenceId}/links`, `subjectType: FINDING`).
4. `POST /findings/{id}/close` de novo.
   **Esperado**: `200`, `status: "CLOSED"`.
5. Arquive a evidência anexada (`POST /evidence/{evidenceId}/archive`) — sem desvincular.
6. Reabra o achado (`POST /findings/{id}/reopen`) e feche de novo.
   **Esperado**: `200` — evidência arquivada ainda sustenta o fechamento (o edge case do `spec.md`:
   "só a ausência total de evidência recusa").

```sql
-- Confirma que a checagem é sobre o VÍNCULO ativo, não sobre o status da evidência.
SELECT e.status AS evidence_status, el.unlinked_at
FROM evidence_links el JOIN evidence e ON e.id = el.evidence_id
WHERE el.subject_type = 'FINDING' AND el.subject_id = :findingId;
-- Esperado: evidence_status = 'ARCHIVED', unlinked_at IS NULL.
```

---

## 6. Segregação de funções no fechamento, exercida pelo produtor real (FR-011, SC-004)

Já existe desde a Fase 1 (Invariante F2); este cenário prova que o produtor novo a exercita de
verdade, não apenas o caminho manual.

1. Engajamento `IN_PROGRESS`. Achado produzido por ele, movido a `IN_REMEDIATION` (cenário 4).
2. Ação vinculada ao achado, com responsável **A**, completada por **A**.
3. Evidência anexada (pré-condição do cenário 5).
4. **A** tenta `POST /findings/{id}/close`.
   **Esperado**: `403` — quem remediou não pode fechar.

```sql
SELECT action, outcome FROM audit_event
WHERE action = 'finding.close_denied' AND entity_id = :findingId
ORDER BY occurred_at DESC LIMIT 1;
-- Esperado: 1 linha, outcome = 'DENIED' — a recusa é auditada, não só respondida.
```

5. **B** (não responsável pela ação completada) fecha o mesmo achado, com justificativa.
   **Esperado**: `200`.

---

## 7. Nenhuma operação exclui um achado, um engajamento ou um vínculo (FR-012, SC-005)

```bash
grep -in "delete" specs/005-audit-findings/contracts/audit.openapi.yaml
```

**Esperado**: as duas únicas ocorrências de `delete:` como verbo HTTP são
`unlinkFindingFromControl`/`unlinkFindingFromRisk` — ambas retornam `200` com o vínculo preservado
(`unlinkedAt` estampado), nunca `204`/corpo vazio, e nenhuma delas apaga uma linha de `findings`,
`audit_engagements` ou qualquer tabela de escopo. Não existe `DELETE /audits/{id}`,
`DELETE /findings/{id}` nem `DELETE /audits/{id}/scope/...` em lugar nenhum do arquivo.

```sql
-- Depois de todo o roteiro acima, toda linha criada continua existindo.
SELECT count(*) FROM findings; SELECT count(*) FROM audit_engagements;
SELECT count(*) FROM finding_control_links; SELECT count(*) FROM finding_risk_links;
-- Repita a mesma consulta antes de rodar unlinkFindingFromControl/unlinkFindingFromRisk e depois.
-- Esperado: a contagem de finding_control_links/finding_risk_links não muda — só unlinked_at.
```

---

## 8. Escopo organizacional não vaza, nos cinco pares novos (FR-014, FR-015, FR-018, SC-006)

Com um ator cujo escopo **não** cobre a unidade organizacional do alvo, para cada um dos cinco
pares que este módulo introduz:

| Par | Operação | Alvo fora de escopo |
|---|---|---|
| Audit → Control (escopo) | `POST /audits/{id}/scope/controls` | Controle de outra unidade |
| Finding → Control | `POST /findings/{id}/controls` | idem |
| Finding → Risk | `POST /findings/{id}/risks` | Risco de outra unidade |
| — engajamento em si | `GET /audits/{id}` | Engajamento de outra unidade |
| — achado em si | `GET /findings/{id}` | Achado de outra unidade |

**Esperado, em todos os cinco**: resposta idêntica à de um alvo inexistente (`422` nomeando o
campo, para os três primeiros; `404`, para os dois últimos) — nunca `403`. E, para os três
primeiros, **nenhuma linha gravada**:

```sql
SELECT count(*) FROM audit_scope_controls WHERE audit_engagement_id = :auditId;
SELECT count(*) FROM finding_control_links WHERE finding_id = :findingId;
SELECT count(*) FROM finding_risk_links WHERE finding_id = :findingId;
-- Rode antes e depois de cada tentativa recusada. Esperado: contagem idêntica.
```

**Falha que este cenário procura**: exatamente o gap que a correção de 2026-09-08 do ADR-020 fechou
para os dois pares anteriores (Risco→Controle, Compliance→Controle) — descoberto depois de dois
consumidores relatarem a parte 5 como satisfeita sem ela estar. Este módulo aplica a checagem desde
o primeiro vínculo; este cenário é a prova.

---

## 9. As cinco partes do ADR-020, verificadas juntas (research.md D-11)

Para o par `Finding → Control`: um ator com `finding:link` mas **sem** `control:view`.

1. `POST /findings/{id}/controls` com um `controlId` válido, dentro do escopo do ator.
   **Esperado**: `422` — a ausência de `control:view` produz a MESMA resposta que um controle
   inexistente (não `403`), a forma que a correção de 2026-09-08 estabeleceu para os dois pares
   anteriores.

Repita para `Finding → Risk` (`risk:view` ausente) e para os três vínculos de escopo do engajamento
(`compliance:view`/`control:view` ausente).

```sql
SELECT r.name FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.identifier IN ('finding:link', 'audit-engagement:scope')
GROUP BY r.name
HAVING NOT bool_or(EXISTS (
  SELECT 1 FROM role_permissions rp2 JOIN permissions p2 ON p2.id = rp2.permission_id
  WHERE rp2.role_id = rp.role_id AND p2.identifier IN ('control:view', 'risk:view', 'compliance:view')
));
-- Esperado: nenhuma linha — nenhum papel semeado tem a autoridade de vincular sem a autoridade de
-- ver o que está vinculando (a mesma dupla garantia que `control-link-permission-pairing.spec.ts`
-- já cobra dos pares anteriores).
```

---

## 10. Riscos, Controles e Compliance continuam passando sem alteração (SC-007)

```bash
pnpm --filter @vertice/api test -- risk
pnpm --filter @vertice/api test -- controls
pnpm --filter @vertice/api test -- compliance
```

**Esperado**: as três suítes passam com a MESMA contagem de testes de antes desta fase — nenhum
arquivo de teste desses três módulos foi tocado. Se algum precisou mudar, é regressão a investigar,
não ajuste a aceitar (research.md, tabela de riscos).

---

## 11. Fronteira de módulo — nenhum import cruzado (FR-017, SC-008)

```bash
grep -rn "from '.*modules/risk" apps/api/src/modules/audit-engagements
grep -rn "from '.*modules/controls" apps/api/src/modules/audit-engagements
grep -rn "from '.*modules/compliance" apps/api/src/modules/audit-engagements
grep -rn "from '.*modules/audit-engagements" apps/api/src/modules/risk apps/api/src/modules/controls apps/api/src/modules/compliance
grep -rn "from '.*modules/" apps/api/src/grc/finding
```

**Esperado**: toda busca vazia, exceto a última — que também deve vir vazia (`grc/finding`
depende de `RiskDirectoryPort`/`ControlDirectoryPort`, ambos em `shared/grc-ports/`, nunca de
`modules/risk`/`modules/controls` diretamente). Rode também o teste de fronteira dedicado:

```bash
pnpm --filter @vertice/api test -- module-boundary
```
