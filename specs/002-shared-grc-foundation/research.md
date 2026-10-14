# Research — Fundação GRC Compartilhada

Decisões técnicas tomadas antes do desenho. Cada uma registra a alternativa rejeitada e a razão.

---

## R-001: Como Evidência e Ação referenciam seu sujeito/origem

**Decisão**: registro de tipo fechado — coluna de tipo com enum verificado em compilação mais
identificador do sujeito, **sem chave estrangeira**, com índice composto
`(subjectType, subjectId)`. Mesma forma que `Attachment` e `Comment` já usam.

**Razão**: uma tabela de ligação explícita por par possível cresce combinatoriamente; soldar cada
capacidade a um único tipo de sujeito é o defeito que esta fase existe para evitar. O precedente
interno já está exercitado quatro vezes: `AttachableEntityType`, `CommentableEntityType`,
`ApprovableEntityType` e `Notification`. Verificado no schema: `Attachment.entityId` e
`Comment.entityId` são `uuid` sem `@relation` — ausência de FK é o trade-off já aceito para
capacidades transversais, e não uma novidade introduzida aqui.

**Colisão resolvida**: `Action` vive em `grc/`, e uma ação originada de tratamento de risco
precisa referenciar um risco em `modules/risk`. Uma FK real exigiria que `grc` conhecesse
`modules`, que ADR-016 **proíbe**. O registro de tipo fechado resolve porque a referência é por
identificador, não por importação de tipo. A integridade é garantida pelo caso de uso do módulo
que registra, não pelo banco.

**Alternativas rejeitadas**:

- FK real polimórfica — impossível: uma coluna não referencia várias tabelas.
- Tabela de ligação por par (`RiskAction`, `FindingAction`, …) — combinatória, e obrigaria `grc` a
  conhecer cada módulo.
- Tabela genérica `EntityRelationship` — proibida por ADR-008 e ADR-020, e o benchmark registrou
  quatro reversões desse caminho no produto de referência.

**Consequência aceita e declarada**: sem FK, um identificador de sujeito inválido não é barrado
pelo banco. Mitigação: o caso de uso valida existência e escopo pelo registro do tipo antes de
gravar, e o produto não exclui fisicamente, então um sujeito nunca desaparece sob um vínculo.

---

## R-002: Onde ADR-020 é e não é provado nesta fase

**Decisão**: esta fase **não prova ADR-020 por inteiro**, e isso é declarado em vez de dissimulado.

ADR-020 governa relacionamento entre **dois módulos de negócio**, com inversão por porta na camada
compartilhada. Esta fase cria `grc/` e um consumidor, `modules/risk`. A dependência
`modules → grc` é permitida e direta: não exige porta, não exerce a inversão.

**O que esta fase prova de ADR-020**: as partes que independem da inversão — tabela de vínculo
explícita e nomeada com tipo de auditoria próprio; verificação de escopo do alvo **antes** de
gravar o vínculo; exigência de permissão dos dois lados; vincular e desvincular como eventos
semânticos distintos; desvínculo preservando histórico.

**O que continua sem prova**: a porta e o adaptador entre dois módulos de negócio. O primeiro
exercício real será `modules/controls` ↔ `modules/risk`, na fase de Controles.

**Razão para declarar**: CLAUDE.md §19.10 — mecanismo que nunca foi executado é intenção, não
capacidade. Afirmar que esta fase prova ADR-020 seria exatamente a classe de erro que a regra
proíbe.

---

## R-003: Convergência com o trabalho de tratamento de risco já implementado

**Classificação: TARGETED FUTURE MIGRATION.** Esta fase define o alvo e o contrato de
compatibilidade; a migração de dados é fase própria.

**Estado atual verificado**: `RiskTreatmentAction` tem FKs reais para `Risk`,
`RiskTreatmentDecision` e `User`; campos `title`, `description`, `responsibleUserId`, `dueOn`,
`status` (`TreatmentActionStatus`: OPEN/IN_PROGRESS/COMPLETED/CANCELLED), `completedAt`; três
índices. É a forma da `Action` compartilhada, especializada por FK ao risco.

**Decisão**: nesta fase, `Action` nasce com a origem `RISK_TREATMENT` já declarada no enum, e o
módulo de Riscos **passa a escrever também na `Action`** ao criar uma ação de tratamento, mantendo
`RiskTreatmentAction` como está. Rotas, respostas e telas de risco não mudam.

