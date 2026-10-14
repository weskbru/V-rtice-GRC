# Quickstart — Gestão de Ativos e Gestão de Processos

Roteiro de validação executável. Prova que os dois domínios promovidos funcionam ponta a ponta e
que os dois vazamentos de escopo medidos na especificação estão de fato fechados — não que o
código compila.

Pré-requisitos: PostgreSQL local com o banco semeado, API e web em execução (build de produção,
não `dev --watch` — plan.md), e usuários com os papéis necessários (`Risk Manager` para preparar
fixtures de risco, `Control Owner` para vínculos de controle, `Platform Administrator` para criar
unidades organizacionais e usuários de teste com escopo restrito). Ver
`specs/001-grc-platform-foundation/quickstart.md` para o preparo do ambiente, que não muda nesta
fase.

Convenção usada abaixo: `$API` é a raiz da API (`http://localhost:3001/api/v1`), `cookies.txt` é o
cookie de sessão de um ator escopado globalmente (ex.: `Platform Administrator`), e
`cookiesA.txt`/`cookiesB.txt` são sessões de atores cujo escopo cobre apenas a unidade A ou a
unidade B, respectivamente — criados no §0 abaixo.

---

## 0. Pré-condições

```bash
pnpm --filter @vertice/api exec prisma migrate deploy   # migração aditiva desta fase (AuditEntityType += ASSET, PROCESS) — F-51/D-25: a correção anterior (`db:migrate`) trocou um script inexistente por um que roda `prisma migrate dev`, proibido contra banco real por schema.prisma:57-72
pnpm --filter @vertice/api run db:seed          # oito permissões novas; papéis atualizados; unidade nas fixtures
```

Confirme que as oito permissões novas entraram — se não estiverem, nenhum cenário abaixo passa:

```sql
SELECT identifier FROM permissions
WHERE identifier LIKE 'asset:%' OR identifier LIKE 'process:%'
ORDER BY identifier;
-- Esperado: 8 linhas — asset:{administer,create,edit,view}, process:{administer,create,edit,view}
-- (ordem alfabética).
```

Confirme que **nenhum papel perdeu acesso ao inventário** (spec Assumption A-6, research.md D-7).
Hoje, medido em `platform.seed.ts` em 2026-09-08, os papéis com `risk:view` são `Risk Manager`,
`Risk Analyst`, `Risk Approver`, `Auditor`, `Read Only` e `Audit Lead`. Todo papel dessa lista
precisa também ter `asset:view` e `process:view` depois da semeadura:

```sql
SELECT r.name
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.identifier = 'risk:view'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp2
    JOIN permissions p2 ON p2.id = rp2.permission_id
    WHERE rp2.role_id = rp.role_id AND p2.identifier = 'asset:view'
  );
-- Esperado: nenhuma linha. Repita substituindo 'asset:view' por 'process:view' — mesma
-- expectativa. Esta é exatamente a classe de defeito do papel "Audit Lead" da fase anterior:
-- autoridade de leitura ausente onde o papel já dependia dela para enxergar o inventário.
```

Confirme também a correção do **defeito de US2**: `Control Owner` não tem `risk:view` hoje e por
isso não conseguia listar o inventário para o próprio seletor de vínculo. Depois da semeadura, ele
precisa ter `asset:view`/`process:view` **diretamente**, sem depender de `risk:view`:

```sql
SELECT p.identifier
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'Control Owner' AND p.identifier IN ('asset:view', 'process:view')
ORDER BY p.identifier;
-- Esperado: 2 linhas. Se vier vazio, o defeito que a US2 existe para corrigir continua aberto.
```

Confirme que as duas linhas de fixture (`FIXTURE-ASSET-1`, `FIXTURE-PROCESS-1`) receberam unidade
organizacional na mesma semeadura (research.md D-2, "consequência aceita"):

