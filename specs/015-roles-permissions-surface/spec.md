# Feature Specification: Superfície de Papéis e Permissões

**Feature Branch**: `015-roles-permissions-surface`

**Created**: 2026-09-13

**Status**: Draft

**Input**: Pedido direto do usuário — redesenhar e implementar a tela Administração → Papéis e
permissões a partir de um mockup fornecido, transformando a tabela atual numa superfície
administrativa de controle de acesso: quatro cards-resumo, busca e filtros, lista de papéis em
cartões, painel lateral de detalhe com permissões agrupadas por módulo e usuários atribuídos,
identificadores técnicos sob demanda, e edição dentro do painel. O mockup é referência **visual**;
o modelo real do Vértice GRC permanece a fonte de verdade **funcional e de segurança**.

**Numeração**: o pedido dizia `011-roles-permissions-surface`. `011-dashboard-platform-view`,
`012-admin-roles-screen`, `013-stabilization-audit` e `014-institutional-loader` já ocupam
011–014; esta fase é a **015**.

---

## Relação com a fase 012, que passou por esta mesma tela hoje

`specs/012-admin-roles-screen/STATE.md` é de **2026-09-13**, o mesmo dia deste documento, e cobriu
exatamente `/admin/roles`. Ele não é descartado: suas decisões foram medidas na aplicação
renderizada, e três delas **continuam valendo sem alteração** nesta fase. Duas são revertidas, por
pedido explícito do usuário, e a reversão é registrada aqui em vez de acontecer em silêncio —
porque reverter uma decisão medida sem dizer por quê é como um registro "concluído" falso nasce
(`specs/005-audit-findings/STATE.md` §3).

| Decisão de 012 | Nesta fase |
|---|---|
| §2.3 — áreas ordenadas **por concentração de permissões**, não por ordem de produto | **Mantida, e herdada pelos chips.** A ordem de produto fazia quase toda linha começar por "Riscos · Planos de Ação" e o Audit Lead parecer papel de risco. Os chips do cartão e a ordem dos accordions do painel usam a mesma regra |
| §2.2 — tipo do papel como etiqueta neutra com texto nos dois casos, cadeado como segundo canal | **Mantida.** `RoleTypeTag` é reaproveitado como está |
| §2.3 — verbo derivado do **identificador**, nunca do campo `action` | **Mantida.** `control:test` tem `action = ASSESS`; rotular por `action` mostraria "Avaliar" para "Testar" |
| §2.1 — `DataTable` como componente da lista, por consistência com os demais registros | **Revertida.** O usuário pediu lista em cartões. Justificativa registrada em "Decisões", D-03 |
| §2.4 — `Dialog` em vez de `Sheet`, porque `sheet.tsx` não tem a restauração de foco de D-15 | **Revertida, com a causa corrigida antes.** O impedimento era real e continua real; esta fase o remove portando o hook (T-pré-01) em vez de conviver com ele |

As quatro correções de §3 de 012 (422 em papel do sistema, altura do diálogo, foco em `<body>`
por remontagem de coluna, foco em `<body>` por abertura pelo `onSelect` do menu) são **regressões
proibidas**: cada uma tem teste, e os testes migram para os componentes novos junto com o
comportamento.

---

## Contexto medido, não presumido

Tudo abaixo foi verificado contra o repositório antes deste documento ser escrito, por leitura de
código e `grep` — nunca por leitura de outro documento de planejamento.