**Por que não migrar agora**: migração destrutiva não é assumida, e o módulo de Riscos está em uso.
**Por que não adiar inteiramente**: uma `Action` sem consumidor real seria abstração especulativa,
proibida pelo próprio critério de admissão. Escrita dupla dá consumidor real sem quebrar nada.

**Custo declarado**: durante a janela de convergência existem duas representações do mesmo trabalho.
Isso é aceitável **apenas** porque é temporário, declarado e datado. A fase de convergência —
retirar `RiskTreatmentAction` e apontar as rotas de risco para `Action` — é pré-requisito da fase
de Incidentes, que será o segundo consumidor. **Se essa fase não acontecer antes, o débito passa a
ser permanente e a decisão precisa ser revista, não repetida.**

**Alternativas rejeitadas**:

- Migrar tudo agora — migração destrutiva num módulo em uso, com risco desproporcional ao ganho.
- Deixar Risco fora da `Action` — criaria os dois conceitos concorrentes que a especificação
  proíbe em FR-019.
- Fazer `Action` uma view sobre `RiskTreatmentAction` — amarraria a capacidade compartilhada à
  forma de um domínio, exatamente o defeito de referência.

---

## R-004: Escopo organizacional das entidades compartilhadas

**Decisão**: cada entidade compartilhada pertence a **exatamente uma** unidade organizacional, e a
visibilidade segue as regras de escopo já existentes — quem tem escopo em um nó enxerga o nó e seus
descendentes.

**Vínculo entre escopos**: permitido apenas se o ator tem escopo sobre **os dois lados** no momento
do vínculo. Verificado antes de gravar.

**Artefato compartilhado por toda a instituição**: representado por posse na raiz da árvore, não
por uma coluna "global" nova. A hierarquia já expressa isso.

**Razão**: não enfraquecer o isolamento existente nem introduzir atalho inconsistente com a
hierarquia. Uma coluna de escopo global seria um segundo modelo de escopo convivendo com o
primeiro.

**Alternativas rejeitadas**: entidade sem escopo (quebra o isolamento); entidade visível a todos os
ancestrais por padrão (vaza para cima, invertendo a semântica atual); flag `isGlobal` (segundo
modelo de escopo).

---

## R-005: Severidade e prioridade em Achado

**Decisão**: dois campos distintos, com significados distintos. **Severidade** descreve a gravidade
do que foi constatado, é atributo do fato e não muda com o contexto. **Prioridade** descreve a
urgência de tratar, é decisão de gestão e pode mudar sem que o fato mude.

**Razão**: colapsá-los impede a pergunta que auditoria faz com mais frequência — "quais achados
graves foram despriorizados, por quem e quando". Com um campo só, a resposta não existe.

**Alternativa rejeitada**: campo único de criticidade. Mais simples, e destrói informação que o
domínio precisa.

---

## R-006: Onde vive a regra de vencimento

**Decisão**: um único serviço puro no núcleo GRC calcula vencimento a partir do prazo e do estado.
Nenhum consumidor reimplementa a comparação.

**Razão**: F-24 registra que este predicado está hoje duplicado em quatro lugares no módulo de
Riscos — violação viva do princípio de calculador único que o `RiskScoringService` já respeita para
nível de risco. Repetir o padrão numa capacidade compartilhada multiplicaria o defeito por cada
domínio futuro.

**Consequência**: a fase de convergência (R-003) é a oportunidade natural de eliminar as quatro
duplicatas existentes. Não é feita aqui, mas é registrada como dívida com dono.

---

## R-007: Preservação histórica sem motor temporal genérico

**Decisão**: três mecanismos distintos, escolhidos por natureza do dado, sem mecanismo universal.

| Necessidade | Mecanismo |
|---|---|
| Estado atual muda e o anterior importa | transição de estado registrada como evento de auditoria semântico com valores anterior e posterior |
| Registro sai de circulação | arquivamento com autor e data; nunca exclusão física |
| Vínculo deixa de valer, mas valeu | desvínculo com autor e data, linha preservada |

**Razão**: a exigência real é "o fato histórico não pode ser apagado", não "qualquer entidade pode
ser consultada em qualquer instante". Um subsistema genérico de snapshot foi construído e
**arrancado** no produto de referência — evidência direta de que a generalização não se paga.

**Alternativa rejeitada**: tabela de versões por entidade, ou motor temporal "as-of". Custo alto,
sem consumidor que o justifique nesta fase.

---

## R-008: Identificadores legíveis

