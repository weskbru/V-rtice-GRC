# Raio de impacto — refinamento de UX/UI em cinco áreas do detalhe de risco

> Leitura pura, produzida enquanto o Agente 1 mexe em produção (HEAD no início
> desta leitura: `dd72bad`, branch `016-risk-detail-experience`). Nenhum teste,
> build ou navegador foi executado para produzir este documento — cada
> afirmação vem de ler o código-fonte e citar `arquivo:linha`. Não propõe
> design; só mede o que existe e o que depende do que existe.
>
> Cinco áreas, na ordem em que foram encomendadas:
> 1. Faixa de resumo executivo
> 2. Análise (Avaliação, Próxima revisão)
> 3. Resposta (Tratamento, Controles)
> 4. Causas e Consequências
> 5. Achados
>
> Fora de escopo, por instrução explícita: F-77, F-78, F-71, D-24, problemas
> de ambiente, auditoria sistêmica nova.

---

## 1. Testes unitários — o que depende de quê

### 1.1 Área 1 — Faixa de resumo executivo

**`apps/web/src/features/risks/components/detail/risk-summary-row.test.tsx`** (125 linhas)

| Linha(s) | O que assume | Risco |
|---|---|---|
| 116-124 | `container.querySelectorAll('section > div')` espera **exatamente 5** elementos, todos com a classe `items-start` | **Quebra certa.** "Cinco cards iguais" → "quatro blocos assimétricos" muda a contagem estrutural; este teste é uma asserção de estrutura DOM (seletor CSS posicional), não de conteúdo — qualquer composição que não seja "5 `div` filhos diretos de um `section`" derruba o teste inteiro, mesmo que o conteúdo esteja correto. |
| 53-56, 58-62, 64-68, 70-87, 89-97, 99-106 | Presença de texto (`Não avaliado`, `Alto`, `Baixo`, `Não definido`, `Não possui`, `Mitigar`, `Prazo vencido`, valores numéricos, `Não agendada`, `Em atraso`) | **Baixo-médio.** São `getByText`/`getAllByText`, não dependem de ordem nem de contagem de blocos — sobrevivem SE os mesmos textos continuarem existindo em algum lugar da composição nova. A regra "valor ausente nunca em manchete" é uma mudança de *tipografia* (classe CSS), invisível para `@testing-library` a menos que o texto em si mude (ex.: se "Não avaliado" for reformulado). |

Consumidor da mesma primitiva em outros módulos (ver §4.1 — risco transversal).

### 1.2 Área 2 — Análise (Avaliação, Próxima revisão)

**`apps/web/src/features/risks/components/risk-assessment-section.test.tsx`** (172 linhas) — leitura da avaliação vigente, sem formulário. Nenhuma asserção depende de ordem entre a matriz e os metadados (cada `it` testa presença de texto, nunca posição relativa). **Não deveria quebrar** só por causa da hierarquia resultado→interpretação→contexto→ação, a menos que a REORGANIZAÇÃO renomeie ou remova algum destes textos: `'Este risco ainda não foi avaliado'` (114-118), `'Inerente: Crítico'`/`'Residual: Baixo'` (124-131), `'Avaliado por Ana Souza'` (128), os três `<dt>` sr-only (146-152), ou o comportamento de degradação da metodologia (159-171).

**`apps/web/src/features/risks/components/assessment-form.test.tsx`** (197 linhas) — **todo o arquivo** renderiza `<AssessmentForm>` diretamente e interage com a matriz/campo "Justificativa" **sem nenhum clique prévio**:
- Linha 79 (`render`) → linha 81 (`await screen.findByRole('table')`) — assume a matriz já montada.
- Linhas 92-141 (teste "never submits a derived score..."): linha 99 renderiza, linha 100 já espera a tabela, linhas 103-116 clicam células e enviam a "Justificativa" e o "Registrar avaliação" sem revelar nada antes.
- Linhas 143-156 e 158-196: mesmo padrão.

