# 015 — Superfície de Papéis e Permissões: registro operacional

Fase executada em quatro ondas sequenciais/paralelas (`plan.md` §2). Este documento é escrito pela
**Onda 4**, cuja atribuição era **provar**, não construir: remoção comprovada do código antigo,
migração de cobertura, testes de unidade dos componentes da Onda 3, E2E reescrito, varredura de
acessibilidade permanente, captura renderizada e medição de fechamento.

Formato herdado de `specs/012-admin-roles-screen/STATE.md` §5: número real antes e depois, nunca
"passou".

---

## §1 — Relação com a fase 012

`specs/012-admin-roles-screen/STATE.md` cobriu **esta mesma tela**, no mesmo dia em que esta fase foi
especificada. Não foi descartado. Três decisões dele continuam em vigor sem alteração, duas foram
revertidas por pedido explícito do usuário, e a reversão está registrada — reverter uma decisão
medida sem dizer por quê é como um registro "concluído" falso nasce
(`specs/005-audit-findings/STATE.md` §3).

| Decisão de 012 | Nesta fase | Onde está guardada agora |
|---|---|---|
| §2.3 — áreas ordenadas **por concentração de permissões**, não por ordem de produto | **Mantida** | `role-filtering.test.ts` (`roleModuleReach`, 3 testes) + `role-card.test.tsx` ("shows the modules in concentration order") |
| §2.2 — tipo do papel como etiqueta neutra, com texto nos **dois** casos e cadeado como segundo canal | **Mantida.** `RoleTypeTag` reaproveitado como está | `role-type-tag.test.tsx`; reafirmado em `role-card.test.tsx` e `role-detail-panel.test.tsx` |
| §2.3 — verbo derivado do **identificador**, nunca do campo `action` | **Mantida** | `role-permissions-tab.test.tsx` (`control:test` ⇒ "Testar", não "Avaliar") |
| §2.1 — `DataTable` como componente da lista | **Revertida** (D-03, pedido do usuário: lista em cartões) | — |
| §2.4 — `Dialog` em vez de `Sheet`, porque `sheet.tsx` não tinha a restauração de foco de D-15 | **Revertida, com a causa corrigida antes** (D-05/T001: o hook foi portado para `sheet.tsx`) | `e2e/admin-roles.spec.ts` (overlay a 390 px fecha com `Esc` e devolve o foco ao cartão) |

As **quatro correções de §3 de 012 são regressões proibidas**, e cada uma tem hoje um guarda na
implementação nova:

| Correção de 012 §3 | Guarda atual |
|---|---|
| 1. Todo salvamento de papel do sistema falhava com 422 (payload levava `permissionIdentifiers`) | `role-admin-view.test.tsx` "sends ONLY the description when saving a system role"; `e2e/admin-roles.spec.ts` "a protected (system) role is legible and locked" |
| 2. O diálogo de edição não cabia em 1280×720 | Estruturalmente impossível agora: o `DetailPanel` tem rodapé **fixo**. `e2e/admin-roles.spec.ts` afirma `toBeInViewport()` sobre "Salvar alterações" |
| 3. Foco em `<body>` por remontagem de coluna | A causa (`buildRoleAdminColumns` + `flexRender`) deixou de existir com a tabela. `role-admin-view.test.tsx` "returns focus to the card on close" |
| 4. Foco em `<body>` por abertura pelo `onSelect` do menu | O menu de linha deixou de existir. `e2e/admin-roles.spec.ts` (teclado: `Enter` abre, `Esc` fecha, foco volta ao cartão) |

---

## §2 — T048: inventário de consumidores, por `grep`

Pedido explicitamente pelo usuário: **não confiar na afirmação da Onda 3, verificar**. A busca foi
feita por **símbolo exportado**, não por nome de arquivo.

| Símbolo | Ocorrências fora dos 6 arquivos candidatos | Natureza |
|---|---|---|
| `buildRoleAdminColumns` | 1 | comentário em `e2e/admin-roles.spec.ts` |
| `RolePermissionOverview` | 0 (à época do inventário) | — |
| `deleteBlockedReason` | 0 como import; o nome reaparece como **variável local** em `role-detail-panel.tsx:110` | reimplementado, não importado |
| `ROLE_ADMIN_COLUMN_IDS` | 0 | — |
| `RoleDetailsDialog` | 4 | comentários em `accessibility.spec.ts`, `admin-roles.spec.ts`, `permission-checklist.tsx`, `role-admin-view.tsx` |
| `RoleEditDialog` | 3 | comentários em `admin-roles.spec.ts`, `role-admin-view.tsx`, `use-role-editor.ts` |
| `RoleDetailsDialogProps` / `RoleEditDialogProps` | 0 | — |

**Resultado: zero `import` em qualquer camada.** Toda ocorrência externa é prosa em comentário.
A afirmação da Onda 3 estava correta — mas só se sabe disso porque foi verificada.

Um achado do inventário que a Onda 3 não mencionou: `deleteBlockedReason` **não foi importado, foi
reescrito** em `role-detail-panel.tsx` como `roleDeleteBlockedReason`, com a mesma regra e o mesmo
texto — e ficou **sem nenhum teste** até esta onda. Uma regra de negócio migrada por cópia, sem a
cobertura que a acompanhava, é exatamente o que D-07 existe para impedir.

---

## §3 — T049: tabela de equivalência de cobertura

Cada comportamento guardado pelos três arquivos de teste removidos, e onde ele é guardado agora.
**Comportamento sem equivalente bloqueia a remoção** — os que faltavam foram escritos ANTES de
qualquer arquivo sair do disco.

### `role-admin-columns.test.tsx` (15 testes)

| Comportamento | Equivalente novo | Estado |
|---|---|---|
| `deleteBlockedReason`: `null` para papel personalizado sem atribuição | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| `deleteBlockedReason`: papel do sistema tem precedência mesmo se atribuído | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| `deleteBlockedReason`: singular "Atribuído a 1 usuário" | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| `deleteBlockedReason`: plural | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| `RolePermissionOverview`: "Nenhuma permissão" | `role-card.test.tsx` | **escrito nesta onda** |
| `RolePermissionOverview`: "1 permissão" | `role-card.test.tsx` | **escrito nesta onda** |
| `RolePermissionOverview`: "N permissões" | `role-card.test.tsx` | **escrito nesta onda** |
| Ranking de áreas por contagem, empate por ordem de produto | `role-filtering.test.ts` (regra) + `role-card.test.tsx` (apresentação) | já existia (Onda 3) + reforçado |
| Lista sr-only completa das áreas, mesmo com prévia truncada | `role-card.test.tsx` | **escrito nesta onda** |
| Nome do papel é um botão que abre os detalhes | `role-card.test.tsx` + `role-admin-view.test.tsx` | já existia + reforçado |
| Menu de linha: "Ver detalhes" sempre; "Editar"/"Excluir" só com `role:administer` | `role-detail-panel.test.tsx` (gating do rodapé do painel) | **escrito nesta onda** |
| "Excluir" habilitado para papel excluível, chama `onDelete` | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| "Excluir" desabilitado + razão para papel do sistema, nunca chama `onDelete` | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| "Excluir" desabilitado + razão de atribuição | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| Nenhuma coluna com ordenação habilitada | **sem equivalente — obsoleto por decisão** | ver abaixo |
| `onEdit` disparado só depois de o menu fechar (`onCloseAutoFocus`) | **sem equivalente — mecanismo removido** | ver abaixo |

### `role-details-dialog.test.tsx` (8 testes)

| Comportamento | Equivalente novo | Estado |
|---|---|---|
| Título = nome, descrição completa sem truncar | `role-admin-view.test.tsx` + `role-detail-panel.test.tsx` | já existia + reforçado |
| Três contagens (usuários, permissões, áreas) | `role-admin-view.test.tsx` | já existia (Onda 3) |
| Nota de restrição do papel do sistema, e **não** a de atribuição | `role-detail-panel.test.tsx` (precedência asserida) | **escrito nesta onda** |
| Nota de restrição por atribuição | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| Nenhuma nota para papel personalizado excluível | `role-detail-panel.test.tsx` | **escrito nesta onda** |
| "Este papel não concede nenhuma permissão." | `role-permissions-tab.test.tsx` | **escrito nesta onda** |
| Permissões por área, com verbo, identificador e descrição — **nunca um checkbox** | `role-permissions-tab.test.tsx` | **escrito nesta onda** |
| "Fechar" devolve `onOpenChange(false)` | `role-detail-panel.test.tsx` + `role-admin-view.test.tsx` (restauração de foco) | **escrito nesta onda** + já existia |

### `role-edit-dialog.test.tsx` (4 testes)

| Comportamento | Equivalente novo | Estado |
|---|---|---|
| Papel do sistema: nome e **todos** os checkboxes travados | `role-edit-fields.test.tsx` | **escrito nesta onda** |
| Papel do sistema: `PATCH` envia **somente** `{ description }` | `role-admin-view.test.tsx` + `e2e/admin-roles.spec.ts` | já existia (Onda 3) |
| Papel personalizado: nome e checkboxes editáveis | `role-edit-fields.test.tsx` | **escrito nesta onda** |
| Papel personalizado: envia nome, descrição e identificadores | `role-admin-view.test.tsx` + `e2e/admin-roles.spec.ts` | já existia (Onda 3) |

### Os dois comportamentos sem equivalente, e por quê

Ambos são **obsoletos por decisão registrada**, não perdidos. Registrados explicitamente porque
"obsoleto" é precisamente a palavra sob a qual uma regressão se esconde.

1. **"Nenhuma coluna habilita ordenação."** Era uma afirmação sobre a tabela, e a tabela foi
   revertida por D-03 a pedido do usuário. A tela **ganhou** ordenação real (FR-005b: nome A–Z/Z–A,
   quantidade de permissões, quantidade de usuários), nomeável pelo próprio controle, guardada por
   `role-filtering.test.ts` (`sortRoles`, 4 testes). O comportamento antigo não foi removido em
   silêncio: foi substituído por um melhor, com mais cobertura do que tinha.