| Fato | Como foi verificado | Resultado |
|---|---|---|
| O modelo `Role` tem exatamente seis campos | `apps/api/prisma/schema.prisma:711-723` | `id`, `name` (único), `description`, `isSystem`, `createdAt`, `updatedAt`. **Não existem** `slug`, `isBuiltIn`, `protected`, `parentId`, `color` |
| **Não existe herança ou composição entre papéis**, em nenhuma camada | `schema.prisma:711-723` (sem auto-relação); `apps/api/src/core/authorization/infrastructure/prisma-permission.repository.ts:33-48`; `grep -rE "parentRole\|roleHierarchy\|inherit\|childRole\|roleInclusion"` em `apps/api/src` e `apps/api/prisma` | a resolução efetiva é **um `JOIN` plano** sobre os papéis diretos do usuário, deduplicado por `Set`. Sem recursão, sem CTE, sem expansão transitiva |
| **Não existe conceito de papel privilegiado/elevado** | `grep -rE "privileg\|elevated\|superuser\|super_admin\|isAdmin"` em `apps/api/src` e `apps/api/prisma`; `permission.guard.ts:144-209` | nenhum acerto sobre papéis. O guard não tem ramo de bypass: só `@Public()` e `@NoPermissionRequired()`. O próprio seed declara que Platform Administrator **não** é especial (`platform.seed.ts:136-138`) |
| A atribuição de papel **não é escopada** | `schema.prisma:740-752` (`model UserRole`) | chave `(userId, roleId)`, mais `grantedByUserId` e `grantedAt`. Nenhuma coluna de escopo. Permissão é global ao usuário |
| Escopo organizacional é uma **segunda dimensão, por usuário** | `schema.prisma:807-820` (`model OrgScopeGrant`); `apps/api/src/core/organizations/application/scope-resolver.service.ts` | `scopeType = GLOBAL \| UNIT`; zero grants ⇒ `emptyScope()` (vê nada, nunca tudo). Aplicado no repositório via `ScopeFilter`, não no guard |
| O catálogo tem **70 permissões**, formato `resource:action` | `apps/api/src/permission-catalogue.ts:68-114`; os 14 arquivos `*-permissions.ts` | agregadas por `combinePermissionDefinitions`, que lança em identificador duplicado |
| `PermissionDefinition` **não tem** metadado de módulo/área | `apps/api/src/core/authorization/domain/permissions.ts:103-108`; `role-response.mapper.ts:8-13` | quatro campos: `identifier`, `resource`, `action`, `description`. O agrupamento em áreas existe **só no cliente** |
| A taxonomia de áreas **já existe no cliente**, com rótulos pt-BR | `apps/web/src/features/admin/components/roles/permission-grouping.ts:45-84`; `apps/web/src/lib/messages/admin.ts:198-213` | 14 áreas em `AREA_ORDER`, mapa `RESOURCE_AREA` cobrindo os 20 recursos, recurso desconhecido cai em `other` com o identificador cru |
| As 70 descrições de permissão chegam **em inglês** | F-63 (`docs/deferred-findings.md`); `GET /admin/permissions` | ex.: "View risk records within the caller's organizational scope." A mitigação vigente é o verbo e a área em pt-BR ao lado do identificador |
| Os 12 papéis semeados são **todos** `isSystem: true` | `apps/api/prisma/seed/platform.seed.ts:131-637`, `:810-836` | papel criado pela API nunca é de sistema (`prisma-role.repository.ts:69` força `isSystem: false`) |
| O servidor recusa, em papel de sistema, **apenas** `name` e `permissionIdentifiers` | `apps/api/src/core/authorization/application/role-admin.service.ts:173-178` | `description` é **permitida** e auditada. Exclusão é recusada sempre (`:234-239`) |
| Não existe rota que liste os usuários de um papel | `grep` por `/admin/roles/{roleId}/users` em código, contratos e `openapi.json` | o equivalente é `GET /admin/users?roleId=<uuid>`, que exige **`user:administer`** (`admin-users.controller.ts:82-105`) |
| Nenhum endpoint devolve "usuários distintos com ≥ 1 papel" | leitura de `admin-roles.controller.ts`, `admin-users.controller.ts`, `role-response.mapper.ts` | `assignedUserCount` é por papel; somá-lo conta duas vezes quem tem dois papéis |
| `UserResponse` não carrega escopo | `apps/api/src/core/identity/presentation/dto/admin-user-response.mapper.ts:24-39` | traz `primaryOrgUnit` e `roles`; `scopeGrants` só existe em `UserDetailResponse`, ou seja, no detalhe por usuário |
| `getRole` existe no cliente web e **não tem nenhum chamador** | `apps/web/src/features/admin/api.ts:123`; `grep` em `apps/web/src` | o padrão que CLAUDE.md §19.10 diz que o projeto já pagou sete vezes |
| `Sheet` existe e tem **zero consumidores** | `apps/web/src/components/ui/sheet.tsx`; `grep` por `SheetContent` em `apps/web/src` | só o próprio arquivo |
| `sheet.tsx` **não tem** a restauração de foco que `dialog.tsx` tem | `grep -n "onCloseAutoFocus"` nos dois arquivos | `dialog.tsx:56-108` compõe `handleCloseAutoFocus`; `sheet.tsx` não menciona foco em lugar nenhum |
| A correção de foco **já está extraída como hook reutilizável** | `packages/design-system/src/lib/use-restore-focus.ts`; `dialog.tsx:88-93`, `:111` | `useDialogFocusRestore` + `FocusRestoreAnchor`, captura na fase de render, resolve item de menu → gatilho por `aria-labelledby`. Já compartilhado com `ConfirmDialog` (34 chamadores) |
| **Não existe Accordion nem Collapsible** | `grep -ri "accordion\|collapsible"` em `apps/web/src` e `packages/design-system/src` | o idioma de disclosure do projeto é `aria-expanded`/`aria-controls` manuais (`filter-bar.tsx:196-219`) + `use-disclosure-close.ts` |
| `Checkbox` **não suporta estado indeterminado** | `apps/web/src/components/ui/checkbox.tsx:21-26`; `grep -i indeterminate` nos dois pacotes | zero ocorrências; o `Indicator` só renderiza `CheckIcon` |
| `checkbox.tsx` **não** está entre os primitivos de D-15 | `docs/local-environment.md:493` | D-15 cobre **cinco**: `dialog.tsx`, `select.tsx`, `avatar.tsx`, `sheet.tsx`, `table.tsx` |
| `next/link` e `useRouter` são **proibidos por lint** em `apps/web` | `eslint.config.mjs`, `no-restricted-imports` (introduzido na 014) | navegação passa por `@/components/navigation/link` e `useNavigate`. Escrita de query string de filtro **não** é navegação: usa o padrão dos hooks de catálogo |
| `SummaryStatCard` é o card-resumo compartilhado, com cinco consumidores | `packages/design-system/src/components/summary-stat-card.tsx`; os cinco `*-register-summary.tsx` | `tone` tinge só o chip do ícone e uma borda de 2px; o componente **não** contém nada interativo — quem envolve em link ou botão é o chamador |
| `/admin/roles` já faz **17 consultas** por carregamento | 013 §5, achado A7-F07 | medido, sem efeito visível em localhost. É o mesmo padrão que estourou em 429 na F-61 |
| A barra de resultados com ordenação + `ViewToggle` transborda a 390 px | F-66 causa 1 | `flex items-center gap-3` sem quebra, 395–427 px, duplicado em seis arquivos |

