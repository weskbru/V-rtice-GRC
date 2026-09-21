# Tasks — Gestão de Ativos e Gestão de Processos

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data model**:
[data-model.md](./data-model.md) · **Research**: [research.md](./research.md) · **Quickstart**:
[quickstart.md](./quickstart.md) · **Contratos**:
[contracts/assets.openapi.yaml](./contracts/assets.openapi.yaml) ·
[contracts/processes.openapi.yaml](./contracts/processes.openapi.yaml)

`[P]` = paralelizável (arquivos distintos, sem dependência pendente). `[US1|US2|US3]` = história de
usuário que a tarefa serve.

**Testes são obrigatórios nesta fase**, não opcionais: Constituição Princípio IX e CLAUDE.md §13.1.

**As tabelas `assets` e `processes` já existem e NÃO são migradas.** Toda tarefa abaixo que fala em
migração toca **apenas** o enum `AuditEntityType`. Se uma tarefa parecer exigir alterar coluna de
`assets` ou `processes`, pare e reporte — data-model.md §1 diz que isso não acontece nesta fase.

**Simetria é requisito, não estilo (FR-020).** Toda tarefa marcada **(×2)** é feita duas vezes, uma
para Ativo e uma para Processo, com a mesma forma. Divergência entre os dois precisa de
justificativa escrita.

---

## Fase 1 — Setup e migração

- [x] T001 Migração aditiva em `apps/api/prisma/migrations/` acrescentando `ASSET` e `PROCESS` ao
      enum `AuditEntityType` (padrão ADR-008, data-model.md §1), e estender
      `apps/api/prisma/schema.prisma` para refleti-la. **Nenhuma outra alteração de esquema nesta
      fase** — nenhuma coluna de `assets` ou `processes` muda de tipo, nome ou nulidade
- [x] T002 [P] Estender o registro fechado de prefixos com `'AST'` e `'PRC'` — `EntityCodePrefix` e
      `ENTITY_CODE_PATTERN` em `apps/api/src/grc/shared/domain/entity-code.service.ts`
      (data-model.md §2). Reusa `GrcCodeSequence`; **nenhuma tabela de sequência nova**. Sem isto,
      T020 não compila
- [x] T003 [P] `apps/api/src/modules/assets/domain/asset-permissions.ts` — quatro permissões novas
      `asset:view|create|edit|administer`, agregadas ao catálogo estático
      `apps/api/src/permission-catalogue.ts`. Reusa valores de `PermissionAction` existentes —
      **nenhuma ação nova** (data-model.md §5)
- [x] T004 [P] `apps/api/src/modules/processes/domain/process-permissions.ts` — idem, para
      `process:view|create|edit|administer`
- [x] T005 Verificar contra o banco real que T001 é aditiva: migrar para cima e para baixo e
      confirmar que as contagens de `assets`, `processes`, `risk_asset_links`, `risk_process_links`,
      `control_asset_links` e `control_process_links` são idênticas antes e depois (suporte a
      SC-006)
- [x] T006 **Semear as permissões novas nos papéis que hoje dependem de `risk:view` para enxergar o
      inventário** (`apps/api/prisma/seed/platform.seed.ts`, A-6/D-7). Sem isto, usuários perdem
      acesso silenciosamente — um seletor de vínculo vazio, sem erro. É a mesma classe de defeito
      que o papel "Audit Lead" produziu na fase anterior
- [x] T007 **Atribuir unidade organizacional às duas linhas de fixture** (`FIXTURE-ASSET-1`,
      `FIXTURE-PROCESS-1`, `platform.seed.ts`), na MESMA tarefa que as permissões — não depois.
      Assim que a listagem passar a aplicar escopo (T031), elas somem para atores escopados por
      unidade, e qualquer teste que dependa de vê-las quebra (research.md D-2, "consequência aceita")
