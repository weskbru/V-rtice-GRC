Status: vigente — índice da documentação do PharosGRC, verificado contra o código em 2026-09-14.

# Documentação do PharosGRC

Ponto de entrada para qualquer pessoa (ou agente) que precise trabalhar neste repositório. Se é o
seu primeiro dia aqui, comece por **[`docs/HANDOVER.md`](./HANDOVER.md)**, não por este índice.

## Comece aqui

- **[`docs/HANDOVER.md`](./HANDOVER.md)** — "Comece aqui": visão geral, como subir o ambiente,
  ordem de leitura recomendada, conceitos-chave, mapa de módulos, decisões que não podem ser
  desfeitas.
- **[`docs/STATE.md`](./STATE.md)** — fotografia do que existe **hoje**: módulos funcionais,
  PARCIAL/PLANEJADO, pendências conhecidas. Não é um changelog — é o estado atual, datado.

> Nota histórica: um `docs/handover/README.md` foi referenciado por versões antigas deste índice
> como "handover em elaboração". Esse diretório nunca chegou a existir versionado no repositório —
> `docs/HANDOVER.md` (este mesmo diretório, arquivo único) é o substituto real e vigente.

## Organização de docs/

```
docs/
├── README.md              # este arquivo
├── HANDOVER.md
├── STATE.md
├── architecture.md
├── deferred-findings.md
├── local-environment.md
├── architecture/           # referência do sistema como ele é hoje
│   ├── backend-map.md
│   ├── database.md
│   ├── decisions.md
│   ├── frontend.md
│   ├── grc-roadmap.md
│   └── security.md
├── guides/                 # como trabalhar no dia a dia
│   ├── development.md
│   ├── testing.md
│   └── troubleshooting.md
├── modules/                 # um documento por módulo de negócio
│   └── ...
├── history/                 # como chegamos até aqui — nada vigente
│   ├── architecture-review.md
│   ├── foundation-assurance.md
│   ├── grc-domain-blueprint.md
│   ├── implementation-debt-review.md
│   ├── opus-sonnet-debt-remediation.md
│   ├── probo-benchmark.md
│   └── security-review.md
├── brand/
└── reviews/ui/
```

Por que alguns documentos **não** foram movidos para dentro dessa estrutura:

- `README.md`, `HANDOVER.md` e `STATE.md` ficam na raiz de `docs/` como pontos de entrada — são o
  que qualquer pessoa ou agente lê primeiro, antes de saber que a estrutura por assunto existe.
- `architecture.md`, `deferred-findings.md` e `local-environment.md` ficam na raiz porque são
  citados por comentário de código, teste e CI (`.github/workflows/ci.yml`) — cerca de 5, 59 e 42
  arquivos fora de documentação respectivamente, medidos em 2026-09-14 — e mover esses três
  deixaria essas referências mortas.
- `architecture/decisions.md` e `architecture/grc-roadmap.md` ficam onde estão porque código cita
  esses caminhos diretamente (`grc-roadmap.md` é histórico em conteúdo, mas seu caminho está
  ancorado por essas referências).
- `brand/` e `reviews/ui/` ficam onde estão porque código e CLAUDE.md §18.13 citam esses caminhos.

A lógica por trás das quatro pastas por assunto: `architecture/` é a referência do sistema como ele
é; `guides/` é como trabalhar no dia a dia; `modules/` é um documento por módulo de negócio;
`history/` é como chegamos até aqui — nada ali descreve o estado atual do produto.

## Fonte de verdade por assunto