### Achados fora do escopo desta especificação

Registrados porque foram vistos ao medir, não corrigidos aqui:

1. **F-63 / F-32** — descrições de permissão em inglês e descrições de papéis semeados citando
   artefatos internos de spec. Corrigir exige tocar oito catálogos de domínio, o banco e o seed;
   §18.9 proíbe fazê-lo dentro de uma onda de interface.
2. **A7-F07** — as 17 consultas de `/admin/roles` vêm do `countAssignedUsers` por linha
   (`prisma-role.repository.ts:124-126`, N+1 consciente). Esta fase **não** o corrige, mas também
   não o agrava: o endpoint novo é agregado, e a tela não dispara requisição por linha.
3. **Ausência de checagem anti-escalação de privilégio** — quem tem `role:administer` pode colocar
   qualquer permissão do catálogo em qualquer papel e atribuí-lo a si mesmo. A ausência já está
   documentada no próprio serviço (`role-admin.service.ts:32-45`). Esta fase **não** a supre: seria
   mudança de regra de autorização, que o usuário instruiu a parar e apresentar antes de fazer.

---

## Cenários de usuário

### Principal

Um administrador com `role:administer` abre Administração → Papéis e permissões. Em uma tela ele vê
quantos papéis existem, quantos são do sistema e quantos foram criados pela organização, e quantas
pessoas têm algum papel. Busca um papel pelo nome, restringe a lista aos papéis do sistema, e abre
um deles. Sem perder a lista de vista, lê o que aquele papel concede — agrupado pelos módulos do
produto, não como uma parede de identificadores — expande o módulo que lhe interessa, confere quem
tem o papel, e, se for um papel personalizado, ajusta as permissões vendo antes o que exatamente
vai mudar.

