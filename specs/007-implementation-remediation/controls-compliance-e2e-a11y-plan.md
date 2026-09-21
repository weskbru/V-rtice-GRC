# Plano — fechar F-55 (E2E e acessibilidade de Controles e Compliance)

Plano de execução para a dívida confirmada em F-55 (`docs/deferred-findings.md`): Controles (item 9
do roadmap) e Compliance (item 10) nunca receberam jornadas E2E nem varredura de acessibilidade
próprias, ao contrário de toda fase de módulo de negócio posterior. Este documento não corrige
nada — descreve o que precisa ser construído, com escopo, dono de cada peça e custo aproximado,
para que a próxima sessão execute em vez de decidir de novo.

**Não é este plano**: uma reavaliação de F-55 (já confirmado, por inspeção de `git show --stat`
contra os dois commits de fechamento), nem uma proposta de nova arquitetura de teste — segue
estritamente os padrões já estabelecidos em `apps/web/e2e/` (fixture pelo API real, uma identidade
por preocupação, nunca pool compartilhado — AGENTS.md, F-16/F-34).

---

## 1. O que já existe, para não duplicar

Medido em 2026-09-11, não suposto:

- **Testes de unidade/integração/contrato**: 27 arquivos tocando `control`/`compliance` em
  `apps/api/test/`, 17 em `apps/web/src/features/{controls,compliance}/`. A lógica de domínio,
  autorização e escopo organizacional das duas fases **está** coberta — a lacuna é
  especificamente E2E (through-the-browser) e varredura `axe`.
- **`accessibility.spec.ts`** varre a aba "Controles vinculados" **embutida** em risco/ativo/
  processo (linhas ~625, 854, 918) — nunca o catálogo de Controles (`/controls`) nem qualquer tela
  de Compliance isoladamente. Essas três varreduras existentes não mudam.
- **`audit-engagement-scope.spec.ts`** (T084) já cria um controle real via `POST /controls` durante
  seu próprio fixture setup (linha ~130, através de `/controls/new`) para provar a recusa de
  vínculo fora de escopo — mas exercita só a criação, não o ciclo de vida, verificação ou vínculos
  do módulo de Controles em si.
- **Captura renderizada manual** (§18.1) foi feita uma vez para Controles
  (`docs/reviews/ui/controls-{light,dark}/`) — prova que a tela existiu naquele momento, não
  verificação repetível.

---

## 2. Jornadas E2E — Controles

Fonte: `specs/003-controls-management/spec.md`, três user stories, já com cenários de aceitação
numerados. Um arquivo novo por módulo, seguindo o padrão de arquivo único por jornada completa que
`risk-treatment.spec.ts` (201 linhas) e `audit-engagement.spec.ts` (344 linhas) já estabelecem —
não um arquivo por user story, o que fragmentaria fixtures que todas as três precisam do mesmo
controle.

**Arquivo novo**: `apps/web/e2e/controls-lifecycle.spec.ts`

