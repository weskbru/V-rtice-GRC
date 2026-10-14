# Research — Convergência e Saneamento de Implementação

**Feature**: `007-implementation-remediation` · **Spec**: [spec.md](./spec.md) · **Date**: 2026-09-10

Toda decisão abaixo é do **coordenador desta fase de manutenção** (Claude Opus), ratificada em
`decisions-opus.md` como D-R1 a D-R14, sob autoridade delegada pela missão de saneamento —
**decisão de coordenador desta fase, não decisão histórica do usuário do produto**. Este documento
as renumera D-1 a D-16 para seguir o formato já usado pelos specs anteriores (`specs/006-.../research.md`),
expande a razão de cada uma, e acrescenta as alternativas rejeitadas que a fonte já cita.
D-15 e D-16 são decisões novas, tomadas ao longo desta mesma fase de especificação, a partir de dois
achados que o coordenador mediu diretamente contra a aplicação em execução.

Onde uma decisão da fonte foi corrigida pelo coordenador depois de uma verificação adicional própria
(o caso de D-5), o texto abaixo registra a correção explicitamente, em vez de silenciar a versão
original — a mesma disciplina que `specs/005-audit-findings/STATE.md` §6 já cobrou deste projeto.

**Nota sobre a ordem física do arquivo**: as decisões foram acrescentadas na ordem em que o
coordenador as tomou ao longo da sessão, não reordenadas depois — D-17 a D-20 (medição da Frente E)
foram inseridas antes de D-16 (README) porque chegaram primeiro na conversa, e D-21/D-22 foram
acrescentadas ao final. O número de cada decisão é estável e é o que todo outro documento desta fase
cita; renumerar para forçar ordem ascendente teria invalidado essas referências sem ganho real.

---

## D-1 — `Action` é a única autoridade de escrita; `risk_treatment_actions` vira linha de ligação explícita

**Decisão** (D-R1): `Action` (`grc/action`) passa a possuir título, descrição,
`responsibleUserId`, `dueOn`, status, `completedAt/By`, `reopenedAt/By`, `reopenReason`. Nenhuma
outra tabela guarda esses campos para uma ação de tratamento de risco depois da migração.
`risk_treatment_actions` **mantém** seu nome e **toda** linha e `id` existentes — a continuidade de
auditoria depende disso: linhas de `audit_event` com `entity_type='RISK_TREATMENT_ACTION'` apontam
para esses ids e precisam continuar resolvendo. Depois da migração, a tabela carrega apenas: `id`,
`risk_id` (FK), `treatment_decision_id` (FK, anulável), `action_id` (FK, NOT NULL, UNIQUE),
`created_at`, `updated_at`. As colunas removidas são: title, description, responsible_user_id,
due_on, status, completed_at.

**Por que a tabela sobrevive, e não desaparece**: `treatmentDecisionId` referencia
`RiskTreatmentDecision`, que vive em `modules/risk`. `grc/**` não pode importar `modules/**`
(ADR-016, aplicado por lint — verificado em `apps/api/eslint.config.mjs`, a regra que nega
`grc-* -> module-*` de forma explícita). Portanto o vínculo com a decisão de tratamento não pode se
mudar para dentro de `Action`. A tabela remanescente é exatamente a "tabela de ligação explícita e
nomeada" que CLAUDE.md §19.3 exige quando dois domínios GRC se relacionam com significado próprio —
não uma sobra de migração incompleta.

**Alternativas rejeitadas**:
- *Apagar `risk_treatment_actions` por completo e mover `treatmentDecisionId` para `Action` como
  coluna opcional* — rejeitada porque `Action` vive em `grc/`, e uma FK de `grc/action` para
  `modules/risk`'s `RiskTreatmentDecision` violaria a fronteira ADR-016 sem alternativa: o núcleo GRC
  não pode depender de um tipo cujo dono é um módulo de negócio.
- *Renomear a tabela para algo mais genérico ("RiskTreatmentActionLink")* — rejeitada por não haver
  necessidade funcional, e por FR-002/§19.3 já pedirem exatamente uma tabela de ligação nomeada, que
  a tabela atual, com as colunas certas, já é.

**Consequências aceitas**: uma tabela que antes era a entidade completa passa a ser só um vínculo.
Todo código que hoje lê `risk_treatment_actions` como fonte de verdade de status, prazo ou
responsável precisa ser reescrito para ler `Action` através do `action_id`.

---

## D-2 — A identidade exposta pelas rotas de ação de tratamento de risco passa a ser `Action.id`

**Decisão** (D-R2): `GET/POST /risks/{riskId}/treatment-actions` e
`PATCH /risks/{riskId}/treatment-actions/{actionId}` passam a endereçar a `Action` compartilhada
pelo seu próprio id. O parâmetro de caminho do contrato já se chama `actionId` — não é preciso mudar
o nome do parâmetro, só o que ele identifica.

**Por que não `RiskTreatmentAction.id`**: ter duas identidades para um único item de trabalho é
exatamente a duplicação que esta convergência existe para eliminar. E o banco de desenvolvimento já
contém três linhas de `Action` com `originType=RISK_TREATMENT` e nenhuma linha de vínculo — criadas
por `POST /actions` diretamente — que são hoje **invisíveis** a toda tela de Riscos, resumo,
bandeira de registro e indicador do painel. Ler a listagem a partir de `actions`, filtrando por
origem, torna essas três visíveis, que é o comportamento correto.

O vínculo passa a ser **opcional**: ausente para uma ação criada por `/actions`, presente para uma
criada pela tela de Riscos ou que carregue `treatmentDecisionId`. Definir `treatmentDecisionId` pela
rota de Riscos faz *upsert* da linha de vínculo.

**Alternativas rejeitadas**:
- *Manter `RiskTreatmentAction.id` como identidade pública e mapear internamente para `Action.id`* —
  rejeitada porque preserva a duplicação de identidade, só a esconde atrás de um mapeamento; as três
  ações órfãs continuariam sem `RiskTreatmentAction.id` nenhum para expor.
- *Gerar uma `RiskTreatmentAction` para as três ações órfãs, retroativamente, para que toda `Action`
  de origem `RISK_TREATMENT` tenha vínculo* — rejeitada por criar histórico fabricado: essas três
  ações nunca passaram pela tela de Riscos, e fingir que passaram (`created_at` sintético, vínculo
  sem evento correspondente) contradiz CLAUDE.md §2 ("não fabricar justificativas históricas").

**Consequência registrada como mudança de contrato deliberada, não como quebra silenciosa**: não há
consumidor externo da API (instalação única, v1) — ver spec.md Assumption A-2.

---

## D-3 — Uma única política de transição, em todo caminho de produção

**Decisão** (D-R3): `assertLegalActionTransition` + `assertReopenReasonProvided` passam a controlar
**toda** escrita de status, incluindo a rota de Riscos. Os 11 pares hoje aceitos pela rota de Riscos
e que a tabela de legalidade de `Action` recusaria — inclusive ressuscitar uma ação `CANCELLED` e
saltar de `OPEN` direto para `COMPLETED` — passam a retornar `422`.
`UpdateRiskTreatmentActionRequest` ganha `reopenReason` (obrigatório quando `status: OPEN` reabre uma
ação `COMPLETED`); o contrato ganha `422` nessa operação.

`MirrorActionStatusFromOriginUseCase`, `MirrorActionFieldsFromOriginUseCase`,
`ActionRepositoryPort.mirrorTransition` e `.mirrorFieldUpdate` são **removidos** — deixam de existir,
não apenas de ser chamados. `mirror-action-status-from-origin.usecase.ts`'s próprio cabeçalho já
documenta, honestamente, que realiza uma "escrita de espelho SEM checagem" (F-36) — essa é
precisamente a lacuna que esta decisão fecha.

**Alternativas rejeitadas**:
- *Manter o espelho, mas fazê-lo chamar `assertLegalActionTransition` antes de escrever* — rejeitada
  porque manteria dois caminhos de escrita para a mesma tabela (`Action`), um vindo de
  `TransitionActionUseCase` e outro do espelho, com todo o risco de os dois divergirem de novo no
  futuro (a classe de defeito que F-42 já nomeou: "uma mecânica em dois lugares"). Eliminar o espelho
  e fazer a rota de Riscos chamar o mesmo caso de uso de `Action` fecha a divergência de raiz, em vez
  de apenas told-a-igualdade neste instante.
- *Deixar a janela de coexistência (F-36) como está, aceitando o risco até o módulo de Incidentes*
  — rejeitada porque o próprio roadmap (CLAUDE.md §17, `docs/architecture/grc-roadmap.md` Fase 6)
  proíbe começar Incidentes sem fechar esta convergência primeiro.

**Consequência aceita e nomeada**: valores históricos de `Action.reopenReason` que hoje carregam a
frase fixa que o espelho escrevia são **história** e nunca são reescritos.

---

## D-4 — A autorização permanece do lado da origem, na rota de Riscos