```sql
SELECT code, org_unit_id FROM assets WHERE code = 'FIXTURE-ASSET-1';
SELECT code, org_unit_id FROM processes WHERE code = 'FIXTURE-PROCESS-1';
-- Esperado: org_unit_id preenchido nas duas — não mais NULL. Se vier NULL, as duas fixtures
-- ficarão invisíveis a qualquer ator escopado por unidade assim que o §4 abaixo for exercido, e
-- qualquer teste que dependa de vê-las quebra por essa razão, não por regressão real.
```

Prepare dois atores de teste, um por unidade, para os §4 e §5:

```bash
# Como Platform Administrator (cookies.txt): crie duas unidades organizacionais, se ainda não
# existirem, e um usuário escopado a cada uma, com um papel que tenha asset:view/process:view/
# risk:edit (ex.: Risk Manager). Anote os dois ids de unidade ($ORGUNIT_A, $ORGUNIT_B) e faça
# login como cada um deles, salvando cookiesA.txt/cookiesB.txt.
```

### 0.1 Não existe `If-Match` nesta API — não introduza um ao seguir este roteiro

**Ativo e Processo não têm coluna `version`** (verificado em `prisma/schema.prisma` — data-model.md
§1). Ao contrário de `Control` e `AuditEngagement`, nenhuma operação de
`assets.openapi.yaml`/`processes.openapi.yaml` declara um parâmetro `If-Match`, nenhuma resposta
declara `ETag`, e não existe resposta `409` de conflito de versão em lugar nenhum destes dois
contratos. `PATCH /assets/{id}`, `.../deactivate` e `.../reactivate` (e os equivalentes de
`/processes`) aceitam a escrita diretamente, sem cabeçalho de concorrência algum.

Isto é registrado aqui porque é o oposto exato da lição que o quickstart da fase anterior deixou
(`specs/005-audit-findings/quickstart.md` §0.1): lá, um cabeçalho **obrigatório** foi omitido do
roteiro e produziu um `400` que parecia defeito. Aqui, o risco é o inverso — copiar por hábito o
padrão de Controles/Auditoria e **enviar** um `If-Match` que esta API nunca pede. Confirme que a
omissão é o comportamento correto:

```bash
curl -sD - -o /dev/null -X PATCH "$API/assets/$AID" -b cookies.txt \
  -H 'Content-Type: application/json' -d '{"description":"Descrição atualizada"}' | head -1
# Esperado: HTTP/1.1 200 OK — sem cabeçalho If-Match algum na requisição.
```

Se uma implementação futura passar a exigir `If-Match` aqui, é uma divergência do contrato
(`assets.openapi.yaml`/`processes.openapi.yaml`), não uma correção a aplicar ao roteiro — confira o
contrato antes de mudar este arquivo.

---

## 1. Cadastrar um ativo e um processo, com o código gerado (FR-002, SC-001)

```bash
curl -s -X POST "$API/assets" -b cookies.txt -H 'Content-Type: application/json' \
  -d "{\"name\":\"Servidor de banco de dados — produção\",\"description\":\"Hospeda o PostgreSQL de produção\",\"orgUnitId\":\"$ORGUNIT_A\"}"
```

**Esperado**: `201`, cabeçalho `Location: /api/v1/assets/{id}`, corpo com `code` no formato
`AST-2026-NNNN` (ano corrente, sequência com no mínimo 4 dígitos), `isActive: true`, `risks: []`,
`controls: []`.

```bash
curl -s -X POST "$API/processes" -b cookies.txt -H 'Content-Type: application/json' \
  -d "{\"name\":\"Aprovação de pagamentos a fornecedores\",\"orgUnitId\":\"$ORGUNIT_A\"}"
```

**Esperado**: `201`, `code` no formato `PRC-2026-NNNN`. `description` é opcional — omitida aqui, o
corpo devolve `description: null`.

Tente enviar `code` no corpo de qualquer um dos dois:

```bash
curl -s -X POST "$API/assets" -b cookies.txt -H 'Content-Type: application/json' \
  -d "{\"name\":\"X\",\"orgUnitId\":\"$ORGUNIT_A\",\"code\":\"AST-9999-0001\"}"
```

