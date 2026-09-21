# Feature Specification: Auditoria e Achados

**Feature Branch**: `005-audit-findings`

**Created**: 2026-09-08

**Status**: Draft

**Input**: Fase 4 de `docs/architecture/grc-roadmap.md`. Depende das Fases 1–3, concluídas.

## O que esta fase fecha

O ciclo **requisito → controle → evidência → achado → ação** existe hoje em pedaços. Requisito e
controle se mapeiam (Fase 3); controle é verificado e sustentado por evidência (Fase 2); achado e
ação existem como capacidades compartilhadas (Fase 1). Falta o que os costura: um **engajamento de
auditoria** — o trabalho que examina um escopo, produz achados atribuíveis à sua origem, e os
acompanha até a remediação.

`Finding` **já existe** e não é criado aqui. Esta fase lhe dá o primeiro produtor não-manual e as
duas relações que a Fase 1 deliberadamente adiou.

### Uma dívida nomeada que esta fase paga

`FindingStatus` declara a aresta `OPEN → IN_REMEDIATION`, e o cabeçalho de `finding.entity.ts`
registra, com precisão, que **nenhuma operação a alcança**: um achado só chega a `IN_REMEDIATION`
reabrindo algo que foi fechado antes. A aresta ficou na tabela porque removê-la seria estreitar o
modelo aprovado sem documentar — a decisão certa na época, com a dívida registrada em vez de
escondida.

Um engajamento de auditoria é o produtor que faltava: é ele que abre um achado e o move para
remediação enquanto acompanha a correção. Esta fase torna a aresta alcançável ou a remove; não a
deixa declarada e inalcançável por uma terceira fase.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conduzir um engajamento de auditoria (Priority: P1)

Um auditor abre um engajamento: o que será examinado (uma versão de framework, um conjunto de
requisitos, ou controles específicos), em que período, e quem conduz. Trabalha nele, registra o que
encontra, e o encerra. O engajamento é o contexto que dá sentido aos achados — sem ele, um achado é
uma observação sem origem.

**Why this priority**: é a entidade que esta fase existe para criar. Entrega valor sozinha: o
registro auditável de que um exame ocorreu, sobre o quê, por quem e quando.

**Independent Test**: abrir um engajamento, definir seu escopo, percorrer o ciclo de vida até o
encerramento, e reabrir a trilha.

**Acceptance Scenarios**:

1. **Given** um usuário com permissão de auditoria, **When** abre um engajamento informando
   objetivo, período e responsável, **Then** ele é criado em planejamento, com código estável, e a
   criação fica na trilha.
2. **Given** um engajamento em planejamento, **When** o auditor define seu escopo vinculando-o a
   uma versão de framework e/ou a requisitos e controles específicos, **Then** os vínculos são
   gravados com autor e data, cada um auditado com tipo próprio.
3. **Given** um engajamento com escopo definido, **When** o auditor o inicia, **Then** ele passa a
   em execução e a transição é registrada com estados anterior e posterior.
4. **Given** um engajamento em execução, **When** o auditor o encerra, **Then** ele passa a
   concluído, deixa de aceitar achados novos, e continua integralmente legível.
5. **Given** um engajamento fora do escopo organizacional do ator, **When** ele tenta abri-lo,
   **Then** recebe a mesma resposta que receberia para um engajamento inexistente.

---

### User Story 2 - Registrar achados a partir do exame, e acompanhá-los até a remediação (Priority: P1)

Durante o engajamento, o auditor registra achados: o que observou, contra qual requisito ou
controle, e com que severidade. Cada achado nasce ligado ao engajamento que o produziu. Quando a
organização começa a corrigir, o achado passa a **em remediação** — e é aqui que a aresta declarada
desde a Fase 1 finalmente é percorrida. Fechar um achado exige prova.

**Why this priority**: também P1. Um engajamento que não produz achados rastreáveis não fecha ciclo
nenhum, e a dívida da Fase 1 continuaria aberta.

**Independent Test**: registrar um achado a partir de um engajamento, movê-lo para remediação,
tentar fechá-lo sem evidência, e fechá-lo com evidência.

**Acceptance Scenarios**:

1. **Given** um engajamento em execução, **When** o auditor registra um achado a partir dele,
   **Then** o achado é criado em aberto, ligado ao engajamento, e a origem fica visível no próprio
   achado.
