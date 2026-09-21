# Quickstart — Gestão de Controles

Roteiro de validação executável. Prova que o módulo funciona ponta a ponta, não que ele compila.

Pré-requisitos: PostgreSQL local com o banco semeado, API e web em execução, e um usuário com os
papéis necessários. Ver `specs/001-grc-platform-foundation/quickstart.md` para o preparo do
ambiente, que não muda nesta fase.

---

## 0. Pré-condições

```bash
pnpm --filter @pharos/api exec prisma migrate deploy   # migrações aditivas desta fase (F-51/D-25: nunca `db:migrate` — esse script roda `prisma migrate dev`, proibido contra banco real por schema.prisma:57-72)
pnpm --filter @pharos/api run db:seed          # permissões e papéis novos
```

Confirme que as permissões novas entraram — se não estiverem, nenhum cenário abaixo passa:

```sql
SELECT identifier FROM permissions WHERE identifier LIKE 'control:%' ORDER BY identifier;
```

---

## 1. O registro mínimo sobreviveu à promoção (D-1, FR-003, SC-006)

O cenário que mais importa, e o primeiro por isso: esta fase **promove** uma tabela em uso.

```sql
-- Controles que já existiam antes desta fase continuam lá, com o mesmo id e o mesmo código.
SELECT id, code, status, owner_user_id, nature, control_type, frequency
FROM controls ORDER BY created_at LIMIT 5;

-- E os vínculos risco→controle já gravados continuam válidos e atribuíveis.
SELECT count(*) FROM risk_control_links WHERE unlinked_at IS NULL;
```

**Esperado**: os controles preexistentes aparecem com `status = 'DRAFT'` e os atributos novos
`NULL`. A contagem de vínculos é a mesma de antes da migração.

**Falha que este cenário procura**: uma segunda tabela de controle, ou vínculos órfãos. Se a
contagem caiu, a migração não foi aditiva e o módulo de Riscos perdeu dados.

Abra um desses controles preexistentes na interface. **Esperado**: ele renderiza, com os campos
novos vazios e legíveis como "não definido" — nunca um erro, nunca um valor arbitrado.

---

## 2. Efetividade não existe sem prova que a sustente (FR-012, FR-013, SC-002)

1. Crie um controle e ative-o. `GET /controls/{id}`.
   **Esperado**: `effectiveness: "NOT_ASSESSED"`. Nunca efetivo por omissão.
2. Registre uma verificação com `result: "EFFECTIVE"`, **sem** atestar.
   **Esperado**: `effectiveness` continua `NOT_ASSESSED` — registrar não é declarar (FR-016).
3. Ateste a verificação com um terceiro.
   **Esperado**: `effectiveness: "EFFECTIVE"`.