| Assunto | Documento | O que encontra lá |
|---|---|---|
| Índice geral | `docs/README.md` (este arquivo) | Mapa de toda a documentação |
| Roteiro de entrada | [`docs/HANDOVER.md`](./HANDOVER.md) | Onboarding, comandos, ordem de leitura |
| Estado atual | [`docs/STATE.md`](./STATE.md) | Fotografia datada: o que está pronto, parcial, planejado |
| Arquitetura e limites de módulo | [`docs/architecture.md`](./architecture.md) | core/grc/modules, extension points, exemplo de módulo novo |
| Mapa do backend implementado | [`docs/architecture/backend-map.md`](./architecture/backend-map.md) | módulos, rotas, dependências, persistência, segurança e testes da API |
| Modelo de dados | [`docs/architecture/database.md`](./architecture/database.md) | Schema, migrações, política de seed |
| Segurança | [`docs/architecture/security.md`](./architecture/security.md) | Autenticação, sessões, CSRF, RBAC, escopo, SoD, auditoria, arquivos |
| Frontend | [`docs/architecture/frontend.md`](./architecture/frontend.md) | Estrutura de `frontend/`, shell, navegação, Design System, mensagens, a11y |
| Ambiente e desenvolvimento | [`docs/guides/development.md`](./guides/development.md) | Setup do zero, comandos, "como implementar uma funcionalidade nova" |
| Testes | [`docs/guides/testing.md`](./guides/testing.md) | Suítes, portão de contrato, fixtures, mapeamento do CI |
| Solução de problemas | [`docs/guides/troubleshooting.md`](./guides/troubleshooting.md) | Sintomas conhecidos e suas causas |
| Módulos de negócio | [`docs/modules/`](./modules/README.md) | Um documento por módulo — status, caminhos, pendências |
| Decisões arquiteturais (ADR) | [`docs/architecture/decisions.md`](./architecture/decisions.md) | ADR-016 em diante; ADR-001–015 vivem em `specs/001-grc-platform-foundation/research.md` |
| Decisões operacionais de ambiente | [`docs/local-environment.md`](./local-environment.md) | Log datado D-1..D-23, armadilhas já pagas |
| Findings/débitos conhecidos | [`docs/deferred-findings.md`](./deferred-findings.md) | Registro canônico de defeitos e débitos, datado, com evidência |
| Especificação e histórico por fase | [`specs/`](../specs/) | `spec.md`/`plan.md`/`tasks.md`/`contracts/`/`STATE.md` por fase |
| Artefatos de revisão | [`docs/reviews/`](./reviews/) | Revisões técnicas e capturas de UI — históricos, não vigentes |
| Regras do projeto | [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), [constituição](../.specify/memory/constitution.md) | Princípios, política de UI/UX, política de arquitetura de domínio GRC |

## Vigente

- [docs/architecture/backend-map.md](./architecture/backend-map.md) — fotografia provisória do backend na branch refatory.

Documentos que descrevem o estado atual do código e devem ser mantidos junto com ele:

- [`docs/HANDOVER.md`](./HANDOVER.md), [`docs/STATE.md`](./STATE.md)
- [`docs/architecture.md`](./architecture.md), [`docs/architecture/database.md`](./architecture/database.md),
  [`docs/architecture/security.md`](./architecture/security.md), [`docs/architecture/frontend.md`](./architecture/frontend.md),
  [`docs/guides/development.md`](./guides/development.md), [`docs/guides/testing.md`](./guides/testing.md),
  [`docs/guides/troubleshooting.md`](./guides/troubleshooting.md)
- [`docs/modules/`](./modules/README.md) (um documento por módulo)
- [`docs/architecture/decisions.md`](./architecture/decisions.md) (ADRs — decisão vigente até ser
  superseded por outra ADR, nunca apagada)
- [`docs/local-environment.md`](./local-environment.md), [`docs/deferred-findings.md`](./deferred-findings.md)
  (logs datados, sempre crescentes — cada entrada individual é histórica, o documento como um todo
  é a fonte viva)
- [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md)

## Histórico

Documentos que registram um momento específico (uma fase, uma revisão, um benchmark) e carregam,
desde 2026-09-14, um aviso no topo apontando para a fonte vigente equivalente. Não foram apagados
nem reescritos — divergência entre eles e o código atual é esperada, não um erro a corrigir nestes
arquivos. Todos vivem em [`docs/history/`](./history/), exceto o roteiro (`grc-roadmap.md`), cujo
caminho permanece ancorado em `docs/architecture/` por ser citado por código:

- [`docs/history/grc-domain-blueprint.md`](./history/grc-domain-blueprint.md) — alvo
  arquitetural proposto em 2026-09-07.
- [`docs/architecture/grc-roadmap.md`](./architecture/grc-roadmap.md) — sequenciamento das Fases
  0–7, hoje concluídas; trabalho seguinte em `docs/STATE.md`.
- [`docs/history/probo-benchmark.md`](./history/probo-benchmark.md) — artefato de
  evidência (CLAUDE.md §19.1), nunca especificação do PharosGRC.
