# Data Model — Superfície de Papéis e Permissões

**Feature**: `015-roles-permissions-surface` · **Spec**: [spec.md](./spec.md) ·
**Research**: [research.md](./research.md) · **Date**: 2026-09-13

> **Esta fase não modela nada.**
>
> Não há entidade nova. Não há migração. Não há alteração de schema — nenhuma coluna, nenhuma
> tabela, nenhum enum, nenhum índice. Nenhuma constraint muda, nenhum `onDelete` muda, nenhuma
> chave muda.
>
> O que esta fase acrescenta ao servidor é **uma operação de leitura agregada**
> (`GET /admin/roles/summary`, `spec.md` FR-039), que lê as mesmas tabelas que já existem e não
> escreve em nenhuma. Tudo o mais é interface.
>
> Este documento existe, apesar disso, por duas razões: registrar **com precisão** quais campos a
> tela consome e de onde eles vêm — de modo que ninguém precise adivinhar depois — e registrar,
> por escrito, **o que deliberadamente não existe** (§4), porque a tela fala sobre controle de
> acesso e uma afirmação errada de interface sobre o modelo é, aqui, um defeito de segurança de
> entendimento.

---

## §1 — Modelos lidos, como estão hoje

Nenhum destes quatro é alterado. Os campos abaixo foram lidos do schema, não deduzidos.

### `Role` — `apps/api/prisma/schema.prisma:711-723`

```
id           uuid        PK, default uuid(7)
name         text        UNIQUE
description  text        NOT NULL
isSystem     boolean     default false          -> coluna `is_system`
createdAt    timestamptz default now()          -> coluna `created_at`
updatedAt    timestamptz auto                   -> coluna `updated_at`

rolePermissions  RolePermission[]
userRoles        UserRole[]
@@map("roles")
```

**Seis campos, e nenhum a mais.** Não existem `slug`, `isBuiltIn`, `protected`, `parentId`,
`color`, `level`, `tier` nem `isPrivileged`. A ausência de `parentId` é a forma do schema de dizer
que não há herança (§4.1); a ausência de um campo de privilégio é o que ADR-021 mantém assim
(§4.3).

`isSystem` é o único discriminador de tipo, e ele governa o que o servidor aceita alterar: em papel
de sistema, `role-admin.service.ts:173-178` recusa `name` e `permissionIdentifiers` com erro de
validação e **permite** `description` — que é exatamente o que `spec.md` FR-031 pede que a interface
reflita. Papel criado pela API nunca é de sistema: `prisma-role.repository.ts:69` grava
`isSystem: false` literal, sem ler nada do pedido.

### `Permission` — `apps/api/prisma/schema.prisma:697-709`

```
id           uuid              PK, default uuid(7)
identifier   text              UNIQUE      -- 'risk:view', 'role:administer'
resource     text              NOT NULL    -- 'risk', 'role', 'audit-engagement'
action       PermissionAction  NOT NULL    -- enum
description  text              NOT NULL
createdAt    timestamptz       default now()
updatedAt    timestamptz       auto

rolePermissions  RolePermission[]
@@map("permissions")
```

O catálogo é semeado a partir das *permission definitions*, cuja forma no domínio tem quatro campos
— `identifier`, `resource`, `action`, `description`
(`apps/api/src/core/authorization/domain/permissions.ts:103-108`). A resposta HTTP espelha os mesmos
quatro (`role-response.mapper.ts:8-13`).

**Não existe metadado de módulo/área nesta tabela nem no DTO.** O agrupamento por módulo que a tela
apresenta é taxonomia de cliente (§3.2) — e é por isso que o filtro por módulo só pode ser cliente
nesta fase (`research.md` R-009).

### `RolePermission` — `apps/api/prisma/schema.prisma:725-734`

```
roleId        uuid  -> roles(id)        onDelete: Restrict
permissionId  uuid  -> permissions(id)  onDelete: Restrict

@@id([roleId, permissionId])
@@map("role_permissions")
```

