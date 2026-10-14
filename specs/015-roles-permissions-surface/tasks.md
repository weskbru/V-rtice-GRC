# Tarefas — Superfície de Papéis e Permissões

**Feature**: `015-roles-permissions-surface`
**Plano**: `plan.md` · **Especificação**: `spec.md` · **Pesquisa e ADR**: `research.md`

Convenções: `[A]`..`[E]` identificam o agente dono. Tarefas de ondas diferentes **não** correm em
paralelo quando há dependência declarada. Nenhum arquivo aparece sob dois donos.

---

## Onda 0 — Pré-requisitos compartilhados · Sonnet-A

> Roda antes de qualquer consumidor. Paralela apenas à Onda 1.

- **T001 [A]** `sheet.tsx`: importar `useDialogFocusRestore`, montar `FocusRestoreAnchor` como
  primeiro filho de `SheetContent`, compor `onCloseAutoFocus` na ordem de `dialog.tsx:105-108`.
  Preservar o label pt-BR de fechar (D-15 existente).
- **T002 [A]** Teste de `sheet.tsx` em `apps/web/src/components/ui/` ou no arquivo de primitivos:
  foco volta ao gatilho ao fechar por `Esc`, pelo X e por botão de cancelar. **Não-vacuidade**:
  removendo a âncora, o teste falha.
- **T003 [A]** `checkbox.tsx`: ramo `checked === 'indeterminate'` com glifo distinto do
  `CheckIcon`; confirmar `aria-checked="mixed"`.
- **T004 [A]** Localizar por `grep` **todos** os chamadores de `Checkbox` e provar por teste que
  nenhum mudou de comportamento. Listar os chamadores no relatório de entrega.
- **T005 [A]** `DetailPanel` em `packages/design-system/src/components/detail-panel.tsx`: cabeçalho
  fixo, corpo rolável, rodapé fixo; modo não-modal em `xl`+ e overlay abaixo. **Zero string
  própria** — todo texto por prop obrigatória (D-10). Não conhece papéis.
- **T006 [A]** `DisclosureGroup` em `packages/design-system/src/components/disclosure-group.tsx`:
  `aria-expanded`/`aria-controls` manuais, no idioma de `filter-bar.tsx:196-219`. Zero string
  própria. Nenhuma dependência nova.
- **T007 [A]** Exportar os dois em `packages/design-system/src/components/index.ts`.
- **T008 [A]** Testes dos dois em `apps/web/src/components/design-system.test.tsx` (D-9 — não criar
  runner no pacote).
- **T009 [A]** Atualizar D-15 em `docs/local-environment.md`: `checkbox.tsx` vira o **sexto**
  primitivo deliberadamente modificado; a entrada de `sheet.tsx` ganha a modificação de foco.
- **T010 [A]** Re-executar `e2e/accessibility.spec.ts` (NFR-009) e reportar o número real.

**Portão da onda**: typecheck (web + design system), lint, `format:check`, unidade da web, e o
número de `accessibility.spec.ts`. Só então a Onda 3 é liberada.

---

## Onda 1 — Backend · Sonnet-B

> Paralela à Onda 0. Zero sobreposição de arquivo.

- **T011 [B]** Caso de uso de resumo de papéis em `apps/api/src/core/authorization/application/`,
  devolvendo os quatro campos do formato congelado (`plan.md` §4).
- **T012 [B]** Método de repositório: agregação sobre `roles` para os três primeiros;
  **`COUNT(DISTINCT user_id)`** sobre `user_roles` para `usersWithRoles`. Nenhuma consulta por
  linha.
- **T013 [B]** DTO de resposta + mapper, no estilo de `role-response.mapper.ts`.
- **T014 [B]** Rota `GET /admin/roles/summary` em `admin-roles.controller.ts`, com
  `@RequirePermission('role:administer')`. **Atenção de roteamento**: declarar antes de
  `GET /admin/roles/:roleId`, ou `summary` será capturado como `roleId` e falhará na validação de
  UUID.
- **T015 [B]** Teste de unidade do caso de uso: os quatro campos; invariante
  `totalRoles = systemRoles + customRoles`.
- **T016 [B]** Teste de integração: **pessoa com dois papéis conta uma vez** em `usersWithRoles`
  (SC-004); zero papéis atribuídos ⇒ `usersWithRoles = 0`.
- **T017 [B]** Teste de integração de autorização: com `role:administer` ⇒ 200; sem ⇒ 403; sem
  sessão ⇒ 401.
- **T018 [B]** Emenda datada em `specs/001-grc-platform-foundation/contracts/admin.openapi.yaml`,
  junto das demais operações de papéis, apontando para esta fase (R-008).
- **T019 [B]** Regenerar `apps/api/openapi.json` pelo comando do projeto; `openapi:check` limpo.
- **T020 [B]** Ajustar a contagem fixa de `contract-coverage.spec.ts`. O número novo é **lido da
  execução que falha** — nunca somado de cabeça.
