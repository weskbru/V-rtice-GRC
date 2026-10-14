# 014 — Indicador de carregamento institucional: registro operacional

> **Documento histórico — registro de fechamento da fase 014 (loader institucional de
> navegação).** Não descreve necessariamente o estado atual do produto. Fonte vigente:
> [`docs/STATE.md`](../../docs/STATE.md) e [`docs/architecture/frontend.md`](../../docs/architecture/frontend.md) (§3,
> Navegação).

Escopo pedido: um indicador de carregamento animado baseado na identidade visual oficial do produto
(`docs/brand/vertice-brand.jpg`) — **somente** o símbolo do farol e os três arcos de sinal, sem
wordmark —, entregue como componente compartilhado do Design System e ligado às transições de página
e às operações genuinamente pendentes, não a cada clique. **Nenhuma tela foi redesenhada**, o módulo
de Riscos não foi tocado visualmente, e nada em navegação, App Shell ou Design System foi refatorado
além do que o loader exige.

Linha de base: commit `01c0db1` (fechamento de `specs/013-stabilization-audit`), árvore limpa.
Capturas renderizadas em `docs/reviews/ui/loader/` — 1440×900 e 390×844, claro e escuro, dois
quadros da sequência em cada combinação, mais a variante `inline` no diálogo de execução de
relatório.

---

## §1 — O que já existia (investigado antes de escrever qualquer código)

1. **Nenhum indicador de marca.** Os indicadores de espera do produto eram três: `LoadingState`
   (esqueletos de tabela/cartão/formulário, o mais usado), `Loader2` do Lucide girando dentro de
   botões e de alguns painéis, e `Suspense` com `LoadingState` como fallback nas rotas de registro.
   Nenhum deles carrega identidade visual.
2. **O símbolo já existia em vetor**: `apps/web/public/brand/vertice-mark.svg` (e o inverso
   `vertice-mark-inverse.svg`), usados por `BrandMark` no shell. Nada precisava ser desenhado do
   zero nem extraído do JPG da marca — o loader reusa a geometria **verbatim**.
3. **Nenhuma infraestrutura de navegação pendente.** Não havia `loading.tsx` em rota alguma, nenhum
   `useTransition` no shell, nenhum interceptador de cliques. Next 15.5 está no repositório, ou
   seja, `useLinkStatus` (Next 15.3+) está disponível.

---

## §2 — Decisões

### §2.1 O sinal de "navegação pendente" é o do próprio roteador

Dois sinais, ambos do roteador, agregados num overlay só:

1. **`useLinkStatus()`**, lido de dentro do `<Link>` que iniciou a navegação. É o roteador que diz
   quando ela começou e quando terminou — no commit da rota, quando uma navegação mais nova a
   substitui, e quando ela falha.
2. **`useTransition()` em volta de `router.push`**, pertencente ao provider e entregue como
   `useNavigate()`. Cobre a navegação que o **produto** faz por conta própria, em que nenhum link
   está envolvido. A transição vive no provider, que nunca desmonta, então a tela que disparou a
   navegação pode ser substituída sem que o sinal se perca.

Nenhum ouvinte global de clique, nenhum patch de `history`, nenhum estado de rota mantido em
paralelo: as três coisas que o pedido proíbe são exatamente as que essa escolha torna
desnecessárias.

`LinkPendingSignal` é um componente que não renderiza nada e apenas reporta o `pending` do link em
que está montado. Três contextos separados (relator estável, função `navigate` estável, e o booleano)
para que uma mudança de estado re-renderize o overlay e **não** todos os links da tela.

### §2.1.1 Por que **não** `loading.tsx` — medido, não suposto

O pedido pede para avaliar seriamente o mecanismo nativo por segmento. Ele foi avaliado com um
`app/(app)/loading.tsx` temporário e um instrumento que registra, com carimbo de tempo, cada
aparecimento do fallback e do overlay — primeiro no servidor de desenvolvimento, depois no **build de
produção** deste próprio produto (onde há prefetch e o comportamento muda). Resultado em produção:

| Cenário | `loading.tsx` | Overlay institucional |
|---|---|---|
| Navegação rápida (sidebar → Controles) | aparece em 67 ms, some em 99 ms — **flash de 32 ms** | não aparece (correto) |
| Navegação lenta (payload atrasado 1,2 s) | aparece em 75 ms, sai em 1332 ms; `<main>` medido contendo **o texto do fallback** | **nunca apareceu** |
| Link de cartão do Dashboard | aparece (cobre a origem) | não aparecia (era a lacuna) |
| Voltar/avançar do navegador | não aparece | não aparece |

Três conclusões, todas medidas:

1. **Ele pisca.** 32 ms de fallback numa navegação rápida é exatamente o defeito que o atraso de
   200 ms existe para evitar, e `loading.tsx` não tem atraso próprio. Dar-lhe um atraso não resolve:
   o conteúdo anterior já foi desmontado, então a tela ficaria **em branco** durante a espera.
2. **Ele apaga a tela anterior.** O fallback substitui o conteúdo da rota; o `<main>` medido durante
   a navegação lenta continha o texto do fallback, não a tela de onde o usuário saiu. O
   comportamento aprovado é o oposto.
3. **Ele não conviveria com o loader — ele o substituiria.** Como a fronteira de loading confirma a
   navegação imediatamente, `useLinkStatus` volta a `false` na hora e o overlay institucional
   **nunca apareceu** nas medições com `loading.tsx` presente. Não haveria dois loaders simultâneos;
   haveria o loader aprovado desaparecendo em silêncio.

Por isso a cobertura foi resolvida na abstração de navegação (§2.1.2), e não por rota. O
`loading.tsx` de sonda foi removido; nenhum arquivo `loading.tsx` existe no repositório.

### §2.1.2 A cobertura é propriedade do `<Link>` do produto, garantida por lint

O sinal precisa ser lido de dentro do link que iniciou a navegação — não existe, na versão instalada,
nenhum hook que diga "há uma navegação em voo" globalmente. Colocar `LinkPendingSignal` à mão em
dezenas de componentes seria uma convenção que alguém esquece. A abstração correta é uma só:

- **`@/components/navigation/link`** — `next/link` mais o sinal. Mesmas props, mesmo `<a>` real
  (clique do meio, "abrir em nova aba" e "copiar link" continuam funcionando), mesmo comportamento
  sob `asChild`. Os **59 arquivos** que importavam `next/link` passaram a importar este; o JSX não
  mudou em nenhum deles, só a linha de import.
- **`useNavigate()`** — no lugar de `useRouter().push/replace/back/refresh`, para a navegação que o
  produto faz sozinho. Fora do shell (a tela de login) degrada para um `router.push` simples.
- **`no-restricted-imports`** em `eslint.config.mjs` proíbe `next/link` e `useRouter` fora dessas
  duas portas. É isso que faz uma tela nova nascer coberta sem ninguém pensar no assunto — a
  cobertura deixa de ser convenção e passa a ser erro de lint.

O `<Link>` do produto lê **apenas o contexto** (`useOptionalNavigate`), nunca `useRouter`: fazê-lo
depender do roteador obrigaria um mock de rota em todo teste que renderize qualquer coisa com um
link — medido, 119 falhas em 18 arquivos. Sem shell em volta, o link se comporta como um `next/link`
comum.

**Atualização de filtros não é navegação.** Os dez hooks de estado de catálogo continuam usando
`router.replace(pathname?query)` com `eslint-disable` explicando por quê: escrever a query string da
tela atual não é trocar de tela, e levantar um loader de página sobre uma mudança de filtro seria
errado.

### §2.2 Atraso de 200 ms e duração mínima de 400 ms

`useDelayedVisibility` (`packages/design-system/src/lib/use-delayed-visibility.ts`). O pedido deixou
a escolha entre 150 e 250 ms como decisão técnica: **200 ms**, o meio da faixa e o limiar em que uma
resposta deixa de ser percebida como imediata — abaixo dele, um indicador é ruído. Uma vez visível,
fica no mínimo 400 ms, para que um resultado que chega logo depois do atraso não produza uma piscada
de um quadro. Uma nova operação durante essa janela mantém o indicador de pé em vez de reiniciar o
atraso.

O hook é genérico e vive no Design System: ele serve qualquer espera, não só navegação.

### §2.3 O overlay cobre a área principal, sem apagá-la

