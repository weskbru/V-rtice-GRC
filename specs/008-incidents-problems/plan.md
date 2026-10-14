# Implementation Plan: Gestão de Incidentes e Gestão de Problemas

**Branch**: `008-incidents-problems` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-incidents-problems/spec.md`

**Status**: Q1-Q3 decididas pelo coordenador em 2026-09-11 (spec.md "Decisões do coordenador";
research.md D-13 a D-15). Este plano e `tasks.md` cobrem a fase inteira — nenhuma tarefa permanece
bloqueada.

---

## Summary

Entrega os dois módulos de negócio seguintes do roteiro (CLAUDE.md §17, item 13): Gestão de
Incidentes e Gestão de Problemas, cada um com módulo próprio, contrato REST, autoridade própria e
escopo organizacional, seguindo a forma que `006-assets-processes` e `003-controls-management` já
estabeleceram.

Os dois consomem `Action` e `Evidence`, já existentes no núcleo GRC compartilhado
(`grc/action`, `grc/evidence`) — nenhum conceito próprio de tarefa, arquivo ou aprovação. É a
condição que o roteiro registrou para esta fase poder começar: a convergência de `Action`
(`007-implementation-remediation`) precisava terminar antes, para que Incidentes não fosse o
terceiro caminho a duplicar o problema que a convergência acabou de fechar no segundo.

A relação entre os dois domínios em si — se um problema nasce de incidentes, se um incidente pode
existir sem problema, o que o fechamento de um exige do outro — é uma decisão de produto que este
plano **não** toma. `spec.md` a registra como três perguntas abertas, com as opções e o custo de
cada uma. Nada neste plano ou em `tasks.md` pressupõe uma resposta.

---

## Technical Context

**Language/Version**: TypeScript 5.x · Node 22

**Primary Dependencies**: NestJS 11 (API), Next.js 15 App Router (web), Prisma 6, Vitest, Playwright
+ `@axe-core/playwright`. **Nenhuma dependência nova.**

**Storage**: PostgreSQL 18. Duas tabelas novas (`incidents`, `problems`), quatro tabelas de ligação
novas, sete extensões aditivas de enum fechado e dois enums de severidade/situação por domínio
(data-model.md §1-§3). Nenhuma tabela existente muda de forma.

**Testing**: `test:unit`, `test:contract`, `test:integration` (API); `test:unit` (web); `test:e2e`
(Playwright). Linha de base a preservar: medir antes de iniciar a Fase 1 e registrar aqui, seguindo
a disciplina que `006-assets-processes/plan.md` e `007-implementation-remediation/spec.md` já
estabeleceram (número medido, nunca presumido).

**Target Platform**: aplicação web corporativa; API em 3001, web em 3000.

**Project Type**: monorepo web existente — `apps/api` + `apps/web` + `packages/design-system`.

**Performance Goals**: nenhuma meta nova. Duas listagens escopadas, quatro vínculos simples — mesma
ordem de grandeza que `006` já mediu como não impactante.

**Constraints**: interface em pt-BR nos catálogos centralizados (§11.1); nenhuma exclusão de
registro; os dois mecanismos de relacionamento de §19.3 e nenhum terceiro; nenhuma tabela ou coluna
relacionando `Incident` a `Problem` diretamente até o coordenador decidir (spec.md Q1-Q3,
data-model.md §6).

**Scale/Scope**: dois domínios com forma paralela mas não idêntica; 26 operações REST (15 Incidente +
11 Problema); 2 catálogos + 2 detalhes + 2 formulários na interface; 10 permissões novas; 8 valores
de enum fechado estendidos (incluindo `PROBLEM_INCIDENT_LINK`); 4 enums novos (2 severidade, 2
situação); 5 tabelas de ligação novas, incluindo `problem_incident_links` (D-14).

---

## Constitution Check

*GATE: deve passar antes da Fase 0 e ser reavaliado após a Fase 1.*

| Princípio | Avaliação | Evidência |
|---|---|---|
| **I. GRC Domain Integrity** | **Passa.** Dois domínios nomeados pela própria Constituição, cada um com contexto delimitado próprio. Nenhuma entidade genérica | research.md D-1 |
| **II. Security by Design** | **Passa.** Escopo organizacional obrigatório em toda leitura e escrita desde a primeira linha — não uma correção posterior, como `006` precisou fazer | FR-022 |
| **III. Identity, Access Control and Segregation of Duties** | **Passa.** Dez permissões próprias, escopo dos dois lados em todo vínculo (ADR-020 parte 5); segregação de funções aplicada ao fechamento de Problema (D-7), deliberadamente não aplicada ao de Incidente (D-6, com razão registrada) | FR-011, FR-013, D-6, D-7 |
| **IV. Auditability and Traceability** | **Passa.** Toda criação, transição e vínculo é evento de auditoria; nenhuma linha de vínculo é apagada, só marcada desvinculada | FR-020, data-model.md L1 |
| **V. Data Integrity and Governance** | **Passa.** Nenhuma exclusão de registro; toda migração é aditiva; verificação de contagem antes/depois exigida (data-model.md §3) | data-model.md |
| **VI. Risk Management Integrity** | **Passa.** Nenhuma regra de Risco muda. Os vínculos novos (`IncidentRiskLink`, `ProblemRiskLink`) são consumidos pelo detalhe do risco, nunca o contrário | FR-015 |
| **VII. Workflow and Accountability** | **Passa.** Duas máquinas de estado com toda transição nomeada, autor e data auditados; fechamento de Problema exige prova de trabalho concluído, não uma afirmação (D-7) | data-model.md D-4/D-5 |
| **VIII. Code Quality and Architecture** | **Passa.** Segue a forma de `modules/controls`/`modules/assets`; nenhuma abstração nova além de dois enums de severidade (D-9), cada um justificado | D-1, D-9 |
| **IX. Testing Standards** | **Passa.** Cobertura de contrato para toda operação nova; guarda estrutural para ausência de tabela de tarefa/arquivo/aprovação própria (SC-004) | SC-002 a SC-006 |
| **X. User Experience Consistency** | **Passa.** pt-BR nos catálogos centralizados; reusa os primitivos de `packages/design-system`; severidade e situação nunca só por cor | FR-023 a FR-027 |
| **XI. Performance and Scalability** | **Passa.** Sem índice ou consulta de custo novo relativo ao já existente | — |
| **XII. Observability and Operational Reliability** | **Passa.** Sem caminho de log novo; erros opacos por padrão | AGENTS.md |
| **XIII. API and Integration Standards** | **Passa.** REST, contrato OpenAPI escrito à mão, entrando em `contract-coverage.spec.ts` na mesma tarefa que o cria — a omissão que `006` já nomeou como risco a evitar | tasks de contrato |
| **XIV. Documentation and Architectural Decisions** | **Passa.** research.md registra cada decisão com alternativa rejeitada; nenhuma ADR nova necessária — ADR-008 (enums fechados) e ADR-020 (vínculos) já cobrem | research.md |
| **XV. Change Management and Backward Compatibility** | **Passa.** Toda migração aditiva; nenhum contrato existente muda de forma (nenhuma operação de `platform.openapi.yaml` é superada por esta fase, ao contrário de `006`) | data-model.md §3 |
| **XVI. Compliance-Oriented Engineering** | **Passa.** Trilha de auditoria cobre os dois domínios e os quatro vínculos desde a primeira linha | FR-020 |

**Nenhum item bloqueia a Fase 0.** A única ressalva registrada, não um bloqueio de princípio: Q1-Q3
(spec.md) precisam de decisão do coordenador antes de `/speckit-implement` poder gerar código para
qualquer relação Incidente↔Problema — mas nenhum princípio da Constituição exige essa decisão para
o restante da fase prosseguir (Assumption A-5).

---

## Project Structure

### Documentation (this feature)

```text
specs/008-incidents-problems/
├── spec.md              # o quê, por quê, e as três perguntas em aberto
├── plan.md              # este arquivo
├── research.md          # D-1 a D-12, decisões com alternativas rejeitadas
├── data-model.md        # entidades, migração, invariantes, o que NÃO é modelado (§6)
├── contracts/
│   ├── incidents.openapi.yaml
│   └── problems.openapi.yaml
└── tasks.md             # tarefas, incluindo o vínculo Incidente↔Problema (decisão do coordenador)
```

Sem `quickstart.md` nem `checklists/` nesta entrega ainda: o coordenador pediu especificação,
decisões, modelo de dados, contratos, plano e tarefas — os dois ficam para quando
`/speckit-implement` começar, seguindo a mesma ordem que toda fase anterior já seguiu (quickstart é
o roteiro **executável**, e não há o que executar ainda).

### Source Code (repository root)

```text
apps/api/src/
├── modules/
│   ├── incidents/                   # NOVO — domínio Incidente
│   │   ├── domain/                  # entidade, permissões, portes, tabela de transições (D-4)
│   │   ├── application/             # casos de uso (list, get, create, update, transition, link x3)
│   │   ├── infrastructure/          # repositório escopado, resolvedores de origem/sujeito, leitura
│   │   │                            # direta de `problem_incident_links` (nunca escreve nela)
│   │   └── presentation/            # controller + DTOs + mappers, incl. GET .../problems (read-only)
│   ├── problems/                    # NOVO — forma paralela; dono da escrita de Incidente↔Problema
│   │   └── application/links/       # inclui link-problem-incident.usecase.ts (D-14), via o porte abaixo
│   ├── risk/                        # ALTERADO — expõe os incidentes/problemas vinculados no detalhe
│   ├── assets/                      # ALTERADO — idem, para incidentes vinculados
│   └── processes/                   # ALTERADO — idem
├── shared/grc-ports/
│   └── incident-directory.port.ts   # NOVO — usado por `modules/problems` para resolver o incidente-
│                                     # alvo do vínculo (D-14); nenhum porte simétrico do lado de
│                                     # Incidentes — a leitura reversa é consulta direta à tabela
└── grc/shared/domain/
    └── entity-code.service.ts       # ALTERADO — prefixos 'INC' e 'PRB'

