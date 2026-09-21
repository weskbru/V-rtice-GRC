# Research — Superfície de Papéis e Permissões

**Feature**: `015-roles-permissions-surface` · **Spec**: [spec.md](./spec.md) · **Date**: 2026-09-13

Cada decisão abaixo foi tomada contra o repositório real — schema, código de aplicação, contratos e
documentos de arquitetura já existentes — e não contra a intuição de como o projeto "provavelmente"
resolveria a pergunta. É a mesma disciplina que `006-assets-processes/research.md`,
`008-incidents-problems/research.md` e `009-indicators-reports/research.md` já registraram, pela
mesma razão: este projeto já pagou várias vezes por uma causa escrita com confiança e errada
(`specs/005-audit-findings/STATE.md` §3/§6).

`spec.md` já mediu o contexto — modelo `Role`, ausência de herança, ausência de conceito de
privilégio no servidor, `OrgScopeGrant`, catálogo de 70 permissões, taxonomia `PermissionArea`,
restrições de papel de sistema, D-15, F-63, F-59/F-61 e A7-F07. Este documento **não** repete aquela
medição: ele decide o que a especificação deixou em aberto, e toda citação de código abaixo foi
reconferida por leitura direta do arquivo antes de ser escrita.

As nove decisões cobrem: como o produto classifica um papel como privilegiado (R-001), de onde vêm
os quatro indicadores (R-002), qual componente apresenta a lista (R-003), onde nasce a casca do
painel (R-004), o que precisa acontecer antes de `Sheet` ter o primeiro consumidor (R-005), como um
módulo expande e recolhe (R-006), como um seletor representa estado parcial (R-007), em que arquivo
a operação nova entra no contrato (R-008) e onde busca, filtro e ordenação são executados (R-009).

---

## R-001 — "Privilegiado" é derivação de apresentação sobre três permissões de governança

**Decisão**: a tela classifica um papel como **privilegiado** quando ele concede ao menos uma de
`role:administer`, `user:administer` ou `org_unit:administer`. A classificação é uma função pura
sobre a lista de permissões que a resposta de `GET /admin/roles` já traz — vive no cliente, não é
persistida, não altera schema e nunca é consultada por nenhuma decisão de autorização. A fronteira é
registrada em ADR própria (`spec.md` FR-038), **ADR-021**.

**Justificativa**: as três permissões escolhidas são exatamente as que permitem alterar *quem pode o
quê*. Elas existem, com esses identificadores, em
`apps/api/src/core/authorization/domain/permissions.ts:119-121` (o registro de identificadores
válidos) e `:155`, `:161`, `:167` (as definições). Um papel que concede qualquer uma delas pode
reescrever o ambiente de controle da própria plataforma — é essa a propriedade que merece ser
sinalizada ao administrador, e não "administra alguma coisa".

A classificação precisa ser de apresentação porque o servidor **não tem, e não deve ganhar aqui, um
conceito de papel elevado**: `apps/api/src/core/authorization/presentation/permission.guard.ts:144-209`
não possui nenhum ramo de bypass — só `@Public()` e `@NoPermissionRequired()` alteram o caminho, e
mesmo o segundo continua exigindo ator presente. A resolução efetiva é um `JOIN` plano sobre os
papéis diretos do usuário, deduplicado por `Set`
(`apps/api/src/core/authorization/infrastructure/prisma-permission.repository.ts:33-48`). Introduzir
um conceito de privilégio no servidor seria introduzir um segundo eixo de autorização ao lado das
permission definitions, que é precisamente o que CLAUDE.md §19.7 proíbe quando fala em estado
derivado com um calculador único — aqui, o "calculador único" de acesso é a resolução de permissões,
e ela não pode ganhar um concorrente.

**Alternativas descartadas**:

- *Classificar por `action = ADMINISTER`* — descartada por esvaziar o sinal. `PermissionAction` é uma
  categoria grosseira do enum (`permissions.ts:103-108`), e vários domínios de negócio têm a sua
  própria permissão de administração; `spec.md` D-01 mediu o efeito: marcaria **6 dos 12 papéis
  semeados**. Um indicador que marca metade da população não distingue nada — e, pior, marcaria como
  "privilegiado" papéis que não podem alterar nenhuma atribuição de acesso, o que seria uma
  afirmação falsa da interface sobre o modelo de segurança (o defeito que `spec.md` SC-003 proíbe
  para proveniência de acesso, aqui na forma de privilégio).
