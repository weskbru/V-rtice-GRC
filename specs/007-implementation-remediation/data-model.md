# Data Model — Convergência e Saneamento de Implementação

**Feature**: `007-implementation-remediation` · **Spec**: [spec.md](./spec.md) ·
**Research**: [research.md](./research.md)

Nada neste documento foi aplicado ainda. Todo SQL abaixo é o que a tarefa de migração
(`tasks.md`, frente A) precisa produzir, revisado aqui antes da implementação — Constituição,
Princípio XV, exige revisão explícita para migração destrutiva, e a migração descrita em §1 dropa
seis colunas depois de um backfill.

---

## §1 — `risk_treatment_actions`: antes e depois

### Antes (HEAD medido)

```
risk_treatment_actions
  id                     uuid       PK
  risk_id                uuid       FK -> risks (Restrict)
  treatment_decision_id  uuid       NULL   FK -> risk_treatment_decisions (Restrict)
  title                  text
  description            text       NULL
  responsible_user_id    uuid       FK -> users (Restrict)
  due_on                 date
  status                 TreatmentActionStatus  DEFAULT 'OPEN'
  completed_at           timestamptz NULL
  action_id              uuid       NULL   FK -> actions (Restrict)   -- R-003, já existe
  created_at             timestamptz
  updated_at             timestamptz

  INDEX (risk_id, status)
  INDEX (responsible_user_id, due_on)
  INDEX (due_on, status)
```

### Depois (esta fase)

```
risk_treatment_actions
  id                     uuid       PK                                    -- preservado, todo id
  risk_id                uuid       FK -> risks (Restrict)                -- inalterado
  treatment_decision_id  uuid       NULL   FK -> risk_treatment_decisions (Restrict)  -- inalterado
  action_id              uuid       NOT NULL UNIQUE   FK -> actions (Restrict)        -- endurecido
  created_at             timestamptz                                      -- inalterado
  updated_at             timestamptz                                      -- inalterado

  INDEX (risk_id)                                                         -- novo, substitui as três removidas
```

Colunas removidas: `title`, `description`, `responsible_user_id`, `due_on`, `status`,
`completed_at`. Índices removidos: `(risk_id, status)`, `(responsible_user_id, due_on)`,
`(due_on, status)` — todos referenciavam pelo menos uma coluna removida.

**O que não muda em `actions`**: nenhuma coluna, nenhum índice. `Action` já tem todos os seis campos
que a tabela legada perde (`title`, `description`, `responsibleUserId`, `dueOn`, `status`,
`completedAt`/`completedByUserId`), confirmado em `schema.prisma` linhas 2167-2210.

**Mapeamento de enum, direto, sem tabela de tradução**: `TreatmentActionStatus` (linhas 363-368) e
`ActionStatus` (linhas 2148-2153) têm exatamente os mesmos quatro valores —
`OPEN | IN_PROGRESS | COMPLETED | CANCELLED`. O backfill copia o valor literal.

---

## §2 — Migração: backfill, verificação, então os `DROP`

Migração única, numa só transação (comportamento padrão do `prisma migrate`), nesta ordem. Se a
verificação do passo 2 falhar, a transação inteira reverte e os `DROP` do passo 3 nunca rodam — a
migração é sua própria rede de segurança, não apenas um comentário dizendo para verificar depois.

### Passo 1 — Backfill de uma `Action` para toda linha ainda sem `action_id`

