# Implementation Plan: Fundação GRC Compartilhada

**Branch**: `002-shared-grc-foundation` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-shared-grc-foundation/spec.md`

---

## Summary

Criar a camada `grc/` decidida em ADR-016 com três capacidades — Evidência, Ação e Achado —
consumíveis por qualquer domínio GRC futuro sem que nenhum seja seu dono. `Control` não entra
(ADR-016 o manteve como domínio de negócio).

Abordagem técnica: entidades próprias em `apps/api/src/grc/<capacidade>/` seguindo a mesma
estrutura em camadas de `core/` e `modules/`, com fronteiras já aplicadas por lint. Referência ao
sujeito/origem por **registro de tipo fechado** sem chave estrangeira (R-001), que é o único
mecanismo compatível com a proibição de `grc → modules`. Escrita dupla temporária no módulo de
Riscos para dar à Ação um consumidor real sem migração destrutiva (R-003).

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node 24

**Primary Dependencies**: NestJS 11, Prisma 6.19.3, Next.js 15 (App Router), React 19,
Tailwind CSS 4, shadcn/ui sobre Radix, TanStack Table 8

**Storage**: PostgreSQL 18, dois papéis de banco (`pharos_owner` para migrações, `pharos_app`
restrito) conforme ADR-005

**Testing**: Vitest (unit, contract, integration), Playwright + `@axe-core/playwright` (E2E e
acessibilidade)

**Target Platform**: servidor Linux em contêiner; navegadores modernos

**Project Type**: monólito modular em monorepo pnpm — API NestJS + web Next.js

**Performance Goals**: as consultas de valor de SC-010 respondidas por índice, sem varredura
completa; listas paginadas na convenção existente

**Constraints**: sem GraphQL; sem motor de workflow; sem tabela genérica de relacionamento; sem
infraestrutura assíncrona nova (ADR-015 permanece); nenhuma mudança de contrato REST existente

**Scale/Scope**: três entidades, uma tabela de vínculo, três conjuntos de permissões, uma tela
web nova, integração aditiva com um módulo existente

---

## Constitution Check

*GATE: avaliado antes da Fase 0 e reavaliado após a Fase 1.*

| Princípio | Avaliação | Situação |
|---|---|---|
| I — Integridade do domínio GRC | Relacionamentos explícitos; registro de tipo fechado é capacidade transversal, não relacionamento de domínio (ADR-018) | **PASSA** |
| II — Segurança por padrão | Permissão obrigatória por rota; escopo obrigatório sem valor padrão; negação auditada | **PASSA** |
| III — Identidade, acesso e segregação de funções | Encerramento de achado exige ator distinto de quem remediou, pela infraestrutura existente | **PASSA** |
| IV — Auditabilidade | Eventos semânticos nomeados pela intenção; ator, momento, contexto, escopo, antes/depois | **PASSA** |
| V — Integridade e governança de dados | Sem exclusão física; arquivamento com atribuição; vínculos preservados | **PASSA** |
| VI — Integridade da gestão de riscos | Comportamento do módulo inalterado; escrita aditiva | **PASSA** |
| VII — Workflow e responsabilidade | Reutiliza aprovação existente; nenhum motor novo | **PASSA** |
| VIII — Qualidade de código e arquitetura | Camada `grc/` com fronteira aplicada por lint e já verificada nas quatro direções | **PASSA** |
| IX — Testes | Cobertura de contrato obrigatória para todo endpoint (D-11) | **PASSA** |
| X — Consistência de UX | Sem entrada nova na navegação além de "Minhas ações"; Design System e pt-BR preservados | **PASSA** |
| XIII — API e integração | REST/OpenAPI, versionamento, `problem+json`, paginação por convenção existente | **PASSA** |
| XIV — Documentação e decisões | ADR-016/017/018/020 já aceitas; esta fase não cria decisão nova | **PASSA** |
| XV — Mudança e compatibilidade | Nenhuma quebra; convergência declarada e datada | **PASSA com dívida declarada** |

**Ponto de atenção registrado, não violação**: R-003 cria, durante a janela de convergência, duas
representações do mesmo trabalho de tratamento de risco. É temporário, declarado, e tem
pré-requisito datado (a convergência precede a fase de Incidentes). Se a convergência não ocorrer
antes daquela fase, isto deixa de ser dívida e passa a ser violação do FR-019 — e a decisão precisa
ser revista, não repetida.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-shared-grc-foundation/
├── plan.md              # este arquivo
├── spec.md
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   └── grc-foundation.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2, criado por /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/src/
├── core/                      # inalterado
├── grc/                       # NOVO — camada do núcleo GRC (ADR-016)
│   ├── evidence/
│   │   ├── domain/            # entidade, portas, enums, invariantes
│   │   ├── application/       # casos de uso
│   │   ├── infrastructure/    # repositórios Prisma
│   │   └── presentation/      # controllers, DTOs, mappers
│   ├── action/
│   │   └── …                  # mesma estrutura
│   ├── finding/
│   │   └── …                  # mesma estrutura
│   └── shared/                # serviço de vencimento (R-006), tipos de sujeito
├── modules/risk/              # alteração ADITIVA apenas
└── permission-catalogue.ts    # +3 conjuntos de permissões

apps/api/prisma/
├── schema.prisma              # +4 modelos, +6 enums
└── migrations/                # aditivas

apps/api/test/
├── unit/  ├── contract/  └── integration/

apps/web/src/
├── app/(app)/actions/         # NOVA tela "Minhas ações"
├── features/evidence/         # componentes consumidos pelos domínios
├── features/findings/
└── lib/messages/              # +evidence.ts, action.ts, findings.ts
```

