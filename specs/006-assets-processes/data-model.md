# Data Model — Gestão de Ativos e Gestão de Processos

**Feature**: `006-assets-processes` · **Spec**: [spec.md](./spec.md) ·
**Research**: [research.md](./research.md)

**Regra que atravessa todo este documento**: Ativo e Processo têm a **mesma** forma, deliberadamente
(FR-020). Onde o texto descreve um, descreve os dois. As divergências são exatamente duas — o
prefixo do código (`AST` / `PRC`) e o nome — e não há terceira.

---

## §1 — O que muda no esquema, e o que não muda

### Não muda nada em `assets` e `processes`

As duas tabelas **já existem** e permanecem com a forma atual, coluna por coluna:

```
id           uuid       PK
code         text       UNIQUE
name         text
description  text       NULL
org_unit_id  uuid       NULL   FK -> organizational_units (Restrict)
is_active    boolean    NOT NULL DEFAULT true
created_at   timestamptz
updated_at   timestamptz
```

Nenhuma coluna muda de tipo, de nulidade ou de nome. **Esta fase não escreve migração sobre estas
duas tabelas** — é a decisão D-2, e é o que torna a promoção não destrutiva.

Em particular, `org_unit_id` **continua anulável**, seguindo o precedente literal de `Control`
(`schema.prisma:1368`), que também é anulável na coluna e obrigatório no DTO de criação. A
obrigatoriedade vive na aplicação (§4), não no banco.

### A única migração desta fase é aditiva e toca um enum

```
ALTER TYPE "AuditEntityType" ADD VALUE 'ASSET';
ALTER TYPE "AuditEntityType" ADD VALUE 'PROCESS';
```

Padrão ADR-008: enum fechado da plataforma cresce por migração revisada. Os quatro tipos de
**vínculo** já existem (`RISK_ASSET_LINK`, `RISK_PROCESS_LINK`, `CONTROL_ASSET_LINK`,
`CONTROL_PROCESS_LINK`); o que faltava era o tipo do **registro em si**, porque até agora não havia
nenhuma operação que criasse ou alterasse um.

**Verificação exigida** (a mesma que T007 de 005 fez): migrar para cima e para baixo contra o banco
real e confirmar que as contagens de `assets`, `processes`, `risk_asset_links`,
`risk_process_links`, `control_asset_links` e `control_process_links` são idênticas antes e depois.

---

## §2 — Prefixos de código

`EntityCodePrefix` (`grc/shared/domain/entity-code.service.ts:79`) passa de
`'EVD' | 'ACT' | 'FND' | 'CTL' | 'FMK' | 'AUD'` para incluir `'AST'` e `'PRC'`.
`ENTITY_CODE_PATTERN` é estendido junto, na mesma alteração.

Reusa `GrcCodeSequence` — **nenhuma tabela de sequência nova**. Códigos gerados têm a forma
`AST-2026-0001` e `PRC-2026-0001`.

**Os códigos livres existentes permanecem**: `FIXTURE-ASSET-1` e `FIXTURE-PROCESS-1` continuam
válidos e intocados. `ENTITY_CODE_PATTERN` valida a forma de códigos **gerados**, não é restrição
retroativa sobre a coluna (D-4). Um teste que reescrevesse esses códigos quebraria as fixtures de
E2E que os procuram por literal.

---

## §3 — Estado

Dois estados, `is_active` verdadeiro ou falso. **Nenhum enum novo** (D-3).

| Transição | Quem pode | Consequência observável |
|---|---|---|
| ativo → inativo | `asset:administer` / `process:administer` | deixa de poder ser vinculado a risco ou controle **novo**; continua legível; continua visível nos vínculos existentes |
| inativo → ativo | idem | volta a poder ser vinculado |

A consequência não é inventada por esta fase: já é imposta hoje, e nos dois lados —
`control-asset-link.usecase.ts:57` e `asset-link.usecase.ts:82` recusam alvo inativo. A fase
preserva a regra e passa a permitir operá-la pelo produto.

**Não existe exclusão.** Um ativo que saiu de operação é desativado. Apagar a linha destruiria a
rastreabilidade dos vínculos que a referenciam, e as FKs são `Restrict` — o banco também recusaria.

---

## §4 — Invariantes de domínio

Numeradas para que um teste possa citá-las, e escritas como asserções, no formato que
`finding.entity.ts` e `control-lifecycle.ts` já usam.

- **Invariante A1 — unidade organizacional obrigatória na criação.** Um Ativo ou Processo criado por
  esta API **sempre** tem `orgUnitId`. O DTO o exige (`@IsUUID`, não opcional), espelhando
  `create-control-request.dto.ts:37`. A coluna anulável existe apenas para as linhas anteriores a
  esta fase.
