# 012 — Administração → Papéis e permissões: registro operacional

> **Documento histórico — registro de fechamento da fase 012 (refinamento visual de Admin →
> Papéis).** Não descreve necessariamente o estado atual do produto — esta tela foi
> substancialmente reconstruída pela fase 015 (`specs/015-roles-permissions-surface/`, em evolução
> em 2026-09-14), que reverteu algumas decisões daqui a pedido explícito do usuário (ver o §1 do
> `STATE.md` de 015). Fonte vigente: [`docs/STATE.md`](../../docs/STATE.md) e
> [`docs/modules/platform.md`](../../docs/modules/platform.md).

Escopo pedido: refinamento visual e de UX **somente** da tela `/admin/roles` e dos componentes
compartilhados estritamente necessários para ela, preservando regras de negócio, RBAC, escopo
organizacional, contratos de API, banco e catálogo de permissões. A tela pertence à especificação
`specs/001-grc-platform-foundation/` (T182, FR-022, FR-023); este registro segue o formato de
`specs/011-dashboard-platform-view/STATE.md`. **Nenhuma outra tela foi revisada.**

Linha de base: commit `352c534`. Capturas de antes em `docs/reviews/ui/admin-roles-baseline/`
(1920, 1600, 1440, 1366, 1280 e 1024 px, claro e escuro); de depois em
`docs/reviews/ui/admin-roles-after/` (mesmas larguras) e `docs/reviews/ui/admin-roles-after/states/`
(detalhes, menus, edição de papel do sistema, estado vazio, 768 e 390 px). As capturas de depois
incluem dois papéis personalizados temporários criados para a validação (§4) e uma sobra de uma
execução E2E interrompida — os três foram excluídos em seguida.

---

## §1 — O que a tela real mostrava antes

Medido na aplicação renderizada, com os 12 papéis semeados:

1. **Uma tabela-despejo do modelo.** Cinco colunas — nome, descrição completa, identificadores
   técnicos, usuários, menu — com as descrições inteiras na linha. A 1024 px a página tinha
   2860 px de altura; a linha do Problem Manager ocupava 13 linhas de texto.
2. **O selo "Papel do sistema" era o elemento mais alto da tela**: azul-informação, quebrado em duas
   linhas sob cada nome, repetido em todas as 12 linhas.
3. **Os três identificadores exibidos por linha eram arbitrários** — os três primeiros do catálogo.
   O Platform Administrator aparecia como `risk:view risk:create risk:edit +67`.
4. **Controles que não faziam nada**: botões de ordenação em quatro cabeçalhos
   (`onSortingChange={() => undefined}`) e um seletor "Linhas por página" sobre uma lista buscada
   inteira numa página só.
5. **Sem estado vazio**: as mensagens `admin.roles.empty` existiam no catálogo e não eram usadas.

Encontrado durante o trabalho, fora do que o pedido descrevia (§3).

---

## §2 — Decisões

### §2.1 A tabela vira um índice de papéis

Quatro colunas, na ordem em que o leitor procura: **Papel** (nome, tipo e finalidade juntos — eles
identificam uma coisa só), **Permissões**, **Usuários**, ações. A descrição fica em duas linhas
(`line-clamp-2`, largura máxima de 72ch); o texto continua inteiro no DOM, lido por completo por
leitor de tela, e aparece inteiro no diálogo de detalhes. **O texto das descrições não foi
alterado.** `DataTable` continua sendo o componente — o mesmo de todas as telas de registro e
administração.

Uma linha de inventário acima da tabela: "12 papéis · 12 do sistema · 0 personalizados".

### §2.2 Tipo do papel: etiqueta neutra, texto nos dois casos

`RoleTypeTag`: contorno neutro, texto pequeno, ao lado do nome. "Sistema" com cadeado,
"Personalizado" sem. Os dois tipos são escritos — nunca distinguidos pela ausência de etiqueta — e
o cadeado dá um segundo canal além do texto (CLAUDE.md §18.8). `StatusBadge` foi descartado: tom
de status é para condição, não para propriedade.

### §2.3 Permissões em vocabulário de produto, identificador sempre visível

Na linha: contagem ("17 permissões") e as **áreas da plataforma** alcançadas, ordenadas por
quantas permissões o papel concentra em cada uma, com o restante em "+N". A ordem por concentração
substituiu a ordem de produto depois da primeira captura: com ela, quase toda linha começava por
"Riscos · Planos de Ação" (quase todo papel tem um `:view` ali), e o Audit Lead parecia um papel de
risco. Leitor de tela recebe a lista completa ("Áreas: …").