**Ambiguidade que decide se isto quebra**: o brief diz que "Registrar nova avaliação" sai de formulário sempre aberto para ação contextual, no padrão `showForm` de `treatment-actions-table.tsx:590`. Esse padrão está **dentro** do componente que já lista o conteúdo (`TreatmentActionsTable` decide sozinho se mostra lista ou formulário). Se o mesmo formato for aplicado **dentro de `AssessmentForm`** (o componente passa a nascer fechado e só abre com um clique interno), este arquivo inteiro quebra — nenhum teste clica em nada antes de interagir com a matriz. Se em vez disso o toggle ficar em um componente **pai** (ex.: a seção de Análise decide se monta `<AssessmentForm>` ou não), `assessment-form.test.tsx` sobrevive sem alteração, porque continua testando o componente já montado, isoladamente — exatamente como faz hoje. **Não dá para saber qual dos dois pelo código atual**; é o primeiro fato a verificar quando o Agente 1 terminar.

**`apps/web/src/features/risks/components/risk-review-schedule.test.tsx`** (136 linhas) — mesma estrutura de risco:
- Linha 64-65: só leitura (`Data agendada: Não definida`) — sobrevive.
- Linha 68-81: só leitura — sobrevive.
- Linha 83-101: só leitura (indicador de atraso) — sobrevive.
- **Linha 103-119** (`'saves a new next review date...'`): linha 110 chama `fireEvent.change(screen.getByLabelText('Nova data de próxima revisão'), ...)` **sem clicar em nada antes** — se a alteração de próxima revisão virar ação contextual (like o brief descreve), este campo não existe até um clique revelar o formulário. Quebra.
- **Linha 121-135** (`'surfaces a 409...'`): linha 125, mesmo padrão, mesma quebra.

**`apps/web/src/features/risks/components/assessment-history.test.tsx`** (158 linhas) — tabela paginada, sem formulário, sem dependência de ordem externa (a ordem interna das próprias linhas — mais nova primeiro — é auto-contida). **Não deveria quebrar.**

### 1.3 Área 3 — Resposta (Tratamento, Controles)

**`apps/web/src/features/risks/components/risk-treatment-section.test.tsx`** (166 linhas):
| Linha(s) | Teste | Risco |
|---|---|---|
| 84-97 | Estado honesto "sem decisão" | Sobrevive (só leitura) |
| 99-108 | Mostra decisão vigente | Sobrevive (só leitura) |
| 110-121 | Esconde o formulário sem `risk:treat` — `queryByRole('button', {name:'Registrar decisão'})` ausente | Sobrevive provavelmente — a ausência continua ausência com ou sem `showForm` |
| **123-135** | Aviso de supersessão visível **assim que o formulário renderiza**, sem clique (linha 129-131: `findByText(/Registrar esta nova decisão irá substituí-la/)` direto após `render`) | **Quebra** se o formulário (e o aviso, que vive dentro dele) for para trás de uma ação |
| **137-165** | Linha 145: `await screen.findByRole('button', { name: 'Registrar decisão' })`, seguido imediatamente (147-152) de clique no combobox "Estratégia" e no campo "Descrição", **sem nenhum clique de revelação** | **Quebra** — se `showForm` viver aqui, o primeiro achado desse nome é o botão de REVELAR (mesmo texto do botão de submissão, pelo padrão de `treatment-actions-table.tsx:590`/711-714), e a matriz/campo não existe ainda |

**`apps/web/src/features/risks/components/risk-controls-section.test.tsx`** (295 linhas) — usado por **dois** pontos de montagem (`families: ['controls']` em Resposta, `families: ['processes','assets']` em Relacionamentos, `risk-detail-view.tsx` linhas ~392-403 e ~436-449). Isso importa porque o brief só pede a mudança para Resposta/Controles:
| Linha(s) | Teste | Risco |
|---|---|---|
| 127-141 | Três estados vazios simultâneos | Sobrevive (só leitura) |
| 143-157 | Lista um controle vinculado | Sobrevive |
| **159-178** | `getByRole('combobox', {name:'Selecionar processo'})`/`'Selecionar ativo'` **visíveis sem clique** (175-176) | Testa `canEditRelationships` (processos/ativos) — **só quebra se a mudança "formulário atrás de ação" for aplicada ao subcomponente compartilhado (`RelationshipSubsection`) para TODAS as famílias**, não apenas para `controls`. Ver §4.3. |
| **180-221** | Linha 210: `fireEvent.click(screen.getByRole('combobox', {name:'Selecionar controle'}))` **sem clique de revelação antes** | **Quebra** se o picker de Controles for para trás de uma ação — este é o teste diretamente no escopo do brief |
| 223-243 | Pede confirmação antes de desvincular | Sobrevive (não depende do picker) |
| 245-269 | Desvincula processo após confirmação | Sobrevive (mesmo motivo) |
| 274-294 | `families={['controls']}` renderiza só a família pedida | Sobrevive (não interage com o picker) |