2. **Given** um achado em aberto cuja correção começou, **When** ele é movido para remediação,
   **Then** a transição é aceita e auditada — a aresta `OPEN → IN_REMEDIATION`, declarada desde a
   Fase 1 e até aqui inalcançável, passa a ter operação que a percorre.
3. **Given** um achado sem evidência que o sustente, **When** alguém tenta fechá-lo, **Then** o
   fechamento é recusado.
4. **Given** o mesmo achado com evidência anexada, **When** é fechado por alguém que não o
   remediou, **Then** o fechamento é aceito e registrado com autor e justificativa.
5. **Given** um achado remediado por **A**, **When** **A** tenta fechá-lo, **Then** o fechamento é
   recusado e a tentativa é auditada — a segregação já vigente desde a Fase 1, agora exercitada
   pelo produtor real.
6. **Given** qualquer achado, **When** alguém tenta excluí-lo, **Then** não existe operação que o
   faça: um achado é arquivado, nunca apagado.

---

### User Story 3 - Ligar o achado ao que ele afeta (Priority: P2)

Um achado aponta para algo concreto: um controle que falhou, um risco que ele materializa, ou
ambos. Essas duas relações foram deliberadamente adiadas pela Fase 1 — a especificação daquela fase
assumiu `Finding ↔ Risco` prematuramente, e a decisão de forma ficou para quando `Control` e um
produtor real de achado existissem. Ambos existem agora.

**Why this priority**: depende de US1 e US2. O achado já tem valor ligado ao engajamento; ligá-lo
ao controle e ao risco é o que fecha o grafo.

**Independent Test**: ligar um achado a um controle e a um risco, desfazer um dos vínculos, e
confirmar que ambos permanecem no histórico.

**Acceptance Scenarios**:

1. **Given** um achado e um controle, ambos no escopo do ator, **When** os vincula, **Then** o
   vínculo é gravado com autor e data e auditado com tipo próprio.
2. **Given** um achado e um risco, **When** os vincula, **Then** o mesmo — e o risco passa a
   mostrar que um achado o referencia.
3. **Given** um alvo fora do escopo organizacional do ator, **When** tenta vinculá-lo, **Then** a
   resposta é idêntica à de um alvo inexistente e **nada é gravado**.
4. **Given** um ator sem permissão de leitura sobre o lado referenciado, **When** tenta vincular,
   **Then** a operação é recusada — as duas metades do ADR-020 parte 5, agora exigidas desde o
   primeiro dia deste módulo em vez de descobertas depois.
5. **Given** um vínculo existente, **When** é desfeito, **Then** ele sai dos vigentes e permanece
   no histórico com quem desfez e quando.

---

### Edge Cases

- **Engajamento concluído recebendo achado.** Recusado. O exame terminou; um achado novo pertence a
  outro engajamento.
- **Engajamento sem escopo sendo iniciado.** Recusado: um exame que não declara o que examina não
  produz achado atribuível.
- **Achado sem engajamento.** Permitido, e continua permitido: a Fase 1 criou o achado como
  capacidade compartilhada, alcançável por observação manual. Esta fase acrescenta um produtor, não
  torna o outro caminho ilegal.
- **Fechar achado cuja evidência foi arquivada depois de anexada.** A evidência arquivada continua
  sustentando o fechamento — arquivar não apaga o fato histórico (decisão da Fase 1). Só a ausência
  total de evidência recusa.
- **Controle aposentado ligado a achado aberto.** O vínculo permanece. Um achado sobre um controle
  que foi aposentado depois é exatamente o histórico que uma auditoria precisa conservar.
- **Engajamento cujo escopo referencia versão de framework despublicada ou requisito removido numa
  versão seguinte.** O escopo permanece apontando para o que foi realmente examinado. Reescrevê-lo
  para a versão nova falsificaria o registro do exame.
- **Reabertura de achado fechado.** Já existe desde a Fase 1 (`CLOSED → IN_REMEDIATION`) e continua
  valendo, com sua exigência de justificativa.

## Requirements *(mandatory)*

### Functional Requirements — engajamento

- **FR-001**: O sistema DEVE manter engajamentos de auditoria com identificador estável, código
  legível gerado pela plataforma, objetivo, período, responsável e unidade organizacional.