**Esperado**: `400` — `code` é propriedade desconhecida, rejeitada pelo pipe de validação global
(invariante A6). Nenhum ativo é criado com esse `code`.

Tente criar sem `orgUnitId`:

```bash
curl -s -X POST "$API/assets" -b cookies.txt -H 'Content-Type: application/json' -d '{"name":"Y"}'
```

**Esperado**: `400` — `orgUnitId` é obrigatório (invariante A1).

```sql
SELECT code, name, org_unit_id, is_active FROM assets ORDER BY created_at DESC LIMIT 1;
SELECT code, name, org_unit_id, is_active FROM processes ORDER BY created_at DESC LIMIT 1;
```

**Falha que este cenário procura**: hoje isto é impossível pelo produto — o inventário só existe
por inserção manual no banco ou semeadura (SC-001).

---

## 2. Nome não é identidade (invariante A3, US1 cenário 5)

```bash
curl -s -X POST "$API/assets" -b cookies.txt -H 'Content-Type: application/json' \
  -d "{\"name\":\"Firewall perimetral\",\"orgUnitId\":\"$ORGUNIT_A\"}"
curl -s -X POST "$API/assets" -b cookies.txt -H 'Content-Type: application/json' \
  -d "{\"name\":\"Firewall perimetral\",\"orgUnitId\":\"$ORGUNIT_B\"}"
```

**Esperado**: dois `201`, dois `id` distintos, dois `code` distintos e sequenciais, mesmo `name`.
Nenhuma restrição de unicidade sobre `name` existe.

```sql
SELECT id, code, org_unit_id FROM assets WHERE name = 'Firewall perimetral';
-- Esperado: 2 linhas.
```

---

## 3. Desativar → vínculo novo recusado → legível e visível nos vínculos existentes → reativar
   (FR-005, FR-006, SC-007)

Use o ativo do cenário 1 (`$AID`) e um risco já existente na unidade A (`$RID`, com `If-Match`
`$RISK_ETAG` lido de `GET /risks/$RID`).

1. Vincule o ativo ao risco **antes** de desativar, para provar depois que o vínculo sobrevive:

```bash
curl -s -X POST "$API/risks/$RID/assets" -b cookies.txt \
  -H "If-Match: $RISK_ETAG" -H 'Content-Type: application/json' -d "{\"id\":\"$AID\"}"
```

**Esperado**: `201`. Releia o `ETag` do risco (mudou).

2. Desative o ativo:

```bash
curl -s -X POST "$API/assets/$AID/deactivate" -b cookies.txt
```

**Esperado**: `200`, `isActive: false`. Nenhum `If-Match` enviado nem pedido (§0.1).

3. Tente vincular este mesmo ativo, agora inativo, a **outro** risco:

```bash
curl -s -X POST "$API/risks/$RID2/assets" -b cookies.txt \
  -H "If-Match: $RISK2_ETAG" -H 'Content-Type: application/json' -d "{\"id\":\"$AID\"}"
```

**Esperado**: `422` — ativo inativo não aceita vínculo novo (invariante A5, regra já vigente em
`asset-link.usecase.ts` desde antes desta fase).

4. Confirme que o ativo continua integralmente legível:

```bash
curl -s "$API/assets/$AID" -b cookies.txt
```

**Esperado**: `200`, mesmo com `isActive: false`.

5. Confirme que o vínculo criado no passo 1 (**antes** da desativação) continua visível:

```bash
curl -s "$API/assets/$AID" -b cookies.txt | jq '.risks'
curl -s "$API/risks/$RID/assets" -b cookies.txt
```

**Esperado**: o risco `$RID` aparece nos dois — nada foi desfeito pela desativação.

6. Tente desativar de novo:

```bash
curl -s -X POST "$API/assets/$AID/deactivate" -b cookies.txt
```

**Esperado**: `422` — já está inativo. Nada muda.

7. Reative:

```bash
curl -s -X POST "$API/assets/$AID/reactivate" -b cookies.txt
```

**Esperado**: `200`, `isActive: true`. Vincule a `$RID2` de novo — agora aceita (`201`).

```sql
SELECT action, previous_values->>'isActive' AS de, new_values->>'isActive' AS para
FROM audit_event WHERE entity_type = 'ASSET' AND entity_id = :assetId
ORDER BY occurred_at DESC LIMIT 2;
-- Esperado: 2 linhas — 'asset.reactivated' (de false para true) e 'asset.deactivated' (de true
-- para false), ambas com ator e data. Para o Processo, troque ASSET/asset.* por
-- PROCESS/process.*.
```

Repita os sete passos para `Process`/`$PID`, contra `POST/GET /risks/{riskId}/processes`.

---

## 4. Vazamento de leitura fechado — escopo aplicado na listagem (FR-010, SC-003b)

Como `cookies.txt` (escopo global), crie um ativo na unidade B:

```bash
curl -s -X POST "$API/assets" -b cookies.txt -H 'Content-Type: application/json' \
  -d "{\"name\":\"Ativo exclusivo da unidade B\",\"orgUnitId\":\"$ORGUNIT_B\"}"
# Anote o id como $AID_B.
```

Como o ator escopado **apenas** à unidade A (`cookiesA.txt`):

```bash
curl -s "$API/assets?pageSize=100" -b cookiesA.txt | jq '{total: .meta.total, orgUnits: [.data[].orgUnit.id] | unique}'
```

**Esperado**: `orgUnits` não contém `$ORGUNIT_B`; `$AID_B` não aparece em `data`; `meta.total` conta
apenas os ativos da unidade A (e os sem unidade, que são invisíveis a escopo por unidade — vide
§0). Repita para `/processes`.

Confirme que a leitura direta do registro também fecha, não apenas a listagem:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$API/assets/$AID_B" -b cookiesA.txt
```

**Esperado**: `404` — nunca `403`. O ator não tem como distinguir "existe, mas não é meu" de "não
existe".

**Falha que este cenário procura**: hoje (antes desta fase) `GET /assets` não aplica escopo algum
e devolveria `$AID_B` para qualquer ator com `risk:view` — este é exatamente o "Vazamento 1" medido
em spec.md.

---

## 5. Vazamento de escrita fechado — vínculo contra alvo fora de escopo (FR-011, SC-003)

Com o ator da unidade A (`cookiesA.txt`) e um risco `$RID_A` da unidade A, tente vincular o ativo
`$AID_B` (unidade B, do cenário 4):

```sql
SELECT count(*) FROM risk_asset_links WHERE risk_id = :ridA;
-- Anote o valor ANTES da tentativa.
```

```bash
curl -s -X POST "$API/risks/$RID_A/assets" -b cookiesA.txt \
  -H "If-Match: $RID_A_ETAG" -H 'Content-Type: application/json' -d "{\"id\":\"$AID_B\"}"
```

**Esperado**: `422`, corpo nomeando o campo `id` como "não encontrado" — **a mesma resposta**,
byte a byte no `type`/`title`, que uma tentativa contra um `id` de ativo inteiramente inexistente
produziria. Nunca `403` (o ator até tem `risk:edit`/`asset:view` — o alvo é que está fora de
escopo, e isso não pode ser distinguível de "não existe").

```sql
SELECT count(*) FROM risk_asset_links WHERE risk_id = :ridA;
-- Esperado: idêntico ao valor de antes. Nenhuma linha foi gravada.
```

Repita com um processo de outra unidade contra `POST /risks/{riskId}/processes` — mesma
expectativa (`risk_process_links` sem alteração de contagem).

Confirme também o lado da permissão (US3 cenário 4): um ator com `risk:edit` mas **sem**
`asset:view` tentando vincular um ativo **dentro** do seu próprio escopo:

```sql
-- Verifique que nenhum papel semeado tem risk:edit sem asset:view/process:view (a mesma classe
-- de guarda que control-link-permission-pairing.spec.ts já aplica aos pares existentes).
SELECT r.name
FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.identifier = 'risk:edit'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp2
    JOIN permissions p2 ON p2.id = rp2.permission_id
    WHERE rp2.role_id = rp.role_id AND p2.identifier = 'asset:view'
  );
