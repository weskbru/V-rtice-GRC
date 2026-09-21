# Research — Gestão de Incidentes e Gestão de Problemas

**Feature**: `008-incidents-problems` · **Spec**: [spec.md](./spec.md) · **Date**: 2026-09-11

Cada decisão abaixo foi tomada contra o repositório real (schema, código, documentos de arquitetura
já existentes), nunca contra a intuição de como o projeto "provavelmente" resolveria a pergunta —
a mesma disciplina que `006-assets-processes/research.md` já registrou, pela mesma razão: este
projeto já pagou três vezes por uma causa escrita com confiança e errada
(`specs/005-audit-findings/STATE.md` §6).

As três perguntas genuinamente de produto (origem do problema em incidentes, cardinalidade do
vínculo, interação entre os dois fechamentos) foram trazidas ao coordenador antes de qualquer
resposta ser fixada em código ou em schema, e decididas por ele em 2026-09-11 — D-13 a D-15, mais
adiante neste mesmo documento, registram as três com a razão anexada. D-1 a D-12 abaixo não
pressupõem nenhuma das três respostas.

---

## D-1 — Dois módulos, não um "módulo de ocorrências"

**Decisão**: `apps/api/src/modules/incidents/` e `apps/api/src/modules/problems/`, separados, com a
mesma forma interna de `modules/controls`/`modules/risk` (domain/application/infrastructure/
presentation).

**Razão**: CLAUDE.md §1 nomeia os dois como itens distintos da lista de módulos planejados
("Gestão de Problemas", "Gestão de Incidentes"), e a Constituição, Princípio I, exige um contexto
delimitado por domínio GRC. Um módulo único juntando os dois seria a caixa genérica que CLAUDE.md
§19.3 proíbe por nome, e obrigaria qualquer domínio futuro que precise de só um dos dois a depender
do par — exatamente o acoplamento que a promoção de Ativo/Processo (006) existiu para desfazer em
outro contexto.

**Alternativas rejeitadas**:
- *Um módulo `incident-management/` com os dois dentro* — junta dois domínios GRC nomeados
  separadamente pela própria Constituição.
- *Problema como sub-recurso de Incidente* (`/incidents/{id}/problems`) — pressuporia a resposta de
  Q1 (origem obrigatória em incidente) antes de ela ser decidida, e um problema autônomo (Q1,
  alternativa proativa) não teria onde morar nessa forma.

---

## D-2 — As duas capacidades compartilhadas, e nenhuma outra

**Decisão**: `Incident`/`Problem` consomem `grc/action` (via `ActionOriginType += INCIDENT, PROBLEM`)
e `grc/evidence` (via `EvidenceSubjectType += INCIDENT, PROBLEM`) — ambos já capacidades do núcleo
GRC, provadas por dois consumidores reais cada uma (Risco e Achado, ao menos). Nenhuma tabela de
tarefa, arquivo ou aprovação própria é criada.

**Razão**: é a condição que o roteiro (`grc-roadmap.md` §1) registrou para esta fase poder começar —
"Incidentes é o segundo consumidor real de `Action` além de Riscos" — e a exigência textual do
coordenador. O critério de admissão de §19.4 (3+ domínios, nenhum dono exclusivo) já está satisfeito
para `Action` e `Evidence` antes mesmo desta fase: `Action` tem `RISK_TREATMENT`, `FINDING` e
`CONTROL_ASSESSMENT`; `Evidence` tem `RISK`, `RISK_TREATMENT_DECISION`, `FINDING`, `ACTION`,
`CONTROL`. Acrescentar `INCIDENT`/`PROBLEM` a cada um é extensão de registro fechado (§19.3
mecanismo 2), não criação de capacidade nova — não precisa reaplicar o teste de admissão.

**Alternativas rejeitadas**:
- *`IncidentTask`/`ProblemAction` próprios, espelhando `RiskTreatmentAction`* — é exatamente o
  padrão que a Fase 007 acabou de desfazer (duas autoridades de escrita para o mesmo trabalho). Não
  há razão para reintroduzi-lo num terceiro módulo, três dias depois de o segundo ser corrigido.