### Aceitação

1. **Dado** um administrador com `role:administer`, **quando** abre a tela, **então** os quatro
   indicadores refletem os dados reais da plataforma e a lista mostra todos os papéis com nome,
   tipo, descrição resumida, módulos alcançados e as contagens de permissões e de usuários.
2. **Dado** que ele digita no campo de busca, **quando** o termo casa com o nome ou a descrição de
   um papel, **então** a lista se restringe a ele, e o indicador de resultados diz quantos restaram.
3. **Dado** que ele aciona o indicador "Papéis do sistema", **quando** o controle é ativado,
   **então** a lista passa a mostrar só papéis de sistema e o controle fica visivelmente
   selecionado, alcançável e operável por teclado.
4. **Dado** que ele seleciona um papel, **quando** o painel abre, **então** o painel mostra nome,
   tipo, classificação de privilégio quando aplicável, descrição completa e as três contagens; em
   `xl` ou mais a lista continua visível e operável ao lado; abaixo de `xl` o painel cobre a tela,
   prende o foco e fecha com `Esc`.
5. **Dado** o painel aberto na aba Permissões, **quando** ele expande um módulo, **então** vê cada
   permissão daquele módulo com rótulo em pt-BR; **e quando** aciona "Ver identificadores
   técnicos", **então** o identificador real (`risk:view`) aparece ao lado de cada rótulo.
6. **Dado** o painel aberto, **quando** ele lê a aba Permissões, **então** o painel afirma que as
   permissões são concedidas diretamente por este papel, que não há herança entre papéis, e que o
   acesso efetivo de uma pessoa é a união dos papéis atribuídos a ela.
7. **Dado** um administrador que tem `role:administer` **e** `user:administer`, **quando** abre a
   aba Usuários, **então** vê quem tem o papel, com unidade organizacional e os demais papéis de
   cada pessoa.
8. **Dado** um administrador que tem `role:administer` **mas não** `user:administer`, **quando**
   abre a aba Usuários, **então** vê a contagem agregada e uma explicação de que listar pessoas
   exige `user:administer` — **e nenhum nome, e-mail, unidade ou outro dado pessoal aparece**.
9. **Dado** um papel personalizado, **quando** ele entra em edição e marca e desmarca permissões,
   **então** um resumo mostra o que será acrescentado e o que será removido antes de salvar;
   **quando** cancela, **então** nada é persistido e o painel volta ao estado de leitura.
10. **Dado** um papel do sistema, **quando** ele entra em edição, **então** nome e permissões
    aparecem legíveis e travados, com a razão escrita em texto, só a descrição é editável, e o
    salvamento envia somente a descrição.
11. **Dado** um usuário sem `role:administer`, **quando** alcança a rota diretamente, **então** o
    servidor recusa e a tela apresenta o erro sem expor dados de papéis.

### Casos de borda

- Papel sem nenhuma permissão: contagem zero, sem módulos, e o painel diz que nada é concedido.
- Papel com as 70 permissões em 13 áreas: a lista de módulos resume com "+N módulos"; o painel rola
  internamente com cabeçalho e rodapé fixos.
- Nome muito longo e descrição muito longa: o nome quebra, a descrição corta em duas linhas no
  cartão e aparece inteira no painel. O texto persistido **não** é alterado.
- Busca sem resultado: estado "nenhum resultado" com ação de limpar, distinto do estado "nenhum
  papel existe".
- Falha ao carregar os indicadores: degrada para uma linha discreta e **nunca** esconde a lista.
- Falha ao carregar a lista: estado de erro com `correlationId` e ação de repetir.
- Mais de 100 papéis: a lista permanece paginada pelo contrato existente.

---

## Requisitos

### Funcionais — leitura

- **FR-001**: A tela DEVE exibir quatro indicadores: total de papéis, papéis do sistema, papéis
  personalizados e usuários com papéis.
