# Implementation Plan: Auditoria e Achados

**Branch**: `main` (trunk-based, ver §17 do CLAUDE.md) | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/005-audit-findings/spec.md`

## Summary

Fecha o ciclo requisito → controle → evidência → achado → ação (ADR-016, ADR-017, ADR-020):
`AuditEngagement`, um domínio de negócio novo (`modules/audit-engagements/`, nomeado para não
colidir com `core/audit/`, a trilha — research.md D-15), cujo escopo referencia
`FrameworkVersion`/`Requirement`/`Control` por FK direta e imutável, o que já basta para sobreviver
a uma revisão da norma (research.md D-2). `Finding` **não é criado aqui** — já existe desde a Fase
1 (ADR-016) — e ganha, nesta fase: um produtor não-manual (`POST /audits/{id}/findings`), a
operação que faltava para tornar alcançável a aresta `OPEN → IN_REMEDIATION` já declarada desde a
Fase 1 (research.md D-10), as duas relações que a Fase 1 deliberadamente adiou
(`FindingControlLink`, `FindingRiskLink` — research.md D-4), e uma invariante nova de fechamento:
evidência passa a ser exigida, aditivamente sobre a regra já existente (research.md D-6).

Este é o quinto módulo a exercitar o padrão ADR-020, e o primeiro a aplicar as cinco partes desde o
primeiro vínculo em vez de descobri-las por correção posterior — as partes 4 e 5 só ficaram
genuinamente fechadas para os pares anteriores depois de dois incidentes de segurança relatados na
própria ADR (2026-09-08). Todas as decisões de desenho estão em [research.md](./research.md); a
forma persistida está em [data-model.md](./data-model.md). Este plano não as repete — descreve como
serão construídas.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 24

**Primary Dependencies**: NestJS 11 (API), Prisma 6.19 (persistência), Next.js 15 + React 19 (web),
Tailwind 4 + shadcn/ui via `@vertice/design-system`

**Storage**: PostgreSQL 18; dois papéis de banco (ADR-005) — `vertice_owner` migra, `vertice_app`
opera

**Testing**: Vitest (unit / contract / integration), Playwright + `@axe-core/playwright` (E2E e
acessibilidade)

**Target Platform**: servidor Linux em contêiner; navegadores modernos

**Project Type**: monorepo pnpm — `apps/api`, `apps/web`, `packages/design-system`,
`packages/api-types`

**Performance Goals**: nenhum requisito de escala distinto de Riscos/Controles/Compliance — volume
de engajamentos e achados por unidade organizacional, não por milhares de linhas por operação como
o resumo de conformidade da Fase 3.

**Constraints**: nenhuma tabela existente de Risco, Controle ou Compliance muda de forma, exceto a
adição aditiva de `audit_engagement_id` a `findings` (SC-007, data-model.md §7); nenhum teste
desses três módulos pode mudar (SC-007); nenhum import entre `modules/audit-engagements` e
`modules/risk`/`modules/controls`/`modules/compliance`, em nenhuma direção (SC-008); toda
dependência cruzada atravessa porta declarada em `shared/grc-ports/` (FR-017); `grc/finding` pode
importar `grc/evidence` diretamente (mesmo bucket de fronteira `grc/**`, sem regra de lint entre
capacidades do núcleo).

**Scale/Scope**: 3 histórias de usuário, 20 requisitos funcionais, 8 critérios de sucesso.

## Constitution Check

*GATE: aprovado antes da Fase 0 e reavaliado após a Fase 1.*

| Princípio | Como esta fase o satisfaz |
|---|---|
| I. GRC Domain Integrity | `AuditEngagement` é domínio de negócio novo, com sua própria porta de dependência para Compliance e Controles (research.md D-11); `Finding` permanece núcleo GRC compartilhado (ADR-016), estendido — não recriado — pelas duas relações que a Fase 1 adiou (research.md D-4). Relações declaradas explicitamente para os nove domínios de §19.2, inclusive os dois "nenhuma" (Ativo, Processo — research.md D-1). |
| Segurança por padrão | Escopo organizacional em toda leitura e escrita de engajamento e vínculo (FR-018); as cinco partes do ADR-020 aplicadas desde o primeiro vínculo, nos cinco pares novos, não descobertas por correção posterior (research.md D-11); permissões próprias declaradas estaticamente, com colisão de nome (`audit:*` já ocupado pela trilha) encontrada e evitada antes de virar código (research.md D-7). |
| Auditabilidade | Seis tipos de entidade de auditoria novos, um por fato de negócio distinto (FR-020, data-model.md §8); nenhum evento genérico de atualização; a segregação de funções do fechamento (já existente desde a Fase 1) passa a ser exercitada pelo produtor real. |
| Histórico preservado | Escopo do engajamento nunca reescrito, mesmo após revisão da norma (FR-006, research.md D-2); desvínculo de `Finding↔Control`/`Finding↔Risk` preserva a linha (FR-016); achado nunca excluído — arquivamento é o único fim (FR-012, SC-005). |
| Sem abstrações prematuras | Nenhuma tabela genérica de relacionamento (§19.3); nenhuma tabela de transição dedicada para um ciclo de vida de duas arestas (research.md D-3); nenhum motor de correspondência ou workflow; nenhuma remoção de vínculo de escopo não pedida por FR (research.md D-12). |
| X. Consistência de UX (pt-BR) | Toda string nova nos catálogos centralizados (`apps/web/src/lib/messages/`, `shared/messages/user-messages.ts`); Design System estendido, não substituído (§18.12); "Engajamento" e "Achado" como termos GRC distintos, nunca confundidos com "auditoria" no sentido de trilha (research.md D-7/D-15). |

**Nenhuma violação.** Nenhuma exceção a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/005-audit-findings/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
└── contracts/
    └── audit.openapi.yaml
```

### Source (repository)

```text
apps/api/src/
├── shared/grc-ports/
│   ├── risk-directory.port.ts                  NOVO — ADR-020 parte 3 (research.md D-4)
│   ├── framework-version-directory.port.ts      NOVO — ADR-020 parte 3 (research.md D-11)
│   ├── requirement-directory.port.ts             NOVO — idem
│   └── finding-reference-read.port.ts            NOMEADO, não construído (research.md D-16)
├── grc/finding/
│   ├── application/
│   │   ├── start-remediation.usecase.ts         NOVO — fecha a aresta OPEN→IN_REMEDIATION (research.md D-10)
│   │   ├── links/link-finding-control.usecase.ts NOVO
│   │   ├── links/unlink-finding-control.usecase.ts NOVO
│   │   ├── links/link-finding-risk.usecase.ts    NOVO
│   │   ├── links/unlink-finding-risk.usecase.ts  NOVO
│   │   └── close-finding.usecase.ts              ALTERADO — Invariante F5 aditiva (research.md D-6)
│   ├── domain/
│   │   ├── finding.entity.ts                     ALTERADO — Invariante F5 (assertFindingHasSupportingEvidence)
│   │   └── finding-permissions.ts                ALTERADO — += finding:remediate, finding:link
│   └── infrastructure/ (repositórios dos dois vínculos novos)
├── grc/evidence/
│   └── domain/ports/evidence-link-repository.port.ts  ALTERADO — += hasActiveLinkForSubject (aditivo)
├── modules/audit-engagements/                    NOVO módulo
│   ├── domain/
│   │   ├── audit-engagement.entity.ts             ciclo de vida (research.md D-3)
│   │   ├── audit-engagement-permissions.ts
│   │   ├── audit-engagement-audit-allowlist.ts
│   │   └── ports/
│   ├── application/
│   │   ├── create-audit-engagement.usecase.ts
│   │   ├── update-audit-engagement.usecase.ts
│   │   ├── scope/link-framework-version.usecase.ts
│   │   ├── scope/link-requirement.usecase.ts
│   │   ├── scope/link-control.usecase.ts
│   │   ├── start-audit-engagement.usecase.ts
│   │   ├── complete-audit-engagement.usecase.ts
│   │   └── create-finding-from-engagement.usecase.ts
│   ├── infrastructure/
│   └── audit-engagements.module.ts
├── modules/risk/infrastructure/risk-directory.adapter.ts          NOVO — fornece o porte acima
└── modules/compliance/infrastructure/
    ├── framework-version-directory.adapter.ts    NOVO
    └── requirement-directory.adapter.ts           NOVO

apps/api/prisma/
├── schema.prisma            ALTERADO — data-model.md §1-§8
├── seed/platform.seed.ts    ALTERADO — permissões + papel Auditor + papel Audit Lead (research.md D-7)
└── migrations/<nova>/       AuditEngagementStatus, AuditEntityType += 6, EntityCodePrefix += 'AUD'

apps/web/src/
├── features/audit-engagements/
│   ├── api.ts, types.ts
│   └── components/ (lista, detalhe, formulário de escopo, ciclo de vida)
├── features/findings/  (existente desde a Fase 1 — se já houver, estendido; se não, criado aqui
│                         para o produtor não-manual, herdando o Design System, nunca linguagem
│                         própria — §18.12)
└── lib/messages/audit-engagements.ts   NOVO catálogo pt-BR
```

## Superfície de API (contrato)

19 operações, `contracts/audit.openapi.yaml`. `400` = forma da requisição; `422` = regra de
negócio; `404` = inexistente **ou** fora de escopo para o RECURSO PRINCIPAL da operação
(`AuditEngagement`, `Finding`), indistinguíveis; para uma entidade REFERENCIADA num corpo de vínculo
(controle, risco, versão de framework, requisito), a mesma indistinguibilidade é expressa como `422`
nomeando o campo — a forma que `modules/compliance`/`modules/risk` já estabelecem para essa
situação exata (ADR-020 parte 4, "existence is not disclosed"); `409` para conflito de concorrência
otimista em `AuditEngagement` (operações 4, 9, 10 — `version`/`ETag`, research.md D-18) e para uma
segunda tentativa de vincular o mesmo alvo de escopo (operações 6-8).

| # | Operação | Verbo/rota |
|---|---|---|
| 1 | Cadastrar engajamento | `POST /audits` |
| 2 | Listar engajamentos | `GET /audits` |
| 3 | Ler engajamento | `GET /audits/{auditId}` |
| 4 | Editar engajamento (só em planejamento) | `PATCH /audits/{auditId}` |
| 5 | Listar o escopo do engajamento | `GET /audits/{auditId}/scope` |
| 6 | Adicionar versão de framework ao escopo | `POST /audits/{auditId}/scope/framework-versions` |
| 7 | Adicionar requisito ao escopo | `POST /audits/{auditId}/scope/requirements` |
| 8 | Adicionar controle ao escopo | `POST /audits/{auditId}/scope/controls` |
| 9 | Iniciar o engajamento | `POST /audits/{auditId}/start` |
| 10 | Concluir o engajamento | `POST /audits/{auditId}/complete` |
| 11 | Listar achados produzidos pelo engajamento | `GET /audits/{auditId}/findings` |
| 12 | Registrar achado a partir do engajamento | `POST /audits/{auditId}/findings` |
| 13 | Mover achado para remediação | `POST /findings/{findingId}/start-remediation` |
| 14 | Listar controles vinculados ao achado | `GET /findings/{findingId}/controls` |
| 15 | Vincular achado a um controle | `POST /findings/{findingId}/controls` |
| 16 | Desvincular achado de um controle | `DELETE /findings/{findingId}/controls/{linkId}` |
| 17 | Listar riscos vinculados ao achado | `GET /findings/{findingId}/risks` |
| 18 | Vincular achado a um risco | `POST /findings/{findingId}/risks` |
| 19 | Desvincular achado de um risco | `DELETE /findings/{findingId}/risks/{linkId}` |

Nenhuma operação exclui um achado, um engajamento ou um vínculo (SC-005) — a lista acima é
exaustiva; `quickstart.md` §7 prova a ausência por grep contra o próprio contrato, não por
confiança na tabela.

Nenhuma leitura desta API expõe estado calculado no momento da leitura — `Cache-Control: no-store`
não se aplica a nenhuma das operações acima porque a condição que o exigiria não ocorre neste módulo
(research.md D-14, data-model.md §11).

## Fases de execução

**Fase A — engajamento e escopo (backend).** Migração aditiva; `AuditEngagementStatus`;
`AuditEngagement`/`AuditScopeFrameworkVersion`/`AuditScopeRequirement`/`AuditScopeControl`;
`FrameworkVersionDirectoryPort`/`RequirementDirectoryPort` novos e seus adaptadores em
`modules/compliance`; `ControlDirectoryPort` reusado sem alteração; permissões
`audit-engagement:*`; módulo Nest `modules/audit-engagements`. Operações 1-10.

**Fase B — o produtor e a aresta fechada (backend).** `audit_engagement_id` em `findings`
(alteração aditiva); `CreateFindingFromEngagementUseCase` (operação 12); `StartRemediationUseCase`
fechando `OPEN → IN_REMEDIATION` (research.md D-10, operação 13) — sem alteração à tabela de
transições, só à falta de operação que a alcançasse; permissão `finding:remediate`. Operação 11
(listagem por engajamento) depende de A e B.

**Fase C — as duas relações adiadas (backend).** `RiskDirectoryPort` novo e seu adaptador em
`modules/risk`; `FindingControlLink`/`FindingRiskLink`; as quatro pré-condições do ADR-020
aplicadas desde a primeira escrita (research.md D-4, D-11) — nunca como correção posterior;
permissão `finding:link`. Operações 14-19.

**Fase D — fechamento exige evidência (backend).** `hasActiveLinkForSubject` aditivo em
`EvidenceLinkRepositoryPort`; Invariante F5 em `finding.entity.ts`; `CloseFindingUseCase` alterado
(research.md D-6). Sem operação de contrato nova — `closeFinding` já existe em
`grc-foundation.openapi.yaml`, fora dos cinco arquivos desta tarefa; a mudança de comportamento é
reportada, não silenciosa (research.md D-6, "consequência aceita").

**Fase E — permissões e papéis semeados.** `finding-permissions.ts` aditivo;
`audit-engagement-permissions.ts` novo; `platform.seed.ts` — papel `Auditor` estendido, papel
`Audit Lead` novo (research.md D-7, data-model.md §10).

**Fase F — interface.** Lista e detalhe de engajamento, formulário de escopo (três variantes,
apresentadas como decisão explícita do auditor — nunca uma sugestão pré-marcada, mesmo espírito da
Fase 3 para migração de mapeamento), ciclo de vida (iniciar/concluir), formulário de achado a
partir de engajamento, ação de mover para remediação, vínculo achado↔controle e achado↔risco —
herdando os padrões de tabela/formulário já estabelecidos (§18.12 proíbe linguagem visual própria
por módulo). Verificação renderizada obrigatória (§18.1).

**Fase G — validação.** Contrato das 19 operações; teste de fronteira de módulo (nenhum import
`modules/audit-engagements` ↔ `modules/risk`/`modules/controls`/`modules/compliance`, SC-008);
teste que exercita `OPEN → IN_REMEDIATION` via a operação real, não a tabela (SC-002); teste que
tenta fechar sem evidência e confirma recusa (SC-003); teste que tenta fechar por quem remediou e
confirma recusa auditada (SC-004); teste "nada é gravado" para alvo fora de escopo, nos cinco pares
novos (SC-006, mesma forma de `risk-control-link.spec.ts`/`requirement-control-link.spec.ts`); grep
estrutural provando ausência de operação de exclusão (SC-005); E2E do caminho completo (engajamento
→ escopo → início → achado → remediação → fechamento com evidência); acessibilidade nas telas
novas; regressão de Risco, Controles e Compliance sem alteração de teste (SC-007).

As fases A-D são backend e majoritariamente sequenciais por dependência de esquema (B depende de A
para ter um engajamento a que se referir; C é independente de B, pode correr em paralelo; D depende
de C só na medida em que ambas tocam `finding.entity.ts`, coordenado por um único agente); E
depende de A-D para conhecer os identificadores de permissão finais; F depende de A-E; G fecha.

## Riscos conhecidos e como são endereçados

| Risco | Endereçamento |
|---|---|
| Colisão de nome entre a permissão nova `audit:*` e a permissão CORE já existente `audit:view` (trilha) | Encontrada em pesquisa, não em produção: recurso renomeado para `audit-engagement:*` antes de qualquer código (research.md D-7). Teste que falharia se um identificador `audit:*` fosse introduzido por engano (verificação de unicidade de `combinePermissionDefinitions`, já existente, cobre isso estruturalmente — colisão de identificador já lança em tempo de import). |
| `Finding.status` fechado sem evidência, quebrando um teste de regressão da Fase 1 que dependia do comportamento antigo | Consequência aceita e relatada antes da implementação (research.md D-6), não descoberta depois. Qualquer teste assim é ajustado para anexar evidência antes de fechar — tratado como acompanhar uma mudança de contrato deliberada, não como regressão a reverter. |
| `AuditScopeFrameworkVersion`/`AuditScopeRequirement` apontando para uma versão que ainda estava `DRAFT` no momento do vínculo, e sendo editada depois | Impedido na origem: vincular exige `status = PUBLISHED` (research.md D-2); nenhum caminho de código grava o vínculo contra uma versão `DRAFT`. Teste que tenta vincular contra `DRAFT` e confirma `422`. |
| `RiskDirectoryPort` (novo) divergir de `ControlDirectoryPort` na forma mínima exposta (ADR-020 parte 4), reintroduzindo um campo de domínio que vaza | Revisão explícita contra a MESMA lista de exclusões que `control-directory.port.ts` já documenta (`status`, `owner`, e para Risco também `probability`/`impact`/`inherentLevel`/`residualLevel`) — nenhum desses aparece em `RiskDirectoryEntry` (data-model.md §9). |
| Teste de Risco, Controles ou Compliance precisar mudar | Tratado como regressão a investigar, não como ajuste (SC-007) — a única alteração aditiva permitida a essas três áreas é a coluna nova em `findings` (fora dos três módulos) e os adaptadores novos que CADA módulo fornece para seu próprio porte (código novo, não alteração de comportamento existente). |
| A listagem `GET /audits/{id}/findings` crescer, numa fase futura, para incluir um resumo agregado (contagem por severidade) sem que ninguém reavalie `Cache-Control` | Fora do escopo desta fase (data-model.md §1, "deliberadamente NÃO armazenado"); research.md D-14 já nomeia a condição que ativaria a exigência, para que quem construir esse resumo não precise redescobri-la. |
