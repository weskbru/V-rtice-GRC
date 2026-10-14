# Implementation Plan: Gestão de Ativos e Gestão de Processos

**Branch**: `006-assets-processes` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-assets-processes/spec.md`

---

## Summary

Promove `Asset` e `Process` — hoje duas tabelas mínimas, sem dono, lidas diretamente por dois
módulos — a domínios de negócio próprios, simétricos, com módulo, contrato REST, autoridade
própria, escopo organizacional aplicado e trilha de auditoria.

No caminho, fecha **dois vazamentos de escopo medidos e abertos** que só se tornam corrigíveis
quando os dois conceitos passam a ter dono: a listagem que hoje devolve o inventário inteiro da
organização a qualquer portador de `risk:view`, e os dois casos de uso de vínculo de risco que
gravam contra um alvo sem verificar a unidade organizacional dele.

Não inventa taxonomia, não cria conceito paralelo, e não recria nenhum dos quatro vínculos que já
existem — reusa todos.

---

## Technical Context

**Language/Version**: TypeScript 5.x · Node 22

**Primary Dependencies**: NestJS 11 (API), Next.js 15 App Router (web), Prisma 6 (persistência),
Vitest (unit/contract/integration), Playwright + `@axe-core/playwright` (E2E e acessibilidade).
**Nenhuma dependência nova** — esta fase não introduz biblioteca alguma.

**Storage**: PostgreSQL 18. Tabelas `assets` e `processes` **já existem**; a migração desta fase é
aditiva (dois valores de enum de auditoria) e não altera forma, nulidade ou tipo de nenhuma coluna
existente.

**Testing**: `test:unit`, `test:contract`, `test:integration` (API); `test:unit` (web);
`test:e2e` (Playwright). Linha de base a preservar, medida em `64479c9`:
`API unit 444 · contrato 577 · integração 168 · web unit 463`.

**Target Platform**: aplicação web corporativa; API em 3001, web em 3000, ambos servindo **build de
produção** localmente (não `dev --watch`) — reconstruir e reiniciar antes de qualquer verificação
renderizada.

**Project Type**: monorepo web — `apps/api` (NestJS) + `apps/web` (Next.js) +
`packages/design-system`.

**Performance Goals**: nenhuma meta nova. As duas listagens passam a aplicar um predicado de escopo
(`orgUnitId IN (...)`), que estreita o conjunto — não amplia o custo.

**Constraints**: interface em pt-BR nos catálogos centralizados (§11.1); nenhuma exclusão de
registro (FR-012); os quatro vínculos existentes são reusados, nunca recriados (FR-013); os
consumidores atuais das duas listagens não podem quebrar (FR-014).

**Scale/Scope**: dois domínios simétricos; ~14 operações REST; 2 catálogos + 2 detalhes + 2
formulários na interface; 8 permissões novas; 2 tipos de auditoria novos; 2 prefixos de código
novos; 2 portes compartilhados novos.

---

## Constitution Check

*GATE: deve passar antes da Fase 0 e ser reavaliado após a Fase 1.*

| Princípio | Avaliação | Evidência |
|---|---|---|
| **I. GRC Domain Integrity** | **Passa, e é o motivo da fase.** O estado atual VIOLA este princípio: duas infraestruturas alcançam as tabelas de outro domínio diretamente. D-6 substitui as duas por portes declarados. Nenhuma entidade genérica, nenhum blob | research.md D-1, D-6 |
| **II. Security by Design** | **Passa.** Dois vazamentos de escopo são fechados **nesta** fase, não retrofitados depois — e a correção é pré-condicionada pela promoção, não adiável | spec §"Dois vazamentos", research.md D-9 |
| **III. Identity, Access Control, SoD** | **Passa.** Autoridade própria por recurso (D-7), escopo organizacional em toda leitura e escrita, autoridade exigida dos dois lados no vínculo. Corrige o acoplamento atual a `risk:view` | D-7, FR-009, FR-011 |
| **IV. Auditability and Traceability** | **Passa.** Criar, editar, desativar e reativar auditados, com valores anteriores e posteriores; recusa por escopo sobre registro existente também auditada | FR-015, FR-016, D-8 |
| **V. Data Integrity and Governance** | **Passa.** Nenhuma exclusão; desativação preserva o registro e os vínculos; migração aditiva verificada contra o banco real | FR-012, tasks de migração |
| **VI. Risk Management Integrity** | **Passa.** Nenhuma regra de risco muda. Os vínculos existentes são reusados; a única mudança do lado de Riscos é passar a verificar o escopo do alvo — endurecimento | FR-011, FR-013 |
| **VII. Workflow and Accountability** | **Passa.** Duas transições (desativar/reativar), ambas com autor e data. Nenhum motor de workflow | D-3, FR-005 |
| **VIII. Code Quality and Architecture** | **Passa.** Segue a forma dos módulos existentes; nenhuma abstração nova além dos dois portes que o Princípio I exige | D-1, D-6 |
| **IX. Testing Standards** | **Passa.** Cobertura de contrato para toda operação nova; guardas estruturais para ausência de exclusão, ausência de leitura direta e presença da verificação de escopo | SC-003 a SC-006 |
| **X. User Experience Consistency** | **Passa.** Interface em pt-BR nos catálogos centralizados; estende os padrões de Controles/Conformidade; três estados distinguíveis; ativo/inativo por mais que cor | FR-017 a FR-019 |
| **XI. Performance and Scalability** | **Passa.** Índices já existentes; o predicado de escopo estreita o conjunto | — |
| **XII. Observability** | **Passa.** Sem caminho de log novo; erros opacos por padrão, como já é regra | AGENTS.md |
| **XIII. API and Integration Standards** | **Passa.** REST, contrato OpenAPI escrito à mão, entrando no portão espelho `contract-coverage.spec.ts` **na mesma tarefa** que o cria — a omissão que deixou a fase anterior com duas operações contratadas e nunca construídas | tasks de contrato |
| **XIV. Documentation and ADRs** | **Passa.** research.md registra cada decisão com alternativa rejeitada. Nenhuma ADR nova é necessária: ADR-008 (enums fechados), ADR-011 (fronteira de módulo) e ADR-020 (vínculos) já cobrem, e esta fase as aplica em vez de as reabrir | research.md |
| **XV. Change Management / Backward Compat** | **Atenção, e é a única linha desta tabela que exige vigilância.** Duas mudanças observáveis: o caminho HTTP das listagens fica igual mas a **autoridade** muda (`risk:view` → `asset:view`), e o **escopo** passa a ser aplicado. A segunda é uma correção de segurança e vai reduzir o que alguns atores veem — deliberadamente. A primeira exige semear a autoridade nova nos papéis que hoje dependem de `risk:view`, ou usuários perdem acesso | A-6, D-7, FR-014 |
| **XVI. Compliance-Oriented Engineering** | **Passa.** Inventário de ativos e catálogo de processos são pré-condição de várias normas; a fase os torna mantíveis pelo produto em vez de por inserção manual | US1 |

**Resultado do portão**: passa. Nenhuma violação exige justificativa na tabela de Complexity
Tracking — que por isso fica vazia e é removida abaixo, em vez de mantida como "N/A".

**Reavaliação pós-Fase 1**: os artefatos de desenho (data-model, contratos, quickstart) não
introduziram nenhuma entidade, permissão ou dependência além das já avaliadas acima. O portão
permanece passando, com a mesma linha de atenção em XV.

---

## Project Structure

### Documentation (this feature)

```text
specs/006-assets-processes/
├── spec.md              # o quê e por quê
├── plan.md              # este arquivo
├── research.md          # D-1 a D-11, decisões com alternativas rejeitadas
├── data-model.md        # entidades, migração, invariantes
├── quickstart.md        # roteiro executável de validação
├── checklists/
│   └── requirements.md  # portão de qualidade da especificação
├── contracts/
│   ├── assets.openapi.yaml
│   └── processes.openapi.yaml
└── tasks.md             # gerado por /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/src/
├── modules/
│   ├── assets/                      # NOVO — domínio Ativo
│   │   ├── domain/                  # entidade, permissões, portes de repositório
│   │   ├── application/             # casos de uso (list, get, create, update, activate/deactivate)
│   │   ├── infrastructure/          # repositório escopado, adaptador do porte de diretório
│   │   └── presentation/            # controller + DTOs + mappers
│   ├── processes/                   # NOVO — idêntico em forma (FR-020)
│   ├── risk/                        # ALTERADO — consome os portes; verifica escopo do alvo
│   └── controls/                    # ALTERADO — consome o porte; remove a leitura direta
├── shared/grc-ports/
│   ├── asset-directory.port.ts      # NOVO
│   └── process-directory.port.ts    # NOVO
└── grc/shared/domain/
    └── entity-code.service.ts       # ALTERADO — prefixos 'AST' e 'PRC'

