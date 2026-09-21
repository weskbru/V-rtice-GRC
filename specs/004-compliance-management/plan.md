# Implementation Plan: Compliance

**Branch**: `main` (trunk-based, ver §17 do CLAUDE.md) | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/004-compliance-management/spec.md`

## Summary

Mapear normas a controles sem duplicar controles por norma (ADR-017): `Framework` versionado por
`FrameworkVersion`, cada uma com suas `Requirement` (cláusulas) imutáveis após publicação;
`RequirementControlLink` N:M explícita entre cláusula e controle; migração de mapeamento entre
versões como operação de primeira classe onde o gestor decide a correspondência e o sistema só
copia e registra (research.md D-6); estado de conformidade **calculado**, nunca armazenado, por um
único serviço de domínio (research.md D-8), lido através de dois portes de `shared/grc-ports/` que
tornam Compliance o segundo consumidor real de ADR-020, na mesma direção que Controles já
consome — sem que `modules/compliance` importe `modules/controls` em nenhum caminho.

Todas as decisões de desenho estão em [research.md](./research.md); a forma persistida está em
[data-model.md](./data-model.md). Este plano não as repete — descreve como serão construídas.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 24

**Primary Dependencies**: NestJS 11 (API), Prisma 6.19 (persistência), Next.js 15 + React 19
(web), Tailwind 4 + shadcn/ui via `@pharos/design-system`

**Storage**: PostgreSQL 18; dois papéis de banco (ADR-005) — `pharos_owner` migra, `pharos_app`
opera

**Testing**: Vitest (unit / contract / integration), Playwright + `@axe-core/playwright` (E2E e
acessibilidade)

**Target Platform**: servidor Linux em contêiner; navegadores modernos

**Project Type**: monorepo pnpm — `apps/api`, `apps/web`, `packages/design-system`,
`packages/api-types`

**Performance Goals**: estado de conformidade de uma versão com 500 cláusulas apresentado em menos
de 2 s (SC-008) — via cálculo em memória sobre chamadas em lote aos portes de leitura de Controles
(research.md D-10), não via expressão SQL replicada.

**Constraints**: nenhuma tabela existente de Risco ou Controle muda de forma; nenhum teste desses
dois módulos pode mudar (SC-006); nenhum import entre `modules/compliance` e `modules/controls` ou
`modules/risk`, em nenhuma direção (SC-007); toda dependência em Controles atravessa porta
declarada em `shared/grc-ports/` (FR-024).

**Scale/Scope**: 3 histórias de usuário, 25 requisitos funcionais, 8 critérios de sucesso.

## Constitution Check

*GATE: aprovado antes da Fase 0 e reavaliado após a Fase 1.*

| Princípio | Como esta fase o satisfaz |
|---|---|
| I. GRC Domain Integrity | `Requirement` e `Control` permanecem entidades distintas (ADR-017); nenhum controle é duplicado por norma (SC-001); relações declaradas explicitamente (research.md D-1), inclusive as sete que não existem. |
| Segurança por padrão | Permissões próprias declaradas estaticamente (research.md D-13); escrita de `RequirementControlLink` verifica escopo do controle referenciado antes de gravar (FR-022); fora de escopo responde como inexistente. |
| Auditabilidade | Sete tipos de evento de auditoria próprios, um por intenção de negócio (FR-025, data-model.md §9); migração de mapeamento auditada como um único evento (SC-004); mudança de estado de conformidade auditada com anterior/posterior (FR-021, research.md D-11). |
| Histórico preservado | Cláusula publicada é imutável, garantido também por trigger de banco (research.md D-4); vínculo e declaração de aplicabilidade desfeitos preservam a linha (FR-011); versão nova nunca invalida a anterior (FR-006). |
| Sem abstrações prematuras | Nenhum motor de correspondência automática entre cláusulas (research.md D-6); nenhuma tabela de transições para um ciclo de vida de duas arestas (research.md D-3); nenhum gêmeo SQL onde a escala não o exige (research.md D-10). |
| X. Consistência de UX (pt-BR) | Toda string nova nos catálogos centralizados; Design System estendido, não substituído (§18.12); "Requisito" e "Controle" usados exatamente como termos GRC distintos (ADR-017). |

**Nenhuma violação.** Nenhuma exceção a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/004-compliance-management/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
└── contracts/
    └── compliance.openapi.yaml
```

### Source (repository)