- [x] T008 Estender a guarda estrutural `apps/api/test/unit/audit-engagement-write-implies-read.spec.ts`
      (ou uma irmã ao lado, se aquele arquivo ficar sobrecarregado) para cobrir os dois recursos
      novos: **todo papel semeado que escreve um ativo ou um processo consegue lê-lo**. Reprovar
      contra a semeadura sem T006 antes de aceitar

---

## Fase 2 — Fundação dos dois módulos (bloqueia todas as histórias)

- [x] T009 [P] Esqueleto de `apps/api/src/modules/assets/` (`domain`/`application`/`infrastructure`/
      `presentation`) e `assets.module.ts`, registrado no módulo raiz
- [x] T010 [P] Esqueleto de `apps/api/src/modules/processes/`, idêntico em forma (FR-020)
- [x] T011 [P] `apps/api/src/shared/grc-ports/asset-directory.port.ts` — `AssetDirectoryPort` /
      `AssetDirectoryEntry { id, code, name, orgUnitId, isActive }`. **`orgUnitId` é obrigatório na
      forma exposta** — é o campo que o chamador compara com o escopo do ator antes de gravar
      (ADR-020 parte 4); um porte que o esconde torna a parte 4 impossível de cumprir, que foi a
      forma exata do gap de F-46 (data-model.md §8)
- [x] T012 [P] `apps/api/src/shared/grc-ports/process-directory.port.ts` — idem
- [x] T013 (×2) Adaptadores `asset-directory.adapter.ts` e `process-directory.adapter.ts` nos módulos
      novos, implementando T011/T012, ligados no *composition root*
- [x] T014 (×2) `asset-audit-allowlist.ts` / `process-audit-allowlist.ts` — o *field allow-list* de
      auditoria de cada tipo, declarado explicitamente, nunca "tudo o que houver no objeto"
      (data-model.md §7)
- [x] T015 (×2) Entidade de domínio com as Invariantes A1–A6 como asserções nomeadas
      (`asset.entity.ts` / `process.entity.ts`), no formato que `finding.entity.ts` já usa
- [x] T016 (×2) Repositório escopado estendendo `ScopedRepository` com `scopeField = 'orgUnitId'`,
      como `ControlScopedRepository` (data-model.md §6)

**Checkpoint**: os dois módulos existem, os portes existem, nada ainda é servido por HTTP.

---

## Fase 3 — US1: manter o inventário e o catálogo (P1) 🎯 MVP

**Meta**: cadastrar, encontrar, editar e desativar Ativo e Processo pelo produto — o que hoje é
impossível.

**Teste independente**: cadastrar um ativo e um processo, encontrá-los na listagem filtrando por
unidade e situação, editá-los e desativá-los, tudo pela interface, sem tocar no banco.

- [x] T017 (×2) [US1] Caso de uso `list-assets.usecase.ts` / `list-processes.usecase.ts` — paginado,
      filtro por unidade e por situação, busca por nome ou código, **com `ScopeFilter` resolvido e
      aplicado** (fecha o vazamento 1 — ver também T031)
- [x] T018 (×2) [US1] `get-asset.usecase.ts` / `get-process.usecase.ts` — inclui os riscos e
      controles vinculados (FR-008), lendo as tabelas de vínculo pelo lado do dono, **sem criar
      tabela nem tipo de vínculo novo**
- [x] T019 (×2) [US1] `create-asset.usecase.ts` / `create-process.usecase.ts` — `orgUnitId`
      obrigatório (Invariante A1) e verificado contra o escopo do ator (A2); código gerado pelo
      servidor (A6); auditado `asset.created`/`process.created`
- [x] T020 (×2) [US1] `update-asset.usecase.ts` / `update-process.usecase.ts` — nome, descrição e
      unidade; auditado com valores anteriores **e** posteriores
- [x] T021 (×2) [US1] `deactivate-*.usecase.ts` e `reactivate-*.usecase.ts` — as duas transições de
      §3, auditadas; **nenhuma exclusão em lugar nenhum** (FR-012)
