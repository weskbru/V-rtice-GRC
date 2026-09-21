# 011 — Dashboard como visão da plataforma: registro operacional

> **Documento histórico — registro de fechamento da fase 011 (Dashboard como visão de
> plataforma).** Não descreve necessariamente o estado atual do produto. Fonte vigente:
> [`docs/STATE.md`](../../docs/STATE.md) e [`docs/modules/dashboard.md`](../../docs/modules/dashboard.md).

Escopo pedido: somente a tela inicial e os elementos globais visíveis nela — identidade visual,
logo no tema escuro, coerência imediata do menu lateral, o Dashboard, sua responsividade e
acessibilidade, e o backend estritamente necessário para ele. **Nenhum outro módulo foi revisado.**

Linha de base: commit `5f99063`. Capturas de antes em `docs/reviews/ui/dashboard-baseline/`,
de depois em `docs/reviews/ui/dashboard-after/` (administrador) e
`docs/reviews/ui/dashboard-after-limited/` (perfil restrito).

---

## §1 — O que a tela real mostrava antes

Medido na aplicação renderizada, nos dois temas, antes de qualquer alteração:

1. **Era um Dashboard de Gestão de Riscos.** Todos os blocos eram de risco; nenhuma outra
   capacidade construída — ações, incidentes, problemas, controles, compliance, auditoria,
   ativos, processos — aparecia na tela inicial. O subtítulo prometia "uma visão única de todas
   as capacidades de GRC".
2. **Três cards com listas internas** de até dez registros cada, com títulos truncados, datas,
   responsáveis e um esmaecimento no fim. O número que o card existia para comunicar era o menor
   elemento útil dentro dele.
3. **Um título "Módulos planejados" sobre uma grade vazia.** O registro de áreas planejadas está
   legitimamente vazio desde que Incidentes e Problemas foram entregues, e nada deixava de
   renderizar o título — a maior região em branco da tela, cerca de 1200 px a 1440 px de largura.
4. **No tema escuro, o símbolo ficava num quadrado branco fixo**, o elemento mais claro da tela.
   O símbolo positivo tem duas tintas fixas (`#17324D` e `#2878C8`); o marinho some sobre fundo
   escuro, e tanto o menu lateral quanto a tela de login contornavam isso com `bg-white`.
5. **Permissão por selo**: um usuário sem `risk:view` recebia os mesmos cards, zerados, com
   "Sem visibilidade" em cada um.

O item do menu lateral citado no pedido — "Planos de Ação" com o marcador "PLANEJADO" — **já não
existia** quando esta frente começou: a entrada falsa foi removida em `3b8c90a`
(`specs/010-action-plan-surface/STATE.md` §3.3). Confirmado na tela renderizada: uma linha, com
link real, sem selo.

---

## §2 — Decisões

### §2.1 Logo: variante invertida como ativo, não filtro CSS

`public/brand/pharos-mark-inverse.svg` contém os mesmos caminhos do símbolo que
`pharos-logo-inverse.svg` já carregava, em branco, na mesma caixa `0 0 100 100` do positivo — é
extração do tratamento invertido aprovado em `docs/brand/pharos-brand.jpg`, não um tratamento
novo. `invert()`/`brightness()` transformariam o marinho em laranja pálido. `BrandMark`
(`components/shell/brand-mark.tsx`) escolhe o arquivo por tema via variante `dark:` do Tailwind,
que lê a mesma classe `.dark` do `next-themes` antes da primeira pintura — ramificar em
`useTheme()` pintaria o símbolo errado por um quadro a cada carga. No escuro o azulejo fica
transparente. A tela de login usava o mesmo recurso e passou a usar o mesmo componente: era o
mesmo defeito, e não uma tela de outro módulo.

### §2.2 O Dashboard não pode morar em `modules/risk` para ver os outros domínios

`GET /dashboard` é servido por `modules/risk`. Estender seu caso de uso para Controles,
Compliance ou Auditoria é bloqueado por guardas de arquitetura existentes
(`controls-risk-module-boundary.spec.ts`, `compliance-controls-risk-module-boundary.spec.ts`,
`audit-engagements-module-boundary.spec.ts`), e `core/**` nunca importa `modules/**` (ADR-011,
com rede de segurança no ESLint). **Nenhuma guarda foi desativada.**

Por isso o resumo entre domínios virou um módulo de negócio próprio, `modules/dashboard`, com
`GET /dashboard/summary`. As áreas de risco continuam em `GET /dashboard`, intocado. São duas
requisições agregadas, em paralelo — nunca uma por módulo, e nenhuma lista de registros baixada
para contar tamanho.