**Structure Decision**: `grc/` é elemento novo de primeira classe em `apps/api/src/`, irmão de
`core/` e `modules/`, com as quatro políticas de fronteira já adicionadas ao
`apps/api/eslint.config.mjs` e verificadas nas quatro direções. Cada capacidade replica a
estrutura em camadas usada em todo o projeto, com importação apontando para dentro.

---

## Phase 0 — Research

Concluída. Ver [research.md](./research.md), dez decisões: R-001 (referência por registro de tipo
fechado), R-002 (limite honesto da prova de ADR-020), R-003 (convergência com Riscos),
R-004 (escopo), R-005 (severidade × prioridade), R-006 (regra única de vencimento),
R-007 (histórico sem motor temporal), R-008 (códigos legíveis), R-009 (superfície de interface),
R-010 (reuso de evidência sem escalonamento de acesso).

Nenhum `NEEDS CLARIFICATION` restante.

---

## Phase 1 — Design & Contracts

Concluída. Artefatos:

- [data-model.md](./data-model.md) — entidades, enums, invariantes, transições, índices
- [contracts/grc-foundation.openapi.yaml](./contracts/grc-foundation.openapi.yaml) — superfície REST
- [quickstart.md](./quickstart.md) — roteiro de validação executável

**Reavaliação do Constitution Check após o desenho**: sem mudança. Nenhum princípio passou a ser
violado pelo desenho; a única dívida é a declarada em XV, com dono e prazo.

---

## Complexity Tracking

| Violação | Por que é necessária | Alternativa simples rejeitada porque |
|---|---|---|
| Referência ao sujeito sem chave estrangeira | `grc` não pode importar `modules` (ADR-016), e uma coluna não referencia várias tabelas | FK real é impossível aqui; tabela por par é combinatória e obrigaria `grc` a conhecer cada módulo; tabela genérica é proibida (ADR-008/020) |
| Escrita dupla temporária no tratamento de risco | Dar à Ação um consumidor real sem migração destrutiva num módulo em uso | Migrar agora seria destrutivo; não integrar Risco criaria os dois conceitos concorrentes que FR-019 proíbe |