- **FR-002**: Os três primeiros indicadores DEVEM ser controles interativos que aplicam o filtro de
  tipo correspondente — "Papéis" limpa o filtro, "Papéis do sistema" seleciona Sistema, "Papéis
  personalizados" seleciona Personalizados. DEVEM ser elementos interativos nativos, operáveis por
  teclado, com `focus-visible` e estado selecionado perceptível por mais que cor. Um `div` com
  `onClick` **não** satisfaz este requisito.
- **FR-003**: O quarto indicador, "Usuários com papéis", **não** navega nem filtra.
- **FR-004**: Os valores dos indicadores DEVEM vir de dados reais da API. Nenhum número
  hard-coded.
- **FR-005**: A tela DEVE permitir buscar papel por nome ou descrição, filtrar por tipo
  (Todos/Sistema/Personalizados), filtrar por módulo e ordenar.
  - **FR-005a**: O filtro por módulo seleciona uma área da taxonomia `PermissionArea`; um papel
    casa quando concede **ao menos uma** permissão daquela área. Um papel sem permissão alguma não
    casa com nenhum módulo.
  - **FR-005b**: As ordenações disponíveis são nome (A–Z e Z–A), quantidade de permissões e
    quantidade de usuários. A ordenação vigente DEVE ser sempre nomeável pelo próprio controle,
    como faz `SortSelect`.
  - **FR-005c**: Busca, filtros e ordenação operam sobre o conjunto que a tela já carregou —
    `GET /admin/roles` devolve os papéis em uma página e o contrato não oferece busca nem
    ordenação no servidor. Nenhum parâmetro novo de consulta é introduzido nesta fase.
- **FR-006**: Cada papel DEVE ser apresentado com nome, tipo, classificação de privilégio quando
  aplicável, descrição resumida visualmente, módulos alcançados, contagem de permissões, contagem
  de usuários e uma afordância explícita de abrir detalhes.
- **FR-007**: A ordem dos módulos exibidos DEVE seguir a concentração de permissões do papel
  (decisão de 012 §2.3), com o excedente resumido em "+N módulos". A lista completa DEVE estar
  disponível a leitor de tela.
- **FR-008**: A descrição DEVE ser truncada apenas visualmente. O dado persistido **não** muda e o
  texto completo permanece no painel.

### Funcionais — painel de detalhe

- **FR-009**: Selecionar um papel DEVE abrir um painel de detalhe **sem** navegar para outra
  página. A lista DEVE permanecer no contexto.
- **FR-010**: Em viewport `xl` ou maior, o painel DEVE ser não-modal e a lista DEVE continuar
  operável. Abaixo de `xl`, o painel DEVE ser um overlay com foco preso, fechamento por `Esc` e
  restauração de foco ao elemento que o abriu.
- **FR-011**: O cabeçalho do painel DEVE mostrar nome, tipo, classificação de privilégio quando
  aplicável, descrição completa e três contagens: permissões, usuários e módulos.
- **FR-012**: O painel DEVE ter as abas Permissões e Usuários.
- **FR-013**: A aba Permissões DEVE agrupar por módulo, usando **exclusivamente** a taxonomia
  `PermissionArea` existente. Criar uma segunda taxonomia é proibido.
- **FR-014**: Cada grupo DEVE ser expansível, mostrar a contagem do módulo, e permitir expandir
  todos de uma vez.
- **FR-015**: A aba Permissões DEVE declarar o modelo de autorização real: as permissões são
  concedidas diretamente pelo papel; **não há herança entre papéis**; o acesso efetivo de uma
  pessoa é a união dos papéis atribuídos a ela. A interface **não** DEVE usar "herdada de" nem
  sugerir hierarquia.
- **FR-016**: O painel DEVE oferecer "Ver identificadores técnicos", que revela o identificador
  real ao lado de cada rótulo. Os identificadores **não** DEVEM ser alterados.
- **FR-017**: Os rótulos pt-BR DEVEM derivar do catálogo existente (`permissionCatalog.verbs`,
  `.resources`, `.areas`). A descrição vinda da API, hoje em inglês (F-63), permanece como texto
  secundário — nunca como rótulo primário.