- *Persistir uma coluna `isPrivileged` em `roles`* — descartada por três razões somadas. Primeira: é
  estado derivado armazenado em paralelo ao que o sustenta, exatamente o que CLAUDE.md §19.7 proíbe —
  a coluna ficaria desatualizada no instante em que alguém trocasse o conjunto de permissões por
  `PATCH /admin/roles/{roleId}`. Segunda: transformaria um rótulo de tela em dado do domínio de
  autorização, e a partir daí nada impediria alguém de lê-lo numa decisão de segurança — é o risco
  que ADR-021 existe para fechar por escrito. Terceira: `spec.md` é explícita em "Nenhuma entidade
  nova. Nenhuma alteração de schema"; uma coluna nova exigiria migração, e migração dentro de uma
  onda de interface é o que §18.9 classifica como mudança que deixou de ser cosmética.
- *Derivar no servidor e devolver `isPrivileged` no `RoleResponse`* — descartada por ser a mesma
  coisa com outro endereço. `RoleResponse`
  (`apps/api/src/core/authorization/presentation/dto/role-response.mapper.ts:15-22`) é o contrato de
  autorização da plataforma; um campo ali passa a ser algo que outro consumidor pode tratar como
  verdade de segurança, e o contrato não tem como impedir. Mantida no cliente, a classificação é
  inequivocamente o que é: um rótulo, calculado a partir de dado que o próprio cliente já recebeu.

---

## R-002 — `GET /admin/roles/summary`, agregado, em vez de derivar os quatro números da listagem

**Decisão**: uma operação nova, somente leitura, exigindo `role:administer`, devolvendo
`totalRoles`, `systemRoles`, `customRoles` e `usersWithRoles` (`spec.md` FR-039). A tela **não**
calcula nenhum dos quatro a partir da página de papéis que já carregou.

**Justificativa**: três dos quatro seriam deriváveis; o quarto não é derivável sem produzir um
número errado, e misturar "três calculados aqui, um vindo de lá" produziria uma linha de indicadores
com duas proveniências e nenhuma forma de o leitor saber qual é qual.

`usersWithRoles` é "pessoas distintas com ao menos um papel". O que a API expõe hoje por papel é
`assignedUserCount` (`role-response.mapper.ts:21`), preenchido por
`apps/api/src/core/authorization/infrastructure/prisma-role.repository.ts:124-126`
(`userRole.count({ where: { roleId } })`). Somar esse campo entre papéis conta **duas vezes** quem
tem dois papéis, e o schema permite exatamente isso: a chave primária de `UserRole` é
`(userId, roleId)` (`apps/api/prisma/schema.prisma:750`), não `userId` — um usuário com três papéis
tem três linhas. A soma não é uma aproximação aceitável: é um número que cresce com a quantidade de
papéis atribuídos e é apresentado como quantidade de pessoas.

Também não é derivável pelo outro lado. `GET /admin/users` traz o total de usuários da plataforma,
incluindo quem não tem papel algum, e exige `user:administer`
(`apps/api/src/core/identity/presentation/admin-users.controller.ts:82-105`) — uma permissão que
`spec.md` FR-019 proíbe explicitamente de ser contornada. Um administrador com `role:administer` e
sem `user:administer` precisa ver o indicador; portanto o número tem de nascer atrás de
`role:administer`, agregado, sem expor pessoa alguma.

Uma operação agregada também é a opção que **não agrava** A7-F07: `/admin/roles` já faz 17 consultas
por carregamento, uma por linha, por causa do `countAssignedUsers` acima. Uma requisição a mais,
constante em relação à quantidade de papéis, respeita `spec.md` NFR-006 e SC-007; quatro contagens
derivadas de uma página já carregada economizariam essa requisição, mas ao preço de um número
errado.

**Restrição de implementação registrada aqui porque é fácil de descobrir tarde**: em NestJS a rota
estática precisa ser declarada **antes** da paramétrica. `AdminRolesController` declara
`@Get(':roleId')` em `apps/api/src/core/authorization/presentation/admin-roles.controller.ts:87`;
`@Get('summary')` declarado depois dessa linha seria capturado por ela, e `ParseUUIDPipe` (mesma
linha :88) devolveria `400` para `/admin/roles/summary` — uma falha que parece erro de cliente e não
é.