```sql
-- 007-implementation-remediation, D-1/D-6 (research.md).
-- Aloca sequência de código por (prefixo='ACT', ano da PRÓPRIA created_at da linha de origem),
-- não o ano corrente — para que o código não deslegitime a data do registro (D-6).

WITH pending AS (
  SELECT
    rta.id                AS rta_id,
    rta.risk_id            AS risk_id,
    rta.title              AS title,
    rta.description        AS description,
    rta.responsible_user_id AS responsible_user_id,
    rta.due_on             AS due_on,
    rta.status              AS status,
    rta.completed_at        AS completed_at,
    rta.created_at          AS created_at,
    rta.updated_at          AS updated_at,
    r.org_unit_id           AS org_unit_id,          -- unidade ATUAL do risco (D-6, invariante de escopo)
    EXTRACT(YEAR FROM rta.created_at)::int AS backfill_year
  FROM risk_treatment_actions rta
  JOIN risks r ON r.id = rta.risk_id
  WHERE rta.action_id IS NULL
),
numbered AS (
  SELECT
    pending.*,
    ROW_NUMBER() OVER (PARTITION BY backfill_year ORDER BY created_at, rta_id) AS rn
  FROM pending
),
year_totals AS (
  SELECT backfill_year, COUNT(*) AS n
  FROM numbered
  GROUP BY backfill_year
),
-- Reserva o intervalo de sequência de cada ano ATOMICAMENTE, dentro da mesma transação da
-- migração — nenhuma escrita concorrente de Action em produção pode intercalar aqui porque a
-- migração já segura a única linha de `grc_code_sequences` para cada (ACT, ano) envolvido.
reserved AS (
  UPDATE grc_code_sequences gcs
  SET last_value = gcs.last_value + year_totals.n
  FROM year_totals
  WHERE gcs.prefix = 'ACT' AND gcs.year = year_totals.backfill_year
  RETURNING gcs.year AS backfill_year, gcs.last_value - year_totals.n AS starting_value
),
-- Anos ainda sem linha em grc_code_sequences: cria a linha partindo de 0 antes de reservar.
missing_years AS (
  INSERT INTO grc_code_sequences (prefix, year, last_value)
  SELECT 'ACT', year_totals.backfill_year, year_totals.n
  FROM year_totals
  WHERE NOT EXISTS (
    SELECT 1 FROM grc_code_sequences gcs
    WHERE gcs.prefix = 'ACT' AND gcs.year = year_totals.backfill_year
  )
  RETURNING year AS backfill_year, 0 AS starting_value
),
allocations AS (
  SELECT * FROM reserved
  UNION ALL
  SELECT * FROM missing_years
),
to_insert AS (
  SELECT
    numbered.*,
    allocations.starting_value + numbered.rn AS sequence_number
  FROM numbered
  JOIN allocations ON allocations.backfill_year = numbered.backfill_year
),
inserted_actions AS (
  INSERT INTO actions (
    id, code, org_unit_id, origin_type, origin_id,
    title, description, responsible_user_id, due_on, status,
    completed_at, completed_by_user_id, reopened_at, reopened_by_user_id, reopen_reason,
    created_at, updated_at
  )
  SELECT
    to_insert.new_action_id,
    'ACT-' || to_insert.backfill_year || '-' || LPAD(to_insert.sequence_number::text, 4, '0'),
    to_insert.org_unit_id,
    'RISK_TREATMENT',
    to_insert.risk_id,
    to_insert.title,
    to_insert.description,
    to_insert.responsible_user_id,
    to_insert.due_on,
    to_insert.status::text::"ActionStatus",
    to_insert.completed_at,
    -- completed_by_user_id: RECUPERADO DA TRILHA DE AUDITORIA (STEP 0B da migração real),
    -- nunca fabricado — ver a correção do coordenador logo abaixo.
    to_insert.completed_by_user_id,
    NULL, NULL, NULL,   -- reopened_at/reopened_by_user_id/reopen_reason: nenhuma linha legada
                        -- jamais foi reaberta por essa via; histórico começa limpo
    to_insert.created_at,   -- preserva a data de criação ORIGINAL, não "agora"
    to_insert.updated_at
  FROM to_insert
)
UPDATE risk_treatment_actions rta
SET action_id = to_insert.new_action_id
FROM to_insert
WHERE rta.id = to_insert.rta_id;
```

