# 016 — Experiência de detalhe de Risco

**Estado**: composição fechada em 2026-09-15. Riscos é o **piloto**; nenhum outro módulo migra
nesta rodada.

**Base**: `main` em `d42ba79`, árvore limpa.

---

## 1. Problema medido

`apps/web/src/app/(app)/risks/[id]/risk-detail-view.tsx` (472 linhas) monta hoje:
`EntityHeader` + `RiskLifecycleActions` (um `Card` solto) + `EntityTabs` com **14 abas**. Em
1440 px a faixa já é cortada e depende dos chevrons de rolagem; em 390 px a maior parte da
navegação está fora da tela. Consultar um risco é ler um formulário; não existe superfície que
responda, de relance, em que etapa o risco está, o que o bloqueia, ou o que existe ligado a ele.

Não há breadcrumb nem "Voltar" — Compliance, Ativos e Processos já têm. É inconsistência, não
ausência de padrão.

## 2. Restrições apuradas no código (Etapa 0)

Estas restringem o desenho e **não** são negociáveis por estética.

| # | Fato | Consequência |
|---|---|---|
| R-1 | O ciclo de vida real tem 8 estados num grafo com bifurcação e retorno (`apps/api/src/modules/risk/domain/risk-lifecycle.ts`): `DRAFT, IDENTIFIED, ASSESSED, UNDER_TREATMENT, UNDER_REVIEW, ACCEPTED, CLOSED, ARCHIVED`; `UNDER_REVIEW` volta para `ASSESSED`; `ACCEPTED` e `CLOSED` são alcançáveis de três estados | A esteira linear de cinco passos do mockup não existe. Nem os rótulos dela |
| R-2 | `GET /risks/{id}/lifecycle` devolve só estado atual, aprovação pendente e transições disponíveis | "Estados anteriores" não é informação do servidor |
| R-3 | Todo risco nasce em `DRAFT` (`schema.prisma:1032`) e só sai pela tabela de transições | Um prefixo de estados **provadamente** percorridos é derivável sem requisição extra |
| R-4 | Não existem no modelo: contexto, objetivos afetados, localização | O bloco "Contexto" do mockup é descartado. O equivalente real é Causas e Consequências |
| R-5 | `FindingsPanel` recebe `orgUnitId`, não `riskId` | Achados na tela de risco são **da unidade organizacional**. Contá-los como "achados deste risco" seria falso |
| R-6 | A aba "Controles" também renderiza Processos e Ativos (`risk-controls-section.tsx:375,391`) | Dois relacionamentos reais escondidos atrás de um rótulo que não os nomeia |
| R-7 | `GET /risks/{id}` já traz `controls`, `processes`, `assets`, `treatmentActionSummary`, `overdueReview`, `overdueTreatment`, `pendingApproval`, `updatedAt` | Contadores e indicadores executivos saem de graça |
| R-8 | Incidentes, Problemas e Evidências exigem uma requisição cada | Contá-los no mount custa três requisições |
| R-9 | **F-59 aberto**: o `ThrottlerGuard` global devolve 429 sob concorrência; F-61 foi a manifestação disso nesta mesma tela | Encher o mount de requisições paralelas é o defeito conhecido desta casa |
| R-10 | 99 chamadas `getByRole('tab', …)` nos E2E, mais o teste unitário que prova a omissão da aba Auditoria sem `audit:view` (FR-030) | A semântica ARIA de tablist é preservada; os testes é que se adaptam à navegação de dois níveis |
| R-11 | `EntityTabs` é não-controlado (só `defaultValue`) | Precisa de modo controlado para que a coluna lateral navegue entre seções |
| R-12 | Não existe layout de duas colunas em nenhuma tela do produto | O shell de duas colunas é estrutura nova |

## 3. Decisões aprovadas pelo usuário

1. **Navegação em dois níveis**: 5 grupos + sub-navegação, `role="tab"` nos dois níveis.
2. **Ciclo de vida**: espinha linear + ramos declarados, sobre os estados reais.
3. **Contadores**: só o que já vem no payload; o caro carrega sob demanda; Achados fora dos
   contadores.