### §2.3 O resumo é o catálogo de indicadores, não uma agregação nova

`GET /dashboard/summary` avalia o catálogo fechado de onze métricas por
`IndicatorCalculationPort` — o calculador único da plataforma (CLAUDE.md §19.7) —, apenas nas
chaves cuja permissão de leitura do domínio de origem o chamador possui. Nenhuma métrica foi
inventada e nenhum cálculo foi duplicado. Uma chave sem permissão **não aparece** na resposta:
nunca é calculada, nunca vem zerada. Escopo resolvido uma vez por requisição. `value` ausente
continua distinto de zero de ponta a ponta.

### §2.4 Permissão por omissão

A tela não renderiza o que o chamador não vê: os cards de risco dependem de `risk:view` (e
aprovações também de `risk:approve`, como o servidor já decide), os demais dependem da presença da
métrica no resumo. Isso é lógica de exibição sobre o que o servidor já filtrou — nada é buscado e
escondido no navegador. Um card compartilhado (Auditoria) mostra só as linhas permitidas. Quem não
vê nada recebe um estado vazio explicado, não uma página em branco.

### §2.5 A única aritmética da tela

A plataforma publica incidentes, problemas e achados abertos **por severidade**, sem total
separado. "Abertos" é a soma dos baldes que chegaram na mesma resposta
(`features/dashboard/summary.ts#bucketTotal`). Nada extra é buscado e a soma não pode discordar
das partes. Todo outro número é exibido exatamente como o servidor enviou.

### §2.6 O que saiu

Os três componentes de lista e seus testes, o gráfico de ações de tratamento (redundante com o
card de atraso e com o card de Riscos) e `DashboardMetricCard`, cujas duas responsabilidades — o
selo "Sem visibilidade" e a linha de KPI dos cards de lista — deixaram de existir. Os testes
removidos cobriam componentes removidos; as garantias que eles protegiam foram reescritas em
`app/(app)/dashboard/page.test.tsx`.

### §2.7 Degradação explícita

Se `GET /dashboard` falha, a tela vai para estado de erro com nova tentativa. Se só
`GET /dashboard/summary` falha, a visão de risco continua e uma linha avisa que o restante pode
estar incompleto — sem isso, um usuário com acesso a incidentes veria uma tela idêntica a "você
não tem acesso a mais nada".

---

## §3 — Composição final

- **Cabeçalho** com subtítulo coerente com a tela e **atalhos** filtrados por permissão
  (registrar risco, incidente, problema; planos de ação), que somem por inteiro quando não há
  nenhum.
- **Requer atenção**: aprovações pendentes, ações atrasadas de qualquer origem, riscos com revisão
  vencida, incidentes críticos abertos. Número, contexto e caminho — sem lista, sem rolagem
  interna. Sinal de atenção por ícone, cor e texto, e só acima de zero.
- **Visão geral**: Riscos, Incidentes, Problemas, Auditoria, Controles, Compliance, Ativos,
  Processos, cada um com as métricas reais que a plataforma já calcula.
- **Distribuição de riscos**: os dois gráficos que continuaram úteis, lado a lado.
- **Módulos planejados**: renderizado só quando o registro tiver alguma entrada.

---

## §4 — Verificação renderizada

Aplicação construída em modo produção, API com o endpoint novo, dados reais:

| Cenário | Resultado observado |
|---|---|
| Administrador, claro, 1440 px | quatro cards de atenção, oito de visão geral, dois gráficos; sem rolagem horizontal |
| Administrador, escuro, 1440 px | símbolo sem azulejo branco; contraste de cards, números, links e gráficos legível |
| Administrador, claro, 1280 px | grade em quatro colunas mantida, sem sobreposição |
| Administrador, escuro, 1024 px | menu recolhido, grade reorganizada em duas colunas, sem cards microscópicos |
| Risk Analyst, claro, 1440 px | dois cards de atenção, quatro de visão geral, dois atalhos; sem aprovações, incidentes, problemas, controles nem compliance; card de Auditoria só com achados; números menores pelo escopo |
| Resumo indisponível (endpoint ausente) | visão de risco intacta e aviso de possível incompletude |

Requisições ao carregar a tela: uma para `GET /dashboard`, uma para `GET /dashboard/summary`.

---

## §5 — Medição

Em série, nunca duas suítes disputando o mesmo banco. Nenhum `skip` acrescentado, nenhuma asserção
enfraquecida, nenhum timeout inflado.

