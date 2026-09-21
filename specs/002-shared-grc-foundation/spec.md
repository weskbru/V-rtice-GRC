# Feature Specification: Fundação GRC Compartilhada

**Feature Branch**: `002-shared-grc-foundation`

**Created**: 2026-09-07

**Status**: Draft

**Input**: Estabelecer o Núcleo GRC Compartilhado (ADR-016) com Evidence, Action e Finding.
Control não faz parte desta fase. A menor fundação coerente para que domínios GRC futuros sejam
implementados sem duplicar conceitos transversais de domínio.

---

## Contexto e limites

Esta fase cria a camada `grc/` decidida em ADR-016 e as três capacidades admitidas por ela.
`Control` foi avaliado e **não** entra: um módulo de Controles pode ser seu dono exclusivo, e ele
é referenciado por porta (ADR-020), não possuído pelo núcleo.

A fase existe por uma razão concreta e verificada: no produto usado como referência de domínio,
`Evidence` está presa a um único tipo de sujeito por chave estrangeira obrigatória, e a entidade
de trabalho alcança apenas um domínio. O resultado é que achado de auditoria, incidente e
remediação de conformidade não têm onde registrar prova nem trabalho. Criar essas capacidades
dentro do primeiro módulo que precisar delas reproduz exatamente esse defeito.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sustentar uma decisão de GRC com prova (Priority: P1)

Uma gestora de riscos registra a decisão de aceitar um risco residual. Ela precisa anexar a prova
que sustenta a decisão: o relatório de teste de intrusão que demonstra que o controle compensatório
funciona. Meses depois, uma auditora precisa ver **qual prova sustentava aquela decisão na data em
que ela foi tomada** — mesmo que o relatório já tenha sido arquivado por vencimento.

**Why this priority**: Sem prova associada, toda decisão de GRC é afirmação sem lastro. É a
capacidade que mais domínios futuros consomem e a que menos depende de outras.

**Independent Test**: Registrar uma evidência, vinculá-la a um risco, arquivá-la e confirmar que
o vínculo histórico permanece legível e atribuível.

**Acceptance Scenarios**:

1. **Given** uma evidência registrada com arquivo anexado, **When** a usuária a vincula a um
   risco dentro do seu escopo, **Then** o vínculo é registrado com autor, data e evento de
   auditoria próprio.
2. **Given** uma evidência vinculada a dois riscos diferentes, **When** a usuária a arquiva,
   **Then** os dois vínculos permanecem consultáveis e identificados como históricos, e nenhum
   registro é excluído fisicamente.
3. **Given** uma evidência pertencente a uma unidade organizacional fora do escopo do ator,
   **When** ele tenta vinculá-la, **Then** o sistema responde como se ela não existisse.
4. **Given** uma evidência com data de validade no passado, **When** a usuária consulta evidências
   vencidas, **Then** ela aparece na lista com o vencimento visível.
5. **Given** uma evidência sem arquivo — apenas uma observação registrada — **When** ela é criada,
   **Then** o sistema a aceita, porque nem toda prova é um documento.

---

### User Story 2 — Rastrear trabalho de remediação numa única lista (Priority: P2)

Um responsável por remediação precisa ver, num só lugar, todo o trabalho atribuído a ele —
independentemente de a origem ser tratamento de risco, achado de auditoria ou lacuna de
conformidade. Hoje o trabalho de tratamento de risco vive apenas dentro do módulo de Riscos, e
qualquer domínio futuro que precise registrar trabalho teria de inventar o próprio conceito.

**Why this priority**: Depende de Evidence estar estabelecida (uma ação pode ser concluída com
prova), e é o ponto onde a duplicação futura seria mais cara — cinco sistemas independentes de
tarefa é o defeito concreto observado na referência de domínio.

**Independent Test**: Criar ações a partir de duas origens distintas, atribuí-las ao mesmo
responsável e confirmar que aparecem numa única lista com a origem identificada.

**Acceptance Scenarios**:

1. **Given** um risco com decisão de tratamento, **When** o gestor registra uma ação, **Then**
   ela nasce com origem identificada como tratamento de risco e permanece visível pelas telas de
   risco existentes, sem mudança de comportamento para quem já usa o módulo.
2. **Given** ações de origens diferentes atribuídas ao mesmo responsável, **When** ele consulta as
   suas ações, **Then** vê todas numa lista única com a origem de cada uma.
3. **Given** uma ação com prazo vencido e status em aberto, **When** o sistema apresenta ações
   atrasadas, **Then** ela é classificada como atrasada por uma única regra, aplicada em um só
   lugar.