**Alternativas descartadas**:

- *Derivar os quatro da listagem, somando `assignedUserCount`* — produz o número errado descrito
  acima. Rejeitada por ser mentira barata: nenhuma economia de requisição justifica um indicador
  institucional incorreto numa tela de controle de acesso.
- *Derivar três e omitir "Usuários com papéis"* — rejeitada porque o quarto indicador é justamente o
  que responde "quantas pessoas este ambiente de controle alcança"; sem ele a linha vira três
  recortes do mesmo número (total = sistema + personalizados).
- *Quatro endpoints de contagem* — rejeitada por multiplicar superfície de contrato e requisições
  para responder a uma única pergunta de tela, contra `spec.md` NFR-006.
- *`GET /admin/users?pageSize=1` só para ler `meta.total`* — rejeitada duas vezes: exige
  `user:administer` (FR-019) e mede a população errada (todos os usuários, não os que têm papel).

---

## R-003 — Lista em cartões, revertendo a decisão medida de 012 §2.1

**Decisão**: a lista de papéis passa a ser apresentada em cartões, não em `DataTable`. Isso reverte
`specs/012-admin-roles-screen/STATE.md` §2.1, que decidiu, no mesmo dia e sobre a mesma tela, manter
`DataTable` "o mesmo de todas as telas de registro e administração". A reversão é registrada aqui,
como divergência explícita, conforme CLAUDE.md §18.12.

**Justificativa**: o pedido é do usuário, e essa é a razão primária — mas um pedido do usuário não
dispensa a justificativa técnica da divergência, e ela existe. O que 012 mediu foi uma linha de
tabela com quatro colunas (`STATE.md` §2.1: Papel, Permissões, Usuários, ações), com nome, tipo e
finalidade comprimidos na primeira. O conteúdo que esta fase precisa apresentar por papel é maior:
tipo, classificação de privilégio (R-001), descrição em duas linhas, os módulos alcançados na ordem
por concentração (012 §2.3, mantida) e duas contagens — cinco dimensões, das quais uma é uma lista
de chips de tamanho variável. Chips de largura variável dentro de célula de tabela produzem
exatamente o transbordo horizontal que F-66 registra e que `spec.md` NFR-005 proíbe a 390 px.

A divergência é **contida e nomeada**: `DataTable` permanece o padrão dos registros de negócio, e
esta tela não deixa de ser membro do Design System — ela reusa `SummaryStatCard`
(`packages/design-system/src/components/summary-stat-card.tsx:7,58`), `SortSelect`
(`apps/web/src/components/register/sort-select.tsx`), `RoleTypeTag` e o idioma de filtro já
existente. O que muda é o componente da lista, não a linguagem visual — que é o que §18.12 proíbe
inventar por módulo. O registro escrito da divergência é o que §18.12 exige; o que ela proíbe é a
divergência **sem** justificativa registrada.

Vale notar que `DataTable` já convive com apresentação em cartões neste produto: os registros de
negócio têm `ViewToggle` entre Cartões e Tabela, e o padrão de cartão é compartilhado. Esta tela
adota a forma de cartão sem o alternador, porque um inventário de 12 itens de tamanho fixo não tem a
pergunta que o alternador responde.

**Alternativas descartadas**:

- *Manter `DataTable` e contrariar o pedido* — rejeitada: o pedido é explícito, e a justificativa
  técnica acima corre no mesmo sentido. Contrariá-lo exigiria uma razão arquitetural, e não há —
  nada em §18 obriga um componente específico de lista; §18.12 obriga a **não inventar linguagem
  própria**, que é outra coisa.
- *Adicionar `ViewToggle` (cartões + tabela) e não reverter nada* — rejeitada por custo sem
  benefício: duplicaria a superfície a manter e a testar para 12 linhas, e traria junto a causa 1 de
  F-66 (a barra de resultados com ordenação + `ViewToggle` transbordando a 390 px, hoje duplicada em
  seis arquivos), que `spec.md` NFR-005 manda não herdar.
