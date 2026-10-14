# Data Model — Gestão de Controles (Fase 2)

Toda alteração desta fase é **aditiva**. Nenhuma coluna existente muda de tipo, nome ou
obrigatoriedade; nenhuma linha existente é reescrita. Isso é o que sustenta SC-006 (o módulo de
Riscos não muda) e D-1 (promoção, não substituição).

---

## §1. `Control` — promoção da tabela existente

A tabela `controls` já existe com `id`, `code` (único), `name`, `description`, `orgUnitId`,
`isActive`, `createdAt`, `updatedAt`. Esta fase acrescenta:

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `owner_user_id` | uuid FK → `users` | sim | Obrigatório apenas para ativar (FR-005), por isso nulável na coluna e exigido na regra de domínio. |
| `nature` | `ControlNature` | sim | `MANUAL` \| `AUTOMATED`. |
| `control_type` | `ControlType` | sim | `PREVENTIVE` \| `DETECTIVE` \| `CORRECTIVE`. |
| `frequency` | `ControlFrequency` | sim | Ausência = sem efetividade vencível (FR-015). |
| `status` | `ControlStatus` | não | `DRAFT` por padrão. |
| `retired_at` / `retired_by_user_id` / `retirement_reason` | timestamptz / uuid / text | sim | Preenchidos na transição para `RETIRED`. |
| `version` | int | não | Padrão `1`. Concorrência otimista, mesmo mecanismo do Risco. |

> **`is_active` e `status` coexistem — e isso é deliberado, não descuido.** `is_active` é o campo
> do registro mínimo, lido hoje pelo módulo de Riscos ao validar um vínculo. Renomeá-lo ou
> removê-lo quebraria o outro módulo, que é exatamente o que esta fase não pode fazer. A regra:
> `status` é a verdade do ciclo de vida, e `is_active` é mantido em sincronia por um único ponto
> de escrita (`false` quando `RETIRED`, `true` caso contrário), documentado nos dois lados. Um
> segundo ponto que escrevesse `is_active` recriaria a divergência que esta fase inteira existe
> para eliminar.

**Enumerações novas**: `ControlStatus` (`DRAFT`, `ACTIVE`, `SUSPENDED`, `RETIRED`),
`ControlNature`, `ControlType`, `ControlFrequency` (D-7), `ControlAssessmentResult`
(`EFFECTIVE`, `PARTIALLY_EFFECTIVE`, `INEFFECTIVE`).

**Não existe coluna de efetividade.** Ver §3.

**Código**: gerado reutilizando o alocador existente
(`grc/shared/infrastructure/prisma-entity-code-generator.ts`) sobre a tabela `GrcCodeSequence`,
com o prefixo `CTL`.

> **Isto custa uma alteração no núcleo GRC, e o portão de análise a encontrou antes da
> implementação.** `EntityCodeGeneratorPort.nextCode(prefix: EntityCodePrefix, …)` é tipado por
> uma união **fechada** — `'EVD' | 'ACT' | 'FND'` — e `ENTITY_CODE_PATTERN` codifica os mesmos
> três no regex. Controls não compila contra isso. O rascunho anterior desta seção declarava o
> reuso como se fosse gratuito; ele falharia no primeiro `tsc`.
>
> **Correção adotada**: estender a união, a constante e o padrão com `CTL`, e corrigir o
> comentário da união, que hoje diz "adicionar uma quarta entidade **do núcleo GRC** estende esta
> união". Control não é entidade do núcleo (ADR-016) — mas `EvidenceSubjectType`,
> `ApprovableEntityType` e `AttachableEntityType` já vivem na camada compartilhada nomeando
> conceitos de módulo (`RISK`, `RISK_TREATMENT_DECISION`), que é o padrão de registro de tipo
> fechado do ADR-018. O comentário é mais estreito que o padrão que o próprio código pratica.
>
> **Alternativa descartada**: gerador próprio em `modules/controls`. Duplicaria o `UPSERT … ON
> CONFLICT` do contador — a classe de defeito F-42 (uma mecânica em dois lugares) — para evitar
> uma linha de união. Registrado como ponto onde o desenho do núcleo apertou (§19.10).

> Correção de rascunho: uma versão anterior desta seção dizia "o mesmo mecanismo já usado por
> Risco, Evidência, Ação e Achado". Falso quanto a Risco — Risco antecede o núcleo GRC e tem
> geração de código própria. Registrado porque a frase teria virado uma tarefa de implementação
> que procuraria uma reutilização inexistente.

`code` já é único na tabela; controles preexistentes mantêm o código que têm.

---

## §2. `ControlAssessment` — a verificação, imutável

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | não | |
| `control_id` | uuid FK → `controls` `onDelete: Restrict` | não | |
| `assessed_on` | date | não | Data da verificação. Não pode ser futura (FR-011). |
| `assessor_user_id` | uuid FK → `users` | não | Quem executou. |
| `result` | `ControlAssessmentResult` | não | |
| `conclusion` | text | não | O que foi observado. |
| `approval_id` | uuid FK → `approvals` | sim | A atestação (§4). Nulo enquanto pendente. |
| `attested_at` / `attested_by_user_id` | timestamptz / uuid | sim | Preenchidos na atestação. |
| `created_at` | timestamptz | não | |

**Sem `updated_at`, e isso é a regra, não uma omissão.** Uma verificação não é editada (FR-010).
Uma nova verificação sucede a anterior; nenhuma operação do contrato atualiza uma existente.