| Suíte | Linha de base (`5f99063`) | Depois |
| --- | --- | --- |
| Unidade da API | 57 arquivos / 569 testes | 58 / 576 |
| Contrato | 56 / 815 | 57 / 821 |
| Integração | 53 / 262 | 54 / 263 |
| Unidade da web | 129 / 725 | 128 / 733 |
| E2E Chromium do Dashboard | — | 4 / 4 (composição por permissão e acessibilidade nos dois temas) |

A unidade da web perdeu arquivos e ganhou testes: saíram cinco arquivos de teste de componentes
removidos (§2.6) e entraram os de `DashboardStatCard`, `DashboardModuleCard`,
`DashboardQuickActions` e `BrandMark`; o teste da página foi reescrito. **Não-vacuidade** do teste
da página: alterar a tela para exibir a soma de `byResidualLevel` como total de riscos e a contagem
de tratamento no lugar das ações atrasadas da plataforma derrubou quatro testes; a tela foi
restaurada e eles voltaram a passar.

Lint, typecheck, `openapi:check` e `format:check` limpos. `contract-coverage.spec.ts` foi de 212
para 213, lido da falha real. Um comentário desse arquivo, no primeiro rascunho, atribuía o passo
211 → 212 a uma mudança que nunca tocou aquele número; foi corrigido para o registro verdadeiro
(a trilha de auditoria por ação, `940c5e3`).

Dois localizadores do E2E erraram contra código correto e foram corrigidos no teste, nunca no
produto: o atalho "Registrar risco" aponta para `/risks/new`, e uma primeira asserção contra
qualquer link começando por `/risks/` o tomou por link de registro individual.

---

## §6 — O que ficou aberto, e por quê

- **Aprovações pendentes não tem caminho.** Nenhuma consulta do registro de riscos reproduz
  "aprovações aguardando esta pessoa", e o mapeador do backend recusa inventar um link quebrado.
  Um filtro assim é decisão de produto sobre o módulo de Riscos, fora deste escopo.
- **`GET /dashboard` continua pertencendo a `modules/risk`.** As áreas de risco não foram movidas:
  mover um endpoint com contrato e testes próprios não era estritamente necessário para a tela, e
  o resumo entre domínios não depende disso.
- **Ativos e Processos mostram uma métrica cada** (inativos), porque é a única que a plataforma
  publica para eles. Mantidos por serem dado real e relevante para higiene de GRC; se não
  agregarem, saem sem afetar mais nada.
- **CI REMOTA: BLOCKED** — faturamento do GitHub Actions, externo ao código.

---

## §7 — Segunda iteração: detalhamento visual a partir de uma referência

Pedido: aproximar a tela de uma imagem de referência — ícones, leve distinção de cor por área,
mais números úteis por módulo — "apenas como inspiração", com toda a tela funcional e sem quebrar
os demais módulos.

### §7.1 O que a referência mostrava e o que foi feito de cada coisa

| Na imagem | Decisão | Por quê |
| --- | --- | --- |
| Ícone colorido por card | **Adotado** | Mesmo ícone da área no menu lateral, sobre uma tonalidade de identidade |
| Seis cards de atenção | **Adotado, com dado real** | Ações atrasadas, vencendo em 7 dias, riscos para revisão, incidentes abertos, problemas pendentes, indicadores fora do limiar, mais aprovações pendentes para quem decide |
| Oito cards de módulo com 3-4 números | **Adotado, com dado real** | Riscos, Planos de Ação, Incidentes, Problemas, Controles, Compliance, Auditoria, Indicadores |
| Controles "Em revisão" | **Rejeitado** | Não existe esse estado de controle (`DRAFT`, `ACTIVE`, `SUSPENDED`, `RETIRED`) |
| Rosca de riscos por status | **Rejeitado** | Oito classes, várias zeradas: fatias ilegíveis; mantida a lista de barras rotuladas |
| Rosca de ações de tratamento | **Adaptado** | Planos de ação por status (quatro classes, todas as origens), com legenda e total |
| "Criar ação" nos atalhos | **Rejeitado** | R-009: ação é criada no contexto de origem, e não existe sem origem |
| Ativos e Processos | **Retirados da visão** | Única métrica publicada é "inativos"; a referência também os deixa de fora |

### §7.2 Backend: `breakdowns` em `GET /dashboard/summary`

