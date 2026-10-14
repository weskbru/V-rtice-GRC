# Feature Specification: Gestão de Controles

**Feature Branch**: `003-controls-management`

**Created**: 2026-09-08

**Status**: Draft

**Input**: Promover o registro mínimo `Control` a domínio de negócio completo — Fase 2 de
`docs/architecture/grc-roadmap.md`, ADR-016 (Control é domínio com dono próprio, fora do núcleo
GRC compartilhado), ADR-017 (Control não pertence a framework algum), ADR-020 (padrão oficial de
relacionamento entre módulos, aqui exercitado pela primeira vez em código).

## Contexto herdado

Um registro **mínimo** de controle já existe e está em uso: `code`, `name`, `description`,
`orgUnitId`, `isActive`, criado na Fase 1 apenas para dar destino ao vínculo `RiskControlLink`. O
próprio esquema o descreve como "deliberadamente não um módulo de Gestão de Controles".

Esta fase **promove** esse registro. Ela não cria um segundo conceito de controle. Todo controle
já cadastrado continua existindo, com o mesmo identificador e o mesmo código, e todo vínculo
risco↔controle já registrado continua válido e atribuível. Um controle preexistente que ainda não
tenha os atributos que esta fase introduz é um controle incompleto, nunca um controle inválido.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manter o catálogo de controles (Priority: P1)

Um gestor de controles cadastra e mantém a biblioteca de salvaguardas da organização: o que o
controle faz, quem responde por ele, em que unidade organizacional opera, se é executado por
pessoa ou por sistema, se atua antes, durante ou depois do evento, e com que frequência deve ser
executado. Ao longo do tempo, um controle entra em operação, pode ser suspenso e pode ser
descontinuado — sempre com rastro de quem mudou o quê e quando.

**Why this priority**: sem catálogo não há domínio. Esta história sozinha já entrega valor real —
uma biblioteca de controles governada, escopada por unidade organizacional e auditável — e é
pré-requisito de todas as outras.

**Independent Test**: cadastrar um controle, editá-lo, percorrer o ciclo de vida e reabrir a
trilha de auditoria, sem que nenhuma outra história desta fase esteja implementada.

**Acceptance Scenarios**:

1. **Given** um usuário com `control:create` e escopo sobre a unidade, **When** cadastra um
   controle informando nome, descrição, unidade, dono, natureza, tipo e frequência, **Then** o
   controle é criado em `DRAFT` com um código estável gerado pela plataforma, e o evento de
   criação fica na trilha.
2. **Given** um controle em `DRAFT`, **When** o gestor o coloca em operação, **Then** o controle
   passa a `ACTIVE` e a transição fica registrada com autor, data e estados anterior e posterior.
3. **Given** um controle `ACTIVE`, **When** o gestor o descontinua informando justificativa,
   **Then** o controle passa a `RETIRED`, deixa de aceitar novas verificações e continua legível
   com todo o seu histórico.
4. **Given** um usuário cujo escopo organizacional não cobre a unidade do controle, **When**
   tenta abrir esse controle, **Then** recebe a mesma resposta que receberia para um controle
   inexistente.
5. **Given** um controle existente cadastrado antes desta fase, **When** é aberto, **Then** ele é
   exibido com os atributos que possui e com os novos atributos vazios, sem erro e sem valor
   inventado.

---

### User Story 2 - Verificar a efetividade de um controle (Priority: P2)

Um responsável por teste registra a verificação de um controle: quando testou, o que testou, qual
foi o resultado e qual a conclusão. Esse registro é imutável — uma nova verificação não corrige a
anterior, ela a sucede. A efetividade corrente do controle é **derivada** do histórico de
verificações e da frequência esperada; ninguém a digita. Declarar um controle efetivo é ato
distinto de testá-lo, e não pode ser praticado por quem o testou nem por quem responde pelo
controle.

**Why this priority**: é o que separa um catálogo de controles de uma gestão de controles. Sem
verificação, "controle efetivo" é opinião não rastreável.

**Independent Test**: registrar duas verificações no mesmo controle, observar que ambas
permanecem legíveis, que o estado derivado muda conforme o resultado mais recente e sua validade,
e que a atestação é recusada para o testador e para o dono do controle.

**Acceptance Scenarios**:

1. **Given** um controle `ACTIVE` e um usuário com `control:test`, **When** registra uma
   verificação com data, resultado e conclusão, **Then** a verificação é gravada e passa a
   constar no histórico do controle.
2. **Given** um controle com uma verificação anterior, **When** uma nova verificação é
   registrada, **Then** a anterior permanece integralmente legível e atribuível, e o histórico
   mostra as duas em ordem cronológica.
