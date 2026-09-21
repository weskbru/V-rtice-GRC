# Research — Gestão de Controles (Fase 2)

Decisões tomadas antes do desenho, cada uma com a alternativa que foi descartada e por quê. Nada
aqui reabre decisão já aceita: onde uma ADR responde, a pesquisa apenas registra como ela se
aplica a este módulo.

---

## D-1 — Promover a tabela existente, não criar uma nova

**Decisão**: `Control` desta fase É a tabela `controls` já existente. A migração é **aditiva**:
colunas novas, todas nuláveis ou com padrão, mais as tabelas novas de verificação e vínculo.

**Razão**: `RiskControlLink.controlId` já é chave estrangeira para `controls`, e há vínculos
gravados. Criar uma segunda tabela exigiria migrar esses vínculos, e durante a janela existiriam
dois conceitos de controle — exatamente o defeito que o próprio roadmap aponta no Probo. A
promoção também é o que torna verdadeira a compatibilidade retroativa exigida pela especificação
(SC-006): nenhum teste de Risco precisa mudar porque nada do lado do Risco muda de forma.

**Alternativa descartada**: tabela `control_definitions` nova com migração de dados. Custo alto,
janela de duplicidade, e zero benefício — o registro mínimo não tem nada que precise ser
descartado.

**Consequência aceita**: controles preexistentes têm `ownerUserId`, natureza, tipo e frequência
nulos. A especificação já trata isso (FR-003): controle incompleto, nunca inválido. A ativação
exige dono (FR-005), então a incompletude não vaza para a operação.

---

## D-2 — Efetividade derivada, com um único calculador

**Decisão**: um serviço de domínio único, `ControlEffectivenessService`, é o único ponto que
responde "qual a efetividade deste controle". Ele recebe o histórico de verificações atestadas, a
frequência declarada e uma data de referência **passada como parâmetro obrigatório**, e devolve o
estado. Nenhuma coluna `effectiveness` gravada.

**Razão**: §19.7. O precedente literal é o `RiskScoringService`, único classificador de nível de
risco, e a decisão da Fase 1 de não materializar `EXPIRED` em `EvidenceStatus`, derivando o
vencimento de `validUntil`. A data como parâmetro obrigatório é a mesma decisão de
`isActionOverdue` (`grc/shared/domain/overdue.service.ts`): nenhuma leitura de relógio escondida
dentro da regra, para que ela seja testável sem manipular o tempo do processo.

> Correção do portão de análise: um rascunho desta seção chamava esse precedente de
> `OverdueService`. Não existe classe com esse nome — o artefato real é a função
> `isActionOverdue`. Referência por aproximação é como uma tarefa de implementação sai procurando
> algo que não está lá.

**Estados derivados**: `NOT_ASSESSED`, `EFFECTIVE`, `PARTIALLY_EFFECTIVE`, `INEFFECTIVE`,
`EXPIRED`. `EXPIRED` só é alcançável quando há frequência declarada (FR-015).

**Alternativa descartada**: coluna `current_effectiveness` mantida por gatilho ou por serviço de
aplicação. É a duplicação que §19.7 proíbe, e cria a pergunta insolúvel "qual das duas está certa
quando divergem".

**Consequência aceita**: filtrar o catálogo por efetividade exige calcular em SQL, não ler uma
coluna. Isso é resolvido pela mesma técnica que o registro de riscos já usa para `overdueReview` —
uma expressão no `SELECT` e no `WHERE`, com paridade explícita entre a expressão SQL e a função de
domínio, documentada nos dois lados.

---

## D-3 — Atestação pela infraestrutura de aprovação existente

**Decisão**: acrescentar `CONTROL_ASSESSMENT` a `ApprovableEntityType` e um caso de uso de
decisão. Nenhum motor de workflow.

