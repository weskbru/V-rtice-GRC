# 010 — Superfície de Plano de Ação: registro operacional

> **Documento histórico — registro de fechamento da fase 010 (Superfície de Plano de Ação).** Não
> descreve necessariamente o estado atual do produto. Fonte vigente:
> [`docs/STATE.md`](../../docs/STATE.md) e [`docs/modules/grc-core.md`](../../docs/modules/grc-core.md).
> Em particular, §7 abaixo lista "E2E dos fluxos entre origens" como NÃO VERIFICADO e F-61 como
> aberto — **os dois já não estão mais assim**: `apps/web/e2e/action-plan.spec.ts` existe hoje e
> cobre o fluxo entre origens em navegador, e F-61 foi corrigido em 2026-09-13
> (`docs/deferred-findings.md`, F-61). O parágrafo de §7 é mantido sem edição como registro de
> quando essas lacunas foram identificadas.

Checkpoint desta frente de trabalho. Escrito para ser lido por quem chegar depois sem o contexto
da sessão. Cada afirmação carrega como foi medida, e o que **não** foi medido está marcado como
NÃO VERIFICADO, nunca omitido.

Linha de base: commit `ba3a211` (`docs: Phase 7 closes, and with it the roadmap as currently
written`).

---

## §0 — Por que esta frente existe

O roteiro arquitetural de `docs/architecture/grc-roadmap.md` (Fases 0 a 7) foi declarado concluído
em `ba3a211`, e CLAUDE.md §17 foi atualizado para dizer que não há Fase 8 e que o próximo passo é
uma decisão de produto.

Esse fechamento estava correto quanto às fases que descrevia e **errado quanto ao produto**: a
capacidade `Action` — o Plano de Ação do Vértice GRC, §17 do CLAUDE.md — estava completa no servidor
e incompleta na interface, de uma forma que nenhuma guarda deste repositório detectava.

§1 registra o que foi medido. §5 registra a correção documental, sem reescrever a história.

---

## §1 — O que estava medido no repositório, antes desta frente

Cinco constatações, todas verificadas por leitura direta do código em `ba3a211`:

1. **Nenhuma página de detalhe de ação existia.** `apps/web/src/app/(app)/actions/` continha só
   `page.tsx`. Risco, controle, ativo, processo, incidente, problema, compliance e auditoria têm
   todos rota `[id]`.

2. **`getAction` e `updateAction` nunca haviam sido chamados.** Os dois estão em
   `apps/web/src/features/actions/api.ts` desde a fase 002. Uma varredura do repositório inteiro
   não encontrou chamador nenhum. Pela regra de CLAUDE.md §19.10 — ponto de extensão que compila
   mas nunca foi executado é intenção, não capacidade — isso é a oitava ocorrência do padrão que
   a própria regra diz que este projeto já pagou sete vezes.

3. **O detalhe do risco tinha duas abas de ação, e a errada é que entregava.**
   `risk-detail-view.tsx` renderizava `TreatmentActionsTable` — funcional, com criação e mudança
   de status sob `risk:treat` — dentro da aba **"Tratamento"**, enquanto a aba **"Planos de Ação"**
   renderizava um marcador de recurso indisponível. Anunciar o recurso e não entregá-lo é pior que
   não ter a aba.

4. **Achados exibiam uma contagem morta.** `findings-panel.tsx` mostra `openActionCount`, número
   real calculado no servidor a partir da tabela `actions` (`prisma-finding.repository.ts`), sem
   nenhum caminho até essas ações e sem forma de criar uma. `FINDING` é um dos cinco
   `ActionOriginType` e tem acessor de origem no servidor.

5. **Não existia trilha de auditoria por ação.** Risco tem `GET /risks/{riskId}/audit-events`
   desde a fase 001; Ação não tinha equivalente.

**O que NÃO era verdade**, e foi corrigido durante a própria investigação: não é o caso de o
produto não ter superfície de ação nenhuma. Incidentes, Problemas e verificação de Controle já
criam e transicionam ações pelas suas próprias telas, e o risco já tinha a tabela citada em (3).
O coordenador afirmou a versão mais forte antes de medir a aba "Tratamento", e a retificou.

---

## §2 — O que NÃO foi encontrado, e por isso não foi criado

A investigação procurou especificamente pelo defeito que a diretriz desta frente proíbe criar —
uma segunda autoridade de Ação — e **não o encontrou**:

- `RiskTreatmentAction` não é entidade concorrente. `treatment.controller.ts` lê a tabela
  `actions` diretamente, por origem, e o repositório de tratamento resolve apenas o vínculo
  decisão↔ação. O próprio código documenta isso.
- Não há tabela paralela de plano de ação, nem serviço independente com a mesma regra, nem modelo
  genérico concorrente.
- Os cinco valores de `ActionOriginType` têm, cada um, acessor de origem no servidor.

