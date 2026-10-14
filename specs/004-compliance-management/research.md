# Research — Compliance (Fase 3)

Decisões tomadas antes do desenho, cada uma com a alternativa que foi descartada e por quê. Nada
aqui reabre decisão já aceita: onde ADR-017 ou ADR-020 responde, a pesquisa apenas registra como
ela se aplica a este módulo. Convenção herdada de `specs/003-controls-management/research.md`.

---

## D-1 — Relações declaradas (CLAUDE.md §19.2)

Antes de desenhar qualquer entidade, a declaração exigida por §19.2:

| Domínio | Relação nesta fase |
|---|---|
| Unidade Organizacional | **Nenhuma direta** sobre Framework/FrameworkVersion/Requirement — ver D-2. Indireta sobre `RequirementControlLink`: o controle referenciado precisa estar no escopo do ator (ADR-020 parte 4). |
| Risco | **Nenhuma.** A especificação não menciona Risco; o roadmap não lista `Requirement↔Risk` para esta fase. Não inventada aqui. |
| Controle | **A relação central desta fase.** `RequirementControlLink`, N:M, explícita e nomeada (ADR-017, ADR-020). |
| Ativo | **Nenhuma.** Não pedida por nenhum FR. |
| Processo | **Nenhuma.** Não pedida por nenhum FR. |
| Evidência | **Nenhuma direta.** Por decisão já registrada no spec (Assumptions): evidência sustenta conformidade **através do controle**. Compliance não ganha `EvidenceSubjectType.REQUIREMENT`. |
| Ação | **Nenhuma direta.** Mesma razão: remediação de um controle inefetivo já nasce com `ActionOriginType.CONTROL_ASSESSMENT` (Fase 2, D-5). Um requisito não comprovado não abre uma segunda ação — abre atenção sobre o controle que falha, e a ação já existe do lado do controle. |
| Achado (Finding) | **Nenhuma nesta fase.** `Audit↔Requirement` e `Finding↔Requirement` são Fase 4 (roadmap §"Fase 4"). Não antecipadas aqui. |
| Auditoria (trilha) | Toda escrita relevante é auditada (FR-025) — ver D-3, D-5, D-6, D-7, D-11 para os tipos de entidade novos. |

"Não se relaciona com nada" não é a resposta para Controle; é a resposta, por enquanto, para as
outras sete linhas — escrita e justificada, não por esquecimento.

---

## D-2 — Framework/FrameworkVersion/Requirement são catálogo de escopo global, não por unidade organizacional

**Decisão**: `Framework`, `FrameworkVersion` e `Requirement` **não** carregam `orgUnitId`. Leitura e
escrita são gated exclusivamente por permissão (`compliance:view`/`compliance:administer`), sem
predicado de escopo organizacional sobre essas três tabelas. Precedente direto: `Role` e
`Permission` (`schema.prisma`) já são catálogo de plataforma sem `orgUnitId` e sem
`ScopedRepository`, geridos só por permissão — Compliance segue o mesmo padrão já provado, não
inventa um novo.

**Razão — por que a alternativa óbvia (copiar `orgUnitId` de `Control`) está errada aqui**:
`ScopeResolverService` (`core/organizations/application/scope-resolver.service.ts`) expande um
grant de unidade **para baixo** — `{unidade concedida} ∪ {descendentes}` — nunca para cima. Um
registro com `orgUnitId = <unidade raiz>` só fica visível para quem tem grant **na própria raiz**
ou `GLOBAL`; alguém com grant apenas num departamento não o vê, porque a raiz não é descendente do
departamento. Se `Framework` exigisse `orgUnitId`, a única forma de representar "a ISO 27001 vale
para a empresa inteira" seria colocá-la na unidade raiz — e ela ficaria invisível para o gestor de
conformidade de um departamento que não tem grant na raiz. Isso é o oposto do comportamento que uma
biblioteca normativa precisa ter: uma norma que a organização adota é, por natureza, um fato da
organização, não de uma unidade dentro dela — o mesmo motivo por que papel e permissão nunca
tiveram `orgUnitId`.

**Onde FR-022 é de fato aplicado**: no único ponto desta fase em que vazamento de escopo é
realmente possível — a **escrita** de `RequirementControlLink`. Antes de gravar o vínculo, o
controle referenciado precisa estar no escopo do ator, verificado através do
`ControlDirectoryPort` já existente (ADR-020 parte 4), exatamente como `ControlProcessLink`/
`ControlAssetLink` já verificam o processo/ativo referenciado (Fase 2, data-model.md §5). Um
controle fora de escopo, ou inexistente, responde como inexistente (FR-022, "quando aplicável"
implícito no mesmo sentido em que CLAUDE.md §6 e §9 usam a expressão).

**Alternativa descartada**: `orgUnitId` obrigatório em `Framework`, espelhando `Control`.
Descartada pelo argumento de visibilidade acima, e porque nenhum FR pede biblioteca normativa por
unidade — introduzir o campo seria abstração não solicitada (CLAUDE.md §2).