- *Reverter em silêncio, sem registrar a divergência* — rejeitada categoricamente. `spec.md` abre
  dizendo por quê: reverter uma decisão medida sem dizer por quê é como nasce um registro
  "concluído" falso (`specs/005-audit-findings/STATE.md` §3). As três decisões de 012 que continuam
  valendo (§2.2 e as duas de §2.3) estão nomeadas na tabela de abertura de `spec.md` exatamente para
  que a reversão não contamine o que não foi revertido.

---

## R-004 — A casca do painel nasce no design system, sem importar `RiskQuickView`

**Decisão**: a estrutura do painel de detalhe (região rotulada, cabeçalho fixo, corpo com rolagem
própria, rodapé de ações, comportamento não-modal em `xl` e overlay abaixo disso) entra como
componente estrutural em `packages/design-system`, sem nenhuma string própria (D-10, `spec.md`
NFR-002). O domínio de Administração **não** importa nada chamado `Risk*`. Migrar os dois quick
views existentes para a casca nova fica fora do escopo.

**Justificativa**: o padrão a reaproveitar é estrutura, não componente. `RiskQuickView` é um
`<aside>` com rótulo de região e altura dirigida pelo conteúdo
(`apps/web/src/features/risks/components/risk-quick-view.tsx:173-332`), carregado de decisões
específicas de Risco — resumo instantâneo a partir da linha do registro, remontagem por `riskId`,
histórico buscado sob demanda na primeira abertura. Importá-lo em Administração significaria trazer
todo o domínio de Risco junto, além de violar a fronteira de módulo que o projeto aplica por lint em
outras camadas.

Existe evidência de que a casca merece existir: os **dois** quick views de hoje já divergiram na
estrutura. `RiskQuickView` usa `<aside>` (`:173`); `ControlQuickView` usa `<section>`
(`apps/web/src/features/controls/components/control-quick-view.tsx:80-81`). Dois padrões para o
mesmo papel visual é o começo da divergência que §18.12 chama de defeito. A casca compartilhada é a
resposta certa — mas o momento de criá-la é agora, **com um consumidor real**, não antes.

A não-migração é deliberada e está registrada em `spec.md` ("Fora de escopo"). Ela respeita
CLAUDE.md §19.10 pelos dois lados: a casca **não** nasce como ponto de extensão sem chamador (ela
nasce exercitada pela tela desta fase, que é o único jeito de ela contar como capacidade), e a
migração dos dois consumidores existentes não é feita às cegas dentro de uma onda de interface que
não os mediu. Migrá-los agora exigiria re-verificar em navegador dois fluxos que esta fase não vai
renderizar, e §18.1 diz que mudança visual só está concluída depois de inspecionada na aplicação
renderizada.

**Alternativas descartadas**:

- *Importar `RiskQuickView` diretamente em Administração* — rejeitada por acoplar Administração ao
  domínio de Riscos, e por herdar comportamento que esta tela não quer (remontagem por id de risco,
  busca de histórico, "Abrir risco" como única saída).
- *Copiar `RiskQuickView` para `features/admin` e adaptar* — rejeitada por produzir a terceira cópia
  quase idêntica do mesmo padrão. É o defeito que `specs/010-action-plan-surface/STATE.md` §7 já
  registra em aberto para o painel de ações por origem, "hoje em três cópias quase idênticas";
  repeti-lo conscientemente seria escolher o problema conhecido.
- *Criar a casca e migrar os dois quick views na mesma fase* — rejeitada por escopo: são dois fluxos
  a mais para renderizar, inspecionar e verificar (§18.1, §18.11), em duas telas que esta fase não
  toca por nenhuma outra razão. Fica registrado como trabalho seguinte, com a causa já medida acima
  (`<aside>` contra `<section>`).

---

## R-005 — `sheet.tsx` recebe `useDialogFocusRestore` **antes** de ganhar o primeiro consumidor

**Decisão**: portar a restauração de foco de `dialog.tsx` para `sheet.tsx` é pré-requisito
sequencial desta fase, com teste próprio, feito antes de qualquer consumidor de `Sheet` existir.
Isso reverte a forma como 012 §2.4 tratou o mesmo impedimento — evitar `Sheet` e usar `Dialog` —
removendo a causa em vez de conviver com ela.