- **Invariante A2 — a unidade precisa existir e estar dentro do escopo de quem cria.** Um
  `orgUnitId` fora do escopo do ator é recusado exatamente como um inexistente (§6).
- **Invariante A3 — nome não é identidade.** Dois registros podem ter o mesmo nome, inclusive na
  mesma unidade. A identidade é `id`, e `code` é o identificador legível único. Nenhuma restrição de
  unicidade sobre `name` é criada.
- **Invariante A4 — nome não vazio.** `name` é obrigatório e não pode ser só espaço em branco.
- **Invariante A5 — inativo não aceita vínculo novo.** Já vigente; ver §3.
- **Invariante A6 — o código nunca é aceito do cliente.** É gerado pelo servidor. Um `code` enviado
  no corpo é rejeitado como propriedade desconhecida pelo pipe de validação global, como já ocorre
  com `code`, `status` e `version` em Controles.

---

## §5 — Autoridade

Oito permissões novas, quatro por domínio, agregadas ao catálogo estático
`apps/api/src/permission-catalogue.ts`. Reusam valores de `PermissionAction` existentes — **nenhuma
ação nova** (D-7).

| Permissão | Ação reusada | Governa |
|---|---|---|
| `asset:view` / `process:view` | `VIEW` | listar e ler |
| `asset:create` / `process:create` | `CREATE` | cadastrar |
| `asset:edit` / `process:edit` | `EDIT` | alterar nome, descrição, unidade |
| `asset:administer` / `process:administer` | `ADMINISTER` | desativar e reativar |

### O que os papéis semeados recebem, e por quê isto é obrigatório

Hoje a **única** autoridade que dá acesso ao inventário é `risk:view`. Depois desta fase, é
`asset:view` / `process:view`. Todo papel que hoje enxerga o inventário por ter `risk:view`
**precisa** receber as duas leituras novas, ou perde acesso silenciosamente — um seletor de vínculo
vazio, sem erro.

Esta é a mesma classe de defeito que o papel "Audit Lead" produziu na fase anterior (autoridade de
escrita semeada sem a de leitura correspondente), e a guarda estrutural que nasceu de lá,
`audit-engagement-write-implies-read.spec.ts`, é estendida aqui para cobrir os dois recursos novos:
todo papel semeado que escreve um ativo consegue lê-lo.

---

## §6 — Escopo organizacional

Toda leitura e toda escrita atravessa `ScopeFilter`. Os repositórios estendem `ScopedRepository`
com `scopeField = 'orgUnitId'`, como `ControlScopedRepository` já faz.

**Semântica de `NULL`, registrada porque é a pergunta que volta**: `applyScopeToWhere` gera
`orgUnitId IN (...)`, e `NULL IN (...)` nunca é verdadeiro em SQL. Uma linha sem unidade é portanto
invisível a qualquer ator com escopo por unidade, e visível apenas a escopo `GLOBAL` — que só existe
a partir de uma concessão explícita e auditada. **Não há caminho em que `NULL` seja lido como
"visível a todos"**, e é por isso que a coluna pode continuar anulável sem abrir um buraco.

**Não divulgação**: um registro fora do escopo responde **exatamente** como um inexistente — `404`
na leitura direta, e a mesma recusa de "não encontrado" nas operações que o referenciam. Nunca
`403`. `403` fica reservado a quem enxerga o registro e não tem a permissão da ação específica.

**Consequência aceita, e a tarefa que ela gera**: as duas linhas de fixture têm `orgUnitId` nulo.
Assim que a listagem passar a aplicar escopo, elas somem para atores escopados por unidade. Isto é a
correção funcionando — mas quebraria qualquer teste que dependa de vê-las com um usuário escopado.
A semeadura passa a atribuir uma unidade organizacional às duas, **na mesma tarefa** que aplica o
escopo, nunca depois.

---

## §7 — Auditoria

| Ação | Tipo de entidade | Registra |
|---|---|---|
| `asset.created` / `process.created` | `ASSET` / `PROCESS` | valores novos, incluindo `orgUnitId` e `code` gerado |
| `asset.updated` / `process.updated` | idem | valores anteriores **e** posteriores |
| `asset.deactivated` / `asset.reactivated` | idem | `isActive` anterior e posterior |
| recusa por escopo sobre registro existente | idem | `outcome = DENIED`, pelo mesmo componente que os demais domínios já usam |

O *field allow-list* de auditoria dos dois tipos novos é declarado explicitamente, como
`audit-engagement-audit-allowlist.ts` faz — nunca "tudo o que houver no objeto".

---