- **FR-002**: O engajamento DEVE ter estados explícitos de ciclo de vida e transições permitidas,
  cada transição auditada com estados anterior e posterior.
- **FR-003**: Iniciar um engajamento sem escopo declarado DEVE ser recusado.
- **FR-004**: Um engajamento concluído NÃO PODE receber achados novos, e DEVE permanecer
  integralmente legível.
- **FR-004a**: Um engajamento DEVE ter um caminho de descarte alcançável a partir de qualquer
  estado não terminal, exigindo justificativa, e o registro DEVE permanecer legível depois —
  nunca excluído.

  > **Acrescentado no portão de análise, e é a terceira vez.** O desenho previa apenas
  > `PLANNING → IN_PROGRESS → COMPLETED`, descartando um estado de cancelamento por não haver FR
  > que o pedisse (CLAUDE.md §2, não implementar o não especificado). A leitura é defensável e o
  > resultado não é: um engajamento aberto por engano, ou abandonado antes de ter escopo, não
  > avança (iniciar exige escopo, FR-003) e não some (não há operação de exclusão). Fica preso
  > para sempre.
  >
  > É exatamente o que a Fase 1 entregou em `FindingStatus` e o que a Fase 2 quase entregou no
  > `DRAFT` de controle — corrigido lá pelo mesmo portão, com o mesmo argumento. Encerrar o ciclo
  > de vida de um registro que o produto deixa criar não é funcionalidade nova; é completar a que
  > já existe. O que o §2 proíbe é inventar capacidade, não deixar um beco sem saída.
- **FR-005**: O escopo do engajamento DEVE poder referenciar versão de framework, requisitos e
  controles, por vínculos explícitos e nomeados, cada um com tipo próprio de auditoria.
- **FR-006**: O escopo registrado DEVE preservar o que foi examinado, mesmo que a norma ou o
  controle mudem depois.

### Functional Requirements — achados

- **FR-007**: O sistema DEVE permitir registrar um achado a partir de um engajamento em execução,
  com a origem visível no próprio achado.
- **FR-008**: Um achado criado sem engajamento DEVE continuar sendo possível — o caminho manual da
  Fase 1 permanece válido.
- **FR-009**: O sistema DEVE oferecer operação que mova um achado de aberto para em remediação,
  tornando alcançável a aresta declarada na Fase 1.
- **FR-010**: Fechar um achado DEVE exigir ao menos uma evidência que o sustente, **somando-se** à
  regra já vigente (ação vinculada concluída **ou** justificativa), nunca substituindo-a.

  > **Isto endurece uma regra já entregue, e é deliberado.** A invariante F1 de
  > `finding.entity.ts` hoje aceita fechar um achado com justificativa e nenhuma prova. O roadmap
  > da Fase 4 diz, textualmente, "fechamento exige evidência" — e fechar um achado de GRC sem
  > prova é exatamente a prática que um auditor externo aponta.
  >
  > A consequência precisa ser dita antes de alguém tropeçar nela: **testes da Fase 1 que fecham
  > achado só com justificativa passarão a falhar.** A regra deste projeto é tratar um teste que
  > precisa mudar como regressão a investigar. A investigação está feita e a conclusão é esta:
  > trata-se de endurecimento intencional, exigido pelo roadmap aprovado, não de acomodação para
  > fazer código novo passar. Quem alterar esses testes deve citar este requisito; quem os
  > encontrar alterados sem citação deve desconfiar.
- **FR-011**: Quem remediou um achado NÃO PODE fechá-lo, e a tentativa DEVE ser auditada.
- **FR-012**: NÃO PODE existir operação que exclua um achado; arquivamento é o único fim.

### Functional Requirements — relações

- **FR-013**: O sistema DEVE permitir vincular um achado a um controle e a um risco, por vínculos
  explícitos e nomeados, cada um com tipo próprio de auditoria.
- **FR-014**: Criar um vínculo DEVE exigir permissão de escrita no lado que registra **e**
  permissão de leitura no lado referenciado.
- **FR-015**: O alvo de um vínculo DEVE estar no escopo organizacional do ator, verificado **antes**
  de qualquer escrita; fora de escopo responde como inexistente e nada é gravado.