**Consequência aceita**: se uma organização multi-subsidiária precisar de uma norma visível
**apenas** a uma unidade (ex.: LGPD só para a filial brasileira), esta fase não oferece isso. Não é
regressão — nenhum FR pede — e fica registrado como extensão futura, não como lacuna silenciosa.

---

## D-3 — Ciclo de vida de `FrameworkVersion`: dois estados, uma transição, sem tabela de transições

**Decisão**: `FrameworkVersionStatus` tem exatamente dois valores, `DRAFT` e `PUBLISHED`.
Publicação é `DRAFT -> PUBLISHED`, uma única aresta, irreversível, sem caminho de volta. É
capturada como mudança de campo dentro do próprio evento `FRAMEWORK_VERSION` (valor anterior
`DRAFT`, valor posterior `PUBLISHED`) — **não** ganha uma tabela de transições nem um tipo de
auditoria próprio de "lifecycle transition" como `Control` tem.

**Razão**: o ciclo de vida de `Control` (D-6 da Fase 2) tem 4 estados e 6 pares de transição legal,
alguns percorríveis repetidamente (`ACTIVE <-> SUSPENDED`) — isso justifica um log de transições
próprio, porque a mesma pergunta ("quando isto mudou de estado, e quantas vezes") tem resposta
não trivial. `FrameworkVersion` tem **uma** aresta que dispara **no máximo uma vez** por versão.
Uma tabela de transições para um único tipo de linha, para sempre, é exatamente a abstração
prematura que CLAUDE.md §2 proíbe — o caso que nunca vai divergir não precisa do mecanismo que
existe para quando diverge.

**Alternativa descartada**: replicar `ControlLifecycleTransition`/`GET .../lifecycle` para
`FrameworkVersion`. Descartada porque não há segunda aresta para descrever nem estado a que se
volte — o mecanismo pesado responderia uma pergunta que este domínio não faz.

**Consequência aceita**: se uma fase futura precisar de mais estados (ex.: `SUPERSEDED` quando uma
versão seguinte é publicada), a migração deste ciclo de vida para o padrão de `Control` é trabalho
novo, não uma extensão trivial. Não antecipado aqui porque nenhum FR pede — o edge case "duas
versões vigentes ao mesmo tempo" exige explicitamente que isso **não** aconteça automaticamente.

---

## D-4 — Imutabilidade de `Requirement` publicado, garantida por trigger de banco, não só por código de aplicação

**Decisão**: além da checagem na camada de aplicação, uma trigger `BEFORE UPDATE ON requirements`
recusa qualquer alteração quando a `framework_versions.status` do pai é `PUBLISHED`, espelhando o
padrão já em produção em `approvals_prevent_overwrite()`
(`20260905170100_risk_lifecycle_and_approvals_baseline/migration.sql`) — a única outra tabela desta
base cujo requisito é "depois de um evento, esta linha nunca mais muda".

**Razão**: FR-004 é uma garantia de auditoria e conformidade (uma cláusula publicada e depois
alterada silenciosamente destruiria a própria evidência que a versão existe para fornecer a um
auditor externo). CLAUDE.md §12 pede "tratamento seguro de erros" e "segurança desde a
arquitetura", e o precedente de `approvals` já estabelece que uma invariante desta gravidade não
fica só do lado do código de aplicação, onde um futuro caso de uso mal revisado poderia violá-la
sem que nenhum teste de banco pegasse. A trigger consulta o `framework_versions` pai por
subconsulta — mais cara que a checagem self-contida de `approvals` (que olha só a própria linha),
mas o mesmo princípio: a garantia vale mesmo contra um caminho de escrita que ninguém revisou.

**Alternativa descartada**: confiar inteiramente na checagem do caso de uso
(`UpdateRequirementUseCase` recusa se a versão não é `DRAFT`). É o que Controles faz para "ACTIVE
exige dono" (uma precondição de fluxo, reversível em desenho, sem consequência de auditoria se
violada uma vez) — categoria diferente de "isto não pode nunca ter acontecido", que é a categoria
de `approvals` e desta.

**Consequência aceita**: uma segunda superfície de escrita (a trigger) precisa ser mantida em
paralelo ao caso de uso — atrito deliberado, o mesmo que `approvals_prevent_overwrite` já paga.

---

## D-5 — `RequirementControlLink`: mesma forma de `ControlProcessLink`/`ControlAssetLink`, do lado de Compliance

**Decisão**: tabela explícita e nomeada, do lado que registra (Compliance, que decide que aquele
requisito é satisfeito por aquele controle — ADR-020 parte 1), com FK real `Restrict` para
`controls` (parte 2), tipo de auditoria próprio `REQUIREMENT_CONTROL_LINK` (parte 1), índice
parcial único `(requirement_id, control_id) WHERE unlinked_at IS NULL` (a mesma técnica de
`RiskControlLink`/`ControlProcessLink`), e desvínculo que preserva histórico (`unlinkedAt`/
`unlinkedByUserId`, parte 5) em vez de excluir a linha (FR-011).