Tabela de ligação N:M pura: sem colunas próprias, sem data de concessão, sem ator. Quem alterou o
conjunto de permissões de um papel está na trilha de auditoria, não aqui.

### `UserRole` — `apps/api/prisma/schema.prisma:740-752`

```
userId           uuid        -> users(id)  onDelete: Restrict   -- coluna `user_id`
roleId           uuid        -> roles(id)  onDelete: Restrict   -- coluna `role_id`
grantedByUserId  uuid        -> users(id)  onDelete: Restrict   -- coluna `granted_by_user_id`
grantedAt        timestamptz NOT NULL                           -- coluna `granted_at`

@@id([userId, roleId])
@@map("user_roles")
```

**A chave primária é o par `(userId, roleId)`, não `userId`.** Uma pessoa com três papéis tem três
linhas nesta tabela — é esse fato, e só ele, que torna `usersWithRoles` não-derivável por soma
(§2, `research.md` R-002).

**Nenhuma coluna de escopo.** A atribuição não é escopada; o escopo organizacional é uma segunda
dimensão, por usuário (§4.2).

### `OrgScopeGrant` — `apps/api/prisma/schema.prisma:807-820` — lido por ninguém nesta tela

Citado aqui apenas para fixar o contraste: `scopeType` (`GLOBAL | UNIT`), `orgUnitId` opcional,
`userId`, `grantedByUserId`, `grantedAt`. **Esta tela não consulta esta tabela.** Ela apenas
**explica** que o escopo existe e é concedido por usuário (`spec.md` FR-022), e só oferece detalhe
ou link quando o usuário atual estiver autorizado a consultá-lo (FR-023).

---

## §2 — A única forma nova: a resposta de `GET /admin/roles/summary`

Operação somente leitura, exigindo `role:administer`, sem parâmetros, sem corpo de requisição, sem
efeito colateral, atravessando o `PermissionGuard` como qualquer outra (`spec.md` FR-041). Contrato
emendado em `specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`, onde as demais
operações de papéis já vivem (`research.md` R-008).

```jsonc
// 200 application/json
{
  "totalRoles":      12,   // integer, >= 0
  "systemRoles":     12,   // integer, >= 0
  "customRoles":      0,   // integer, >= 0
  "usersWithRoles":   7    // integer, >= 0
}
```

| Campo | Tipo | Consulta conceitual | Observação |
|---|---|---|---|
| `totalRoles` | `integer`, `minimum: 0` | `SELECT COUNT(*) FROM roles` | Todos os papéis, de sistema e personalizados |
| `systemRoles` | `integer`, `minimum: 0` | `SELECT COUNT(*) FROM roles WHERE is_system = true` | Hoje, os 12 semeados |
| `customRoles` | `integer`, `minimum: 0` | `SELECT COUNT(*) FROM roles WHERE is_system = false` | Hoje, zero |
| `usersWithRoles` | `integer`, `minimum: 0` | `SELECT COUNT(DISTINCT user_id) FROM user_roles` | **Pessoas distintas**, nunca linhas |

**Invariante**: `totalRoles = systemRoles + customRoles`, por construção — `is_system` é
`boolean NOT NULL` (`schema.prisma:715`), sem terceiro valor possível. A invariante é verificável em
teste e não deve ser usada para *derivar* o terceiro número a partir dos outros dois: os três vêm da
mesma consulta agregada, no mesmo instante, e derivar um deles abriria a possibilidade de dois
valores discordantes lidos em momentos diferentes.

**`usersWithRoles` é `COUNT(DISTINCT user_id)` sobre `user_roles`** (`spec.md` FR-040, SC-004).
Quem tem dois papéis conta **uma vez**. Esta é a única das quatro contagens que não é derivável de
`GET /admin/roles`: aquela listagem traz `assignedUserCount` por papel
(`role-response.mapper.ts:21`, preenchido por `prisma-role.repository.ts:124-126` com
`userRole.count({ where: { roleId } })`), e somar esse campo entre papéis conta a mesma pessoa
tantas vezes quantos papéis ela tiver — porque a PK é o par (§1). Prisma não expõe um
`countDistinct` direto; as duas formas naturais de expressar a consulta são um `groupBy` por
`userId` (contando os grupos) ou SQL bruto — a escolha é de implementação, o resultado é o mesmo e
é ele que o teste de SC-004 fixa, com uma pessoa detendo dois papéis.

