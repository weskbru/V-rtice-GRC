# Implementation Plan: Gestão de Controles

**Branch**: `main` (trunk-based, ver §17 do CLAUDE.md) | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/003-controls-management/spec.md`

## Summary

Promover o registro mínimo `Control` a domínio completo: catálogo governado, ciclo de vida
auditado, verificação de efetividade imutável com efetividade **derivada** por calculador único, e
segregação de funções na atestação pela infraestrutura de aprovação já existente. Controls é
também o primeiro consumidor real de ADR-020 em código — o vínculo Risco↔Controle permanece do
lado do Risco, mas a dependência de código passa a atravessar uma porta em `shared/`.

Todas as decisões de desenho estão em [research.md](./research.md); a forma persistida está em
[data-model.md](./data-model.md). Este plano não as repete — descreve como serão construídas.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 24

**Primary Dependencies**: NestJS 11 (API), Prisma 6.19 (persistência), Next.js 15 + React 19
(web), Tailwind 4 + shadcn/ui via `@vertice/design-system`

**Storage**: PostgreSQL 18; dois papéis de banco (ADR-005) — `vertice_owner` migra, `vertice_app`
opera

**Testing**: Vitest (unit / contract / integration), Playwright + `@axe-core/playwright` (E2E e
acessibilidade)

**Target Platform**: servidor Linux em contêiner; navegadores modernos

**Project Type**: monorepo pnpm — `apps/api`, `apps/web`, `packages/design-system`,
`packages/api-types`

**Performance Goals**: uma página do catálogo renderiza em menos de 2 s com 50.000 controles
(SC-008), pelo mesmo regime de paginação obrigatória do registro de riscos — nunca busca além da
página corrente

**Constraints**: alterações de banco estritamente aditivas; nenhum teste de Risco pode mudar
(SC-006); nenhum import entre módulos de negócio (SC-007)

**Scale/Scope**: 3 histórias de usuário, 30 requisitos funcionais, 9 critérios de sucesso

## Constitution Check

*GATE: aprovado antes da Fase 0 e reavaliado após a Fase 1.*

| Princípio | Como esta fase o satisfaz |
|---|---|
| I. GRC Domain Integrity | Control é domínio com dono próprio (ADR-016) e não pertence a framework algum (ADR-017). Evidência/Ação são consumidas do núcleo, não recriadas. |
| Segurança por padrão | Escopo organizacional em toda leitura e escrita; fora de escopo responde como inexistente; permissões próprias declaradas estaticamente. |
| Auditabilidade | Eventos semânticos por intenção de negócio; mudança de efetividade com valor anterior e posterior; recusa de atestação auditada com motivo. |
| Histórico preservado | Verificação imutável; desvínculo preserva com atribuição; `RETIRED` continua legível. |
| Sem abstrações prematuras | Nenhum motor de workflow, de metadados ou de relacionamento genérico. Enum + caso de uso, como §19.4 determina. |
| X. Consistência de UX (pt-BR) | Toda string nova nos catálogos centralizados; Design System estendido, não substituído (§18.12). |

**Nenhuma violação.** Nenhuma exceção a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/003-controls-management/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── controls.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md            (gerado por /speckit-tasks)
```

### Source (repository)

```text
apps/api/src/
├── shared/grc-ports/
│   └── control-directory.port.ts        NOVO — ADR-020 parte 3
├── modules/controls/                    NOVO módulo
│   ├── domain/
│   │   ├── control.entity.ts
│   │   ├── control-lifecycle.ts
│   │   ├── control-effectiveness.service.ts    calculador único (D-2)
│   │   ├── control-assessment.entity.ts
│   │   └── ports/
│   ├── application/
│   ├── infrastructure/
│   │   └── control-directory.adapter.ts  fornece a porta compartilhada
│   ├── presentation/
│   └── controls.module.ts
└── modules/risk/
    └── (passa a depender de ControlDirectoryPort; nenhuma outra mudança)

apps/web/src/
├── features/controls/
│   ├── api.ts, types.ts, status.ts
│   └── components/
└── lib/messages/controls.ts             NOVO catálogo pt-BR
```

## Superfície de API (contrato)

18 operações, todas sob `control:*` e escopo organizacional:

| # | Operação | Verbo/rota |
|---|---|---|
| 1 | Listar catálogo (paginado, filtrado, ordenado) | `GET /controls` |
| 2 | Criar controle | `POST /controls` |
| 3 | Ler controle | `GET /controls/{controlId}` |
| 4 | Editar controle | `PATCH /controls/{controlId}` |
| 5 | Ciclo de vida disponível | `GET /controls/{controlId}/lifecycle` |
| 6 | Transicionar ciclo de vida | `POST /controls/{controlId}/transitions` |
| 7 | Listar verificações | `GET /controls/{controlId}/assessments` |
| 8 | Registrar verificação | `POST /controls/{controlId}/assessments` |
| 9 | Ler verificação | `GET /controls/{controlId}/assessments/{assessmentId}` |
| 10 | Solicitar atestação | `POST /controls/{controlId}/assessments/{assessmentId}/attestation` |
| 11 | Decidir atestação | `POST /controls/{controlId}/assessments/{assessmentId}/attestation/decision` |
| 12 | Riscos tratados por este controle (leitura do vínculo existente) | `GET /controls/{controlId}/risks` |
| 13 | Listar vínculos com processos | `GET /controls/{controlId}/processes` |
| 14 | Vincular processo | `POST /controls/{controlId}/processes` |
| 15 | Desvincular processo | `DELETE /controls/{controlId}/processes/{linkId}` |
| 16 | Listar vínculos com ativos | `GET /controls/{controlId}/assets` |
| 17 | Vincular ativo | `POST /controls/{controlId}/assets` |
| 18 | Desvincular ativo | `DELETE /controls/{controlId}/assets/{linkId}` |

`400` = forma da requisição; `422` = regra de negócio; `404` = inexistente **ou** fora de escopo,
indistinguíveis. RFC 9457 em todas as falhas.

Evidência e Ação **não** ganham rotas próprias aqui: são alcançadas pelos endpoints já existentes
do núcleo, com os novos valores de tipo fechado (§7 do data-model).

## Fases de execução

**Fase A — fundação do módulo (backend).** Migração aditiva; enums; entidade e ciclo de vida;
`ControlEffectivenessService` com sua paridade SQL; repositório escopado; permissões e papéis
semeados; módulo Nest com a porta compartilhada e seu adaptador; ajuste de `modules/risk` para
consumir a porta.

**Fase B — verificação e atestação (backend).** `ControlAssessment` imutável; registro; solicitação
e decisão de atestação com as invariantes C1 e C2; auditoria semântica incluindo recusas;
integração da efetividade derivada ao catálogo e ao detalhe.

**Fase C — relacionamentos (backend).** `ControlProcessLink`/`ControlAssetLink` com tipos de
auditoria próprios, verificação de escopo do alvo antes de gravar, permissão dos dois lados,
desvínculo preservando histórico; leitura dos riscos tratados; `EvidenceSubjectType` e
`ActionOriginType` estendidos.

**Fase D — interface.** Catálogo (cards e tabela, herdando os padrões estabelecidos no registro de
riscos — §18.12 proíbe linguagem visual própria por módulo), detalhe com abas, formulário,
verificações, atestação e vínculos. Verificação renderizada obrigatória (§18.1).

**Fase E — validação.** Contrato das 18 operações; integração de escopo e segregação; E2E do
caminho completo; acessibilidade nas telas novas; regressão de Risco sem alteração de teste.

As fases A–C são backend e majoritariamente sequenciais por dependência de esquema; D depende de
A–C; E fecha. A paralelização real está **dentro** de cada fase.

## Riscos conhecidos e como são endereçados

| Risco | Endereçamento |
|---|---|
| `is_active` e `status` divergirem | Um único ponto de escrita, documentado nos dois lados (data-model §1) e testado. |
| Regra de efetividade divergir entre SQL e domínio | Teste que confronta as duas expressões sobre os mesmos dados — o padrão já usado para `overdueReview`. |
| A troca para `ControlDirectoryPort` quebrar escopo do vínculo Risco↔Controle em silêncio | Teste de escopo próprio, além do teste de fronteira: uma refatoração "sem mudança de comportamento" é a que passa despercebida quando quebra (research D-4). |
| Estados de ciclo de vida inalcançáveis | Cada estado tem consequência observável e teste que a exercita (research D-6) — o defeito exato que `/speckit.analyze` encontrou em `FindingStatus` na Fase 1. |
| Teste de Risco precisar mudar | Tratado como regressão a investigar, não como ajuste (SC-006). |