2. **"`onEdit` só dispara depois de o menu fechar."** Era o conserto de 012 §3.4 para um menu de
   linha que não existe mais — o painel abre a partir de um `<button>` comum, nunca de um
   `menuitem`, então a causa (o item de menu ainda no DOM durante a animação de saída sendo
   registrado como destino do foco) não tem como ocorrer. A **garantia** que aquele conserto
   protegia — o foco volta a quem abriu — continua guardada, agora em três lugares:
   `role-admin-view.test.tsx`, `e2e/admin-roles.spec.ts` (teclado e overlay) e
   `accessibility.spec.ts`.

---

## §4 — T050: o que foi removido, e o que se recusou a sair

**Removidos** (6 arquivos, `git rm`), depois de a tabela de §3 estar completa:

- `role-admin-columns.tsx` + `role-admin-columns.test.tsx`
- `role-details-dialog.tsx` + `role-details-dialog.test.tsx`
- `role-edit-dialog.tsx` + `role-edit-dialog.test.tsx`

**Não tocados, deliberadamente:**

- `role-permissions-summary.tsx` — consumido por `user-roles-dialog.tsx:27`, na tela de Usuários.
  Fora do escopo desta fase e vivo.
- `role-create-dialog.tsx` — FR-034 o mantém fora do escopo. Continua sendo o consumidor de boa
  parte de `admin.roles.form.*`.
- `role-delete-dialog.tsx`, `permission-checklist.tsx`, `role-type-tag.tsx` — vivos e consumidos.

`typecheck` das quatro workspaces ficou limpo imediatamente após a remoção, confirmando a ausência
de importador.

### §4.1 — Chaves de catálogo sem consumidor (listadas, **não** removidas)

Mexer em `apps/web/src/lib/messages/admin.ts` agora é risco desproporcional: é arquivo da Onda 2,
tem consumidores vivos entremeados, e nada quebra por uma chave órfã. Ficam registradas para uma
decisão posterior.

Grupos **inteiramente** órfãos:

- `admin.roles.table.*` — 8 chaves (`caption`; `columns.role/permissions/assignedUserCount/actions`;
  `summary`; `openDetailsLabel`; `assignedUsersLabel`)
- `admin.roles.permissionOverview.*` — 5 chaves (`count`, `areaCount`, `moreAreas`, `areasLabel`,
  `none`)
- `admin.roles.empty.*` — 2 chaves (`title`, `description`), superadas por `states.emptyFiltered` e
  `states.emptyNone`, que são dois estados distintos e não um

Grupos **parcialmente** órfãos:

- `admin.roles.details.*` — 9 de 10 órfãs; sobrevive apenas `grantedPermissions`, consumida por
  `role-permissions-tab.tsx:109`
- `admin.roles.actions.*` — 3 órfãs (`viewDetails`, `edit`, `rowActionsLabel`); sobrevivem `delete`,
  `deleteBlockedSystem`, `deleteBlockedAssigned`, consumidas por `role-detail-panel.tsx`
- `admin.roles.form.*` — 3 órfãs (`editTitle`, `submitEdit`, `systemRoleNotice`); o restante é do
  `role-create-dialog.tsx`, intocado por FR-034

**Total: 30 chaves sem consumidor.** Nenhuma foi removida.

---

## §5 — T051 a T054: o que foi escrito

### §5.1 Testes de unidade (6 arquivos novos, 48 testes)

| Arquivo | Testes | Papel |
|---|---|---|
| `role-card.test.tsx` | 12 | migra `RolePermissionOverview`; contagens, chips de módulo, seleção por `aria-current` **e** por texto, clamp visual |
| `role-detail-panel.test.tsx` | 12 | migra `deleteBlockedReason` (4 casos) e as notas de restrição; gating de `role:administer` no rodapé |
| `role-permissions-tab.test.tsx` | 6 | migra a lista de permissões do diálogo; FR-015 sem "herdada de"; **nunca um checkbox**; identificadores sob demanda |
| `role-users-tab.test.tsx` | 7 | cenários 1 e 2 de `plan.md` §3 no nível de unidade; a asserção decisiva é **a requisição não ser feita** |
| `role-edit-fields.test.tsx` | 7 | migra o travamento de nome e checkboxes; tri-estado em forma **e** em palavras |
| `role-privilege-badge.test.tsx` | 4 | metade web do cenário 8: o distintivo é apresentação, sem controle e sem estado |

### §5.2 `e2e/admin-roles.spec.ts` — reescrito (12 testes)

O arquivo anterior descrevia uma tela que deixou de existir: esperava `Ver detalhes do papel …` (o
botão da linha da tabela), abria `RoleDetailsDialog`, operava um menu de linha. Foi **reescrito
contra a marcação real**, não adaptado por renomeação de seletor.

Os 16 fluxos pedidos pelo usuário estão cobertos: abrir a tela, pesquisar, filtrar (tipo e módulo),
selecionar, abrir/fechar o painel, expandir módulos, ver identificadores técnicos, alternar
Permissões/Usuários, iniciar edição, alterar permissões de papel editável, cancelar sem persistir,
salvar alteração válida, verificar papel protegido, verificar usuário sem autorização, e a ausência
de regressão de autorização.

**Os treze cenários de `plan.md` §3:**

| # | Cenário | Onde |
|---|---|---|
| 1 | `role:administer` sem `user:administer` — nenhum dado pessoal | `role-users-tab.test.tsx`, `role-admin-view.test.tsx` **e** `e2e/admin-roles.spec.ts` (sessão real) |
| 2 | `user:administer` presente — aba Usuários funciona | idem |
| 3 | Papel do sistema travado, razão visível | `role-edit-fields.test.tsx` + E2E |
| 4 | Papel personalizado — edição completa | `role-admin-view.test.tsx` + E2E |
| 5 | Alterar **nome** de papel do sistema é recusado | **API, suíte de contrato** — `apps/api/test/contract/admin-roles.spec.ts:249`; reafirmado contra o servidor no E2E ("the server refuses a system role rename", 422) |
| 6 | Alterar **permissionIdentifiers** de papel do sistema é recusado | **API, suíte de contrato** — mesmo teste (`:266`), que também confirma que `description` **é** aceita e que o `DELETE` é recusado |
| 7 | `usersWithRoles` conta pessoa multi-papel uma vez | **API** — `test/integration/role-summary.spec.ts:174` + `test/unit/get-roles-summary.usecase.spec.ts` |
| 8 | Classificação Privilegiado sem efeito sobre autorização | `role-privilege.test.ts` + `role-privilege-badge.test.tsx`; no servidor a prova é a **inexistência** do conceito, medida em §12.1 |
| 9 | Ausência de herança — permissão efetiva é união plana | **API, integração** — `test/integration/role-summary.spec.ts:291` |
| 10 | Acesso por teclado ao painel e ao overlay | E2E + `accessibility.spec.ts` |
| 11 | Restauração de foco (painel, overlay, edição) | `role-admin-view.test.tsx` + E2E + `accessibility.spec.ts` |
| 12 | `Esc` fecha o overlay | E2E (390 px) |
| 13 | Desktop e responsivo sem rolagem horizontal | E2E (1920→390) + captura |

Os cenários 5–9 **não foram reimplementados no navegador**: são propriedades do servidor, e uma
cópia em Playwright seria uma versão mais fraca de um teste mais forte. A localização de cada um foi
**confirmada por leitura**, não presumida — e a primeira versão desta tabela estava errada em dois
deles: citava um `apps/api/test/integration/role-admin.spec.ts` que **não existe** (os cenários 5 e 6
vivem na suíte de **contrato**) e situava o cenário 9 em "unidade" quando ele é de **integração**.
Corrigido antes de este documento ser fechado, pelo mesmo motivo que §9 existe.

**Limpeza por API em `afterEach`**, no modelo de 012 §4/§5 — cuja primeira versão deixou um papel
sobrando, visto numa captura. Aqui a limpeza **lança** quando o `DELETE` falha, em vez de seguir em
silêncio (ver §7.2).

**Marcadores de teste**: prefixo `e2e015r`, **sete** caracteres. Dois caracteres geram uma cadeia de
43 e colidem com o detector de token vazado de `information-disclosure.spec.ts` (F-45/F-54).

### §5.3 `e2e/accessibility.spec.ts` — bloco de papéis reescrito (5 → 10 varreduras)

Cobre agora, nos **dois temas**: a lista com os quatro indicadores carregados; o painel com os 13
módulos expandidos e os identificadores revelados (70 permissões no DOM); a aba Usuários com o
roster carregado; o modo de edição sobre papel do sistema travado; o overlay a 390 px; e o caminho
de teclado (`Enter` abre, foco entra no painel, `Esc` fecha e devolve o foco).

Duas armadilhas respeitadas: o arquivo roda em `mode: 'serial'`, então cada varredura navega e
espera o próprio conteúdo, sem compartilhar estado com a anterior; e, por F-28, toda espera é por um
elemento que **só existe com dado real** — o botão do cartão de um papel semeado e o botão do
indicador "Papéis do sistema" —, nunca pelo título da página nem por um esqueleto.

---

## §6 — T055: captura renderizada

**148 capturas**, em `docs/reviews/ui/`:

- `015-roles-{light,dark}-{1920,1440,1280,1024,768,390}` — 12 diretórios × 12 estados = 144
- `015-roles-restricted-{light,dark}` — 2 diretórios × 2 estados = 4

Os 12 estados por largura/tema: lista; cartão selecionado com o painel aberto no papel de **70
permissões**; módulos expandidos; identificadores visíveis; aba Usuários autorizada; edição de papel
do sistema travada; painel de papel personalizado; edição de papel personalizado; **diff pendente**;
confirmação de cancelamento; lista vazia por filtro; estado de erro (com `correlationId`).