- **T021 [B]** Teste que registra a ausência de herança (cenário 9 de `plan.md` §3): a permissão
  efetiva de um usuário com dois papéis é a **união plana** dos dois conjuntos, sem expansão
  transitiva.

**Proibido**: alterar `Role`, criar tabela ou migration, tocar escopo/auditoria/resolução de
permissões, criar rota de usuários protegida só por `role:administer`.

---

## Onda 2 — Contrato de cliente e catálogo pt-BR · Sonnet-C

> Usa o formato congelado de `plan.md` §4; não espera o código da Onda 1.

- **T022 [C]** Tipo `RolesSummary` em `apps/web/src/features/admin/types.ts`.
- **T023 [C]** `adminApi.getRolesSummary()` em `apps/web/src/features/admin/api.ts`.
- **T024 [C]** `isPrivilegedRole` em
  `apps/web/src/features/admin/components/roles/role-privilege.ts` — função pura, sem I/O.
- **T025 [C]** Teste de `isPrivilegedRole`: `role:administer` ⇒ verdadeiro; `user:administer` ⇒
  verdadeiro; `org_unit:administer` ⇒ verdadeiro; **`risk:administer` sozinho ⇒ falso**; papel sem
  permissões ⇒ falso. Este teste é a guarda de FR-035/FR-036.
- **T026 [C]** Todas as strings pt-BR da fase em `apps/web/src/lib/messages/admin.ts`, sob
  `admin.roles.*`: quatro indicadores (rótulo, legenda, nome acessível do controle de filtro),
  filtros, cartão, painel, abas, o bloco de FR-015 que explica o modelo de autorização, o estado
  degradado de FR-020, resumo de alterações pendentes, razões de campo travado, e os estados vazio
  e de erro. Após esta tarefa, **ninguém mais edita este arquivo nesta fase**.
- **T027 [C]** Reusar `permissionCatalog.{areas,resources,verbs}` sem criar segunda taxonomia
  (FR-013). Se faltar rótulo para algum recurso, acrescentar ao mapa existente — nunca um mapa
  novo.

---

## Onda 3 — A tela · Sonnet-D · SEQUENCIAL

> Só começa com 0, 1 e 2 mescladas e verdes.

- **T028 [D]** `RoleAdminSummary`: quatro `SummaryStatCard` no grid `grid-cols-2 gap-3
  xl:grid-cols-4`, alimentados por `getRolesSummary()`. Falha degrada para linha discreta, **nunca**
  esconde a lista (FR — caso de borda).
- **T029 [D]** Os três primeiros indicadores como **controles interativos nativos** que aplicam o
  filtro de tipo (FR-002): teclado, `focus-visible`, estado selecionado perceptível por mais que
  cor. `div` com `onClick` é reprovado. O quarto não navega nem filtra (FR-003).
- **T030 [D]** Barra de busca e filtros sobre `FilterBar`: busca por nome ou descrição, tipo
  (Todos/Sistema/Personalizados), módulo e ordenação. **Não** reusar o agrupamento `flex
  items-center gap-3` da barra de resultados — causa 1 de F-66 (NFR-005).
- **T031 [D]** Estado de busca/filtro/ordenação na query string pelo padrão dos hooks de catálogo,
  com `eslint-disable` explicando que escrita de filtro não é navegação (NFR-007).
- **T032 [D]** Cartão de papel: nome, `RoleTypeTag` existente, badge de privilégio, descrição em
  `line-clamp-2`, chips de módulo ordenados **por concentração de permissões** (FR-007, decisão de
  012 §2.3) com `+N módulos`, duas contagens e afordância de abrir. Lista completa de áreas
  disponível a leitor de tela.
- **T033 [D]** Estados da lista: carregando (esqueleto com a forma do cartão real), vazio por
  filtro (com limpar) e vazio por ausência de papéis — dois estados distintos, nunca um.
- **T034 [D]** `RoleDetailPanel` sobre o `DetailPanel` da Onda 0: cabeçalho com nome, tipo,
  privilégio, descrição completa e três contagens (FR-011). Não-modal em `xl`+, overlay abaixo
  (FR-010).
- **T035 [D]** Abas Permissões e Usuários via `EntityTabs`.
- **T036 [D]** Aba Permissões: agrupamento por `PermissionArea` sobre `DisclosureGroup`, contagem
  por módulo, "Expandir todos" (FR-013, FR-014).
- **T037 [D]** Bloco que declara o modelo de autorização real (FR-015). **Proibido** "herdada de"
  ou qualquer sugestão de hierarquia.
- **T038 [D]** "Ver identificadores técnicos" revelando o identificador ao lado de cada rótulo
  (FR-016). Rótulo primário vem do catálogo pt-BR; a descrição da API, hoje em inglês (F-63), fica
  como texto secundário (FR-017).