- *`IncidentAttachment`/`ProblemAttachment` próprios* — repetiria o que `core/files` já resolve por
  `AttachableEntityType`, e sem nenhum requisito que uma tela de anexo genérica não cubra.

> **Adiado em metade, 2026-09-11, na implementação da fundação — decisão do coordenador (spec.md
> FR-016).** A metade `Evidence` desta decisão foi construída de verdade nesta passagem
> (`IncidentEvidenceSubjectAccessor`/`ProblemEvidenceSubjectAccessor`, registrados). A metade
> `Action` **não foi** — `test/unit/action-model-convergence-guard.spec.ts` exige um
> `ActionOriginAccessor` de quatro métodos por valor, um deles com consulta filtrada por escopo, e
> escrevê-lo sem teste dedicado a esta hora era o mesmo risco de integração apressada que o
> coordenador já havia nomeado para o vínculo Incidente↔Problema. **Dito sem eufemismo**: até essa
> peça existir (Fase 6, tasks.md), nem Incidente nem Problema podem ser origem de uma `Action` —
> `POST /actions` com `originType: INCIDENT`/`PROBLEM` não resolve, e o fechamento de Problema
> (FR-010, invariante P2) não é alcançável. Não é um detalhe residual desta decisão; é a maior parte
> do valor que ela prometia, ainda pendente. Consequência física, registrada em
> `docs/local-environment.md` D-18/D-19: a migração chegou a estender `ActionOriginType` antes desta
> correção, foi aplicada a ambos os bancos locais por um erro de variável de conexão (D-18), e os
> dois carregam hoje um valor inerte de `ActionOriginType` que o Postgres não permite remover —
> inofensivo, porque nenhum acessor existe para escrevê-lo, mas é drift real e permanente nesses
> dois bancos especificamente.

> **Resolvido, 2026-09-11, mesma noite — a metade `Action` foi construída.**
> `IncidentActionOriginAccessor`/`ProblemActionOriginAccessor` existem, com os quatro métodos
> (`resolveEditableOrigin`/`resolveViewableOrigin`/`resolveOriginScope`/`listOriginIdsInScope`),
> registrados em `IncidentsModule`/`ProblemsModule`. Três provas, todas por teste de integração real
> (`test/integration/incident-problem-action-origin.spec.ts`), não por leitura de código:
>
> 1. **Recusa indistinguível e chaveada pelo id que o chamador de fato enviou** — uma origem real
>    mas fora de escopo e uma origem genuinamente inexistente produzem a mesma
>    `NotFoundDomainError`, com a mesma mensagem trocando só o id.
> 2. **Escopo ao vivo, nunca o valor gravado na criação** — um incidente/problema criado na unidade
>    A, com uma `Action` já criada a partir dele, é realocado para a unidade B por escrita direta
>    (nenhum caso de uso de realocação existe ainda, Fase 3/4); o ator que permaneceu na unidade A
>    perde acesso à `Action`, e um ator novo escopado à unidade B ganha — nos dois sentidos, provando
>    que a checagem é recalculada a cada chamada, não herdada do momento da criação.
> 3. **O guard é a prova, não decoração** — `test/unit/action-model-convergence-guard.spec.ts`,
>    verificado manualmente removendo a chamada de registro e confirmando a falha
>    ("`ActionOriginType "INCIDENT" has 0 registration call sites`"), depois restaurando.
>
> `ActionOriginType` ganhou `INCIDENT`/`PROBLEM` de volta numa migração própria e separada
> (`20260911030000_action_origin_type_add_incidents_problems`, `ADD VALUE IF NOT EXISTS`) — nunca
> misturada de volta à migração da fundação, para que as duas decisões (criar as tabelas; estender
> este enum específico só quando o acessor existisse) continuem legíveis como duas, não uma.
> Verificado diretamente contra `pharos_grc_test` (que já carregava os dois valores pelo acidente
> descrito acima, D-18/D-19): a migração aplica sem erro e relata "sem migrações pendentes" na
> reexecução imediata — o mesmo resultado que produziria contra um banco genuinamente novo.