| # | Passo | US / FR | Observação |
|---|---|---|---|
| 1 | `Control Owner` provisionado fresco (via `/admin/users`, mesmo padrão de `admin-access.spec.ts`/`audit-engagement-scope.spec.ts`) faz login | — | nunca a conta de bootstrap nem um pool — AGENTS.md |
| 2 | Cadastra um controle via `/controls/new`: nome, descrição, unidade, dono, natureza, tipo, frequência | US1, cenário 1 | controle nasce `DRAFT`, código estável gerado pela plataforma |
| 3 | Ativa o controle (`DRAFT` → `ACTIVE`) | US1, cenário 2 | transição com autor/data visível na tela |
| 4 | Registra uma verificação (data, resultado, conclusão) | US2, cenário 1 | `control:test`, já concedido ao Control Owner |
| 5 | **Tentativa de autoatestação recusada**: o próprio Control Owner (que também testou) tenta atestar a própria verificação | US2, cenários 3+4 | ver §5 abaixo — decisão sobre uma ou duas identidades |
| 6 | `Control Approver` provisionado fresco ateste a verificação | US2, cenário 5 | efetividade derivada passa a refletir o resultado |
| 7 | Confirma que o controle nunca verificado antes desta sessão aparecia como "não avaliado", nunca "efetivo" por omissão | US2, cenário 7 | pode ser um SEGUNDO controle criado só para este assert, mais barato que instrumentar o primeiro antes do passo 4 |
| 8 | Volta como Control Owner, liga o controle a um processo e a um ativo reais (reaproveita os fixtures que `assets-processes.spec.ts` já sabe criar, ou cria os seus) | US3, cenários 2 | `control-links-section.tsx`, já convertido ao `SearchablePicker` (Front H) — usar o padrão de busca por código, nunca `.first()` sem justificativa, igual às três especificações já corrigidas nesta sessão |
| 9 | Desfaz um vínculo, confirma que ele permanece no histórico | US3, cenário 3 | mesmo padrão de diálogo de confirmação que `risk-treatment.spec.ts` já usa |
| 10 | Tenta vincular um alvo fora do escopo organizacional do ator — resposta idêntica a inexistente | US3, cenário 4 | reaproveita a identidade com escopo estreito que `audit-engagement-scope.spec.ts` já sabe provisionar, ou cria a sua própria |
| 11 | Descontinua o controle (`ACTIVE` → `RETIRED`) com justificativa | US1, cenário 3 | confirma que uma nova verificação é recusada depois disso (edge case "Verificação em controle descontinuado") |
| 12 | Abre o controle como ator sem escopo sobre a unidade — resposta idêntica a inexistente | US1, cenário 4 | fecha o pareamento leitura/escrita que ADR-020 exige em todo módulo |

**Não incluído neste arquivo, e por quê**: abrir uma ação de remediação a partir de uma verificação
inefetiva (US3, cenário 7) — a tela que lista essa ação é `/actions` ("Planos de Ação"), capacidade
compartilhada do núcleo GRC (`grc/action`), e um E2E que a exercitasse a partir de Controles
pertenceria igualmente a qualquer outro consumidor de `Action`. Registrar como item separado, não
inflar este arquivo com uma jornada que não é específica de Controles.

---

## 3. Jornadas E2E — Compliance

Fonte: `specs/004-compliance-management/spec.md`, três user stories. Esta é a jornada mais rica das
duas — versionamento, migração de mapeamento e estado de conformidade calculado — e comparável em
tamanho a `audit-engagement-scope.spec.ts` (404 linhas) ou maior.

**Arquivo novo**: `apps/web/e2e/compliance-lifecycle.spec.ts`

| # | Passo | US / FR | Observação |
|---|---|---|---|
| 1 | `Compliance Manager` provisionado fresco faz login | — | uma identidade só basta — a própria especificação diz que não há segregação de funções entre as três permissões do papel (US3, "Why this priority") |
| 2 | Cadastra um framework e a versão 1 em rascunho, com pelo menos duas cláusulas, via `/compliance/new` → `/compliance/{id}/versions/new` | US1, cenário 1 | `framework-form.tsx`, `framework-version-form.tsx`, `requirement-inline-form.tsx` |
| 3 | Publica a versão 1 (`publish-version-action.tsx`) | US1 | pré-condição do cenário 2 |
| 4 | Tenta editar o texto de uma cláusula da versão publicada — recusado | US1, cenário 2 | precisa existir affordance de edição na tela para a tentativa ser real, não simulada por API |
| 5 | Mapeia a cláusula A a um controle real (reaproveita o `SearchablePicker` já convertido em `requirement-controls-section.tsx`, buscando por código) | US2, cenário 1 | mesma disciplina de busca-por-código das três especificações já corrigidas |
| 6 | Liga o MESMO controle a uma cláusula de um SEGUNDO framework, confirma que os dois vínculos coexistem sobre o mesmo controle (nenhuma cópia) | US2, cenário 2 | prova textual: nome/código do controle idêntico nas duas telas |
| 7 | Cria a versão 2 do primeiro framework, com uma cláusula que corresponde à A e uma cláusula nova sem correspondente | US1, cenário 3 | a versão 1 continua íntegra e legível — assert explícito, não assumido |
| 8 | Executa a migração de mapeamento (`mapping-migration-dialog.tsx`/`mapping-migration-panel.tsx`) | US2, cenário 3 | confirma que a cláusula correspondente herda o vínculo e a nova fica **pendente de decisão**, nunca silenciosamente sem mapeamento |
| 9 | Abre a trilha de auditoria da migração — aparece como evento próprio (origem, destino, o que foi transportado) | US2, cenário 4 | não como vínculos avulsos indistinguíveis de trabalho manual |
| 10 | Declara uma cláusula não aplicável **sem** justificativa — recusado | US3, cenário 1 | `requirement-applicability-section.tsx` |
| 11 | Declara a mesma cláusula não aplicável **com** justificativa — gravado, cláusula sai do cálculo de conformidade da versão | US3, cenário 2 | |
| 12 | Lê o estado de uma cláusula ainda sem controle ligado — "não atendida", nunca conforme por omissão | US3, cenário 3 | `compliance-summary-card.tsx` |
| 13 | Lê o estado da cláusula do passo 5 antes de o controle ter verificação atestada — "não comprovada" | US3, cenário 4 | requer um controle recém-criado, sem histórico de verificação — não reaproveitar um controle de `controls-lifecycle.spec.ts` que já foi atestado no passo 6 daquele arquivo |
| 14 | Ataca o controle com uma verificação atestada como efetiva (hybrid step via `page.request`/`fetchFromPage`, como `audit-engagement.spec.ts` já faz para evidência — não há necessariamente affordance de atestação de fora do módulo de Controles na mesma sessão) | US3, cenário 5 | relê a cláusula: agora conforme, mudança auditada |
| 15 | Liga a mesma cláusula a um segundo controle inefetivo, confirma "parcialmente atendida" | US3, cenário 6 | fecha as quatro leituras de estado (não atendida / não comprovada / conforme / parcial) na mesma bateria |