**Justificativa**: o impedimento que 012 mediu é real e continua real. `dialog.tsx` compõe a
restauração de foco explicitamente (`apps/web/src/components/ui/dialog.tsx:10`, `:93`, `:105-111`),
usando o hook já extraído e compartilhado
(`packages/design-system/src/lib/use-restore-focus.ts:24`, `:78`, `:119` —
`resolveDialogRestoreTarget`, `DialogFocusRestore`, `useDialogFocusRestore`). `sheet.tsx` **não
menciona foco em lugar nenhum**: o arquivo declara `SheetContent` em
`apps/web/src/components/ui/sheet.tsx:48` e não contém uma única ocorrência de `onCloseAutoFocus`.
Com zero consumidores hoje (o `grep` por `SheetContent` no app só acha o próprio arquivo), o defeito
está latente, não visível — e é exatamente o defeito que `docs/local-environment.md:493` (D-15)
descreve como **violação séria de SC 2.4.3**, reproduzida em build de produção, quando existia em
`dialog.tsx`.

A ordem importa. Portar o hook **depois** de o primeiro consumidor existir significaria entregar,
mesmo que por um commit, uma superfície que devolve o foco a `<body>` ao fechar — e `spec.md` SC-008
proíbe regressão de foco, com as quatro correções de 012 §3 declaradas regressões proibidas. Portar
**antes**, com teste próprio, é o que torna a correção verificável isoladamente: o teste falha
contra o `sheet.tsx` de hoje e passa contra o corrigido, que é a única definição útil de teste que
protege alguma coisa (§18.8).

O custo é baixo e conhecido: o hook já é compartilhado por `ConfirmDialog`
(`packages/design-system`, 34 chamadores, conforme D-15), então o port é composição, não invenção. O
que ele exige em troca está em `spec.md` NFR-009: preservar a modificação de D-15 que `sheet.tsx` já
carrega (rótulo de fechar em pt-BR) e re-executar `e2e/accessibility.spec.ts`.

**Alternativas descartadas**:

- *Repetir 012 §2.4 e usar `Dialog` também abaixo de `xl`* — rejeitada porque `spec.md` FR-010 pede
  um painel lateral que, acima de `xl`, é **não-modal** com a lista operável ao lado; um `Dialog` é
  modal por construção. Usar `Dialog` obrigaria dois componentes diferentes para o mesmo painel em
  duas faixas de viewport, com duas implementações de foco a manter.
- *Usar `Sheet` como está, sem o hook* — rejeitada: entrega uma violação conhecida de SC 2.4.3 numa
  fase cujo critério de sucesso SC-008 é justamente não ter regressão de foco.
- *Duplicar a lógica de foco dentro do componente da tela* — rejeitada por colocar em um consumidor
  a correção que pertence ao primitivo. `dialog.tsx` já provou o contrário: uma correção no
  primitivo cobriu, de uma vez, todos os diálogos da aplicação (D-15). Duplicar significaria que o
  segundo consumidor de `Sheet`, um dia, nasceria quebrado de novo.

---

## R-006 — Disclosure por módulo com `aria-expanded`/`aria-controls` manuais, sem dependência nova

**Decisão**: os grupos de permissão por módulo expandem e recolhem com o idioma de disclosure que o
projeto já usa — botão nativo com `aria-expanded` e `aria-controls` apontando para o painel. Nenhum
Accordion, nenhum Collapsible, nenhuma dependência nova.