**Razão**: é literalmente o vocabulário que ADR-017 e ADR-020 já definem para este exato
relacionamento — "controle satisfaz cláusula" é, por natureza, dois domínios GRC se relacionando
com significado próprio (a linha 1 da tabela de ADR-019/§19.3), não uma capacidade transversal se
anexando a um sujeito (que usaria registro de tipo fechado em vez de tabela nomeada).

**Escopo, na escrita**: antes de gravar, o controle referenciado precisa estar no escopo do ator —
verificado via `ControlDirectoryPort` (D-2 acima). Nenhuma mudança de forma no lado de Controles;
o único ajuste é aditivo — ver D-9.

**Alternativa descartada**: modelar como capacidade transversal via `AttachableEntityType`/registro
de tipo fechado. Descartada porque o vínculo carrega significado GRC próprio (é o mapeamento que
ADR-017 inteira existe para modelar), não uma anexação genérica de arquivo ou comentário — §19.3
distingue exatamente estes dois casos, e este é o primeiro, não o segundo.

---

## D-6 — Migração de mapeamento: o humano decide a correspondência, o sistema só copia e registra

Esta é a decisão mais difícil da fase (FR-012 a FR-014, US2 AS3-AS4).

**Decisão**: a migração é uma operação explícita, `POST` sobre a versão de **destino**, cujo corpo
carrega a lista de correspondências **decididas pelo gestor antes de chamar a operação**:

```
correspondences: [{ targetRequirementId, sourceRequirementIds: [ ... ] }]
```

- Cada `targetRequirementId` aparece **no máximo uma vez** no corpo (um destino recebe uma decisão
  por execução).
- `sourceRequirementIds` pode ter mais de um elemento (uma cláusula nova que consolida duas
  antigas) — o sistema copia a **união** dos vínculos vigentes de todas as origens listadas.
- Um `sourceRequirementId` **pode** aparecer sob mais de um `targetRequirementId` (uma cláusula
  antiga que se desdobrou em duas novas) — desdobramento é permitido de graça, sem desenho
  adicional; consolidação (N origens -> 1 destino) é o único caso "muitos para um" suportado.

**O que o sistema executa, por requisito de destino, na versão apontada**:

1. Se o destino **já tem** vínculo vigente próprio (decidido manualmente antes da migração ou por
   uma execução anterior) — **pulado**, `SKIPPED_ALREADY_MAPPED`. FR-014: nunca sobrescreve decisão
   já tomada, mesmo que o corpo da requisição o inclua.
2. Se o destino está no corpo, sem vínculo prévio — copia os vínculos vigentes das origens listadas
   (idempotente: um controle já vinculado à origem que por acaso já esteja vinculado ao destino não
   duplica), `COPIED`.
3. Se o destino não está no corpo e não tem vínculo prévio — **pendente de decisão**,
   `PENDING_DECISION` (FR-013). Nunca fica silenciosamente sem mapeamento.

Um único registro `RequirementControlMappingMigration` (versão de origem primária — na prática
"a versão anterior publicada", mas o sistema não impõe isso: ver abaixo —, versão de destino, autor,
data) mais uma linha `RequirementControlMappingMigrationItem` por requisito de destino processado
nesta execução, guardando o resultado e a contagem de vínculos copiados. **Um único evento de
auditoria** para a execução inteira (SC-004), com o resumo (quantos `COPIED`, `PENDING_DECISION`,
`SKIPPED_ALREADY_MAPPED`) — não um evento por vínculo copiado, que produziria uma sequência de
vínculos avulsos indistinguível de trabalho manual (US2 AS4, o problema que a especificação nomeia
explicitamente).