**Decisão** (D-R4): a rota de Riscos mantém `risk:view`/`risk:treat` como sua autorização. Ela
chama `CreateActionUseCase`, `UpdateActionUseCase` e `TransitionActionUseCase` diretamente; cada um
já re-deriva o escopo organizacional **vivo** da origem através de `assertActionOriginInScope` —
essa re-derivação é a própria decisão de acesso, não uma checagem adicional. `/actions` mantém
`action:view|create|edit`.

**Alternativas rejeitadas**:
- *Exigir também `action:edit` na rota de Riscos* — rejeitada por misturar duas autoridades
  distintas: um gestor de riscos que nunca recebeu autoridade sobre o módulo de Ações genérico não
  deveria precisar dela para tratar seus próprios riscos, e vice-versa.
- *Unificar as duas autoridades numa permissão só* — rejeitada porque US1 cenário 4 e o próprio D-R4
  exigem prova de que as duas seguem distintas: um usuário só com `risk:treat` é recusado em
  `/actions`, e um usuário só com `action:edit` é recusado na rota de Riscos.

**Prova exigida**: testes de contrato cobrindo os dois sentidos da recusa, não apenas o sucesso.

---

## D-5 — Eventos de auditoria seguem as linhas realmente escritas; `GET /risks/{riskId}/history` fica **inalterado**

**Decisão original** (D-R5): criar uma ação pela rota de Riscos grava dois eventos
(`risk.treatment_action_created`, entidade `RISK_TREATMENT_ACTION`, para a linha de vínculo; e
`action.created`, entidade `ACTION`). Mudar status ou campo pela rota de Riscos grava **apenas** o
evento `action.*` correspondente — o par duplicado `risk.treatment_action_status_changed` /
`risk.treatment_action_updated` é retirado dessas operações. Mudar `treatmentDecisionId` grava
apenas `risk.treatment_action_updated` (a linha de vínculo mudou). `AuditEntityType.RISK_TREATMENT_ACTION`
permanece no enum para o histórico; linhas antigas não são tocadas.

**Correção do coordenador, feita durante esta mesma fase de especificação, depois de ler o código
diretamente**: a formulação original de D-R5 também afirmava que "`GET /risks/{riskId}/history` deve
continuar mostrando este trabalho: agora inclui os eventos ACTION". Essa frase está **errada nas
duas metades**. `apps/api/src/modules/risk/infrastructure/risk-history.service.ts`, verificado nas
linhas 314 e 336, lê apenas `entity_type = 'RISK'` e `entity_type = 'RISK_ASSESSMENT'` — o endpoint
**nunca**, em nenhuma versão já existente, incluiu eventos de ação de tratamento. Não há nada a
"continuar mostrando", e passar a incluir eventos `ACTION` seria comportamento **novo**, não
remediação de uma regressão. `spec.md` FR-007/FR-007a registra o endpoint como inalterado por esta
fase; a pergunta "o histórico de um risco deveria mostrar o trabalho de ação?" fica na cauda de
`matrix.md` como questão de produto para uma fase futura, com esta mesma citação de linha.