**`apps/web/src/features/risks/components/treatment-actions-table.test.tsx`** (390 linhas) — **é a referência**, não o alvo. Linha 216 já faz exatamente `fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação' }))` antes de preencher qualquer campo, e linha 221 clica no **mesmo nome** de novo para submeter — confirma que o botão de revelar e o botão de submeter compartilham rótulo neste padrão. Não deveria mudar nesta rodada ("Planos de Ação já está certo").

### 1.4 Área 4 — Causas e Consequências

**`apps/web/src/features/risks/components/risk-causes-consequences.test.tsx`** (144 linhas) — hoje **todo** o arquivo depende de dois fatos que a nova composição elimina: (a) todo `<Input>` de linha está sempre editável (`risk-causes-consequences.tsx:101-108`), e (b) existe um botão global por lista, "Salvar causas"/"Salvar consequências" (`risk-causes-consequences.tsx:141-144`), que envia a coleção inteira.

| Linha(s) | Teste | Risco |
|---|---|---|
| 33-50 | Cada causa/consequência existente é seu próprio `<Input>` rotulado, com `toHaveValue(...)` | **Quebra** se o item persistido virar exibição em modo leitura (deixa de ser um `<input>` com valor) |
| 52-97 | Adiciona linha (71), preenche via `fireEvent.change` no mesmo input sem confirmação por item (79), salva via botão global (75, 80) | **Quebra** — depende de edição sempre aberta E de botão de salvar coletivo, os dois pilares que saem |
| 99-119 | Remove uma linha **sem salvar antes** (113), espera renumeração imediata client-side | **Incerto** — o brief só descreve o fluxo de adicionar/editar; não diz se remover também passa a exigir confirmação explícita. Verificar quando o código chegar. |
| 121-144 | Dispara 409 clicando **"Salvar consequências"** diretamente (134) | **Quebra** — depende do botão global que sai |

**Pergunta que o coordenador pediu para responder com evidência**: qual teste hoje provaria que editar um item não sobrescreve silenciosamente outro item pendente?

**Resposta: nenhum, e a razão está na própria arquitetura atual.** `save()` (`risk-causes-consequences.tsx:168-208`) lê `form.getValues('rows')` — **o array inteiro do `react-hook-form`, de uma vez** — e manda tudo em um `PUT` só (linhas 193-196). Hoje **não existe** o conceito de "item A em edição, item B intocado": todo item vive permanentemente no mesmo `useFieldArray`, e qualquer salvamento já commita o valor corrente de TODOS os itens simultaneamente, editados ou não. Não há dois estados divergentes para um "pendente" sobrescrever — o design atual não tem essa categoria de bug porque não tem essa categoria de estado. Os quatro testes existentes (33-50, 52-97, 99-119, 121-144) nunca testam "dois itens em edição ao mesmo tempo" porque hoje isso não é uma situação distinta de "um item em edição" — são o mesmo estado.

A garantia nova ("permitir um único item em edição por vez, para que confirmar nunca persista em silêncio uma alteração pendente de outro item") introduz uma categoria de estado que **não existe no código nem no teste hoje**: um item em edição local (não salvo) coexistindo com outros itens já persistidos, e uma ação de "confirmar" que precisa enviar a coleção inteira (contrato inalterado, `PUT` continua substituindo tudo) **sem** perder o valor já salvo de itens que não estão em edição. Isso só pode ser provado por um teste **novo**, que hoje não tem equivalente em nenhuma linha deste arquivo.

### 1.5 Área 5 — Achados

**`apps/web/src/features/findings/components/findings-panel.test.tsx`** (556 linhas):