**O que a contagem deliberadamente não filtra**: status do usuário. `User.status`
(`schema.prisma:513`, enum `UserStatus`, default `ACTIVE`) existe, mas `usersWithRoles` conta toda
pessoa com ao menos uma atribuição, ativa ou não — porque `assignedUserCount`, o número por papel
que a mesma tela exibe ao lado, também não filtra (`prisma-role.repository.ts:124-126`). Duas
contagens da mesma população precisam contar a mesma população; filtrar uma e não a outra produziria
uma tela onde a soma dos papéis não guarda relação nenhuma com o agregado, sem que nada explique por
quê. Se um dia a distinção passar a importar, ela vale para as duas, com especificação própria.

**O que a operação não faz** (`spec.md` FR-042): não altera `Role`, não cria tabela, não muda escopo
organizacional, não muda auditoria, não muda a resolução de permissões. É leitura agregada de duas
tabelas existentes.

---

## §3 — Modelos de leitura do cliente

Nenhum destes é entidade. São projeções montadas no navegador a partir de respostas já contratadas.
Cada linha nomeia o campo de API de onde o dado vem.

### §3.1 Cartão de papel (lista) — `spec.md` FR-006, FR-007

Fonte única: um item de `data[]` de `GET /admin/roles` (schema `Role` do contrato;
`role-response.mapper.ts:15-22` é a forma real devolvida).

| O que o cartão mostra | De onde vem | Como |
|---|---|---|
| Nome | `Role.name` (`role-response.mapper.ts:17`) | Texto integral; quebra, nunca trunca |
| Tipo (Sistema / Personalizado) | `Role.isSystem` (`:19`) | `RoleTypeTag`, etiqueta neutra com texto nos dois casos e cadeado como segundo canal (012 §2.2, mantida) |
| Classificação de privilégio | **derivada** de `Role.permissions[].identifier` (`:20`, `:9`) | Verdadeira com `role:administer`, `user:administer` ou `org_unit:administer`. Apresentação apenas — ADR-021 |
| Descrição resumida | `Role.description` (`:18`) | Truncada **só visualmente** (`line-clamp`); o texto persistido não muda e permanece inteiro no DOM e no painel (`spec.md` FR-008) |
| Módulos alcançados | **derivados** de `Role.permissions[].resource` (`:10`) | Mapeados por `RESOURCE_AREA` (`permission-grouping.ts:63-84`), rotulados por `admin.roles.permissionCatalog.areas` (`apps/web/src/lib/messages/admin.ts:198-213`), ordenados por **concentração de permissões** (012 §2.3, mantida), excedente resumido em "+N módulos" com a lista completa disponível a leitor de tela |
| Contagem de permissões | `Role.permissions.length` (`:20`) | Contagem local do array já recebido — nenhuma requisição extra |
| Contagem de usuários | `Role.assignedUserCount` (`:21`) | Já vem por papel na listagem |

Nenhum campo do cartão dispara requisição própria: todos saem do mesmo item da página já carregada
(`spec.md` NFR-006, SC-007).

### §3.2 Painel de detalhe — `spec.md` FR-009 a FR-017

**Cabeçalho**: os mesmos campos do cartão (nome, tipo, privilégio, descrição **completa**), mais
três contagens — permissões (`Role.permissions.length`), usuários (`Role.assignedUserCount`) e
módulos (quantidade de áreas distintas derivadas de `Role.permissions[].resource`).

**Aba Permissões**, por grupo de módulo:

| O que aparece | De onde vem |
|---|---|
| Nome do módulo | `admin.roles.permissionCatalog.areas[area]` (`admin.ts:198-213`), com `area` resolvida por `RESOURCE_AREA` (`permission-grouping.ts:63-84`) e ordem das áreas por `AREA_ORDER` (`:45-60`) quando a ordem por concentração empatar |
| Contagem do módulo | Quantidade de permissões do papel naquela área |
| Rótulo em pt-BR de cada permissão | `admin.roles.permissionCatalog.verbs[verbo]` (`admin.ts:237`) + `...resources[recurso]` (`:214`), o verbo derivado do **identificador**, nunca do campo `action` (012 §2.3, mantida — `control:test` tem `action = ASSESS` e seria rotulado "Avaliar" em vez de "Testar") |
| Identificador técnico, sob demanda | `Permission.identifier` (`role-response.mapper.ts:9`), revelado por "Ver identificadores técnicos" (`spec.md` FR-016). O identificador **não** é alterado |
| Descrição da permissão | `Permission.description` (`:12`) — hoje **em inglês** (F-63), sempre como texto secundário, nunca como rótulo primário (`spec.md` FR-017) |

O painel também afirma, em texto, o modelo de autorização real (`spec.md` FR-015): permissões
concedidas **diretamente** pelo papel, **sem herança entre papéis**, acesso efetivo de uma pessoa é
a **união** dos papéis atribuídos a ela. Essa afirmação é verdadeira contra
`prisma-permission.repository.ts:33-48` — um `JOIN` plano deduplicado por `Set` — e §4.1 registra
por que ela precisa estar escrita.

### §3.3 Aba Usuários — `spec.md` FR-018 a FR-025

Dois estados, decididos pela permissão do usuário **atual**, nunca pelo papel sendo lido.

**Com `user:administer`** — uma requisição paginada por abertura da aba (`spec.md` FR-024), a
`GET /admin/users?roleId=<uuid>` (`apps/api/src/core/identity/presentation/admin-users.controller.ts:82-105`).
Por pessoa, exatamente os campos que `UserResponse` já traz
(`apps/api/src/core/identity/presentation/dto/admin-user-response.mapper.ts:24-35`):

| Campo exibido | Campo de API |
|---|---|
| Nome | `UserResponse.fullName` (`:27`) |
| E-mail | `UserResponse.email` (`:26`) |
| Cargo | `UserResponse.jobTitle` (`:28`, anulável) |
| Status | `UserResponse.status` (`:29`) |
| Unidade organizacional primária | `UserResponse.primaryOrgUnit` (`:30`, anulável — `{ id, code, name }`, `:13-17`) |
| Demais papéis da pessoa | `UserResponse.roles[]` (`:31` — `{ id, name }`, `:19-22`) |

Os demais papéis são apresentados como **proveniência real de acesso** e nunca rotulados como
herança (`spec.md` FR-025) — é exatamente a união de §3.2, vista do lado da pessoa.

**Escopo organizacional não aparece aqui**: `UserResponse` não carrega `scopeGrants`. Esse campo só
existe em `UserDetailResponse` (`admin-user-response.mapper.ts:37-39`), ou seja, no detalhe por
usuário — e por isso o painel **explica** o escopo em vez de exibi-lo (`spec.md` FR-022, FR-023).

**Sem `user:administer`** — nenhuma requisição a `/admin/users` é feita. A aba mostra **apenas**
`Role.assignedUserCount` (`role-response.mapper.ts:21`), que a listagem de papéis já entregou
legitimamente atrás de `role:administer`, e uma explicação de que listar pessoas exige
`user:administer`. **Nenhum nome, e-mail, cargo, status, unidade ou qualquer outro dado pessoal
existe nesse estado** — nem na tela, nem em memória, nem em resposta alguma (`spec.md` FR-020,
SC-006). `role:administer` não implica `user:administer`, e é proibido criar endpoint alternativo
para contornar a fronteira (FR-019).

### §3.4 Linha de indicadores — `spec.md` FR-001 a FR-004

Os quatro valores vêm, sem exceção, de `GET /admin/roles/summary` (§2). Nenhum número
*hard-coded*, nenhum derivado da listagem. Os três primeiros são controles interativos que aplicam
o filtro de tipo correspondente; o quarto ("Usuários com papéis") não navega nem filtra (FR-003).