**Por que `AuditEntityType.RISK_TREATMENT_ACTION` continua no enum, e por que essa é a razão certa**:
verificado que nenhum código em `apps/api/src` nem em `apps/web/src` lê hoje essas linhas para
exibição — não existe consumidor vivo. A razão de preservá-las não é "alguém as usa"; é a
Constituição, Princípio XV ("mudanças NÃO PODEM alterar retroativamente o significado de dados de
GRC ou de auditoria já registrados"). Um leitor futuro que veja "nenhum consumidor lê isto" não deve
concluir que a coluna pode ser apagada — a garantia é constitucional, independente de uso.

**Alternativas rejeitadas**:
- *Adicionar os eventos `ACTION` ao histórico do risco nesta mesma fase, já que a informação passa a
  existir* — rejeitada explicitamente pelo coordenador: é uma melhoria de produto genuína, mas não é
  remediação de nada que esteja quebrado, e introduzi-la em silêncio dentro de uma fase de
  saneamento contradiz CLAUDE.md §16 (não implementar a partir de uma ideia informal, sem
  especificação própria).
- *Remover `RISK_TREATMENT_ACTION` do enum por não ter consumidor* — rejeitada pela mesma
  Constituição, Princípio XV, e porque PostgreSQL não tem `ALTER TYPE ... DROP VALUE` — a remoção
  não é sequer mecanicamente simples.

---

## D-6 — Forma da migração

**Decisão** (D-R6): migração única, sem retrocesso funcional, aditiva-depois-destrutiva, nesta
ordem, com os `DROP` por último:
1. Backfill de uma `Action` para toda linha de `risk_treatment_actions` com `action_id IS NULL`,
   preservando título/descrição/responsável/prazo/status/`completedAt` e `created_at`; origem
   `(RISK_TREATMENT, risk_id)`; `org_unit_id` = unidade **atual** do risco (mesma regra que
   `RiskActionOriginAccessor` já aplica em runtime); `code` gerado para o **ano da própria
   `created_at` da linha**, não o ano corrente, para não deslocar a data do registro.
2. Verificar: zero `action_id IS NULL`; `action_id` único; igualdade linha a linha das seis colunas
   entre cada vínculo e sua ação.
3. Adicionar `NOT NULL` + `UNIQUE` em `action_id`; remover as seis colunas e os três índices que as
   referenciavam; adicionar índice em `risk_id`.

**Plano de recuperação**: todo valor removido já está presente em `actions` — as consultas de
verificação do passo 2 são a prova, e precisam estar no comentário da própria migração e em
`data-model.md`.

**Achado desta fase, dependente da migração**: `prisma/seed/performance.seed.ts` escreve
`risk_treatment_actions` via `createMany` (linha 681), contornando o caso de uso — precisa passar a
criar a `Action` correspondente também.

**Alternativas rejeitadas**:
- *Duas migrações separadas (uma para o backfill, outra para o `DROP`)* — rejeitada por permitir um
  estado intermediário em produção onde a verificação do passo 2 nunca rodou antes de alguém aplicar
  o `DROP` de uma branch diferente. Uma migração única, com a verificação como passo obrigatório no
  meio, torna essa sequência impossível de pular.
- *Atribuir `org_unit_id` do backfill como a unidade do risco **no momento em que a ação de
  tratamento foi criada*** (reconstrução histórica) — rejeitada por não existir coluna nenhuma que
  registre a unidade do risco por instante; a única unidade disponível é a atual, que é também a
  regra que `RiskActionOriginAccessor` já aplica hoje em runtime para qualquer ação derivada de
  risco. Manter as duas fontes (backfill e runtime) na mesma regra evita uma terceira divergência.

---

## D-7 — Uma política de vencimento, um "hoje" — e onde ela mora, para sobreviver às regras de fronteira de D-10

**Decisão** (D-R7, com a forma refinada abaixo): existe **uma** política de vencimento de ação, com
um único dono por peça, desenhada para satisfazer ao mesmo tempo a fronteira estreitada de D-10
(`modules/* -> grc/*` restrita a `domain`/`application` para arquivo que não seja de composição) e a
regra de que `shared/**` permanece folha (não pode hospedar uma regra de domínio do núcleo GRC).

- **Um conjunto de status, um relógio, um predicado TypeScript**, em
  `apps/api/src/grc/shared/domain/overdue.service.ts`. `OVERDUE_ELIGIBLE_ACTION_STATUSES` — hoje
  privado — passa a ser **exportado**. `todayDateOnlyUtc()` e
  `isActionOverdue(dueOn, status, referenceDate)` (data de referência obrigatória, sem padrão)
  continuam ali e são as únicas cópias do repositório. Por ser `grc-domain`, todo `module-*` já pode
  importá-lo sem exceção nenhuma de lint — D-10 permite `module-* -> grc-domain` sem restringir.
- **Um único auxiliar de fragmento SQL**, arquivo novo
  `apps/api/src/modules/risk/infrastructure/overdue-action-sql.ts`, construído **a partir** do
  conjunto de status exportado acima, nunca reescrevendo-o. Seus dois consumidores são
  `risk-query.service.ts` (a coluna `overdue_treatment` e o filtro `overdueTreatment`, os dois) e
  `dashboard-query.service.ts` (as duas consultas). É infraestrutura, e fica do lado de
  infraestrutura — exatamente onde seus dois consumidores já vivem.
- `grc/action/infrastructure/prisma-action.repository.ts` constrói seu `where` do Prisma a partir do
  **mesmo** conjunto exportado, e apaga sua própria cópia local do conjunto e de
  `todayDateOnlyUtc()` (confirmada nas linhas 260-263 desse arquivo).
- `modules/risk/domain/risk-overdue.ts` mantém apenas `isOverdueReview` (regra genuinamente
  diferente, sem porta de status), importa `todayDateOnlyUtc` do núcleo, e perde seu parâmetro
  padrão. `isOverdueTreatmentAction` é removido junto com a coluna que lia.
- **Testes de equivalência** exigidos: as três formas — TypeScript puro, SQL bruto, `where` do
  Prisma — precisam concordar para ontem/hoje/amanhã, nos quatro status. É isso que torna "uma
  política" uma garantia, em vez de três pontos de chamada que hoje coincidem por acaso.

**Custo aceito, registrado explicitamente, não escondido como grátis**: `modules/risk/infrastructure`
passa a emitir SQL contra a tabela `actions`, uma leitura através de uma fronteira de domínio. Lê
apenas `origin_type`, `origin_id`, `status` e `due_on`, e o faz porque o registro de riscos precisa
filtrar, ordenar e paginar por essa bandeira **dentro de uma única consulta** — a Constituição,
Princípio XI, proíbe conjunto de resultado sem limite e padrão N+1, o que uma segunda consulta em
memória para juntar os dois lados violaria.

**Alternativas rejeitadas**:
- *Manter a cópia em `prisma-action.repository.ts` e só documentar que ela deve ficar em sincronia
  com `overdue.service.ts`* — rejeitada: é exatamente o padrão que F-24 já nomeou como "regra
  reforçada por revisão, não por construção", que apodrece assim que alguém para de olhar. Uma
  função importada não pode divergir; um comentário pode.
- *Carregar todas as ações em memória para reaproveitar a função TypeScript em vez de escrever um
  fragmento SQL* — rejeitada por violar a Constituição, Princípio XI, e por já ser exatamente o
  anti-padrão que `docs/history/implementation-debt-review.md` C2 nomeia como proibido ("não carregar todos os
  registros em memória para reutilizar uma função TypeScript").
- *Um porte em `shared/grc-ports` devolvendo os ids de risco com ação atrasada, em vez de SQL direto
  em `modules/risk/infrastructure`* — considerada e rejeitada: esse porte devolveria uma lista sem
  limite, para alimentar uma cláusula `IN (...)` do lado de quem chama — o mesmo padrão sem limite
  que a Constituição, Princípio XI, já proíbe, só deslocado para depois da chamada ao porte em vez de
  dentro da consulta. A leitura direta contra `actions`, restrita às quatro colunas citadas acima e
  dentro de uma única consulta paginada, é o custo estrutural aceito — não a alternativa livre de
  custo.

**Invariante que a convergência precisa preservar, nomeada para não virar bug silencioso de
escopo**: o escopo organizacional de uma ação de tratamento de risco é decidido pela unidade
organizacional **atual** do risco, nunca por `Action.orgUnitId`. `Action.orgUnitId` é um retrato
tirado no momento da criação; `grc/action/application/assert-action-origin-in-scope.ts` já existe
precisamente porque esse valor guardado pode ficar desatualizado quando um risco é reatribuído a
outra unidade, e re-deriva a unidade viva da origem em toda escrita. O caminho de leitura precisa
concordar com o caminho de escrita — por isso as duas consultas do painel
(`dashboard-query.service.ts`, `getOverdueActions` e `getTreatmentActionsSummary`, hoje ligando
`risk_treatment_actions` a `risks` e aplicando `scopeFragment(scope)` contra a linha do **risco**) e
o fragmento `EXISTS` do registro (`risk-query.service.ts:410`, que já correlaciona por `r.id`)
continuam escopando pela linha do risco depois de repontar para `actions` — o `JOIN` passa a ser
`actions a ON a.origin_id = r.id AND a.origin_type = 'RISK_TREATMENT'`, com o predicado de escopo
inalterado, ainda sobre `r`. Uma consulta que escopasse por `a.org_unit_id` em vez disso compilaria,
passaria em todo teste hoje existente, e mostraria ou esconderia a linha errada, silenciosamente,
depois da primeira reorganização — nomeado aqui para que o próximo leitor não confunda isto com uma
escolha de desempenho.

---

## D-8 — `api-types` cobre os dez contratos; namespace por documento permanece

**Decisão** (D-R8): `packages/api-types/scripts/generate.mjs` passa a listar os dez documentos
(hoje lista cinco: Auth, Admin, Platform, Risks, GrcFoundation — confirmado em `DOCUMENTS`, linhas
51-61 do gerador). Namespaces continuam **um por documento**: `UserRef` tem cinco formas realmente
diferentes entre documentos, `OrgUnitRef` tem duas famílias, e `VersionConflictProblem` difere tanto
nos campos obrigatórios quanto no enum que referencia. Fundir namespaces tiparia incorretamente um
consumidor em silêncio.

Os arquivos gerados commitados estão **desatualizados** no HEAD medido (uma regeneração simples já
altera admin/grcfoundation/risks/platform). Regenerar e commitar. Acrescentar um portão de CI que
regenera e falha se a árvore de trabalho sob `packages/api-types/src` ficar suja — o que hoje não
existe em nenhum job.

Provar que o pacote resolve através do seu artefato **construído**, não apenas pelo *path alias* do
workspace (F-19).

**Alternativas rejeitadas**:
- *Um namespace único, com os tipos homônimos renomeados por prefixo de domínio* — rejeitada porque
  ainda exigiria decidir, campo a campo, qual das cinco formas de `UserRef` é "a" forma, quando na
  verdade nenhuma é: são cinco formas legitimamente diferentes que a API envia em contextos
  diferentes.
- *Gerar a partir do documento refletido pelos decorators do Nest* (`apps/api/openapi.json`) em vez
  dos YAML autorados à mão — rejeitada porque `docs/local-environment.md` D-14 e F-3 já registraram
  por que o documento refletido não é autoritativo: sem `@ApiProperty`, ele descreve rotas, não
  campos.

---

## D-9 — Um validador real de payload contra contrato, sobre o harness de contrato já existente

**Decisão** (D-R9): novas dependências de desenvolvimento em `apps/api`, justificadas: `ajv`
(dialeto 2020-12), `ajv-formats`, `yaml`. Todas MIT/ISC, onipresentes, sem ferramenta específica de
OpenAPI que possa ficar desatualizada por conta própria. Como os esquemas de componente de OpenAPI
3.1 **são** JSON Schema 2020-12, o `ajv` os valida diretamente, com resolução interna de `$ref`;
nenhum *dereferencer* separado é necessário.

Liga-se em `test/contract/support/contract-app.ts` mais `supertest` — não é um segundo framework.
Precisa cobrir sucesso **e** `application/problem+json`, obrigatório versus opcional, enums e
nulidade, e **excluir explicitamente** endpoints sem corpo e downloads binários — o inventário diz
quais.

**O buraco que isto fecha, dito de forma concreta**: renomear um campo de resposta hoje passa por
`openapi:check` (os esquemas refletidos são todos objetos vazios, F-3/D-14) e por
`contract-coverage.spec.ts` (que só verifica existência de rota — confirmado: esse arquivo usa um
scanner de linha escrito à mão, deliberadamente, porque nenhum parser YAML é dependência de
`apps/api` hoje, só de `packages/api-types`). O `yaml` novo é precisamente o que falta para ler os
esquemas de componente sem repetir esse scanner.

**Alternativas rejeitadas**:
- *Escrever o próprio validador de schema, à mão, como o scanner de `contract-coverage.spec.ts` já
  faz para operações* — rejeitada: um scanner de linha basta para "esta rota existe", mas validar
  tipo, enum, formato e obrigatoriedade de um schema JSON recursivo é reimplementar um validador de
  JSON Schema, exatamente o tipo de abstração que `ajv` já resolve, testada e mantida.
- *Uma ferramenta de teste de contrato dedicada (Dredd, Schemathesis, Prism)* — rejeitada por
  introduzir um segundo framework de teste de API, quando o harness de contrato existente
  (`contract-app.ts` + `supertest`) já cobre a parte de fazer a requisição; só falta a parte de
  validar a resposta contra o schema, que `ajv` resolve sem framework adicional.

**Nota de desenho, verificada contra os dez documentos, não presumida**: nenhum dos dez contratos usa
`discriminator` em lugar nenhum, e as únicas anotações que não são palavras-chave de JSON Schema
presentes são `example` e `examples`. É exatamente isso que torna um validador de JSON Schema puro
(`ajv`) viável aqui sem um *dereferencer* específico de OpenAPI — se algum contrato futuro introduzir
`discriminator` (para um `oneOf` polimórfico, por exemplo), esta decisão precisa ser reexaminada
contra esse fato novo, não contra a suposição de que "provavelmente continua simples".

**Achado bloqueante, encontrado ao preparar esta mesma decisão para execução — ver D-21**: um dos dez
contratos usa uma sintaxe de nulidade que o OpenAPI 3.1 não reconhece, o que faria o validador
recusar payloads legítimos antes mesmo de cobrir o primeiro caso de uso real.

---

## D-10 — Classificação de fronteira para arquivos de composição

**Decisão** (D-R10): novo tipo de elemento `composition` para `src/*.ts` (`app.module.ts`,
`main.ts`, `permission-catalogue.ts`) e `src/{core,grc,modules}/*/*.module.ts` (incluindo
submódulos como `control-directory.module.ts`). Confirmado em `apps/api/eslint.config.mjs`: os 14
tipos de elemento hoje classificados (`shared`, `infrastructure`, quatro camadas de `core-*`, quatro
de `grc-*`, quatro de `module-*`) não casam com nenhum desses arquivos — a regra de fronteiras nunca
é avaliada para eles. Um *composition root* PODE importar qualquer camada de qualquer área — é
literalmente o seu trabalho — e precisa estar explicitamente permitido, ou a ligação de DI quebra.

Habilitar `boundaries/no-unknown-files`, para que um arquivo futuro que não case com nada falhe em
vez de ficar silenciosamente isento.

Estreitar `modules/* -> grc/*` para arquivos que **não** sejam de composição: apenas `domain` e
`application`. Os cinco módulos que hoje importam classes concretas de `grc/shared/infrastructure`
fazem isso exclusivamente a partir de seu próprio `*.module.ts`, que o novo tipo `composition` cobre.

**Achado novo desta fase, fora de F-25**: `grc/<capacidade>` não tem isolamento mútuo, ao contrário
de `modules/<nome>`. Confirmado lendo `eslint.config.mjs` linhas 231-251: as políticas de
`grc-domain`/`grc-application`/`grc-infrastructure`/`grc-presentation` **não** templatizam a captura
de `capability` de volta (ao contrário das políticas `module-*`, que fazem
`captured: { module: '{{from.element.captured.module}}' }`) — então `grc/finding` já pode importar
livremente `grc/evidence` em qualquer camada, incluindo `infrastructure` e `presentation`, hoje.
**Decisão**: capacidades `grc/` PODEM importar `domain` e `application` umas das outras (são um
único núcleo compartilhado, e `grc/finding` já importa legitimamente o porte de `grc/evidence` —
`close-finding.usecase.ts:75` importa `evidence-link-repository.port.ts`), mas NÃO PODEM importar a
`infrastructure` ou a `presentation` umas das outras.

**Prova exigida**: controles positivo e negativo, e um nome de módulo que não esteja em lista fixa
nenhuma.

**Alternativas rejeitadas**:
- *Permitir tudo de composição para tudo, sem tipo próprio, apenas isentando esses arquivos da
  regra* — rejeitada: isentar é abrir mão de qualquer proteção nesses arquivos, exatamente o ponto
  cego que F-25 já descreveu como "o pior possível" — o lugar onde um segundo módulo mais provavelmente
  erra primeiro.
- *Isolar `grc/` capacidades umas das outras como `modules/` já é isolado* — rejeitada: `grc/` é
  deliberadamente um núcleo compartilhado (ADR-016); domínio↔domínio entre capacidades é o desenho
  aceito e já tem um consumidor real (`grc/finding` → `grc/evidence`). Isolamento total repetiria a
  caixa genérica que CLAUDE.md §19.3 proíbe do lado oposto: forçaria uma capacidade a duplicar o que
  a outra já expõe.

---

## D-11 — Saneamento de Controles (C5)

**Decisão** (D-R11): `ControlRegistryPort`, `PrismaControlRegistryRepository` e a ligação em
`risk.module.ts` (confirmadas nas linhas 61, 80 e 198 desse arquivo) estão mortos: remover. Provar
que o contêiner Nest continua subindo e que o caminho de vínculo de controle continua funcionando.

Consolidar **apenas** o `findOrgUnitIdUnscoped` byte-idêntico em `ControlScopedRepository`. **Não**
fundir `ControlLookupPort` em `ControlRepositoryPort` — isso colocaria um `include` completo mais um
cálculo de efetividade em toda checagem de escopo de vínculo/avaliação, um custo que nenhuma dessas
checagens precisa pagar.

**Dívida nova confirmada nesta fase, da mesma natureza de F-46/F-49**:
`ControlAssessmentRepository.listAssessmentIdsInScope` (linhas 152-154, confirmadas por leitura
direta) decide quais linhas um chamador pode ver através de um JOIN até `control.orgUnitId`. A
própria regra já ratificada em AGENTS.md diz "carregar o escopo organizacional em toda tabela
escopada, mesmo quando derivável por relação; autorização nunca deve depender de um JOIN". Correção
aditiva: desnormalizar `org_unit_id` em `control_assessments`, preenchido por backfill a partir do
controle, mantido em sincronia com a unidade do controle, usando o auxiliar de escopo compartilhado.

Acrescentar o teste comportamental de Controle→Ativo fora de escopo, que falta — seu irmão
Controle→Processo já o tem.

**Alternativas rejeitadas**:
- *Fundir `ControlLookupPort` em `ControlRepositoryPort` para eliminar a duplicação de vez* —
  rejeitada explicitamente: o `SELECT` estreito de `ControlLookupPort` existe precisamente para não
  pagar o custo de um agregado completo em todo ponto de checagem de escopo; fundir os dois porte
  tornaria a checagem mais cara sem necessidade.
- *Deixar `ControlAssessmentRepository` como está, documentando o JOIN como aceitável* — rejeitada:
  a regra de AGENTS.md já é ratificada e não tem exceção documentada para este caso; documentá-la
  como aceita aqui seria reabrir uma regra já fechada, não aplicá-la.

---

## D-12 — F-26 medido, e a correção segue em frente (Frente F, medida)

**Decisão original** (D-R12): medir primeiro, no nível do provedor **e** sobre HTTP real, em
tamanhos realistas, muitas iterações, relatando honestamente o que foi e não foi demonstrado.

**Medição, concluída** (D-R20). No nível do provedor (250 iterações por ramo, por tamanho,
reprodução fiel da E/S de `put`): os dois ramos **não se sobrepõem em nenhum tamanho testado**. O
mínimo do ramo "conteúdo novo" menos o máximo do ramo "já armazenado" é +0,38 ms a 64 KiB, +0,67 ms
a 1 MiB e +5,44 ms a 8 MiB — **uma única observação** já separa os dois casos. A premissa de F-26
está confirmada, não apenas plausível.

Sobre HTTP real, do ponto de vista genuíno de um atacante (20 pares de tentativa por tamanho,
autenticado, contra a API em execução): a diferença média é 0,19 ms a 64 KiB, 0,02 ms a 1 MiB e
**9,50 ms a 8 MiB**. Em tamanhos pequenos, a transferência multipart, o hash, o roteamento, a
inserção de linha e a escrita de auditoria são pagos nos dois ramos e afogam a diferença — seriam
necessárias ~10.600 amostras a 64 KiB e ~647.000 a 1 MiB para separar os dois casos a três desvios
padrão, o que o próprio limitador de taxa da plataforma (100 requisições/60s) torna impraticável. A
8 MiB, o piso compartilhado é ~56 ms mas a diferença é grande o bastante para que **N seja
aproximadamente 39 para três desvios padrão e aproximadamente 5 para um** — dezenas de pares de
requisição, confortavelmente dentro do limite de taxa, em menos de um minuto.

**Decisão final: a partição segue em frente.** O canal é praticamente explorável perto do teto de
25 MiB — exatamente onde evidência de GRC vive. Registrado honestamente nas duas direções: o caso de
arquivo grande está demonstrado; o caso de arquivo pequeno **não foi mostrado explorável, e também
não foi mostrado seguro** — a medição só mostra que está enterrado abaixo do que vinte pares de
amostra resolvem nesta máquina, sob esta carga.

**Correção**, como avaliada: `FileStorageProvider.put` passa a receber o id da unidade
organizacional; `UploadService.execute` é seu **único** chamador e já segura
`parentAccess.organizationalUnitId`, resolvido no servidor, exatamente naquela linha.
`Attachment.checksumSha256` **não muda** — é o checksum de conteúdo, não a chave. Chaves históricas
`sha256/...` continuam resolvendo, porque `get` lê a chave gravada na própria linha; nenhum backfill,
nenhuma rechave, nenhum blob apagado. `FileStorageProvider.delete` não tem chamador em produção,
então não há risco de contagem de referência.

**Duas coisas que a implementação PRECISA acertar, nomeadas para o registro**:
- `ParentRecordAccess.organizationalUnitId` é tipado `string | undefined`. Um escopo indefinido
  recebe seu **próprio** compartimento explícito — nunca pode cair silenciosamente no prefixo legado
  sem escopo, nem no compartimento de outro ator.
- **O residual, nomeado, não escondido**: particionar fecha o oráculo **entre** escopos, não o
  **dentro** de uma mesma unidade organizacional. Alcançar o ponto de medição já exige acesso de
  leitura a alguma entidade do tipo declarado naquela unidade, e esta plataforma escopa visibilidade
  por unidade, não por registro individual — então o residual não atravessa uma fronteira que já é
  imposta em outro lugar. É mais estreito, não inexistente. A mudança precisa dizer isto sobre si
  mesma, não apresentar-se como fechamento total.

**Alternativas rejeitadas**:
- *Corrigir sem medir, por precaução* — rejeitada: F-26 foi registrado explicitamente como "raciocinado
  pelo caminho do código, não medido"; gastar uma migração de armazenamento inteira antes de saber se
  a diferença de tempo é sequer observável na prática inverteria a prioridade que o próprio achado já
  nomeou. A medição confirmou que valia a pena — mas a ordem importava.
- *Migrar (reescrever) as chaves antigas para o novo prefixo* — rejeitada por ser destrutiva sem
  necessidade: convivência de dois esquemas de chave é suficiente, e reescrever seria risco sem
  ganho de segurança adicional.
- *Apresentar a correção como fechamento total do oráculo* — rejeitada: o residual dentro da mesma
  unidade é real e precisa estar no registro da própria mudança, não apenas neste documento de
  pesquisa.

---

## D-13 — Atribuição de auditoria no login, pelo caminho já existente (V2, achado confirmado)

**Decisão** (D-R13): medido diretamente — `session.created` tem `actor_user_id` e `session_id`
nulos em 1466 de 1466 linhas, incluindo um login que o coordenador executou em 2026-09-10 22:34:53.
`ip_address`/`user_agent` **estão** populados, então o contexto de requisição existe; falta apenas o
enriquecimento de ator/sessão, porque login é `@Public()` e `SessionGuard` nunca roda nele. Corrigir
enriquecendo o contexto a partir da identidade resolvida pelo servidor, no próprio caminho de login,
através do `RequestContextEnricherPort` **já existente** (confirmado:
`core/sessions/domain/ports/request-context-enricher.port.ts`, com adaptador em
`core/sessions/infrastructure/request-context-enricher.adapter.ts`, hoje usado por `SessionGuard`).
Nunca a partir de um id fornecido pelo cliente. Nenhuma linha histórica é reescrita.
`session.expired` é decisão separada — ver abaixo.

**Decisão sobre `session.expired`**: fica **fora do escopo desta fase**. A causa raiz medida é
específica do login (`@Public()`, guarda nunca roda) — uma rota que já passa por `SessionGuard`
(qualquer rota autenticada, de onde uma expiração é detectada) já tem o contexto enriquecido pelo
mesmo mecanismo, então não há razão para supor o mesmo defeito ali sem medir separadamente. Medir
`session.expired` da mesma forma que `session.created` foi medido é tarefa desta mesma frente
(`tasks.md`), mas a correção, se houver, é decidida com a medição em mãos — não presumida aqui.

**Alternativas rejeitadas**:
- *Fazer `SessionGuard` rodar também na rota de login* — rejeitada: login é `@Public()` por
  desenho — não existe sessão prévia para o guard validar antes do login acontecer. O guard não pode
  rodar antes de a sessão existir; o enriquecimento precisa acontecer depois da criação, no mesmo
  caminho que já cria a sessão.
- *Inferir a identidade a partir de um id enviado pelo cliente no corpo do login* — rejeitada
  categoricamente: violaria a regra "identidade vem do contexto do servidor, nunca da entrada do
  cliente" (CLAUDE.md §19.9, aplicável por analogia a qualquer atribuição de auditoria, não só IA).

---

## D-14 — F-18 recategorizado, F-40 fechado

**Decisão** (D-R14): F-18 não reproduz como estava escrito: os mapeadores de apresentação emitem
`null` explícito, que **está** presente no corpo JSON. Recategorizado para "os arrays obrigatórios do
contrato subdeclaram uma garantia que a implementação já entrega" — a alegação de insegurança de
tipo original é fechada. F-40 está resolvido nos dois arquivos consumidores — marcar.

**Alternativas rejeitadas**:
- *Manter F-18 como estava, e apenas anotar "revisado"* — rejeitada: um achado cuja premissa central
  (o campo não existe no corpo) está factualmente errada precisa de recategorização, não de uma
  anotação lateral — do contrário um leitor futuro continua acreditando na alegação original.

---

## D-15 — Corrigir o registro de áreas planejadas do painel: Controles já não é planejado (achado novo desta fase)

**Contexto, medido contra a aplicação em execução**: `GET /api/v1/dashboard` responde
`plannedAreas: [{PROBLEMS, PLANNED}, {INCIDENTS, PLANNED}, {CONTROLS, PLANNED}]`. O módulo de
Controles está em produção desde a Fase 2 (`specs/003-controls-management/`, commit `9912968`). O
registro está em `apps/api/src/core/dashboard/domain/default-planned-areas.ts`, que hardcoda as três
chaves como planejadas, e `get-dashboard-planned-areas.spec.ts` fixa esse conjunto errado como
esperado — o teste protege o defeito, não o comportamento correto.

**Decisão**: remover `CONTROLS` do registro padrão de áreas planejadas e atualizar o teste unitário
correspondente. Cartões reais do painel para Controles, Conformidade, Auditoria, Ativos e Processos
— o trabalho de fato mostrar dados desses domínios no painel — é da Fase 7 do roadmap (Indicadores e
Relatórios), registrado na cauda de `matrix.md`, não desta correção. Esta decisão só para de anunciar
como planejado o que já foi entregue; não constrói cartão nenhum.

**Alternativas rejeitadas**:
- *Substituir `CONTROLS` por um cartão real do painel nesta mesma fase* — rejeitada: seria avançar
  roadmap (Fase 7) dentro de uma fase de saneamento, o que CLAUDE.md §16 proíbe sem a especificação
  própria daquela fase.
- *Deixar como está, por não ser um defeito de segurança* — rejeitada: é uma afirmação falsa
  mostrada a todo usuário do painel GRC, na tela mais visível do produto, sobre uma capacidade que já
  existe — exatamente o tipo de "comentário que registra uma razão e a razão expira" que F-35/F-42
  já nomearam, aqui na interface em vez de num comentário de código.

---

## D-17 — Frente E decidida sobre medição real (D-R15): a aritmética de F-48 estava errada, e a correção é em cinco passos

**Correção de um achado já registrado, que precisa ser dita como correção, não repetida como
estava**: F-48 contava o total de requisições de login (~20) como se cada uma consumisse o limite de
frequência. **Está errado.** Só tentativas que **falham** consomem qualquer uma das duas dimensões do
limitador: `login-throttle.service.ts:139-141` incrementa o contador de origem apenas em falha, e
`recordSuccessfulAttempt` zera o contador de conta a cada sucesso
(`prisma-user-directory.repository.ts:129-134`). Medido: uma execução completa do Chromium custa
**8 tentativas falhas e 14 sucessos, 22 requisições no total**, contra um teto de **20 falhas por
300 segundos**. Uma execução cabe com folga; duas cabem; a terceira, dentro da mesma janela fixa
(a janela conta a partir do primeiro incremento, não é deslizante), estoura. F-48 mediu a grandeza
errada. `matrix.md` registra esta correção contra a linha F-48, com esta mesma evidência — a
cifra antiga não é reafirmada em lugar nenhum deste documento.

**As oito falhas existem por uma razão só**: o auxiliar sempre tenta primeiro a senha **não
rotacionada**, em contas que uma execução anterior já rotacionou. Correção em cinco passos,
**nesta ordem**, porque os dois primeiros são baratos e valem independentemente dos demais:

1. **Tentar primeiro a forma rotacionada, com recuo para a forma simples.** Uma mudança em
   `apps/web/e2e/support/admin-session.ts`. No caso normal (um banco que uma execução anterior já
   tocou), isso custa **zero** falhas em vez de uma por conta; num banco genuinamente novo, custa
   uma. Nenhum limite é elevado, nenhum controle é enfraquecido, nenhum estado é forjado.
2. **Diagnosticar o resultado em vez de afirmar uma string fixa.** `attemptSignIn` hoje colapsa
   `429`, `500`, erro de rede e senha genuinamente errada na mesma asserção ("o texto de credencial
   incorreta está visível") — F-43, ainda presente ao pé da letra. Precisa distinguir os quatro e
   relatar qual viu. Um `429` é reexecutado depois do seu próprio `retry-after`, nunca contornado
   elevando um limite.
3. **Aposentar o pool estático de doze contas, a favor de identidade provisionada por execução,
   através da API real.** AGENTS.md já ratifica isto ("isolamento de E2E vem de fixtures novas
   criadas pela API real, nunca de um pool de conta compartilhado e mutável"); o pool é o que
   produziu a corrida de F-16 e os 37 usuários órfãos de F-34, e seu histórico de rotação é agora o
   que torna o custo de login dependente do estado do banco. Um login de bootstrap por execução
   continua sendo a única semente de confiança; toda outra identidade nasce fresca por
   `/admin/users` e nunca é compartilhada entre workers. Sequenciar **depois** dos passos 1 e 2 —
   eles são baratos e valiosos independentemente deste.
4. **NÃO estender o cache de sessão a `signInAsFixtureUser`/`signInAsSeededUser`.** Todo chamador
   desses dois é a própria jornada de autenticação ou um cenário de concessão, revogação ou
   segregação de funções cujo ponto inteiro é uma sessão que **não** foi reaproveitada. Cachear ali
   converteria "a concessão fez efeito" em "um cookie antigo ainda funciona". O cache do
   administrador de worker permanece como está.
5. **Enquanto o pool ainda existir, proteger a constante duplicada.** `E2E_WORKER_ADMIN_POOL_SIZE`
   está hardcoded duas vezes — `admin-session.ts:286` (computado como 4×3) e `platform.seed.ts:491`
   (um literal separado, 12) — sem import compartilhado e sem teste que garanta que concordam.
   Acrescentar esse teste; removê-lo junto com o pool, quando o passo 3 o aposentar.
6. **Isolar `auth.spec.ts`** para que seu login legitimamente real e legitimamente falho uma vez
   nunca compartilhe janela de contador de origem com o resto da suíte.

**Critério de aceitação**: uma execução completa do Chromium, nos limites locais reais (conta 5,
origem 20, janela 300), um único worker, `retries: 0`, com a contagem de tentativas falhas medida e
relatada — **no máximo duas**. Reexecuções nunca substituem uma correção; nenhum teste é pulado ou
removido para chegar a verde.

**Alternativas rejeitadas**:
- *Aceitar a cifra original de F-48 e apenas isolar `auth.spec.ts`* — rejeitada: teria deixado as
  oito falhas evitáveis (passo 1) e a confusão de diagnóstico (passo 2, que é F-43 ainda aberto) sem
  correção, tratando apenas o sintoma que a aritmética errada tinha mascarado como o problema
  inteiro.
- *Aumentar o limite de tentativas de origem para dar folga* — rejeitada categoricamente: é
  exatamente o que AGENTS.md proíbe ("nunca desativar controle de segurança para um teste passar").

## D-18 — O grafo de CI pode transformar uma falha em um pulo silencioso, estruturalmente

**Achado, medido nesta rodada**: `test-integration`, `test-contract`, `test-e2e` e
`test-e2e-cross-browser` declaram todos as mesmas cinco dependências
(`needs: [lint, format-check, typecheck, test-unit, audit]`). Se qualquer uma dessas cinco fica
vermelha, os quatro jobs a jusante relatam **pulado** (`skipped`), não **falho** — exatamente como
F-33 e F-52 se esconderam, e F-50 é o precedente concreto: o portão de auditoria de dependências
ficou vermelho por advisories e levou os jobs de teste junto. É estrutural ao grafo, não peculiaridade
de um arquivo de spec.

**Decisão**: acrescentar um job final de agregação, com `if: always()`, que depende de todo outro
job e **falha** quando o resultado de qualquer job exigido for qualquer coisa diferente de
`success` — pulado incluído. Esse job passa a ser o único que uma regra de proteção de branch
precisaria exigir. Um job pulado nunca mais se lê como aprovação.

**Alternativas rejeitadas**:
- *Remover a dependência (`needs`) dos quatro jobs, para que rodem mesmo se o portão anterior falhar*
  — rejeitada: rodar testes de integração/contrato/E2E contra um ambiente que não passou lint,
  type-check ou auditoria de segurança desperdiça tempo de execução em uma base já sabida instável, e
  não é o que os jobs foram desenhados para significar.
- *Marcar os jobs a jusante como obrigatórios na proteção de branch, um a um* — rejeitada: um job
  `skipped` ainda satisfaz a maioria das configurações de "required checks" do GitHub por padrão,
  reproduzindo o mesmo problema num lugar diferente. O job de agregação único, que falha
  explicitamente sobre `skipped`, é a única forma que fecha a lacuna estruturalmente.

## D-19 — Cobertura de navegador descrita exatamente como é

**Decisão**: Chromium roda automaticamente em todo `push`/`pull request`. Firefox e WebKit rodam
**apenas** sob despacho manual (`workflow_dispatch`), e não há evidência, dentro do repositório, de
que esse despacho já tenha sido executado alguma vez — esta sessão não tem acesso ao histórico de
execuções do workflow e precisa dizer isso explicitamente, em vez de presumir em qualquer direção.
Todo documento que descrever cobertura de navegador passa a dizer isto, nestes termos. F-4 permanece
aberto, reafirmado com esta redação.

**Alternativas rejeitadas**:
- *Afirmar que a cobertura de três navegadores é real, porque três projetos estão configurados* —
  rejeitada: é precisamente a afirmação que F-4 já mostrou falsa (WebKit não assina entrada nenhuma
  neste ambiente).
- *Remover os projetos Firefox/WebKit da configuração, já que não rodam automaticamente* — rejeitada:
  descartaria a capacidade de rodá-los sob despacho manual, que é uma capacidade real, ainda que sem
  evidência de uso — diferente de uma capacidade nunca exercitada (CLAUDE.md §19.10), porque o
  mecanismo de despacho em si não depende de nenhum código desta aplicação para funcionar.

## D-20 — V3 respondida: a ausência de semeadura global do banco de teste está correta, não é defeito

**Decisão**: `global-setup.ts` trunca para uma linha de base vazia, e nenhum spec de integração
presume uma linha pré-existente — cada um cria o que precisa pela própria fixture. Uma semeadura
global compartilhada recriaria exatamente o risco de estado mutável compartilhado que já custou a
este projeto F-16 e F-45. O que permanece em escopo é provar o **próprio script de semeadura** contra
um banco descartável: idempotência, linha de base de permissão, e invalidação de cache. O resíduo de
F-5 é real, mas estreito — `reference-data.spec.ts` insere suas próprias linhas de referência porque
o banco de teste não tem nenhuma; isto é registrado como a forma contornada e válida, não como
defeito de semeadura.

**Alternativas rejeitadas**:
- *Adicionar uma semeadura global ao `global-setup.ts` de integração* — rejeitada pela razão central
  acima: reintroduziria estado mutável compartilhado entre arquivos de teste, a mesma causa raiz de
  F-16 (corrida sobre conta compartilhada) e F-45 (contaminação de estado entre arquivos).
- *Deixar F-5 como estava, sem resposta* — rejeitada: V3 exigia uma decisão explícita, não uma
  ausência prorrogada; a decisão é "correto por desenho", não "ainda não decidido".

## D-16 — Criar um `README.md` na raiz do repositório (item C7)

**Contexto**: confirmado ausente no HEAD medido. `docs/README.md` existe e está atual.

**Decisão**: criar o ponto de entrada raiz que C7 já pede como "índice navegável", apontando para
`docs/README.md` e para os specs ativos, sem duplicar conteúdo. Front G (`plan.md`) é dono deste
arquivo, junto dos demais itens de documentação de C7.

**Alternativas rejeitadas**:
- *Expandir `docs/README.md` e não criar nada na raiz* — rejeitada: um repositório GitHub renderiza
  o `README.md` da raiz como página inicial por convenção; não ter um é a lacuna que C7 já descreve
  como "quem chega no repositório não tem por onde começar", independentemente de `docs/README.md`
  estar correto.

---

## D-21 — `grc-foundation.openapi.yaml` usa `nullable: true` do OpenAPI 3.0; é pré-requisito bloqueante do validador de payload, não faxina opcional

**Achado, confirmado pelo coordenador contra os dez contratos**: `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`
declara `openapi: 3.1.0` no cabeçalho, mas usa a palavra-chave `nullable: true` do OpenAPI 3.0 em
**quinze** pontos — linhas 796, 801, 806, 807, 811, 840, 855, 858, 886, 893, 894, 939, 949, 950 e
954. Todo outro contrato dos dez usa a forma 3.1, `type: [string, 'null']`. Confirmado: este
documento é o único que diverge.

**Por que importa, precisamente**: em OpenAPI 3.1, um schema de componente **é** um schema de JSON
Schema 2020-12, e `nullable` não é uma palavra-chave de JSON Schema — um validador conforme a ignora
e lê o campo como uma string comum, não anulável. O gerador de tipos hoje é tolerante e mesmo assim
emite `string | null` (confirmado contra a saída commitada) — nada está errado nos tipos gerados
hoje. Mas no instante em que o validador novo de payload (D-9) checar uma resposta real contra esses
schemas, os quinze campos seriam recusados por enviarem legitimamente `null` — incluindo
`Action.completedAt`, `Action.reopenedAt`, `Action.description`, `Finding.closedAt` e
`Evidence.archivedAt`, exatamente os campos que a convergência de Ação (Frente A) toca.

**Decisão**: normalizar os quinze pontos para `type: [x, 'null']` **antes** da tarefa do validador —
é pré-requisito bloqueante, não item de limpeza posterior. Critério de aceitação próprio: regenerar
os tipos depois da mudança **não produz diff nenhum** em
`packages/api-types/src/generated/grcfoundation.ts` — é isso que demonstra que a correção mudou o
significado do contrato para um validador estrito sem mudar nada que um consumidor já via.

**Alternativas rejeitadas**:
- *Deixar o validador ignorar `nullable: true` e tratá-lo como sinônimo de `type: [x, 'null']`* —
  rejeitada: ensinaria o validador a tolerar uma sintaxe que o próprio cabeçalho do documento
  (`openapi: 3.1.0`) já declara não usar, mascarando a divergência em vez de corrigi-la — e deixaria
  esse comportamento tolerante como pegadinha para o próximo contrato que cometer o mesmo engano.
- *Corrigir junto com a tarefa do validador, na mesma tarefa* — rejeitada: dar à correção sua própria
  tarefa e seu próprio critério de aceitação (o diff vazio de tipos) é o que torna a mudança
  verificável isoladamente, em vez de escondida dentro de uma tarefa maior.

---

## D-22 — Seletores de vínculo paginados sem busca: achado encontrado RODANDO a suíte, não lendo o código (Frente H, novo)

**Como foi encontrado**: a execução completa do Chromium (75 aprovados, 3 falhos, 0 pulados, 8min42s)
falhou em três especificações que passavam isoladamente e que nenhuma leitura de código havia
sinalizado. É exatamente o argumento que CLAUDE.md §18.1 já fazia em teoria — "evidência de
navegador renderizado não é formalidade" — confirmado na prática por esta própria sessão.

**As três falhas, medidas**:
1. `assets-processes.spec.ts:296` — depois de cadastrar um ativo e filtrar pela sua unidade
   organizacional, o cartão do ativo novo não é encontrado.
2. `assets-processes.spec.ts:302` — a mesma jornada, para um processo.
3. `risk-treatment.spec.ts:78` — o combobox "Vincular controle" nunca oferece o controle de fixture
   `FIXTURE-CONTROL-1`, e o passo estoura o tempo.

**Uma causa só, medida, não hipótese**: o banco de desenvolvimento tem 57 controles, 27 ativos, 26
processos, 584 riscos. 26 dos 27 ativos estão na unidade que o teste filtra;
`use-asset-catalog-state.ts:29` fixa `DEFAULT_PAGE_SIZE = 25`; o ativo recém-criado é o 26º por
código — cai na página dois. `apps/web/src/features/risks/api.ts:356` busca
`/controls?pageSize=25`, e `risk-controls-section.tsx:362` chama `listControls('')` — busca **vazia**,
uma vez, quando o combobox abre. Com 57 controles, `FIXTURE-CONTROL-1` não está entre os primeiros
25.

**O defeito de produto que isto expõe, maior do que os três testes**: nove pontos de chamada, em
seis módulos de frontend, buscam uma primeira página fixa com um termo de busca vazio e nunca
buscam de novo enquanto o usuário digita, e nenhum deles avisa que a lista é parcial:

- `apps/web/src/features/risks/components/risk-controls-section.tsx:362, :378, :394`
- `apps/web/src/features/controls/components/control-links-section.tsx:418, :434`
- `apps/web/src/features/compliance/components/requirement-controls-section.tsx:111`
- `apps/web/src/features/audit-engagements/components/audit-scope-control-picker.tsx:56`
- `apps/web/src/features/findings/components/finding-links-section.tsx` — seletor de controle E
  seletor de risco (dois pontos de chamada no mesmo arquivo). **Verificado, não presumido**: este
  arquivo tem `ensureOptionsLoaded` (linhas 192-203) buscando uma vez com termo vazio e cacheando o
  resultado, retornando cedo em toda abertura seguinte; a assinatura de prop de busca na linha 483
  nunca recebe um valor real. **Não há exceção nem contraexemplo parcial no código** — todo seletor
  de vínculo se comporta da mesma forma.

Toda API por trás desses nove pontos **já aceita e já honra** um parâmetro de busca no servidor — a
mudança fica inteiramente confinada ao seletor do frontend e ao novo primitivo, sem mudança de
contrato, sem endpoint novo, sem trabalho de consulta no backend.

**Consequência numa instalação real**: assim que a biblioteca de controles, o inventário de ativos ou
o catálogo de processos de um cliente passar de 25 registros, o usuário **não consegue vincular nada
fora dos primeiros 25**, e a interface não dá nenhum sinal de que algo está faltando. Vinte e cinco
controles é uma biblioteca pequena para este produto. É a mesma forma de F-29 ("falha
deterministicamente conforme o diretório de desenvolvimento cresce"), generalizada de uma tela para
nove pontos de chamada em seis módulos.

**Decisão: em escopo, como frente própria, com user story própria** (spec.md User Story 9, Frente
H):

- O seletor busca no servidor conforme o usuário digita (com debounce), usando o parâmetro `q` que
  toda API já aceita, e declara explicitamente quando a lista mostrada é parcial. Um único primitivo
  buscável em `packages/design-system`, consumido pelos nove pontos de chamada — nunca nove
  implementações locais (CLAUDE.md §18.3/§18.12).
- CLAUDE.md §18 vale por inteiro: verificação renderizada, os dois temas, operação por teclado,
  nome acessível, e o portão de aceitação do §18.11.
- As três especificações E2E falhas param de presumir que o registro recém-criado está na primeira
  página; passam a encontrá-lo buscando pelo próprio código. **Aumentar o tamanho de página está
  explicitamente PROIBIDO como correção** — esconderia o defeito de produto atrás de uma primeira
  página maior, exatamente o movimento contra o qual a própria história deste projeto já alerta
  (F-29, e a lição geral de "corrigir a causa, não o sintoma que a expôs").
- Critério de aceitação: contra o banco de desenvolvimento como está (57 controles, 26 ativos numa
  unidade), as três jornadas passam, e um teste prova que o seletor alcança uma entrada que não está
  na primeira página.

**Alternativas rejeitadas**:
- *Aumentar `DEFAULT_PAGE_SIZE`* — rejeitada explicitamente, ver acima: esconde o defeito, não o
  corrige, e falha de novo assim que o inventário crescer mais.
- *Corrigir apenas os três pontos de chamada que os testes tocaram* — rejeitada: os nove pontos de
  chamada compartilham a mesma causa; corrigir três e deixar seis é repetir a forma exata de F-46
  (fechar um irmão, deixar os outros) num domínio novo.
- *Uma implementação de busca própria por seletor, em vez de um primitivo único* — rejeitada por
  CLAUDE.md §18.3/§18.12: divergência de padrão de interação de formulário/seleção entre módulos sem
  justificativa é defeito, não liberdade; nenhum seletor existente serve de modelo — é trabalho novo,
  não extração de um já correto.

---

## D-23 — F-12 e F-14 estão RESOLVIDOS no HEAD, medidos; os documentos é que estão desatualizados (Frente F, medida)

**F-12 resolvido.** `docker/api.Dockerfile` já roda um segundo `prisma generate` contra a árvore
implantada. A imagem foi construída e executada contra o Postgres e o Redis do Compose, com
`NODE_ENV=production` e `SESSION_COOKIE_SECURE=true`: o Prisma conectou, o Nest subiu, e
`GET /api/v1/health/ready` devolveu `{"status":"ok"}` com banco e cache saudáveis. Nenhum crash-loop.
`docs/deferred-findings.md` não carrega marca `RESOLVIDO`, e
`specs/001-grc-platform-foundation/quickstart.md` ainda diz que o caminho Docker "não funciona hoje
de ponta a ponta". As duas afirmações são falsas no HEAD medido — correções da Frente G.

**F-14 resolvido.** `.dockerignore` ancora em toda profundidade. As duas imagens construídas foram
buscadas de ponta a ponta e não contêm nenhum arquivo `.env`, de nenhum tipo. Nenhum caminho ou
conteúdo de segredo foi impresso.

**Decisão**: marcar os dois como resolvidos, com esta evidência, em `docs/deferred-findings.md`
(Frente G) — sem apagar o texto original de nenhum dos dois achados.

## D-24 — F-13 se divide em dois, e metade nunca foi verdadeira (Frente F, medida)

A checagem de boot reproduz **exatamente** como documentado quando a imagem roda com
`SESSION_COOKIE_SECURE=false` sob `NODE_ENV=production`. Mas o serviço `api` de
`docker-compose.yml` já força `SESSION_COOKIE_SECURE: "true"` — um `docker compose up` real, com um
`.env` copiado do exemplo, nunca alcança essa checagem. **A metade de falha de boot está fechada
pelo próprio arquivo Compose.**

A outra metade — "um navegador ainda recusaria armazenar um cookie `Secure` servido sobre
`http://localhost` puro" — está **medida como falsa para Chromium**. Um motor Chromium real,
dirigido pelo formulário de login renderizado contra a stack do Compose, armazenou o cookie
(`Secure`, `HttpOnly`, `SameSite=Lax`), foi reconhecido por `GET /api/v1/auth/me`, e teve o cookie
limpo pelo logout. `localhost` é uma origem potencialmente confiável independentemente do esquema.

**Escopo exato da afirmação: só Chromium.** Não Firefox, não Safari, não um binário do Chrome
publicado. F-13 é corrigido para dizer precisamente isso, preservando a parte genuinamente aberta: a
stack ainda não tem terminador TLS, então nada além de `localhost` funciona sem um.

**Decisão**: dividir F-13 em duas metades no registro (Frente G): a de boot, fechada pelo próprio
Compose; a de navegador, medida falsa e escopada a Chromium; a ausência de TLS, genuinamente aberta e
mantida como está.

## D-25 — Os comandos de migração Docker do quickstart nunca funcionaram, provado; o `.env` raiz NÃO é defeito (Frente F, medida)

**Achado, agora provado, não apenas suspeitado**: `specs/001-grc-platform-foundation/quickstart.md:91-92`
instrui o operador a rodar `docker compose exec api pnpm exec prisma migrate deploy` e
`... db seed`. A imagem de runtime não embarca **nem `pnpm` nem `prisma`** (verificado dentro da
imagem construída). Essas duas linhas nunca puderam funcionar. A forma executada no host **foi**
verificada funcionando contra o banco do Compose:
`pnpm --filter ./apps/api exec prisma migrate deploy` aplicou toda migração, e
`pnpm --filter ./apps/api exec prisma db seed` semeou com sucesso.

**Decisão**: corrigir o quickstart para o comando verificado, dizendo qual serve para uma instalação
(`migrate deploy`) e qual para autorar uma migração nova (`migrate dev`) — irmão de F-51, agora
provado em vez de inferido.

**Correção ao agente que mediu, registrada como correção do coordenador, não repetida como
achado**: aquele agente relatou a exigência de um `.env` na raiz do repositório como uma lacuna
genuína e reproduzível no caminho documentado de instalação do zero. **Não é.** O quickstart já
instrui `Copy-Item .env.example .env` na linha 43, e a sequência de subida verificada em
`docs/local-environment.md` já abre com o mesmo passo (`cp .env.example .env`). O agente não pôde
executá-lo apenas porque esta sessão o proibiu de escrever no repositório. Registrado como
comportamento já documentado, não como defeito. O único resíduo justo: o Compose falha com uma
mensagem obscura de "arquivo de ambiente não encontrado" quando o passo é pulado — vale uma frase no
quickstart, nada além disso.

**Alternativas rejeitadas**:
- *Aceitar o relato original do agente de medição como achado novo* — rejeitada: verificado
  diretamente contra os dois documentos citados antes de escrever esta correção; o passo já está
  documentado em dois lugares.

---

## D-26 — `pnpm test` mente sobre o que roda, e o script é o problema, não só a frase (Frente G, achado novo)

**Verificado lendo as três configurações Vitest diretamente**: `test` na raiz é
`pnpm -r --if-present run test`. `apps/web` **não tem** script `test`, só `test:unit` — seus 532
testes são silenciosamente pulados. `apps/api`'s `test` roda a configuração **padrão**
(`vitest.config.ts`), cujo `include` é `['test/**/*.spec.ts','src/**/*.spec.ts']` — varre também os
specs de integração e contrato. Essa configuração **não tem `globalSetup`** e não define
`fileParallelism: false`/`singleFork`, exatamente o que `vitest.integration.config.ts` e
`vitest.contract.config.ts` existem para prover. Então `pnpm test` roda suítes de banco sem
migração, sem reset e com paralelismo total de arquivo, contra um único banco compartilhado — a
corrida exata que essas configurações dedicadas existem para evitar. O próprio cabeçalho de
`vitest.integration.config.ts` já chama a configuração padrão de "testes de unidade — domínio puro,
sem I/O, sem banco", o que o `include` dela contradiz. CI nunca roda `pnpm test`; roda quatro jobs
separados com as configurações dedicadas.

**Decisão — corrigir os scripts, não só a frase**:
1. Estreitar o `include` de `apps/api/vitest.config.ts` para
   `['test/unit/**/*.spec.ts','src/**/*.spec.ts']`, batendo com o que essa configuração já se
   documenta como sendo.
2. Acrescentar `"test": "vitest run"` a `apps/web`, para que o script recursivo da raiz o cubra.
3. `pnpm test` passa a significar honestamente "toda suíte de unidade do workspace".
4. Trocar `specs/001-grc-platform-foundation/quickstart.md:483-484` (`pnpm test`) pelos quatro
   comandos que a CI de fato roda, já listados individualmente mais acima no mesmo arquivo.

Confirmar primeiro que nenhum quickstart usa `pnpm --filter @vertice/api run test -- <padrão>` para
mirar um spec **fora** de `test/unit` — 005 e 006 usam essa forma, e seus alvos precisam continuar
funcionando depois do estreitamento.

**Alternativas rejeitadas**:
- *Só corrigir a frase do quickstart, sem tocar nos scripts* — rejeitada: deixaria `pnpm test`
  continuar mentindo para qualquer desenvolvedor que o rodasse fora do quickstart, e deixaria o
  `include` da configuração padrão continuar contradizendo seu próprio cabeçalho.
- *Adicionar `globalSetup`/`singleFork` à configuração padrão em vez de estreitar seu `include`* —
  rejeitada: tornaria a configuração "padrão" de fato uma cópia da de integração, duplicando
  configuração em vez de cada uma continuar servindo ao propósito que seu próprio nome e cabeçalho já
  declaram.

## D-27 — A correção registrada para F-51 também estava errada; as quatro migram para `migrate deploy`

**Verificado**: `apps/api/package.json` tem exatamente um script de migração, `db:migrate` =
`prisma migrate dev`. `apps/api/prisma/schema.prisma:57-72` afirma, no próprio cabeçalho do schema,
que `migrate dev` calcula seu diff contra um banco de sombra que não entende o particionamento
manual de `audit_event`, e pode propor apagá-lo e recriá-lo — "Preferir `prisma migrate deploy`
(nunca `migrate dev`) contra bancos reais deste projeto."

Então 002, 003 e 005 citam um script inexistente (F-51, como registrado), e a correção anterior de
006 — renomear para `db:migrate` — fez o comando **existir** sem torná-lo **correto**.

**Decisão**: as quatro (002, 003, 005, 006) migram para a forma que a Fase 1 já usa e que esta sessão
verificou funcionando: `pnpm --filter @vertice/api exec prisma migrate deploy`. Corrigir também
`specs/001-grc-platform-foundation/quickstart.md:91-92`, cuja forma em contêiner não pode funcionar
porque a imagem de runtime não embarca gerenciador de pacote nem a ferramenta Prisma (D-25).

**Alternativas rejeitadas**:
- *Aceitar `db:migrate` como correção suficiente, já que o script existe* — rejeitada: existir não é
  a mesma coisa que ser seguro contra banco real; o próprio schema já documenta por que `migrate dev`
  é perigoso especificamente para esta tabela particionada à mão.

## D-28 — Documentação de arquitetura desatualizada de ponta a ponta; correção por adendo, nunca reescrita

`docs/architecture/grc-roadmap.md` ainda descreve as Fases 2-5 no futuro, e sua seção de fechamento
ainda recomenda Controles como próximo módulo — as quatro já foram entregues.

`docs/architecture.md` tem três afirmações factualmente erradas: a tabela-resumo diz que `risk` é o
único módulo de negócio quando seis existem; a lista de capacidades do núcleo contradiz a própria
seção "known gaps" mais adiante no mesmo documento (que é a versão correta); e o exemplo de
"adicionar o módulo número dois" hoje seria, de fato, o módulo número sete.

**Decisão**: corrigir por **adendo datado**, no mesmo padrão que `grc-roadmap.md` já usa
("reverificado em 2026-09-07") e que já foi aplicado a ADR-020, F-37, F-12, F-13 e F-14 nesta mesma
sessão — o texto original permanece, marcado superado, nunca apagado (CLAUDE.md preserva a
reasoning de registro). O exemplo de `architecture.md` é reformulado em torno de um módulo
**realmente construído**, não uma renumeração de um hipotético.

**Alternativas rejeitadas**:
- *Reescrever os documentos para refletir o estado atual, sem marcar o que mudou* — rejeitada:
  apagaria o histórico de decisão que o próprio CLAUDE.md §14/§16 exige preservar; a convenção já
  estabelecida neste repositório (adendo datado) existe exatamente para isto.

## D-29 — Três fases com toda tarefa desmarcada é defeito de registro, não de trabalho

`specs/002-shared-grc-foundation`, `003-controls-management` e `004-compliance-management` mostram
85/85, 60/60 e 71/71 tarefas desmarcadas, sem nenhuma nota explicando por quê, enquanto CLAUDE.md §17
lista as três como concluídas, com commit. Treze amostras entre esses arquivos foram conferidas
contra o código, e todas as treze estavam feitas-mas-não-marcadas — nenhuma na direção contrária.

**Por que isto é sério, não cosmético**: é exatamente a corrosão que esta missão existe para
prevenir — torna uma tarefa genuinamente pendente indistinguível de uma que só não foi marcada.

**Decisão**: reconciliar as caixas de marcação na mesma passagem que cita o commit de fechamento de
cada fase, com uma linha datada no topo de cada arquivo dizendo quando e contra o quê a reconciliação
foi feita. Nenhuma caixa é marcada por inferência — cada uma precisa do arquivo ou commit que a
comprova.

**Uma ambiguidade genuína, resolvida, não presumida**: o T071 de `004-compliance-management` pedia
um relatório sobre onde `ControlEffectivenessPort` não se encaixava; o porte existe e está ligado, e
nenhuma nota foi registrada em nenhuma direção. Decisão: registrar explicitamente "encaixou em todo
lugar, nada a relatar" como a resposta — do jeito que o T058 irmão de `003-controls-management` já
fez para uma pergunta equivalente — em vez de deixar a pergunta silenciosamente sem resposta.

**Alternativas rejeitadas**:
- *Marcar as caixas por inferência, já que treze de treze amostras confirmaram "feito"* —
  rejeitada categoricamente: treze de treze não é 85 de 85, 60 de 60 e 71 de 71; cada caixa precisa
  de sua própria prova, ou o próprio propósito da reconciliação (parar de confundir "não marcado" com
  "não feito") seria violado pelo método usado para corrigi-lo.
