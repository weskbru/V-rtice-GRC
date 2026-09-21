Status: vigente — índice dos documentos de módulo, verificado contra o código em 2026-09-14.

# Módulos — índice

Um documento por módulo/capacidade de negócio do PharosGRC. Cada um é a fonte de verdade sobre o
que aquele módulo faz, onde vive no código e o que está em aberto — este índice não duplica esse
conteúdo, só aponta para ele. Para o inventário do produto como um todo (o que existe hoje, o que é
PARCIAL, o que é PLANEJADO), veja **[`docs/STATE.md`](../STATE.md)**; para o roteiro de leitura de
um primeiro dia, **[`docs/HANDOVER.md`](../HANDOVER.md)**.

## Estrutura comum a cada documento

Todo documento de módulo segue a mesma forma, para que se possa saltar entre eles sem reaprender a
estrutura:

1. **Status** — IMPLEMENTADO / PARCIAL / PLANEJADO, por capacidade quando o módulo tiver mais de
   uma (ex.: `platform.md` avalia Usuários, Papéis, Sessões etc. separadamente).
2. **Caminho de backend** — diretório(s) sob `apps/api/src/{core,grc,modules}/`.
3. **Caminho de frontend** — diretório(s) sob `apps/web/src/app/(app)/` e `apps/web/src/features/`.
4. **Resumo** — o que o módulo cobre, em poucas frases.
5. **Itens em aberto** — gaps nomeados, cada um com referência a um finding (`F-NNN` em
   `docs/deferred-findings.md`) quando existir, ou marcado como decisão deliberada quando não for
   defeito.
6. **Referências cruzadas** — spec de origem (`specs/NNN-*/`), ADRs relevantes, seções do
   CLAUDE.md.

## Índice

| Documento | Módulo/capacidade | Status | Caminho API | Caminho Web |
|---|---|---|---|---|
| [`platform.md`](./platform.md) | Plataforma (Core) — Usuários, Papéis/Permissões, Organizações, Perfil, Sessões, Auditoria, Arquivos, Comentários, Notificações, Aprovações, Configurações | IMPLEMENTADO, com duas exceções nomeadas: autoatendimento de sessões e Configurações são PLANEJADO | `apps/api/src/core/**` | `apps/web/src/app/(app)/admin/**`, `/profile` |
| [`grc-core.md`](./grc-core.md) | Núcleo GRC compartilhado — Evidência, Ação (Plano de Ação, CLAUDE.md §17 item 15), Achado | IMPLEMENTADO | `apps/api/src/grc/{action,evidence,finding,shared}/` | `apps/web/src/features/{actions,evidence,findings}/`, rota `/actions` |
| [`risks.md`](./risks.md) | Gestão de Riscos | IMPLEMENTADO | `apps/api/src/modules/risk/` | `apps/web/src/app/(app)/risks/`, `features/risks/` |
| [`controls-compliance.md`](./controls-compliance.md) | Controles e Compliance | IMPLEMENTADO | `apps/api/src/modules/{controls,compliance}/` | `.../controls/`, `.../compliance/` |
| [`audit-engagements.md`](./audit-engagements.md) | Auditoria (Engajamentos) e Achados | IMPLEMENTADO | `apps/api/src/modules/audit-engagements/`, `apps/api/src/grc/finding/` | `.../audits/`, `features/audit-engagements/`, `features/findings/` |
| [`assets-processes.md`](./assets-processes.md) | Ativos e Processos | IMPLEMENTADO | `apps/api/src/modules/{assets,processes}/` | `.../assets/`, `.../processes/` |
| [`incidents-problems.md`](./incidents-problems.md) | Incidentes e Problemas | IMPLEMENTADO | `apps/api/src/modules/{incidents,problems}/` | `.../incidents/`, `.../problems/` |
| [`indicators-reports.md`](./indicators-reports.md) | Indicadores e Relatórios | IMPLEMENTADO no cálculo/catálogo/API; PARCIAL em três telas administrativas (ver `indicators-reports.md` §"Status" e §"Telas") | `apps/api/src/modules/{indicators,reports}/` | `.../indicators/`, `.../reports/` |
| [`dashboard.md`](./dashboard.md) | Dashboard GRC — agregação de leitura, não é módulo de negócio (CLAUDE.md §4) | IMPLEMENTADO | `apps/api/src/modules/dashboard/`, registro em `apps/api/src/core/dashboard/` | `.../dashboard/`, `features/dashboard/` |

Todos os onze módulos de negócio planejados em CLAUDE.md §1/§17 (Fases 0–7 de
`docs/architecture/grc-roadmap.md`) estão implementados. Não existe módulo `status: 'planejado'`
sem tela hoje — ver `docs/STATE.md` para a lista de PARCIAL/PLANEJADO real (superfícies específicas
dentro de um módulo já implementado, não módulos inteiros faltando).

## Não documentados como "módulo" próprio

- **Plano de Ação** não é um módulo de negócio — é a capacidade `Action`, documentada em
  `grc-core.md` (CLAUDE.md §17 item 15, decisão registrada em §1/§4).
- **Compliance** e **Controles** dividem um único documento (`controls-compliance.md`) porque
  nasceram na mesma fase (`specs/003-controls-management/`, `specs/004-compliance-management/`) e
  são fortemente relacionados (ADR-017): Controle não pertence a framework algum, Requisito
  pertence a exatamente uma versão de framework, a ligação é N:M.