3. **Given** uma verificação pendente de atestação, **When** quem a executou tenta atestá-la,
   **Then** a atestação é recusada e a tentativa é auditada.
4. **Given** uma verificação pendente de atestação, **When** o dono do controle tenta atestá-la,
   **Then** a atestação é recusada e a tentativa é auditada.
5. **Given** uma verificação pendente, **When** um terceiro com `control:approve` a atesta,
   **Then** a efetividade derivada do controle passa a refletir o resultado atestado, e a
   mudança de efetividade é auditada com valor anterior e posterior.
6. **Given** um controle cuja última verificação atestada é mais antiga que a frequência
   declarada, **When** o controle é consultado, **Then** ele é apresentado com a efetividade
   vencida, sem que nenhum campo tenha sido gravado para isso.
7. **Given** um controle nunca verificado, **When** é consultado, **Then** ele é apresentado como
   não avaliado — nunca como efetivo por omissão.

---

### User Story 3 - Ligar o controle ao que ele protege e às provas que o sustentam (Priority: P3)

Um gestor conecta o controle ao restante do domínio GRC: aos riscos que ele trata, aos processos
e ativos sobre os quais opera, às evidências que comprovam sua execução e às ações de remediação
abertas quando ele se mostra inefetivo. Cada vínculo é explícito, tem significado próprio, e
desfazer um vínculo preserva o histórico.

**Why this priority**: é o que faz o controle ser o eixo do grafo GRC em vez de mais um cadastro.
Fica em P3 porque catálogo e verificação já entregam valor sem ela.

**Independent Test**: ligar um controle a um processo e a um ativo, anexar uma evidência, abrir
uma ação a partir de um resultado inefetivo, desfazer um vínculo e confirmar que ele permanece no
histórico com autor e data.

**Acceptance Scenarios**:

1. **Given** um controle e um risco, ambos dentro do escopo do ator, **When** o vínculo já
   existente entre risco e controle é consultado a partir do controle, **Then** o controle mostra
   os riscos que trata, sem que um segundo vínculo tenha sido criado.
2. **Given** um controle e um processo dentro do escopo do ator, **When** o ator os vincula,
   **Then** o vínculo é gravado com autor e data e fica auditado com tipo próprio.
3. **Given** um vínculo existente, **When** o ator o desfaz, **Then** o vínculo deixa de constar
   entre os vigentes e permanece no histórico com quem desfez e quando — nunca é excluído.
4. **Given** um alvo fora do escopo organizacional do ator, **When** o ator tenta vinculá-lo,
   **Then** a resposta é idêntica à de um alvo inexistente, e nada é gravado.
5. **Given** um ator com permissão de escrita no lado que registra o vínculo mas sem permissão de
   leitura no lado referenciado, **When** tenta vincular, **Then** a operação é recusada.
6. **Given** um controle, **When** uma evidência é anexada a ele, **Then** a evidência passa a
   sustentá-lo pelo mesmo mecanismo já usado pelos demais sujeitos de evidência, sem que um
   segundo conceito de evidência seja criado.
7. **Given** uma verificação com resultado inefetivo, **When** uma ação de remediação é aberta a
   partir dela, **Then** a ação aparece na mesma lista de trabalho das demais ações da
   plataforma, identificada pela sua origem.

---

### Edge Cases

- **Controle sem dono.** O dono é obrigatório a partir da ativação, não do cadastro: um rascunho
  pode existir antes de a responsabilidade estar definida, mas um controle em operação sem
  responsável é exatamente o que esta fase existe para impedir.
- **Frequência ausente.** Um controle sem frequência declarada não tem efetividade vencível — ele
  é apresentado com o resultado da última verificação atestada, sem prazo derivado. Ausência de
  frequência nunca é tratada como "vence imediatamente" nem como "nunca vence" implícito.
- **Verificação com data futura.** Recusada: uma verificação registra o que foi observado, e não
  se observa o que ainda não aconteceu.
- **Verificação em controle descontinuado.** Recusada. O histórico de um controle `RETIRED`
  permanece legível, mas não recebe fatos novos.
- **Atestação por quem acumula papéis.** Quando o testador é também o dono do controle, não há
  atestação possível por essa pessoa — a operação é recusada pelas duas regras ao mesmo tempo, e
  a recusa é atribuível a ambas.
- **Reativação de controle suspenso.** Um controle suspenso volta a `ACTIVE` sem perder o
  histórico de verificações, e sua efetividade derivada é recalculada a partir do mesmo
  histórico, não zerada.
- **Vínculo duplicado.** Vincular duas vezes o mesmo par vigente é recusado; vincular novamente
  um par cujo vínculo anterior foi desfeito é permitido e cria um novo vínculo, preservando o
  anterior no histórico.