- [x] T022 (×2) [US1] Controllers e DTOs das seis operações de cada contrato, em
      `modules/{assets,processes}/presentation/`
- [x] T023 [US1] **Acrescentar `assets.openapi.yaml` e `processes.openapi.yaml` a `CONTRACT_SOURCES`
      em `apps/api/test/contract/contract-coverage.spec.ts`, NESTA tarefa, junto com os
      controllers** — nunca "depois". Foi exatamente essa omissão que deixou a fase anterior com
      duas operações contratadas e nunca construídas, com a CI verde. Atualizar a aritmética do
      cabeçalho daquele arquivo honestamente (+12 operações)
- [x] T024 (×2) [US1] Testes de contrato das seis operações: criar, ler, listar com filtro e busca,
      editar, desativar, reativar
- [x] T025 [US1] Teste: nome não é identidade — dois registros com o mesmo nome coexistem, com
      códigos distintos (Invariante A3, US1 cenário 5)
- [x] T026 [US1] Teste: um `code` enviado no corpo é rejeitado como propriedade desconhecida
      (Invariante A6)
- [x] T027 [US1] Teste: desativar um registro que já tem vínculos ativos é permitido; ele continua
      legível e continua aparecendo nos vínculos existentes, e é recusado em vínculo novo (SC-007,
      os dois lados)
- [x] T028 [US1] Teste: reativar devolve a capacidade de vincular, e as duas transições aparecem na
      trilha (US1 cenário 4)

**Checkpoint**: US1 é uma entrega independente — o inventário passa a ser mantido pelo produto.

---

## Fase 4 — US2: autoridade própria, sem depender de Riscos (P1)

**Meta**: ler o inventário exige `asset:view`, não `risk:view`.

**Teste independente**: um usuário com `asset:view` e **sem** `risk:view` lista ativos e usa o
seletor de vínculo na tela de um controle.

- [x] T029 [US2] Remover `GET /processes` e `GET /assets` de `RegistryController`
      (`modules/risk/presentation/`), e remover `list()` de
      `modules/risk/infrastructure/prisma-registry.repository.ts` — a propriedade passa aos módulos
      donos (research.md D-5). Mesmo movimento que `GET /controls` fez na Fase 2
- [x] T030 [US2] Remover os dois caminhos de `specs/001-grc-platform-foundation/contracts/platform.openapi.yaml`,
      onde estão hoje (linhas 645 e 679), já que passam a ser declarados pelos contratos desta fase.
      Uma operação declarada em dois contratos é ambiguidade de propriedade, não redundância inofensiva
- [x] T031 [US2] **Teste que exerce o defeito de hoje**: um ator com `asset:view` e **sem**
      `risk:view` lista ativos com sucesso; e um ator com `risk:view` e **sem** `asset:view` é
      recusado (SC-002). Este teste falha contra o código atual — confirme que falha antes de
      aceitá-lo
- [x] T032 [US2] Ajustar os consumidores do frontend (`features/risks/api.ts`,
      `features/controls/api.ts`) se e onde o contrato observável mudar. O caminho HTTP **não** muda
      (FR-014); a autoridade e o escopo mudam

---

## Fase 5 — US3: fechar os dois vazamentos de escopo (P1)

**Meta**: escopo organizacional deixa de vazar, na leitura e na escrita.

**Teste independente**: um ator escopado à unidade A não vê ativos da unidade B na listagem, e não
consegue vincular um risco a um ativo da unidade B.

- [x] T033 [US3] **Vazamento 1 — leitura**: confirmar que T017 aplica `ScopeFilter` de verdade, com
      teste de que um ator escopado à unidade A não recebe registros da unidade B **nem no corpo,
      nem no total, nem na paginação** (SC-003b). Hoje a listagem falha isto para todos os atores
