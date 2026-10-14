# Feature Specification: Compliance

**Feature Branch**: `004-compliance-management`

**Created**: 2026-09-08

**Status**: Draft

**Input**: Fase 3 de `docs/architecture/grc-roadmap.md`, governada por ADR-017 (Requisito e
Controle são entidades distintas; framework é versionado). Depende da Fase 2 (Controles),
concluída.

## O problema que esta fase resolve

Um controle único — "exigir MFA no acesso administrativo" — satisfaz simultaneamente cláusulas da
ISO 27001, do NIST e de norma interna. Modelado como entidade presa a um framework, ele se duplica
por norma, e com ele duplicam-se evidência, ações, dono e histórico.

Esta fase mapeia normas a controles **sem duplicar controles por norma**, e trata revisão de norma
como operação de primeira classe. Ambas as decisões são de ADR-017 e não são reabertas aqui.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manter a biblioteca normativa (Priority: P1)

Um gestor de conformidade cadastra as normas a que a organização responde — ISO 27001, um decreto,
uma política interna — e, dentro de cada uma, a **versão** vigente com suas cláusulas. Uma cláusula
pertence a exatamente uma versão e não é editável fora dela: revisar a norma significa criar uma
versão nova, não reescrever a antiga.

**Why this priority**: sem biblioteca normativa não há a que mapear. Entrega valor sozinha — o
catálogo de exigências a que a organização responde, versionado e auditável.

**Independent Test**: cadastrar uma norma, publicar uma versão com cláusulas, tentar editar uma
cláusula de uma versão já publicada, e reabrir a trilha.

**Acceptance Scenarios**:

1. **Given** um usuário com `compliance:administer`, **When** cadastra um framework e uma primeira
   versão em rascunho com suas cláusulas, **Then** framework, versão e cláusulas são criados, e a
   versão permanece editável enquanto estiver em rascunho.
2. **Given** uma versão de framework publicada, **When** alguém tenta alterar o texto de uma
   cláusula dela, **Then** a alteração é recusada e a trilha registra a tentativa.
3. **Given** uma versão publicada, **When** o gestor cria a versão seguinte, **Then** a nova versão
   nasce em rascunho, a anterior continua íntegra e legível, e ambas coexistem.
4. **Given** duas normas distintas que descrevem a mesma prática, **When** ambas são cadastradas,
   **Then** cada uma tem sua própria cláusula — a duplicação **entre normas** é correta e
   esperada.

---

### User Story 2 - Mapear cláusulas a controles, e migrar o mapeamento entre versões (Priority: P1)

O gestor liga cada cláusula aos controles que a satisfazem. Um controle serve quantas normas
satisfizer, sem cópia. Quando a norma é revisada, o mapeamento da versão anterior é **migrado**
para a nova como operação explícita e auditada, com o gestor decidindo o que se mantém, o que
muda e o que deixa de existir — nunca recadastro manual.

**Why this priority**: também P1, e não P2, porque é o requisito não negociável de ADR-017.
Retrofitar versionamento e migração depois de existirem mapeamentos é o beco sem saída que o
benchmark documentou. Uma biblioteca normativa sem migração de mapeamento é uma dívida que só
cresce.

**Independent Test**: ligar uma cláusula a dois controles e o mesmo controle a cláusulas de duas
normas; criar a versão seguinte; executar a migração; conferir o que foi transportado, o que ficou
pendente de decisão e o que a trilha registra.

**Acceptance Scenarios**:

1. **Given** uma cláusula e um controle, ambos no escopo do ator, **When** os vincula, **Then** o
   vínculo é gravado com autor e data, e a trilha o registra com os dois identificadores.
2. **Given** um controle já ligado a uma cláusula da ISO, **When** é ligado também a uma cláusula
   do NIST, **Then** ambos os vínculos coexistem sobre o **mesmo** controle — nenhuma cópia foi
   criada.
3. **Given** uma versão com mapeamentos e uma versão seguinte publicada, **When** o gestor executa
   a migração de mapeamento, **Then** cada cláusula da nova versão que corresponde a uma da
   anterior recebe os mesmos vínculos, e cada cláusula sem correspondência fica explicitamente
   **pendente de decisão** em vez de silenciosamente sem mapeamento.