- **Unidade organizacional do controle alterada.** Se o controle é movido para uma unidade fora
  do escopo de quem responde por ele, a operação segue a mesma regra de atribuição já vigente na
  plataforma — o responsável precisa pertencer à linha organizacional da nova unidade.

## Requirements *(mandatory)*

### Functional Requirements — catálogo e ciclo de vida

- **FR-001**: O sistema DEVE manter um catálogo de controles com identificador estável, código
  legível e único, nome, descrição, unidade organizacional, dono, natureza de execução (por
  pessoa ou por sistema), tipo de atuação (preventivo, detectivo ou corretivo) e frequência
  esperada de verificação.
- **FR-002**: O código do controle DEVE ser gerado pela plataforma e permanecer estável por toda
  a vida do registro; ele NÃO PODE ser aceito como entrada.
- **FR-003**: O sistema DEVE preservar todo controle já existente antes desta fase, com o mesmo
  identificador e o mesmo código, e DEVE apresentar os atributos novos como ausentes enquanto não
  forem preenchidos — nunca com valor arbitrado.
- **FR-004**: O controle DEVE possuir estados explícitos de ciclo de vida e transições
  permitidas entre eles; toda transição DEVE registrar autor, data, estado anterior e estado
  posterior.
- **FR-005**: Um controle DEVE exigir dono definido para entrar em operação.
- **FR-006**: Um controle descontinuado DEVE permanecer integralmente legível e NÃO PODE receber
  novas verificações nem novos vínculos.
- **FR-007**: Toda leitura e toda escrita de controle DEVEM respeitar o escopo organizacional do
  ator; um controle fora do escopo DEVE responder como inexistente, nunca como proibido.
- **FR-008**: O responsável por um controle DEVE pertencer à linha organizacional da unidade do
  controle, pela mesma regra de atribuição já vigente na plataforma.

### Functional Requirements — verificação e efetividade

- **FR-009**: O sistema DEVE permitir registrar verificações de efetividade contendo data da
  verificação, executor, resultado e conclusão.
- **FR-010**: Uma verificação registrada É imutável: uma nova verificação sucede a anterior e
  NÃO PODE sobrescrevê-la, editá-la ou removê-la.
- **FR-011**: Uma verificação NÃO PODE ter data futura.
- **FR-012**: A efetividade corrente do controle DEVE ser derivada do histórico de verificações
  atestadas e da frequência declarada, por um único ponto de cálculo; ela NÃO PODE existir como
  campo editável em paralelo às verificações que a sustentam.
- **FR-013**: Um controle sem verificação atestada DEVE ser apresentado como não avaliado, nunca
  como efetivo.
- **FR-014**: Um controle cuja última verificação atestada seja mais antiga que sua frequência
  declarada DEVE ser apresentado como vencido, sem que esse estado seja materializado em campo
  gravado.
- **FR-015**: Um controle sem frequência declarada NÃO DEVE ter efetividade vencível.
- **FR-016**: Declarar o resultado de uma verificação DEVE ser ato explícito e distinto de
  registrá-la, exercido pelo mecanismo de aprovação já existente na plataforma.
- **FR-017**: Quem executou a verificação NÃO PODE atestá-la.
- **FR-018**: O dono do controle NÃO PODE atestar verificações desse controle.
- **FR-019**: Toda tentativa recusada de atestação DEVE ser auditada, com o motivo da recusa.
- **FR-020**: Toda mudança de efetividade DEVE ser auditada com valor anterior e valor posterior.

### Functional Requirements — relacionamentos (ADR-020)

- **FR-021**: O sistema DEVE apresentar, a partir do controle, os riscos que ele trata,
  reutilizando o vínculo risco↔controle já existente; ele NÃO PODE criar um segundo vínculo entre
  risco e controle.
- **FR-022**: O sistema DEVE permitir vincular e desvincular controles a processos e a ativos,
  por vínculos explícitos e nomeados, cada um com seu próprio tipo na trilha de auditoria.
- **FR-023**: Desfazer um vínculo DEVE preservar o registro anterior com autor e data; ele NÃO
  PODE ser excluído fisicamente.
- **FR-024**: Criar um vínculo DEVE exigir permissão de escrita no lado que o registra e
  permissão de leitura no lado referenciado.
- **FR-025**: O sistema DEVE verificar que a entidade-alvo de um vínculo está dentro do escopo
  organizacional do ator ANTES de gravar; um alvo fora de escopo DEVE responder como inexistente.
- **FR-026**: O sistema DEVE permitir que uma evidência sustente um controle, pelo mesmo
  mecanismo de tipo fechado já usado pelos demais sujeitos de evidência.
- **FR-027**: O sistema DEVE permitir abrir uma ação de remediação a partir de uma verificação
  cujo resultado indique falha, e essa ação DEVE aparecer na lista de trabalho única já existente,
  identificada por sua origem.