As capturas da Onda 3 (`015-roles-390`, `015-roles-dark`, `015-roles-light`, `015-roles-restricted`)
foram **removidas**: a própria Onda 3 registrou que o conjunto `restricted` fora tirado antes de três
correções, e um conjunto parcialmente desatualizado é pior que nenhum.

**Estado do banco durante a captura — declarado, não acidental.** O conjunto principal roda com
**um** papel personalizado temporário, "Analista de Riscos e Controles (captura 015)", porque os
estados de edição de papel personalizado (diff pendente, tri-estado, cancelamento) não existem sem
ele — os 12 papéis semeados são todos de sistema. Por isso os indicadores mostram **13 papéis / 12
do sistema / 1 personalizado** nessas imagens. O conjunto `restricted` roda com um segundo papel
temporário ("Somente papéis (captura 015)", apenas `role:administer`). **Ambos foram excluídos ao
final**, e a verificação pós-execução confirma **0 papéis personalizados** no banco.

**Ferramenta.** `apps/web/scripts/ui-capture.mjs` é a ferramenta padrão do §18.13, mas varre o
produto inteiro e provisiona um controle, um framework, um engajamento, um ativo, um processo e um
relatório **a cada invocação** — doze execuções deixariam dezenas de registros para trás. A captura
foi feita por um roteiro focado, com a mesma técnica e as mesmas precauções (`networkidle`, rótulos
exatos, viewport alto porque este shell rola `<main>` e não a página, de modo que `fullPage` não
costura nada). Ele faz **um único login** para todas as 12 combinações, porque `apps/api/.env` tem
limites de autenticação de produção nesta máquina (ver §8). Esse roteiro **não foi commitado** — é a
lacuna registrada no item 1 de §13.

---

## §7 — Defeitos encontrados nesta onda

### §7.1 — O bloco de acessibilidade de papéis estava quebrado desde a Onda 3

`e2e/accessibility.spec.ts` tinha cinco varreduras de `/admin/roles` escritas para a tela antiga.
Todas esperavam `page.getByRole('button', { name: 'Ver detalhes do papel Platform Administrator' })`
com `timeout: 15_000`, e três delas abriam o `RoleDetailsDialog` e esperavam a região "Permissões
concedidas" **dentro de um `dialog`**.

Esse botão deixou de ser gerado: seu texto vem de `admin.roles.table.openDetailsLabel`, que §4.1
mede como **chave órfã, zero consumidores**. O cartão novo usa "Abrir detalhes do papel …". Ou seja,
as cinco varreduras **só podiam falhar** a partir do momento em que a Onda 3 mesclou a tela — e o
número "109/109" que serve de linha de base para a fase é **anterior** a isso (foi medido ao fim da
Onda 0).

Não é uma varredura que passava sem proteger nada; é pior e mais simples: era código morto que
teria quebrado o portão na primeira execução completa depois da Onda 3. Reescrito em §5.3.

**A lição é a de F-28 aplicada de outro ângulo**: uma varredura de acessibilidade que espera um
elemento pelo nome acoplado à implementação da tela é um teste que envelhece em silêncio junto com
ela. As esperas novas continuam acopladas (não há alternativa honesta — é preciso esperar dado
real), mas agora esperam **dois** sinais independentes, a lista e os indicadores, que vêm de
requisições diferentes.

### §7.2 — Meu próprio `afterEach` revogava a sessão antes de limpar

Encontrado na primeira execução do E2E reescrito, e registrado porque é exatamente o defeito que 012
§4 já tinha pago uma vez.

A primeira versão do `afterEach` chamava `signOut(page)` sempre que houvesse **qualquer** coisa a
limpar — e só depois emitia os `DELETE`. Sem sessão, todo `DELETE` respondia 401 e o gancho seguia em
silêncio. Dois papéis de fixture ficaram no banco e apareceram na execução seguinte como uma
violação de modo estrito (`getByRole` casando dois cartões), fazendo falhar um teste que nada tinha
a ver com a causa.

Duas correções: o `signOut` passou a acontecer **apenas** no cenário restrito (o único que termina
com uma identidade sem permissão de excluir); e a limpeza agora **lança** quando o `DELETE` não é
bem-sucedido, em vez de ignorar. Uma limpeza que falha em silêncio é como o banco se enche de linhas
de fixture que ninguém nota até uma captura mostrar uma.

### §7.3 — A conta de verificação tem o nome corrompido no banco

`verificacao-015@pharosgrc.local` está persistida com `fullName` = `Verificação 015 (somente
papéis)` **mal codificado** — renderiza como "Verifica◆◆o 015 (somente pap◆is)" no cabeçalho da
aplicação, visível em `docs/reviews/ui/015-roles-restricted-*/`. Foi criada pela Onda 3.

**Não corrigido**: é dado persistido, e §18.9 proíbe alterá-lo dentro de uma onda de interface. Não
afeta nenhuma asserção — nenhum teste casa por esse nome.

### §7.4 — `contract-coverage.spec.ts` não consegue validar o YAML que lê

Achado da Onda 1, **verificado por leitura direta** antes de ser registrado aqui: o próprio cabeçalho
do arquivo declara que usa um **scanner de linhas feito à mão**, não um parser, porque "no YAML
parser is a dependency of `apps/api`". Consequência medida pela Onda 1: um YAML inválido atravessou
esse scanner sem ser notado, e quem o pegou foi o parser real da suíte de contrato, mais adiante.

O portão é honesto sobre o que faz (presença de operação), mas **não é** uma validação de contrato.
Registrado, não corrigido — introduzir um parser em `apps/api` é decisão de dependência, §2.

### §7.5 — `api-types-check` estava vermelho em `main`