4. **Leitura × edição**: um "Editar" que abre o `RiskForm` existente em painel lateral; a página
   de consulta nunca vira formulário.

## 4. Composição fechada

### 4.1 Estrutura da página

```
EntityHeader            (largura total — breadcrumb, código, badges, título, metadados, ações)
Faixa de resumo         (largura total — cinco SummaryStatCard)
+-------------------------------------------+------------------+
| Navegação nível 1 (cinco grupos)          | Coluna contextual|
| Navegação nível 2 (seções do grupo)       |  - Atenção       |
|                                           |  - Ações rápidas |
| Conteúdo da seção                         |  - Relacionamentos|
|                                           |  - Última atualiz.|
+-------------------------------------------+------------------+
```

Grade: uma coluna abaixo de `xl`; `xl` e acima, `minmax(0,1fr)` mais `320px`, com a coluna lateral
`sticky`. Abaixo de `xl` a coluna contextual reflui **acima** do conteúdo da seção (pendência e
ações rápidas são o que o usuário precisa primeiro num aparelho estreito) e seus blocos viram
`DisclosureGroup` fechados, exceto Atenção.

### 4.2 Cabeçalho

- **Breadcrumb**: `Riscos › RSK-2026-0001`, ligando a `/risks` — no slot `breadcrumb` que
  `EntityHeader` já tem e que esta tela nunca usou.
- **Código e badges**: código monoespaçado, `StatusBadge` do status, `PendingApprovalBadge`,
  `RiskLevelBadge` inerente e residual em `emphasis="subtle"` (ADR-006: nível nunca sem a base).
- **Título**: `<h1>`, inalterado.
- **Metadados**: gestor, responsável, unidade, identificado em, próxima revisão — como hoje.
- **Ações**: `Editar` (primária, `risk:edit`) e `Mais ações` (menu) quando houver secundárias.
  Nenhuma ação nova é criada aqui.

### 4.3 Resumo executivo — cinco `SummaryStatCard`

| Card | Valor | Apoio | Tom |
|---|---|---|---|
| Nível inerente | rótulo do nível, ou "Não avaliado" | "Antes dos controles" | pelo nível; neutro quando ausente |
| Nível residual | rótulo do nível, ou "Não avaliado" | "Após os controles" | idem |
| Tratamento | estratégia vigente, ou "Não definido" | prazo, ou "Prazo vencido" | `warning` quando `deadlineOverdue` |
| Planos de ação | `treatmentActionSummary.total`, ou "Não possui" | "N abertos · M em atraso" | `danger` quando `overdue > 0` |
| Revisão | `nextReviewOn`, ou "Não agendada" | "Próxima revisão" / "Em atraso" | `danger` quando `overdueReview` |

**Desvio deliberado do mockup**: o quinto card do mockup é "Itens relacionados: N". Esse número
custaria três requisições (R-8) num mount que F-59 já derruba (R-9), e os relacionamentos já têm
lugar próprio na coluna lateral. "Revisão" é gratuito, responde uma pergunta de gestão real
("está vencido?") e usa dado que a tela já carrega.

O tom é acento moderado — `SummaryStatCard` tinge o ícone e uma borda fina, nunca a superfície —
e o rótulo sempre diz o que o número é, independentemente de cor (§18.8).

### 4.4 Navegação

Cinco grupos, quinze seções-folha:

| Grupo | Seções |
|---|---|
| **Visão geral** | *(sem sub-nível)* Descrição · Detalhes do risco · Ciclo de vida |
| **Análise** | Avaliação · Causas e Consequências |
| **Resposta** | Tratamento · Controles · Planos de Ação |
| **Relacionamentos** | Incidentes · Problemas · Processos e Ativos · Evidências · Achados |
| **Registro** | Histórico · Auditoria · Anexos · Comentários |

- Processos e Ativos saem de dentro de "Controles" (R-6) e passam a ter rótulo próprio em
  Relacionamentos. Mesmos endpoints, mesmas permissões: `risk:edit` para processo e ativo,
  `risk:treat` para controle. É mudança de apresentação, não de regra.