---

## §4 — O que **não** é modelado

Esta seção é a razão principal de o documento existir. Os três itens abaixo não estão ausentes por
esquecimento: cada um é uma propriedade deliberada do modelo, e a interface desta fase precisa
falar de acordo com ela.

### §4.1 Herança ou composição entre papéis — não existe, em nenhuma camada

- `Role` não tem auto-relação: não há `parentId`, `parentRole`, `childRoles` nem tabela de
  composição (`schema.prisma:711-723`, seis campos e duas relações, ambas para tabelas de ligação).
- A resolução efetiva não tem recursão, CTE nem expansão transitiva: é um único `findMany` sobre
  `rolePermission` filtrando por `role.userRoles.some({ userId })`, deduplicado por `Set`
  (`prisma-permission.repository.ts:33-48`).

**Consequência para a interface, e ela é obrigatória**: a tela **não** pode usar "herdada de" nem
qualquer construção que sugira hierarquia entre papéis (`spec.md` FR-015, SC-003 — zero
ocorrências). O que é verdade, e o que o painel afirma, é: um papel concede diretamente as
permissões que tem; uma pessoa pode a união do que seus papéis concedem. Um rótulo de herança seria
uma afirmação falsa da interface sobre o modelo de segurança — o tipo de defeito que não quebra
nenhum teste e engana quem administra acesso.

### §4.2 Escopo organizacional na atribuição de papel — não existe

`UserRole` tem quatro colunas e nenhuma delas é escopo (`schema.prisma:740-752`). Permissão é
global ao usuário; o escopo organizacional é uma **segunda dimensão, por usuário**, materializada em
`OrgScopeGrant` (`schema.prisma:807-820`) e aplicada no repositório por filtro de escopo, não no
guard.

**Consequência para a interface**: o painel **não** apresenta escopo como propriedade da atribuição
`UserRole` (`spec.md` FR-022). Ele explica que o escopo é concedido por usuário, e só oferece
detalhe ou link quando o usuário atual estiver autorizado a consultá-lo (FR-023). "Este papel vale
na unidade X" seria falso: o mesmo papel, na mesma pessoa, alcança tudo o que os grants daquela
pessoa alcançam.

### §4.3 Flag de privilégio — não existe, e não passa a existir

Não há `isPrivileged` em `Role` (§1), não há coluna nova, não há campo novo em `RoleResponse`
(`role-response.mapper.ts:15-22` permanece com os seis campos que já tem) e não há nada disso no
contrato. A classificação apresentada pela tela é derivação de apresentação, calculada no cliente
sobre as permissões que a resposta já traz, proibida de ser consultada por `PermissionGuard`, pela
resolução de permissões, por segregação de funções ou por qualquer decisão de segurança.

A fronteira, o que aconteceria se alguém a violasse e quais guardas a prendem estão em
**ADR-021** (`docs/architecture/decisions.md`), com a justificativa do critério em `research.md`
R-001.

### §4.4 O que também não ganha tabela nem rota

- **Não existe** rota que liste os usuários de um papel (`/admin/roles/{roleId}/users`), e esta fase
  **não a cria**: o equivalente é `GET /admin/users?roleId=`, atrás de `user:administer`
  (`admin-users.controller.ts:82-105`) — e criar uma alternativa protegida só por `role:administer`
  é explicitamente proibido (`spec.md` FR-019).
- **Não existe** tabela de histórico, de rascunho de edição ou de "alterações pendentes". O resumo
  do que será acrescentado e removido antes de salvar (`spec.md` FR-029) é estado de componente,
  descartado ao cancelar (FR-032), e o que persiste continua sendo um `PATCH /admin/roles/{roleId}`
  com a validação do servidor intacta (FR-033).
- **Não existe** taxonomia de módulo no servidor. `PermissionArea` é e continua sendo taxonomia de
  cliente (`permission-grouping.ts:45-84`, rótulos em `admin.ts:198-213`); criar uma segunda é
  proibido (`spec.md` FR-013).