Achado da Onda 1, **verificado**: o commit `0eec44b` (2026-09-13, "fix(auth): a pending mandatory
password change is enforced by the server…") alterou
`specs/001-grc-platform-foundation/contracts/auth.openapi.yaml` em 12 linhas **sem regenerar**
`packages/api-types`. O job `api-types-check` de `.github/workflows/ci.yml:325` regenera os tipos a
partir dos contratos e falha se isso sujar a árvore — portanto estava vermelho em `main` desde
aquele commit, no mesmo dia.

Corrigido **incidentalmente** pela Onda 1, que regenerou o pacote ao acrescentar os tipos do
endpoint de resumo: a árvore de trabalho atual traz `packages/api-types/src/generated/auth.ts`
modificado (+4/−1) ao lado de `admin.ts` (+65). A correção não é desta fase e não foi pedida; está
registrada porque foi encontrada.

---

## §8 — Condições operacionais desta máquina

- **`SEED_ADMIN_EMAIL=admin-recovery@example.local`** é obrigatório para o E2E aqui (cenário D-22,
  Trap 5). Com o valor padrão a suíte reporta saída 0 com quase tudo `skipped`.
- **`API_INTERNAL_URL` e `APP_ORIGIN` precisam ser exportados**: `apps/web` não tem `.env` próprio
  (`docs/local-environment.md:40`), e sem eles o `playwright.config.ts` sequer carrega.
- **`PLAYWRIGHT_SKIP_WEB_SERVER=true`** com os servidores de desenvolvimento já de pé (3000/3001).
- **Playwright com 1 worker.**
- **`apps/api/.env` tem limites de autenticação de produção**: `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS=5`,
  `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=20` por 300 s, contra os **200/1000** que D-23 recomenda para
  suítes. **Nada foi alterado.** A captura foi reprojetada para caber no limite — um único login
  para as doze combinações de largura e tema — em vez de o limite ser afrouxado para caber na
  captura. O limite está certo; quem estava errado era o volume.
- **Postgres** é serviço nativo do Windows na 5432.

### §8.1 — A conta de verificação que não pôde ser removida

`verificacao-015@pharosgrc.local` continua no banco: **INACTIVE, sem nenhum papel**, com 30 eventos
de auditoria como ator.

**Não existe endpoint de exclusão de usuário** — `admin-users.controller.ts` expõe `GET`, `POST`,
`PATCH`, `PUT status`, `PUT password`, `DELETE sessions` e `PUT roles`, e nenhum `DELETE` do usuário.
Apagar a linha direto no banco esbarraria em `auditEventsAsActor`, e **destruir trilha de auditoria
para limpar dado de verificação é exatamente o que §8 e §18.9 proíbem**.

Por isso esta onda **reusou** a conta em vez de criar outra: o E2E e a captura restrita a ativam,
lhe dão um papel com apenas `role:administer`, exercitam o cenário, e a devolvem ao estado em que a
encontraram. Criar uma identidade restrita nova a cada execução tornaria o diretório permanentemente
maior a cada corrida.

**Estado final do banco, verificado após a última execução**: 0 papéis personalizados; 190 usuários
(inalterado); `verificacao-015@pharosgrc.local` INACTIVE e sem papéis.

---

## §9 — Verificação de F-32 pedida pelo coordenador

O coordenador pediu esta verificação e, no meio do trabalho, **corrigiu a rota**: a alegação da Onda
2 — de que as referências internas de spec estariam apenas em **comentários de código** de
`platform.seed.ts`, e não nas strings exibidas — está **errada**.

**Verificado de duas formas independentes**, nenhuma delas por leitura de outro documento:

1. Leitura das **strings** de `SYSTEM_ROLE_DEFINITIONS` (não dos comentários ao redor).
2. Leitura das **descrições persistidas** direto do banco de desenvolvimento — que é literalmente o
   texto que a tela renderiza. Esta é a fonte autoritativa, e foi necessária: um primeiro extrator
   sobre o código-fonte confundiu comentários com literais em um dos doze papéis e produziu lixo.
   A medição só vale porque foi refeita contra a realidade.

**Resultado: 7 dos 12 papéis semeados têm descrição persistida que não é prosa de produto.**

| Papel | O que vaza na descrição exibida |
|---|---|
| Compliance Manager | `004-compliance-management`, `research.md`, `D-13` |
| Control Approver | `data-model.md`, `§4`, `C1/C2`, `control:create/edit/test`, `control:approve` |
| Control Owner | `data-model.md`, `§4`, `FR-017/FR-018`, `control:approve` |
| Incident Manager | `spec.md`, `008-incidents-problems`, `FR-006` |
| Problem Manager | `data-model.md`, `FR-011`, `invariante P3`, `FR-010` |
| Risk Analyst | `risk:transition`, `risk:approve` (identificador cru, sem artefato de spec) |
| Risk Approver | `risk:create/edit/assess/treat/transition`, `risk:approve` (idem) |

Estritamente por **referência a artefato de especificação** são **5 de 12**; somando os que trazem
**identificador técnico cru** na prosa, **7 de 12**. Os 5 limpos são Platform Administrator, Risk
Manager, Audit Lead, Auditor e Read Only.

**F-32 não está superada — e na tela nova ela aparece com mais destaque do que na tabela antiga.**
A descrição deixou de ser uma célula de tabela e passou a ser **elemento de composição do cartão**,
com duas linhas dedicadas (`line-clamp-2`) logo abaixo do nome. Confirmado na captura
`docs/reviews/ui/015-roles-light-1440/01-list.png`, onde se lê, no cartão do Compliance Manager:
"…as declarações de aplicabilidade (004-compliance-management, research.md D-13). Nenhuma segregação
de funções entre as três permissões — nenhum FR ou cenário de aceitação…". É exatamente o espaço em
que o mockup mostrava uma frase curta de produto.

As descrições também são **longas**: Problem Manager tem 599 caracteres, Risk Analyst 528, Incident
Manager 492, Risk Approver 456, Control Owner 407 — as duas linhas do cartão são consumidas por
racional de especificação antes de dizerem o que o papel faz.

**Não corrigido, e `docs/deferred-findings.md` não foi editado**, conforme instrução explícita:
corrigir exige tocar o seed e o banco, o que §18.9 proíbe dentro de uma onda de interface, e a
decisão é do coordenador. O que esta onda devia fazer era medir e reportar — a medição da Onda 2
estava errada, e este repositório já pagou caro por causa escrita com confiança e errada
(`specs/005-audit-findings/STATE.md` §3).

---

## §10 — Desvios declarados pela Onda 3, mantidos

Registrados aqui para que não se percam, já que §18.12 exige que divergência tenha justificativa
escrita:

- **Sem breadcrumb próprio na página**: o shell já renderiza "ADMINISTRAÇÃO / Papéis e permissões"
  como landmark `nav` em toda tela autenticada; um segundo duplicaria landmark e palavras.
- **`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` nos indicadores**, em vez de `grid-cols-2` desde a
  menor largura — por rótulo cortado medido na tela.
- **"Excluir" mantido no rodapé do painel** (§18.9: retirar a ação seria mudança funcional, não
  cosmética).
- **Descrição vinda da API só no modo técnico** — ela continua em inglês (F-63), então é texto
  secundário exibido junto dos identificadores, nunca rótulo primário (FR-017).
- **Seleção de papel em estado React**, não na query string: a query string carrega busca, filtros e
  ordenação (FR-005c), e a seleção é efêmera.
- **`100svh` em vez de `100vh`** no teto do painel embutido, para que a barra de ferramentas que
  colapsa num navegador móvel não faça a unidade mentir.

Defeitos que a verificação renderizada da Onda 3 encontrou e corrigiu — o card "Filtro aplicado"
aparecendo sem filtro, o transbordo a 390 px, o rótulo cortado e o `disabled` ilegível (resolvido com
`readOnly` em vez de `disabled` no nome do papel do sistema, FR-031) — permanecem corrigidos e agora
têm guarda: o primeiro em `role-admin-view.test.tsx` e no E2E (`aria-pressed` + "Filtro aplicado"), o
segundo no E2E de 1920→390, o quarto em `role-edit-fields.test.tsx` (`readonly`, não `disabled`).

---

## §11 — Medição de fechamento

Em série. Nenhum teste removido sem equivalente provado (§3), nenhum `skip` acrescentado, nenhuma
asserção enfraquecida.

| Suíte | Antes (fim da Onda 3) | Depois |
|---|---|---|
| Unidade da web | **148 arquivos / 901 testes** | **151 / 922** |
| Unidade da API | 68 / 618 | **68 / 618** (inalterado — nada da API foi tocado) |
| Integração da API | 56 / 275 | **56 / 275** (inalterado) |
| Contrato da API | 58 / 827 | **58 / 827** (inalterado) |
| `accessibility.spec.ts` (axe, Chromium) | 109 / 109 | **114 / 114**, 0 violações |
| `admin-roles.spec.ts` (Chromium) | 6 testes, escritos contra a tela removida | **12 / 12** |
| **E2E Chromium completo** (`playwright test --project=chromium --workers=1`) | — | **190 / 190**, 0 falhas, 0 `skipped`, 18,8 min, saída 0 |

A aritmética da unidade da web fecha: 901 − 27 (os três arquivos removidos: 15 + 8 + 4) + 48 (os seis
arquivos novos) = **922**; 148 − 3 + 6 = **151**.

A de acessibilidade também: 109 − 5 (o bloco antigo de papéis) + 10 (o novo) = **114**.

Portões estáticos, todos limpos: `lint` (4 workspaces), `typecheck` (4 workspaces, incluindo web,
API e design system), `format:check` (árvore inteira), `openapi:check` (`apps/api/openapi.json` está
atualizado).

**Sobre `tasks.md`.** As onze tarefas desta onda (T048 a T058) estão concluídas, e o mapeamento
tarefa → evidência é o corpo deste documento (§2 = T048, §3 = T049, §4 = T050, §5.1 = T051,
§5.2 = T052/T053, §5.3 = T054, §6 = T055, §11 = T056, §12 = T057, este arquivo = T058).
`specs/015-roles-permissions-surface/tasks.md` **não foi marcado**: ao contrário de
`specs/009-indicators-reports/tasks.md`, que usa `- [x]`, o desta fase não tem marcador de conclusão
em nenhuma das 58 tarefas — inclusive nas 47 que as Ondas 0 a 3 já entregaram. Marcar só as minhas
inventaria uma convenção que esta fase não adotou e sugeriria, por contraste, que as outras estão
abertas.

---

## §12 — Prova de não-vacuidade

Para cada guarda **escrita nesta onda**, a proteção foi revertida e o teste que a protege falhou.
As provas das Ondas 0, 1 e 3 são citadas, não refeitas, conforme instruído.

| Guarda | Reversão aplicada | Resultado |
|---|---|---|
| Precedência da razão de bloqueio de exclusão (papel do sistema antes de atribuição) | trocada a ordem dos dois `if` em `roleDeleteBlockedReason` | `role-detail-panel.test.tsx` **2 de 12 falharam**; restaurado, 12/12 |
| Lista sr-only **completa** dos módulos, apesar da prévia truncada (FR-007) | `modules` trocado por `visibleModules` na `sr-only` de `role-card.tsx` | `role-card.test.tsx` **1 de 12 falhou**; restaurado, 12/12 |
| Identificador técnico revelado **sob demanda**, nunca por padrão (FR-016) | invertida a condição `showIdentifiers` em `role-permissions-tab.tsx` | `role-permissions-tab.test.tsx` **1 de 6 falhou**; restaurado, 6/6 |
| Fronteira `user:administer` da aba Usuários | **ver abaixo** | provada por ramos pareados |

Depois das três reversões e restaurações, o diretório inteiro voltou a **13 arquivos / 112 testes**,
todos passando.

**Sobre a quarta.** A reversão direta seria substituir `canAdministerUsers ?` por `true ?` em
`role-users-tab.tsx`, montando o roster incondicionalmente. O ambiente **recusou executar a suíte com
essa alteração no disco**, classificando-a como enfraquecimento de controle de segurança — e a recusa
está correta. A alteração foi revertida imediatamente.

A não-vacuidade dessa guarda está provada de outra forma, sem enfraquecer nada: **o próprio arquivo
de teste contém os dois ramos, com os mesmos dados de mock**, e eles afirmam resultados opostos —

- sem `user:administer`: `expect(listUsersMock).not.toHaveBeenCalled()` e o markup **não** contém
  "Ana Pereira", "ana.pereira@example.local", "Auditora Interna" nem "Tecnologia da Informação";
- com `user:administer`: `expect(listUsersMock).toHaveBeenCalledTimes(1)` e os quatro textos
  **estão** no documento.

Um conjunto de asserções que exige a requisição ausente para um valor do sinalizador e presente para
o outro **não pode passar** com a montagem incondicional: o primeiro teste falharia. Os dois ramos
passam hoje, com o mesmo mock, o que só é possível porque a fronteira é real.

Há ainda a prova independente e mais forte, no servidor: `GET /admin/users` exige `user:administer`
(`admin-users.controller.ts:82`, confirmado por leitura), e o E2E exercita isso com uma sessão que
genuinamente não tem a permissão — a tela não mostra nome nenhum, e a página inteira não contém um
único `@example.local`.

### §12.1 — A inércia da classificação de privilégio, medida

FR-036 exige que "Privilegiado" não seja consultado por decisão de segurança alguma. A forma mais
forte dessa prova não é um teste: é a **ausência do conceito** no servidor, e ela foi medida, não
presumida.

`grep -Ei "privileg|elevated|superuser|super_admin"` sobre `apps/api/src` e `apps/api/prisma`
devolve ocorrências em 10 arquivos. **Nenhuma é uma classificação de papel**: uma é o comentário de
`role-admin.service.ts:32` que documenta a ausência de checagem anti-escalação (achado 3 de
`spec.md`, fora de escopo); as demais são a palavra "privilege" no sentido do Postgres — `GRANT` e
`REVOKE` sobre tabelas append-only da trilha de auditoria — mais nomes de coluna de dado de
referência sem relação com autorização.

Não existe campo, coluna, enum ou ramo de guarda chamado privilegiado. A classificação vive
inteiramente em `role-privilege.ts`, uma função pura do cliente sobre permissões que a listagem já
havia devolvido. Um papel classificado e um não classificado produzem a mesma decisão do
`PermissionGuard` porque o servidor nunca ouviu falar da classificação.

---

## §13 — O que fica aberto

1. **O roteiro de captura focada não foi commitado.** `apps/web/scripts/ui-capture.mjs` continua sem
   cobrir os estados desta tela (painel, módulos expandidos, identificadores, diff pendente,
   restrito, erro), então reproduzir as 148 capturas exige reescrever o roteiro. Ou o harness
   committed ganha um modo por tela, ou esta fase deixou um passo manual. Registrado, não decidido.
2. **F-32 / F-63** — §9. Medição corrigida, correção não feita, `docs/deferred-findings.md` não
   editado, por instrução.
3. **30 chaves de catálogo sem consumidor** — §4.1. Nenhuma removida.
4. **`contract-coverage.spec.ts` não valida YAML** — §7.4.
5. **Nome corrompido de `verificacao-015@pharosgrc.local`** — §7.3.
6. **A conta de verificação permanece no banco** — §8.1. Não há endpoint que a remova, e apagá-la no
   banco destruiria trilha de auditoria.
7. **Limite conhecido da aba Usuários acima de 100 pessoas.** `RoleUserRoster` faz **uma** requisição
   paginada com `pageSize: 100`, que é o teto do contrato (`@Max(100)`). Um papel com mais de 100
   titulares mostra os 100 primeiros; a contagem exibida vem de `meta.total` e continua correta, mas
   **não há paginação na aba**. Hoje o maior é Risk Analyst, com 55. É uma escolha de FR-024 (uma
   requisição por abertura, nunca uma por pessoa), não um esquecimento — mas é um teto real.
8. **Nenhuma verificação em Firefox ou WebKit.** Toda a medição desta onda é Chromium.
9. **`role-permissions-summary.tsx` e `role-create-dialog.tsx`** continuam usando o agrupamento e o
   catálogo antigos. Fora de escopo (FR-034), mas são os dois últimos consumidores de parte de
   `admin.roles.form.*`.

---

# Fases 1 a 7 de correção (2026-09-14) — registro acrescentado, não substituto

As seções §1 a §13 acima descrevem a fase 015 e continuam válidas como escritas. As seções abaixo
cobrem as **sete fases de correção** que vieram depois dela, todas sobre a mesma tela, e a medição
de fechamento da última. Onde uma pendência de §13 foi resolvida, isso é dito aqui — §13 **não foi
editado**, porque ele descreve corretamente o que era verdade no fim da fase 015.

## §14 — O que cada fase entregou

| Commit | Fase | Entrega |
|---|---|---|
| `0b827a6` | 4 | As 12 descrições de papel semeado reescritas como prosa de produto em pt-BR, teto de 200 caracteres; racional de engenharia movido para comentário de código; guarda de 38 testes (`apps/api/test/unit/seeded-role-description-content.spec.ts`) contra a reincidência. **F-32 resolvida.** F-68 registrada no caminho. |
| `54a778a` | 1 | Criação de papel migrada do diálogo antigo para o mesmo painel que lê um papel; `use-role-editor` generalizado para `(target: Role \| null, enabled)`; `role-panel-shell` extraído; `role-create-dialog.tsx` e `permission-checklist.tsx` (mais o teste) removidos. Unidade da web 922 → 951. |
| `47ffbb4` | 2 | `FilterBar` em modo `collapsible`, `ResultsToolbar` com `role="status"` e chips vindos de `@/lib/register/filter-chips` — a tela deixa de ter cromo de filtro próprio (§18.12). `SortSelect` deliberadamente **não** adotado, com razão registrada. Unidade da web 951 → 966. |
| `1444516` | 3 | Paginação real na aba Usuários, com `PaginationFooter` e `common.dataTable`; página de 10 medida contra a altura do painel. **§13 item 7 resolvido.** Unidade da web 966 → 974. |
| `b0ecd99` | 5 | `roleDisplayName` como ponto único de tradução sobre união fechada de doze literais; busca casa o rótulo pt-BR **e** o nome armazenado; ordenação A–Z segue o nome impresso; "Nome técnico" sob a divulgação existente; ADR-022. Unidade da web 974 → 992. |
| `3c6b2b6` | 6 | `e2e/` reparado contra a tela real, três specs novos para o que as fases 1/3/5 entregaram sem um, e primeira execução em Firefox e WebKit do projeto. `ui-capture.mjs --surface=roles`. **§13 itens 1 e 8 resolvidos.** F-69 e F-70 registradas. |
| — | 7 | Esta seção. Não implementa: mede e registra. |

## §15 — Medição de fechamento da Fase 7

Em série, com os servidores de desenvolvimento de pé (3000/3001), Postgres nativo na 5432,
Playwright com **1 worker**, e nenhuma suíte unitária em paralelo com E2E.

### §15.1 Portões estáticos

| Portão | Resultado |
|---|---|
| `pnpm lint` | 4 de 4 workspaces, saída **0** |
| `pnpm typecheck` | 4 de 4 workspaces (`api-types`, `design-system`, `api`, `web`), saída **0** |
| `pnpm format:check` | "All matched files use Prettier code style!", saída **0** |
| `openapi:check` | "`apps/api/openapi.json` is up to date", saída **0** |

### §15.2 Suítes

| Suíte | Linha de base | Medido |
|---|---|---|
| Unidade da web | 154 arquivos / 992 testes | **154 / 992**, saída 0 |
| Unidade da API | 69 / 656 | **69 / 656**, saída 0 |
| Integração da API | 56 / 275 | **56 / 275**, saída 0 |
| Contrato da API | 58 / 827 | 1ª execução **57 arquivos / 825 testes, 2 falhas**; 2ª execução **58 / 827**, saída 0 — ver §20.1 |
| E2E Chromium | 197 | **197 existem; 196 medidos verdes numa passada fatiada, mais 1 verde isolado.** Nenhuma execução única passou inteira — ver §20.2 |
| `accessibility.spec.ts` | 118 | **116 verdes** sem as duas varreduras de painel de filtro, mais **2 verdes** quando executadas sozinhas = 118 |
| Bloco de papéis do axe | 14 | **14 / 14, zero violações**, nos dois temas, em **chromium, firefox e webkit** |
| `admin-roles.spec.ts` | 15 | **15/15 chromium**, **15/15 webkit**, **15/15 firefox** (na 2ª execução; 11/15 na 1ª — §20.2) |

Nenhum teste foi removido, nenhum `skip` acrescentado, nenhuma asserção enfraquecida.

## §16 — Regressão de autorização, confirmada por teste existente

Cada invariante foi localizada no teste que a guarda, por leitura do arquivo — não por confiança no
que um documento afirma.

| Invariante | Arquivo | Teste | Linha |
|---|---|---|---|
| `role:administer` não implica `user:administer`; sem a segunda, nenhum dado pessoal no DOM | `apps/web/src/features/admin/components/roles/role-users-tab.test.tsx` | "makes no request and puts no personal datum in the DOM, showing only the aggregate count" | 78 |
| idem, com 196 titulares e par positivo/negativo | mesmo arquivo | "WITHOUT user:administer: no request, no pagination control, no personal datum — at 196 holders" (o par positivo em 444) | 419 |
| idem, no nível da view | `apps/web/src/features/admin/components/roles/role-admin-view.test.tsx` | "never requests nor renders personal data without user:administer (FR-018/FR-020, SC-006)" | 425 |
| idem, sessão real em navegador | `apps/web/e2e/admin-roles.spec.ts` | "a session holding role:administer but NOT user:administer sees no personal data at all (scenario 1)" | 691 |
| Papel de sistema recusa `name` e `permissionIdentifiers` (422); aceita `description` (200); recusa `DELETE` (422) | `apps/api/test/contract/admin-roles.spec.ts` | "refuses renaming or changing the permission set of a system role (422); allows changing its description" | 249 |
| O cliente sequer envia nome/permissões de papel de sistema | `apps/web/src/features/admin/components/roles/role-admin-view.test.tsx` | "sends ONLY the description when saving a system role (FR-031, 012 §3.1)" | 511 |
| `usersWithRoles` conta uma pessoa multi-papel uma vez | `apps/api/test/integration/role-summary.spec.ts` | "counts a person holding TWO roles exactly once (SC-004), while both roles count toward totalRoles" | 174 |
| e conta duas pessoas como duas (contra-controle) | mesmo arquivo | "counts a SECOND person holding one of the same roles as a second distinct user" | 210 |
| Classificação de privilégio sem efeito sobre autorização | `apps/web/src/features/admin/components/roles/role-privilege.test.ts` | "is exactly the three governance identifiers ADR-021 names" | 122 |
| e o distintivo não é controle | `apps/web/src/features/admin/components/roles/role-privilege-badge.test.tsx` | "is presentation only: it exposes no control, no input and no interactive role" | 47 |
| Sem herança entre papéis — união plana | `apps/api/test/integration/role-summary.spec.ts` | "resolves a two-role user to the FLAT UNION of both permission sets — no inheritance, no transitive expansion" | 291 |
| União aditiva e deduplicada | mesmo arquivo | "adding a second role ADDS its permissions and removes none — union, never replacement or override" | 331 |
| A tela nunca sugere herança | `apps/web/src/features/admin/components/roles/role-admin-view.test.tsx` | "states the real authorization model and never suggests inheritance (SC-003)" | 390 |

### §16.1 — Três lacunas nessas guardas, ditas sem rodeio

1. **A não-implicação `role:administer` ⇏ `user:administer` não tem guarda no servidor.** Nenhum
   teste de `apps/api/test` autentica uma identidade que tenha `role:administer` e **só** isso e
   exige 403 de `GET /admin/users`. O teste mais próximo,
   `apps/api/test/contract/admin-permissions.spec.ts:182`, usa um chamador com `risk:view`. Se
   alguém acrescentasse ao `PermissionGuard` um atalho "`role:administer` é super-administrador",
   **todos** os testes acima continuariam verdes: o de contrato porque seu chamador não tem o papel,
   e o E2E porque ele afirma o DOM renderizado — e é o próprio cliente que decide não chamar
   `/admin/users`. Do lado web a fronteira está genuinamente bem guardada, com par positivo e
   negativo sobre os mesmos dados; do lado do servidor ela está apenas **verdadeira**, não guardada.
2. **A inércia da classificação de privilégio é provada por ausência, não por teste.** Nada afirma
   "um papel classificado e um não classificado produzem a mesma decisão". §12.1 mede a ausência do
   conceito no servidor por `grep`, e essa medição continua correta hoje — mas é um fato estático,
   não uma guarda de regressão.
3. **A imutabilidade do papel de sistema tem exatamente um teste**, de contrato. Ele é bom (linha
   real com `isSystem: true`, quatro asserções incluindo o `description → 200` positivo), mas não
   distingue "422 porque é papel de sistema" de "422 por outra validação": não afirma o corpo do
   problema nem `USER_MESSAGES.admin.systemRoleImmutable`.

## §17 — Estado do banco, medido antes e depois

| Grandeza | Início da Fase 7 | Fim da Fase 7 |
|---|---|---|
| Papéis | 12 | **12** |
| Papéis do sistema | 12 | **12** |
| Papéis personalizados | **0** | **0** |
| Usuários | 208 | **220** |
| Detentores de `Platform Administrator` | 40 (25 com prefixo `e2e`) | **42** (27 com prefixo `e2e`) |
| Contas com prefixo `e2e` | 156 | **166** |

As 12 descrições de papel semeado estão persistidas em pt-BR, a mais longa com **197** caracteres —
F-32 alcançou o banco de desenvolvimento, confirmado por leitura direta do banco, não do arquivo de
seed.

**Resíduo criado por esta fase e removido.** A travessia de §18 cria **um** papel personalizado por
execução. Duas execuções iniciais falharam em limpar (o roteiro usava um parâmetro `search` que
`GET /admin/roles` não aceita), e os dois papéis foram excluídos pela API do produto — `204` seguido
de `404` na verificação — antes de qualquer outra medição. As quatro execuções finais limparam
sozinhas, cada uma com `204` e `404`. Estado final conferido: **0 papéis personalizados**.

**Resíduo que não é desta fase.** Os 12 usuários a mais vieram das execuções de E2E desta medição, e
são F-70 acontecendo ao vivo — nenhuma suíte de papéis cria usuário; quem os cria são os specs de
escopo e `problems.spec.ts`. `verificacao-015@pharosgrc.local` continua INACTIVE, sem papéis, com o
`fullName` corrompido de §7.3.

## §18 — A travessia das seis fases juntas

As seis fases foram medidas isoladamente. Esta percorre a tela inteira com elas compostas, nos dois
temas e em 1440 e 390 px, procurando o que cada uma acertou sozinha e que juntas poderia quebrar.
Quatro execuções completas, uma por combinação.

**Nenhuma interação entre fases produziu defeito.** O que foi medido:

- **Ordenação × pt-BR (fase 5 × fase 2).** "Nome (A–Z)" ordena pelo nome **impresso**: Administrador
  da Plataforma, Analista de Riscos, Aprovador de Controle, Aprovador de Riscos, Auditor, Gestor de
  Compliance, Gestor de Incidentes, Gestor de Problemas, Gestor de Riscos, Líder de Auditoria,
  Responsável por Controle, Somente Leitura. Correto nas quatro combinações.
- **Busca × pt-BR × `ResultsToolbar` (fase 5 × fase 2).** `Platform` e `Administrador` acham o mesmo
  papel; `Incident Manager` e `Gestor de Incidentes` também. O contador compartilhado responde
  "1 de 12 papéis" nos quatro casos.
- **Criação com filtro ativo (fase 1 × fase 2).** Com "Tipo: Personalizados" aplicado, criar um papel
  no painel funciona, o papel aparece na lista filtrada, o chip do filtro permanece, o indicador
  "Papéis personalizados" vai a 1 com "· Filtro aplicado", e o papel recém-criado abre já selecionado
  no painel de detalhe. Nenhum estado ficou dessincronizado.
- **Painel de papel personalizado × nome técnico (fase 5 × fase 1).** "Nome técnico" aparece também
  para papel personalizado, repetindo o nome impresso. Isso **não** é defeito: está decidido e
  justificado em `role-detail-panel.tsx:135-143` ("mostrado para todo papel — inclusive um
  personalizado, onde ver os dois coincidirem é em si a resposta").
- **Edição de papel de sistema × pt-BR (fase 5 × 015 FR-031).** O cabeçalho do painel diz "Gestor de
  Riscos"; o campo Nome do editor traz `Risk Manager`, com `readonly` e **não** `disabled`. É
  exatamente o que ADR-022 e FR-031 pedem, e é a única superfície em que os dois nomes aparecem
  juntos.
- **Aba Usuários paginada × painel em overlay (fase 3 × 015).** A 390 px o overlay mostra
  "11–20 de 39", "Itens por página 10" e os botões de página, com o rodapé do painel fixo e visível.
- **Rolagem horizontal**: zero em todas as medições, nas quatro combinações, em todos os estados
  percorridos.
- **Perfil**: a conta de verificação detém apenas `Platform Administrator`, que é um dos seis papéis
  que `profile.identity.roleLabels` traduz — então a tela de Perfil lê em pt-BR **para esta conta**.
  Isso não desmente o defeito de §20.4: ele atinge os outros seis papéis.

A travessia também produziu o achado mais importante desta fase, §20.3, que só aparece com o console
do navegador aberto.

## §19 — Situação de cada item de §13

| § | Item | Situação |
|---|---|---|
| 13.1 | Roteiro de captura não commitado | **RESOLVIDO** pela fase 6: `ui-capture.mjs --surface=roles`; duas invocações reproduzem 216 capturas |
| 13.2 | F-32 / F-63 | **F-32 RESOLVIDA** (fase 4). **F-63 PARCIAL**: a parte 2 (descrições de papel) foi junto; a parte 1 continua **ABERTA** — medido hoje no banco: **70 de 70** descrições de permissão seguem em inglês |
| 13.3 | 30 chaves de catálogo sem consumidor | **PIOROU, por decisão registrada**: hoje são **53** — ver §20.5 |
| 13.4 | `contract-coverage.spec.ts` não valida YAML | **ABERTO**, inalterado (o cabeçalho do arquivo continua declarando o scanner de linhas) |
| 13.5 | Nome corrompido de `verificacao-015@pharosgrc.local` | **ABERTO**, confirmado no banco hoje |
| 13.6 | A conta de verificação permanece no banco | **ABERTO** — INACTIVE, sem papéis; não existe endpoint que a remova |
| 13.7 | Teto de 100 na aba Usuários | **RESOLVIDO** pela fase 3 |
| 13.8 | Nenhuma verificação em Firefox ou WebKit | **RESOLVIDO** pela fase 6, e o WebKit revelou **F-69** — ver §20.6 |
| 13.9 | `role-permissions-summary.tsx` e `role-create-dialog.tsx` | **PARCIAL**: `role-create-dialog.tsx` foi removido pela fase 1; `role-permissions-summary.tsx` continua vivo, consumido por `user-roles-dialog.tsx` |

## §20 — Achados

### §20.1 — `information-disclosure.spec.ts` é intermitentemente vermelho, e a causa é o formato de um marcador de fixture

A **primeira** execução completa da suíte de contrato desta fase falhou em 2 testes de 827:

```
OrgUnitController_list[51].code
  pattern: "raw opaque session token (base64url, 43 chars)"
  sample:  "at-org-eec5efc5-7301-44d4-9703-e8c61e0a9c7e"
```

**Causa, medida e não inferida.** `uniqueTestMarker(prefix)` devolve `prefix` mais `-` mais um UUID.
Um prefixo de **seis** caracteres produz um valor de **exatamente 43** caracteres, todos do alfabeto
base64url — que é exatamente o que `RAW_SESSION_TOKEN` (a expressão `^[A-Za-z0-9_-]{43}$`, ancorada ao
valor inteiro) existe para detectar. `apps/api/test/contract/attachments.spec.ts:93` cria uma unidade
organizacional com `code: uniqueTestMarker('at-org')`; a varredura de divulgação, que roda depois na
mesma execução, encontra essa unidade na página que `GET /org-units` devolve e a denuncia como token
de sessão vazado.

Existem hoje **dez** prefixos de seis caracteres em `apps/api/test`: `at-org`, `au-dup`, `au-org`,
`av-org`, `cm-org`, `draft2`, `fix-f2`, `io-inc`, `io-prb`, `pi-org`. Cada um é um gatilho latente.

É a mesma classe de F-45/F-54, e a fase 015 já a tinha evitado no E2E escolhendo um prefixo de
**sete** caracteres (§5.2). O comentário de `RAW_SESSION_TOKEN` inclusive antecipa o problema e diz
por que a expressão foi ancorada — a âncora resolve o caso "prefixo mais UUID dentro de um texto
maior", não o caso "prefixo mais UUID **é** o valor inteiro do campo".

**Não corrigido**: está fora do escopo desta fase e fora do domínio de papéis. Segunda execução
completa da mesma suíte, sem alteração alguma: **58 arquivos / 827 testes, saída 0.** Executada
isoladamente, `information-disclosure.spec.ts` passa 6/6, porque o `globalSetup` trunca as tabelas
mutáveis a cada execução e a unidade de fixture ainda não existe.

### §20.2 — Três testes que só falham em execução longa, e um portão que esconde 73 outros

A execução completa do E2E Chromium (`--project=chromium --workers=1`) terminou
**123 passaram / 1 falhou / 73 não executaram**, em 14,9 min. Fatiada, a mesma árvore dá:

| Fatia | Resultado |
|---|---|
| Tudo exceto `accessibility.spec.ts` | 78 passaram, **1 falhou** (`assets-processes.spec.ts:329`) |
| `accessibility.spec.ts` sem as duas varreduras de painel de filtro | **116 passaram** |
| `accessibility.spec.ts`, só as duas varreduras de painel de filtro | **2 passaram** |
| `assets-processes.spec.ts` sozinho | **2 passaram** |
| `admin-roles.spec.ts` no firefox | 11 passaram / **4 falharam** na 1ª; **15/15** na 2ª, imediata |

Ou seja: **os 197 testes passam, mas nunca todos na mesma execução.** Três specs independentes —
`assets-processes.spec.ts`, as duas varreduras de painel de filtro, e os quatro primeiros testes de
`admin-roles.spec.ts` no Firefox — falham apenas fundo adentro de uma sessão longa e passam
isoladamente. A fase 6 já tinha visto e classificado o primeiro como contenção; aqui ele falhou
**sem** suíte unitária concorrente.

O segundo fato é mais grave que o primeiro. `accessibility.spec.ts` configura
`test.describe.configure({ mode: 'serial' })` no nível do arquivo. A fase 6 moveu o bloco de papéis
para um `describe` próprio em `mode: 'default'` justamente para desacoplá-lo do `beforeAll`
compartilhado. **Esse desacoplamento não sobrevive a uma falha em outro ponto do arquivo**: a
varredura que falhou era a de número 45, e as 73 seguintes — **as 14 de papéis inclusive** — foram
marcadas "did not run". O bloco de papéis desta tela pode, portanto, deixar de ser executado por um
defeito que não tem nada a ver com ele, e o relatório dirá "1 failed" em vez de "1 failed, e o portão
de papéis não foi medido". Foi só porque esta fase fatiou a execução que as 14 varreduras de papéis
têm resultado.

### §20.3 — Uma incompatibilidade de hidratação no shell autenticado, e a violação crítica de acessibilidade que ela produz

Este é o achado que a travessia de §18 encontrou e que nenhuma das seis fases podia ver, porque só
aparece com o console do navegador ligado.

**Medido**: ao carregar `/admin/roles`, o React registra

> "A tree hydrated but some attributes of the server rendered HTML didn't match the client
> properties. **This won't be patched up.**"

e o diff aponta o mesmo elemento com dois identificadores: servidor `id="_R_75esnebmqaitmlb_"`,
cliente `id="_R_1pbn5ritmiitmlb_"`. A primeira divergência na árvore está no **shell**, no gatilho
Radix do menu da conta (`aria-label="Menu da conta"`), acima do conteúdo da página — o que desloca o
prefixo de `useId()` de tudo o que vem depois.

**Consequência medida, e ela é uma violação de WCAG 4.1.2 de impacto crítico.** `FilterBar`
(`packages/design-system/src/components/data-table/filter-bar.tsx`) deriva `searchId` e `panelId` de
duas chamadas consecutivas de `useId()` e liga o botão de divulgação ao painel por
`aria-controls={panelId}`. Quando a hidratação diverge, o botão **conserva o id do servidor** (o React
diz explicitamente que não vai corrigir) enquanto o painel, criado no clique, nasce com o id do
cliente. Resultado observado ao vivo em `/risks`, com o painel aberto e estável por 5 segundos:

```
botão:  aria-expanded="true"  aria-controls="_R_2ainebmqaitmlbH1_"   -> alvo NAO existe
painel: role="group"          id="_R_iklritmiitmlbH1_"               (aria-label "Filtros do registro de riscos")
```

É exatamente a falha que o axe reportou nas duas varreduras de painel de filtro (`risk register` e
`control catalog`), com `impact: "critical"`, regra `aria-valid-attr-value`.

**Isto não foi causado pelas seis fases.** `filter-bar.tsx` não foi tocado por nenhuma delas (último
commit a alterá-lo: `f45137c`), e o shell também não — o diff de `0b827a6~1..HEAD` fora da pasta
`roles` são cinco arquivos: `user-admin-columns.tsx`, `user-roles-dialog.tsx`, `admin/types.ts`,
`messages/admin.ts` e `validation/admin.ts`. **Mas a fase 2 ampliou a exposição**: ao adotar o
`FilterBar` colapsável, a tela de papéis passou a ter o mesmo ponto de falha que os cinco registros
já tinham. As 14 varreduras de papéis não a exibiram em nenhum dos três motores.

**O que falta para fechar o diagnóstico**: medir contra um build de produção (`next build` mais
`next start`) em vez do servidor de desenvolvimento. Não foi feito porque D-16 proíbe construir a web
com o dev server de pé, e derrubá-lo invalidaria as medições em curso. A incompatibilidade de
hidratação em si é real nos dois modos (o React só a **registra** em desenvolvimento); o que falta
confirmar é se ela ocorre com a mesma frequência fora do dev.

### §20.4 — `profile.identity.roleLabels` continua sendo um segundo mapa, incompleto

`apps/web/src/lib/messages/profile.ts:35` traduz **seis** dos doze papéis semeados — Platform
Administrator, Risk Manager, Risk Analyst, Risk Approver, Auditor, Read Only. Os outros seis — Audit
Lead, Compliance Manager, Control Owner, Control Approver, Incident Manager, Problem Manager —
continuam renderizando em **inglês** na tela de Perfil (`profile-view.tsx:44`, com fallback silencioso
`?? name`). A fase 5 disse isso explicitamente e não corrigiu.

O que ela deixou no lugar é uma guarda que impede o defeito de **crescer**:
`role-display-name.test.ts` afirma que os dois catálogos nunca **discordam** sobre um papel que ambos
nomeiam, e exige que compartilhem ao menos seis nomes para a comparação significar algo. A regra é a
mais fraca e verdadeira; exigir completude seria afirmar uma correção que não foi feita.

As outras duas superfícies que mostram nome de papel **já** passam por `roleDisplayName`:
`user-admin-columns.tsx:146` (chips do registro de Usuários, com o `accessorFn` casando os dois nomes)
e `user-roles-dialog.tsx:158,164`. Perfil é o único remanescente.

### §20.5 — 53 chaves órfãs em `admin.roles.*`, e a decisão de não removê-las

Medido por duas varreduras independentes e conciliado à mão onde elas discordaram (uma busca por nome
de chave não enxerga um consumo por alias; uma busca por caminho resolvido não enxerga um objeto
passado inteiro para um construtor de chip). O catálogo tem **317** folhas sob `admin.roles.*`.

| Grupo | Órfãs |
|---|---|
| `table.*` (incluindo `columns.*`) | 8 |
| `form.*` (tudo menos `effectNotice`) | 14 |
| `details.*` (tudo menos `grantedPermissions`) | 9 |
| `permissionOverview.*` | 5 |
| `filters.*` (`activeFiltersLabel`, `searchChipLabel`, `typeChipLabel`, `moduleChipLabel`, `removeFilterLabel`) | 5 |
| `actions.*` (`viewDetails`, `edit`, `rowActionsLabel`) | 3 |
| `empty.*` | 2 |
| `edit.pendingChanges.addedTitle` e `removedTitle` | 2 |
| `panel.backLabel` e `panel.descriptionLabel` | 2 |
| `permissionsTab.moduleToggleLabel` | 1 |
| `states.error.correlationIdLabel` | 1 |
| `permissionsSummary.expand` | 1 |
| **Total** | **53** |

Eram 30 no fim da fase 015 (§4.1). Subiram porque a fase 1 removeu `role-create-dialog.tsx`,
orfanando quase todo o grupo `form.*`, e a fase 2 substituiu os chips escritos à mão pelos
construtores compartilhados, orfanando cinco de `filters.*`.

**Nenhuma removida, deliberadamente**, pela mesma razão de §4.1 e por uma nova: nada quebra por chave
órfã, `messages/admin.ts` tem consumidores vivos entremeados em todos esses grupos, e uma limpeza de
53 chaves dentro de uma fase cujo mandato é **medir** seria exatamente a alteração não relacionada que
CLAUDE.md §14 proíbe. Fica registrado como tarefa própria, agora com o inventário pronto.

Três grupos explicitamente **não** são órfãos, apesar de uma varredura por nome sugerir que sejam:
`sortOptions` (consumido por `Object.entries` em `role-admin-view.tsx:264`), `activeFilters.*` (o
objeto inteiro vai para `searchChip`/`singleValueChip` em `role-filter-bar.tsx:96-109`) e
`validation.permissions.required` (`lib/validation/admin.ts:70`).

### §20.6 — F-68, F-69 e F-70, confirmadas onde podem ser confirmadas

- **F-68** — a descrição de um papel de sistema tem dois donos. `RoleAdminService.update` aceita
  `description` num papel `isSystem` (a guarda cobre `name` e `permissionIdentifiers`, não ela), grava
  e audita; `upsertSystemRoles` reescreve `description` em toda execução do seed, sem identidade
  atuante e portanto sem `audit_event`. A trilha passa a afirmar um estado que o banco não tem mais.
  **ABERTA**, com três saídas plausíveis registradas em `docs/deferred-findings.md` e nenhuma óbvia.
  Confirmada hoje pelo outro lado: as 12 descrições no banco são **exatamente** as do arquivo de seed.
- **F-69** — no WebKit, clicar num `<button>` deixa o foco em `<main tabindex="0">`, e por isso
  `DetailPanel` e `sheet.tsx`, que capturam `document.activeElement` na montagem, restauram para
  `<main>`. É comportamento do motor, não defeito do produto; o caminho do **teclado** — o que a SC
  2.4.3 protege — devolve o foco corretamente nos três motores. A guarda `expectMouseFocusReturn`
  afirma o comportamento **medido** de cada motor e falha se o Chromium regredir **ou** se o WebKit
  mudar. **ABERTA**; a correção certa é o chamador passar o gatilho explicitamente, em
  `packages/design-system`, com 34 ou mais consumidores de `ConfirmDialog`. WebKit 15/15 e 14/14
  nesta fase.
- **F-70** — contas de E2E se acumulam e nascem com o papel mais privilegiado. Medido ao vivo: 208 →
  **220** usuários no curso desta medição, `Platform Administrator` de 40 → **42** detentores, dos
  quais **27** têm prefixo `e2e`. Nenhuma suíte de papéis cria usuário. **ABERTA**: não existe
  endpoint de exclusão de usuário e apagar a linha destruiria `auditEventsAsActor`.

## §21 — O que continua aberto ao fim da Fase 7

Herdado de §13 e ainda verdadeiro: itens **4** (`contract-coverage.spec.ts` não valida YAML), **5**
(nome corrompido de `verificacao-015@pharosgrc.local`), **6** (a conta de verificação permanece no
banco) e a **parte 1 de F-63** (as 70 descrições de permissão em inglês — medidas hoje: 70 de 70).
Item **9** só parcialmente: `role-permissions-summary.tsx` continua vivo.

Novo, e nenhum deles no domínio de papéis:

1. **§20.3 — incompatibilidade de hidratação no shell autenticado**, que produz `aria-controls`
   pendurado em todo `FilterBar` colapsável e uma violação axe de impacto **crítico**. É o achado
   mais sério desta fase. Falta medir contra `next build` mais `next start`.
2. **§20.2 — o portão de acessibilidade esconde o que não executou.** Uma falha em qualquer ponto de
   `accessibility.spec.ts` cancela as varreduras seguintes, **incluindo** o bloco de papéis que a fase
   6 acreditava ter desacoplado. Um relatório de "1 failed" pode significar "o portão de papéis não
   foi medido".
3. **§20.2 — instabilidade em execução longa**, em três specs independentes, todos verdes isolados.
4. **§20.1 — dez prefixos de `uniqueTestMarker` com seis caracteres** produzem valores de exatamente
   43 caracteres e disparam o detector de token vazado. Correção de uma linha por prefixo.
5. **§20.5 — 53 chaves de catálogo órfãs**, inventariadas e não removidas.
6. **§16.1 — três lacunas de guarda** de autorização, sendo a primeira a que importa: a
   não-implicação `role:administer` ⇏ `user:administer` não tem guarda no servidor.
7. **§20.4 — `profile.identity.roleLabels`** continua um segundo mapa incompleto; seis papéis leem em
   inglês na tela de Perfil.
8. **A flag diagnóstica TEMPORÁRIA de worker único para WebKit** continua em
   `.github/workflows/ci.yml:1214` (`--workers=1`, introduzida por `44e1e04`), com o comentário que a
   declara temporária e pede reversão "em qualquer direção" assim que a pergunta for respondida. Ela
   **não foi revertida** e **nunca foi verificada por um `workflow_dispatch` real**.
9. **F-68, F-69 e F-70** — §20.6.

## §22 — Capturas

- **216** capturas em `docs/reviews/ui/015-roles-{light,dark}-{1920,1440,1280,1024,768,390}` — 12
  diretórios × **18** estados —, produzidas pela fase 6 com `ui-capture.mjs --surface=roles`, que é a
  resposta ao item 1 de §13: elas são reproduzíveis por duas invocações de um roteiro commitado.
  Conferido em disco nesta fase: 12 × 18 = 216.
- **4** capturas em `docs/reviews/ui/015-roles-restricted-{light,dark}` (2 estados × 2 temas), do
  commit `cdbc4c8` — **anteriores às seis fases e deliberadamente mantidas, embora desatualizadas**.
  Elas mostram os nomes de papel em inglês e as descrições antigas de F-32, que hoje não existem mais.
  Ficam porque são a **única** evidência renderizada de duas coisas: o cenário restrito
  (`role:administer` sem `user:administer`, com "Relação de pessoas indisponível" e a contagem
  agregada sem nenhum dado pessoal) e o nome corrompido de §7.3, visível no cabeçalho como
  "Verifica◆◆o 015 (somente pap◆is)". Substituí-las apagaria a prova do defeito que §13 item 5 mantém
  aberto. Quem as ler deve saber que o texto que elas mostram é de antes da fase 4 e da fase 5.
- As capturas da travessia de §18 **não** foram commitadas: são material de medição desta fase, e os
  216 arquivos acima já cobrem os mesmos estados com um roteiro reproduzível.

## §23 — Fechamento (2026-09-14, HEAD `be6b734`)

`afcf7de` (§18-§22 acima) escreveu o registro de fechamento **antes** de a rodada terminar de
verdade: nove commits vieram depois dele, corrigindo o que a própria travessia tinha encontrado.
Este parágrafo é o fechamento real, escrito por último, por uma sessão de documentação separada que
sincronizou os registros permanentes contra o código em `be6b734`. Nada acima foi apagado ou
reescrito — §18 a §22 continuam descrevendo corretamente o que mediram no momento em que mediram.

**Commits entre `afcf7de` e `be6b734`, na ordem**:

| Commit | O que fez |
|---|---|
| `0b827a6` | descrições de papel semeado deixam de ser nota de desenvolvedor em inglês (F-32) |
| `b1632bd` | um papel de sistema passa a ser propriedade única da plataforma; três guardas novas (F-68 fechado, §20.6) |
| `bbae4bc` | causa real de F-72 (`mode: 'serial'` herdado, não sessão longa); `execution-ledger-reporter.ts`; fechamento também de `assets-processes.spec.ts:329` (paginação, não concorrência) |
| `fa4a8df` | primeira medição de F-71 contra build de produção — diagnóstico incompleto (só Chromium) |
| `b9b6b80` | reabertura de F-71 — a mesma medição, repetida por motor, mostra Firefox falhando em produção |
| `5b56eea` | `PUT /admin/users/{userId}/roles` deixa de devolver `UserDetail`; responde `UserRoleAssignment` minimizado (F-73 fechado) |
| `09d9e50` | catálogo único de nome de papel — `common.roleDisplayNames` substitui `admin.roles.displayNames` **e** `profile.identity.roleLabels`; ADR-022 emendada |
| `329d4c9` | completa `09d9e50` — dois arquivos de guarda, movidos por `git mv`, tinham a edição de conteúdo fora do commit |
| `d85a7a6` | causa raiz de F-71 corrigida — painel do `FilterBar` passa a existir em toda renderização, oculto por `hidden`; mesmo tratamento em `MultiSelectFilter`/`ColumnVisibilityMenu` (achado irmão, F-74) |
| `be6b734` | dez prefixos de `uniqueTestMarker` alongados para nunca produzir 43 caracteres (F-45/F-54, instâncias, não causa) |

**Regressão final citada por `docs/deferred-findings.md` F-72** (mesmo snapshot, não repetido aqui
por inteiro): Web unit 1013/1013, API unit 661/661, integração 297/297, contrato 827/827, E2E
Chromium 198/198, `admin-roles` Firefox+WebKit 32/32, 105 varreduras axe sem falha,
lint/typecheck/format:check/openapi:check limpos — números relatados pela sessão de implementação,
parcialmente confirmáveis por mensagem de commit (Web unit, API unit, integração, contrato e E2E
Chromium o são; os dois restantes e os quatro portões de qualidade não foram reexecutados por quem
fechou este registro). Zero bloqueadores novos abertos por esta rodada.

**O que continua aberto**, herdado de §21/§20.6 e sem mudança de fundo:

1. **F-45/F-54 (classe)** — `be6b734` alongou os dez prefixos que produziam 43 caracteres, mas não
   tocou `uniqueTestMarker` nem `RAW_SESSION_TOKEN`. O próximo prefixo novo de seis caracteres
   reproduz a colisão. Ver a nota datada em `docs/deferred-findings.md` F-45.
2. **F-70 (identidade real)** — contas de E2E continuam se acumulando e nascendo com
   `Platform Administrator`. Não confundir com o "catraca" de `assets-processes.spec.ts`, que
   `bbae4bc` fechou e que era acumulação de registros de Ativo/Processo, não de contas — a mensagem
   de `bbae4bc` atribui esse segundo fenômeno a F-70, o que está corrigido em
   `docs/deferred-findings.md`.
3. **`DisclosureGroup` — mecanismo latente, não corrigido** — `d85a7a6` deu ao componente
   (`packages/design-system/src/components/disclosure-group.tsx`) só um comentário: ele ainda
   desmonta o conteúdo quando fechado, o mesmo mecanismo que produziu F-71 em `FilterBar`. Não
   corrigido porque, nos três consumidores desta tela (`role-detail-panel.tsx`,
   `role-edit-fields.tsx`, `role-permissions-tab.tsx`), montar sempre o conteúdo renderiza o
   catálogo de permissões inteiro — troca de custo diferente da de `FilterBar`, decisão sob
   CLAUDE.md §16.
4. **Sem E2E da linha de papéis do Perfil** — `09d9e50` cobriu isso por teste de unidade
   (`profile-view.test.tsx`); nenhum spec sob `apps/web/e2e/` visita `/profile` e afirma a linha
   "Papéis". Ver F-75.
5. **Referência morta em comentário de teste** — `apps/web/e2e/admin-roles.spec.ts:40` ainda cita
   `apps/api/test/integration/role-admin.spec.ts`, que nunca existiu; a tabela §5.2 deste documento
   já corrigiu o mesmo engano internamente (nota em §5.2, "Corrigido antes de este documento ser
   fechado"), mas o comentário dentro do arquivo de teste não foi tocado — fora do território de
   documentação. Ver F-76.
6. **D-23 não aplicada nesta máquina de referência** — ver nota datada em `docs/local-environment.md`.

Nenhum destes é bloqueador de produto. Todos têm dono e portão registrados no achado correspondente
de `docs/deferred-findings.md`.