4. **Given** uma ação concluída, **When** alguém tenta reabri-la, **Then** a reabertura é
   registrada como evento próprio, com autor e justificativa, e o histórico da conclusão anterior
   permanece.
5. **Given** um ator sem permissão de escrita sobre a origem da ação, **When** ele tenta criá-la,
   **Then** a operação é negada e a negação é auditada.

---

### User Story 3 — Registrar e encerrar um achado com rastro completo (Priority: P3)

Uma analista de conformidade identifica, numa autoavaliação de controles internos, que um
procedimento não está sendo seguido. Ela registra um achado, classifica sua severidade, indica a
recomendação, vincula a evidência que o comprova e abre a ação de remediação. Ao encerrar o
achado, precisa anexar a prova de que a correção ocorreu — e quem encerra não pode ser quem
remediou.

**Why this priority**: É o que torna o compartilhamento real em vez de teórico — com Achado,
Ação passa a ter duas origens e Evidência dois tipos de sujeito, exercitando o mecanismo. Depende
das duas anteriores.

**Independent Test**: Registrar um achado manualmente, vincular evidência e ação, encerrá-lo com
prova e confirmar que a proveniência inteira permanece reconstruível.

**Acceptance Scenarios**:

1. **Given** um achado aberto com ação de remediação vinculada, **When** a ação é concluída,
   **Then** o achado **não** encerra automaticamente — o encerramento é decisão explícita de
   alguém com autoridade para tal.
2. **Given** um achado remediado por um usuário, **When** esse mesmo usuário tenta encerrá-lo,
   **Then** o sistema recusa, pela mesma regra de segregação de funções já aplicada a aprovações.
3. **Given** um achado encerrado, **When** alguém consulta seu histórico, **Then** vê a sequência
   completa: abertura, evidência que o comprovou, ações abertas, conclusão e encerramento, com
   autor e data de cada passo.
4. **Given** um achado vinculado a um risco, **When** o risco é consultado, **Then** o achado
   aparece entre seus vínculos, sem que o módulo de Riscos precise conhecer o módulo de origem do
   achado.

   > **Correção, registrada no fechamento da fase em vez de dissimulada**: este cenário não foi
   > implementado, e não podia ser — não existe `Finding↔Risk` no modelo de dados que esta mesma
   > especificação define. FR-023 (abaixo) só declara achado referenciando evidências e ações; as
   > próprias Assumptions e Key Entities desta especificação não mencionam relação alguma entre
   > achado e risco. O cenário 4 sobreviveu de uma intenção inicial que a especificação, na sua
   > própria seção de requisitos, nunca chegou a fechar. Documentado como gap conhecido em
   > `docs/deferred-findings.md` F-37. Decisão de arquitetura, tomada depois desta especificação:
   > **adiado para a Fase 4 — Auditoria e Achados** (`docs/architecture/grc-roadmap.md`), onde
   > `Control` e o primeiro produtor não-manual de achado chegam junto, e a pergunta
   > `Finding↔Control` versus `Finding↔Risk` pode ser respondida com a informação que falta hoje.
   > Este cenário permanece no registro como fica — não satisfeito pela implementação desta fase —
   > em vez de ser reescrito para parecer que sempre esteve correto.

---

### Edge Cases

- **Evidência reutilizada e depois arquivada**: o arquivamento não pode apagar o fato histórico de
  que ela sustentava um achado no momento em que a auditoria concluiu.
- **Vínculo para sujeito fora de escopo**: um identificador válido é informação; a resposta deve
  ser indistinguível de "não existe".
- **Revogação de permissão com trabalho em aberto**: ações atribuídas a alguém que perde a
  permissão continuam existindo e permanecem atribuídas; apenas as operações passam a ser negadas.
- **Prazo de ação no passado na criação**: aceito, porque remediação atrasada é registrada como
  tal, não impedida.
- **Achado sem ação**: permitido — nem todo achado exige remediação (pode ser aceito formalmente),
  mas o encerramento sem ação exige justificativa.
- **Evidência sem arquivo, sem link e sem descrição**: recusado — uma prova precisa ter ao menos
  uma forma de ser lida por um humano.
- **Duas ações da mesma origem com o mesmo título**: permitido; não há unicidade natural.
- **Sujeito de vínculo excluído**: não ocorre — o produto não exclui fisicamente; o vínculo passa
  a apontar para um registro arquivado, que permanece legível.

---

## Requirements *(mandatory)*

### Requisitos funcionais — Evidência

- **FR-001**: O sistema MUST distinguir Arquivo de Evidência. Arquivo é armazenamento técnico;
  Evidência é o registro GRC que sustenta uma afirmação.