- O nível 2 tem no máximo cinco itens.

  > **Correção medida (2026-09-15)**: este item afirmava que "cinco itens de nível 1 cabem sem
  > rolagem em 390 px". **Falso**, medido na tela renderizada: em 390 px a faixa mostra "Visão
  > geral · Análise · Resposta" e corta o resto atrás do chevron de rolagem. Como eliminar a
  > rolagem horizontal de navegação é objetivo declarado desta rodada, o nível 1 precisa caber de
  > verdade em 390 px — por tipografia menor, rótulo mais curto, ou outro tratamento — e isso é
  > critério de aceitação, não preferência.
- Visibilidade continua por **omissão**, nunca por desabilitação: Auditoria sem `audit:view`,
  Evidências sem `evidence:view`, Achados sem `finding:view`. Um grupo cujas seções sumiram todas
  não aparece.
- `role="tab"` nos dois níveis; conteúdo montado só quando selecionado (comportamento atual do
  Radix, que é o que mantém o mount barato).
- **Deep link**: `?section=<id>` com os identificadores técnicos já existentes (`overview`,
  `assessment`, `controls`, …), roteamento raso. Não existia antes; é aditivo, e é o que faz a
  coluna lateral navegar entre seções e o endereço ser compartilhável.

  > **Correção medida (2026-09-16)**: este item dizia também que o deep link faria "o botão
  > 'voltar' do navegador funcionar" no sentido de percorrer as seções visitadas. Estava errado, e
  > o erro era meu, não da implementação. A casa já decidiu esta mesma questão, com justificativa
  > escrita, em `apps/web/src/lib/register/url-state.ts`: `replace`, nunca `push`, "para que o
  > botão Voltar a partir do detalhe de um registro caia no registro exatamente como foi deixado,
  > em vez de desfazer uma trilha de estados". Empilhar uma entrada de histórico por seção
  > prenderia o usuário: quem visitasse seis seções precisaria de sete "voltar" para sair da tela.
  > `use-risk-detail-section.ts` segue a convenção existente (§18.12 — módulo não inventa
  > convenção própria), e a garantia que vale a pena proteger com teste é a oposta: **"voltar"
  > sai da tela de risco e devolve o usuário de onde ele veio, independentemente de quantas
  > seções ele abriu.**

### 4.5 Visão geral

Três blocos, sem card dentro de card:

1. **Descrição** — texto corrido, tamanho de corpo.
2. **Detalhes do risco** — categoria, tipo, origem, unidade, gestor, responsável, identificado em,
   última avaliação, próxima revisão. `ReadOnlyField`, em grade de rótulo e valor; classificação
   em `muted` (metadado de filtro), responsabilidade em peso normal.
3. **Ciclo de vida** — §4.6.

Os cards de nível inerente e residual saem daqui: subiram para o resumo executivo. Nada é perdido.

**O bloco "Contexto" do mockup não é implementado** (R-4).

### 4.6 Ciclo de vida

Espinha de seis posições sobre os estados reais:

```
Rascunho -> Identificado -> Avaliado -> Em tratamento -> Encerrado -> Arquivado
                                    |-- Em revisão (retorna a Avaliado)
                                    |-- Aceito (segue para Encerrado)
```

Marcação de cada posição:

- **atual** — `lifecycle.status`;
- **percorrido** — apenas estados **provadamente** atravessados, pelo prefixo necessário derivado
  de R-3: `DRAFT`, depois `IDENTIFIED`, depois `ASSESSED` para todo estado adiante deles, mais
  `CLOSED` no caso de `ARCHIVED`. `UNDER_TREATMENT`, `UNDER_REVIEW` e `ACCEPTED` **nunca** são
  marcados como percorridos, porque existem caminhos legais que os pulam. Zero requisição extra,
  zero afirmação falsa;
- **disponível** — há entrada correspondente em `availableTransitions` com
  `preconditionsMet: true`;
- **bloqueado** — entrada em `availableTransitions` com `preconditionsMet: false`; as
  `unmetPreconditions` (já redigidas pelo servidor, FR-081) aparecem como orientação ao usuário,
  não como erro de sistema;
