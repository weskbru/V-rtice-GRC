# Quickstart — Fundação GRC Compartilhada

Roteiro de validação executável. Prova que a fundação funciona ponta a ponta, não que ela compila.

Pré-requisitos: PostgreSQL local com o banco semeado, API e web em execução, e um usuário com os
papéis necessários. Ver `specs/001-grc-platform-foundation/quickstart.md` para o preparo do
ambiente, que não muda nesta fase.

---

## 0. Pré-condições

```bash
pnpm --filter @vertice/api exec prisma migrate deploy   # migrações aditivas desta fase (F-51/D-25: nunca `db:migrate` — esse script roda `prisma migrate dev`, proibido contra banco real por schema.prisma:57-72)
pnpm --filter @vertice/api run db:seed          # permissões novas entram no catálogo
```

Confirme que as permissões novas foram semeadas — se não estiverem, nenhum cenário abaixo passa:

```sql
SELECT identifier FROM permissions
WHERE identifier LIKE 'evidence:%' OR identifier LIKE 'action:%' OR identifier LIKE 'finding:%'
ORDER BY identifier;
```

---

## 1. Evidência sustenta uma decisão e sobrevive ao arquivamento (US1)

O cenário que motiva a capacidade: a prova precisa continuar legível como fato histórico depois de
sair de circulação.

1. Crie uma evidência (`POST /api/v1/evidence`, com `observation` preenchida) e anexe um arquivo a
   ela (`POST /api/v1/attachments`, `entityType: EVIDENCE`, `entityId: <id da evidência>`) — nesta
   ordem: o anexo exige que a evidência já exista (revisão de design registrada em data-model.md
   §2; não há mais `fileId` no corpo de criação).
2. Vincule-a a um risco existente dentro do seu escopo
   (`POST /api/v1/evidence/{id}/links`, `subjectType: RISK`).
3. Vincule a **mesma** evidência a um segundo risco — o reuso é legítimo.
4. Arquive a evidência (`POST /api/v1/evidence/{id}/archive`).
5. Liste os vínculos com `includeUnlinked=true`.

**Esperado**: os dois vínculos continuam presentes e atribuíveis. Nenhuma linha desapareceu. A
evidência aparece como `ARCHIVED`, e os riscos continuam mostrando que foram sustentados por ela.

**Falha que este cenário procura**: arquivamento em cascata que apaga vínculo. Se os vínculos
sumirem, o produto perdeu a capacidade de responder "o que sustentava esta decisão em março".

---

## 2. Evidência sem arquivo é aceita; evidência ilegível não é

1. Crie uma evidência com apenas `observation` preenchido, sem `fileId` e sem `externalUrl`.
   **Esperado**: `201`.
2. Crie uma evidência sem `externalUrl` e sem `observation` (não há mais `fileId` — ver a nota de
   revisão em data-model.md §2).
   **Esperado**: `422` — regra de negócio (invariante E1), não erro de formato do corpo da
   requisição. Uma prova que nenhum humano consegue ler não é prova.

---

## 3. Escopo organizacional não vaza (US1, SC-005)

Com um usuário cujo escopo **não** cobre a unidade da evidência:

1. `GET /api/v1/evidence/{id}` → **404**, nunca 403.
2. `POST /api/v1/evidence/{id}/links` → **404**.
3. Compare byte a byte com a resposta de um `id` que realmente não existe.

**Esperado**: respostas indistinguíveis. Um identificador válido é informação; a API não pode
confirmar existência para quem não tem escopo.

Verifique também a negação na trilha:

```sql
SELECT action, outcome, actor_user_id FROM audit_event
WHERE outcome = 'DENIED' ORDER BY occurred_at DESC LIMIT 5;
```

---

## 4. Uma lista única de trabalho, de origens diferentes (US2, SC-002)

1. Crie uma ação a partir de um tratamento de risco (`originType: RISK_TREATMENT`).
2. Crie um achado e, a partir dele, outra ação (`originType: FINDING`), com o **mesmo** responsável.
3. `GET /api/v1/actions?responsibleUserId={id}`.

**Esperado**: as duas ações numa só resposta, cada uma com sua origem identificada e rotulada. É
esta consulta que justifica a capacidade compartilhada existir — se ela não funcionar, não havia
motivo para tirar Ação de dentro de Riscos.

---

## 5. Vencimento calculado, não digitado (SC-007)

1. Crie uma ação com `dueOn` no passado. **Esperado**: `201` — remediação atrasada se registra.
2. `GET /api/v1/actions?overdue=true`. **Esperado**: a ação aparece, com `overdue: true`.
3. Conclua a ação. **Esperado**: `overdue: false`, sem que nenhum campo de vencimento tenha sido
   gravado.

