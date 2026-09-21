# Riscos V2 — entrega da listagem

Data: 2026-09-20. Escopo: somente `/risks`. Alterações locais, sem integração Git.

## Resultado visual

Hero integrado à página, com atmosfera azul suave, três planos de montanhas em paths
curvos e rosa dos ventos própria. A rosa possui dois aros, graduação de 32 marcas,
eixos, oito pontas, agulha e centro com profundidade por opacidade. SVG inline, sem
raster de produção, bibliotecas, animação ou requisição decorativa. Paleta noturna
própria; arte decorativa com `aria-hidden`, `focusable=false` e sem pointer events.

Quatro indicadores reais com superfícies semânticas discretas e números destacados.
Busca, filtros e controles de apresentação formam uma faixa de exploração. A linha
seguinte concentra contagem e quantidade por página. Os chips ativos permanecem
removíveis e visíveis quando os filtros estão recolhidos.

Cards mantêm três colunas em desktop largo, duas em tablet e uma no mobile. Código,
título, descrição limitada, badges e metadados compactos seguem a hierarquia da
referência. Faixa superior e tint usam o nível da Base selecionada; flags reais de
tratamento/revisão vencidos recebem prioridade cromática. Badges conservam texto e
ícone, sem depender só de cor. Foco, seleção e visão rápida foram preservados.

Tabela conserva colunas, ordenação, visibilidade e densidade. Não houve mudança em
backend, contratos, cálculos, autorização, escopo organizacional, lifecycle ou
estado da URL. Página de detalhe e outros módulos não foram implementados.

## Adaptações deliberadas da referência

- Sem frase motivacional e saudação ilustrativa, ausentes no cabeçalho real.
- Sem menu de três pontos inventado. Código continua abrindo detalhe; título/área
  abre a visão rápida; os controles existentes da tabela continuam disponíveis.
- Quantidade real por página: 25, 50 ou 100; padrão 50. Não foi adicionada opção 12.
- Em tratamento preserva o tom informacional e o significado já existente.
- Valores e textos dos registros vêm da API. Diferenças numéricas entre capturas
  refletem o ambiente real, inclusive fixtures dos E2Es, não dados fabricados.

## Componentes e arquivos

Criados:

- `apps/web/src/features/risks/components/risk-register-artwork.tsx`
- `apps/web/src/features/risks/components/risk-register-artwork.module.css`
- `apps/web/src/features/risks/components/risk-card.module.css`
- `apps/web/src/features/risks/components/risk-register-summary.module.css`

Alterados:

- `apps/web/src/app/(app)/risks/page.tsx`
- `apps/web/src/features/risks/components/risk-card.tsx`
- `apps/web/src/features/risks/components/risk-register-summary.tsx`
- `apps/web/src/features/risks/components/risk-register-filters.tsx`
- `apps/web/src/features/risks/components/risk-register-view.tsx`
- `packages/design-system/src/components/data-table/filter-bar.tsx`
- `packages/design-system/src/components/data-table/data-table.tsx`
- `packages/design-system/src/components/data-table/pagination-footer.tsx`
- `apps/web/src/components/design-system-register-chrome.test.tsx`
- `apps/web/scripts/ui-capture.mjs`
- `docs/modules/risks.md`
- `docs/architecture/frontend.md`

Reutilizados: PageHeader, SummaryStatCard, FilterBar, MultiSelectFilter,
UserMultiSelectFilter, ToolbarSelect, SortSelect, ViewToggle, ResultsToolbar,
CardGrid, DataTable, PaginationFooter, ColumnVisibilityMenu, StatusBadge,
RiskLevelBadge e os estados existentes de loading/error/empty.

As únicas extensões compartilhadas são opt-in: `FilterBar.searchTrailing` permite
controles ao lado da busca; `showPageSize=false` evita duplicar o seletor já presente
na linha de resultados. Os padrões permanecem iguais para outros consumidores.

## Evidência visual

Capturas finais em `docs/reviews/ui/risks-v2-final-*`. Arquivos `*-viewport.png`
mostram a janela real; arquivos sem esse sufixo mostram toda a listagem, com altura
ampliada para o contêiner de rolagem da aplicação. Capturas preliminares `risks-v2-*`
sem `final` registram a iteração e não são a evidência final.

| Tema/largura | Cards | Tabela |
|---|---|---|
| Light 1440 | [janela](ui/risks-v2-final-light-1440/01-cards-viewport.png) | [janela](ui/risks-v2-final-light-1440/02-table-viewport.png) |
| Light 1024 | [janela](ui/risks-v2-final-light-1024/01-cards-viewport.png) | [janela](ui/risks-v2-final-light-1024/02-table-viewport.png) |
| Light 768 | [janela](ui/risks-v2-final-light-768/01-cards-viewport.png) | [janela](ui/risks-v2-final-light-768/02-table-viewport.png) |
| Light 390 | [completa](ui/risks-v2-final-light-390/01-cards.png) | [janela](ui/risks-v2-final-light-390/02-table-viewport.png) |
| Dark 1440 | [janela](ui/risks-v2-final-dark-1440/01-cards-viewport.png) | [janela](ui/risks-v2-final-dark-1440/02-table-viewport.png) |
| Dark 390 | [completa](ui/risks-v2-final-dark-390/01-cards.png) | [janela](ui/risks-v2-final-dark-390/02-table-viewport.png) |