- **indisponível** — nenhuma das anteriores.

As transições continuam vindo **inteiras** do servidor. Nenhuma tabela de transição, nenhuma
verificação de permissão e nenhuma pré-condição são reimplementadas no cliente (ADR-006). Os três
diálogos existentes (`TransitionConfirmDialog`, `RequestApprovalDialog`, `ApprovalDecisionDialog`)
e a regra de autoaprovação (FR-029a) são preservados **sem alteração de comportamento**.

Aprovação pendente continua tendo bloco próprio, com solicitante, data, transição pedida,
justificativa e — para quem pode decidir e não é o solicitante — Aprovar e Rejeitar.

### 4.7 Coluna contextual

Quatro blocos, todos alimentados por dados que a página **já carregou**:

1. **Atenção** — pendências reais: `unmetPreconditions` das transições bloqueadas, aprovação
   pendente, `overdueReview`, `overdueTreatment`. Some inteiro quando não há nada — nunca um
   painel vazio dizendo "tudo certo".
2. **Ações rápidas** — **atalhos de navegação para as superfícies de ação que já existem**, cada
   um com a permissão que já governa aquela ação: Registrar avaliação (`risk:assess`), Registrar
   decisão de tratamento (`risk:treat`), Criar plano de ação (`risk:treat`), Vincular controle
   (`risk:treat`), Adicionar evidência (`evidence:create`), Comentar (`comment:create`).

   > **Correção datada (2026-09-15)**: uma versão anterior deste parágrafo condicionava "Criar
   > plano de ação" à existência de tratamento vigente. O inventário mediu o contrário em
   > `treatment-actions-table.tsx:288-300,590`: a criação é gated **apenas** por `risk:treat`, e
   > `currentTreatmentId` é associação opcional que pode ir `null`. Introduzir aquela condição
   > seria estreitar uma capacidade existente sob disfarce de reorganização visual — proibido por
   > §18.9. O atalho segue exatamente a permissão, e nada além dela.

   **Desvio deliberado do mockup**: "Registrar incidente" e
   "Registrar problema" não entram — o lado do Risco é somente-leitura para esses vínculos
   (`risk-incident-problem-links-section.tsx`), e um atalho que não consegue criar o vínculo seria
   promessa falsa.
3. **Relacionamentos** — Planos de ação, Controles, Processos e Ativos com número imediato (R-7);
   Incidentes, Problemas e Evidências como caminho sem número, que só carrega quando a seção é
   aberta (R-8, R-9). Achados aparece rotulado como **da unidade organizacional**, fora dos
   contadores (R-5). A entrada da seção aberta fica visivelmente marcada.
4. **Última atualização** — `risk.updatedAt` formatado. Sem autor: `RiskDetail` não carrega
   `updatedBy`, e buscá-lo no histórico custaria uma requisição no mount. "O que aconteceu
   recentemente" continua respondido por Registro › Histórico, que é onde a trilha real vive.

### 4.8 Leitura × edição

`Editar` abre o `RiskForm` existente (`mode="edit"`, 870 linhas, intocado) dentro do `Sheet` da
aplicação, compondo `DetailPanel mode="overlay"` — o mesmo casamento que `role-admin-view` já usa.
A página atrás permanece em modo de leitura. Salvar fecha o painel e atualiza risco e ETag pelo
mesmo `onSaved` de hoje. Conflito 409 e validação continuam sendo do formulário.

Edição por bloco (como no mockup) **não** é implementada: exigiria fatiar o `RiskForm` em três
formulários parciais, cada um com sua validação, seu ETag e seu 409 — superfície de regressão
desproporcional ao ganho visual.

### 4.9 Requisições no mount — restrição rígida

A tela nova dispara **exatamente as mesmas duas requisições que dispara hoje**:
`GET /risks/{id}` e `GET /risks/{id}/lifecycle`. Nenhuma requisição adicional no carregamento, em
nenhuma hipótese (R-9). Qualquer contador ou texto que exija uma terceira requisição é substituído
por um caminho sem número.