**Custo de "duas versões vigentes ao mesmo tempo" e "controle aposentado ligado a cláusula
vigente"** (edge cases do spec.md): valem um teste de integração/contrato, não E2E — são estados de
dados, não uma jornada de tela nova. Não incluir aqui.

---

## 4. Acessibilidade — telas que precisam de varredura nos dois temas

Convenção já estabelecida em `accessibility.spec.ts`: uma tela nova entra como um novo `describe`
com seu próprio fixture (nunca reaproveitando um registro criado por outro módulo, pelo motivo que
o próprio cabeçalho do arquivo já documenta — F-28, "mediu uma tela cujos gráficos ainda não
existiam").

| Tela | Rota | Temas | Observação |
|---|---|---|---|
| Catálogo de Controles | `/controls` | claro + escuro | lista vazia nunca aceitável como estado varrido — precisa de ao menos um controle real, igual ao raciocínio já registrado para `/assets`/`/processes` |
| Novo controle | `/controls/new` | claro + escuro | formulário completo, incluindo o seletor de unidade organizacional |
| Detalhe do controle — aba "Visão geral" | `/controls/{id}` | claro + escuro | |
| Detalhe do controle — aba "Verificações" | `/controls/{id}` | claro | histórico de verificação + diálogo de atestação (`control-assessment-attestation-dialog.tsx`) — aberto, não só a lista |
| Detalhe do controle — aba "Vínculos" | `/controls/{id}` | claro | o `SearchablePicker` já convertido — cobre o mesmo componente que os specs de risco/ativo/processo, mas na tela que ainda não tinha varredura própria |
| Abas do detalhe do controle são alcançáveis e operáveis por teclado (roving tablist) | `/controls/{id}` | — | mesmo teste que já existe para risco (linha 676) — um teste NOVO, não uma extensão do existente, porque é uma tablist diferente |
| Biblioteca normativa (lista de frameworks) | `/compliance` | claro + escuro | |
| Novo framework | `/compliance/new` | claro + escuro | |
| Detalhe do framework (lista de versões) | `/compliance/{id}` | claro | |
| Nova versão | `/compliance/{id}/versions/new` | claro | inclui `requirement-inline-form.tsx` |
| Detalhe da versão (lista de cláusulas + ação de publicar) | `/compliance/{id}/versions/{versionId}` | claro + escuro | |
| Detalhe da cláusula — mapeamento + aplicabilidade | `.../requirements/{requirementId}` | claro + escuro | duas seções na mesma tela (`requirement-controls-section.tsx`, já com `SearchablePicker`; `requirement-applicability-section.tsx`) |
| Diálogo de migração de mapeamento, aberto | `.../mapping-migrations/{migrationId}` | claro | foco preso e restaurado ao fechar — mesmo padrão já testado para o diálogo de transição de risco (linha 697) |

Total: **~19 varreduras novas** (contando claro/escuro separadamente onde ambos aparecem), mais um
teste de teclado dedicado — o mesmo formato de contagem que a tabela de `test()` já existente em
`accessibility.spec.ts` usa.

**Onde isto vive — decisão explícita, não faça por inércia**: **não** acrescentar estas telas ao
`beforeAll` compartilhado já existente em `accessibility.spec.ts`. Esse hook já rodou uma vez contra
o teto padrão de 30s do Playwright e precisou ser corrigido para 120s (F-52) — o próprio arquivo
documenta a medição (27,16s locais contra um teto de 30s, CI tipicamente 2-4x mais lento). Acrescentar
~10 novos registros de fixture (framework, duas versões, cláusulas, mapeamento, migração, controle,
verificação, atestação) ao mesmo hook é o cenário exato que já estourou uma vez. **Recomendação**:
um arquivo novo, `apps/web/e2e/accessibility-controls-compliance.spec.ts`, com seu próprio
`beforeAll` e seu próprio orçamento medido — não uma extensão do arquivo de 932 linhas existente.

---

## 5. Decisão em aberto que a próxima sessão precisa resolver antes de escrever o passo 5 de
   `controls-lifecycle.spec.ts`

US2 (Controles) descreve DOIS cenários de recusa de autoatestação como Given/When/Then distintos:
"quem testou tenta atestar" (cenário 3) e "o dono do controle tenta atestar" (cenário 4). Duas
formas de provar isso, com custo diferente:

- **Barata (recomendada para a primeira passada)**: uma única identidade que é ao mesmo tempo dono
  e testadora (o caso comum — `Control Owner` tem `control:create`+`control:edit`+`control:test`
  simultaneamente). Uma tentativa de autoatestação recusada cobre as duas cláusulas do OR ao mesmo
  tempo, porque a pessoa é as duas coisas. Falso quando as duas cláusulas divergem por sorte de
  implementação (ex.: alguém troca a checagem por "só dono" e o teste continua verde porque a
  pessoa também era a testadora) — é exatamente a classe de teste-que-não-protege-nada que
  CLAUDE.md §18.8 nomeia.
- **Precisa (upgrade explícito, não obrigatório na primeira passada)**: três identidades
  distintas — dono que nunca testa, testador que não é dono, aprovador — provando as duas cláusulas
  do OR separadamente. Custa duas provisões extras de usuário (via `/admin/users`, mesmo padrão já
  em uso) e mais duas trocas de sessão.

**Portão**: quem escrever o arquivo decide e registra a escolha no próprio comentário do teste — não
decidir em silêncio, como F-42 já cataloga como padrão recorrente deste repositório.

---

## 6. Fixtures e identidades necessárias, por completo

Nenhuma delas é um pool compartilhado — todas provisionadas frescas via `/admin/users`, mesmo
mecanismo que `admin-access.spec.ts`/`audit-engagement-scope.spec.ts` já usam, sinalizadas
`justCreated` para `signInAsFreshlyProvisionedUser` (Front E, zero tentativas de login
desperdiçadas).

| Identidade | Papel seedado | Usada em |
|---|---|---|
| Control Owner | `Control Owner` (`control:view/create/edit/test`) | `controls-lifecycle.spec.ts`, passos 1-4, 7-9, 11 |
| Control Approver | `Control Approver` (`control:view/approve`) | `controls-lifecycle.spec.ts`, passo 6 |
| Ator de escopo estreito | qualquer papel + `scopeGrants: [{scopeType: 'UNIT', ...}]` sobre uma unidade que não a do controle | `controls-lifecycle.spec.ts`, passos 10, 12 — mesmo padrão de `audit-engagement-scope.spec.ts` |
| Compliance Manager | `Compliance Manager` (`compliance:view/administer/map`) | `compliance-lifecycle.spec.ts`, todos os passos |
| Um segundo controle "nunca verificado" | criado dentro do próprio arquivo | `controls-lifecycle.spec.ts`, passo 7 |
| Um segundo framework | criado dentro do próprio arquivo | `compliance-lifecycle.spec.ts`, passo 6 |
| Um segundo controle "inefetivo" | criado dentro do próprio arquivo, com verificação atestada como inefetiva | `compliance-lifecycle.spec.ts`, passo 15 |

Dados que os dois arquivos de acessibilidade precisam ter POPULADOS antes de qualquer varredura
(nunca aceitar o estado vazio como varrido — F-28): pelo menos um controle em cada estado
(`DRAFT`/`ACTIVE`/`RETIRED`) se o custo couber no orçamento, ou ao menos um `ACTIVE` com verificação
e vínculo; pelo menos um framework com duas versões, uma cláusula mapeada e uma declarada não
aplicável.

---

## 7. Custo aproximado

Baseado em arquivos comparáveis já existentes neste mesmo diretório (medido, não estimado a
esmo): `risk-treatment.spec.ts` 201 linhas (uma jornada), `audit-engagement.spec.ts` 344 linhas
(jornada rica com hybrid steps), `audit-engagement-scope.spec.ts` 404 linhas (foco em escopo,
várias identidades), `assets-processes.spec.ts` 325 linhas (jornada dupla parametrizada).

| Item | Linhas estimadas | Comparável |
|---|---|---|
| `controls-lifecycle.spec.ts` | 380-480 | entre `risk-treatment` e `audit-engagement-scope`, por causa das 2-3 identidades da §5 |
| `compliance-lifecycle.spec.ts` | 480-600 | jornada mais rica das duas — versionamento + migração + 4 estados de conformidade |
| `accessibility-controls-compliance.spec.ts` | 280-380 | ~19 `test()` de varredura + 1 de teclado + seu próprio `beforeAll` de fixture |
| **Total novo** | **~1150-1450 linhas** | comparável ao que a Fase 6 (Ativos e Processos) entregou em `apps/web/e2e/` sozinha |

**Orçamento de login E2E (F-48, teto de 20 tentativas/5min)**: custo incremental **zero** em
tentativas malsucedidas — todo provisionamento novo usa `signInAsFreshlyProvisionedUser` (Front E),
que tenta a senha exatamente uma vez. O custo real é de **tempo de execução** (mais um worker mais
tempo por causa das 4-5 identidades novas de `controls-lifecycle.spec.ts` e das ~12 telas novas de
`accessibility-controls-compliance.spec.ts`) — a razão para o arquivo de acessibilidade novo ser
separado (§4), não uma extensão que reaproximaria o teto já pago uma vez (F-52).

**Trabalho que este plano deliberadamente NÃO orça**: nenhuma mudança de produto. Se qualquer passo
acima expuser um defeito real (como o achado de nome acessível que Front H já encontrou duas vezes
nesta sessão), corrigir o defeito é trabalho adicional àquela sessão, não uma tarefa que se soma a
este plano antecipadamente — CLAUDE.md §18.1 é claro que o laço é implementar → executar →
inspecionar → corrigir, não um orçamento fechado que já supõe zero defeitos.

---

## 8. Ordem de execução recomendada

1. `controls-lifecycle.spec.ts` primeiro — mais simples, sem versionamento, e prova o padrão de
   múltiplas identidades que `compliance-lifecycle.spec.ts` depois reaproveita para o Compliance
   Manager único.
2. `compliance-lifecycle.spec.ts` — depende conceitualmente de `controls-lifecycle.spec.ts` só
   para copiar o padrão, não de dados que ele produza; os dois arquivos são independentes e podem
   rodar em paralelo depois de escritos.
3. `accessibility-controls-compliance.spec.ts` por último — reaproveita o entendimento das duas
   jornadas anteriores para saber exatamente que dado popular em cada tela, e mede seu próprio
   orçamento de `beforeAll` antes de declarar um teto (a lição de F-52: medir, não estimar).
4. Fechar F-55 em `docs/deferred-findings.md` como RESOLVIDO só depois dos três arquivos passarem
   localmente e na CI — nunca antes, pelo mesmo motivo que F-52/F-53 documentam.