Áreas (14) seguem o menu lateral; cada recurso do catálogo pertence a uma
(`permission-grouping.ts`). Recurso desconhecido cai em "Outras permissões" com o identificador
cru — nada do catálogo fica escondido quando ele crescer.

Rótulos em pt-BR ficam em `admin.roles.permissionCatalog` (áreas, recursos, verbos). O verbo vem do
**próprio identificador**, não do campo `action`: `control:test` tem `action = ASSESS`,
`audit-engagement:scope` e `compliance:map` têm `LINK`, `finding:remediate` tem `TRANSITION`. O
rótulo por `action` teria mostrado "Vincular" para "definir escopo". **O catálogo não foi tocado.**

### §2.4 Detalhes num `Dialog`, não num `Sheet`

`RoleDetailsDialog`, somente leitura, sem requisição nova (renderiza o `Role` que a lista já tem):
nome e tipo, descrição completa, três números (usuários, permissões, áreas), a restrição que vale
para o papel (sistema: não renomeia, não altera permissões, não exclui; personalizado com usuários:
não exclui), e todas as permissões por área → recurso, cada uma com verbo em pt-BR, descrição do
catálogo e identificador técnico.

`Sheet` existe em `components/ui/` mas nunca foi usado, e **não** tem a correção de restauração de
foco de `dialog.tsx` (D-15). O produto já tem um diálogo de leitura desta forma (execução de
relatório). Abre pelo nome do papel e por "Ver detalhes" no menu.

### §2.5 Menu da linha: nada novo permitido, restrição explicada

"Ver detalhes" para todos; "Editar" e "Excluir" continuam só com `role:administer`; "Excluir"
continua desabilitado exatamente nos mesmos dois casos (papel do sistema; papel atribuído), agora
com o motivo escrito sob o item.

### §2.6 `DataTable.hidePagination`

Prop opcional no Design System que omite o rodapé de paginação. A tela só a liga quando a página
única contém todos os papéis; se o conjunto passar de 100, o rodapé volta e informa "1–100 de N".
Nenhum outro chamador muda.

### §2.7 Criar/editar usam o mesmo agrupamento

`PermissionChecklist` passou a agrupar por área, com verbo em pt-BR ao lado do identificador, e a
busca aceita também os nomes em pt-BR ("risco", "vincular"). `RolePermissionsSummary`, usado pela
tela de Usuários, **não foi alterado**.

### §2.8 Larguras

`@container/roles` no invólucro da tabela: a coluna de permissões mostra duas áreas quando a
tabela tem ≥ 56rem e uma abaixo disso, sempre com nomes inteiros (a primeira versão truncava
"Planos de Aç…"). Sem rolagem horizontal da página em 1920–768 px; a 390 px a tabela rola dentro do
próprio contêiner com a sombra de borda do `DataTable`, o comportamento de todas as tabelas do
produto.

---

## §3 — Defeitos encontrados e corrigidos além do pedido

Todos medidos na aplicação renderizada ou no código antes da correção.

1. **Todo salvamento de papel do sistema falhava com 422.** `RoleEditDialog` enviava sempre
   `permissionIdentifiers`, e `RoleAdminService.update` recusa qualquer requisição de papel do
   sistema que traga nome ou permissões, mesmo iguais. A própria nota do diálogo dizia que a
   descrição podia ser ajustada. Agora o diálogo envia só `{ description }` para papel do sistema e
   desabilita a lista de permissões. **Mudança funcional no cliente, alinhando-o à regra que o
   servidor já aplicava** — nenhuma regra mudou. A nota também dizia "renomeados nem ter o nome
   alterado"; passou a dizer "renomeados nem ter as permissões alteradas".
2. **O diálogo de edição de papel do sistema não cabia em 1280×720** (encontrado pelo agente de
   E2E): 888,6 px de diálogo, "Salvar alterações" abaixo da janela, rolagem da página travada e
   nada rolando dentro. Criar e editar receberam `max-h-[90vh] overflow-y-auto`, como os demais
   formulários longos do produto.
3. **Fechar qualquer diálogo da tela mandava o foco para `<body>`.** `buildRoleAdminColumns` era
   reconstruído a cada render; `flexRender` monta cada `cell` como componente, então toda a tabela
   remontava, e o botão que abriu o diálogo deixava de existir para a restauração de foco. Corrigido
   com `useMemo`.