- [`docs/history/implementation-debt-review.md`](./history/implementation-debt-review.md) —
  diagnóstico estático de 2026-09-10.
- [`docs/history/foundation-assurance.md`](./history/foundation-assurance.md) — matriz de
  garantias da fase "Foundation Assurance & Hardening", concluída em 2026-09-07 (já datado e
  autodescrito como artefato de fase no próprio topo).
- [`docs/history/opus-sonnet-debt-remediation.md`](./history/opus-sonnet-debt-remediation.md) —
  prompt de execução do saneamento (fase 007).
- [`docs/history/architecture-review.md`](./history/architecture-review.md),
  [`docs/history/security-review.md`](./history/security-review.md) — revisões pontuais de
  2026-09-06; fonte vigente em `docs/architecture.md`/`docs/architecture/security.md`.
- [`docs/reviews/ui/`](./reviews/ui/) — capturas de tela e planos de revisão visual; nunca ativo de
  produção (CLAUDE.md §18.13). [`docs/reviews/ui/PENDING.md`](./reviews/ui/PENDING.md) registra
  pendências de refinamento visual observadas em inspeção renderizada.
- `specs/NNN-<fase>/STATE.md` de cada fase concluída — registro operacional de fechamento daquela
  fase especificamente. Índice completo:

  | Fase | STATE.md | Assunto |
  |---|---|---|
  | 005 | [`specs/005-audit-findings/STATE.md`](../specs/005-audit-findings/STATE.md) | Auditoria e Achados |
  | 006 | [`specs/006-assets-processes/STATE.md`](../specs/006-assets-processes/STATE.md) | Ativos e Processos |
  | 007 | [`specs/007-implementation-remediation/STATE.md`](../specs/007-implementation-remediation/STATE.md) | Saneamento de dívida de implementação |
  | 008 | [`specs/008-incidents-problems/STATE.md`](../specs/008-incidents-problems/STATE.md) | Incidentes e Problemas |
  | 009 | [`specs/009-indicators-reports/STATE.md`](../specs/009-indicators-reports/STATE.md) | Indicadores e Relatórios |
  | 010 | [`specs/010-action-plan-surface/STATE.md`](../specs/010-action-plan-surface/STATE.md) | Superfície de Plano de Ação |
  | 011 | [`specs/011-dashboard-platform-view/STATE.md`](../specs/011-dashboard-platform-view/STATE.md) | Dashboard como visão de plataforma |
  | 012 | [`specs/012-admin-roles-screen/STATE.md`](../specs/012-admin-roles-screen/STATE.md) | Refinamento visual de Admin → Papéis |
  | 013 | [`specs/013-stabilization-audit/STATE.md`](../specs/013-stabilization-audit/STATE.md) | Auditoria de estabilização técnica |
  | 014 | [`specs/014-institutional-loader/STATE.md`](../specs/014-institutional-loader/STATE.md) | Loader institucional de navegação |
  | 015 | [`specs/015-roles-permissions-surface/STATE.md`](../specs/015-roles-permissions-surface/STATE.md) | Superfície de Papéis e Permissões — fechada em 2026-09-14 |

  Fases 001–004 registram seu estado em `research.md`/`data-model.md`/`plan.md` próprios, não em um
  `STATE.md` dedicado — ver o diretório de cada fase em [`specs/`](../specs/).

As specs ratificadas (`spec.md`, `plan.md`, `tasks.md`, `contracts/`) definem o comportamento
esperado de cada fase; o código mostra o implementado. Divergência entre os dois pede análise e
registro (em `docs/deferred-findings.md` ou no `STATE.md` da fase), não alteração silenciosa de uma
das fontes.

## Como manter esta documentação atualizada

Ao mudar comportamento do produto: atualize o documento de assunto correspondente (tabela acima) na
mesma mudança, não depois. `docs/HANDOVER.md` e `docs/STATE.md` só precisam de atualização quando a
mudança afeta o que aparece **neles especificamente** (novo módulo, mudança de status
IMPLEMENTADO/PARCIAL/PLANEJADO, uma pendência conhecida resolvida) — não a cada commit.
`docs/guides/development.md` §6.9 descreve o fluxo de atualização de documentação ao fechar uma fase.