Consequência de projeto: **nada de novo foi modelado nesta frente**. Tudo o que ela entrega são
superfícies e uma rota de leitura sobre a autoridade que já existia.

---

## §3 — Frentes desta entrega

| # | Frente | Estado |
|---|---|---|
| 1 | `GET /actions/{actionId}/audit-events` — trilha por ação | IMPLEMENTADO, VERIFICADO (§3.1), commit `940c5e3` |
| 2 | Aba "Planos de Ação" do risco | IMPLEMENTADO, VERIFICADO (§3.2), commit `3b8c90a` |
| 3 | Detalhe central `/actions/{id}` e reenquadramento da lista | IMPLEMENTADO, VERIFICADO (§3.3), commit `3b8c90a` |
| 4 | Ações de remediação do achado | IMPLEMENTADO, VERIFICADO (§3.4), commit `3b8c90a` |
| 5 | E2E dos fluxos entre origens | EM ANDAMENTO |
| 6 | Correção documental e fechamento | PARCIAL (§5) |

### §3.2 — Aba "Planos de Ação" do risco

A tabela funcional que vivia na aba "Tratamento" foi **movida**, não duplicada, para a aba que leva
o nome do recurso. Escrever uma segunda tabela das mesmas linhas em abas vizinhas seria exatamente
a duplicação que CLAUDE.md §18.12/§19.6 existem para impedir.

Ela ganhou o que faltava para ser um plano de ação: menu das transições legais no lugar do seletor
livre de quatro status, edição de título/descrição/responsável/prazo, resumo de total e atrasadas a
partir de dado que a tela já carregava, e link por linha para `/actions/{id}`. A aba "Tratamento"
mantém a decisão e aponta para onde as ações foram, para que a ausência não seja lida como perda.

**Defeito corrigido durante a revisão, registrado porque era latente e não visível**: a primeira
versão roteou as transições por `POST /actions/{actionId}/transitions`, que exige `action:edit`,
enquanto a aba inteira está atrás de `risk:treat`. Nenhum papel semeado hoje tem um sem o outro, de
modo que nada quebraria na tela — o gate único da aba simplesmente passaria a ser mentira no dia em
que um papel tivesse só um dos dois. As quatro operações passam agora pelas rotas do próprio risco.
Isso **não** é caminho paralelo: `UpdateTreatmentActionUseCase` delega a mudança de status ao
`TransitionActionUseCase`, mesma tabela de legalidade, mesmo invariante de motivo, mesmos eventos
`action.*`. O que a rota do risco faz a mais, e que o desvio pulava em silêncio: confere que o
`:riskId` da URL é mesmo a origem daquela ação, e avança a versão do risco que o `ETag` da tela
reflete. A prova é um teste que afirma a rota e o `If-Match`, e uma captura instrumentada com
escuta de rede que acusaria qualquer chamada à rota compartilhada.

### §3.3 — Detalhe central e reenquadramento da lista

`/actions/{id}` existe: dados completos, edição dos quatro campos que `UpdateActionRequest` aceita,
barra de ciclo de vida, aba de visão geral e aba de auditoria consumindo a rota da §3.1.

A navegação até a origem usa **um** resolvedor compartilhado pela coluna da lista e pelo detalhe, e
é honesta sobre o que não existe: `RISK_TREATMENT`, `INCIDENT` e `PROBLEM` têm rota de detalhe e
viram link; `FINDING` e `CONTROL_ASSESSMENT` não têm — achado vive dentro do engajamento, e o
`originId` de `CONTROL_ASSESSMENT` é uma verificação, não o controle — e renderizam o rótulo sem
link. Nenhuma rota foi inventada e nenhum id foi adivinhado.

A tela deixou de se chamar "Minhas ações". "Somente minhas" continua existindo, como filtro, ligado
por padrão. Identificadores técnicos (`my-actions`, nomes de arquivo) permanecem em inglês (§11.1).

**Defeito corrigido, encontrado pela frente e escalado em vez de decidido sozinha**: o registro de
navegação tinha uma entrada desabilitada, marcada "Planejado", rotulada exatamente "Planos de Ação".
Renomear a tela real produziu duas linhas com o mesmo nome, uma viva e uma marcada como não
construída. A entrada planejada foi removida — Plano de Ação não é módulo por construir (§1/§4/§17).

Isso derrubou a guarda de FR-043, e o motivo importa: ela afirmava "existe ao menos uma entrada
planejada, e ela é bem formada", o que só valia enquanto algum módulo estivesse por construir. Ela
ficaria vermelha diante de uma mudança correta — prova de que media o **conteúdo** do registro, não
o contrato dele. As duas metades foram reescritas: no registro, cada entrada é implementada com
destino real ou planejada sem destino nenhum, mais uma segunda asserção exigindo que o conjunto de
implementadas seja exatamente o enumerado; na renderização, o estado planejado passou a ser provado
contra um exemplar explícito, em arquivo próprio, incluindo o caso recolhido em que rótulo e selo
somem e só resta o texto para leitor de tela. A não-vacuidade da asserção nova foi verificada
removendo um módulo da lista esperada e observando o teste falhar pelo motivo certo.