- **FR-028**: Nenhum módulo de negócio PODE depender diretamente de outro módulo de negócio; a
  dependência de código entre Risco e Controles DEVE passar por porta declarada na camada
  compartilhada, e a porta NÃO PODE expor o modelo de domínio alheio — apenas identificador,
  código, nome, unidade organizacional e estado ativo.

### Functional Requirements — autorização e trilha

- **FR-029**: O sistema DEVE declarar permissões próprias para visualizar, criar, editar,
  verificar, atestar e administrar controles, pelo mecanismo estático de declaração já aprovado.
- **FR-030**: A trilha de auditoria DEVE registrar eventos que descrevem a intenção de negócio
  (controle ativado, verificação registrada, verificação atestada, efetividade alterada, vínculo
  criado, vínculo desfeito) e NÃO PODE reduzir tudo a um evento genérico de atualização.

### Key Entities

- **Control**: a salvaguarda que a organização implementa. Promoção do registro mínimo existente.
  Não pertence a framework algum (ADR-017). Possui unidade organizacional, dono, natureza, tipo,
  frequência e estado de ciclo de vida. Sua efetividade é derivada, nunca armazenada como verdade
  independente.
- **ControlAssessment**: uma verificação de efetividade, imutável, com data, executor, resultado
  e conclusão. Sucede-se no tempo; nunca é editada.
- **ControlProcessLink** / **ControlAssetLink**: vínculos explícitos e nomeados entre o controle
  e os registros de processo e de ativo, cada um com tipo próprio de entidade de auditoria e com
  preservação histórica ao desvincular.
- **RiskControlLink** *(já existente, do lado do Risco)*: o vínculo risco↔controle. Esta fase o
  consome e o expõe a partir do controle; não o redefine nem o duplica.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um gestor consegue cadastrar um controle completo e colocá-lo em operação sem sair
  do módulo de Controles.
- **SC-002**: Nenhum controle apresenta efetividade sem que exista uma verificação atestada que a
  sustente — verificável percorrendo todos os controles e confrontando efetividade apresentada
  com histórico de verificações.
- **SC-003**: Uma verificação registrada permanece legível e atribuível após qualquer verificação
  posterior do mesmo controle.
- **SC-004**: Nenhuma verificação pode ser atestada por quem a executou ou por quem responde pelo
  controle — verificável por tentativa recusada e auditada em ambos os casos.
- **SC-005**: Um identificador de controle fora do escopo do ator produz resposta indistinguível
  da de um identificador inexistente.
- **SC-006**: O módulo de Riscos continua funcionando sem alteração: as contagens de teste
  existentes passam sem que nenhum teste de Risco tenha sido modificado para acomodar esta fase.
- **SC-007**: Nenhum arquivo de `modules/risk` importa `modules/controls`, e vice-versa —
  verificável pela regra de fronteira já aplicada automaticamente.
- **SC-008**: Uma página do catálogo de controles é apresentada em menos de 2 segundos com 50.000
  controles cadastrados.
- **SC-009**: Todo evento de auditoria produzido por esta fase descreve a intenção de negócio;
  nenhum se resume a "atualizado".

## Assumptions

- O registro mínimo `Control` existente é a mesma entidade promovida por esta fase — não há
  migração de dados entre duas tabelas, e nenhum controle preexistente é recriado.
- Processos e ativos permanecem como registros de referência nesta fase; sua promoção a domínios
  é trabalho posterior do roadmap e não é pré-requisito para vincular controles a eles.
- A infraestrutura de aprovação existente (o registro de tipo aprovável já usado pelo módulo de
  Riscos) atende à atestação de verificações pela adição de um valor de tipo e de um caso de uso,
  sem qualquer motor de workflow.
- Evidência, Ação e Achado permanecem capacidades do núcleo GRC compartilhado; esta fase as
  consome pelos registros de tipo fechado já existentes e não cria variantes próprias.
- A regra de atribuição organizacional já vigente para responsável de risco vale igualmente para
  o dono de controle, sem uma segunda regra.
- Framework, versão de framework, requisito, mapeamento requisito↔controle e cálculo de
  conformidade estão fora desta fase (Fase 3). Engajamento de auditoria e a relação achado↔controle
  estão fora desta fase (Fase 4).

## Dependencies

- Fase 1 (núcleo GRC compartilhado: Evidência, Ação, Achado) — concluída e congelada.
- Módulo de Riscos — em operação; é o outro lado do primeiro relacionamento entre módulos.
- ADR-016, ADR-017, ADR-018, ADR-020 — aceitas; esta fase é o primeiro consumidor real de ADR-020
  em código e deve reportar onde o padrão não couber (CLAUDE.md §19.10).