Confirme que não existe coluna materializada:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'controls' AND column_name LIKE '%effectiv%';
```

**Esperado**: zero linhas.

---

## 3. Vencimento é calculado, não gravado (FR-014, FR-015)

1. Controle com `frequency: "MONTHLY"` e verificação atestada com `assessedOn` de 60 dias atrás.
   **Esperado**: `effectiveness: "EXPIRED"`, sem que nada tenha sido gravado para isso.
2. O mesmo controle com `frequency: null`.
   **Esperado**: o resultado da última verificação atestada, e `EXPIRED` inalcançável.

**Falha que este cenário procura**: ausência de frequência tratada como "vence imediatamente".

---

## 4. Registrar é irreversível; suceder é a única correção (FR-010)

1. Registre uma verificação. Anote o `id`.
2. Procure no contrato uma operação que a edite ou apague.
   **Esperado**: não existe. Não é uma restrição de permissão — a operação não está no contrato.
3. Registre uma segunda verificação no mesmo controle.
4. `GET /controls/{id}/assessments`.

**Esperado**: as duas presentes, em ordem cronológica, ambas atribuíveis. A primeira não foi
alterada.

---

## 5. Segregação de funções, duas regras separadas (FR-017, FR-018, SC-004)

O cenário de segurança desta fase.

1. Controle cujo dono é **A**. Verificação executada por **B**.
2. Tente atestar como **B** (quem testou) → **422**.
3. Tente atestar como **A** (o dono) → **422**.
4. Ateste como **C**, com `control:approve` → **200**.

**Esperado**: as duas recusas são distinguíveis na trilha — uma diz "executou", a outra diz "é
dono". Um motivo único não sustentaria a distinção.

5. Agora um controle cujo dono **é** quem testou. Tente atestar como essa pessoa → **422**, e o
   evento auditado nomeia **as duas** regras.

```sql
SELECT action, outcome, reason FROM audit_event
WHERE action LIKE 'control.assessment%' AND outcome = 'DENIED'
ORDER BY occurred_at DESC LIMIT 5;
```

---

## 6. Escopo organizacional não vaza (FR-007, SC-005)

Com um usuário cujo escopo **não** cobre a unidade do controle:

1. `GET /controls/{id}` → **404**, nunca 403.
2. `POST /controls/{id}/assessments` → **404**.
3. Compare com a resposta de um `id` que realmente não existe.

**Esperado**: indistinguíveis. Um identificador válido é informação.

---

## 7. Vínculo verifica escopo do alvo ANTES de gravar (ADR-020 parte 4, FR-025)

1. Como um ator cujo escopo cobre o controle mas **não** cobre o processo alvo, tente vincular.
   **Esperado**: **404** — a mesma resposta de um processo inexistente. E, crucialmente, nada
   gravado:

```sql
SELECT count(*) FROM control_process_links WHERE control_id = '<id>';
```

**Esperado**: inalterado. Uma verificação feita depois da escrita não é uma verificação.

---

## 8. Desvincular preserva (FR-023)

1. Vincule um processo. 2. Desvincule. 3. Liste os vínculos.

**Esperado**: o vínculo não consta entre os vigentes e continua na tabela com `unlinked_at` e
`unlinked_by_user_id` preenchidos. Nunca `DELETE` físico.

4. Vincule o **mesmo** par novamente. **Esperado**: permitido, cria um novo vínculo, e o anterior
   permanece no histórico.

---

## 9. Risco↔Controle: um vínculo só, lido dos dois lados (FR-021)

1. A partir de um risco, vincule um controle (operação já existente, do lado do Risco).
2. `GET /controls/{controlId}/risks`.

**Esperado**: o risco aparece. E:

```sql
-- Nenhuma segunda tabela de vínculo risco↔controle foi criada.
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%control%' AND table_name LIKE '%risk%';
```

**Esperado**: apenas `risk_control_links`.

3. Procure no contrato de Controles uma operação que crie ou remova esse vínculo.
   **Esperado**: não existe. O vínculo pertence ao lado que o registra.

---

## 10. Fronteira entre módulos permanece aplicada (ADR-020 parte 3, SC-007)

```bash
pnpm --filter @pharos/api run lint
```

**Esperado**: limpo. E a verificação que o lint não faz sozinha:

```bash
grep -rn "modules/controls" apps/api/src/modules/risk/ || echo "sem import: correto"
grep -rn "modules/risk"     apps/api/src/modules/controls/ || echo "sem import: correto"
```

**Esperado**: nenhum import nos dois sentidos. A dependência atravessa
`shared/grc-ports/control-directory.port.ts`.

---

## 11. Evidência e Ação vêm do núcleo, não de cópias (FR-026, FR-027)

1. Anexe uma evidência a um controle (`subjectType: CONTROL`).
2. A partir de uma verificação com resultado inefetivo, abra uma ação
   (`originType: CONTROL_ASSESSMENT`).
3. `GET /actions?responsibleUserId={id}`.

**Esperado**: a ação aparece na **mesma** lista de trabalho das ações de tratamento de risco,
identificada por sua origem. Se houvesse uma segunda lista, a capacidade compartilhada teria
falhado.

---

## 12. Trilha semântica, não CRUD (FR-030, SC-009)

```sql
SELECT DISTINCT action FROM audit_event WHERE action LIKE 'control%' ORDER BY action;
```

**Esperado**: nomes que descrevem intenção — `control.activated`, `control.retired`,
`control.assessment.recorded`, `control.assessment.attested`, `control.effectiveness.changed`,
`control.process.linked`, `control.process.unlinked` — e **não** `control.updated` para tudo.

---

## 13. Riscos permanece intacto (SC-006)

```bash
pnpm --filter @pharos/api run test:contract
pnpm --filter @pharos/api run test:integration
pnpm --filter @pharos/web run test:unit
```

**Esperado**: as contagens de base do módulo de Riscos passam **sem alteração**. Nenhum teste
existente de Risco foi modificado para acomodar esta fase — se algum precisou mudar, a
compatibilidade retroativa falhou e isso é defeito, não ajuste.