- [x] T034 [US3] **Vazamento 2 — escrita, Risco→Ativo**: `modules/risk/application/links/asset-link.usecase.ts`
      passa a verificar o `orgUnitId` do alvo contra o escopo do ator antes de gravar, e a exigir
      `asset:view` do lado referenciado — a forma que `control-asset-link.usecase.ts` já tem e que
      `control-link.usecase.ts` recebeu em F-46 (ADR-020 partes 4 e 5)
- [x] T035 [US3] **Vazamento 2 — escrita, Risco→Processo**: idem em `process-link.usecase.ts`
- [x] T036 [US3] `modules/controls` e `modules/risk` passam a consumir `AssetDirectoryPort`/
      `ProcessDirectoryPort` em vez de ler as tabelas: apagar
      `modules/controls/infrastructure/reference-registry-lookup.repository.ts` e o `findById` de
      ativo/processo de `modules/risk/infrastructure/prisma-registry.repository.ts` (Constituição
      Princípio I, ADR-011)
- [x] T037 [US3] Teste, para cada um dos quatro pares: alvo fora do escopo responde **exatamente**
      como alvo inexistente, e **nenhuma linha é gravada** — contagem conferida antes e depois
      (SC-003). Dois dos quatro pares falham este teste contra o código atual
- [x] T038 [US3] Teste: um ator com autoridade de vínculo mas **sem** `asset:view` é recusado
      (ADR-020 parte 5, US3 cenário 4)
- [x] T039 [US3] Teste: um vínculo criado **antes** desta fase, entre unidades diferentes, continua
      legível — a correção fecha a porta para vínculos novos e **não** apaga história (US3 cenário 3)
- [x] T040 [US3] **Guarda estrutural que generaliza**: um teste que falhe se **qualquer** caso de uso
      de vínculo em `modules/risk` ou `modules/controls` deixar de verificar o escopo do alvo — não
      apenas os dois relatados. F-46 corrigiu um irmão e deixou dois; uma guarda escrita só para os
      dois de hoje repetiria o erro na próxima vez (AGENTS.md: a correção generaliza a todo call site
      que compartilha o padrão)
- [x] T041 [US3] **Grep estrutural provando que nenhum módulo lê as tabelas diretamente**,
      automatizado como teste: nenhuma ocorrência de `prisma.client.asset`/`prisma.client.process`
      fora de `modules/assets` e `modules/processes` (SC-005)

---

## Fase 6 — Interface (§18)

- [x] T042 [P] `apps/web/src/lib/messages/assets.ts` — catálogo pt-BR completo
- [x] T043 [P] `apps/web/src/lib/messages/processes.ts` — idem
- [x] T044 [P] `apps/web/src/features/assets/{types,api}.ts` espelhando as seis operações do contrato
- [x] T045 [P] `apps/web/src/features/processes/{types,api}.ts` — idem
- [x] T046 (×2) Catálogo com indicadores, filtros, barra de resultados, alternância cards/tabela e
      paginação compartilhada, estendendo os padrões de `features/controls` (§18.12); os três estados
      (carregando, vazio-de-verdade, falha-ao-carregar) distinguíveis, com repetição na falha
- [x] T047 (×2) Detalhe, mostrando os riscos e controles vinculados (FR-008)
- [x] T048 (×2) Formulário de criação e edição; **ativo e inativo distinguíveis por mais do que cor**
      (FR-019, §18.8)
- [x] T049 (×2) Ações de desativar e reativar, com confirmação
- [x] T050 Navegação: as entradas "Ativos" e "Processos" deixam de ser planejadas em
      `apps/web/src/components/shell/navigation-registry.ts`, cada uma condicionada à autoridade de
      leitura do próprio recurso; fortalecer `navigation-registry.test.ts`, nunca enfraquecer
- [x] T051 Testes unitários dos componentes novos
- [x] T052 Verificação renderizada obrigatória (§18.1): estender `apps/web/scripts/ui-capture.mjs`,
      capturar nos **dois** temas, salvar em `docs/reviews/ui/` na raiz, e **olhar as imagens** contra
      o portão do §18.11 antes de considerar a fase concluída

---