**Reexecutável, por desenho** — o edge case do spec aceita duas respostas ("recusada, ou executada
apenas sobre as cláusulas ainda sem vínculo"); esta pesquisa escolhe a segunda. Cada execução só
processa destinos que, **naquele momento**, ainda não têm vínculo vigente próprio — o que permite
ao gestor rodar a migração, resolver manualmente alguns `PENDING_DECISION`, e rodar de novo com um
corpo cobrindo o restante, sem que a segunda execução perturbe o que já foi decidido pela primeira
ou manualmente.

**O que o sistema explicitamente NÃO tenta inferir**: nenhuma correspondência automática por texto,
número de cláusula igual, ou similaridade. Duas cláusulas com o **mesmo código externo** em duas
versões da mesma norma **não são presumidas equivalentes** — é exatamente o caso em que uma norma
revisada renumerou, fundiu ou desdobrou uma cláusula, que é a razão de a migração existir como
operação de decisão humana em primeiro lugar (spec, "problema que esta fase resolve"). Uma
correspondência automática por igualdade de código levaria, silenciosamente, ao pior desfecho
possível: transportar mapeamento de controle para uma cláusula que mudou de sentido, sem que
ninguém tenha decidido isso. Isso não impede uma futura tela de assistência que **sugira** pares por
código igual como conveniência de preenchimento — mas a sugestão nunca seria confiável o bastante
para ser aplicada sem confirmação, e nenhuma tela ou endpoint de sugestão é construído nesta fase:
não é pedida por nenhum FR (CLAUDE.md §2, "não implementar funcionalidades que não estejam
especificadas").

**Alternativa descartada**: motor de correspondência automática (por código, por texto, por
similaridade). Descartada pela razão acima, e porque seria exatamente o "sistema que adivinha" que
a instrução desta tarefa pede para evitar — o oposto do "humano decide, sistema registra".

**Alternativa descartada**: migração N:1 e 1:N ambas livres, sem a restrição "um destino, uma
decisão por execução". Descartada porque um destino recebendo **duas** decisões conflitantes na
mesma execução (por estar listado sob dois `targetRequirementId` diferentes — impossível pela
forma acima, já que `targetRequirementId` é a chave — ou por regra de "mesclar" duas listas de
vínculos concorrentes) exigiria uma regra de resolução de conflito que a especificação não define;
a restrição de unicidade do destino no corpo elimina a ambiguidade estruturalmente, sem exigir essa
regra.

**Consequência aceita**: consolidação de origem é suportada (bom para o caso real de normas que se
fundem); mas o sistema não oferece "mesclar decisões concorrentes" dentro de uma execução — se dois
gestores quiserem propor correspondências diferentes para o mesmo destino, isso se resolve fora do
sistema, antes de chamar a operação, não por arbitragem automática dela.

---

## D-7 — Aplicabilidade: declarações que se sucedem, nunca uma flag reescrita

**Decisão**: `RequirementApplicabilityDeclaration` é uma tabela de eventos, não uma coluna booleana
em `Requirement`. Uma cláusula é **aplicável por padrão** (nenhuma linha). Declarar não aplicável
insere uma linha (`justification`, `declaredByUserId`, `declaredAt`, `revokedAt`/
`revokedByUserId` nulos). Reverter para aplicável marca `revokedAt`/`revokedByUserId` na linha
vigente — nunca a apaga. Índice parcial único `(requirement_id) WHERE revoked_at IS NULL` garante
no máximo uma declaração vigente por requisito.

**Razão**: é a mesma técnica de vínculo/desvínculo já estabelecida (D-5, e antes dela
`ControlProcessLink`), aplicada a uma declaração em vez de um vínculo com outra entidade — CLAUDE.md
§9 ("não sobrescrever informações históricas") e §18.12 (reuso de padrão, não invenção por módulo)
pedem exatamente isso. Uma declaração de não aplicabilidade é, por si, um fato de auditoria externa
(spec, US3: "a declaração de aplicabilidade que auditor externo cobra") — apagá-la ou sobrescrevê-la
destruiria o que um auditor viria buscar.

**Alternativa descartada**: `Requirement.applicability: APPLICABLE | NOT_APPLICABLE` como coluna
mutável, com `justification`/`declaredBy`/`declaredAt` ao lado. Descartada porque uma segunda
declaração (aplicável de novo, depois não aplicável de novo, com justificativa diferente da
primeira vez) perderia a primeira justificativa — o mesmo defeito que a tabela de aprovação
(`approvals`) já foi desenhada para evitar em outro contexto.

---

## D-8 — O calculador único de estado de conformidade, e por que cada um dos cinco estados existe

**Decisão**: um único serviço de domínio, `RequirementComplianceService`
(`modules/compliance/domain/`), é o único ponto que responde "qual o estado de conformidade deste
requisito" e "qual o resumo de uma versão". Nenhuma coluna armazena o resultado — ver
data-model.md, que declara isso explicitamente.

**Entrada exata**:

```
calculateRequirementComplianceState(
  applicability: 'APPLICABLE' | 'NOT_APPLICABLE',
  linkedControls: ReadonlyArray<{ isActive: boolean; effectiveness: ControlEffectivenessLevel }>,
): RequirementComplianceState
```

`linkedControls` é a projeção de **cada vínculo vigente** (`unlinkedAt IS NULL`) do requisito,
resolvida via os dois portes de D-9 — nunca o histórico de vínculos desfeitos, que não sustenta
conformidade corrente (embora permaneça legível como histórico, FR-011).

**Saída exata — `RequirementComplianceState`, cinco valores, cada um com consequência observável**:

| Estado | Quando | Consequência observável |
|---|---|---|
| `NOT_APPLICABLE` | Declaração vigente de não aplicabilidade (D-7) | Excluído do somatório da versão (FR-016); a interface precisa mostrá-lo separado, nunca como conforme nem como não atendido (edge case "cláusula não aplicável ligada a controle"). |
| `NOT_MET` | Aplicável, **zero** vínculos vigentes | FR-018: nunca conforme por omissão. É o único estado que independe de qualquer controle — a ausência de mapeamento é, em si, a informação. |
| `NOT_PROVEN` | Aplicável, ≥1 vínculo vigente, e **nenhum** deles prova (todos: controle inativo/aposentado, ou efetividade `NOT_ASSESSED`/`EXPIRED`/`INEFFECTIVE`) | FR-019: distinto de `NOT_MET` — há mapeamento, falta prova. É também o estado de um controle aposentado ligado a cláusula vigente (edge case correspondente): aposentado nunca sustenta conformidade, mas o vínculo, sendo histórico, continua existindo. |
| `PARTIALLY_MET` | Aplicável, ≥1 vínculo prova plenamente e ≥1 não prova (ou algum prova parcialmente) | AS6 (US3): a mistura é o próprio motivo de existir deste estado — sem ele, o sistema teria de escolher arbitrariamente entre `NOT_PROVEN` e `COMPLIANT`, escondendo informação real. |
| `COMPLIANT` | Aplicável, ≥1 vínculo, e **todos** provam plenamente (controle ativo e efetividade `EFFECTIVE`) | SC-002: nenhuma cláusula aparece conforme sem controle ligado com verificação atestada e efetiva. |

"Prova plenamente" = controle `isActive === true` **e** efetividade `EFFECTIVE`. "Prova
parcialmente" = `isActive === true` e efetividade `PARTIALLY_EFFECTIVE` — contribui ao balde misto
que produz `PARTIALLY_MET` exatamente como um controle inefetivo contribuiria, nunca sozinho vira
`COMPLIANT`.

**Por que nenhum estado é o defeito que este projeto já cometeu duas vezes**: `FindingStatus`
(Fase 1) tinha valores nunca alcançados por nenhuma operação; o rascunho do ciclo de vida de
`Control` (Fase 2, D-6) quase deixou `DRAFT` sem saída. Aqui, os cinco estados são exercitados
literalmente pelas seis cenas de aceitação de US3 — não há um sexto valor "por completude" à espera
de uma operação que o alcance.

**Resumo da versão (FR-020)** — mesma calculadora, agregando, nunca uma segunda regra: contagem por
estado sobre os requisitos **aplicáveis** da versão, mais percentual `COMPLIANT / aplicáveis`. Não
é reduzido a um único rótulo categórico da versão — a especificação não pede isso, e inventar um
("versão está CONFORME") esconderia exatamente a granularidade que FR-020 e o edge case "duas
versões vigentes" pedem para preservar.

**Alternativa descartada**: quatro estados, dobrando `NOT_MET` e `NOT_PROVEN` num só ("não
atendida"). Descartada porque a especificação nomeia os dois separadamente e com consequência
diferente (FR-018 vs. FR-019) — dobrá-los reintroduziria exatamente a ambiguidade que a
especificação evita ao distingui-los.

---

## D-9 — Como Compliance lê Controles sem importar o módulo: um porte reaproveitado, um porte novo

**Decisão**: dois portes em `shared/grc-ports/`, nenhum import de `modules/controls` a partir de
`modules/compliance` (FR-024, SC-007).

**1. `ControlDirectoryPort` (já existe, Fase 2) — reaproveitado, com um método aditivo.**
Usado para: (a) validar que o controle referenciado por um novo `RequirementControlLink` existe,
está ativo e no escopo do ator (D-2, D-5); (b) fornecer `{ id, code, name }` para exibição do
vínculo. **Não é suficiente sozinho** para o cálculo de conformidade, porque seu próprio comentário
de cabeçalho documenta a exclusão deliberada: *"Deliberadamente exclui `status`, `owner`, `nature`,
`type`, `frequency` e `effectiveness` derivada"* — estender este porte para incluir efetividade
contradiria a razão pela qual ele existe (ADR-020 parte 4: expor o mínimo).

Adição aditiva proposta: `findManyById(ids: readonly string[]): Promise<ControlDirectoryEntry[]>`
— para resolver em lote os controles de todos os vínculos vigentes de uma versão (até 500
requisitos, D-10), em vez de uma chamada por vínculo.

**2. `ControlEffectivenessPort` (novo) — porte de leitura, do lado de Compliance.** Expõe
exatamente o veredito derivado, em lote, referenciado a uma data:

```ts
export type ControlEffectivenessLevel =
  'NOT_ASSESSED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'EXPIRED';

export abstract class ControlEffectivenessPort {
  abstract getEffectivenessBatch(
    controlIds: readonly string[],
    referenceDate: Date,
  ): Promise<ReadonlyMap<string, ControlEffectivenessLevel>>;
}
```

Implementado por `modules/controls` (adaptador em `modules/controls/infrastructure/`), reutilizando
o **mesmo** `ControlEffectivenessService` que já é o único calculador de efetividade (§19.7) — o
adaptador busca as verificações atestadas de todos os `controlIds` numa única consulta
(`WHERE control_id = ANY($1) AND attested_at IS NOT NULL`), agrupa em memória e chama
`calculateControlEffectiveness` uma vez por controle. Compliance nunca recalcula efetividade; só
compõe sobre o veredito.

**Por que é um segundo porte, e não uma extensão do primeiro**: são fatos de natureza diferente —
identidade/escopo (parte 4 de ADR-020, "o mínimo para verificar antes de gravar") versus estado
derivado do domínio de Controles (§19.7, "calculado por um único ponto"). Fundir os dois num porte
só faria sentido se todo consumidor de identidade também precisasse de efetividade — não é o caso
do lado de escrita do vínculo (D-5), que só precisa confirmar que o controle existe e está no
escopo.

**Consequência aceita — duplicação deliberada de um vocabulário fechado, não de uma regra**:
`ControlEffectivenessLevel` (no porte) e `ControlEffectiveness` (no domínio de Controles,
`modules/controls/domain/control-effectiveness.service.ts`) são o mesmo conjunto de cinco valores,
declarado duas vezes — nunca por import, que a fronteira de módulo proíbe nas duas direções. Isso é
o mesmo tipo de decisão que `ControlDirectoryEntry` já aceitou (uma projeção mínima em vez do
modelo de domínio importado); a garantia de que os dois nunca divirjam não é por construção, é por
teste — um teste de paridade de valores, no mesmo espírito de
`control-effectiveness-parity.spec.ts` (Fase 2), aplicado a esta nova costura em vez de à costura
SQL/domínio original.

**Alternativa descartada**: o porte devolver o histórico bruto de verificações atestadas, deixando
Compliance recalcular a efetividade. Descartada porque duplicaria a REGRA (não o vocabulário) —
exatamente o que §19.7 proíbe, e criaria uma segunda pergunta "qual das duas efetividades está
certa quando divergem", que é a pergunta insolúvel que a Fase 2 já rejeitou para o mesmo cálculo.

---

## D-10 — Sem gêmeo SQL para o estado de conformidade

**Decisão**: o cálculo de conformidade — por requisito e o resumo por versão — é feito **em
memória**, na camada de aplicação de Compliance, não como expressão SQL replicada por linha (ao
contrário de `controlEffectivenessExpression`, Fase 2).

**Razão**: o gêmeo SQL da Fase 2 existe porque o catálogo de Controles precisa filtrar e ordenar
**até 50.000 linhas** por um valor derivado (SC-008 da Fase 2) — paginação arbitrária sobre uma
tabela grande, com filtros combináveis, é o caso que só uma expressão de banco resolve dentro do
orçamento de tempo. O escopo de conformidade desta fase é, por definição do próprio SC-008 (Fase
3): **uma versão por vez, até 500 cláusulas**. Isso cabe inteiro em uma única leitura em lote —
uma consulta para os vínculos vigentes dos requisitos da versão, uma chamada em lote a
`ControlDirectoryPort.findManyById`, uma chamada em lote a
`ControlEffectivenessPort.getEffectivenessBatch` — seguida de uma redução em memória sobre no
máximo algumas centenas de linhas. Isso fica bem dentro de 2 segundos sem precisar de SQL
replicado.

**Por que replicar a expressão SQL entre módulos seria pior, não só desnecessário**: fazê-lo
exigiria que o repositório de Compliance montasse SQL bruto contra `controls`/
`control_assessments` — tabelas do domínio de Controles — reintroduzindo exatamente a leitura
direta entre tabelas de módulos diferentes que ADR-020/D-4 da Fase 2 eliminou para o caso
Risco→Controle. A integridade referencial no banco (ADR-020 parte 2) não proíbe isso ao nível do
PostgreSQL, mas o **código** que escreveria essa consulta pertenceria à fronteira errada — a mesma
distinção que a verificação em código de ADR-020 já registrou ("fronteira de módulo é conceito de
código, não de banco").

**Alternativa descartada**: pedir ao porte de efetividade (D-9) que devolva um fragmento SQL
(`Prisma.Sql`) parametrizável, para Compliance montar sua própria consulta agregada. Descartada por
desproporção: o problema de performance que justificaria o custo de desenhar essa API entre módulos
não existe nesta escala (500, não 50.000), e o "porte devolve fragmento SQL" seria a abstração
prematura que CLAUDE.md §2 proíbe — construída para uma necessidade que este spec não tem.

**Consequência aceita — registrada, não resolvida aqui**: se um requisito futuro pedir uma listagem
**entre versões ou entre frameworks** (ex.: "todos os requisitos não conformes de toda a
organização"), a técnica desta fase deixa de bastar, e o problema volta a se parecer com o de
Controles. Fora do escopo de FR-001 a FR-025 — nenhum FR pede essa listagem — e não resolvido por
antecipação.

---

## D-11 — Auditoria de mudança de estado de conformidade: comparação no momento da leitura

FR-021 exige "valor anterior e posterior" quando o estado de conformidade muda. US3 AS5 amarra o
gatilho ao **momento da consulta**, textualmente: *"When seu estado é consultado, Then... a mudança
é auditada"* — não "quando o controle é atestado". Essa frase não é acidental: ela resolve, na
própria especificação, a tensão que esta decisão precisaria resolver de qualquer forma.

**O problema**: o fato que muda o estado de um requisito frequentemente **acontece dentro de uma
transação do módulo de Controles** (uma atestação decidida) — uma transação que Compliance não
participa e não pode observar sem um mecanismo de evento entre módulos que nenhuma ADR autoriza e
que não passaria no teste de admissão do núcleo (§19.4: pelo menos três domínios precisam, nenhum
pode ser dono exclusivo — um barramento de eventos só para este caso seria dono exclusivo de
Compliance).

**Decisão**: o cálculo de estado (D-8) roda a cada leitura que o expõe — `GET` de um requisito,
`GET` da listagem de requisitos de uma versão, e como efeito colateral de toda escrita de
Compliance que o afeta (vincular/desvincular controle, declarar/reverter aplicabilidade, executar
migração). Em cada cálculo, o valor fresco é comparado a uma **marca d'água** por requisito —
`RequirementComplianceAuditMark { requirementId, lastAuditedState, lastAuditedAt }` — nunca
consultada para responder "qual é o estado" (isso é sempre recalculado, D-8), só para decidir se
houve mudança desde a última vez que alguém observou este requisito. Se o valor fresco difere da
marca, um evento `REQUIREMENT_COMPLIANCE_STATE` é gravado com o par (anterior, posterior), e a
marca é atualizada para o novo valor, na mesma transação que serve a resposta.

**Isto não é a coluna que a especificação proíbe (§19.7, FR-017).** A marca nunca é lida por
nenhuma regra de negócio para decidir o que exibir — nenhuma operação chama
`getWatermark(requirementId)` esperando o estado; só o próprio cálculo (D-8) responde essa
pergunta, sempre a partir dos dados-fonte. A marca é escrita **apenas** como efeito colateral da
comparação e nunca por nenhuma outra rota — ela não pode divergir "silenciosamente" de nada, porque
nada além dela mesma a consulta. É bookkeeping de auditoria, não estado de domínio duplicado.

**Um `GET` que escreve — reconhecido, não escondido**: HTTP pede que um método seguro não altere o
que o **recurso representa**; esta escrita não altera. `GET /requirements/{id}` continua devolvendo
exatamente o mesmo `Requirement`, com o mesmo `complianceState`, escreva ou não a marca com sucesso
— a resposta nunca depende do resultado dessa escrita, e uma falha nela nunca vira erro da
requisição (é bookkeeping de auditoria, best-effort, não parte do contrato de leitura). O que muda é
uma tabela interna que nenhuma operação de leitura desta API expõe. É a mesma categoria de "log de
acesso" que sistemas de conformidade já praticam (registrar que um registro sensível foi
visualizado) — não uma escrita ao recurso que o cliente pediu para ler.

**Concorrência**: duas leituras concorrentes do mesmo requisito, ambas vendo a mesma marca antiga e
o mesmo valor novo, poderiam ambas tentar gravar o mesmo evento de mudança. A escrita da marca usa
`UPDATE ... WHERE last_audited_state IS DISTINCT FROM $novo RETURNING *` — só a transação vencedora
grava o evento de auditoria; a perdedora, ao não afetar nenhuma linha, não audita de novo a mesma
transição. Não elimina toda janela de corrida em teoria, mas elimina o caso comum (duas leituras
próximas no tempo após um único fato causador).

**A marca inicial nunca é "mudança"**: a primeira vez que um requisito é computado (nenhuma marca
existe ainda), a linha é criada com o valor corrente, sem gravar evento de auditoria — não há
"anterior" real para comparar, e inventar um (`null -> NOT_MET`, por exemplo, no instante da
criação do requisito) registraria uma transição que não ocorreu.

**Alternativa descartada**: auditar só nas escritas do próprio Compliance (vincular/desvincular,
aplicabilidade, migração), sem observar o efeito de uma atestação decidida do lado de Controles.
Descartada porque não cobre US3 AS5 — o próprio cenário que a especificação pede como teste de
aceitação depende exatamente do caso em que a causa é uma escrita de Controles.

**Alternativa descartada**: mecanismo de evento/assinatura entre módulos (Controles publica,
Compliance escuta). Descartada por §19.4 (critério de admissão do núcleo não satisfeito) e por
ADR-019/ADR-020 não prever esse terceiro mecanismo — §19.3 é explícito que só há dois mecanismos de
relacionamento, e um barramento de eventos seria um terceiro.

**Consequência aceita, e reportada como limitação real, não escondida**: uma mudança de estado só
entra na trilha de auditoria na **próxima vez que alguém (ou o próprio sistema, ao servir uma
resposta) lê o requisito afetado** — não no instante em que a atestação do controle é decidida. Um
requisito que muda de estado e nunca mais é lido não gera evento de auditoria para essa mudança
específica (embora a mudança em si, do lado de Controles, já esteja auditada como
`control.attestation.decided` com sua própria efetividade anterior/posterior — a trilha de
Controles não perde nada; é a trilha de **Compliance** sobre este requisito específico que fica em
atraso até a próxima leitura). Isto é uma leitura literal de US3 AS5, não uma limitação escondida.

---

## D-12 — Evidência e Ação: nenhuma extensão nesta fase

**Decisão**: `EvidenceSubjectType` e `ActionOriginType` **não** ganham valor `REQUIREMENT` ou
`FRAMEWORK_VERSION` nesta fase.

**Razão**: já registrado no spec (Assumptions) e repetido em D-1: evidência sustenta conformidade
**através do controle**; a ação de remediação de uma falha de controle já nasce com origem
`CONTROL_ASSESSMENT` (Fase 2). Um segundo caminho de evidência ou de ação, direto na cláusula,
seria a segunda regra de cálculo que ADR-018/§19.6 existem para impedir.

**Alternativa descartada**: permitir anexar evidência diretamente a um `Requirement` "para o caso
de o auditor pedir uma evidência específica da cláusula". Descartada porque criaria dois caminhos
de prova (controle e cláusula) para a mesma pergunta de conformidade, com duas regras de cálculo
possíveis — o defeito que D-8 inteira existe para ter só uma.

---

## D-13 — Permissões: três, sem invariante de segregação de funções

**Decisão**: `compliance:view`, `compliance:administer` (biblioteca normativa — framework, versão,
publicação, requisito, aplicabilidade) e `compliance:map` (vincular/desvincular requisito↔controle,
executar migração de mapeamento).

**Razão**: `compliance:administer` é literalmente a permissão que a especificação nomeia (US1 AS1:
"um usuário com `compliance:administer`"). Separar mapeamento (`compliance:map`) do resto segue
CLAUDE.md §7 ("não utilizar somente verificações simples de administrador versus usuário") —
permite um perfil de "especialista em mapeamento de normas" que liga cláusulas a controles sem
poder republicar a biblioteca inteira, sem inventar mais granularidade do que a especificação
sustenta.

**Por que não há um par de permissões com segregação de funções, ao contrário de `control:test` /
`control:approve` da Fase 2**: nenhum FR ou cenário de aceitação desta fase pede que "quem declara
não aplicável" seja necessariamente diferente de "quem mapeia" ou de "quem publica a versão" — ao
contrário da atestação de efetividade (Fase 2, D-3), que a especificação e o roadmap nomeiam
explicitamente como exigindo separação. Inventar uma regra de segregação aqui seria funcionalidade
não especificada (CLAUDE.md §2).

**Papel semeado**: `Compliance Manager`, com as três permissões — mesma convenção de
`platform.seed.ts` que já semeia `Control Owner`/`Control Approver`.

---

## D-14 — Código gerado para `Framework`; `FrameworkVersion` e `Requirement` usam identificador do domínio, não do alocador

**Decisão**: `Framework.code` é gerado pelo alocador existente
(`grc/shared/infrastructure/prisma-entity-code-generator.ts`, sobre `GrcCodeSequence`), estendendo
`EntityCodePrefix` de `'EVD' | 'ACT' | 'FND' | 'CTL'` para incluir `'FMK'`, e `ENTITY_CODE_PATTERN`
na mesma migração revisada — exatamente o ajuste que a Fase 2 já fez para `CTL` (data-model.md §1
daquela fase), pela mesma razão: `Framework` é conceito de módulo de negócio (não do núcleo GRC),
mas o registro de prefixo fechado já nomeia conceitos de módulo (`RISK`, `RISK_TREATMENT_DECISION`
em enums vizinhos) — o precedente já é este, não o oposto.

`FrameworkVersion` **não** ganha código gerado: seu identificador natural é `label` (texto informado
pelo gestor, ex. "2022", "Revisão de setembro de 2026") — o mundo real nomeia revisões de norma por
data ou número de publicação da própria norma, não por uma sequência interna da plataforma. Índice
único `(frameworkId, label)`.

`Requirement` **não** ganha código gerado: seu identificador é `externalRef` (o número da cláusula
na norma, ex. "A.5.16") — vem de fora, é o "código" que já existe na fonte, e gerar um segundo por
cima seria um identificador que ninguém fora do sistema reconheceria.

**Alternativa descartada**: gerar código para os três, por uniformidade com `Control`/`Risk`.
Descartada porque `FrameworkVersion` e `Requirement` já têm identificador natural e estável vindo do
domínio — gerar um segundo criaria dois nomes para a mesma cláusula, um dos quais ninguém usa.