4. **Given** uma migração executada, **When** a trilha é consultada, **Then** ela mostra a
   migração como um evento próprio, com versão de origem, versão de destino e o que foi
   transportado — não como uma sequência de vínculos avulsos indistinguível de trabalho manual.
5. **Given** um vínculo existente, **When** é desfeito, **Then** ele deixa de constar entre os
   vigentes e permanece no histórico com quem desfez e quando.

---

### User Story 3 - Declarar aplicabilidade e ler o estado de conformidade (Priority: P2)

Nem toda cláusula se aplica a toda organização. O gestor declara uma cláusula **não aplicável**
com justificativa — a declaração de aplicabilidade que auditor externo cobra. Para as aplicáveis,
o estado de conformidade é **calculado** a partir dos controles ligados e da efetividade
verificada deles; ninguém o digita.

**Why this priority**: depende de US1 e US2 existirem. Entrega o que torna o módulo utilizável por
quem responde a auditoria, mas o mapeamento sozinho já tem valor.

**Independent Test**: declarar uma cláusula não aplicável com justificativa; ler o estado de outra
cláusula antes e depois de o controle ligado a ela ter uma verificação atestada.

**Acceptance Scenarios**:

1. **Given** uma cláusula aplicável por padrão, **When** o gestor a declara não aplicável **sem**
   justificativa, **Then** a declaração é recusada.
2. **Given** a mesma cláusula, **When** a declara não aplicável **com** justificativa, **Then** a
   declaração é gravada com autor, data e justificativa, e a cláusula deixa de contar no estado de
   conformidade da versão.
3. **Given** uma cláusula sem nenhum controle ligado, **When** seu estado é consultado, **Then**
   ela é apresentada como **não atendida**, nunca como conforme por omissão.
4. **Given** uma cláusula ligada a um controle sem verificação atestada, **When** seu estado é
   consultado, **Then** ela é apresentada como **não comprovada** — mapeada, mas sem prova.
5. **Given** a mesma cláusula depois de o controle receber verificação atestada como efetiva,
   **When** seu estado é consultado, **Then** ela é apresentada como conforme, e a mudança é
   auditada com valor anterior e posterior.
6. **Given** uma cláusula ligada a dois controles, um efetivo e outro inefetivo, **When** seu
   estado é consultado, **Then** ela é apresentada como **parcialmente atendida** — a regra é uma
   só e está no calculador único.

---

### Edge Cases

- **Versão publicada sem cláusulas.** Recusada: uma versão de norma sem exigência alguma não é uma
  norma, é um cadastro vazio que passaria a contar como 100% conforme.
- **Migração para uma versão que já tem mapeamentos.** Recusada, ou executada apenas sobre as
  cláusulas ainda sem vínculo — nunca sobrescrevendo decisão já tomada na versão de destino.
- **Cláusula não aplicável ligada a controle.** Permitido, e o vínculo permanece: a organização
  pode ter o controle por outra razão. Mas a cláusula não aplicável não entra no cálculo, e a
  interface precisa deixar isso visível para não parecer contradição.
- **Controle aposentado ligado a cláusula vigente.** O vínculo permanece (histórico), e a cláusula
  passa a **não comprovada** — um controle aposentado não sustenta conformidade. Não é erro; é o
  cálculo funcionando.
- **Framework sem versão alguma.** Legível, e explicitamente sem estado de conformidade — não zero
  por cento, que é uma afirmação diferente de "não há o que medir".
- **Duas versões vigentes ao mesmo tempo.** Permitido durante transição. O estado de conformidade
  é sempre **por versão**, nunca um número único do framework que esconderia qual norma foi medida.
- **Cláusula removida na versão seguinte.** Seus vínculos permanecem na versão antiga, íntegros. A
  cláusula não é excluída de lugar nenhum.

## Requirements *(mandatory)*

### Functional Requirements — biblioteca normativa

- **FR-001**: O sistema DEVE manter frameworks com identificador estável, nome, descrição e origem
  (norma externa ou política interna).
