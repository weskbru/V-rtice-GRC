# Feature Specification: Gestão de Ativos e Gestão de Processos

**Feature Branch**: `006-assets-processes`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Gestão de Ativos e Gestão de Processos — promover os registros de referência Asset e Process, hoje tabelas mínimas (code, name, description, orgUnitId nulo, isActive) lidas diretamente por dois repositórios distintos em modules/risk e modules/controls, a domínios de negócio próprios com módulo, contrato REST, autorização, escopo organizacional e auditoria — sem criar nenhum segundo conceito paralelo, e sem duplicar os vínculos Risco↔Ativo, Risco↔Processo, Controle↔Ativo e Controle↔Processo que já existem."

---

## Contexto medido, não presumido

Todo número e toda afirmação abaixo foi verificado no repositório e no banco em 2026-09-08, antes
de esta especificação ser escrita. Isto existe porque este projeto já registrou três causas
plausíveis, confiantes e **erradas** (`specs/005-audit-findings/STATE.md` §6), e cada uma dispensou
os leitores seguintes de conferir.

| Fato | Como foi verificado | Resultado |
|---|---|---|
| `Asset` e `Process` são tabelas mínimas e idênticas em forma | `prisma/schema.prisma` linhas 1534 e 1554 | `id, code (unique), name, description?, orgUnitId? (NULO), isActive, createdAt, updatedAt` |
| Nenhum módulo os possui | `ls apps/api/src/modules/` | `audit-engagements, compliance, controls, risk` — nenhum `assets`, nenhum `processes` |
| Duas infraestruturas leem as tabelas direto | grep por `prisma.asset.`/`prisma.process.` | `modules/controls/infrastructure/reference-registry-lookup.repository.ts` e `modules/risk/infrastructure/prisma-registry.repository.ts` |
| Só existem duas operações HTTP | `apps/api/openapi.json` | `GET /processes` e `GET /assets`, ambas em `RegistryController`, que pertence a `modules/risk` |
| Ambas exigem `risk:view` | `registry.controller.ts` linhas 58 e 65 | um usuário de Controles sem `risk:view` **não consegue** listar ativos para o próprio seletor de vínculo |
| Os quatro vínculos já existem e não devem ser recriados | `schema.prisma` linhas 1493, 1513, 1602, 1623 | `ControlProcessLink`, `ControlAssetLink`, `RiskProcessLink`, `RiskAssetLink` |
| `isActive` **tem** consequência hoje | `control-asset-link.usecase.ts:57`, `asset-link.usecase.ts:82` | um ativo inativo é recusado no vínculo, dos dois lados |
| Toda linha existente tem `orgUnitId` nulo | consulta ao banco de desenvolvimento | `assets: total=1, orgUnitId_null=1` · `processes: total=1, orgUnitId_null=1` |
| As duas listagens **não aplicam escopo organizacional nenhum** | `registry.controller.ts` chama o repositório direto, sem caso de uso; `buildRegistryWhere` devolve só `isActive` e a busca | nenhum `ScopeFilter` em nenhum ponto do caminho |
| Um registro com `orgUnitId` nulo é invisível a quem tem escopo por unidade | `applyScopeToWhere` gera `orgUnitId IN (...)`, e `NULL IN (...)` nunca é verdadeiro | visível apenas a escopo `GLOBAL` |

### Dois vazamentos de escopo que esta fase encontra abertos

São **dois**, independentes, medidos, e nenhum deles é hipotético.

#### Vazamento 1 — leitura: o inventário inteiro, para qualquer um com `risk:view`

`GET /assets` e `GET /processes` não aplicam escopo organizacional **em ponto nenhum** do caminho.
`RegistryController` chama o repositório diretamente — sem caso de uso, sem
`ScopeResolverService`, sem `ScopeFilter` — e `buildRegistryWhere` monta apenas `isActive` e o
predicado de busca. Qualquer ator com `risk:view`, independentemente de seu escopo organizacional,
recebe **todos** os ativos e **todos** os processos da organização inteira, com id, código e nome.

Este é o mais amplo dos dois: expõe o inventário completo de uma vez, não um registro por vez.

#### Vazamento 2 — escrita: vincular a um alvo fora do escopo

Contagens de `isOrgUnitWithinScope` no **mesmo diretório**,
`apps/api/src/modules/risk/application/links/`:

| Caso de uso | Verificações de escopo sobre o alvo |
|---|---|
| `control-link.usecase.ts` | **5** — fechado por F-46 em 2026-09-08 |
| `asset-link.usecase.ts` | **0** |
| `process-link.usecase.ts` | **0** |

`LinkAssetUseCase` e `LinkProcessUseCase` resolvem o escopo do **risco** (o recurso primário) e
depois verificam do alvo apenas `isActive`. O lado de Controles faz o contrário e faz certo:
`control-asset-link.usecase.ts` recusa quando `asset.orgUnitId === undefined` **ou** quando o alvo
está fora do escopo do ator.

A consequência é concreta e não hipotética: um ator com escopo na unidade A pode vincular um risco
da unidade A a um ativo da unidade B e, em seguida, ler `id`, `code` e `name` desse ativo de volta
pela listagem do vínculo. É **exatamente** a divulgação entre escopos que a ADR-020 descreve em sua
própria "correção 2" (F-46) para o par Risco→Controle — fechada lá, deixada aberta nestes dois
irmãos idênticos, no mesmo diretório, no mesmo dia.

Esta fase é o momento em que as duas correções se tornam possíveis **e** obrigatórias: sem
`Asset`/`Process` como domínios com escopo organizacional real, não há o que verificar.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Manter o inventário de ativos e o catálogo de processos (Priority: P1)

Um gestor de riscos precisa registrar, encontrar e manter os ativos e os processos da organização
como registros de primeira classe: cadastrar um ativo novo com o que ele é e a que unidade
pertence, corrigir o que estiver errado, e aposentar o que saiu de operação sem apagar o histórico
de que ele existiu e esteve vinculado a riscos e controles.

**Why this priority**: hoje esses registros existem, mas ninguém consegue criá-los ou mantê-los
pelo produto — só há uma listagem de leitura. O inventário é semeado ou inserido fora da
aplicação. Sem isto, os outros dois cenários não têm o que referenciar, e o módulo não existe de
fato.

**Independent Test**: cadastrar um ativo e um processo, encontrá-los na listagem filtrando por
unidade e por situação, editá-los, e desativá-los — tudo pela interface, sem tocar no banco.

**Acceptance Scenarios**:

1. **Given** um usuário com autoridade de criação de ativo, **When** cadastra um ativo informando
   nome, descrição e unidade organizacional, **Then** o ativo passa a existir com um código único
   gerado pelo sistema, situação ativa, e aparece na listagem de ativos.
2. **Given** um ativo existente, **When** um usuário com autoridade de edição corrige seu nome ou
   sua descrição, **Then** a alteração é registrada com autor e data na trilha de auditoria, e o
   valor anterior permanece recuperável.
3. **Given** um ativo em uso, **When** um usuário o desativa, **Then** ele deixa de poder ser
   vinculado a riscos e controles novos, **mas** continua legível e continua aparecendo nos
   vínculos já existentes — nada é apagado.
4. **Given** um processo desativado por engano, **When** um usuário com autoridade o reativa,
   **Then** ele volta a poder ser vinculado, e as duas transições ficam na trilha.
5. **Given** dois ativos com o mesmo nome em unidades diferentes, **When** ambos são cadastrados,
   **Then** os dois existem, com códigos distintos — o nome não é a identidade.
6. **Given** um usuário cuja autoridade cobre apenas leitura, **When** abre a listagem, **Then**
   vê os registros de seu escopo e **não** vê nenhuma ação de criação, edição ou desativação.

---

### User Story 2 — Enxergar ativo e processo sem depender de autoridade sobre Riscos (Priority: P1)

Um usuário que trabalha com Controles, Conformidade ou Auditoria precisa consultar o inventário de
ativos e o catálogo de processos para vinculá-los ao que mantém — sem precisar de autoridade sobre
o módulo de Riscos, com o qual não tem relação.

**Why this priority**: é um defeito de autorização em produção hoje, não uma melhoria. As duas
únicas operações existentes exigem `risk:view`; o seletor de ativos da tela de Controles depende
delas. Um usuário de Controles sem autoridade sobre Riscos vê um seletor vazio, sem explicação.
Está no mesmo nível de prioridade que a US1 porque é a razão pela qual a promoção não pode ser
adiada.

**Independent Test**: com um usuário que tem autoridade de leitura de ativo e **não** tem
autoridade de leitura de risco, abrir o seletor de ativos na tela de um controle e ver o
inventário.