**Razão**: §19.4 diz isso literalmente ("estender sign-off a um domínio novo é acrescentar valor
de enum e caso de uso"). A aprovação já é genérica e já foi exercitada pelo módulo de Riscos, o
que satisfaz §19.10 — o ponto de extensão já foi executado por código de produção real.

**Duas regras de segregação, não uma**:

1. quem executou a verificação não a atesta (espelha `solicitante ≠ aprovador` do Risco);
2. o dono do controle não atesta verificações do próprio controle (é a regra que o roadmap
   enuncia: "quem declara efetivo não é quem opera").

Elas são declaradas separadamente porque falham por motivos diferentes e precisam ser
independentemente testáveis. Quando a mesma pessoa acumula os dois papéis, ambas recusam — e o
motivo auditado nomeia as duas.

**Alternativa descartada**: uma única regra "atestador ∉ {executor, dono}". Compacta, mas produz
um motivo de recusa único e ambíguo na trilha, que é justamente o lugar onde a distinção importa.

---

## D-4 — ADR-020 aplicado: porta em `shared/`, vínculo do lado que registra

**Decisão**:

- `RiskControlLink` **permanece do lado do Risco**, com a chave estrangeira real para `controls`.
  Nada muda no esquema desse vínculo.
- `modules/risk` deixa de consultar a tabela `controls` diretamente e passa a depender de
  `ControlDirectoryPort`, declarada em `src/shared/grc-ports/`. `modules/controls` fornece o
  adaptador; o *composition root* liga os dois.
- A porta expõe o mínimo que ADR-020 permite: identificador, código, nome, unidade organizacional
  e estado ativo. Nunca o modelo de domínio de Controles.
- `ControlProcessLink` e `ControlAssetLink` são novos, do lado de Controles, com tipo próprio de
  entidade de auditoria cada um.

**Razão**: é o padrão aceito, e esta é sua primeira execução real. ADR-020 diz explicitamente que
o primeiro módulo a exercitá-lo deve reportar onde ele não coube.

**Onde o padrão foi apertado — a reportar (§19.10)**: a porta devolve a unidade organizacional do
alvo para que o lado que registra verifique escopo antes de gravar (parte 4). Mas o módulo de
Riscos **já** verifica escopo do controle hoje, lendo `controls.org_unit_id` direto. Trocar a
leitura direta pela porta é, portanto, refatoração sem mudança de comportamento — e é exatamente
por isso que ela precisa de teste próprio: uma troca que "não muda nada" é a que passa despercebida
quando quebra. O teste de fronteira (SC-007) verifica a ausência de import; o teste de escopo
verifica que a recusa continua idêntica.

**Correção — 2026-09-08 (fechamento de F-46, `docs/deferred-findings.md`)**: a afirmação acima —
"o módulo de Riscos **já** verifica escopo do controle hoje, lendo `controls.org_unit_id` direto"
— **era falsa**. Nunca foi verificada contra o código antes de ser escrita: `LinkControlUseCase`
checava apenas `isActive`, nunca `org_unit_id`, nem antes deste refactor para a porta nem depois
dele. A afirmação foi escrita como justificativa de que trocar a leitura direta pela porta era
"refatoração sem mudança de comportamento" — e o raciocínio que dependia dela (que por isso bastava
um teste de regressão de refusal, não um teste de escopo novo) sobreviveu **duas fases** sem
correção: primeiro registrada aqui como premissa, depois repetida como fato estabelecido em
`shared/grc-ports/control-directory.port.ts`'s próprio cabeçalho (que a contradisse corretamente,
mas só na segunda leitura), e o gap real — nenhuma checagem de escopo na direção Risco→Controle —
só foi fechado quando F-46 foi aberto e depois resolvido, na entrega registrada em
`docs/architecture/decisions.md` ADR-020 ("Verificação em código — 2026-09-08 (correção 3)") e em
`apps/api/src/modules/risk/application/links/control-link.usecase.ts`. A parte útil deste registro
não é a frase errada em si — é que uma afirmação nunca verificada, escrita para justificar que um
refactor era seguro, atravessou duas fases de trabalho sem que nenhuma delas a conferisse contra o
código. Isso é o que este parágrafo existe para deixar visível, não para apagar.