| Linha(s) | Teste | Depende de quê hoje | Risco |
|---|---|---|---|
| 197-214 | Lista achados com metadados (`'Aberto'`, `'Alta'` visíveis) | Card sempre expandido | **Baixo** — status/severidade estão na lista de campos que o coordenador confirmou disponíveis sem requisição nova (`status`, `severity`); esperado que continuem no resumo recolhido |
| 216-228, 230-234, 236-250 | Estado vazio, botão "Novo achado" condicionado a `finding:create` | Não interage com o card individual | Sobrevive |
| **252-273** | `getAllByRole('button', {name:'Encerrar'})`/`'Reabrir'` **sem expandir nada antes** | Botões de ação hoje sempre visíveis no cabeçalho do card (`findings-panel.tsx:371-382`) | **Quebra se os botões de ação forem para dentro do resumo recolhido** (ficam fora do texto/dados, mas o brief não diz explicitamente onde as ações pousam) |
| **297-324** | Linha 313: `findByRole('button', {name:'Encerrar'})` direto, sem expandir | mesmo | **Quebra** na mesma condição acima |
| **326-353** | Linha 343, mesmo padrão (fluxo de recusa por segregação de funções) | mesmo | **Quebra** na mesma condição |
| **355-378** | Linha 369: `findByRole('button', {name:'Arquivar'})` direto | mesmo | **Quebra** na mesma condição |
| 384-401, 403-424 | Aviso de origem manual / origem por engajamento, texto de prosa completo | `origin`/`auditEngagementId` — campos que o coordenador confirmou disponíveis sem requisição nova | **Médio** — o *dado* está disponível no resumo, mas a frase inteira ("Este achado foi registrado manualmente, sem vínculo a um engajamento.") pode virar um selo mais curto na view recolhida; se o texto exato mudar, os dois testes quebram por texto, não por visibilidade |
| **426-452** | Linha 442: `findByRole('button', {name:'Mover para remediação'})` direto | mesmo padrão do trio Encerrar/Reabrir/Arquivar | **Quebra** na mesma condição |
| 454-469 | Ausência do botão sem `finding:remediate` | Não depende de expansão | Sobrevive |
| 475-498 | Nunca busca ações corretivas no mount, não importa quantos achados | Só confirma ausência de chamada | Sobrevive estruturalmente, mas ver próxima linha |
| **500-555** | Linha 540: `findByRole('button', {name: /1 ação em aberto/})`, com `aria-expanded` próprio; expande e verifica requisição/link | Este é **já** um padrão de disclosure independente (`findings-panel.tsx:163-177, 322-341, 392-400`) — um precedente real dentro do próprio arquivo | **Risco de fusão**: se o "resumo recolhido com expansão sob demanda" pedido pelo coordenador absorver este toggle específico dentro de um `DisclosureGroup` maior por achado (em vez de manter um toggle independente só para ações corretivas), o nome acessível `/1 ação em aberto/` e o `aria-controls` podem mudar de forma — mas a MECÂNICA (expandir sob demanda, buscar só então) já é exatamente o padrão que a área 5 está pedindo, só que hoje aplicado a UMA sub-seção, não ao card inteiro. |

**`FindingLinksSection`** (`finding-links-section.tsx`) já usa `useLoadWhenNearViewport` (linhas 105-136) para adiar a REQUISIÇÃO até estar perto do viewport — mas a SEÇÃO em si (checkboxes, tabela, picker) já está sempre **renderizada** no DOM (`findings-panel.tsx:402-406`, fora de qualquer condicional de expansão). Nenhum teste em `findings-panel.test.tsx` expande/recolhe esta seção especificamente porque ela não tem um toggle hoje — só o requisito de leitura dela. Se ela ganhar um `DisclosureGroup` próprio (conteúdo ausente, não só oculto, quando fechado — `design-system.test.tsx:2193-2202`), qualquer teste futuro que dependa dela precisa expandir primeiro; nenhum teste ATUAL depende dela sem expandir, então não há quebra aqui — é ganho de escopo, não risco de regressão.

---

## 2. E2E afetados

### 2.1 Áreas 2 e 3 (Avaliação, Próxima revisão, Tratamento, Controles)