**Decisão**: código legível por entidade, no padrão já usado por risco (`RSK-2026-0001`):
`EVD-`, `ACT-`, `FND-`, com ano e sequência.

**Razão**: um achado é citado em relatório de auditoria, ata e ofício. Citar UUID é inviável na
prática. O produto de referência não deu código ao risco e é uma omissão que os próprios
mantenedores contradizem em outras entidades.

---

## R-009: Superfície de interface

**Decisão**: nenhuma das três entidades ganha entrada própria na navegação principal nesta fase.
Evidência e Achado aparecem nos contextos de domínio que os consomem. Ação ganha **uma** tela —
"Minhas ações" — porque o valor de ter uma lista única por responsável é justamente o que motiva a
capacidade compartilhada.

**Razão**: a barra lateral é o mapa do produto para o usuário, não o índice do modelo de dados.
Expor todo tipo de entidade nela transformaria a navegação em reflexo do schema.

**Alternativa rejeitada**: três entradas de menu. Adiciona ruído antes de existir volume que o
justifique, e contraria a política de UI/UX vigente.

---

### R-009 — emenda de 2026-09-12: a decisão era sobre navegação, e foi executada como se fosse sobre profundidade

**O que esta emenda registra.** R-009 decidiu **quantas entradas de menu** as três capacidades do
núcleo GRC ganhariam, e decidiu bem: uma, para Ação. Ela não decidiu — nem poderia — que Ação
teria menos superfície que qualquer domínio que a consome. Foi assim que a implementação a leu, e
o resultado ficou de pé por quatro fases sem ninguém medir.

**O que estava medido no repositório em 2026-09-12**, antes do trabalho que esta emenda acompanha:

- `apps/web/src/features/actions/api.ts` expunha `getAction` e `updateAction` desde a fase 002.
  **Nenhum arquivo do repositório chamava qualquer um dos dois.** A capacidade compartilhada da
  plataforma não tinha, na interface, nem detalhe nem edição.
- `apps/web/src/app/(app)/actions/` continha **só** `page.tsx`. Todo outro domínio —
  risco, controle, ativo, processo, incidente, problema, compliance, auditoria — tem rota `[id]`.
- `risk-detail-view.tsx` tinha **duas** abas de ação: "Tratamento", que renderizava a
  `TreatmentActionsTable` funcional, e "Planos de Ação", que renderizava um marcador de recurso
  indisponível. A aba que levava o nome do recurso era a que não entregava nada.
- `findings-panel.tsx` exibia `openActionCount` — contagem real, calculada no servidor a partir
  da tabela `actions` — sem nenhum caminho até essas ações, nem forma de criar uma.
- Não existia endpoint de trilha por ação, embora Risco tivesse o seu desde a fase 001.

**Por que isso importa mais do que uma tela faltando.** CLAUDE.md §19.10 diz que ponto de
extensão que compila mas nunca foi chamado é intenção, não capacidade, e que este projeto já pagou
sete vezes por esse padrão. `getAction`/`updateAction` são a oitava. A regra estava escrita, a
violação estava no disco, e nenhuma guarda a pegava — porque método de cliente HTTP sem chamador
não quebra teste nenhum.

**O que NÃO muda.** A decisão de uma única entrada de menu permanece correta e permanece em vigor.
Ação continua com uma entrada; Evidência e Achado continuam sem nenhuma. A emenda não abre porta
para expor tipo de entidade na barra lateral.

**O que muda.** A entrada deixa de ser uma lista de trabalho pessoal e passa a ser a superfície de
gestão de Plano de Ação da plataforma, com detalhe, edição, ciclo de vida e trilha por ação — e o
filtro "somente minhas" continua existindo, como filtro, não como identidade da tela. Ação deixa
de ser a única capacidade do produto que o usuário não consegue abrir.

---

## R-010: Reuso legítimo de evidência sem violar autorização

**Decisão**: uma evidência pode ser vinculada a vários sujeitos. A autorização é avaliada **por
vínculo**, no momento do vínculo e no momento da leitura — nunca herdada de um vínculo anterior.

**Razão**: um relatório de teste de intrusão legitimamente prova vários controles. Mas "está
vinculada a algo que eu vejo" não pode implicar "posso ver a evidência": isso transformaria o
vínculo em canal de escalonamento de acesso.

**Consequência**: ao listar os vínculos de um sujeito, evidências fora do escopo do leitor são
omitidas, e a contagem exibida reflete o que ele pode ver — não o total real. É deliberado; a
alternativa revelaria existência.