## Fase 7 — Validação e fechamento

- [x] T053 Roteiro manual de ponta a ponta seguindo `quickstart.md` integralmente, registrando
      qualquer divergência entre desenho e realidade — foi assim que a fase anterior descobriu que seu
      próprio quickstart omitia um cabeçalho obrigatório
- [x] T054 E2E (Playwright) do caminho completo: cadastrar → listar → editar → desativar → recusa de
      vínculo → reativar, para os dois domínios
- [x] T055 E2E de escopo organizacional: um ator escopado à unidade A não vê a unidade B na listagem
      e não consegue vincular a ela (US3)
- [x] T056 Acessibilidade (axe) nas telas novas, claro e escuro, **aguardando conteúdo real
      renderizado** — a lição de F-28
- [x] T057 **Grep estrutural provando ausência de exclusão** nos dois contratos e nos dois módulos,
      automatizado como teste: zero verbos `delete:` (FR-012, SC-004), no formato de
      `audit-contract-no-deletion.spec.ts`
- [x] T058 Regressão: as suítes de Risco, Controles, Conformidade e Auditoria passam, com a mesma
      contagem de antes **exceto** onde um teste mudou para refletir o fechamento do gap de escopo —
      e cada teste alterado por essa razão **cita FR-011 explicitamente** (SC-006)
- [x] T059 **Confirmar que nenhum `GET` desta fase precisa de `Cache-Control: no-store`**: revisão
      dedicada, não suposição silenciosa, de que toda propriedade de toda resposta é coluna gravada
      por escrita anterior (data-model.md §11)
- [x] T060 Revisão final de simetria: comparar `modules/assets` e `modules/processes` arquivo a
      arquivo. Qualquer divergência de forma, autoridade ou ciclo de vida precisa de justificativa
      escrita, ou é defeito (FR-020)
- [x] T061 Revisão final contra a tabela do data-model.md §10: as cinco partes do ADR-020 aplicadas
      nos quatro pares, sem exceção pendente — conferido **no código**, não relendo a tabela

---

## Dependências

```
Fase 1 → Fase 2 → { Fase 3 → Fase 4 → Fase 5 } → Fase 6 → Fase 7
```

A Fase 4 depende da Fase 3 (não se pode mover a propriedade de uma listagem que ainda não existe no
módulo novo). A Fase 5 depende da Fase 4 (a verificação de escopo do alvo precisa dos portes, e os
portes precisam dos módulos). A paralelização real está **dentro** de cada fase: Ativo e Processo
são simétricos e correm juntos em quase toda tarefa marcada (×2), e T042–T045 repetem o padrão no
frontend.

## MVP

Fase 1 + Fase 2 + Fase 3 (US1) já entregam valor independente: o inventário de ativos e o catálogo
de processos passam a ser mantidos pelo produto, o que hoje é impossível. US2 e US3 são correções de
autorização sobre essa base — ambas P1 porque são segurança, e ambas impossíveis antes da promoção.

## Cobertura

Mapa FR → tarefa(s): FR-001→T009,T010 · FR-002→T019 · FR-003→T020 · FR-004→T019,T015 ·
FR-005→T021 · FR-006→T027 · FR-007→T017 · FR-008→T018,T047 · FR-009→T003,T004,T031 ·
FR-010→T017,T033 · FR-011→T034,T035,T037,T038,T040 · FR-012→T021,T057 · FR-013→T018,T036 ·
FR-014→T029,T030,T032 · FR-015→T014,T019,T020,T021 · FR-016→T033 · FR-017→T046,T047,T048 ·
FR-018→T050 · FR-019→T046,T048 · FR-020→T060 · FR-021→T036,T041 · FR-022→T060.

Mapa SC → tarefa(s): SC-001→T024 · SC-002→T031 · SC-003→T037 · SC-003b→T033 · SC-004→T057 ·
SC-005→T041 · SC-006→T005,T058 · SC-007→T027 · SC-008→T056.