| Arquivo:linha | Chamada exata | Assume formulário já aberto? |
|---|---|---|
| `risk-assessment.spec.ts:81-97` | Clica células da matriz e preenche "Justificativa" logo após `openRiskDetailSection(page, 'assessment')` (linha 76) | **Sim** — nenhum clique de revelação entre a navegação e a interação com a matriz |
| `risk-assessment.spec.ts:119-134` | Repete o mesmo padrão para a reavaliação | **Sim** |
| `risk-treatment.spec.ts:119-122` | `combobox 'Estratégia'` e `getByLabel('Descrição')` logo após `openRiskDetailSection(page, 'treatment')` (linha 114) | **Sim** |
| `risk-treatment.spec.ts:194-200` | `combobox 'Selecionar controle'` logo após `openRiskDetailSection(page, 'controls')` (linha 187) | **Sim** |
| `risk-treatment.spec.ts:147-163` | Planos de Ação — clica "Adicionar ação" (147) **antes** de preencher qualquer campo | **Não** — já seguindo o padrão `showForm`; referência, não risco |

**`risk-detail-navigation.spec.ts`** — nenhuma ocorrência de preenchimento de campo nestas três seções; só navegação (`openRiskDetailSection`) e verificação de painel visível. **Não afetado.**

**`accessibility.spec.ts`** — o laço `riskDetailLeafScanIds` (linha ~1015, adicionado nesta mesma rodada) roda `openRiskDetailSection` + `runAxe` para `assessment`, `treatment` e `controls` **sem preencher nada** — vai escanear qualquer que seja o estado padrão (recolhido ou aberto) sem quebrar a asserção em si. **Efeito colateral a registrar, não quebra**: antes desta rodada, a varredura cobria a seção com o formulário sempre montado; depois, se o padrão passar a nascer recolhido, a varredura deixa de exercitar a acessibilidade do formulário em si (matriz, combobox de estratégia, picker de controle) a menos que outro teste abra explicitamente esse estado — nenhum teste faz isso hoje para estas três seções.

**`grc-foundation.spec.ts`, `audit-engagement.spec.ts`** — confirmado por leitura: nenhuma das duas specs interage com Avaliação, Próxima revisão, Tratamento ou Controles do risco. Os únicos achados de "Selecionar controle"/"Vincular controle" nestes dois arquivos (`audit-engagement.spec.ts:306,308`) pertencem ao **achado**, não ao risco — `FindingLinksSection`, escopado a `findingCard`, rótulos coincidentes por acaso. **Não afetados por estas duas áreas.**

### 2.2 Área 4 — Causas e Consequências

Busca em todo `apps/web/e2e/*.spec.ts` por `Causa`/`Consequência`/`causesConsequences` (fora de arquivos de Problemas, que têm seu próprio "Causa raiz" não relacionado):

- `risk-detail-navigation.spec.ts:241-242` — abre a seção, confere painel visível. Sem preenchimento. **Não afetado.**
- `accessibility.spec.ts:996, 1157` — mesma seção, dentro do laço de varredura e de um teste de nomes de `tablist`. Sem preenchimento. **Não afetado.**
- `risk-create.spec.ts` — **nenhuma** interação com causas/consequências (o único achado é um comentário de código sobre rótulos hipotéticos, não uma chamada real).
- `grc-foundation.spec.ts` — **nenhuma** interação.

**Achado a registrar**: não existe hoje, em nenhum E2E, um teste que crie, edite ou remova uma causa ou consequência através da interface real. A única cobertura de comportamento é a unitária (`risk-causes-consequences.test.tsx`, §1.4). Consequência prática: **esta área não tem nenhum E2E para quebrar** — o que também significa que não há hoje nenhuma prova de ponta a ponta de que salvar causas/consequências funciona contra o backend real, antes ou depois desta rodada.

### 2.3 Área 5 — Achados

- `grc-foundation.spec.ts:230, 346, 380` — `openRiskDetailSection(page, 'findings')`, seguido em cada caso de interação **direta** com o card do achado (criar via diálogo "Novo achado" — não afetado, é diálogo separado; depois `findingCard.getByRole('button', {name:'Encerrar'})` nas linhas ~344 e ~375, sem passo de expansão). **Quebra se os botões de ação saírem do resumo sempre visível.**
- `audit-engagement.spec.ts:269` (`openRiskDetailSection(page, 'findings')`) seguido de interação direta com `findingCard` (linha ~295, botão "Encerrar", sem expansão) e o vínculo achado↔controle (linhas 299-308, dentro do card, sem expansão). **Mesma condição de quebra.**
- `accessibility.spec.ts` — o teste dedicado "Achados" (linha ~1039, `openRiskDetailSection(page, 'findings')` + espera por `'Aberto'` visível antes de rodar o axe) só verifica presença de status — **sobrevive** se status continuar no resumo recolhido, que é exatamente o que o coordenador confirmou.