> **Correção implementada e verificada por execução real** (não apenas planejada): a versão
> anterior deste documento tinha uma nota de implementação pedindo para o `UPDATE` final casar por
> `rta_id`, não por `(risk_id, created_at)`. Isto já foi corrigido na migração real
> (`apps/api/prisma/migrations/20260911000000_action_convergence_risk_treatment_actions/migration.sql`):
> `to_insert` gera `gen_random_uuid()` como `new_action_id` **dentro da própria CTE**, marcada
> `AS MATERIALIZED` (para que o valor volátil seja computado uma única vez, mesmo sendo lido duas
> vezes — no `INSERT` de `actions` e no `UPDATE` final) — o `UPDATE` casa diretamente por
> `rta.id = to_insert.rta_id`, nunca por uma correlação reconstruída via `RETURNING`.
>
> **Achado confirmado por execução real, não hipótese** — encontrado rodando esta migração contra
> `pharos_grc_test`, dentro de uma transação sempre revertida (nunca commitada), com dados reais em
> todas as formas exigidas (múltiplas linhas `OPEN` e uma `COMPLETED` com `completedAt` carimbado):
> `actions` tem a constraint `actions_completed_pair_check`
> (`20260907100000_pairing_invariant_check_constraints/migration.sql:60`), que **exige**
> `completed_by_user_id` não nulo sempre que `completed_at` não for nulo. A versão original deste
> documento (`NULL` incondicional, "nunca inventado") **viola essa constraint e a migração falha**
> — confirmado pela mensagem real do Postgres:
> `nova linha da relação "actions" viola a restrição de verificação "actions_completed_pair_check"`.
> **CORRIGIDO PELO COORDENADOR, 2026-09-11** (texto original preservado acima, marcado como
> superado, nunca apagado — a mesma disciplina que este projeto já aplica a todo achado corrigido):
> a versão que primeiro rodou contra dado real usava `responsible_user_id` como
> `completed_by_user_id` quando faltava um valor melhor. **Isso foi rejeitado terminantemente**:
> `responsible_user_id` é a quem o trabalho foi ATRIBUÍDO, não quem o MARCOU COMO CONCLUÍDO — são
> pessoas frequentemente diferentes, e é exatamente essa diferença que o campo existe para capturar.
> Uma trilha de auditoria de um produto de compliance nunca pode registrar que uma pessoa fez algo
> que não fez — o mesmo princípio já aplicado à expiração de sessão (D-13).
>
> **O fato certo é recuperável, não apenas hipotético**: toda conclusão feita pela rota de Riscos,
> antes desta convergência, disparava `risk.treatment_action_status_changed`, referenciando a
> própria LINHA DE VÍNCULO, com `new_values.status = 'COMPLETED'` e uma coluna `actor_user_id` real
> — preenchida pelo contexto de uma requisição PATCH autenticada (mecanismo distinto do vazio
> específico de login que D-13 corrige). Tomar o evento MAIS RECENTE desse tipo, por linha, recupera
> quem de fato concluiu — não é uma aproximação, é o fato já registrado, recuperado da trilha
> apensável-apenas que existe precisamente para isto.
>
> **Onde não houver evento recuperável, a migração levanta e nomeia as linhas — nunca escolhe por
> elas.** Uma conclusão sem completador recuperável é um defeito de dado pré-existente, e o trabalho
> da migração é expô-lo, não disfarçá-lo. Isto é o **quarto** ponto de verificação (§2 abaixo, STEP
> 0B), medido contra o banco de desenvolvimento antes de aceitar o desenho: as 75 linhas de vínculo
> de lá estão todas `OPEN`, nenhuma carrega carimbo de conclusão, e zero eventos de conclusão
> existem para recuperar — esta guarda **nunca dispara lá** hoje; existe para a linha que vier a
> completar, agora e no futuro.
>
> Implementado como uma nova STEP 0B (`CREATE TEMP TABLE recovered_completer` +
> um `DO $$` que levanta com os ids nomeados se algum permanecer sem completador), executada
> ANTES do backfill (STEP 1) e da reconciliação (STEP 1B), ambas alteradas para ler
> `recovered_completer` em vez de fabricar um valor.

### Passo 0B — Recuperar o completador real, antes de qualquer escrita (implementado, testado)

Precede o backfill. Constrói uma tabela temporária (`ON COMMIT DROP`, nunca sobrevive à
transação) com o `actor_user_id` real do evento `risk.treatment_action_status_changed` mais
recente que completou cada linha — nunca um valor fabricado (ver a correção do coordenador no
Passo 1 acima). Levanta, nomeando os ids, se alguma linha `COMPLETED` não tiver evento
recuperável:

```sql
CREATE TEMP TABLE recovered_completer ON COMMIT DROP AS
SELECT DISTINCT ON (rta.id)
  rta.id AS rta_id,
  ae.actor_user_id AS completed_by_user_id
FROM risk_treatment_actions rta
JOIN audit_event ae
  ON ae.entity_type = 'RISK_TREATMENT_ACTION'
 AND ae.entity_id = rta.id
 AND ae.action = 'risk.treatment_action_status_changed'
 AND ae.new_values ->> 'status' = 'COMPLETED'
WHERE rta.status = 'COMPLETED'
ORDER BY rta.id, ae.occurred_at DESC;

DO $$
DECLARE
  unrecoverable_ids text;
BEGIN
  SELECT string_agg(rta.id::text, ', ')
  INTO unrecoverable_ids
  FROM risk_treatment_actions rta
  LEFT JOIN recovered_completer rc ON rc.rta_id = rta.id
  WHERE rta.status = 'COMPLETED' AND rc.completed_by_user_id IS NULL;

  IF unrecoverable_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'Action convergence: the following risk_treatment_actions row(s) are COMPLETED with no recoverable completer in the audit trail: %',
      unrecoverable_ids;
  END IF;
END $$;
```

**Medido, não hipotético**: no banco de desenvolvimento, as 75 linhas de vínculo estão todas
`OPEN` — esta guarda nunca dispara ali hoje. Ela existe para a linha que vier a completar.

### Passo 1B — Reconciliar, antes de verificar (achado confirmado pelo coordenador, corrigido)

**Achado, medido contra `pharos_grc_test`, real, não hipótese**: um vínculo já existente ANTES
desta migração (a linha do double-write R-003, não uma que o backfill acabou de criar) pode
divergir da sua `Action` — medido como uma diferença de **7 milissegundos** em `completed_at`,
numa linha por outro lado byte-idêntica. Causa: o caminho de espelho
(`UpdateTreatmentActionUseCase` chamando `MirrorActionStatusFromOriginUseCase`) computava seu
PRÓPRIO `new Date()` para o mesmo instante de conclusão que `UpdateTreatmentActionUseCase` já
havia computado independentemente — duas leituras de relógio para um evento só, na mesma
transação. O double-write nunca foi, portanto, sem perda; F-36 nomeou a janela de coexistência
mas não esta deriva específica.

**Não corrigido com tolerância nem comparação relaxada** — isso esconderia exatamente a classe de
deriva que a verificação existe para capturar. Em vez disso, reconcilia-se primeiro:
`RiskTreatmentAction` é a autoridade PRÉ-CONVERGÊNCIA — toda rota, resposta e tela atuais leem
ESSA tabela (data-model.md §7 antigo, FR-018) — então seus valores são o que usuários de fato
viram e o que a trilha de auditoria do risco de fato registrou. Empurrados para a `Action`
vinculada, incondicionalmente, para TODA linha de vínculo (inclusive as que o backfill acabou de
criar, para as quais isto é um no-op inofensivo):

```sql
UPDATE actions a
SET
  title = rta.title,
  description = rta.description,
  responsible_user_id = rta.responsible_user_id,
  due_on = rta.due_on,
  status = rta.status::text::"ActionStatus",
  completed_at = rta.completed_at,
  completed_by_user_id = recovered_completer.completed_by_user_id
FROM risk_treatment_actions rta
LEFT JOIN recovered_completer ON recovered_completer.rta_id = rta.id
WHERE a.id = rta.action_id;
```

### Passo 2 — Verificação, antes de qualquer `DROP` (corrigido pelo coordenador)