4. **Pelo menu, o foco caía em `<body>` mesmo depois do item 3.** O diálogo, aberto direto do
   `onSelect`, registrava o item de menu — ainda no DOM durante a animação de saída — como destino
   do foco. `RoleRowActions` passou a abrir o diálogo só em `onCloseAutoFocus`, depois de o menu
   devolver o foco ao gatilho. Medido: detalhes e edição voltam ao gatilho do menu.

**Não corrigido, registrado**: F-62 (`ConfirmDialog` do Design System não restaura foco — a
exclusão desta tela cai em `<body>` ao cancelar; 33 chamadores fora do escopo) e F-63 (descrições
de permissão em inglês e descrições de papéis semeados com referências internas de especificação).

---

## §4 — Verificação renderizada

Servidores de desenvolvimento, banco de desenvolvimento, dados reais. Para cobrir papéis
personalizados (o banco só tinha papéis do sistema), dois foram criados pela API e excluídos ao
final: um com descrição curta e 2 permissões, outro com nome longo, descrição longa e 45
permissões em 9 áreas.

| Cenário | Resultado observado |
|---|---|
| Claro e escuro, 1920/1600/1440/1366/1280/1024 px | linhas de altura uniforme (~89 px), sem rolagem horizontal da página; a 1024 px a página caiu de 2860 para ~1630 px com três papéis a mais |
| Papel do sistema × personalizado | etiquetas distinguíveis por texto e cadeado nos dois temas |
| Descrição curta × longa; nome longo | curta em uma linha; longa cortada em duas; nome longo quebra e empurra a etiqueta para a linha seguinte |
| 2 × 70 permissões | "Riscos · Planos de Ação" × "Auditoria e achados · Riscos +11" |
| Detalhes do Platform Administrator | 70 permissões em 13 áreas, rolagem interna, cabeçalho e rodapé fixos |
| Menu de papel do sistema × personalizado sem usuários | "Excluir" desabilitado com "Papel do sistema" × habilitado |
| Edição de papel do sistema | nome e permissões desabilitados, nota correta, botão alcançável |
| Lista vazia (resposta interceptada) | `EmptyState` "Nenhum papel encontrado" |
| 768 e 390 px | 768 sem rolagem; 390 com rolagem contida na tabela |
| Detector do Impeccable sobre os arquivos de interface alterados | nenhum achado |

---

## §5 — Medição

Em série. Nenhum `skip` acrescentado, nenhuma asserção enfraquecida.

| Suíte | Linha de base (`352c534`) | Depois |
| --- | --- | --- |
| Unidade da web | 131 arquivos / 746 testes | 138 / 803 |
| E2E `admin-roles.spec.ts` (novo) | — | 6 / 6, 0 skipped |
| E2E `accessibility.spec.ts`, filtro "admin role" (novos) | — | 5 / 5, 0 skipped, 0 violações axe |
| E2E `admin-access.spec.ts` (tela vizinha) | — | 1 / 1 |

Typecheck (web e Design System), lint, `format:check` limpos.

**Não-vacuidade**, verificada revertendo cada correção e rodando o teste que a protege:

- sem o `useMemo`: o teste de foco de `role-admin-view.test.tsx` falha (1 de 6); restaurado, 6/6;
- enviando `permissionIdentifiers` para papel do sistema: o teste de payload de
  `role-edit-dialog.test.tsx` falha (1 de 4); restaurado, 4/4;
- sem `max-h`/`overflow` no diálogo de edição: o E2E falha em `toBeInViewport` a 1280×720;
- abrindo detalhes direto do `onSelect`: o E2E de foco pelo menu falha 2 de 2 vezes. A primeira
  versão desse teste fechava com `Escape` e **passava sem a correção** — o caminho medido era o
  botão "Fechar"; o teste foi reescrito sobre ele.
- limpeza do E2E: uma falha forçada logo após criar o papel não deixou papel sobrando — a primeira
  versão do spec deixou um, visto numa captura.

O E2E de salvamento de papel do sistema grava a mesma descrição de volta: gera um evento de
auditoria de atualização sem mudança de valor por execução.

---

## §6 — O que ficou aberto, e por quê

- **F-62** e **F-63** (`docs/deferred-findings.md`).
- **Nenhuma navegação para os usuários de um papel.** A tela de Usuários não filtra por papel; a
  contagem ficou como número, sem link inventado.
- **Celular**: a 390 px a tabela rola dentro do contêiner. Reorganizar em cartões seria uma segunda
  linguagem de tabela só para esta tela (§18.12); fica para uma decisão do Design System, se vier.
- **Dois botões chamados "Fechar"** no diálogo de detalhes (o X do primitivo e o do rodapé), como
  nos demais diálogos do produto.