**Alternativa descartada**: mover `RiskControlLink` para o lado de Controles. Contraria a parte 1
de ADR-020 ("a ligação pertence ao lado que a registra" — é o Risco que decide que aquele controle
trata aquele risco) e quebraria compatibilidade retroativa sem ganho.

**Atualização — o que de fato aconteceu na direção inversa (Controles lê `RiskControlLink`)**:
esta decisão previu corretamente onde ADR-020 apertaria (a redundância de verificação de escopo
acima), mas não previu o ponto real em que o padrão não coube na primeira tentativa: a direção
**inversa**, `GET /controls/{controlId}/risks` (User Story 3, FR-021), que exige que
`modules/controls` leia o `RiskControlLink` que `modules/risk` possui.

Essa tarefa (User Story 3) tinha escopo que proibia editar `modules/risk` — propriedade de arquivo
concorrente com outra frente de trabalho, não uma regra de arquitetura. Sem poder colocar o
adaptador no módulo dono da tabela, a porta e seu adaptador ficaram provisoriamente dentro de
`modules/controls`, lendo `risk_control_links`/`risks` diretamente — um desvio documentado e
honesto (ver o cabeçalho original do arquivo da porta, preservado no histórico do git), mas ainda
assim um desvio: a parte 3 de ADR-020 exige que o adaptador seja fornecido pelo módulo que possui a
tabela, e por aquela tarefa não era o caso.

A causa raiz não era arquitetural. Assim que uma única mudança pôde tocar os dois módulos, a porta
foi movida para `src/shared/grc-ports/risk-control-link-read.port.ts` e seu adaptador para
`modules/risk/infrastructure/`, ligado por um módulo `@Global()` próprio
(`modules/risk/risk-control-link-read.module.ts`) que `RiskModule` importa — espelhando
exatamente `ControlDirectoryModule`/`ControlsModule` na direção oposta. O teste de fronteira
(`test/unit/controls-risk-module-boundary.spec.ts`, SC-007) permaneceu verde durante toda a
transição, nas duas direções.

**Conclusão a registrar**: o padrão de ADR-020 se sustentou nas duas direções assim que um único
agente pôde editar os dois módulos envolvidos. O que produziu o desvio não foi uma limitação da
arquitetura nem do padrão de cinco partes — foi uma restrição de propriedade de arquivo imposta a
um agente específico, temporária por natureza. Isso é diferente da redundância de verificação de
escopo relatada acima (que É uma tensão genuína entre a parte 4 de ADR-020 e o comportamento
pré-existente do módulo de Riscos): aquela permanece; esta foi fechada.

---

## D-5 — Evidência e Ação pelos registros de tipo fechado existentes

**Decisão**: acrescentar `CONTROL` a `EvidenceSubjectType` e `CONTROL_ASSESSMENT` a
`ActionOriginType`. Nenhuma tabela nova de evidência ou de ação.

**Razão**: ADR-018 e §19.6. É a segunda prova real do registro de tipo fechado, e o critério de
admissão do núcleo (§19.4) já foi satisfeito para essas duas capacidades na Fase 1.

**Consequência aceita**: a ação de remediação nasce com origem `CONTROL_ASSESSMENT`, não
`CONTROL`. A origem é o fato que justifica a ação — uma verificação que falhou —, não a entidade
genérica. Isso mantém a lista de trabalho única capaz de dizer *por que* a ação existe.

---

## D-6 — Ciclo de vida mínimo e fechado

**Decisão**: `DRAFT → ACTIVE`, `ACTIVE ↔ SUSPENDED`, e `RETIRED` alcançável **dos três**
estados anteriores, sendo terminal.