```text
apps/api/src/
├── grc/shared/domain/entity-code.service.ts   ALTERADO — EntityCodePrefix += 'FMK' (research.md D-14)
├── shared/grc-ports/
│   └── control-effectiveness.port.ts          NOVO — ADR-020 parte 3 (research.md D-9)
├── modules/compliance/                        NOVO módulo
│   ├── domain/
│   │   ├── framework.entity.ts
│   │   ├── framework-version-lifecycle.ts
│   │   ├── requirement.entity.ts
│   │   ├── requirement-compliance.service.ts        calculador único (research.md D-8)
│   │   ├── requirement-control-mapping-migration.entity.ts
│   │   ├── compliance-audit-allowlist.ts
│   │   └── ports/
│   ├── application/
│   ├── infrastructure/
│   │   └── (repositórios escopados só onde §12 exige — RequirementControlLink)
│   ├── presentation/
│   └── compliance.module.ts
└── modules/controls/
    └── infrastructure/control-effectiveness.adapter.ts   NOVO — fornece o porte acima

apps/web/src/
├── features/compliance/
│   ├── api.ts, types.ts, compliance-state.ts (rótulos e cores do estado derivado)
│   └── components/
└── lib/messages/compliance.ts             NOVO catálogo pt-BR
```

## Superfície de API (contrato)

23 operações, todas sob `compliance:*` e, para o vínculo com Controle, escopo organizacional do
lado do controle referenciado (research.md D-2):

| # | Operação | Verbo/rota |
|---|---|---|
| 1 | Listar frameworks | `GET /frameworks` |
| 2 | Cadastrar framework | `POST /frameworks` |
| 3 | Ler framework | `GET /frameworks/{frameworkId}` |
| 4 | Editar framework | `PATCH /frameworks/{frameworkId}` |
| 5 | Listar versões de um framework | `GET /frameworks/{frameworkId}/versions` |
| 6 | Criar versão (nasce em rascunho) | `POST /frameworks/{frameworkId}/versions` |
| 7 | Ler versão | `GET /frameworks/{frameworkId}/versions/{versionId}` |
| 8 | Editar versão (só em rascunho) | `PATCH /frameworks/{frameworkId}/versions/{versionId}` |
| 9 | Publicar versão | `POST /frameworks/{frameworkId}/versions/{versionId}/publish` |
| 10 | Listar cláusulas de uma versão | `GET /frameworks/{frameworkId}/versions/{versionId}/requirements` |
| 11 | Cadastrar cláusula (só em rascunho) | `POST /frameworks/{frameworkId}/versions/{versionId}/requirements` |
| 12 | Ler cláusula | `GET /requirements/{requirementId}` |
| 13 | Editar cláusula (só em rascunho) | `PATCH /requirements/{requirementId}` |
| 14 | Listar controles vinculados à cláusula | `GET /requirements/{requirementId}/controls` |
| 15 | Vincular controle à cláusula | `POST /requirements/{requirementId}/controls` |
| 16 | Desvincular controle da cláusula | `DELETE /requirements/{requirementId}/controls/{linkId}` |
| 17 | Listar declarações de aplicabilidade da cláusula | `GET /requirements/{requirementId}/applicability-declarations` |
| 18 | Declarar cláusula não aplicável | `POST /requirements/{requirementId}/applicability-declarations` |
| 19 | Reverter declaração (volta a aplicável) | `DELETE /requirements/{requirementId}/applicability-declarations/{declarationId}` |
| 20 | Ler o resumo de conformidade da versão | `GET /frameworks/{frameworkId}/versions/{versionId}/compliance-summary` |
| 21 | Executar migração de mapeamento entre versões | `POST /frameworks/{frameworkId}/versions/{versionId}/mapping-migrations` |
| 22 | Listar migrações executadas nesta versão | `GET /frameworks/{frameworkId}/versions/{versionId}/mapping-migrations` |
| 23 | Ler o detalhe de uma migração | `GET /frameworks/{frameworkId}/versions/{versionId}/mapping-migrations/{migrationId}` |

`400` = forma da requisição; `422` = regra de negócio; `404` = inexistente **ou** fora de escopo,
indistinguíveis; `409` onde há concorrência otimista (operações 4, 8, 9, 13) ou conflito de estado
já decidido (16, 19). RFC 9457 em todas as falhas.

`complianceState` é `readOnly` em todo schema que o expõe (operações 10, 12, 20) e não é aceito por
nenhum corpo de requisição desta API (research.md D-8, FR-017).