- **FR-016**: Desfazer um vínculo DEVE preservar o registro com autor e data.
- **FR-017**: Nenhum módulo de negócio PODE depender diretamente de outro; as dependências entre
  Auditoria, Controles, Riscos e Compliance DEVEM atravessar portas na camada compartilhada.

### Functional Requirements — transversais

- **FR-018**: Toda leitura e escrita de engajamento e de vínculo DEVEM respeitar o escopo
  organizacional do ator, respondendo como inexistente fora dele.
- **FR-019**: O sistema DEVE declarar permissões próprias para o engajamento de auditoria pelo
  mecanismo estático já aprovado, e DEVE estender o papel de auditor existente em vez de criar um
  redundante.

  > **Correção de colisão, encontrada no desenho.** `audit:view` **já existe** como permissão do
  > núcleo — é a leitura da trilha de auditoria (`core/authorization`) — e o papel `Auditor` já é
  > semeado com ela. Um recurso `audit:*` para engajamentos colidiria com uma permissão de
  > significado diferente, e um módulo `modules/audit/` colidiria com `core/audit/`. O recurso
  > desta fase é `audit-engagement:*`; o módulo é `modules/audit-engagements/`. Ler a trilha e
  > conduzir um exame são autoridades distintas e devem continuar nomeáveis separadamente.
- **FR-020**: A trilha DEVE registrar eventos que descrevem intenção de negócio (engajamento
  iniciado, escopo definido, achado registrado, achado em remediação, achado fechado, vínculo
  criado ou desfeito) e NÃO PODE reduzir tudo a um evento genérico de atualização.

### Key Entities

- **Audit**: o engajamento. Contexto que dá origem e atribuição aos achados.
- **AuditScopeLink**: o que o engajamento examina — versão de framework, requisito ou controle.
- **FindingControlLink** / **FindingRiskLink**: as duas relações que a Fase 1 adiou, agora
  decidíveis porque `Control` e um produtor real de achado existem.
- **Finding** *(já existente)*: não é criado aqui. Ganha produtor, relações e a aresta que faltava.

## Success Criteria *(mandatory)*

- **SC-001**: Um achado registrado por um engajamento mostra sua origem, e o engajamento lista os
  achados que produziu.
- **SC-002**: A aresta `OPEN → IN_REMEDIATION` é percorrida por uma operação real — verificável
  pelo teste que a exercita, não pela tabela de transições.
- **SC-002a**: Nenhum estado do engajamento é um beco sem saída: de todo estado não terminal existe
  ao menos uma transição alcançável, incluindo a partir de um engajamento sem escopo.
- **SC-003**: Nenhum achado é fechado sem evidência que o sustente — verificável tentando fechar,
  com justificativa válida e sem evidência, um achado que antes desta fase teria fechado.
- **SC-004**: Nenhum achado pode ser fechado por quem o remediou — recusa auditada.
- **SC-005**: Nenhuma operação do contrato exclui um achado.
- **SC-006**: Um alvo fora do escopo do ator produz resposta indistinguível da de um inexistente, e
  nada é gravado.
- **SC-007**: Os módulos de Riscos, Controles e Compliance continuam funcionando sem alteração:
  suas contagens de teste passam sem que nenhum teste deles tenha sido modificado. A exceção
  declarada é o fechamento de achado (FR-010): os testes do núcleo GRC que exercitam essa regra
  mudam por endurecimento intencional, e cada alteração deve citar FR-010.
- **SC-008**: Nenhum arquivo de `modules/audit` importa outro módulo de negócio, e vice-versa.

## Assumptions

- `Finding`, `Evidence` e `Action` permanecem capacidades do núcleo GRC compartilhado; esta fase as
  consome pelos mecanismos de tipo fechado existentes e não cria variantes.
- A segregação de funções no fechamento de achado já existe desde a Fase 1 e não é reimplementada —
  esta fase a exercita com o produtor real.
- Indicadores e relatórios sobre auditoria são fase posterior.
- Importação de programa de auditoria externo está fora desta fase.

## Dependencies

- Fases 1–3 concluídas, com CI verde.
- ADR-008, ADR-011, ADR-017, ADR-018, ADR-020 — aceitas e, no caso de ADR-020, verificadas em
  código nas duas direções, com as partes 4 e 5 fechadas em 2026-09-08. **Este módulo aplica as
  cinco partes desde o primeiro vínculo, em vez de descobri-las depois.**