Confirme que não existe coluna materializada:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'actions' AND column_name IN ('is_overdue', 'overdue');
```

**Esperado**: zero linhas.

---

## 6. Reabertura preserva a conclusão anterior (US2)

1. Conclua uma ação.
2. Reabra-a (`POST /api/v1/actions/{id}/transitions`, `to: OPEN`) **sem** `reason` → **422**.
   > **Correção feita ao executar este roteiro (T083, Fase 6)**: o desenho original desta seção
   > previa `400`. A ausência de `reason` é a Invariante A2, verificada no domínio
   > (`assertReopenReasonProvided`) e sinalizada como `ValidationDomainError` — a mesma família de
   > erro de toda regra de negócio deste kernel (`422`), não um erro de forma do corpo da
   > requisição (que seria `400`, reservado ao `ValidationPipe` global). Comportamento real
   > confirmado diretamente contra a API em execução; nenhum outro passo deste cenário mudou.
3. Reabra com `reason` → **200**.
4. Consulte a trilha do registro.

**Esperado**: `action.completed` e `action.reopened` como eventos distintos, ambos preservados. A
conclusão anterior não foi sobrescrita.

---

## 7. Segregação de funções no encerramento de achado (US3, FR-025)

O cenário de segurança desta fase.

1. Crie um achado.
2. Crie uma ação de remediação com responsável **A**.
3. Conclua a ação como **A**.
4. Tente encerrar o achado como **A** → **403**.
5. Encerre como **B**, com `finding:close` → **200**.

**Esperado**: o produto recusa que quem remediou ateste a própria remediação — a mesma regra já
aplicada às aprovações de risco. Confirme que a tentativa negada está auditada.

---

## 8. Conclusão de ação não encerra achado (FR-024)

1. Achado com uma única ação vinculada.
2. Conclua a ação.
3. `GET /api/v1/findings/{id}`.

**Esperado**: `status` continua o que já era antes da conclusão — `OPEN`, para um achado recém-criado
por `createFinding` (que sempre nasce `OPEN`; `updateFinding` nunca aceita `status`). O encerramento
é ato explícito, com autor. Um achado que se fecha sozinho não tem responsável pelo fechamento.

> **Correção feita ao executar este roteiro (T083, Fase 6)**: o desenho original desta seção previa
> `IN_REMEDIATION`, presumindo implicitamente que ter uma ação vinculada moveria o achado para esse
> estado. Isso nunca acontece nesta fase: nenhuma operação do contrato transiciona
> `OPEN -> IN_REMEDIATION` (`createFinding` sempre gera `OPEN`; a única forma de alcançar
> `IN_REMEDIATION` é `reopenFinding`, cuja precondição é `CLOSED` — ver o próprio cabeçalho de
> `finding.entity.ts`, que já registra esta lacuna do contrato). O ponto que este cenário existe
> para provar continua válido e confirmado (a conclusão da ação não altera `status`); apenas o valor
> esperado estava errado. Comportamento real confirmado diretamente contra a API em execução.

---

## 9. Encerramento sem remediação exige justificativa (FR-026)

1. Achado sem ação vinculada.
2. Encerre sem `justification` → **422**.
3. Encerre com `justification` → **200**, e a justificativa fica no registro e na trilha.

---

## 10. Riscos permanece intacto (SC-006)

```bash
pnpm --filter @vertice/api run test:contract
pnpm --filter @vertice/api run test:integration
pnpm --filter @vertice/web run test:unit
```

**Esperado**: as contagens de base do módulo de Riscos passam sem alteração. Nenhum teste existente
foi modificado para acomodar esta fase — se algum precisou mudar, a compatibilidade retroativa
falhou e isso é um defeito, não um ajuste.

Confirme também que a escrita dupla ocorreu:

```sql
SELECT count(*) FROM risk_treatment_actions WHERE action_id IS NOT NULL;
```

**Esperado**: toda ação de tratamento criada após esta fase tem `action_id` preenchido.

---

## 11. Fronteira da camada permanece aplicada

```bash
pnpm --filter @vertice/api run lint
```

**Esperado**: limpo. As quatro direções (`grc → modules`, `core → grc` proibidas;
`grc → core`, `modules → grc` permitidas) já foram verificadas com sondas descartáveis no
fechamento do portão arquitetural e continuam ativas.

---

## 12. Trilha semântica, não CRUD (FR-028)

```sql
SELECT DISTINCT action FROM audit_event
WHERE action LIKE 'evidence.%' OR action LIKE 'action.%' OR action LIKE 'finding.%'
ORDER BY action;
```

**Esperado**: nomes que descrevem intenção de negócio — `evidence.linked`, `action.reopened`,
`finding.closed` — e **não** `evidence.updated` para tudo. Se toda operação virou um único evento
genérico de atualização, a trilha perdeu a capacidade de responder o que foi feito e por quê.