- **FR-002**: Uma evidência MUST poder existir referenciando um arquivo já armazenado, uma
  referência externa, ou apenas uma observação registrada em texto — mas MUST ter ao menos uma
  dessas formas.
  > **Revisão feita durante a implementação da US1, registrada aqui em vez de dissimulada**: o
  > arquivo alcança a evidência pelo mecanismo genérico de anexos (`Attachment`,
  > `entityType: EVIDENCE`) — nunca por uma coluna `fileId` própria, que se mostrou impossível de
  > popular corretamente (`Attachment` exige que seu registro pai já exista no momento em que é
  > criado; ver data-model.md §2 para o relato completo). A regra em nível de banco (invariante
  > E1) passou, em consequência, a exigir referência externa **ou** observação — uma evidência
  > apoiada em arquivo carrega sempre também uma observação de uma linha descrevendo o que o
  > arquivo demonstra, o que mantém a intenção desta FR (prova sempre legível por um humano)
  > verificável no banco.
- **FR-003**: Toda evidência MUST pertencer a exatamente uma unidade organizacional.
- **FR-004**: Toda evidência MUST ter identificador legível, título, tipo, responsável e data de
  coleta.
- **FR-005**: A data de coleta MUST ser distinta da data de registro, porque uma prova referente a
  março pode ser registrada em abril.
- **FR-006**: Uma evidência MUST poder declarar data de validade, e o sistema MUST permitir
  consultar evidências vencidas ou próximas do vencimento.
- **FR-007**: Uma evidência MUST poder ser vinculada a mais de um sujeito, quando legítimo.
- **FR-008**: Todo vínculo de evidência MUST registrar autor e data, e MUST gerar evento de
  auditoria próprio, distinto do evento de criação da evidência.
- **FR-009**: Evidência MUST ser arquivável, nunca excluída fisicamente. O arquivamento MUST
  preservar todos os vínculos históricos.
- **FR-010**: O sistema MUST registrar a procedência da evidência — como ela entrou no sistema.

### Requisitos funcionais — Ação

- **FR-011**: O sistema MUST oferecer **um único** conceito de Ação, consumível por múltiplas
  origens de domínio.
- **FR-012**: Toda ação MUST declarar sua origem por um conjunto **fechado** de tipos de origem,
  verificável em tempo de compilação.
- **FR-013**: Toda ação MUST ter título, responsável, prazo e estado.
- **FR-014**: A regra que determina se uma ação está atrasada MUST existir em **um único lugar**.
- **FR-015**: A conclusão de uma ação MUST registrar quando e por quem.
- **FR-016**: A reabertura de uma ação concluída MUST ser evento próprio, com autor e
  justificativa, preservando o registro da conclusão anterior.
- **FR-017**: Uma ação MUST poder referenciar evidências que comprovem sua execução.
- **FR-018**: O comportamento atual do módulo de Riscos MUST permanecer inalterado do ponto de
  vista de quem o usa — mesmas telas, mesmas rotas, mesmas respostas.
- **FR-019**: O sistema MUST NOT passar a ter dois conceitos concorrentes de ação sem um caminho
  de convergência declarado e datado.

### Requisitos funcionais — Achado

- **FR-020**: Um achado MUST representar uma constatação GRC — não um registro genérico de
  problema.
- **FR-021**: Todo achado MUST ter identificador legível, título, descrição, origem, categoria,
  severidade, responsável, unidade organizacional e estado.
- **FR-022**: Severidade e prioridade MUST ser conceitos distintos: severidade descreve a
  gravidade do que foi constatado; prioridade descreve a urgência de tratar.
- **FR-023**: Um achado MUST poder referenciar evidências que o comprovem e ações que o remediem.
- **FR-024**: A conclusão de todas as ações vinculadas MUST NOT encerrar o achado automaticamente.
- **FR-025**: Quem encerra um achado MUST ser pessoa distinta de quem executou sua remediação.
- **FR-026**: O encerramento sem ação de remediação MUST exigir justificativa registrada.
- **FR-027**: Achado MUST ser arquivável, nunca excluído.

### Requisitos funcionais — Transversais

- **FR-028**: Toda operação relevante sobre as três entidades MUST gerar evento de auditoria
  **semântico**, nomeado pela intenção do negócio, não por operação de banco.
- **FR-029**: Eventos de auditoria MUST preservar ator, momento, contexto de requisição, unidade
  organizacional, e valores anterior e posterior quando houver mudança de estado.