O catálogo de indicadores não publica contagens por status, prazo próximo, eficácia de controle,
estado de requisito nem rompimento de limiar. O mesmo endpoint ganhou um objeto `breakdowns` com
esses números, **cada bloco atrás da permissão de leitura do seu domínio** e omitido por inteiro
sem ela, calculado pelo módulo dono do dado através de porta em `shared/grc-ports/`. Eficácia de
controle e estado de requisito reusam os cálculos existentes — o adaptador de conformidade passou
a calcular os estados uma vez e derivar dali tanto o percentual quanto a distribuição. Nenhuma
migração, nenhuma guarda de arquitetura afrouxada. O array `metrics` não mudou.

### §7.3 Cor

- **Tonalidades de identidade** (`--tint-*`, oito matizes, design system): fundo suave + primeiro
  plano forte, gerados em OKLCH com luminosidade e croma fixos por papel, contraste medido do
  ícone contra o próprio fundo de 5,7:1 a 6,3:1 no claro e 8,0:1 a 8,2:1 no escuro. Seguem a
  **área**, nunca a gravidade: uma primeira captura tingiu os cards de atenção por urgência e pôs
  Incidentes em azul no topo e em vermelho logo abaixo — corrigido para uma cor por área.
- **Card de atenção zerado** esmaece o ícone; o número `0` diz o mesmo em texto.
- **Tons de valor** nos cards de módulo usam os tokens de status reservados, e só acima de zero.
- **Rosca de planos de ação**: três matizes categóricos da paleta de referência de visualização,
  validados em **todos os pares** nos dois temas (a rosca omite fatias zeradas, então quaisquer
  duas podem ficar vizinhas), mais cinza para "cancelada". A primeira proposta, com violeta, falhou
  a validação no escuro (azul e violeta indistinguíveis) e foi trocada antes de ser usada.

### §7.4 Verificação renderizada

Capturas em 1440 e 1280 (claro) e 1024 (escuro), mais o perfil de analista em 1440 (sem os cards
de aprovações, incidentes, problemas, controles, compliance e indicadores). Sem rolagem horizontal
em nenhuma. Três defeitos só apareceram na tela, todos corrigidos antes do commit:

- **Legenda da rosca cortada** em 1280 e 1024 ("Ab…", "Em an…"): a troca para lado a lado seguia a
  largura da janela, não a do card. Passou a ser consulta de contêiner (`@container`), e a legenda
  não trunca mais.
- **Rótulo partido no meio da palavra** em 1280 ("andament/o" no card de Incidentes): a grade de
  métricas tinha piso fixo de 3,5rem. Virou `flex-wrap` com piso `min-content`, que só quebra entre
  palavras.
- **Parada de teclado invisível**: o Recharts dá `tabindex="0"` a cada `Pie`, dentro do anel
  `aria-hidden`. A varredura axe do dashboard acusou `aria-hidden-focus`; as fatias receberam
  `rootTabIndex={-1}` (a legenda e a tabela acessível já carregam todos os valores). A varredura
  não foi alterada.

### §7.5 Medição

Em série, nesta ordem, sem suítes de banco concorrentes:

- API unidade 64 arquivos / 602 testes; integração 55 / 266; contrato 57 / 824 — nenhum teste
  removido. Lint, typecheck e `openapi:check` limpos.
- Web unidade 131 / 746; lint e typecheck limpos.
- E2E Chromium, um worker: `dashboard.spec.ts` 2/2 e varreduras axe do dashboard claro/escuro 2/2.
- **CI REMOTA: BLOCKED** — faturamento do GitHub Actions.

Dois defeitos da própria suíte nova, encontrados pela execução completa e corrigidos na causa:

- O código de framework do teste de integração (`dbs-fw-` + UUID) tinha exatamente 43 caracteres
  do alfabeto base64url, e a varredura de divulgação de informação o classificou — corretamente,
  pelo padrão — como token de sessão. O prefixo mudou; a varredura não.
- O mesmo teste deixava um requisito sem controle numa versão PUBLICADA. Conformidade é da
  organização inteira, então o percentual caía para todo arquivo seguinte, e
  `indicator-current-value-organizational-scope` (que exige exatamente 100%) falhava só na
  execução completa. O teste agora remove requisito, versão e framework ao terminar.

### §7.6 Correção do §6

O §6 diz que Ativos e Processos foram mantidos com uma métrica cada. Na segunda iteração eles
**saíram** da visão dos módulos (§7.1): continuam no menu lateral, e "inativos" sozinho não
sustentava um card ao lado de áreas com três números.