**Justificativa**: o idioma já existe, está em produção e é do Design System.
`packages/design-system/src/components/data-table/filter-bar.tsx:196-219` é o padrão literal: um
`<button type="button">` com `aria-expanded={filtersOpen}`, `aria-controls={panelId}`, ícone marcado
`aria-hidden`, contador do estado ativo e chevron que gira — tudo em elemento interativo nativo, que
é o que `spec.md` FR-002 exige em outro ponto da mesma tela ("um `div` com `onClick` **não**
satisfaz este requisito"). O par de fechamento também já existe
(`packages/design-system/src/components/data-table/use-disclosure-close.ts`).

Introduzir um Accordion significaria uma dependência nova para um comportamento que o repositório já
resolve, contra CLAUDE.md §2 ("não introduzir dependências sem justificativa") e §18.4 ("estender o
Design System existente"). Também traria semântica que esta tela não quer: o padrão Accordion
costuma trazer "um aberto por vez" como default, e `spec.md` FR-014 exige poder **expandir todos de
uma vez**.

**Alternativas descartadas**:

- *Adicionar `@radix-ui/react-accordion` (ou o Accordion do shadcn sobre ele)* — rejeitada pela
  dependência injustificada acima, e porque cada primitivo novo de `apps/web/src/components/ui/` é
  mais um candidato ao problema de D-15 (um primitivo gerado que depois precisa ser modificado à mão
  por acessibilidade e não pode mais ser regenerado às cegas). Hoje são cinco; esta fase já
  acrescenta um sexto por necessidade real (R-007), e um sétimo por conveniência seria escolha ruim.
- *`<details>`/`<summary>` nativos* — rejeitada por não ser o idioma da casa (nenhuma ocorrência no
  padrão de disclosure existente) e por diferenças conhecidas de estilo e de anúncio entre
  navegadores e leitores de tela, que obrigariam a verificação de acessibilidade do zero em vez de
  reusar um padrão já verificado.
- *Deixar todos os módulos sempre expandidos, sem disclosure* — rejeitada pelo caso de borda que
  `spec.md` já nomeia: um papel com as 70 permissões em 13 áreas produziria uma parede de
  identificadores dentro de um painel, que é exatamente o que a tela existe para acabar.

---

## R-007 — `checkbox.tsx` ganha estado indeterminado e vira o sexto primitivo de D-15

**Decisão**: `apps/web/src/components/ui/checkbox.tsx` passa a representar o estado indeterminado
(`checked="indeterminate"` do Radix) com um indicador visual próprio, distinto de marcado e de
desmarcado. Com isso ele se torna o **sexto** primitivo deliberadamente modificado, e
`docs/local-environment.md` D-15 é atualizado no mesmo trabalho (`spec.md` NFR-008).

**Justificativa**: `spec.md` FR-028 exige que o estado por módulo seja distinguível entre "todas",
"parcialmente" e "nenhuma" selecionadas. O primitivo de hoje não consegue expressar o estado do
meio: `checkbox.tsx:21-26` renderiza um `Indicator` cujo único filho é `CheckIcon`, e o arquivo
inteiro (31 linhas) não contém a palavra `indeterminate`. Um seletor de módulo em estado parcial
apareceria, hoje, ou como marcado (mentira: nem todas as permissões do módulo estão selecionadas) ou
como desmarcado (mentira simétrica).

O Radix já suporta o estado — `CheckboxPrimitive.Root` aceita `checked="indeterminate"` e propaga
`data-state="indeterminate"`. O que falta é o projeto **desenhar** o estado, e é por isso que a
mudança é no primitivo e não no chamador: o mesmo estado vai reaparecer em qualquer seleção
hierárquica futura, e nove arquivos já consomem este `Checkbox` hoje
(`my-actions-filters.tsx`, `permission-checklist.tsx`, `user-roles-dialog.tsx`,
`requirement-controls-section.tsx`, `finding-links-section.tsx`,
`incident-relationships-section.tsx`, `problem-relationships-section.tsx`, `report-form.tsx`,
`risk-register-filters.tsx`). Nenhum deles passa `indeterminate` hoje, o que torna a mudança
aditiva — e é exatamente por serem nove que `spec.md` NFR-008 exige regressão verificada nos
consumidores existentes em vez de confiar na leitura do diff.

A distinção **não pode ser só de cor** (`spec.md` NFR-004): o estado parcial precisa de forma
própria — a convenção estabelecida é um traço horizontal contra a marca de seleção — e de anúncio
correto para leitor de tela, que o Radix já fornece via `aria-checked="mixed"` quando o estado é
usado.

Atualizar D-15 é parte da decisão, não consequência esquecida. D-15 existe porque
`apps/web/src/components/ui/` está fora do `.prettierignore` justamente para permanecer idêntico à
saída da CLI, e cinco arquivos já não são (`docs/local-environment.md:493` e seguintes). Um sexto
arquivo modificado sem entrar naquela lista é um arquivo que alguém regenera às cegas no futuro,
desfazendo a acessibilidade — o dano exato que D-15 foi escrita para impedir.

**Alternativas descartadas**:

- *Um componente novo `TriStateCheckbox` ao lado do primitivo* — rejeitada por criar dois seletores
  visualmente equivalentes e semanticamente diferentes na mesma aplicação, deixando aos chamadores
  futuros a escolha errada por default. O estado parcial é um estado do checkbox, não outro
  controle.
- *Representar o estado parcial só no texto do cabeçalho do módulo ("3 de 9 selecionadas")* —
  rejeitada porque deixaria o próprio seletor mentindo. O contador é bom complemento e deve existir
  (§18.8: cor nunca é o único canal, e texto é um canal excelente), mas não substitui o estado
  correto do controle que o usuário vai acionar.
- *Não oferecer seletor por módulo, só por permissão individual* — rejeitada contra `spec.md`
  FR-028, e porque um catálogo de 70 permissões sem seleção por grupo devolve ao usuário o trabalho
  que a tela existe para tirar dele.

---

## R-008 — A operação nova é emenda datada ao contrato onde as demais operações de papéis já vivem

**Decisão**: `GET /admin/roles/summary` entra em
`specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`, junto de `listRoles` (`:515`),
`createRole` (`:544`), `getRole` (`:590`), `updateRole` (`:608`) e `deleteRole` (`:651`), com um
comentário datado apontando para esta fase. **Não** se cria arquivo de contrato novo em
`specs/015-roles-permissions-surface/contracts/`.

**Justificativa**: as operações de papéis são uma superfície só, atrás de um só controlador
(`admin-roles.controller.ts:47`, `@Controller('admin/roles')`) e de uma só permissão
(`role:administer`). Dividi-la em dois arquivos obrigaria qualquer leitor futuro do contrato de
papéis a saber que existe um segundo lugar — e a saber disso sem nenhum mecanismo que o informe, já
que o primeiro arquivo não referencia o segundo. Contrato existe para ser a fonte explícita
(CLAUDE.md §2, "APIs com contratos explícitos"); uma fonte partida em dois por acidente de
cronologia é menos explícita que uma.

O custo de um arquivo novo é medível, não hipotético. `CONTRACT_SOURCES`
(`apps/api/test/contract/contract-coverage.spec.ts:229-234`) já lista `admin.openapi.yaml` em
`:230`; um arquivo novo exigiria uma constante de diretório nova e uma entrada nova nessa lista — e
o cabeçalho desse mesmo arquivo documenta que **esquecer essa entrada já aconteceu três vezes**,
deixando operações contratadas fora de `apps/api/openapi.json` por fases inteiras com o portão
verde. Não criar o arquivo é não criar a chance de repetir o defeito. Emendar `admin.openapi.yaml`
mantém a cobertura automática: o arquivo já é varrido, e a operação nova entra na contagem no mesmo
passo (`spec.md` FR-043).

Sobre essa contagem: a asserção de sanidade do portão está em
`contract-coverage.spec.ts:384` (`expect(contracted.length).toBe(213)`), e o cabeçalho do arquivo
registra a disciplina em letras claras — cada total foi **lido de uma execução que falhou**, nunca
calculado à mão ("`211 + 1` reasoned by hand" é nomeado ali como o que não se faz). A operação desta
fase move o número para o próximo valor **lido dessa forma**, não somado neste documento.

A forma da emenda — um comentário datado, no arquivo que já existe, apontando para a fase que a
introduziu — tem precedente direto e recente nesta casa: `specs/010-action-plan-surface` emendou
R-009 de `specs/002-shared-grc-foundation/research.md` com uma seção datada
(`specs/002-shared-grc-foundation/research.md:192`, "R-009 — emenda de 2026-09-12"), preservando o
texto original em vez de reescrevê-lo, e registrando o que muda e o que continua valendo. É o mesmo
princípio: o documento anterior não estava errado sobre o que cobria; ele só não cobria isto.

**Alternativas descartadas**:

- *Criar `specs/015-roles-permissions-surface/contracts/roles-summary.openapi.yaml`* — rejeitada
  pelas duas razões acima: parte uma superfície de API em dois arquivos e obriga a mexer em
  `CONTRACT_SOURCES`, que é o ponto onde esta casa já falhou três vezes.
- *Não contratar a operação e implementá-la só no controlador* — rejeitada frontalmente por
  `spec.md` FR-043 e pelo portão F-31: uma operação implementada e não contratada (ou contratada e
  não implementada) é precisamente o que `contract-coverage.spec.ts` existe para pegar.
- *Copiar as operações de papéis de `admin.openapi.yaml` para um contrato novo de 015 e deprecar o
  trecho antigo* — rejeitada por ser migração de contrato disfarçada de adição, dentro de uma fase
  de interface. Mudaria a superfície de quatro operações estáveis sem nenhuma necessidade, contra
  CLAUDE.md §14 ("evitar alterações não relacionadas", "não modificar contratos sem avaliação").

---

## R-009 — Busca, filtro e ordenação acontecem no cliente nesta fase

**Decisão**: busca por nome/descrição, filtro por tipo, filtro por módulo e ordenação operam sobre o
conjunto que a tela já carregou de `GET /admin/roles`. **Nenhum parâmetro novo de consulta é
introduzido** (`spec.md` FR-005c).

**Justificativa**: o contrato não oferece os parâmetros, e o servidor não os implementa.
`ListRolesQueryDto`
(`apps/api/src/core/authorization/presentation/dto/list-roles-query.dto.ts:14-27`) tem exatamente
dois campos — `page` e `pageSize` — sem `q`, sem `sort`, sem `direction`. A descrição da operação no
contrato diz a mesma coisa em prosa
(`specs/001-grc-platform-foundation/contracts/admin.openapi.yaml:518`: "Roles are a bounded set; the
page size cap still applies"), e seus únicos parâmetros são `Page` e `PageSize` (`:519-521`). O
contraste com a listagem de usuários é informativo: lá os parâmetros existem de fato
(`admin-users.controller.ts:86-93` repassa `q`, `status`, `orgUnitId`, `roleId`, `sort`,
`direction`), porque aquela coleção é grande por natureza. Papéis não são.

O conjunto cabe numa página por construção. `pageSize` aceita até 100
(`list-roles-query.dto.ts:25`, `@Max(100)`) e a plataforma tem 12 papéis semeados. Filtrar 12 itens
já em memória é instantâneo e não custa requisição nenhuma — o que atende diretamente `spec.md`
NFR-006 e SC-007 (número de requisições constante em relação à quantidade de papéis) e não agrava
F-59/F-61, o limitador global que já recusou requisições em tela por concorrência.

O filtro por módulo, aliás, **só** pode ser cliente hoje: ele seleciona uma área de
`PermissionArea`, e essa taxonomia não existe no servidor. `PermissionDefinition` tem quatro campos
e nenhum é área ou módulo (`permissions.ts:103-108`; espelhado em `role-response.mapper.ts:8-13`); o
mapa de áreas vive inteiramente no cliente
(`apps/web/src/features/admin/components/roles/permission-grouping.ts:45-60` para a ordem das 14
áreas e `:63-84` para o mapa recurso→área), com rótulos em
`apps/web/src/lib/messages/admin.ts:198-213`. Um filtro de módulo no servidor exigiria levar a
taxonomia para lá primeiro — mudança de modelo, não de tela, e fora do escopo declarado.

Registrado o limite honestamente: se a quantidade de papéis um dia ultrapassar uma página, busca e
ordenação passarão a operar apenas sobre a página corrente. `spec.md` já nomeia esse caso de borda
("Mais de 100 papéis: a lista permanece paginada pelo contrato existente"), e a tela precisa dizer
sobre quantos itens o resultado incide — que é o que o indicador de resultados de FR-005 faz. O dia
em que isso deixar de bastar, a resposta certa é acrescentar `q`/`sort` ao contrato de
`listRoles`, com especificação própria, e não fazê-lo agora em antecipação a um volume que não
existe (CLAUDE.md §2, "não criar abstrações prematuras").

**Alternativas descartadas**:

- *Acrescentar `q` e `sort` a `GET /admin/roles` nesta fase* — rejeitada por ser mudança de contrato
  e de servidor movida por uma necessidade de tela que 12 registros não criam. Traria, sem ganho,
  índice, validação, testes de contrato e a superfície permanente de dois parâmetros novos.
- *Buscar todos os papéis com `pageSize=100` e chamar isso de "sem paginação"* — rejeitada pela
  forma, não pelo efeito: o efeito é o mesmo que já se obtém, mas a frase esconde que existe um
  limite. A tela usa a paginação do contrato como ela é, e trata o caso de borda explicitamente.
- *Filtrar por módulo no servidor* — impossível hoje sem levar `PermissionArea` para o servidor, que
  é mudança de modelo (§18.9: deixa de ser cosmética) e está fora do escopo desta fase.