- **FR-030**: Ações negadas por falta de permissão ou por escopo MUST ser auditadas.
- **FR-031**: Toda operação MUST validar permissão **e** escopo organizacional de **todas** as
  entidades envolvidas, não apenas da principal.
- **FR-032**: Acesso a registro fora do escopo do ator MUST ser indistinguível de registro
  inexistente.
- **FR-033**: As permissões das três entidades MUST ser declaradas pelo mecanismo aprovado de
  agregação estática, com o módulo dono da sua própria definição.
- **FR-034**: Todo texto voltado ao usuário MUST estar em pt-BR, nos catálogos por área.
- **FR-035**: As três entidades MUST reutilizar comentários e anexos existentes, sem criar
  sistemas próprios.
- **FR-036**: O sistema MUST NOT introduzir tabela genérica de relacionamento, motor de workflow,
  motor de metadados, ou modelo de entidade universal.

### Key Entities

- **Evidência**: registro que sustenta uma afirmação de GRC. Pertence a uma unidade
  organizacional, tem responsável, tipo, procedência, data de coleta e validade opcional. Refere
  arquivo armazenado, referência externa ou observação. Vinculável a vários sujeitos. Arquivável.
- **Ação**: unidade de trabalho rastreável com responsável, prazo e estado, originada de um
  domínio identificado por conjunto fechado. Comprovável por evidência.
- **Achado**: constatação GRC com categoria, severidade, prioridade, recomendação e ciclo próprio.
  Comprovado por evidência, remediado por ações, encerrado por decisão explícita com segregação
  de funções.
- **Vínculo de Evidência**: associação nomeada entre uma evidência e um sujeito, com autor, data e
  histórico próprio.

---

## Success Criteria *(mandatory)*

- **SC-001**: Um usuário registra uma evidência e a vincula a um risco em menos de dois minutos,
  sem sair do contexto do risco.
- **SC-002**: Um responsável vê todo o trabalho atribuído a ele, de qualquer origem, numa única
  lista, com a origem de cada item identificada.
- **SC-003**: Dado um achado encerrado, um auditor reconstrói a sequência completa — abertura,
  prova, remediação, encerramento — sem consultar o banco de dados diretamente.
- **SC-004**: Arquivar uma evidência não remove nenhum vínculo histórico: 100% dos vínculos
  anteriores permanecem consultáveis.
- **SC-005**: Nenhuma tentativa de acesso fora do escopo organizacional revela a existência do
  registro — a resposta é idêntica à de um registro inexistente, verificada por teste.
- **SC-006**: O comportamento do módulo de Riscos permanece idêntico: 100% dos testes existentes
  do módulo continuam passando sem alteração.
- **SC-007**: A regra de vencimento de ação existe em exatamente um lugar do código, verificável
  por busca.
- **SC-008**: Um domínio futuro consegue passar a usar Evidência, Ação e Achado sem alterar
  arquivo de outro domínio, exceto uma linha de agregação de permissões e uma de catálogo.
- **SC-009**: Toda operação de negócio das três entidades tem evento de auditoria semântico
  correspondente, sem lacuna.
- **SC-010**: Consultas de valor — evidências a vencer, ações em aberto por responsável, ações
  atrasadas, achados sem remediação, achados por severidade — são respondidas pelo modelo sem
  varredura completa de tabela.

---

## Assumptions

- A camada `grc/` é criada nesta fase com as regras de fronteira já aplicadas por lint (ADR-016);
  nenhuma alteração de configuração de lint é necessária.
- Achado é criado manualmente nesta fase por perfil com permissão. Produtores automáticos
  (Auditoria, Conformidade, teste de controle) chegam em fases posteriores e não são pré-requisito.
- `Control`, `Framework`, `FrameworkVersion` e `Requirement` **não** são criados aqui. Nenhuma
  tabela, rota ou chave estrangeira especulativa para eles é introduzida.
- A convergência do trabalho de tratamento de risco para a Ação compartilhada é definida nesta
  especificação mas **executada** como migração dedicada; nenhuma migração destrutiva é assumida.
- Evidência, Ação e Achado **não** recebem entrada própria na navegação principal nesta fase; são
  expostas nos contextos de domínio que as consomem, mais uma tela de trabalho por responsável
  para Ação. A barra lateral não vira lista de tipos de entidade.
- Notificação de atribuição é desejável mas fica fora desta fase: a infraestrutura de notificações
  existe sem produtores, e ligá-la é decisão própria.
- O escopo organizacional segue o modelo hierárquico existente, com caminho materializado; nenhum
  atalho de tenancy é introduzido.
- Evidência de adulteração da trilha de auditoria permanece fora de escopo, conforme decidido no
  portão arquitetural.