### Funcionais — aba Usuários e fronteira de segurança

- **FR-018**: A aba Usuários DEVE consumir `GET /admin/users?roleId=` **apenas** quando o usuário
  atual possuir `user:administer`.
- **FR-019**: `role:administer` **não** implica `user:administer`. É proibido criar endpoint
  alternativo protegido só por `role:administer` para contornar essa fronteira.
- **FR-020**: Sem `user:administer`, a aba DEVE degradar mostrando somente a contagem agregada
  legitimamente disponível por `GET /admin/roles`, e uma explicação da exigência. **Nenhum nome,
  e-mail, cargo, unidade ou outro dado administrativo de pessoa pode aparecer.**
- **FR-021**: Com `user:administer`, cada pessoa DEVE ser apresentada com os campos que
  `UserResponse` já traz: nome, e-mail, cargo, status, unidade organizacional primária e os demais
  papéis que ela detém.
- **FR-022**: O escopo organizacional **não** DEVE ser apresentado como propriedade da atribuição
  `UserRole`. O painel DEVE explicar que o escopo é concedido por usuário (`OrgScopeGrant`).
- **FR-023**: Detalhe ou link de escopo só DEVE aparecer quando o usuário atual estiver autorizado
  a consultá-lo.
- **FR-024**: A aba **não** DEVE fazer uma requisição por pessoa (N+1). Uma requisição paginada por
  abertura da aba.
- **FR-025**: Os demais papéis de uma pessoa PODEM ser apresentados como contexto de proveniência
  real de acesso, e **não** DEVEM ser rotulados como herança.

### Funcionais — edição

- **FR-026**: O painel DEVE oferecer "Editar papel" quando o usuário atual tiver `role:administer`.
- **FR-027**: A edição DEVE acontecer dentro do painel, preservando a linguagem visual da tela.
- **FR-028**: A seleção de permissões DEVE ser agrupada por módulo, com estado por módulo
  distinguível entre todas, parcialmente e nenhuma selecionadas.
- **FR-029**: A edição DEVE mostrar um resumo das alterações pendentes — o que será acrescentado e
  o que será removido — antes de salvar.
- **FR-030**: A edição DEVE informar que a alteração passa a valer na próxima requisição de cada
  usuário afetado, sem novo login (mensagem `effectNotice` já existente, FR-028 de 001).
- **FR-031**: Para papel do sistema, nome e permissões DEVEM aparecer legíveis e travados, com a
  razão escrita em texto, e o `PATCH` DEVE enviar **somente** `description`.

  > **Emenda de 2026-09-14 — a segunda metade desta exigência foi revogada.** A parte sobre
  > legibilidade e travamento com razão escrita **permanece em vigor** e foi reforçada. Mas
  > "o `PATCH` DEVE enviar somente `description`" deixou de valer: F-68 mostrou que aceitar
  > `description` num papel de sistema criava dois donos para o mesmo campo — o administrador
  > editava, a edição era auditada como `role.updated`, e a execução seguinte do seed a apagava
  > **sem gravar evento de auditoria**, porque o seed não tem identidade atuante (ADR-005). A
  > trilha passava a afirmar um estado que o banco não tinha mais.
  >
  > Decisão de produto tomada em 2026-09-14: **papel de sistema é controlado pela plataforma por
  > inteiro.** O servidor recusa `name`, `description` e `permissionIdentifiers`, inclusive quando
  > o valor enviado é idêntico ao armazenado — a regra é sobre **quem pode escrever**, não sobre
  > se o valor mudou. Em consequência, a interface não oferece salvamento algum para papel de
  > sistema: no lugar de "Editar papel" há "Ver definição", que abre a mesma composição em modo de
  > leitura, com os três campos e suas razões. Um botão cujo salvamento o servidor sempre recusaria
  > é uma promessa que o produto não cumpre.
  >
  > O seed **continua** reconciliando `description`; papéis personalizados continuam
  > administráveis sem alteração. Nada disso mexeu em schema, migration ou proveniência por campo.