As duas requisições ficam **no nível da página**, nunca dentro do conteúdo de uma seção. Hoje
`RiskLifecycleActions` busca `GET /risks/{id}/lifecycle` fora do sistema de abas, sempre no mount;
a coluna contextual (Atenção) e a esteira de ciclo de vida dependem desse mesmo estado. Se a busca
descer para dentro da seção "Visão geral", as pendências somem da coluna lateral até alguém abrir
aquela seção — regressão silenciosa de comportamento, não mudança de layout.

## 5. Abstrações

Criadas no Design System — estrutura genuinamente compartilhada, sem vocabulário de domínio:

- **`DetailLayout`** (`packages/design-system/src/components/detail-layout.tsx`) — casca de slots
  (`header`, `summary`, `navigation`, `children`, `aside`) com o contrato responsivo de duas
  colunas. É o contrato que não pode divergir entre módulos quando a família de Detail Pages
  existir. Sem strings, sem domínio.
- **`EntityTabs` em modo controlado** — `value` e `onValueChange` opcionais, retrocompatíveis com
  todo chamador atual.

Ficam em `apps/web/src/features/risks/components/detail/` — Riscos é o piloto e a promoção é a
etapa 2, depois da aprovação visual: a faixa de resumo, a esteira de ciclo de vida, a coluna
contextual e o modelo de grupos e seções. Devem nascer com forma de prop limpa e sem acoplamento a
Risco além do necessário, para que a promoção seja mecânica.

**Nada no Design System recebe nome de domínio** (`RiskAlgumaCoisa`).

### 5.1 Débito registrado para a etapa 2

`risk-detail-view.tsx` monta o array de grupos **inline**, misturando o conteúdo JSX de cada seção
com a estrutura que decide o agrupamento. `risk-navigation.ts` exporta os tipos e as funções que
operam sobre esse array, mas **não** a tabela "grupo X contém as folhas [Y, Z]" — ela não existe
como dado importável.

Consequência medida: `apps/web/e2e/support/risk-detail-sections.ts` precisou **restatar** essa
tabela, com 15 entradas, e o próprio arquivo documenta que nenhum erro de compilação pega uma
divergência entre as duas — só um E2E vermelho. É uma guarda real, não silenciosa, e por isso não
foi refatorado no fim desta rodada; mas é exatamente a mesma forma de duplicação que deixou duas
grafias de "Causas e Consequências" coexistirem entre a suíte e o catálogo antes desta fase.

Quando o padrão de Detail Page for generalizado para os outros módulos (etapa 2), a estrutura —
ids, rótulos e visibilidade — deve sair para dado puro, separada da renderização, e o helper de
E2E deve importá-la em vez de copiá-la. Fazer isso agora, no piloto, seria refatorar uma tela que
acabou de estabilizar; fazer isso na etapa 2 é o momento em que a estrutura precisa ser
compartilhada de qualquer forma.

## 6. Preservação

Nenhuma capacidade existente pode sumir. O inventário medido antes da implementação vive em
`docs/reviews/risk-detail-capability-inventory.md` e é a lista de conferência do fechamento.

Intocados por esta rodada: modelo de dados, contratos de API, autorização, escopo organizacional,
auditoria, máquina de estados, semântica de aprovação e segregação entre solicitante e aprovador
(§18.9).

## 7. Aceitação

- Todas as quinze seções alcançáveis; nenhuma ação perdida, medida contra o inventário.
- RBAC preservado: seção sem permissão é omitida, nunca desabilitada.
- Duas requisições no mount, verificadas no navegador.
- Sem rolagem horizontal da página em 1920, 1440, 1280, 1024, 768 e 390 px, tema claro e escuro.
- axe sem violação nos dois temas, nas cinco áreas de navegação.
- Teclado: navegação nos dois níveis, foco visível, retorno de foco ao fechar painel e diálogos.
- Testes unitários e E2E atualizados e verdes; portões do repositório limpos.
- Capturas renderizadas produzidas por `apps/web/scripts/ui-capture.mjs`, em
  `docs/reviews/ui/016-risk-detail/`.