### §3.4 — Ações de remediação do achado

O painel de achados exibia `openActionCount` sem caminho até as ações. Agora a própria contagem é o
controle que expande a seção, com criação e transições.

Duas decisões que valem registro:

- **Montagem sob demanda.** A seção não busca nada enquanto o achado está recolhido. O painel já
  dispara duas requisições por achado ao montar (ver F-61); esta não é a terceira.
- **A contagem se atualiza relendo o achado.** Ela é derivada no servidor a partir da tabela
  `actions` (§19.7) e nunca é recalculada no cliente. A verificação renderizada pegou o número
  parado em 2 depois de criada a terceira ação — numa superfície que existe justamente porque aquele
  número não levava a lugar nenhum, deixá-lo defasado teria trocado um número morto por um errado.
  Medido depois da correção: 3 → 4 na criação.

### §3.5 — Duplicação eliminada no diálogo de reabertura

Ao devolver as transições do risco para a rota correta (§3.2), o diálogo compartilhado de
reabertura deixou de servir, porque disparava a chamada por dentro. A frente contornou copiando o
diálogo inteiro para dentro da tabela. As duas cópias liam o mesmo catálogo, então o **texto** não
podia divergir — mas marcação, ordem de foco e ARIA podiam, e é essa metade que quebra em silêncio.

O diálogo passou a receber a escrita como parâmetro. Quatro das cinco origens continuam sem informar
nada e seguem chamando a rota compartilhada; a tabela do risco informa a sua. A cópia saiu.

### §3.6 — Rótulo faltando na trilha

A verificação renderizada da aba de auditoria mostrou o **primeiro evento de toda trilha** — a
criação — lendo metade em português e metade em inglês: `originType` e `originId` não tinham rótulo
pt-BR, porque o mapa cobria só os campos de edição. Corrigido. Os **valores** continuam como o
servidor os gravou: `FINDING` é valor de enum, que §11.1 mantém em inglês de propósito.

### §3.1 — Trilha por ação

`GET /api/v1/actions/{actionId}/audit-events`, em
`apps/api/src/grc/action/presentation/action-audit.controller.ts`, com o caso de uso em
`list-action-audit-events.usecase.ts`. Espelha `list-risk-audit-events.usecase.ts`, incluindo a
ordem dos dois portões — a parte que importa para segurança, conferida lado a lado contra o
precedente:

1. `action:view` — ausência, ação inexistente e origem fora do escopo atual do ator caem todos em
   404 idêntico (ADR-009). O escopo vem de `assertActionOriginInScope`, que já existia e resolve
   contra a unidade organizacional **atual** da origem, nunca o `Action.orgUnitId` obsoleto.
2. `audit:view` — checado só depois que o passo 1 passou; ausência é 403, porque a existência da
   ação já é conhecida pelo chamador.

Diferença legítima em relação a Risco, registrada no cabeçalho do caso de uso: Risco agrega quatro
tipos de registro filho na trilha; Ação não tem registro filho — criação, edição e transição
gravam todas sob `AuditEntityType.ACTION`. Edições feitas pela rota de tratamento do risco gravam
`RISK_TREATMENT_ACTION` e aparecem na trilha do Risco, não nesta.

Portões estruturais atravessados: contrato declarado em
`specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml` (o único que declara
`/actions`); `openapi.json` regerado e `openapi:check` limpo; `packages/api-types` regerado;
varredura de `information-disclosure.spec.ts` posicionada **depois** de a ação existir e ter
sofrido transição, para não varrer trilha vazia; e o total de `contract-coverage.spec.ts` movido
de 211 para 212 — número lido da falha real do teste, não calculado de cabeça.

Medição, em série: unidade da API 57 arquivos/569 testes (idêntico à linha de base); contrato
56/815 (55/807 mais o arquivo novo, com 8 testes); integração 53/262 (52/258 mais o arquivo novo,
com 4). Lint, typecheck, `format:check` escopado, `openapi:generate` e `openapi:check` limpos.

---

## §4 — Restrições que valem para toda esta frente

- **Uma única autoridade de Ação.** Nenhuma entidade nova, nenhuma tabela paralela, nenhum
  serviço independente com a mesma regra. Vínculo real, nunca cópia de dado para facilitar tela.
- **Agregar origens não alarga acesso.** A tela central mostra ações de várias origens; cada uma
  continua obedecendo ao seu escopo organizacional e à sua autorização, decididos no servidor.