- **FR-032**: Cancelar DEVE descartar as alterações sem persistir nada.
- **FR-033**: As validações do servidor DEVEM permanecer intactas. O cliente **nunca** é a única
  proteção.
- **FR-034**: `role-create-dialog.tsx` permanece fora do escopo desta fase.

### Funcionais — classificação de privilégio

- **FR-035**: A tela PODE classificar um papel como privilegiado, **exclusivamente** para
  apresentação, quando ele conceder `role:administer`, `user:administer` ou `org_unit:administer`.
- **FR-036**: Essa classificação **não** DEVE ser persistida, **não** DEVE alterar o schema, e
  **não** DEVE ser consultada por `PermissionGuard`, pela resolução de permissões, por segregação
  de funções ou por qualquer decisão de segurança.
- **FR-037**: As permission definitions permanecem a única fonte de verdade para autorização.
- **FR-038**: A fronteira DEVE estar registrada em ADR antes da implementação.

### Backend

- **FR-039**: DEVE existir `GET /admin/roles/summary`, somente leitura, exigindo `role:administer`,
  devolvendo `totalRoles`, `systemRoles`, `customRoles` e `usersWithRoles`.
- **FR-040**: `usersWithRoles` DEVE ser `COUNT(DISTINCT user_id)` sobre `user_roles`, de modo que
  uma pessoa com vários papéis conte **uma vez**.
- **FR-041**: O endpoint DEVE atravessar o caminho normal de aplicação e o `PermissionGuard`.
- **FR-042**: O endpoint **não** DEVE alterar `Role`, criar tabela, nem mudar escopo, auditoria ou
  resolução de permissões.
- **FR-043**: O contrato OpenAPI DEVE ser atualizado e a operação DEVE passar a ser coberta por
  `contract-coverage.spec.ts`.

### Não-funcionais

- **NFR-001**: A interface DEVE estar inteiramente em pt-BR, nos catálogos centralizados
  (`apps/web/src/lib/messages/`), nunca embutida em componente (CLAUDE.md §11.1).
- **NFR-002**: Componente novo de design system **não** DEVE conter string voltada ao usuário
  (D-10); todo texto entra por prop obrigatória.
- **NFR-003**: A tela DEVE preservar navegação por teclado, foco visível, HTML semântico, rótulos
  acessíveis, contraste WCAG AA e hierarquia de títulos, nos temas claro e escuro.
- **NFR-004**: Cor **não** pode ser o único indicador de tipo de papel, privilégio, estado de
  seleção ou estado de permissão.
- **NFR-005**: A tela DEVE funcionar sem rolagem horizontal da página nas larguras suportadas,
  incluindo 390 px — sem herdar a causa 1 de F-66.
- **NFR-006**: A tela **não** DEVE disparar requisição por linha, por usuário ou por permissão
  (F-59/F-61, A7-F07).
- **NFR-007**: Navegação DEVE usar `@/components/navigation/link` e `useNavigate`; `next/link` e
  `useRouter` são proibidos por lint. Escrita de query string de filtro segue o padrão dos hooks de
  catálogo.
- **NFR-008**: Alterar `checkbox.tsx` o torna o sexto primitivo deliberadamente modificado; D-15
  DEVE ser atualizado e os consumidores existentes DEVEM ter regressão verificada.
- **NFR-009**: Alterar `sheet.tsx` DEVE preservar a modificação de D-15 já existente (label de
  fechar em pt-BR) e re-executar `e2e/accessibility.spec.ts`.

---

## Decisões

- **D-01 — Privilegiado é classificação derivada de apresentação.** Função pura sobre as permissões
  que o papel já traz, verdadeira para `role:administer`, `user:administer` ou `org_unit:administer`
  — as três que permitem alterar quem pode o quê. Hoje, só Platform Administrator. Alternativa
  descartada: qualquer `action = ADMINISTER`, que marcaria 6 dos 12 papéis e esvaziaria o sinal.
  ADR obrigatório (FR-038).
- **D-02 — Um endpoint agregado, não quatro contagens derivadas.** Três dos quatro indicadores
  seriam deriváveis da lista; o quarto não é derivável sem mentir. Uma requisição agregada também
  não agrava A7-F07.