- **FR-002**: Um framework DEVE poder ter múltiplas versões, cada uma com identificação própria e
  estado de publicação explícito.
- **FR-003**: Uma cláusula (requisito) DEVE pertencer a exatamente uma versão de framework, nunca
  ao framework diretamente.
- **FR-004**: Uma cláusula DEVE ser editável apenas enquanto sua versão não estiver publicada;
  depois disso, alterações DEVEM ser recusadas e a tentativa auditada.
- **FR-005**: Publicar uma versão sem cláusula alguma DEVE ser recusado.
- **FR-006**: Criar uma versão nova NÃO PODE alterar nem invalidar a anterior.
- **FR-007**: A mesma exigência descrita em duas normas DEVE existir como duas cláusulas distintas;
  o sistema NÃO PODE deduplicá-las.

### Functional Requirements — mapeamento e migração

- **FR-008**: O sistema DEVE permitir ligar uma cláusula a muitos controles e um controle a muitas
  cláusulas, por vínculo explícito e nomeado, com tipo próprio na trilha de auditoria.
- **FR-009**: O sistema NÃO PODE criar cópia de controle por norma; um controle ligado a cláusulas
  de normas diferentes DEVE permanecer um único registro.
- **FR-010**: Criar e desfazer um vínculo DEVEM ser auditados com os dois identificadores.
- **FR-011**: Desfazer um vínculo DEVE preservar o registro com autor e data; ele NÃO PODE ser
  excluído fisicamente.
- **FR-012**: O sistema DEVE oferecer a migração de mapeamento entre duas versões do mesmo
  framework como operação explícita e auditada, com um evento próprio identificando origem,
  destino e o que foi transportado.
- **FR-013**: A migração DEVE deixar explicitamente **pendente de decisão** toda cláusula da versão
  de destino sem correspondência na origem; ela NÃO PODE deixá-la silenciosamente sem mapeamento.
- **FR-014**: A migração NÃO PODE sobrescrever mapeamento já decidido na versão de destino.

### Functional Requirements — aplicabilidade e estado

- **FR-015**: O sistema DEVE permitir declarar uma cláusula não aplicável, exigindo justificativa.
- **FR-016**: Uma cláusula não aplicável NÃO PODE entrar no cálculo de conformidade da versão, e
  essa exclusão DEVE ser visível.
- **FR-017**: O estado de conformidade de uma cláusula DEVE ser derivado dos controles ligados e da
  efetividade verificada deles, por um único ponto de cálculo; ele NÃO PODE existir como campo
  editável.
- **FR-018**: Uma cláusula sem controle ligado DEVE ser apresentada como não atendida, nunca como
  conforme.
- **FR-019**: Uma cláusula cujos controles não tenham verificação atestada DEVE ser apresentada
  como não comprovada — distinta de não atendida e de conforme.
- **FR-020**: O estado de conformidade de uma **versão** DEVE ser calculado a partir do estado de
  suas cláusulas aplicáveis, pelo mesmo calculador único.
- **FR-021**: Mudança de estado de conformidade DEVE ser auditada com valor anterior e posterior, e
  o evento DEVE deixar explícito que registra o momento em que a mudança foi **observada**, não o
  momento em que ela ocorreu.

  > A causa de uma mudança de estado costuma ser um fato do módulo de Controles — uma atestação
  > decidida — dentro de uma transação da qual Compliance não participa. A detecção acontece na
  > leitura seguinte do requisito (research.md D-11). Isso é aceitável; o que não seria aceitável é
  > uma trilha cujo carimbo de tempo parecesse dizer quando o fato aconteceu. Uma trilha que induz
  > o leitor a datar errado um evento é pior que uma trilha atrasada e honesta, porque a primeira
  > não se anuncia.

### Functional Requirements — transversais