Comparação com a referência: preserva a composição hero + quatro indicadores +
exploração + três cards, com montanhas e bússola na mesma família do Dashboard V2.
O shell existente permanece intacto. A composição se adapta ao conteúdo real e ao
reflow, em vez de reproduzir artificialmente os números e controles do mockup.

## Verificações

- 69 testes unitários passaram em sete arquivos: cards, grid, resumo, colunas,
  estados vazios, URL state e componentes compartilhados. Incluem dois casos novos
  para os slots opcionais. O arquivo compartilhado foi reexecutado após ajuste de
  tipagem: 30/30 passaram.
- Typecheck da aplicação e compilação do Design System passaram. A compilação do
  DS foi necessária porque Vitest consome o pacote compilado; a aplicação usa source.
- Lint direcionado e Prettier dos arquivos alterados passaram; `git diff --check`
  passou. Detector Impeccable retornou lista vazia.
- E2E `risk-register.spec.ts`, Chromium, um worker: 9 descobertos, 9 executados,
  9 aprovados, zero falhas/flaky/skips/interrupções. Servidor local de desenvolvimento;
  não é uma alegação de execução em build de produção ou em todos os navegadores.
- Axe WCAG 2 A/AA e WCAG 2.1 AA: zero violações nas 15 combinações finais de
  cards/tabela/filtros abertos. Nenhum overflow horizontal da página nessas medições.
  A tabela mantém sua própria rolagem horizontal para todas as colunas.
- Verificação real de paginação: 25 itens, página 2, tabela preservando página e
  quantidade, 50 itens retornando à página 1; seletor único.
- Teclado: Tab da busca para filtros, Enter abre; E2E confirma Escape na visão
  rápida com retorno de foco. Contorno de seleção preservado usando sombra do DS.

JSON consolidado: [validação](ui/risks-v2-validation-summary.json).
JSON de interações: [paginação e teclado](ui/risks-v2-final-light-interaction-checks.json).

Um contraste insuficiente no rótulo Tabela durante a inspeção foi corrigido
localmente, sem alterar o componente compartilhado. A revalidação ficou sem violações.
Nenhum finding funcional fora do escopo ficou pendente nesta rodada.

## Git

Não foram executados add, commit, push, pull, merge, rebase, cherry-pick, reset,
revert, stash, criação/troca/exclusão de branch, tags ou alteração de HEAD.
Alterações estão locais e não commitadas. Trabalho concorrente não foi revertido.
A seguir, snapshot read-only; `diff --stat` não inclui arquivos novos não rastreados.

```text
 apps/web/scripts/ui-capture.mjs                    | 144 +++++++++++++++++++++
 apps/web/src/app/(app)/risks/page.tsx              |   5 +-
 .../design-system-register-chrome.test.tsx         |  16 +++
 .../src/features/risks/components/risk-card.tsx    |  43 +++---
 .../risks/components/risk-register-filters.tsx     |   9 +-
 .../risks/components/risk-register-summary.tsx     |   6 +-
 .../risks/components/risk-register-view.tsx        | 108 +++++++++-------
 docs/architecture/frontend.md                      |   9 ++
 docs/modules/risks.md                              |  34 +++++
 .../src/components/data-table/data-table.tsx       |   4 +
 .../src/components/data-table/filter-bar.tsx       |  13 +-
 .../components/data-table/pagination-footer.tsx    |  33 +++--
 12 files changed, 342 insertions(+), 82 deletions(-)
```

```text
 M apps/web/scripts/ui-capture.mjs
 M apps/web/src/app/(app)/risks/page.tsx
 M apps/web/src/components/design-system-register-chrome.test.tsx
 M apps/web/src/features/risks/components/risk-card.tsx
 M apps/web/src/features/risks/components/risk-register-filters.tsx
 M apps/web/src/features/risks/components/risk-register-summary.tsx
 M apps/web/src/features/risks/components/risk-register-view.tsx
 M docs/architecture/frontend.md
 M docs/modules/risks.md
 M packages/design-system/src/components/data-table/data-table.tsx
 M packages/design-system/src/components/data-table/filter-bar.tsx
 M packages/design-system/src/components/data-table/pagination-footer.tsx
?? apps/web/src/features/risks/components/risk-card.module.css
?? apps/web/src/features/risks/components/risk-register-artwork.module.css
?? apps/web/src/features/risks/components/risk-register-artwork.tsx
?? apps/web/src/features/risks/components/risk-register-summary.module.css
?? docs/reviews/risks-v2-delivery.md
?? docs/reviews/ui/risks-v2-dark-1440/
?? docs/reviews/ui/risks-v2-dark-390/
?? docs/reviews/ui/risks-v2-final-dark-1440/
?? docs/reviews/ui/risks-v2-final-dark-390/
?? docs/reviews/ui/risks-v2-final-light-1024/
?? docs/reviews/ui/risks-v2-final-light-1440/
?? docs/reviews/ui/risks-v2-final-light-390/
?? docs/reviews/ui/risks-v2-final-light-768/
?? docs/reviews/ui/risks-v2-final-light-interaction-checks.json
?? docs/reviews/ui/risks-v2-final-light-quick-view.png
?? docs/reviews/ui/risks-v2-light-1024/
?? docs/reviews/ui/risks-v2-light-1440/
?? docs/reviews/ui/risks-v2-light-390/
?? docs/reviews/ui/risks-v2-light-768/
?? docs/reviews/ui/risks-v2-validation-summary.json
```