## Fases de execução

**Fase A — biblioteca normativa (backend).** Migração aditiva; `EntityCodePrefix` += `FMK`;
enums; `Framework`/`FrameworkVersion`/`Requirement`; trigger de imutabilidade pós-publicação
(research.md D-4); permissões e papel semeado; módulo Nest.

**Fase B — mapeamento e migração (backend).** `RequirementControlLink` com verificação de escopo
via `ControlDirectoryPort` antes de gravar; `RequirementControlMappingMigration`/`...Item`
executando a lógica de correspondência humana (research.md D-6); tipos de auditoria próprios.

**Fase C — aplicabilidade e estado de conformidade (backend).** `RequirementApplicabilityDeclaration`;
`ControlEffectivenessPort` novo (research.md D-9) e seu adaptador do lado de Controles;
`RequirementComplianceService` (calculador único, research.md D-8); `RequirementComplianceAuditMark`
e a auditoria por comparação na leitura (research.md D-11); resumo de versão.

**Fase D — interface.** Biblioteca normativa (frameworks, versões, cláusulas), tela de mapeamento
cláusula↔controle, tela de migração de mapeamento (a decisão de correspondência é do humano — a
interface precisa apresentá-la como decisão explícita, não como sugestão pré-marcada), declaração
de aplicabilidade, e o resumo de conformidade da versão — herdando os padrões de tabela/formulário
já estabelecidos por Riscos e Controles (§18.12 proíbe linguagem visual própria por módulo).
Verificação renderizada obrigatória (§18.1).

**Fase E — validação.** Contrato das 23 operações; teste de fronteira de módulo (nenhum import
`modules/compliance` <-> `modules/controls`/`modules/risk`, SC-007); teste de paridade do
vocabulário de efetividade entre `ControlEffectivenessLevel` (porte) e `ControlEffectiveness`
(domínio de Controles, research.md D-9); teste de concorrência da marca d'água de auditoria
(research.md D-11); E2E do caminho completo (biblioteca → mapeamento → migração → estado);
acessibilidade nas telas novas; regressão de Risco e Controles sem alteração de teste (SC-006).

As fases A–C são backend e majoritariamente sequenciais por dependência de esquema (B depende de A
existir; C depende de B para ter vínculos a calcular sobre); D depende de A–C; E fecha. A
paralelização real está **dentro** de cada fase.

## Riscos conhecidos e como são endereçados

| Risco | Endereçamento |
|---|---|
| `ControlEffectivenessLevel` (porte) divergir de `ControlEffectiveness` (domínio de Controles) | Teste de paridade de valores entre os dois vocabulários, o mesmo padrão de `control-effectiveness-parity.spec.ts` da Fase 2 aplicado a esta nova costura (research.md D-9). |
| Migração de mapeamento sobrescrever decisão já tomada na versão de destino | `SKIPPED_ALREADY_MAPPED` verificado antes de qualquer escrita, por requisito de destino, independente do corpo da requisição (research.md D-6, FR-014) — teste que tenta forçar a sobrescrita e confirma a recusa. |
| Marca d'água de auditoria (§7 do data-model) virar, na prática, uma segunda fonte de verdade do estado | Nenhuma rota de leitura desta API a consulta; só o próprio comparador a lê, e só para decidir se audita (research.md D-11) — teste que comprova que uma leitura nunca responde com o valor da marca quando ele diverge do cálculo fresco. |
| Duas leituras concorrentes do mesmo requisito duplicarem o evento de mudança de estado | `UPDATE ... WHERE last_audited_state IS DISTINCT FROM $novo`, condicional — teste de concorrência com duas transações simultâneas confirmando um único evento (research.md D-11). |
| Trigger de imutabilidade da cláusula publicada divergir da checagem de aplicação | Teste de integração que tenta a escrita direta via SQL bruto contra `requirements` de uma versão publicada, sem passar pelo caso de uso — só a trigger pode pegar esse caminho (research.md D-4). |
| Estado de conformidade inalcançável por alguma combinação de entrada | Cada um dos cinco estados tem cenário de aceitação próprio em `spec.md` (US3) e teste que o exercita — a mesma disciplina que o `/speckit.analyze` já cobrou de `FindingStatus` (Fase 1) e do ciclo de vida de `Control` (Fase 2, research.md D-8). |
| Teste de Risco ou de Controles precisar mudar | Tratado como regressão a investigar, não como ajuste (SC-006). |