- **Não-divulgação preservada.** Recurso fora do escopo responde como inexistente, nunca 403.
- **Auditoria append-only preservada.** Nenhum mecanismo paralelo de trilha.
- **CI remota: BLOCKED** — bloqueio de faturamento do GitHub Actions, externo ao código. Nada foi
  alterado no código para contorná-lo. A validação desta frente é local e está medida acima.

---

## §5 — Correção documental

`specs/002-shared-grc-foundation/research.md` recebeu uma emenda datada sob R-009, registrando que
aquela decisão era sobre **quantas entradas de menu** as capacidades do núcleo ganhariam — e que
foi executada como se fosse também uma decisão sobre **profundidade de superfície**. A decisão
original de uma única entrada permanece em vigor e não foi revogada.

O fechamento da Fase 7 em `ba3a211` **não foi apagado nem reescrito**. Ele descrevia corretamente
as fases que cobria. O que faltava era a constatação de §1, que ninguém havia medido — e que agora
está medida aqui.

CLAUDE.md §17 e `docs/architecture/grc-roadmap.md` foram atualizados **depois** de as frentes 1 a 4
estarem medidas, para que o texto descrevesse o que foi entregue e não o que se pretendia entregar.

---

## §6 — Medição

Em série, nunca com duas suítes disputando o mesmo banco (§22 da diretriz de sessão). Nenhum teste
removido, nenhum `skip` acrescentado, nenhuma asserção enfraquecida, nenhum timeout inflado.

| Suíte | Linha de base (`ba3a211`) | Depois |
|---|---|---|
| Unidade da web | 123 arquivos / 663 testes | 129 / 725 |
| Unidade da API | 57 / 569 | 57 / 569 |
| Contrato | 55 / 807 | 56 / 815 |
| Integração | 52 / 258 | 53 / 262 |

`typecheck`, `lint`, `format:check`, `openapi:generate` e `openapi:check` limpos.

Verificação renderizada, nos dois temas e em 1440/400 px, contra a aplicação construída em modo de
produção: capturas em `docs/reviews/ui/risk-action-plan/`,
`docs/reviews/ui/finding-corrective-actions/` e `docs/reviews/ui/action-plan-nav/`. O que foi
confirmado olhando a tela, não o código: uma única linha "Planos de Ação" no menu, ligando para
`/actions`, sem selo "Planejado"; a lista central com código, origem, responsável, prazo e marca de
atraso por ícone e texto, nunca só por cor; o detalhe servindo trilha real depois de a rota da §3.1
subir; e a contagem do achado passando de 3 para 4 na criação.

**Uma falsa detecção do próprio coordenador, registrada para não custar de novo**: a primeira
verificação do link da linha concluiu que ele não navegava. Ele navega. O clique tinha sido disparado
logo após `networkidle`, antes da hidratação — a armadilha que `ui-capture.mjs` documenta no próprio
cabeçalho, e na qual o coordenador caiu depois de tê-la citado em três briefings.

**CI REMOTA: BLOCKED.** Bloqueio de faturamento do GitHub Actions, externo ao código. Nada foi
alterado no código para contorná-lo.

---

## §7 — O que ficou aberto, e por quê

- **E2E dos fluxos entre origens** — em andamento quando esta seção foi escrita. Enquanto não
  estiver medida, a prova de que uma ação criada no risco aparece na superfície central existe em
  teste de componente e em verificação renderizada manual, **não** em jornada automatizada de
  navegador. Registrado como NÃO VERIFICADO, não como pronto.
- **F-61** (`docs/deferred-findings.md`) — a aba "Achados" dispara duas requisições por achado ao
  montar, e com 44 achados o limitador global recusa 24 de 112, pintando faixas de erro na tela.
  Medido durante esta frente, **não** causado por ela, e deliberadamente não corrigido: a correção
  óbvia muda o comportamento da aba e é decisão de produto. Afrouxar `THROTTLE_LIMIT` para esconder
  o sintoma está fora de questão — o limite está certo, quem está errado é o volume.
- **Extração do painel de ações por origem** — Incidente, Problema e Achado têm agora três cópias
  quase idênticas de busca, tabela, formulário e transições. A frente do achado avaliou a extração e
  recomendou fazê-la, com o inventário do que é comum e do que é genuinamente diferente (origem e
  catálogo, forma de obter permissão, presença de `Card`, coluna de código, momento da montagem).
  Não foi feita porque três frentes editavam esses diretórios ao mesmo tempo.
- **Criação de ação a partir da tela central** — continua não existindo, e isso é deliberado. R-009
  decidiu que a criação acontece no contexto de domínio de onde a ação nasce, e as cinco origens
  têm essa superfície. Uma criação genérica exigiria escolher origem e identificador numa tela que
  não conhece nenhum dos cinco domínios.