---

## 3. Capacidades — lista de conferência ("nada sumiu")

Extrato do inventário original (`docs/reviews/risk-detail-capability-inventory.md`), limitado às seis áreas pedidas mais Achados.

| Ação | Componente:linha | Permissão | Endpoint |
|---|---|---|---|
| Registrar avaliação | `assessment-form.tsx:437-442` | `canAssess = hasPermission('risk:assess')` — hoje condiciona a MONTAGEM do formulário inteiro | `POST /risks/{riskId}/assessments` (`api.ts:171-182`) |
| Agendar/editar próxima revisão | `risk-review-schedule.tsx:127-132` | nenhuma própria (servidor reforça `risk:edit`) | `PATCH /risks/{riskId}` (`api.ts:105-114`) |
| Paginação — Histórico de avaliações | `assessment-history.tsx:184-195` | nenhuma | `GET /risks/{riskId}/assessments?page=N` (`api.ts:153-157`) |
| Adicionar/remover/salvar causa | `risk-causes-consequences.tsx:134/120/168-208` | nenhuma própria (servidor reforça `risk:edit`) | `PUT /risks/{riskId}/causes` (`api.ts:116-127`), coleção inteira, limite 50 |
| Adicionar/remover/salvar consequência | mesmo arquivo | mesma | `PUT /risks/{riskId}/consequences` (`api.ts:129-140`), coleção inteira, limite 50 |
| Registrar decisão de tratamento | `risk-treatment-section.tsx:528-535` (formulário 384-538) | `canTreat = hasPermission('risk:treat')` — condiciona a MONTAGEM do formulário inteiro | `POST /risks/{riskId}/treatments` (`api.ts:219-230`) |
| Paginação — Histórico de tratamento | `risk-treatment-section.tsx:228-243` | nenhuma | `GET /risks/{riskId}/treatments?page=N` (`api.ts:200-209`) |
| Vincular controle | `risk-controls-section.tsx:285-309` | `canTreatControls = hasPermission('risk:treat')` | `POST /risks/{riskId}/controls` (`api.ts:322-333`) |
| Desvincular controle | `risk-controls-section.tsx:242-253` + `ConfirmDialog` | mesma | `DELETE /risks/{riskId}/controls/{linkId}` (`api.ts:336-341`) |
| Criar ação de tratamento | `treatment-actions-table.tsx:711-714`, atrás de `showForm` (590) | `canTreat` | `POST /risks/{riskId}/treatment-actions` (`api.ts:254-265`) |
| Editar/transicionar/reabrir ação | `treatment-actions-table.tsx:544-560` | `canTreat` | `PATCH /risks/{riskId}/treatment-actions/{actionId}` (`api.ts:272-284`) |
| Paginação — Ações de tratamento | `treatment-actions-table.tsx:571-586` | `canTreat` não afeta paginação | `GET /risks/{riskId}/treatment-actions?page=N` (`api.ts:232-251`) |

**Achados** (`findings-panel.tsx`):

| Ação | Componente:linha | Permissão | Endpoint |
|---|---|---|---|
| Criar achado | `findings-panel.tsx:282-287` (diálogo) | `canCreate` (`finding:create`) | `POST /findings` (`findings/api.ts:48-50`) |
| Editar achado | `findings-panel.tsx:362-367` | `canEdit` (`finding:edit`) e `item.status !== 'ARCHIVED'` | `PATCH /findings/{id}` |
| Encerrar achado | `findings-panel.tsx:371-376` | `canClose` (`finding:close`) e status `OPEN`/`IN_REMEDIATION` | `POST /findings/{id}/close` |
| Reabrir achado | `findings-panel.tsx:377-382` | `canClose` e status `CLOSED` | endpoint de reabertura (diálogo próprio) |
| Arquivar achado | `findings-panel.tsx:383-388` + `ConfirmDialog` | `canAdminister` e status `CLOSED` | `archiveFinding` |
| Mover para remediação | `findings-panel.tsx:369`, componente `FindingRemediationAction` | `canRemediate` (`finding:remediate`) e status `OPEN` | `startRemediation` + releitura via `getFinding` |
| Expandir ações corretivas | `findings-panel.tsx:322-341, 392-400` | nenhuma própria | `listActions` (só ao expandir, `finding-corrective-actions.tsx`) |
| Vincular/desvincular controle | `finding-links-section.tsx:523-544` | `canLinkFindings` combinado com `!ARCHIVED` (linha 511-512) | `linkControl`/`unlinkControl` |
| Vincular/desvincular risco | `finding-links-section.tsx:548-569` | mesma | `linkRisk`/`unlinkRisk` |
| Listagem por unidade | `findings-panel.tsx:184-186` (via `orgUnitId`) | nenhuma própria | `GET /findings?orgUnitId=&pageSize=100` (`findings/api.ts:40-42`) — **uma página, até 100 itens, sem paginação própria** |