`NavigationPendingOverlay` é `absolute inset-0` dentro do invólucro posicionado que o `AppShell`
passou a ter em volta do `<main>` — nunca sobre o cabeçalho nem sobre a barra lateral. Isso é
deliberado: a barra lateral continua utilizável, então uma segunda navegação sempre pode substituir
a primeira (cenário validado em §4). O véu é `bg-background/70`: a tela anterior continua legível
por baixo, que é o que o pedido chama de "sem apagar a UI anterior".

**Correção vinda da revisão renderizada**: com o véu sozinho, a 390 px o símbolo caía exatamente em
cima do título de um cartão (primeira rodada de capturas). O loader passou a se apoiar numa
superfície plana única (`rounded-lg border bg-card shadow-sm`) — não decoração, e sim o que torna o
indicador legível sobre conteúdo arbitrário sem escurecer a tela inteira.

### §2.4 A animação é a sequência da marca, e só ela

Três `@keyframes` em `packages/design-system/src/styles/globals.css`, um por arco, deslocados no
tempo: o farol aparece e permanece aceso; arco 1 (o menor) acende, depois o 2, depois o 3 (o maior);
todos seguram; apagam juntos; pausa; recomeça. Ciclo de 2 s. **Não há rotação, salto, zoom, brilho
nem pulsação** — a única propriedade animada é `opacity`, e o farol nunca sai da tela.

Cores por token: `--brand-mark-ink` e `--brand-mark-signal`, definidos no tema claro com as duas
tintas do símbolo positivo e no escuro com o branco do símbolo invertido — exatamente o que os dois
arquivos SVG da marca já faziam.

### §2.5 Duas variantes, e onde cada uma entra

- `page` — símbolo de 56 px com o rótulo abaixo, para transições de rota e esperas de tela inteira.
- `inline` — símbolo de 32 px ao lado do rótulo, para um painel, diálogo ou seção.

O SVG é `aria-hidden`; o contêiner é um único `role="status"` cujo texto é o rótulo, lido **uma vez**
quando o indicador aparece — a animação não reanuncia nada. `hideLabel` mantém o texto disponível
para leitor de tela.

### §2.6 O que **não** foi trocado

- **Todos os `LoadingState`/esqueletos continuam onde estavam.** Eles comunicam a forma do conteúdo
  que vem, que é mais informativo que um símbolo; o pedido pede explicitamente para não substituí-los.
- **Todos os `Loader2` dentro de botões continuam.** A 16 px a marca é ilegível; o spinner do botão é
  a affordance certa ali, e o cabeçalho do componente registra isso.
- Um único ponto migrou para a variante `inline`: o diálogo de execução de relatório
  (`report-run-dialog.tsx`), que exibia um `Loader2` grande e centralizado numa espera genuinamente
  longa e sem forma conhecida — o caso exato para o qual a variante existe. Ele também passou a usar
  `useDelayedVisibility`, então um relatório rápido abre direto no resultado.

---

## §3 — Cobertura: o que entra, o que fica fora e por quê

### §3.1 O que passou a ser coberto

Toda navegação real entre telas que fique pendente tempo suficiente, independentemente de onde o
usuário a iniciou:

| Origem | Coberta por | Provada por |
|---|---|---|
| Barra lateral | `<Link>` do produto | E2E "a slow navigation…" |
| Cartões do Dashboard | `<Link>` do produto | E2E "a Dashboard card link…" |
| Linhas de tabela / listas / cartões de registro | `<Link>` do produto | E2E "a register row opening a detail screen…" |
| Detalhe → outra tela | `<Link>` do produto | mesmo E2E, segunda metade |
| Botões que são links (`Button asChild`) | `<Link>` do produto | mesmo mecanismo, mesmo componente |
| Menu da conta e painel de notificações | `useNavigate()` via `insideDismissingOverlay` | E2E "a link inside the account menu…" |
| Navegação programática do produto (após criar um registro, sair, sessão expirada) | `useNavigate()` | E2E "navigation the product performs itself…" |