## §8 — Portes compartilhados, e as leituras diretas que eles substituem

Dois portes novos em `apps/api/src/shared/grc-ports/`, ao lado dos quatro existentes:

```ts
// asset-directory.port.ts  (e process-directory.port.ts, idêntico em forma)
interface AssetDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string | undefined;   // OBRIGATORIAMENTE exposto — ver abaixo
  readonly isActive: boolean;
}
```

**`orgUnitId` precisa estar no porte.** É o campo que o chamador compara com o escopo do ator antes
de gravar um vínculo (ADR-020 parte 4). Um porte que o esconde torna a parte 4 impossível de
cumprir — e foi exatamente essa a forma do gap que F-46 fechou para Risco→Controle.

**O que deixa de existir**: as duas leituras diretas às tabelas.

| Hoje | Depois |
|---|---|
| `modules/controls/infrastructure/reference-registry-lookup.repository.ts` lê `prisma.asset`/`prisma.process` | consome `AssetDirectoryPort`/`ProcessDirectoryPort` |
| `modules/risk/infrastructure/prisma-registry.repository.ts` lê as duas tabelas para `findById` e `list` | `findById` consome os portes; `list` deixa de existir aqui — a listagem vai para os módulos donos (D-5) |

Os adaptadores são fornecidos pelos módulos novos e ligados no *composition root*, como
`ControlDirectoryPort` já é.

---

## §9 — Relações: reusadas, nunca recriadas

As quatro tabelas de vínculo **já existem** e não são tocadas por esta fase (FR-013):

| Tabela | Linha no schema | Forma |
|---|---|---|
| `RiskAssetLink` | 1623 | `linkedAt`/`linkedBy`/`unlinkedAt`/`unlinkedBy` |
| `RiskProcessLink` | 1602 | idem |
| `ControlAssetLink` | 1513 | idem |
| `ControlProcessLink` | 1493 | idem |

O que muda **não é a tabela**, é a verificação feita antes de gravar nela: os dois casos de uso de
`modules/risk` passam a verificar o `orgUnitId` do alvo contra o escopo do ator e a exigir
`asset:view`/`process:view` do lado referenciado — a forma que `control-asset-link.usecase.ts` já
tem e que `control-link.usecase.ts` recebeu em F-46.

`GET /assets/{id}` e `GET /processes/{id}` mostram a que riscos e a que controles o registro está
vinculado (FR-008) **lendo** essas tabelas pelo lado do dono — sem criar tabela nem tipo de vínculo
novo.

---

## §10 — Aplicação das cinco partes do ADR-020

Não são pares novos — são os quatro que já existem, e a tabela abaixo é a conferência de que a
correção desta fase os deixa todos conformes. As duas linhas em **negrito** são as que estão
abertas hoje.

| Par | 1. Tabela nomeada | 2. FK `Restrict` | 3. Porte em `shared/` | 4. Escopo do alvo verificado antes de gravar | 5. Permissão dos dois lados |
|---|---|---|---|---|---|
| Controle → Ativo | `ControlAssetLink` | sim | `AssetDirectoryPort` (novo, substitui leitura direta) | **já sim** | `control:edit` + `asset:view` (hoje sem a segunda) |
| Controle → Processo | `ControlProcessLink` | sim | `ProcessDirectoryPort` (novo) | **já sim** | `control:edit` + `process:view` |
| **Risco → Ativo** | `RiskAssetLink` | sim | `AssetDirectoryPort` (novo) | **NÃO hoje — corrigido nesta fase** | `risk:edit` + `asset:view` (nova) |
| **Risco → Processo** | `RiskProcessLink` | sim | `ProcessDirectoryPort` (novo) | **NÃO hoje — corrigido nesta fase** | `risk:edit` + `process:view` (nova) |

A guarda de regressão desta correção é **estrutural** e cobre todo caso de uso de vínculo em
`modules/risk` e `modules/controls` — não as duas instâncias relatadas. F-46 corrigiu um irmão e
deixou dois; uma guarda escrita só para os dois de hoje repetiria o erro na próxima vez.

---

## §11 — `Cache-Control`

Nenhuma resposta desta fase carrega valor derivado calculado no momento da leitura a partir de
estado mutável de outro módulo — a condição que obrigou `Cache-Control: no-store` em
`RequirementController` na Fase 3. Toda propriedade é coluna gravada por escrita anterior.

A exceção aparente são os vínculos exibidos em `GET /assets/{id}`: são leitura de tabelas de
vínculo, não cálculo. **Nenhum endpoint desta fase declara `no-store`**, e isto é declarado aqui
explicitamente em vez de presumido por omissão — a tarefa de validação confirma, não supõe.