-- Esperado: nenhuma linha.
```

**Falha que este cenário procura**: exatamente o gap que a "correção 2" do ADR-020 (F-46) fechou
para Risco→Controle no mesmo diretório, no mesmo dia, e deixou aberto para estes dois irmãos —
`asset-link.usecase.ts`/`process-link.usecase.ts` tinham **zero** verificações de escopo sobre o
alvo antes desta fase (spec.md, "Contexto medido").

Confirme, por fim, que um vínculo Risco→Ativo entre unidades diferentes, criado **antes** desta
fase, continua legível (não é apagado nem escondido pela correção):

```sql
-- Se existir um vínculo assim nos dados de desenvolvimento, confirme que GET /risks/{id}/assets
-- ainda o retorna normalmente, como qualquer outro.
```

---

## 6. Nenhuma exclusão existe, em lugar nenhum (FR-012, SC-004)

```bash
grep -in "delete:" specs/006-assets-processes/contracts/assets.openapi.yaml
grep -in "delete:" specs/006-assets-processes/contracts/processes.openapi.yaml
```

**Esperado**: nenhuma ocorrência em nenhum dos dois arquivos — nem como verbo HTTP de operação. Não
existe `DELETE /assets/{id}` nem `DELETE /processes/{id}` em lugar nenhum. As únicas duas
transições de estado são `.../deactivate` e `.../reactivate`, ambas `POST`, e nenhuma remove linha.

```bash
grep -rn "prisma.asset.delete\|prisma.process.delete" apps/api/src/modules/assets apps/api/src/modules/processes
```

**Esperado**: vazio — nem a implementação chama `delete` sobre estas duas tabelas.

```sql
SELECT count(*) FROM assets; SELECT count(*) FROM processes;
SELECT count(*) FROM risk_asset_links; SELECT count(*) FROM risk_process_links;
SELECT count(*) FROM control_asset_links; SELECT count(*) FROM control_process_links;
-- Rode antes de começar este roteiro e de novo ao final. Esperado: toda contagem só cresce
-- (novas linhas dos cenários 1-3) ou permanece igual (cenários 4-5, que não gravam) — nunca
-- diminui.
```

---

## 7. Riscos, Controles, Compliance e Auditoria continuam passando sem alteração (SC-006)

```bash
pnpm --filter @vertice/api test -- risk
pnpm --filter @vertice/api test -- controls
pnpm --filter @vertice/api test -- compliance
pnpm --filter @vertice/api test -- audit
```

**Esperado**: as quatro suítes passam com a **mesma contagem** de testes de antes desta fase,
exceto os testes que precisaram mudar especificamente por causa do fechamento do vazamento de
escrita (FR-011) — e cada um desses cita FR-011 explicitamente no próprio teste ou no commit, nunca
uma mudança silenciosa. Qualquer outra alteração nessas quatro suítes é regressão a investigar, não
ajuste a aceitar (plan.md, tabela de riscos).

```bash
pnpm --filter @vertice/api test -- module-boundary
```

**Esperado**: passa — `modules/risk` e `modules/controls` consomem `AssetDirectoryPort`/
`ProcessDirectoryPort` a partir de `shared/grc-ports/`, nunca lendo `prisma.asset`/`prisma.process`
diretamente (research.md D-6, FR-021):

```bash
grep -rn "prisma\.asset\.\|prisma\.process\." apps/api/src/modules/risk apps/api/src/modules/controls
```

**Esperado**: vazio. As duas leituras diretas que existiam antes desta fase
(`reference-registry-lookup.repository.ts` em `modules/controls`,
`prisma-registry.repository.ts` em `modules/risk`) deixaram de existir.