O menu da conta merece o detalhe que o pedido pediu. `DropdownMenu`/`Popover` do Radix **desmontam o
conteúdo ao selecionar**, e `useLinkStatus` só existe dentro do link que iniciou a navegação: o
componente que reportaria deixa de existir no mesmo instante em que a navegação começa. Medido
diretamente, com o payload de `/profile` atrasado em 2 s: **overlay visto = false**, com a navegação
comprovadamente pendente. A saída não foi transformar o item de menu num botão — isso custaria o
`<a href>` real, e com ele "abrir em nova aba", clique do meio e "copiar endereço do link". Esses
links passam a entregar a espera à transição do **shell** (`insideDismissingOverlay`), que vive num
provider que não desmonta, continuando âncoras de verdade; um clique modificado (Ctrl/Cmd/Shift/Alt
ou botão do meio) é deixado para o navegador, intocado. Medido de novo depois: **overlay visto =
true**.

### §3.2 O que continua conscientemente fora

1. **Voltar/avançar do navegador, e o `navigate.back()` dos botões "Cancelar".** Em todas as
   medições, essas navegações foram resolvidas **instantaneamente do cache do roteador** — nem o
   `useLinkStatus`, nem a transição do provider, nem sequer um `loading.tsx` de sonda reportaram
   qualquer coisa, porque não houve espera nenhuma a reportar. A guarda E2E "browser back and forward
   never leave the loader behind" fixa o que importa: o histórico nunca deixa um loader preso. Se
   algum dia um retorno ao histórico passar a buscar dados de verdade, este é o caminho a reavaliar.
2. **Escrita da query string da tela atual** (filtros, ordenação, paginação, nos dez hooks de
   catálogo): não é navegação entre telas, e um loader de página sobre uma mudança de filtro seria
   um defeito, não uma melhoria. Decisão registrada em `eslint-disable` em cada arquivo.
3. **A tela de login.** `useNavigate` degrada para `router.push` ali porque o shell — e o overlay —
   ainda não existem. Não há o que mostrar.

---

## §4 — Validação executada

**Unidade** (`apps/web`, 147 arquivos / 839 testes, todos verdes):

- `src/components/vertice-loader.test.tsx` — semântica (`role="status"` único, SVG `aria-hidden`,
  rótulo visualmente oculto ainda disponível), os três arcos com suas classes de sequência e seus
  raios (20/30/40, a ordem em que acendem), as seis formas do farol fora da sequência, e as quatro
  transições de `useDelayedVisibility` com temporizadores falsos.
- `src/components/shell/navigation-pending.test.tsx` — vários links agregando num estado só, o
  atraso impedindo o flash, a remoção depois do commit, e um link que **desmonta no meio da
  navegação** não deixando estado pendente preso.

**E2E** (`apps/web/e2e/navigation-loader.spec.ts`, Chromium, 11/11 verdes). Navegações reais pela barra
lateral; o que os testes controlam é apenas quanto tempo o payload RSC do destino demora
(`page.route` sobre a requisição que leva o cabeçalho `RSC`) — nada finge o estado do componente:

1. navegação lenta mostra o loader **sobre a tela anterior**, que continua visível, e ele some quando
   a rota entra;
2. nada é pintado antes do atraso — medido em milissegundos entre o clique e a primeira pintura
   (≥ 180 ms), e não correndo atrás de uma navegação rápida real, porque num servidor de
   desenvolvimento nenhuma rota confirma de forma confiável em menos de 200 ms e o teste estaria
   medindo a máquina;
3. navegações consecutivas terminam no último destino, sem loader remanescente;
4. payload que falha (`route.abort`) não deixa o loader preso;
5. navegação por teclado (foco no link + Enter) recebe o mesmo retorno;
6. sob `prefers-reduced-motion: reduce` os três arcos aparecem **estáticos e completos**
   (`animation-name: none`, `opacity: 1`) — o símbolo inteiro, nunca um farol apagado.

**Prova de não-vacuidade**, feita por reversão temporária e revertida em seguida: com
`LOADER_DELAY_MS = 0`, o teste 2 falha medindo 83,8 ms; com a regra de `prefers-reduced-motion`
desativada, o teste 6 falha em `animation-name`. Nos testes de unidade, remover o atraso quebra 4 e
remover a limpeza do sinal quebra 1.

**Revisão renderizada** (`docs/reviews/ui/loader/`), 1440×900 e 390×844, claro e escuro:

- o loader é legível nos quatro casos, e o conteúdo anterior permanece visível por baixo;
- dois quadros por combinação mostram a sequência correndo (arcos acesos; farol sozinho no repouso
  do ciclo);
- `[data-navigation-pending]` = 0 depois do commit em todas as combinações — nenhum loader preso;
- requisições durante a navegação pendente: **nenhuma requisição extra** além das que a própria rota
  de destino já fazia (o payload RSC e as chamadas de dados da tela);
- erros de console: apenas os avisos de hidratação já conhecidos e já provados como exclusivos de
  desenvolvimento (`specs/013-stabilization-audit` §6) — nenhum novo, nenhum vindo do loader.

**Cobertura de origens** (§3.1): cinco cenários adicionais no mesmo arquivo — cartão do Dashboard,
linha de registro abrindo um detalhe e saindo dele, navegação programática após criar um ativo de
verdade, link do menu da conta, e voltar/avançar do navegador sem loader preso. Cada um verifica
também `toHaveCount(1)` no overlay: nunca dois indicadores.

**Regressão da migração dos 59 arquivos**: suíte E2E Chromium inteira, **172 de 172**, incluindo a
varredura de acessibilidade nos dois temas. (Uma execução anterior com 4 workers falhou um cenário de
acessibilidade de engajamento de auditoria; reexecutado isolado e com 2 workers, verde — contenção do
servidor de desenvolvimento, não regressão.)

**Portões do repositório**: `lint`, `typecheck` e `format:check` limpos. Build de produção verde:
First Load JS compartilhado **103 kB, inalterado**; `/risks/[id]` 415 → 417 kB e `/dashboard`
342 → 344 kB — o custo do invólucro, ~2 kB.

**Revisão renderizada da cobertura** (`docs/reviews/ui/loader/coverage-card-*.png`): navegação a
partir de um cartão do Dashboard em 1440×900 e 390×844, claro e escuro — em todos os quatro casos
`[data-navigation-pending]` = **1** e `role="status"` = **1** durante a espera, **0** depois do
commit, e nenhum erro de console novo (apenas os avisos de hidratação já conhecidos e provados como
exclusivos de desenvolvimento).

---

## §5 — Arquivos

Criados:

- `apps/web/src/components/navigation/link.tsx` — o `<Link>` do produto
- `packages/design-system/src/components/vertice-loader.tsx`
- `packages/design-system/src/lib/use-delayed-visibility.ts`
- `apps/web/src/components/shell/navigation-pending.tsx`
- `apps/web/src/components/vertice-loader.test.tsx`
- `apps/web/src/components/shell/navigation-pending.test.tsx`
- `apps/web/e2e/navigation-loader.spec.ts`
- `docs/reviews/ui/loader/` (capturas)

Alterados:

- `packages/design-system/src/styles/globals.css` — tokens `--brand-mark-ink`/`--brand-mark-signal`
  nos dois temas, `@keyframes vertice-signal-1..3` e as classes da sequência, com o ramo de
  `prefers-reduced-motion`;
- `packages/design-system/src/components/index.ts` — exporta o componente e o hook;
- `apps/web/src/components/shell/app-shell.tsx` — provider em volta do shell e um invólucro
  posicionado em volta do `<main>` para o overlay;
- `apps/web/src/components/shell/navigation-pending.tsx` — `useNavigate`/`useOptionalNavigate` e a
  transição do provider, além do relator por link;
- `eslint.config.mjs` — `no-restricted-imports` sobre `next/link` e `useRouter` em `apps/web`;
- 59 arquivos de `apps/web/src` — troca da linha de import de `next/link` para o `<Link>` do produto;
- 14 arquivos com navegação programática — `useRouter().push/back/refresh` para `useNavigate()`;
- 10 hooks de estado de catálogo — `eslint-disable` explicando por que a query string fica de fora;
- `apps/web/src/components/shell/user-menu.tsx` e `notifications.tsx` — `insideDismissingOverlay`;
- `apps/web/src/lib/messages/shell.ts` — `navigationPending: 'Carregando página…'`;
- `apps/web/src/features/reports/components/report-run-dialog.tsx` — variante `inline` + atraso.