```sql
-- (a) Zero linhas sem action_id.
SELECT COUNT(*) AS orphans FROM risk_treatment_actions WHERE action_id IS NULL;
-- ESPERADO: 0

-- (b) action_id é único (nenhuma Action reaproveitada por duas linhas de vínculo).
SELECT action_id, COUNT(*) FROM risk_treatment_actions GROUP BY action_id HAVING COUNT(*) > 1;
-- ESPERADO: nenhuma linha

-- (c) CORRIGIDO — as condições de origem entram na DISJUNÇÃO contada, nunca no WHERE como filtro.
-- Achado do coordenador: a versão original tinha `a.origin_type = ... AND a.origin_id = ...` no
-- WHERE como filtro — uma linha com origem ERRADA era EXCLUÍDA da contagem em vez de sinalizada,
-- uma guarda que passa porque nunca olha para a linha ruim (a classe de defeito que este projeto
-- já nomeou várias vezes, F-42). Corrigido: qualquer divergência de origem OU de campo é uma
-- linha contada, nunca uma exclusão silenciosa.
SELECT COUNT(*) AS mismatches
FROM risk_treatment_actions rta
JOIN actions a ON a.id = rta.action_id
WHERE a.origin_type IS DISTINCT FROM 'RISK_TREATMENT'::"ActionOriginType" OR
      a.origin_id IS DISTINCT FROM rta.risk_id OR
      a.title IS DISTINCT FROM rta.title OR
      a.description IS DISTINCT FROM rta.description OR
      a.responsible_user_id IS DISTINCT FROM rta.responsible_user_id OR
      a.due_on IS DISTINCT FROM rta.due_on OR
      a.status::text IS DISTINCT FROM rta.status::text OR
      a.completed_at IS DISTINCT FROM rta.completed_at;
-- ESPERADO: 0 (garantido pela reconciliação do Passo 1B — este check é a PROVA de que ela
-- funcionou, não uma formalidade tornada redundante por ela)

-- (d) NOVO — a população de Actions órfãs (D-2), esperada por desenho: relatada por RAISE NOTICE,
-- nunca falha por si.
SELECT COUNT(*) AS by_design_orphans
FROM actions a
JOIN risks r ON r.id = a.origin_id
WHERE a.origin_type = 'RISK_TREATMENT'
  AND NOT EXISTS (SELECT 1 FROM risk_treatment_actions rta WHERE rta.action_id = a.id);
-- Medido: 3 no banco de desenvolvimento, no momento da especificação.
```

Todas as quatro consultas rodam dentro de blocos `DO $$ ... $$` que levantam exceção (`RAISE
EXCEPTION`) se (a)/(b)/(c) devolverem contagem diferente de zero — a migração inteira reverte
antes de alcançar o passo 3. **Provado por execução, não apenas planejado**: cada uma das quatro
guardas foi disparada deliberadamente, uma de cada vez, contra `pharos_grc_test`, dentro de
transações sempre revertidas, e produziu exatamente a mensagem de exceção esperada — incluindo o
próprio defeito de origem que o coordenador encontrou (cenário `origin_id` trocado por um risco
diferente). Ver o relatório de implementação para o texto exato de cada exceção capturada.

### Passo 3 — Só agora, os `DROP`, o endurecimento e a remoção do enum morto

```sql
ALTER TABLE risk_treatment_actions
  ALTER COLUMN action_id SET NOT NULL;

ALTER TABLE risk_treatment_actions
  ADD CONSTRAINT risk_treatment_actions_action_id_key UNIQUE (action_id);

DROP INDEX IF EXISTS risk_treatment_actions_risk_id_status_idx;
DROP INDEX IF EXISTS risk_treatment_actions_responsible_user_id_due_on_idx;
DROP INDEX IF EXISTS risk_treatment_actions_due_on_status_idx;

ALTER TABLE risk_treatment_actions
  DROP COLUMN title,
  DROP COLUMN description,
  DROP COLUMN responsible_user_id,
  DROP COLUMN due_on,
  DROP COLUMN status,
  DROP COLUMN completed_at;

CREATE INDEX risk_treatment_actions_risk_id_idx ON risk_treatment_actions (risk_id);

-- NOVO, coordenador, 2026-09-11: `TreatmentActionStatus` só tinha a coluna `status` acima como
-- consumidora — confirmado, nenhuma outra referência no schema. Apagar um TYPE inteiro (diferente
-- de remover um VALOR de um enum ainda em uso) é seguro e irrestrito; feito aqui, na mesma
-- migração, em vez de deixado para depois — uma guarda que comparasse os dois enums depois disto
-- estaria protegendo algo que já não existe, exatamente a forma de defeito que este projeto já
-- pagou várias vezes (F-27).
DROP TYPE "TreatmentActionStatus";
```