- **FR-022**: O escopo organizacional DEVE ser aplicado onde há registro escopado a proteger — nos
  vínculos com controle, cujo alvo precisa estar dentro do escopo do ator, respondendo como
  inexistente quando não estiver.

  > **Correção deste requisito, feita durante o desenho.** A redação original exigia escopo
  > organizacional em *toda* leitura e escrita deste módulo. Está errada, e a razão é a mesma que
  > acabou de custar uma correção bloqueante ao módulo de Riscos (F-34): o escopo expande **para
  > baixo**, nunca para cima. Um framework é uma norma da organização inteira; se carregasse
  > `orgUnitId`, ele só existiria numa unidade — e quem tivesse grant apenas num departamento não
  > enxergaria a ISO 27001, porque a raiz não é descendente do departamento. O requisito, como
  > escrito, produziria exatamente o defeito que acabei de corrigir noutro módulo.
  >
  > `Framework`, `FrameworkVersion` e `Requirement` são catálogo de plataforma, governados por
  > permissão — o mesmo padrão já provado por `Role` e `Permission`, que também não têm
  > `orgUnitId`. Escopo organizacional se aplica onde existe dado escopado: o controle do outro
  > lado do vínculo. Ver research.md D-2.
- **FR-023**: O sistema DEVE declarar permissões próprias de conformidade pelo mecanismo estático
  já aprovado.
- **FR-024**: Nenhum módulo de negócio PODE depender diretamente de outro; a dependência entre
  Compliance e Controles DEVE atravessar porta declarada na camada compartilhada, expondo o
  mínimo necessário.
- **FR-025**: A trilha DEVE registrar eventos que descrevem intenção de negócio (versão publicada,
  cláusula vinculada, mapeamento migrado, aplicabilidade declarada, conformidade alterada) e NÃO
  PODE reduzir tudo a um evento genérico de atualização.

### Key Entities

- **Framework**: a norma a que a organização responde. Não contém cláusulas diretamente.
- **FrameworkVersion**: uma revisão da norma. Publicada ou em rascunho. É o que se mede.
- **Requirement**: a cláusula. Pertence a exatamente uma versão; imutável depois de publicada.
- **RequirementControlLink**: o mapeamento N:M entre cláusula e controle, com significado próprio e
  tipo de auditoria próprio.
- **RequirementApplicability**: a declaração de que uma cláusula não se aplica, com justificativa,
  autor e data.

## Success Criteria *(mandatory)*

- **SC-001**: Um controle ligado a cláusulas de três normas permanece um único registro —
  verificável contando controles antes e depois do mapeamento.
- **SC-002**: Nenhuma cláusula aparece como conforme sem que exista controle ligado com verificação
  atestada que a sustente.
- **SC-003**: Uma cláusula de versão publicada não pode ser alterada por nenhuma operação do
  contrato.
- **SC-004**: A migração de mapeamento entre versões é executável e auditável como um único evento,
  e nenhuma cláusula de destino fica sem decisão registrada.
- **SC-005**: Um controle fora do escopo do ator, referenciado ao criar um mapeamento, produz
  resposta indistinguível da de um controle inexistente.
- **SC-006**: Os módulos de Riscos e de Controles continuam funcionando sem alteração: suas
  contagens de teste passam sem que nenhum teste deles tenha sido modificado para acomodar esta
  fase.
- **SC-007**: Nenhum arquivo de `modules/compliance` importa `modules/controls` ou `modules/risk`,
  e vice-versa.
- **SC-008**: O estado de conformidade de uma versão com 500 cláusulas é apresentado em menos de
  2 segundos.

## Assumptions

- Controles existem e são consumidos por porta compartilhada, como Riscos já os consome; esta fase
  não altera o módulo de Controles.
- Evidência sustenta conformidade **através do controle**, não diretamente da cláusula: a prova de
  que uma salvaguarda funciona pertence à salvaguarda. Ligar evidência diretamente a uma cláusula
  criaria um segundo caminho de prova e uma segunda regra de cálculo.
- Engajamento de auditoria, achado de auditoria e a relação achado↔cláusula são a Fase 4.
- A importação automatizada de texto normativo (ISO, NIST) está fora desta fase: as cláusulas são
  cadastradas pela interface ou por semeadura. Importador é trabalho posterior e não muda o modelo.

## Dependencies

- Fase 1 (núcleo GRC compartilhado) e Fase 2 (Controles) — concluídas.
- ADR-017 (governa este módulo inteiro), ADR-008, ADR-011, ADR-018, ADR-020 — aceitas e
  verificadas em código na Fase 2.