apps/api/prisma/
├── migrations/                      # ADITIVA — dois valores de AuditEntityType
└── seed/platform.seed.ts            # ALTERADO — permissões novas; unidade nas fixtures

apps/web/src/
├── app/(app)/assets/                # NOVO — catálogo, novo, detalhe
├── app/(app)/processes/             # NOVO — idem
├── features/assets/                 # NOVO — types, api, componentes
├── features/processes/              # NOVO — idem
├── lib/messages/assets.ts           # NOVO — catálogo pt-BR
├── lib/messages/processes.ts        # NOVO — idem
└── components/shell/navigation-registry.ts   # ALTERADO — duas entradas deixam de ser planejadas
```

**Structure Decision**: monorepo existente, sem estrutura nova. Dois módulos de negócio novos em
`apps/api/src/modules/`, espelhando a forma interna de `modules/controls` (domain / application /
infrastructure / presentation), e duas features novas em `apps/web/src/features/`, espelhando
`features/controls`. Os dois portes compartilhados vão para `shared/grc-ports/`, junto dos quatro
que já existem — é onde `ControlDirectoryPort` e `RiskDirectoryPort` vivem, e a razão é a mesma
(ADR-011: `shared/**` não importa de `core/**` nem de `modules/**`).

---

## Riscos desta fase, e o que cada um exige

| Risco | Por que é real aqui | Mitigação exigida |
|---|---|---|
| **Perda de acesso silenciosa** | A autoridade das listagens muda de `risk:view` para `asset:view`. Um papel semeado que não receber a permissão nova perde o inventário sem erro visível — só um seletor vazio | Semear as permissões novas nos papéis que hoje dependem de `risk:view`, **e** estender a guarda estrutural nascida da fase anterior (`audit-engagement-write-implies-read.spec.ts`) para cobrir estes dois recursos |
| **Fixtures invisíveis** | Aplicar escopo torna as duas linhas de fixture (`orgUnitId` nulo) invisíveis a atores escopados. Testes que dependem de vê-las quebram | Atribuir unidade organizacional às fixtures na semeadura, na mesma tarefa que aplica o escopo — não depois |
| **Repetir a omissão da fase anterior** | Contrato escrito e operação nunca construída, com a CI verde, porque o portão espelho não olhava para o contrato novo | Acrescentar os dois contratos a `CONTRACT_SOURCES` de `contract-coverage.spec.ts` **na mesma tarefa** que os cria, nunca "depois" |
| **Corrigir um irmão e deixar os outros** | É literalmente o que F-46 fez: fechou Risco→Controle e deixou Risco→Ativo e Risco→Processo | A guarda de regressão da correção de escopo é **estrutural** e cobre todo caso de uso de vínculo, não as duas instâncias relatadas |
| **Assimetria entre Ativo e Processo** | Dois módulos escritos em paralelo divergem por acidente | FR-020 é requisito; a revisão final compara os dois arquivo a arquivo, e qualquer divergência precisa de justificativa escrita |

---

## Phase 0 — Research

Concluída: [research.md](./research.md). D-1 a D-11, cada uma com alternativa rejeitada e a razão.
Nenhum `NEEDS CLARIFICATION` restou — as três decisões genuinamente abertas (obrigatoriedade de
`orgUnitId`, ciclo de vida, propriedade das listagens) foram resolvidas por medição mais precedente
registrado no repositório, e uma delas **rejeitou** a assumption original da especificação, que
ficou preservada em D-2 para não ser reintroduzida.

## Phase 1 — Design & Contracts

Concluída: [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Phase 2 — Tasks

Gerada por `/speckit-tasks` em [tasks.md](./tasks.md).