---

## D-3 — Mecanismo de relacionamento: só os dois de §19.3

**Decisão**: toda relação entre Incidente/Problema e outro domínio GRC usa exatamente um dos dois
mecanismos sancionados — tabela de ligação nomeada (Risco, Ativo, Processo) ou registro de tipo
fechado (Ação, Evidência, Anexo, Comentário). Nenhuma tabela `related_entity(type, id)`, nenhum
discriminador em string livre.

**Razão**: é a proibição explícita de CLAUDE.md §19.3, reforçada pelo benchmark ("o Probo tentou
mecanismos semi-genéricos quatro vezes e reverteu todas"). As quatro tabelas de ligação novas
(`IncidentRiskLink`, `IncidentAssetLink`, `IncidentProcessLink`, `ProblemRiskLink`) seguem, campo a
campo, a forma de `FindingRiskLink` — o precedente mais recente do mesmo mecanismo.

**Alternativa rejeitada**: um `IncidentRelatedEntity(entityType, entityId)` único cobrindo Risco,
Ativo e Processo de uma vez, para "economizar" três tabelas. Rejeitada pela mesma razão que ADR-008
já rejeitou o equivalente para tipos de auditoria: perde a FK real, perde `onDelete: Restrict`
verificável pelo banco, e mistura três predicados de escopo (risco, ativo, processo têm três
`ScopeFilter` diferentes) atrás de um único `entityId` opaco.

---

## D-4 — Ciclo de vida do Incidente: cinco estados, cada um com consequência

**Decisão**: `IncidentStatus = OPEN | IN_PROGRESS | RESOLVED | CLOSED | CANCELLED`.

| Estado | Consequência observável |
|---|---|
| `OPEN` | aparece nas filas de trabalho; nenhuma ação corretiva ainda é exigida |
| `IN_PROGRESS` | alguém assumiu a condução; aparece em "meus incidentes em andamento" |
| `RESOLVED` | impacto mitigado; exige `resolutionSummary`; para de contar como "ativo" em qualquer indicador futuro de tempo de resolução, mas continua editável até `CLOSED` |
| `CLOSED` | somente leitura para campos descritivos; ponto de corte para métricas de tempo de resolução |
| `CANCELLED` | terminal, distinto de `CLOSED` — exclui o registro de qualquer métrica de tempo de resolução (nunca foi um incidente real) |

**Razão**: este projeto já tem uma regra própria, testada, contra estado sem consequência —
`003-controls-management` T025 verifica exatamente isto ("nenhum estado declarado é inalcançável"),
e a Fase 6 do roteiro já registrou a lição de `FindingStatus`/`DRAFT` de Controles como avisos.
Cinco estados, cada um justificado por uma consequência distinta, evita repetir esse defeito.

**Alternativas rejeitadas**:
- *Três estados (`OPEN | RESOLVED | CLOSED`), espelhando o mínimo de `Action`* — perderia a
  distinção entre "alguém está trabalhando nisto" e "ninguém ainda pegou", que é exatamente a
  pergunta que uma fila de incidentes precisa responder primeiro.
  Perderia também `CANCELLED`, obrigando um incidente falso ou duplicado a contar como resolvido nas
  métricas — o mesmo defeito que motivou `CANCELLED` em `ActionStatus`.
- *Espelhar `FindingStatus` exatamente (`OPEN | IN_REMEDIATION | CLOSED | ARCHIVED`)* — `ARCHIVED`
  existe em `Finding` para remover um achado de vistas padrão sem apagar histórico; um incidente
  fechado já cumpre esse papel sozinho (não há um segundo estado "além de fechado" que este domínio
  precise). Adicionar `ARCHIVED` sem um requisito que o use seria o mesmo erro que §19.10 nomeia.

---

## D-5 — Ciclo de vida do Problema: nomenclatura própria, mesma forma

**Decisão**: `ProblemStatus = OPEN | IN_ANALYSIS | RESOLVED | CLOSED | CANCELLED`.

**Razão**: mesma forma de `IncidentStatus` (cinco estados, mesmas posições), com um nome de estado
adaptado ao vocabulário de problema: `IN_ANALYSIS` em vez de `IN_PROGRESS`, porque o trabalho de um
problema é predominantemente investigativo (achar a causa raiz), não uma mitigação em andamento.
`RESOLVED` exige `rootCause`; `CLOSED` exige a `Action` corretiva concluída (D-7).

**Alternativa rejeitada**: nomear os estados de Problema de forma totalmente diferente dos de
Incidente (por exemplo, um vocabulário de "Conhecido/Erro Conhecido" do ITIL clássico). Rejeitada
porque introduziria vocabulário novo sem que nenhum requisito desta especificação o peça, e
divergiria sem necessidade da simetria que os dois domínios já compartilham em todo o resto (mesma
tabela de campos, mesmo padrão de vínculo).

---

## D-6 — Fechar um Incidente não exige segregação de funções

**Decisão**: qualquer usuário com `incident:transition` pode fechar um incidente que ele mesmo
resolveu. Nenhuma exigência de "quem fecha é diferente de quem resolveu".

**Razão**: resposta a incidente é frequentemente conduzida por uma única pessoa ou por um plantão
pequeno; exigir um segundo ator só para fechar introduziria fricção operacional sem que nenhum
requisito de segurança a peça — ao contrário de `Finding`, cujo FR-025 exige segregação
explicitamente porque um achado de auditoria tem a garantia de independência entre quem executa a
remediação e quem certifica que ela está completa como parte do próprio valor do produto (é uma
auditoria). Um incidente operacional não carrega essa mesma garantia declarada em nenhum FR.

**Alternativa rejeitada**: replicar a segregação de `Finding` para `Incidente` "por consistência".
Rejeitada porque consistência entre domínios não é, por si, requisito (o mesmo argumento que D-3 de
`006` já usou para recusar um ciclo de vida de quatro estados em Ativo "por simetria" com Controle) —
e porque nenhuma acceptance scenario desta especificação pede a garantia.

---

## D-7 — Fechar um Problema exige causa raiz, ação concluída e segregação de funções

**Decisão**: a transição para `CLOSED` de um `Problem` exige, nesta ordem de verificação: (1)
`rootCause` preenchido; (2) ao menos uma `Action` com `originType = PROBLEM` e `originId` igual ao
problema, em `COMPLETED`; (3) o usuário que fecha ser diferente do usuário que concluiu essa ação.

**Razão**: um problema, ao contrário de um incidente, existe precisamente para produzir uma correção
definitiva — fechá-lo sem uma **ação concluída e verificável** reintroduziria exatamente o padrão
que F-27 (`docs/deferred-findings.md`) já nomeou como o defeito de assinatura deste projeto: "uma
alegação de verificação sem nada por trás." A segregação de funções segue o precedente direto e já
aprovado de `Finding` (FR-025, `close-finding.usecase.ts`) — a mesma garantia de independência entre
quem fez o trabalho e quem certifica que ele está completo, desta vez aplicada a "quem resolveu
tecnicamente" versus "quem decide que o problema está fechado".

**Alternativa rejeitada**: fechar com `rootCause` preenchido apenas, sem exigir uma `Action`
concluída. Rejeitada porque um campo de texto livre não é prova de correção — é exatamente a
diferença que este projeto já trata como central entre "afirmar" e "verificar" em toda sua
documentação de achados.

---

## D-8 — `orgUnitId`: coluna obrigatória, seguindo `Risk`/`Finding`, não `Asset`/`Control`

**Decisão**: `Incident.orgUnitId` e `Problem.orgUnitId` são `String` (não anulável), com FK
`onDelete: Restrict` — a mesma forma de `Risk.orgUnitId` (`schema.prisma:932`) e `Finding.orgUnitId`
(`schema.prisma:2312`).

**Razão**: Incidente e Problema são entidades de fluxo de trabalho que nascem já pertencendo a uma
unidade — nunca existem "sem dono" mesmo que momentaneamente, ao contrário de `Asset`/`Process`
(registros de referência que `006-assets-processes/research.md` D-2 documentou como
legitimamente sem unidade em linhas herdadas). Não há linha legada de Incidente ou Problema —
o domínio nasce nesta fase — então não existe o problema que D-2 de 006 resolveu (migrar dado
existente sem aumentar visibilidade). Seguir o precedente de `Risk`/`Finding` é mais simples e não
tem custo de migração a pagar.

**Alternativa rejeitada**: coluna anulável com campo obrigatório só na API, replicando D-2 de `006`.
Rejeitada porque essa forma existe em `006` para resolver um problema específico (dado legado sem
unidade) que não existe aqui — replicá-la sem o problema que a motiva seria complexidade sem
propósito.

---

## D-9 — Severidade é enum próprio por domínio, não compartilhado

**Decisão**: `IncidentSeverity` e `ProblemSeverity`, dois enums Prisma distintos, cada um
`CRITICAL | HIGH | MEDIUM | LOW`.

**Razão**: nenhum domínio deste projeto compartilha um enum de severidade com outro hoje —
`FindingSeverity` é própria de `Finding`, distinta dos níveis de `Risk` (`RiskLevel`, calculado, não
um enum de entrada direta). Introduzir o primeiro enum de severidade compartilhado entre domínios
sem que nenhum requisito o peça seria a abstração prematura que a Constituição, Princípio VIII,
proíbe, e §19.10 nomeia como "ponto de extensão que nunca foi exercitado".

**Alternativa rejeitada**: uma `Severity` genérica em `grc/shared/domain`, reusada por Incidente e
Problema desde o início, antecipando que outros domínios a usariam depois. Rejeitada por não ter
nenhum segundo consumidor real hoje — exatamente o critério de admissão de §19.4 (3+ domínios) que
uma capacidade nova precisa passar antes de virar compartilhada, e que esta proposta não passa.

---

## D-10 — Nenhuma categoria além de severidade

**Decisão**: nem `Incident` nem `Problem` ganham um campo de categoria/origem/prioridade separado de
severidade nesta fase — ao contrário de `Finding`, que distingue os quatro (`category`, `origin`,
`severity`, `priority`).

**Razão**: nenhuma acceptance scenario desta especificação pede a distinção. `Finding` a tem porque
FR-005 daquele domínio a pede explicitamente (severidade do fato versus urgência do tratamento, dois
conceitos que aquele domínio precisa distinguir). Nada equivalente foi requisitado aqui.

**Alternativa rejeitada**: replicar a forma de quatro campos de `Finding` "para não ficar atrás em
funcionalidade". Rejeitada pela mesma razão de D-9 — paridade de forma entre domínios não é, por si,
requisito.

---

## D-11 — Aprovação não é estendida nesta fase

**Decisão**: `ApprovableEntityType` **não** ganha `INCIDENT`/`PROBLEM` nesta especificação.

**Razão**: nenhuma acceptance scenario pede sign-off formal no fechamento de um incidente ou de um
problema. §19.4 já trata isto como extensão barata quando o requisito aparecer ("acrescentar valor
de enum e caso de uso — não construir motor de workflow") — não há razão para antecipá-la sem o
requisito.

**Alternativa rejeitada**: estender por precaução, "porque um problema fechado é uma decisão
importante". Rejeitada por ser exatamente o padrão que §19.10 pune — um ponto de extensão que nunca
seria exercitado por nenhum caso de uso real desta fase.

---

## D-12 — Notificação reusa `CommentableEntityType`, sem registro próprio

**Decisão**: qualquer notificação relacionada a Incidente/Problema usa
`Notification.entityType: CommentableEntityType`, exatamente como `docs/deferred-findings.md` F-53
(Finding D) já corrigiu para `platform.openapi.yaml` — nenhum `NotificationEntityType` próprio é
criado.

**Razão**: é o mecanismo já em produção, e `CommentableEntityType` já ganha `INCIDENT`/`PROBLEM` por
D-2/FR-018 — estendê-lo mais uma vez, em vez de criar um terceiro registro paralelo, é
exatamente §19.4 ("reutilizar antes de criar").

---

## D-13 a D-15 — decisões do coordenador (Q1-Q3), não decisões históricas do produto

**Autoridade**: D-13, D-14 e D-15 abaixo são decisões do **coordenador desta fase** (Claude Opus),
tomadas em 2026-09-11 sob a mesma autoridade delegada que `007-implementation-remediation` já
registrou para D-R1 a D-R14. Não são decisões históricas do usuário do produto, e não devem ser
citadas como tal em nenhum documento futuro. Registradas aqui com a razão anexada, exatamente como
D-1 a D-12 — a única diferença é a origem da decisão, nunca o padrão de registro.

## D-13 — Um problema pode existir sem incidente de origem (Q1)

**Decisão**: `Problem` não exige nenhum incidente vinculado para ser criado ou para transitar por
seu próprio ciclo de vida. Um problema pode nascer de um achado de auditoria, de uma análise de
risco, de uma tendência, ou de um ou mais incidentes — todos igualmente legítimos, nenhum
obrigatório.

**Razão (coordenador)**: exigir origem em incidente proibiria a gestão proativa de problema, uma
prática real que esta plataforma já alimenta por outras portas (achado de auditoria, análise de
risco). Tornar a origem obrigatória forçaria um usuário a inventar um incidente falso só para poder
registrar um problema real — e um registro que precisa ser falsificado para existir é pior do que um
relacionamento anulável. O custo de deixar opcional é zero; o custo de tornar obrigatório é um
registro corrompido.

**Alternativa rejeitada**: exigir cardinalidade mínima 1 (todo problema nasce de ao menos um
incidente), a leitura mais comum do termo "gestão reativa de problema" no vocabulário ITIL.
Rejeitada porque despreza a gestão proativa como caso legítimo, e porque o custo de errar nessa
direção (registro falsificado) é estritamente pior do que o custo de errar na direção oposta (um
vínculo que fica de fato sempre presente na prática, mas nunca foi exigido pelo schema).

## D-14 — O vínculo é N:M, tabela nomeada, propriedade de Problemas (Q2)

**Decisão**: `ProblemIncidentLink` (N:M), mesma forma das quatro tabelas de ligação já desta fase —
`linked_by_user_id`, `unlinked_at`/`unlinked_by_user_id`, índice único parcial. A rota de escrita
(`POST`/`DELETE /problems/{problemId}/incidents`) pertence ao módulo de Problemas;
`GET /incidents/{incidentId}/problems` no contrato de Incidentes é leitura direta da mesma tabela,
sem escrita — o mesmo padrão que `GET /assets/{assetId}`'s vínculos de risco/controle já usa em
`006-assets-processes` para expor um vínculo sem que o módulo que só lê precise importar o módulo
que escreve.

**Razão (coordenador)**: um problema explica muitos incidentes, e um incidente genuinamente pode ter
mais de uma causa contribuinte — falha composta é o caso comum, não o exótico. Começar em 1:N
forçaria uma migração na primeira vez que a realidade discordasse, e o mecanismo já sancionado para
um vínculo com significado próprio (§19.3) é a tabela nomeada, que já comporta esta forma sem
desenho adicional.

**Consequência de desenho, não descoberta depois**: os dois módulos são novos nesta fase e nenhum
pode importar o outro (ADR-011). O vínculo segue exatamente o padrão que Risco→Controle já
estabeleceu: a escrita pertence a Problemas, que lê o incidente através de `IncidentDirectoryPort`
(`shared/grc-ports/incident-directory.port.ts`) — nunca importando `modules/incidents` diretamente.
A leitura do lado de Incidentes é a própria infraestrutura de Incidentes consultando
`problem_incident_links` diretamente (é uma tabela da plataforma, não um artefato privado de
Problemas) — sem depender de nenhum código de `modules/problems`.

**A dupla exigência de autorização não é opcional**: criar o vínculo exige `problem:link` **e**
`incident:view` — a autoridade de escrita do lado que inicia, mais a autoridade de leitura sobre o
alvo. Este projeto já teve que fechar exatamente essa lacuna duas vezes (Risco→Ativo e
Risco→Processo, `docs/deferred-findings.md` F-46/F-49) por ela ter sido esquecida na primeira
implementação de um vínculo novo. Aqui ela é requisito desde a primeira linha, não uma correção
posterior.

**Alternativa rejeitada**: 1:N, uma FK opcional `problem_id` em `incidents`. Rejeitada por dois
motivos: (1) descarta a possibilidade, real e ordinária segundo o próprio raciocínio do
coordenador, de um incidente com mais de uma causa contribuinte; (2) uma coluna em `incidents`
seria escrita pelo módulo de Problemas ou exigiria que Incidentes conhecesse Problemas para a
validar — o inverso da direção de dependência que a consequência de desenho acima já resolve com uma
tabela de ligação nomeada.

## D-15 — Nenhum acoplamento rígido entre os dois fechamentos (Q3)

**Decisão**: fechar um problema não exige que seus incidentes vinculados estejam
`RESOLVED`/`CLOSED`/`CANCELLED`. Resolver um incidente não exige nem cria um problema. O vínculo é
**informativo e auditável** — nunca uma trava de transição de nenhum dos dois lados. Nenhuma
invariante de domínio (nem P2/P3, já existentes para o fechamento de Problema) passa a consultar o
estado de um incidente vinculado, e nenhuma invariante equivalente é criada para Incidente consultar
o estado de um problema vinculado.

**Razão (coordenador)**: as duas máquinas de estado respondem perguntas diferentes — um incidente é
uma ocorrência sendo tratada, um problema é uma causa estrutural sendo removida — e qualquer um dos
dois pode legitimamente terminar primeiro. Acoplar os dois deixaria um registro preso pelo outro
domínio permanentemente — a mesma forma de defeito que este projeto já sofreu uma vez, num ciclo de
vida que podia prender um registro sem saída legal. Se uma organização quiser esse portão, é política
e relatório, não restrição de banco.

**Onde a pergunta de política fica registrada, não descartada**: `docs/architecture/grc-roadmap.md`,
cauda da Fase 7 (Indicadores e Relatórios) — "se o fechamento deveria ser condicionado" é pergunta de
relatório/política para quem constrói aquela fase, com esta razão anexada, não uma pergunta de schema
para esta fase decidir de novo.

**Alternativa rejeitada**: bloquear `Problem -> CLOSED` enquanto existir incidente vinculado ativo.
Rejeitada pela razão do coordenador acima — prenderia um domínio ao estado do outro sem que nenhum
requisito de segurança ou auditoria o exija, e sem via de escape se o incidente nunca fechar por
razão legítima e alheia ao problema (por exemplo, aguardando confirmação de um terceiro).

---

## Correção — CLAUDE.md §10 não é uma lista exaustiva, e não havia contradição

`spec.md`'s "Contexto medido" registrava uma "tensão" entre o roteiro/blueprint (que anteciparam
Incidente↔Problema) e CLAUDE.md §10 (que não lista esse par). **Não há contradição** — correção do
coordenador, 2026-09-11: CLAUDE.md §10 introduz sua lista com a palavra "Exemplos:", antes de
enumerar os pares. É explicitamente ilustrativa, nunca exaustiva, e nunca afirmou cobrir todo par
possível. O roteiro e o blueprint anteciparem um vínculo que a lista de exemplos não menciona não é,
portanto, uma tensão entre dois documentos — é exatamente o espaço que uma lista de exemplos deixa
aberto por desenho. O que assentou a pergunta não foi reconciliar dois documentos em desacordo; foi
ler `§10` pelo que ele diz ser. `spec.md` está corrigido para não registrar mais um conflito que
nunca existiu.

---

## O que este documento decide, e o que fica para a próxima fase

D-1 a D-15 cobrem toda a decisão de arquitetura e de produto que esta especificação precisava para
prosseguir à implementação. A única pergunta que permanece deliberadamente aberta — "o fechamento de
um problema deveria, por política organizacional, poder ser condicionado aos seus incidentes" — não é
uma lacuna desta fase: é uma pergunta de relatório/política, registrada na cauda da Fase 7 (D-15),
para quando essa fase for desenhada.