apps/api/prisma/
├── migrations/                      # ADITIVA — duas tabelas, cinco tabelas de ligação, 8 extensões de enum, 4 enums novos
└── seed/platform.seed.ts            # ALTERADO — dez permissões novas nos papéis relevantes

apps/web/src/
├── app/(app)/incidents/             # NOVO — catálogo, novo, detalhe
├── app/(app)/problems/              # NOVO — idem
├── features/incidents/              # NOVO — types, api, componentes
├── features/problems/               # NOVO — idem
├── lib/messages/incidents.ts        # NOVO — catálogo pt-BR
├── lib/messages/problems.ts         # NOVO — idem
└── components/shell/navigation-registry.ts   # ALTERADO — duas entradas saem de 'planned'
```

**Structure Decision**: mesma forma interna de `modules/controls`/`modules/assets`
(domain/application/infrastructure/presentation), dois módulos de negócio novos, dois portes
compartilhados novos em `shared/grc-ports/` — mesmo lugar de `AssetDirectoryPort`/
`ProcessDirectoryPort` (ADR-011: `shared/**` não importa de `core/**` nem de `modules/**`).

---

## Riscos desta fase, e o que cada um exige

| Risco | Por que é real aqui | Mitigação exigida |
|---|---|---|
| **Implementar o vínculo Incidente↔Problema com acoplamento de ciclo de vida "por precaução"** | É a tentação mais provável agora que a decisão existe — bloquear `Problem -> CLOSED` enquanto um incidente vinculado segue aberto parece uma salvaguarda razoável. É exatamente o acoplamento que o coordenador decidiu não introduzir (D-15) | Nenhuma tarefa de `tasks.md` consulta o estado de um registro vinculado em nenhuma precondição de transição; T033/T034 (fechamento de Problema) testam apenas P2/P3, nunca o estado de um incidente |
| **Repetir o padrão de F-22/F-42**: um mecanismo compartilhado (Ação, Evidência) que funciona em teoria mas nunca foi exercitado pelo módulo novo até tarde no ciclo | Um dos dois módulos anteriores (`006`) só descobriu a lacuna de mensagens centralizadas ao testar de verdade | Exercitar `POST /actions` com `originType: INCIDENT`/`PROBLEM` e `POST /evidence` com `subjectType` equivalente **na primeira tarefa de integração de cada módulo**, não na última |
| **Assimetria entre Incidente e Problema por serem escritos em paralelo** | Mesmo risco que `006` já nomeou para Ativo/Processo | A revisão final compara os dois módulo a módulo; toda divergência de forma cita o FR ou D-N que a justifica |
| **Repetir a omissão de contrato-sem-guarda de `006`** | Contrato escrito e operação nunca coberta pelo portão espelho | Acrescentar os dois contratos a `CONTRACT_SOURCES` de `contract-coverage.spec.ts` na mesma tarefa que os cria |
| **Fechamento de Problema sem prova real (D-7)** | É exatamente a classe de defeito que F-27 já nomeou — uma alegação sem verificação por trás | A verificação de `Action COMPLETED` é reexecutada a cada tentativa de transição (invariant P2), nunca cacheada num campo |

---

## Phase 0 — Research

Concluída: [research.md](./research.md). D-1 a D-12, cada uma com alternativa rejeitada. D-13 a
D-15 registram as três decisões do coordenador (Q1-Q3), com razão anexada.

## Phase 1 — Design & Contracts

Concluída: [data-model.md](./data-model.md), [contracts/](./contracts/). `data-model.md` §6 modela
`problem_incident_links` (N:M, propriedade de Problemas, D-14) e registra explicitamente a ausência
de qualquer acoplamento entre os dois fechamentos (D-15).

## Phase 2 — Tasks

[tasks.md](./tasks.md). Organizada por user story (US1-US5), incluindo o vínculo Incidente↔Problema
em US3 — nenhuma tarefa permanece bloqueada.