**Acceptance Scenarios**:

1. **Given** um usuário com autoridade de leitura de ativo e **sem** autoridade de leitura de
   risco, **When** lista os ativos, **Then** recebe o inventário do seu escopo — a autoridade
   exigida é a do próprio recurso, nunca a de outro módulo.
2. **Given** o mesmo usuário, **When** vincula um ativo a um controle, **Then** o vínculo é criado
   normalmente, e continua exigindo autoridade dos **dois** lados: sobre o controle e sobre o
   ativo.
3. **Given** um usuário sem autoridade de leitura de ativo, **When** tenta listar ativos, **Then** é
   recusado, e a recusa não revela quantos ativos existem.

---

### User Story 3 — O escopo organizacional deixa de vazar, na leitura e na escrita (Priority: P1)

Um ator cujo escopo cobre apenas uma unidade não deve **ver** ativos e processos de outras
unidades na listagem, nem conseguir **vincular** um risco a um ativo ou processo de outra unidade —
nem descobrir, por qualquer dessas vias, que aquele registro existe.

**Why this priority**: é o fechamento de um gap de autorização **aberto e medido** (ver "Contexto
medido" acima). É P1 por ser segurança, não funcionalidade, e porque a própria promoção é o que o
torna corrigível.

**Independent Test**: com um ator escopado a uma unidade, (a) listar ativos e confirmar que os de
outras unidades não aparecem, e (b) tentar vincular um risco daquela unidade a um ativo de outra e
confirmar que a resposta é indistinguível da de um ativo inexistente e que nenhuma linha é gravada.

**Acceptance Scenarios**:

0. **Given** um ator cujo escopo cobre apenas a unidade A e ativos existentes nas unidades A e B,
   **When** o ator lista os ativos, **Then** vê os da unidade A e **não** vê nenhum da unidade B —
   nem no total de resultados, nem na paginação.
1. **Given** um ator cujo escopo cobre a unidade A e um ativo pertencente à unidade B, **When** o
   ator tenta vincular um risco da unidade A a esse ativo, **Then** a recusa é **idêntica** à de um
   ativo inexistente — nunca uma recusa que confirme a existência — e nenhuma linha de vínculo é
   gravada.
2. **Given** o mesmo ator e um processo da unidade B, **When** tenta vincular, **Then** o mesmo
   comportamento.
3. **Given** um vínculo Risco→Ativo criado **antes** desta fase, entre unidades diferentes,
   **When** alguém o lê, **Then** ele continua legível — a correção fecha a porta para vínculos
   novos e **não** apaga nem esconde história já registrada.
4. **Given** um ator com autoridade de vínculo mas **sem** autoridade de leitura de ativo, **When**
   tenta vincular, **Then** é recusado — a autoridade é exigida dos dois lados.

### Edge Cases

- **Ativo sem unidade organizacional**: toda linha existente hoje tem `orgUnitId` nulo. Um registro
  sem unidade não pode ser autorizado por escopo — não há o que comparar. Ver FR-004 e a
  Assumption A-2: a unidade passa a ser obrigatória, e a migração precisa decidir o que fazer com o
  que já existe, explicitamente, nunca por omissão.
- **Desativar um ativo que já tem vínculos ativos**: permitido. O vínculo é um fato histórico; ele
  não é desfeito por desativação, e continua aparecendo. Só a criação de vínculos **novos** é
  bloqueada.
- **Código duplicado**: o código é gerado pelo sistema e é único em toda a organização. Nome não é
  identidade — dois ativos podem ter o mesmo nome (US1 cenário 5).
- **Exclusão**: não existe. Um ativo ou processo que deixou de existir na realidade é **desativado**,
  nunca removido — apagar destruiria a rastreabilidade dos vínculos que o referenciam (FR-012).
- **Mudança de unidade organizacional de um ativo**: um ativo pode ser transferido entre unidades.
  Isso muda quem o enxerga a partir daquele momento. Os vínculos já criados permanecem — ver a
  Assumption A-4.
- **Listar com escopo que não cobre nada**: devolve uma lista vazia legítima, distinguível na
  interface de "falha ao carregar" e de "nenhum resultado para este filtro" (§18).

---

## Requirements *(mandatory)*

Salvo onde o texto distingue explicitamente, **todo requisito abaixo vale igualmente para Ativo e
para Processo**. Os dois são promovidos pela mesma fase, com a mesma forma, deliberadamente — ver
FR-020.

### Funcionais — o domínio

- **FR-001**: O sistema DEVE tratar Ativo e Processo como domínios de negócio próprios, cada um com
  seu módulo, seu contrato e sua autoridade — não como tabelas de referência lidas diretamente por
  outros módulos.
- **FR-002**: O sistema DEVE permitir cadastrar um Ativo e um Processo, informando nome, descrição e
  unidade organizacional, atribuindo automaticamente um código único e legível.
- **FR-003**: O sistema DEVE permitir editar nome e descrição de um Ativo e de um Processo
  existentes, preservando o valor anterior na trilha de auditoria.
- **FR-004**: Todo Ativo e todo Processo DEVE pertencer a exatamente uma unidade organizacional. A
  unidade é obrigatória — a autorização por escopo não pode depender de um campo ausente.
- **FR-005**: O sistema DEVE permitir desativar e reativar um Ativo e um Processo, registrando as
  duas transições com autor e data.
- **FR-006**: Um Ativo ou Processo **inativo** NÃO PODE ser vinculado a um risco ou a um controle
  novo, e DEVE continuar integralmente legível e visível nos vínculos que já o referenciam.
- **FR-007**: O sistema DEVE permitir listar Ativos e Processos com filtro por unidade
  organizacional e por situação, e busca por nome ou código, com paginação.
- **FR-008**: O sistema DEVE permitir ler um Ativo e um Processo individualmente, incluindo a que
  riscos e a que controles ele está vinculado.

### Funcionais — autorização e escopo

- **FR-009**: A autoridade para ler, criar, editar e administrar um Ativo DEVE ser própria do
  recurso Ativo, e a de um Processo própria do recurso Processo. Ler o inventário NÃO PODE exigir
  autoridade sobre o módulo de Riscos nem sobre qualquer outro módulo.
- **FR-010**: Toda leitura e toda escrita de Ativo e de Processo DEVE ser limitada ao escopo
  organizacional do ator, **incluindo a listagem** — que hoje não aplica escopo nenhum e devolve o
  inventário inteiro da organização. Um registro fora do escopo DEVE responder como inexistente,
  nunca com uma recusa que confirme sua existência, e não pode aparecer em contagem nem em
  paginação.
- **FR-011**: Criar um vínculo Risco↔Ativo, Risco↔Processo, Controle↔Ativo ou Controle↔Processo
  DEVE verificar o escopo organizacional do **alvo** antes de gravar, e DEVE exigir autoridade dos
  **dois** lados — a do recurso que registra o vínculo e a de leitura do recurso referenciado.
  Isto fecha, para Risco→Ativo e Risco→Processo, o gap que a "correção 2" da ADR-020 (F-46) fechou
  para Risco→Controle e não estendeu a estes dois pares.

### Funcionais — preservação

- **FR-012**: Nenhuma operação PODE excluir um Ativo, um Processo ou qualquer vínculo que os
  referencie. Saída de operação é desativação; desfazer um vínculo preserva o registro com autor e
  data, como já ocorre hoje.
- **FR-013**: Os quatro vínculos já existentes (Risco↔Ativo, Risco↔Processo, Controle↔Ativo,
  Controle↔Processo) NÃO PODEM ser duplicados, recriados sob outro nome, nem substituídos. Esta
  fase os **reusa**.
- **FR-014**: As duas operações de listagem já existentes NÃO PODEM ser quebradas para seus
  consumidores atuais. A propriedade delas muda de módulo; o que a interface e os testes já existentes
  observam permanece observável.

### Funcionais — auditoria e rastreabilidade

- **FR-015**: Criar, editar, desativar e reativar um Ativo ou um Processo DEVE gerar registro na
  trilha de auditoria, com ator, data, entidade, identificador, valores anteriores e posteriores.
- **FR-016**: Uma tentativa recusada por escopo organizacional sobre um registro que **existe** DEVE
  ser registrada no servidor, como já ocorre nos demais domínios — a recusa é auditável, não apenas
  respondida.

### Funcionais — interface

- **FR-017**: A interface DEVE oferecer catálogo, detalhe e formulário para Ativo e para Processo,
  estendendo os padrões já estabelecidos por Controles e Conformidade — sem inventar linguagem
  visual própria.
- **FR-018**: A entrada de navegação de Ativos e a de Processos DEVEM deixar de estar marcadas como
  planejadas, cada uma condicionada à autoridade de leitura do próprio recurso.
- **FR-019**: A interface DEVE distinguir carregando, vazio-de-verdade e falha-ao-carregar como três
  estados diferentes, e DEVE distinguir ativo de inativo por mais do que cor.

### Funcionais — fronteira arquitetural

- **FR-020**: Ativo e Processo DEVEM ser promovidos com a **mesma** forma e na mesma fase. Uma
  divergência de modelo, de autoridade ou de ciclo de vida entre os dois, sem justificativa
  registrada, é defeito.
- **FR-021**: Nenhum módulo PODE continuar lendo as tabelas de Ativo ou de Processo diretamente.
  Todo acesso vindo de outro domínio DEVE atravessar uma interface declarada, exposta pelo domínio
  dono.
- **FR-022**: Esta fase NÃO PODE introduzir um segundo conceito paralelo a Ativo (um "dispositivo",
  um "sistema", um "equipamento" como entidade separada e desligada). Um Ativo é o Ativo.

### Key Entities

- **Ativo**: algo que a organização possui ou opera e que tem valor a proteger — sistema,
  informação, instalação, equipamento, serviço. Pertence a uma unidade organizacional, tem código
  único, nome, descrição e situação (ativo/inativo). Relaciona-se com Risco e com Controle por
  vínculos que já existem.
- **Processo**: uma atividade de negócio recorrente da organização. Mesma forma que Ativo, mesmas
  relações, mesmo ciclo de vida — deliberadamente (FR-020).
- **Unidade organizacional** (existente): dona de cada Ativo e de cada Processo, e a base de toda
  decisão de escopo sobre eles.

### Relações declaradas (obrigatório por CLAUDE.md §19.2)

Declaração explícita de como estes dois domínios se relacionam com cada capacidade do núcleo GRC.
"Não se relaciona" é resposta válida, mas precisa ser escrita — nunca resultar de esquecimento.

| Contraparte | Ativo | Processo | Justificativa |
|---|---|---|---|
| Unidade Organizacional | **Sim**, obrigatória | **Sim**, obrigatória | FR-004 — base de toda autorização por escopo |
| Risco | **Sim** — `RiskAssetLink` | **Sim** — `RiskProcessLink` | já existem; reusados, nunca recriados (FR-013) |
| Controle | **Sim** — `ControlAssetLink` | **Sim** — `ControlProcessLink` | idem |
| Processo ↔ Ativo | **Não nesta fase** | **Não nesta fase** | um processo que usa um ativo é uma relação real e provavelmente desejável, mas **nenhum requisito desta fase a pede**, e nenhum consumidor a consome hoje. Introduzi-la agora seria construir um ponto de extensão nunca exercitado — o que CLAUDE.md §19.10 proíbe por nome. Fica registrada como candidata explícita para Incidentes (Fase 6), que a exercitaria de verdade. |
| Evidência | **Não nesta fase** | **Não nesta fase** | anexar evidência a um ativo é plausível, mas nenhum requisito a pede, e `EvidenceSubjectType` é registro fechado: acrescentar valor sem consumidor real repetiria §19.10 |
| Ação | **Não nesta fase** | **Não nesta fase** | ação nasce de tratamento de risco, achado, incidente ou remediação — nenhuma delas nasce de um ativo |
| Achado | **Indireto** | **Indireto** | um achado aponta para o controle ou o risco, que por sua vez apontam para o ativo. Nenhum vínculo direto é pedido |
| Auditoria (engajamento) | **Não** | **Não** | o escopo de um engajamento é framework, requisito ou controle (FR-005 de 005) — nenhum requisito pede ativo ou processo no escopo |
| Trilha de auditoria | **Sim** | **Sim** | FR-015, capacidade transversal |

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário consegue cadastrar um ativo e encontrá-lo na listagem, pela interface, sem
  nenhuma inserção manual no banco — o que hoje é impossível.
- **SC-002**: Um usuário com autoridade de leitura de ativo e **sem** nenhuma autoridade sobre
  Riscos consegue listar ativos e usá-los no seletor de vínculo de um controle. Verificável pelo
  teste que exerce esse usuário, não pela leitura do código de autorização.
- **SC-003**: Para os quatro pares de vínculo, uma tentativa contra um alvo fora do escopo do ator
  responde **exatamente** como contra um alvo inexistente, e **nenhuma linha é gravada** — contagem
  conferida antes e depois. Hoje, dois desses quatro pares falham este critério.
- **SC-003b**: Um ator escopado a uma unidade não recebe, na listagem de ativos ou de processos,
  nenhum registro de outra unidade — nem no corpo, nem no total, nem na paginação. Hoje a listagem
  falha este critério para **todos** os atores, porque não aplica escopo algum.
- **SC-004**: Nenhuma operação, em nenhum dos dois domínios, remove uma linha de ativo, de processo
  ou de vínculo. Verificável por busca estrutural automatizada sobre o contrato **e** sobre o
  código, não por inspeção.
- **SC-005**: Nenhum módulo fora dos dois novos lê as tabelas de ativo ou processo diretamente.
  Verificável por busca estrutural automatizada.
- **SC-006**: As suítes de Risco, Controles, Conformidade e Auditoria continuam passando com a
  **mesma contagem** de testes de antes desta fase, exceto onde um teste precisou mudar para
  refletir o fechamento do gap de escopo (FR-011) — e cada teste alterado por essa razão cita
  FR-011 explicitamente.
- **SC-007**: Um ativo desativado permanece legível e continua visível nos vínculos que já o
  referenciam, enquanto é recusado em vínculos novos — os dois lados verificados.
- **SC-008**: As telas novas passam varredura de acessibilidade automatizada nos dois temas, com
  conteúdo real renderizado.

---

## Assumptions

- **A-1 — Simetria deliberada**: Ativo e Processo recebem exatamente a mesma forma. Isto não é
  preguiça de modelagem: é o que o roadmap pede ("promoção dos registros de referência atuais"), e
  qualquer divergência entre os dois precisaria de justificativa própria (FR-020).
- **A-2 — Unidade organizacional obrigatória na criação, coluna inalterada** *(revisada por
  research.md D-2 — a versão original desta assumption foi REJEITADA, e o texto original está
  preservado em D-2 para que ninguém a reintroduza sem ler a razão)*: todo Ativo e Processo novo
  exige unidade organizacional (FR-004), mas a **coluna permanece anulável**, seguindo o único
  precedente do projeto para exatamente esta pergunta: `Control` tem coluna anulável e campo de
  criação obrigatório. Nenhuma migração destrutiva atribui unidade a linha antiga — atribuir a raiz
  **aumentaria** a visibilidade das linhas existentes, e `orgUnitId IN (...)` já torna uma linha sem
  unidade invisível a qualquer escopo por unidade, que é o comportamento seguro.
- **A-3 — Situação de dois estados, não um ciclo de vida inventado**: `isActive` **já tem
  consequência** hoje (um inativo é recusado no vínculo, verificado nos dois lados). Assume-se que a
  promoção mantém dois estados com consequência real, e **não** introduz um ciclo de quatro estados
  espelhando `Control`. Este projeto já quase enviou três estados sem consequência
  (`FindingStatus`, o `DRAFT` de Controles, o quase-incidente de Conformidade); um estado que não
  habilita nem proíbe nada é defeito, não completude.
- **A-4 — Transferência entre unidades preserva vínculos**: mover um ativo de unidade muda quem o
  enxerga dali em diante e **não** desfaz vínculos já criados. Um vínculo é um fato histórico.
  Assume-se que isto é o comportamento correto para uma plataforma de GRC; a alternativa (revogar
  vínculos na transferência) apagaria história.
- **A-5 — A propriedade das duas listagens muda de módulo**: `GET /assets` e `GET /processes` saem
  de `RegistryController` (hoje em `modules/risk`) para os módulos novos, exatamente como
  `GET /controls` saiu de `platform.openapi.yaml` para `controls.openapi.yaml` na Fase 2. Há
  precedente registrado no próprio repositório; assume-se o mesmo caminho, preservando o que os
  consumidores atuais observam (FR-014).
- **A-6 — A autoridade exigida nessas duas listagens muda**: de `risk:view` para a autoridade de
  leitura do próprio recurso. Isto é uma correção (US2), não uma quebra: assume-se que os papéis
  semeados que hoje leem o inventário via `risk:view` recebem a autoridade nova, para que nenhum
  usuário perca acesso que tinha.
- **A-7 — Sem interface de transferência entre unidades na v1 desta fase**: a unidade é definida no
  cadastro e editável pelo mesmo formulário de edição. Nenhuma tela dedicada de transferência em
  massa é pedida por requisito nenhum.