---

## 4. Riscos específicos desta rodada

### 4.1 `SummaryStatCard` é uma primitiva de Design System com 12+ consumidores, e não tem teste próprio

`packages/design-system/src/components/summary-stat-card.tsx` é usado por `risk-summary-row.tsx` **e também** por `action-register-summary.tsx`, `role-admin-summary.tsx`, `user-admin-summary.tsx`, `asset-register-summary.tsx`, `audit-engagement-register-summary.tsx`, `control-register-summary.tsx`, `incident-register-summary.tsx`, `indicator-single-value-card.tsx`, `problem-register-summary.tsx`, `process-register-summary.tsx`, `report-register-summary.tsx` e `risk-register-summary.tsx` (busca `grep -rl SummaryStatCard`). `design-system.test.tsx` **não tem** nenhum `describe('SummaryStatCard', ...)` — confirmado por busca no arquivo inteiro (2313 linhas, sem uma ocorrência do nome). Se a composição "quatro blocos assimétricos" e a regra "valor ausente nunca em manchete" forem implementadas **dentro da própria primitiva** (não só em como `risk-summary-row.tsx` a usa), o efeito se propaga silenciosamente para as onze outras telas de resumo listadas acima, e nenhum teste unitário — nem o de risco, nem um genérico — pegaria uma regressão ali. Verificar, ao revisar o diff do Agente 1, se a mudança tocou `summary-stat-card.tsx` ou só `risk-summary-row.tsx`.

### 4.2 Ambiguidade de onde mora o `showForm`: componente ou pai

Toda a análise de risco em §1.2/§1.3/§2.1 depende de uma única variável não observável por leitura estática: se o toggle "resultado primeiro, formulário atrás de ação" vive **dentro** de `AssessmentForm`/`RiskTreatmentSection`/`RiskControlsSection` (quebra os testes unitários e E2E hoje escritos contra esses componentes) ou **fora**, num componente pai que decide se monta o filho (não quebra nada hoje — os testes de unidade continuam testando o filho já montado). O padrão de referência (`treatment-actions-table.tsx:590`) resolve isso **dentro** do próprio componente que já possuía lista+formulário juntos — mas `AssessmentForm` e `RiskTreatmentSection`/`RiskControlsSection` não têm hoje essa mesma forma (o "resultado" e o "formulário" já são componentes DIFERENTES nas duas primeiras — `RiskAssessmentSection` vs `AssessmentForm` —, e um componente combinado na terceira). Isto não é uma pergunta que a leitura pura resolve; é o primeiro fato a confirmar contra o diff real do Agente 1.

### 4.3 `RiskControlsSection` é compartilhado entre Resposta (Controles) e Relacionamentos (Processos e Ativos) — mudança pode vazar de escopo

O brief pede a mudança só para "Tratamento e Controles" (área 3). Mas `RiskControlsSection` (`risk-controls-section.tsx`) é a **mesma** função componente para os dois pontos de montagem: `risk-detail-view.tsx` monta-a com `families={['controls']}` em Resposta e com `families={['processes','assets']}` em Relacionamentos. O subcomponente que de fato renderiza cada picker (`RelationshipSubsection`, dentro do mesmo arquivo) não sabe qual família está sendo chamada quando decide se mostra o picker aberto ou atrás de ação — se a mudança for aplicada ao `RelationshipSubsection` genericamente (o caminho mais simples de implementar), ela vaza para "Processos e Ativos" em Relacionamentos, que não estava no escopo pedido e não tem menção no brief. Os testes que provariam esse vazamento: `risk-controls-section.test.tsx:159-178` (processos/ativos, ver §1.3) e `risk-detail-view.test.tsx:258-271` (deep-link para Controles, que já verifica ausência de processos/ativos nessa aba — não testa o INVERSO, ou seja, não protege Processos e Ativos de ganhar o `showForm` sem querer).