**Índice**: `(control_id, assessed_on DESC, created_at DESC)` — é a ordenação que o calculador de
efetividade percorre e a que o histórico exibe.

---

## §3. Efetividade — derivada, nunca armazenada

Não há coluna. `ControlEffectivenessService` (D-2) é o único ponto de cálculo:

```
entrada: verificações ATESTADAS do controle, frequency, referenceDate (parâmetro obrigatório)
saída:   NOT_ASSESSED | EFFECTIVE | PARTIALLY_EFFECTIVE | INEFFECTIVE | EXPIRED
```

- Sem verificação atestada → `NOT_ASSESSED` (FR-013). Nunca `EFFECTIVE` por omissão.
- Com verificação atestada e `frequency` nula → o resultado da mais recente. `EXPIRED` é
  inalcançável (FR-015).
- Com `frequency` declarada e `assessed_on` da mais recente anterior à janela → `EXPIRED`
  (FR-014).
- Verificação **não atestada não conta**. Registrar não é declarar (FR-016).

**Paridade SQL ↔ domínio.** O catálogo precisa filtrar e ordenar por efetividade, o que exige a
mesma regra em SQL. Isso é o padrão já estabelecido por `overdueReviewFragment` /
`isOverdueReview` no módulo de Riscos: duas expressões da mesma regra, com comentário em cada uma
apontando para a outra, e um teste que as confronta sobre os mesmos dados. Sem esse teste, são
duas regras que apenas começam iguais.

---

## §4. Atestação — pelo mecanismo aprovável existente

`ApprovableEntityType` ganha `CONTROL_ASSESSMENT`. Nenhuma tabela nova de aprovação.

Duas invariantes, verificadas no domínio e independentemente testáveis (D-3):

- **C1** — `attested_by_user_id ≠ assessor_user_id`.
- **C2** — `attested_by_user_id ≠ controls.owner_user_id` do controle verificado.

Recusa por C1, por C2 ou por ambas é auditada com o motivo (FR-019). Quando as duas se aplicam, o
evento nomeia as duas — um motivo único não distinguiria "testou" de "é dono", e é justamente essa
distinção que a trilha precisa sustentar.

---

## §5. Vínculos do lado de Controles

`ControlProcessLink` e `ControlAssetLink`, mesma forma:

| Coluna | Nota |
|---|---|
| `control_id` FK → `controls` `Restrict` | |
| `process_id` / `asset_id` FK → registro de referência `Restrict` | Integridade real no banco (ADR-020 parte 2). |
| `linked_at`, `linked_by_user_id` | |
| `unlinked_at`, `unlinked_by_user_id` | Nulos enquanto vigente. Desvincular preserva (FR-023). |

**Unicidade parcial** `(control_id, process_id) WHERE unlinked_at IS NULL` — mesma técnica de
`RiskControlLink`: impede duplicata vigente e permite revincular depois de desfeito.

**Tipo de auditoria próprio para cada um** (ADR-020 parte 1): `CONTROL_PROCESS_LINK` e
`CONTROL_ASSET_LINK`. Uma trilha que não distinguisse os dois desfaria, no ponto onde mais
importa, a modelagem explícita que ADR-008 exige.

---

## §6. Risco ↔ Controle — o que NÃO muda

`RiskControlLink` permanece exatamente como está: do lado do Risco, com FK real para `controls`.
Nenhuma coluna, nenhum índice, nenhuma migração.

O que muda é apenas **de onde `modules/risk` obtém o controle**: hoje lê `controls` diretamente;
passa a depender de `ControlDirectoryPort` (D-4). Isso não altera comportamento — e é por isso
que precisa de teste próprio, porque uma troca que não muda nada é a que passa despercebida quando
quebra.

A porta expõe o mínimo permitido por ADR-020: `{ id, code, name, orgUnitId, isActive }`. Nunca
status, dono, natureza, frequência ou efetividade — nada disso é assunto do módulo de Riscos.

---

## §7. Evidência e Ação

- `EvidenceSubjectType` += `CONTROL` (FR-026).
- `ActionOriginType` += `CONTROL_ASSESSMENT` (FR-027) — a origem é o fato que justifica a ação,
  não a entidade genérica (D-5).

Nenhuma tabela nova. `EvidenceLink` e `Action` já suportam ambos por construção.

---

## §8. Permissões

`control:view`, `control:create`, `control:edit`, `control:test`, `control:approve`,
`control:administer` — declaradas pelo agregador estático (`permission-catalogue.ts`), o
mecanismo que substituiu o registro em tempo de execução justamente por não ser executável no
*seed*.

Papéis semeados: `Risk Manager` recebe leitura de controle (já lê controles ao tratar risco);
um papel `Control Owner` recebe `view|create|edit|test`; `Control Approver` recebe
`view|approve`. A segregação de funções é regra de domínio (§4), não consequência de papel — dar
os dois papéis à mesma pessoa continua não permitindo que ela ateste o próprio teste.

---

## §9. Escopo organizacional

`controls.org_unit_id` já existe e passa a ser **obrigatório na regra de domínio** para controles
criados nesta fase (a coluna segue nulável por causa dos preexistentes). Toda leitura usa o
`ScopedRepository` com escopo obrigatório e sem valor padrão; fora de escopo responde como
inexistente (FR-007, FR-025).

O dono do controle segue a **mesma** regra de linha organizacional criada para o responsável de
risco (`AssignmentLineService`) — uma regra, dois consumidores, nunca uma segunda cópia.