- **T039 [D]** Aba Usuários com `user:administer`: uma requisição paginada a
  `GET /admin/users?roleId=` (FR-024), apresentando nome, e-mail, cargo, status, unidade primária e
  os demais papéis (FR-021).
- **T040 [D]** Aba Usuários **sem** `user:administer`: contagem agregada e explicação da exigência.
  Nenhum dado pessoal chega ao DOM — não basta ocultar por CSS (FR-018, FR-020).
- **T041 [D]** Explicação de que o escopo organizacional é concedido por usuário
  (`OrgScopeGrant`), nunca apresentado como propriedade da atribuição (FR-022). Link só quando o
  usuário atual estiver autorizado a consultá-lo (FR-023).
- **T042 [D]** Modo de edição dentro do painel (FR-027): nome, descrição e árvore de permissões por
  módulo com checkbox tri-estado (FR-028), usando o `Checkbox` da Onda 0.
- **T043 [D]** Resumo de alterações pendentes, acrescentadas e removidas, antes de salvar (FR-029),
  mais o `effectNotice` já existente (FR-030).
- **T044 [D]** Papel do sistema em edição: nome e permissões legíveis e travados com a razão
  escrita; `PATCH` envia **somente** `description` (FR-031). Este é o defeito que 012 §3.1 corrigiu
  — não regredir.
- **T045 [D]** Cancelar descarta sem persistir e volta ao estado de leitura (FR-032).
- **T046 [D]** `page.tsx` atualizado; `PageHeader` com breadcrumb, título, descrição e `Novo papel`
  gateado por `role:administer`. `role-create-dialog.tsx` **não** é tocado (FR-034).
- **T047 [D]** Portão de aceitação visual de CLAUDE.md §18.11, respondido **olhando a aplicação
  renderizada**, não o código.

---

## Onda 4 — Prova · Sonnet-E · SEQUENCIAL

- **T048 [E]** Inventário de consumidores, por `grep`, de `role-admin-columns.tsx`,
  `role-details-dialog.tsx` e `role-edit-dialog.tsx`. Registrar o resultado.
- **T049 [E]** Para cada comportamento coberto pelos testes antigos, apontar o teste equivalente na
  implementação nova. Comportamento sem equivalente **bloqueia a remoção**.
- **T050 [E]** Migrar a cobertura e só então remover os arquivos comprovadamente mortos (D-07).
  `role-permissions-summary.tsx` **não** é tocado — é consumido por `user-roles-dialog.tsx:27,160`.
- **T051 [E]** Testes de unidade dos componentes da Onda 3.
- **T052 [E]** `admin-roles.spec.ts` reescrito: abrir, buscar, filtrar, selecionar, abrir e fechar
  painel, expandir módulo, ver identificadores técnicos, alternar abas, iniciar edição, alterar
  permissões de papel editável, cancelar sem persistir, salvar alteração válida, verificar papel
  protegido. Limpeza por API em `afterEach`, como a versão de 012.
- **T053 [E]** Cenários 1, 2, 10, 11, 12 e 13 de `plan.md` §3 no E2E. Marcadores de teste **sem**
  prefixo de dois caracteres (F-45/F-54).
- **T054 [E]** Varredura axe nos dois temas, esperando o elemento **efetivamente renderizado**
  (F-28). Lembrar que o arquivo roda em `mode: 'serial'`.
- **T055 [E]** Captura renderizada por `ui-capture.mjs` em `docs/reviews/ui/`, claro e escuro, em
  1920/1440/1280/1024/768/390, incluindo painel aberto, módulo expandido, identificadores visíveis,
  edição de papel personalizado e de papel do sistema, aba Usuários nos dois estados de permissão,
  lista vazia e estado de erro.
- **T056 [E]** Medição de fechamento em série: arquivos e testes antes e depois de cada suíte,
  com os números reais. Nenhum teste removido, nenhum `skip`, nenhuma asserção enfraquecida.
- **T057 [E]** Prova de não-vacuidade: para cada correção estrutural desta fase, reverter e mostrar
  o teste que falha.
- **T058 [E]** `STATE.md` desta fase: o que foi decidido, o que foi medido, o que ficou aberto, e
  os defeitos encontrados além do pedido.

---

## Dependências

```
T001..T010 (A) ─┐
                ├─→ T028..T047 (D) ─→ T048..T058 (E)
T011..T021 (B) ─┤
T022..T027 (C) ─┘
```

`T034` depende de `T005`. `T036` depende de `T006`. `T042` depende de `T003`.
`T028` depende de `T011`+`T023`. `T024`/`T025` não dependem de nada além do tipo `Role`.

---

## Definição de pronto

Uma tarefa está pronta quando: o comportamento existe, tem teste que falha sem ele, passa lint e
typecheck, respeita a fronteira de ownership, e — para tarefa de interface — foi vista na aplicação
renderizada, não apenas compilada.