- **D-03 — Lista em cartões, revertendo 012 §2.1.** Pedido explícito do usuário, e justificado pelo
  conteúdo: o cartão carrega cinco dimensões por papel (tipo, privilégio, descrição, módulos, duas
  contagens) que a linha de tabela comprimia. `DataTable` permanece o padrão dos registros de
  negócio; esta é uma tela de administração com item de tamanho fixo, não um registro filtrável de
  milhares de linhas. A divergência é registrada aqui, conforme §18.12.
- **D-04 — Painel estrutural no design system, não importado do domínio de Riscos.** O padrão de
  `RiskQuickView` é reaproveitado como **estrutura**, não como componente: Administração não importa
  nada chamado `Risk*`. A casca vai para `packages/design-system`, sem string própria. Migrar
  `RiskQuickView` e `ControlQuickView` para ela está **fora do escopo** e fica registrado como
  trabalho seguinte — a casca nasce com um consumidor real, exercitada, não como intenção
  (§19.10).
- **D-05 — `Sheet` recebe o hook de foco antes de qualquer consumidor.** Pré-requisito sequencial
  com teste próprio, removendo a causa que 012 §2.4 mediu em vez de conviver com ela.
- **D-06 — Disclosure por módulo segue o idioma existente**, com `aria-expanded`/`aria-controls`
  manuais. Nenhuma dependência nova de Accordion.
- **D-07 — Remoção de código antigo é comprovada, não presumida.** `role-admin-columns.tsx`,
  `role-details-dialog.tsx` e `role-edit-dialog.tsx` só saem depois de verificados os consumidores,
  migrado o comportamento e migrada a cobertura. `role-permissions-summary.tsx` é consumido pela
  tela de Usuários (`user-roles-dialog.tsx:27,160`) e **não** é tocado.

---

## Entidades

Nenhuma entidade nova. Nenhuma alteração de schema.

- **Role** — lida como está; `description` é o único campo editável em papel de sistema.
- **Permission** — lida como está; agrupada por `PermissionArea`, taxonomia de cliente já existente.
- **UserRole** — lida indiretamente por `assignedUserCount` e por `GET /admin/users?roleId=`.
- **OrgScopeGrant** — **não** é lida por esta tela; é explicada como dimensão do usuário.

---

## Critérios de sucesso

- **SC-001**: Um administrador identifica, sem rolar, quantos papéis existem, quantos são do
  sistema e quantos são personalizados.
- **SC-002**: Abrir um papel e entender o que ele concede não exige ler identificadores técnicos,
  mas eles continuam disponíveis sob demanda em um acionamento.
- **SC-003**: Nenhuma afirmação da interface sobre proveniência de acesso contradiz o modelo real:
  zero ocorrências de "herdada de" ou equivalente.
- **SC-004**: `usersWithRoles` conta uma pessoa com dois papéis uma única vez, provado por teste.
- **SC-005**: A classificação de privilégio não tem efeito sobre autorização, provado por teste.
- **SC-006**: Um usuário com `role:administer` e sem `user:administer` não obtém nenhum dado pessoal
  pela tela, provado por teste.
- **SC-007**: A tela não emite requisição por linha: o número de requisições ao abrir é constante em
  relação à quantidade de papéis, provado por medição.
- **SC-008**: Nenhuma regressão de foco: painel, overlay e edição devolvem o foco ao elemento que os
  abriu.
- **SC-009**: Zero violações axe nos dois temas, sobre a tela **efetivamente renderizada** — a
  varredura espera o elemento real, não um substituto que renderiza antes (lição de F-28).
- **SC-010**: Sem rolagem horizontal da página de 1920 a 390 px.

---

## Fora de escopo

- Herança ou composição entre papéis.
- Escopo organizacional na atribuição de papel.
- Checagem anti-escalação de privilégio no servidor.
- Correção de F-63/F-32 (descrições em inglês, referências internas no seed).
- Correção de A7-F07 (N+1 de `countAssignedUsers`).
- `role-create-dialog.tsx`.
- Migração de `RiskQuickView`/`ControlQuickView` para a casca nova.
- Filtro por papel na tela de Usuários.