### 4.4 Causas e Consequências: o contrato de API é coletivo, a UI está indo para granular — a garantia de não-sobrescrita precisa de teste novo

Já detalhado em §1.4. Resumo do risco: `PUT /risks/{riskId}/causes`/`consequences` sempre substitui a coleção inteira (fato do backend, `risk.controller.ts:231,260`, confirmado pelo coordenador). A UI vai de "todos os itens sempre editáveis, um save manda tudo" para "um item por vez em edição, confirmar manda tudo" — o "manda tudo" não muda, mas a FONTE do "tudo" muda: hoje vem direto do `useFieldArray` (que sempre reflete o estado real de TODOS os campos, editados ou não); na versão nova, precisa vir de um estado que combine "os itens já persistidos, como estão" com "o item que acabou de ser confirmado", sem que um re-render tardio ou uma corrida de estado local perca um item que não estava em edição. Esta é uma superfície de bug genuinamente nova, sem análogo no código ou nos testes de hoje.

### 4.5 Achados: unificar o toggle de "ações corretivas" com o novo resumo recolhido pode trocar nome acessível e `aria-controls` de um teste que já passa

Detalhado em §1.5, linha 500-555. `findings-panel.tsx` já resolve exatamente o padrão "resumo, expande sob demanda, busca só então" — mas só para o bloco de ações corretivas, não para o card inteiro. Se o novo `DisclosureGroup` por achado **envolver** esse toggle já existente (em vez de coexistir com ele como uma sub-região independente), o par toggle/`aria-controls` que o teste da linha 540-543 verifica pode deixar de existir nessa forma exata, mesmo que o comportamento (expandir, buscar, mostrar) continue correto.

### 4.6 Achados: nenhum teste hoje prova as ações em massa/desempenho com uma lista real

Nem `findings-panel.test.tsx` nem os E2E usam mais que 1-2 achados fixture. A melhoria de hierarquia (resumo recolhido) é motivada exatamente por telas com muitos achados — e é onde uma regressão de desempenho (ex.: `FindingLinksSection` sendo montada e observada por `IntersectionObserver` 20 vezes de uma vez, `finding-links-section.tsx:105-136`) apareceria pela primeira vez. Ver §5 para o caminho mais barato de montar esse cenário.

---

## 5. Para a validação depois

### 5.1 Cenário de 10-20 achados — caminho mais barato, sem mecanismo novo

`findingsApi.createFinding` chama `POST /findings` (`findings/api.ts:48-50`), corpo mínimo em `CreateFindingRequest` (`features/findings/types.ts:96-107`): `orgUnitId`, `title`, `description`, `category`, `origin`, `severity`, `priority`, `ownerUserId`, `identifiedOn` — sem `recommendation` (opcional). `listByOrgUnit` já pede `pageSize=100` numa única chamada (`findings/api.ts:41`) — **sem paginação própria no painel**, então 10-20 itens cabem numa carga só, sem complexidade extra de "carregar mais".

O caminho mais barato: um laço de `page.request.post('/api/v1/findings', {...})` (mesma sessão autenticada, mesmo padrão que `grc-foundation.spec.ts`/`audit-engagement.spec.ts` já usam para os passos "hybrid" sem superfície de UI — ex. `grc-foundation.spec.ts:276-284`, `audit-engagement.spec.ts:248-256`) contra o **mesmo `orgUnitId`** de um risco fixture já existente, variando só o `title`. Isso evita clicar 10-20 vezes no diálogo "Novo achado" pela UI (lento, e testa o diálogo, não o painel) e não inventa nenhum mecanismo de dado novo — é o mesmo endpoint que a UI já chama, pela mesma via (`page.request`) que este projeto já usa para montagem de fixture em massa.

### 5.2 Checklist de verificação renderizada, por área

Ao validar depois que o Agente 1 fechar, confirmar contra a lista de capacidades da §3 — nenhuma linha pode ter desaparecido, só mudado de lugar/hierarquia visual.