> **Corrigido pelo portão de análise, antes da implementação.** O rascunho desta decisão não
> previa `DRAFT → RETIRED`, e isso fazia de `DRAFT` uma armadilha: ativar exige dono (FR-005) e
> controle não é excluído fisicamente (FR-006), então um controle criado por engano — ou que
> nunca receba dono — não avançava nem se aposentava. É exatamente o defeito de estado
> inalcançável que esta mesma decisão cita como o que evitar, cometido na própria decisão que o
> cita.

**Razão**: cada estado tem consequência observável — `DRAFT` não exige dono e não aceita
verificação; `ACTIVE` exige dono e aceita verificação; `SUSPENDED` preserva histórico e não aceita
verificação nova; `RETIRED` é terminal e somente leitura. Estado sem consequência é estado
declarado e nunca exercido, que é a classe de defeito registrada sete vezes neste projeto — e que
o próprio `FindingStatus` da Fase 1 já cometeu, com dois estados inalcançáveis descobertos pelo
`/speckit.analyze`.

**Descartado explicitamente**: um estado `PENDING_APPROVAL` no controle. A aprovação desta fase
recai sobre a **verificação**, não sobre o controle; um estado de aprovação no controle não teria
operação que o alcançasse.

---

## D-7 — Frequência como enumeração fechada, não como expressão livre

**Decisão**: `ControlFrequency` com valores fechados (`CONTINUOUS`, `DAILY`, `WEEKLY`, `MONTHLY`,
`QUARTERLY`, `SEMIANNUAL`, `ANNUAL`), mais ausência de frequência.

**Razão**: a frequência alimenta uma regra derivada (o vencimento da efetividade, FR-014). Uma
expressão livre — texto, ou um agendamento tipo cron — transformaria essa regra em interpretação,
e o produto precisaria de um motor de agendamento que §19.4 já classifica como overengineering.
O conjunto fechado cobre o vocabulário real de GRC e mantém a derivação decidível.

**Alternativa descartada**: intervalo em dias, numérico e livre. Mais flexível e pior: "a cada 37
dias" não é uma frequência de controle que alguém governe, e o valor viraria dado sujo.

---

## D-8 — Um único ciclo de atestação por verificação, para sempre

**Decisão**: uma verificação admite **no máximo um** ciclo de atestação. Solicitar atestação uma
segunda vez — inclusive depois de uma decisão de recusa — é recusado. Discordar de um resultado
exige registrar uma **nova** verificação.

**Razão**: cai direto da imutabilidade (FR-010). Se uma verificação recusada pudesse ser
re-submetida, a mesma linha teria duas histórias de decisão, e a pergunta "o que foi atestado
sobre este controle em março" deixaria de ter resposta única. Uma nova verificação, sucedendo a
anterior, preserva as duas e mantém a trilha legível.

**Alternativa descartada**: reabrir a atestação da mesma verificação. Seria a única operação do
módulo capaz de alterar o significado de um registro imutável depois de gravado.

**Origem**: lacuna real, encontrada ao escrever o contrato — a especificação não dizia o que
acontece na segunda solicitação. Registrada aqui, e não apenas no YAML, porque é decisão de
domínio e não detalhe de transporte.

---

## D-9 — Solicitar atestação exige `control:test`; decidir exige `control:approve`

**Decisão**: quem pode registrar uma verificação pode submetê-la à atestação; apenas
`control:approve` decide.

**Razão**: submeter não é declarar. A permissão de submissão pertence à mesma classe de ator que
executa o teste, e a separação real de poder está na decisão — que é onde as invariantes C1 e C2
atuam. Exigir `control:approve` para submeter tornaria o solicitante e o aprovador a mesma classe
de usuário, esvaziando a segregação antes mesmo de ela ser verificada.

**Origem**: mesma lacuna de D-8. A especificação nomeava a permissão da decisão, não a da
solicitação.