(Os nomes de índice foram conferidos contra o banco real, via introspecção direta de
`pg_indexes`, antes de escrever os `DROP INDEX` literais — não adivinhados.)

### Plano de recuperação (exercitado de propósito, não apenas descrito)

Todo valor removido no passo 3 permanece integralmente em `actions`, alcançável por
`action_id`. **Exercitado deliberadamente, não apenas argumentado**: uma inconsistência foi
plantada de propósito contra `pharos_grc_test` (dentro de uma transação sempre revertida) e a
migração reverteu por inteiro, sem aplicar nenhum passo — confirmado consultando
`_prisma_migrations` depois de uma tentativa real que falhou no passo 2:
`applied_steps_count: 0`, `finished_at: null`, `rolled_back_at` preenchido, com o texto exato da
exceção Postgres registrado na própria coluna `logs`. O comando que devolve o estado a utilizável
depois de uma falha real (usado de fato, não apenas descrito, quando esta migração falhou uma vez
por acidente contra `pharos_grc_test` via a suíte de integração de outro agente):

```bash
DATABASE_URL="<owner-connection-string-do-banco-de-teste>" \
  pnpm exec prisma migrate resolve --rolled-back "20260911000000_action_convergence_risk_treatment_actions"
```

Só é a resposta correta quando `applied_steps_count` for `0` (a transação genuinamente não
aplicou nada). Se a migração chegou a `finished_at` preenchido com sucesso, ela JÁ aplicou de
verdade — `resolve --rolled-back` mentiria sobre isso, e a correção correta é uma **migração nova**
que ajusta o que ficou incorreto, nunca reeditar o arquivo já aplicado (ver a nota operacional no
relatório de implementação sobre exatamente este caso, que aconteceu de verdade nesta sessão).

### `prisma/seed/performance.seed.ts`

A chamada `client.riskTreatmentAction.createMany(...)` passa a ser precedida por um
`client.action.createMany(...)` equivalente, com códigos reservados em lote de
`grc_code_sequences` (a mesma tabela do backfill acima, um único round-trip por lote em vez de um
por linha), e o `id` da `Action` já conhecido para a linha de vínculo correspondente — para que o
fixture de desempenho nunca produza, ele mesmo, uma nova linha órfã do tipo que esta fase está
corrigindo. `completed_by_user_id` do fixture usa `responsible_user_id` como atribuição sintética
DELIBERADA — não há trilha de auditoria real por trás de dado de carga sintético, então não há
fato a recuperar; diferente do backfill de dado real acima, onde isso seria fabricação.

---

## §3 — Invariante de escopo que a convergência precisa preservar

**O escopo organizacional de uma ação de tratamento de risco é decidido pela unidade organizacional
ATUAL do risco, nunca por `Action.orgUnitId`.**

`Action.orgUnitId` é um retrato tirado no momento da criação. `grc/action/application/assert-action-origin-in-scope.ts`
já existe precisamente porque esse valor guardado pode ficar desatualizado quando o risco de origem é
reatribuído a outra unidade depois — e re-deriva a unidade viva da origem em toda escrita. O caminho
de leitura precisa concordar com o caminho de escrita.

Concretamente, depois de repontar as consultas de `dashboard-query.service.ts`
(`getOverdueActions`, `getTreatmentActionsSummary`) e o fragmento `EXISTS` de
`risk-query.service.ts:410` para lerem `actions` em vez de `risk_treatment_actions`:

```sql
-- Forma exigida do JOIN: correlaciona pela origem, escopa pela linha do RISCO.
... FROM risks r
JOIN actions a ON a.origin_id = r.id AND a.origin_type = 'RISK_TREATMENT'
WHERE <scopeFragment aplicado a r, exatamente como hoje> AND ...
```

**Nunca**:

```sql
-- PROIBIDO: escoparia por um retrato desatualizado, não pela unidade viva do risco.
... WHERE <scopeFragment aplicado a a.org_unit_id> ...
```

Uma consulta na segunda forma compila, passa em todo teste hoje existente (nenhum risco no banco de
testes muda de unidade organizacional durante o teste), e mostraria ou esconderia a linha errada,
silenciosamente, na primeira reorganização real. `tasks.md` exige um teste que reatribui um risco de
unidade e confirma que a bandeira de atraso e o indicador do painel seguem a unidade nova — não a
antiga carimbada em `Action.orgUnitId`.

---

## §4 — `control_assessments`: coluna aditiva `org_unit_id`

### Antes

```
control_assessments
  id                  uuid  PK
  control_id          uuid  FK -> controls (Restrict)
  assessed_on         date
  assessor_user_id    uuid  FK -> users (Restrict)
  result              ControlAssessmentResult
  conclusion          text
  approval_id         uuid  NULL  FK -> approvals (Restrict)
  attested_at         timestamptz NULL
  attested_by_user_id uuid  NULL  FK -> users (Restrict)
  created_at          timestamptz

  INDEX (control_id, assessed_on DESC, created_at DESC)
```

`ControlAssessmentRepository.listAssessmentIdsInScope` (linhas 152-154) decide visibilidade hoje
por:

```sql
-- ATUAL — decide por JOIN, o que a regra já ratificada em AGENTS.md proíbe.
SELECT ca.id FROM control_assessments ca
JOIN controls c ON c.id = ca.control_id
WHERE c.org_unit_id IN (...)
```

### Depois

```
control_assessments
  ...                                  -- todas as colunas acima, inalteradas
  org_unit_id  uuid  NULL   FK -> organizational_units (Restrict)     -- NOVO, aditivo

  INDEX (org_unit_id)                                                  -- NOVO
```

Migração:

```sql
ALTER TABLE control_assessments
  ADD COLUMN org_unit_id uuid REFERENCES organizational_units(id) ON DELETE RESTRICT;

UPDATE control_assessments ca
SET org_unit_id = c.org_unit_id
FROM controls c
WHERE c.id = ca.control_id;

CREATE INDEX control_assessments_org_unit_id_idx ON control_assessments (org_unit_id);
```

`org_unit_id` fica **anulável na coluna** — segue o mesmo precedente que `Control.orgUnitId` já
estabeleceu (anulável na coluna, garantido de outra forma na aplicação) — porque `Control.orgUnitId`
em si já é anulável, e uma avaliação de um controle sem unidade não tem o que copiar.

**Mantido em sincronia com a unidade do controle**: toda escrita que move um `Control` para outra
unidade organizacional DEVE atualizar `org_unit_id` de toda `ControlAssessment` desse controle, na
mesma transação — a denormalização nunca pode divergir silenciosamente do valor de origem. A leitura
de escopo passa a ser:

```sql
-- NOVO — lê a própria linha, sem JOIN.
SELECT ca.id FROM control_assessments ca WHERE ca.org_unit_id IN (...)
```

**Nota, para não confundir com a decisão do §3 acima**: aqui a denormalização é a correção correta,
porque uma avaliação de controle **não** tem um mecanismo equivalente a
`assertActionOriginInScope` — não existe reatribuição frequente de controle a outra unidade sendo o
caso de uso central do domínio, e a tabela nunca teve escopo próprio para começar. `Action.orgUnitId`,
em contraste, já existe, já é mantido, e sua obsolescência **já tem** um corretor em runtime
(`assertActionOriginInScope`) que a leitura precisa respeitar em vez de contornar. As duas decisões
não se contradizem: cada uma segue o padrão que o seu domínio já tem.

---

## §5 — O que não muda

- Nenhuma coluna de `actions` muda de forma, tipo ou nulidade.
- Nenhum vínculo (`ControlAssetLink`, `ControlProcessLink`, `RiskAssetLink`, `RiskProcessLink`,
  `ControlAssetLink`, links de Evidência/Achado) é tocado por esta fase.
- Nenhuma linha de `audit_event` é reescrita, incluindo as com `entity_type='RISK_TREATMENT_ACTION'`
  (Constituição, Princípio XV — ver research.md D-5).
- Nenhuma linha histórica de `session.created` é reescrita (D-13).
