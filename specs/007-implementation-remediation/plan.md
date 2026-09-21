# Implementation Plan: Convergência e Saneamento de Implementação

**Branch**: `007-implementation-remediation` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: `docs/history/implementation-debt-review.md` (C1–C7, V1–V6),
`docs/deferred-findings.md` (F-1 a F-52), decisões do coordenador D-R1 a D-R14
(`research.md` D-1 a D-16).

---

## Summary

Converge o que já está construído com o que a arquitetura já exige, sem avançar roadmap. Uma
autoridade de escrita para trabalho de ação (hoje duas), uma política de vencimento (hoje quatro
cópias, cinco contando o relógio duplicado), contrato e tipo cobrindo todo o produto implementado
(hoje metade), classificação de fronteira alcançando os arquivos de composição (hoje nenhum),
remoção de código morto e de uma decisão de escopo por JOIN em Controles, e atribuição de auditoria
num login que hoje não a produz. Termina com os 52 achados do backlog triados individualmente, não
descritos por amostragem, e a documentação operacional corrigida.

Nenhum módulo de negócio novo. Nenhuma capacidade de roadmap (Incidentes, Problemas, Indicadores)
é implementada aqui — esta fase é precisamente o que precisa fechar **antes** de Incidentes começar
(CLAUDE.md §17).

---

## Technical Context

**Language/Version**: TypeScript 5.x · Node 22 (nota: ambiente local mede Node 24, D-3 de
`docs/local-environment.md` — não é ajustado por esta fase).

**Primary Dependencies**: NestJS 11, Next.js 15, Prisma 6, Vitest, Playwright + `@axe-core/playwright`.
**Novas dependências, justificadas** (D-9): `ajv` (2020-12), `ajv-formats`, `yaml`, todas
devDependencies de `apps/api`, MIT/ISC, sem alternativa já presente no monorepo que resolva o mesmo
problema (validação de payload contra JSON Schema 2020-12).

**Storage**: PostgreSQL. Uma migração forward-only, aditiva-depois-destrutiva sobre
`risk_treatment_actions` (data-model.md §1-§2); uma migração aditiva sobre `control_assessments`
(data-model.md §4); dois valores de enum ou nenhum — nenhuma mudança de enum é exigida por esta
fase além do que já existe.

**Testing**: `test:unit`, `test:contract`, `test:integration` (API); `test:unit` (web); `test:e2e`
(Playwright). Linha de base medida no HEAD `ecf10c1` (spec.md, tabela de contexto medido):
`API unit 490 · contrato 648 · integração 168 · web unit 532`. Contagens de contrato e integração
DEVEM subir (novos testes de payload, de fronteira, de equivalência de vencimento, de escopo de
Controle→Ativo) — nunca apenas permanecer estáveis.

**Target Platform**: aplicação web corporativa; API em 3001, web em 3000, servindo build de
produção localmente — reconstruir e reiniciar antes de qualquer verificação renderizada (D-16 de
`docs/local-environment.md`).

**Project Type**: monorepo — `apps/api`, `apps/web`, `packages/api-types`, `packages/design-system`.

**Performance Goals**: nenhuma meta nova de latência. A denormalização de `org_unit_id` em
`control_assessments` e o predicado SQL único de vencimento **reduzem** custo de consulta (removem
um JOIN cada); nenhuma mudança amplia o custo de uma consulta hoje existente.

**Constraints**: interface em pt-BR nos catálogos centralizados (§11.1) para toda string nova;
nenhuma linha histórica de auditoria ou de sessão é reescrita (Constituição, Princípio XV); a
migração de `risk_treatment_actions` preserva todo `id` (FR-002); nenhum consumidor atual das rotas
de tratamento de ação perde acesso sem que a permissão nova seja semeada primeiro (o mesmo risco que
`specs/006-assets-processes/plan.md` já nomeou para a transferência de propriedade de `GET /assets`).

**Scale/Scope**: uma migração de dados (backfill + verificação + drop), uma migração aditiva, um
gerador estendido de 5 para 10 documentos, um validador de payload novo, quatro políticas de lint
de fronteira alteradas, um porte e uma implementação removidos, uma coluna denormalizada, uma
correção de atribuição de auditoria, 52 achados triados, um `README.md` novo.

---

## Constitution Check

*GATE: deve passar antes da Fase 0 e ser reavaliado após a Fase 1.*

| Princípio | Avaliação | Evidência |
|---|---|---|
| **I. GRC Domain Integrity** | **Passa, e é o motivo de metade da fase.** O estado atual VIOLA este princípio duas vezes: duas autoridades de dados para o mesmo conceito de trabalho (Ação), e uma capacidade GRC (`grc/`) sem isolamento mútuo declarado. Front A e Front C corrigem, não introduzem, exceção nova | research.md D-1 a D-3, D-10 |
| **II. Security by Design** | **Passa.** V1 e V2 são investigados e corrigidos nesta fase, não retrofitados depois de um incidente | research.md D-12, D-13 |
| **III. Identity, Access Control, SoD** | **Passa.** D-4 mantém as duas autoridades (`risk:treat`/`action:edit`) distintas, com prova nos dois sentidos. Nenhuma autorização é relaxada | research.md D-4 |
| **IV. Auditability and Traceability** | **Passa, e corrige uma violação confirmada.** D-13 fecha o gap de atribuição em `session.created` (1466/1466 linhas hoje sem ator). D-5 preserva toda linha histórica de `RISK_TREATMENT_ACTION` por garantia constitucional, não por conveniência | research.md D-5, D-13 |
| **V. Data Integrity and Governance** | **Passa.** Migração aditiva-depois-destrutiva com verificação obrigatória antes do `DROP` (data-model.md §2); nenhuma linha é perdida, cada uma é verificada campo a campo contra sua `Action` antes de a coluna original ser removida | data-model.md §2 |
| **VI. Risk Management Integrity** | **Passa.** Nenhuma regra de cálculo de risco muda. O vencimento de ação passa a ter uma única fonte, o que **fortalece** a garantia de cálculo centralizado que este princípio já exige | research.md D-7 |
| **VII. Workflow and Accountability** | **Passa, e corrige uma violação confirmada.** A tabela de legalidade de transição de `Action` passa a valer em toda rota — hoje a rota de Riscos aceita transições que a Constituição já proíbe implicitamente ("transições implícitas ou dirigidas por efeito colateral são proibidas") | research.md D-3 |
| **VIII. Code Quality and Architecture** | **Passa.** Remove código morto (`ControlRegistryPort`), remove duplicação real (`todayDateOnlyUtc`, o `SELECT` de escopo), sem introduzir abstração nova além do que os próprios FRs exigem | research.md D-7, D-11 |
| **IX. Testing Standards** | **Passa, e é onde a fase mais investe.** Todo guard de segurança ou estrutural ganha um teste que **falha** contra o código sem a correção — não apenas um teste que passa com ela (mandato explícito da missão) | tasks.md, cada tarefa de guarda |
| **X. User Experience Consistency** | **Passa.** Toda string nova em pt-BR nos catálogos centralizados; nenhuma tela nova além de mensagens de erro pontuais (transição ilegal, motivo de reabertura ausente) | spec.md FR-032 |
| **XI. Performance and Scalability** | **Passa.** O predicado de vencimento único é uma consulta SQL, nunca uma carga em memória (D-7); a leitura de escopo por `org_unit_id` denormalizado elimina um JOIN por avaliação de controle | research.md D-7, D-11 |
| **XII. Observability** | **Passa.** Nenhum caminho de log novo introduzido; a atribuição de auditoria de login usa o mecanismo já existente (`RequestContextEnricherPort`), não um caminho paralelo | research.md D-13 |
| **XIII. API and Integration Standards** | **Passa.** Toda mudança de contrato está documentada em `contracts/contract-changes.md` com código de status e nota de migração; nenhuma rota nova sem contrato correspondente | contracts/contract-changes.md |
| **XIV. Documentation and ADRs** | **Passa.** research.md registra cada decisão com alternativa rejeitada; nenhuma ADR nova é necessária — ADR-008, ADR-011, ADR-016, ADR-020 já cobrem as fronteiras que esta fase aplica, não reabre | research.md |
| **XV. Change Management / Backward Compat** | **Atenção, linha central desta fase.** A identidade pública de `RiskTreatmentAction.id` muda de significado (D-2); a autoridade das rotas de tratamento permanece a mesma (D-4), mas o comportamento de transição fica **mais estrito** (D-3) e os números do painel **mudam** (spec.md SC-002a) — as três mudanças são deliberadas, documentadas e sem consumidor externo a quebrar (Assumption A-2) | research.md D-2, D-3; contracts/contract-changes.md |
| **XVI. Compliance-Oriented Engineering** | **Passa.** A convergência de Ação é precisamente o que torna Evidência e Ação reutilizáveis por Incidentes sem duplicar sistema de tarefa — o requisito que `docs/architecture/grc-roadmap.md` já registrou como bloqueante | CLAUDE.md §17 |

**Resultado do portão**: passa, com a atenção registrada em XV — que não é uma violação, é a lista
exata de mudanças observáveis que `contracts/contract-changes.md` e `spec.md` já documentam.

**Reavaliação pós-Fase 1**: `data-model.md` e `contracts/contract-changes.md` não introduziram
nenhuma entidade, permissão ou dependência além das já avaliadas acima. O portão permanece passando.

---

## Project Structure

### Documentation (this feature)

```text
specs/007-implementation-remediation/
├── spec.md                    # o quê e por quê, com o contexto medido
├── plan.md                    # este arquivo
├── research.md                # D-1 a D-16, decisões com alternativa rejeitada
├── data-model.md              # antes/depois, migração completa, invariantes
├── contracts/
│   └── contract-changes.md    # delta de contrato, documento — não edita os YAML das fases 001-006
├── matrix.md                  # C1-C7, V1-V6, F-1 a F-52 triados, achados novos, cauda de roadmap
├── tasks.md                   # T001..., gerado a partir deste plano
└── STATE.md                   # estado de retomada
```

Esta fase **não** gera `data-model.md`/`contracts/` no sentido de um novo domínio (não há entidade
GRC nova) — os arquivos existem porque a migração e o delta de contrato precisam da mesma disciplina
de revisão que uma feature nova teria, não porque §19.2 exige uma declaração de relacionamento (não
há módulo novo se relacionando com nada).

### Frentes de trabalho (A–G) e o arquivo que cada uma possui

A convergência tem sete frentes. `matrix.md` é o registro linha a linha; esta tabela é o mapa de
propriedade de arquivo, para que duas frentes não editem o mesmo arquivo sem saber uma da outra — a
causa registrada de F-44 #2 ("dois agentes em paralelo sem poder depender um do trabalho inacabado
do outro").

**Duas frentes (E e F) dependem de medição ainda em andamento** (dois agentes medindo C6/V3 e
V1/V4, respectivamente, no momento em que este plano foi escrito) — seu escopo abaixo é o
comportamento-alvo definido em `spec.md` User Stories 7 e 8; a lista de arquivo é preenchida quando
a medição chegar e `research.md`/`tasks.md` registrarem a decisão contra a evidência real.

| Frente | Corresponde a | Entrega | Arquivos principais |
|---|---|---|---|
| **A** | C1 (convergência de Ação) + C2 (vencimento único) | US1, US2 | `schema.prisma`, a migração nova, `grc/action/**`, `modules/risk/application/treatment-actions/**`, `modules/risk/infrastructure/{risk-query,dashboard-query}.service.ts`, `modules/risk/domain/risk-overdue.ts`, `grc/shared/domain/overdue.service.ts`, `modules/risk/infrastructure/overdue-action-sql.ts` (novo), `risks.openapi.yaml`, `platform.openapi.yaml`, `prisma/seed/performance.seed.ts` |
| **B** | C3 (contratos e tipos) | US3 | `packages/api-types/scripts/generate.mjs`, `packages/api-types/src/**` (gerado), novo validador de payload em `apps/api/test/contract/support/`, `.github/workflows/ci.yml` (job novo de atualidade), `package.json`/`pnpm-lock.yaml` (as três dependências novas) |
| **C** | C4 (fronteiras de composição) | US4 | `apps/api/eslint.config.mjs` |
| **D** | C5 (saneamento de Controles) | US5 | `modules/risk/risk.module.ts`, `modules/risk/domain/ports/registry-repository.port.ts` (removido), `modules/risk/infrastructure/prisma-registry.repository.ts` (removido), `modules/controls/infrastructure/{control-lookup,control.repository,control-assessment.repository}.ts`, `schema.prisma` (coluna `control_assessments.org_unit_id`) |
| **E** | C6 (E2E/CI) + V3 (seed de teste) — **medido** (research.md D-17 a D-20) | US7 | `apps/web/e2e/support/admin-session.ts`, `apps/api/prisma/seed/platform.seed.ts` (constante do pool, até ser removido), `.github/workflows/ci.yml` (limites de login e job de agregação, seções distintas da de B), documentação de cobertura de navegador |
| **F** | V1 (F-26, partição de chave de armazenamento) + V4 (instalação do zero) — **medido (research.md D-20 a D-25)** | US8 | `core/files/infrastructure/local-disk-storage-provider.ts`, `core/files/application/upload.service.ts` (repassa `organizationalUnitId`), `specs/001-grc-platform-foundation/quickstart.md` (linhas 91-92, comandos de migração Docker) |
| **G** | C7 (documentação) + V2 (auditoria de login) + V6 (triagem completa dos 52 achados) | `matrix.md`, README raiz, correções pontuais de doc, `session.created` atribuído | `README.md` (raiz, novo), `docs/deferred-findings.md` (correções pontuais F-18/F-37/F-40/F-48, sem reescrever o arquivo — F-37 marcado resolvido com data e evidência, texto original preservado, per matrix.md F-63), quickstarts de 002/003/005 (F-51), `core/dashboard/domain/default-planned-areas.ts`, `core/identity/infrastructure/auth-orchestrator.ts`, `core/sessions/application/session.service.ts` |
| **H** | Achado novo (F-66/D-22, encontrado rodando a suíte Chromium, não previsto em C1-C7/V1-V6) | US9 | **ver "Lacuna de propriedade" abaixo** — `packages/design-system` (primitivo novo), `apps/web/src/features/{risks,controls,compliance,audit-engagements,findings}/components/*` (nove pontos de chamada), `apps/web/e2e/{assets-processes,risk-treatment}.spec.ts` |

**Extensão do mapa (D-26 a D-29, achados de Frente G)**: `apps/api/vitest.config.ts` e o script
`test` de `apps/web/package.json` (F-68/D-26) ficam com o Agente B, que já possui
`apps/api/package.json` e a infraestrutura de teste de contrato — é a extensão mais próxima de sua
árvore declarada, não uma nova área. `docs/architecture/grc-roadmap.md`, `docs/architecture.md` e a
reconciliação de checkbox de `specs/002/003/004` (F-69/F-70) não pertencem a nenhum dos três agentes
por serem puramente documentais fora de código — seguem com a Frente G, sem dono de código
específico, o mesmo tratamento que `README.md` já recebe.

**Decidido pelo coordenador**: Frente H **não é uma lacuna de propriedade — é uma onda posterior**.
Ela toca `packages/design-system` e nove pontos de chamada, um dos quais (`risk-controls-section.tsx`)
está dentro da árvore de Riscos que o Agente A possui na Frente A. Atribuí-la agora colocaria dois
editores nos mesmos arquivos. **Frente H é a onda 4**: ganha um dono único nesse momento, com
propriedade exclusiva do pacote de Design System, dos nove pontos de chamada e das três
especificações E2E que ela corrige — e começa **depois** que o trabalho de frontend da Frente A
(que toca `risk-controls-section.tsx`) tiver aterrissado. Isto é uma restrição de sequenciamento,
registrada aqui e em `STATE.md`, não uma frente sem dono.

**Por que V2 (auditoria de login) está em G, e não em uma frente própria**: é um achado pequeno,
isolado, com decisão já fechada (research.md D-13) e sem dependência de medição pendente — encaixa
no mesmo ritmo dos itens pequenos e independentes que G já agrega, em vez de justificar uma oitava
frente.

### Mapa de propriedade de arquivo — três agentes de implementação

As sete frentes acima descrevem **o quê**; a implementação real corre por **três agentes**,
reaproveitados entre ondas, com um dono único por arquivo em cada onda — nenhum arquivo tem dois
donos na mesma onda. Esta é a tabela de conflito que `tasks.md` referencia por nome de agente.

| Agente | Domínio | Possui |
|---|---|---|
| **Agente A** | Domínio e persistência | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/prisma/seed/performance.seed.ts`, todo `apps/api/src/modules/risk/**`, todo `apps/api/src/grc/**`, `apps/api/src/shared/messages/risk.ts`, `apps/api/src/shared/messages/user-messages.ts`, os documentos de contrato de Riscos e do Painel (`risks.openapi.yaml`, `platform.openapi.yaml`), `apps/web/src/features/risks/**`, `apps/web/src/features/dashboard/**`, e os testes de backend que cobrem tudo isso |
| **Agente B** | Contratos e tipos gerados | todo `packages/api-types/**`, `.github/workflows/ci.yml`, `apps/api/test/contract/support/**` mais as specs novas do validador de payload, `apps/api/package.json` e o lockfile para as três dependências de desenvolvimento novas, e todo `apps/web/src/features/*/types.ts` **exceto** `risks` e `dashboard` |
| **Agente C** | Fronteiras, segurança e operação | `apps/api/eslint.config.mjs`, todo `apps/api/src/modules/controls/**`, `apps/api/src/core/sessions/**`, `apps/api/src/core/identity/**`, `apps/api/src/core/files/**`, `apps/api/src/core/dashboard/**`, `apps/web/e2e/**`, `apps/api/prisma/seed/platform.seed.ts` |

**Três consequências deste mapa, escritas para não serem descobertas na hora**:

1. **A remoção do registro morto de Controles é do Agente A, não do Agente C.**
   `ControlRegistryPort`, seu adaptador Prisma e sua ligação vivem todos sob
   `apps/api/src/modules/risk/` — é o Agente A que já está editando `risk.module.ts` para remover os
   provedores de espelho (D-3). A remoção é uma tarefa própria do Agente A, citando a evidência do
   Agente C (que identificou o código morto), em vez de dar a C um segundo editor naquele arquivo.
2. **A coluna aditiva de unidade organizacional em `control_assessments` é do Agente A, não do
   Agente C**, mesmo que o comportamento e o predicado de escopo que a consome pertençam à árvore de
   C. Dividido assim: A escreve a coluna, o backfill e a regra (trigger ou regra de aplicação) que a
   mantém em sincronia; C troca o repositório para usar o auxiliar de escopo compartilhado em vez do
   JOIN. **O meio de A chega primeiro.**
3. **O Agente B regenera os tipos por último.** A cobertura do gerador, o portão de atualidade e o
   validador de payload não dependem de nenhuma edição de contrato de ninguém e podem ser construídos
   primeiro. Mas a regeneração que produz a saída commitada precisa vir **depois** que o Agente A
   terminar de editar os documentos de contrato de Riscos e do Painel — do contrário os tipos
   commitados ficam desatualizados no instante em que chegam, exatamente o defeito que esta frente
   existe para fechar.

**Duas regras operacionais já registradas em `docs/local-environment.md`, reafirmadas aqui**: nenhum
par de agentes roda, ao mesmo tempo, uma suíte que trunca o mesmo banco; nada roda o build do web
enquanto um servidor já serve o mesmo diretório de saída (D-16 daquele documento).

**Uma terceira, aprendida nesta própria sessão**: **só um agente por vez roda suíte de navegador.**
Os workers compartilham um único orçamento de login por origem nesta máquina — duas execuções
simultâneas de E2E aconteceram nesta mesma noite, e nenhum dos dois agentes envolvidos poderia saber
que as falhas do outro já estavam consumindo seu próprio orçamento (a mesma aritmética de D-17).

---

## Riscos desta fase, e o que cada um exige

| Risco | Por que é real aqui | Mitigação exigida |
|---|---|---|
| **Perda silenciosa de dado durante o backfill** | A migração dropa seis colunas depois do backfill; um erro no backfill só aparece depois do `DROP`, quando é tarde | As três consultas de verificação do passo 2 (data-model.md) rodam DENTRO da mesma transação da migração, com `RAISE EXCEPTION` — o `DROP` nunca executa se a verificação falhar |
| **Front A e Front D colidem em `schema.prisma`** | Duas migrações no mesmo arquivo, no mesmo período | Ordem explícita na tabela acima: A aplica e fecha sua migração antes de D iniciar a sua |
| **Regra de vencimento nova compila mas nunca é exercitada por todo consumidor** | É exatamente a classe de defeito que CLAUDE.md §19.10 nomeia — sete vezes já paga neste projeto | Teste de equivalência (D-7) roda contra os TRÊS pontos de consumo (risk-query, dashboard-query x2, prisma-action.repository), não contra a função isolada |
| **O validador de payload novo nunca reprova nada** | Um gate que nunca falha não é gate (F-3, F-28, F-52 já mostraram esse padrão) | Cada teste de payload é provado contra um DTO com campo renomeado deliberadamente antes de ser aceito — a mesma disciplina que `specs/006-assets-processes/STATE.md` §2.4 já documentou para sua própria guarda vácua |
| **A regra de fronteira nova libera geral para não travar a lint** | É o risco que F-25 nomeia por extenso | Controles positivo e negativo exigidos por US4; um teste que prova a regra RECUSA a importação proibida, não apenas que ela compila |
| **Números do painel mudam e alguém relata como regressão** | Medido: 73→(73+3) potencialmente, dependendo de status das 3 ações órfãs | spec.md SC-002a e contracts/contract-changes.md §2.2 documentam a mudança antes de ela acontecer |
| **A triagem de 52 achados vira resumo em vez de veredito individual** | É o erro que V6 do diagnóstico já nomeia como risco ("não encerrar por conveniência") | `matrix.md` exige uma linha por achado, com evidência — nenhum agrupamento por "acima" |

---

## Phase 0 — Research

Concluída: [research.md](./research.md). D-1 a D-16, cada uma com alternativa rejeitada. Duas
correções do coordenador feitas durante esta mesma fase de especificação (D-5, D-7) estão registradas
explicitamente como correções, não silenciadas.

## Phase 1 — Design & Contracts

Concluída: [data-model.md](./data-model.md), [contracts/contract-changes.md](./contracts/contract-changes.md).

## Phase 2 — Tasks

Gerada em [tasks.md](./tasks.md), agrupada pelas frentes A–G acima, em ordem de dependência.

## Phase 3 — Matrix

[matrix.md](./matrix.md) — C1–C7, V1–V6, F-1 a F-52 e os achados novos desta fase, triados
individualmente.

## Phase 4 — State

[STATE.md](./STATE.md) — estado de retomada, sem nada implementado ainda no momento em que este
plano foi escrito.

---

## Portões de qualidade (CLAUDE.md §13, aplicados a cada frente)

Nenhuma frente é considerada concluída sem os nove itens abaixo, na ordem em que `tasks.md` os exige
como critério de aceitação de cada tarefa terminal de frente:

1. Testes adequados existem e passam — incluindo o teste que **falha** contra o código sem a
   correção, para toda guarda de segurança ou estrutural (mandato desta missão, além de CLAUDE.md §13.1).
2. `pnpm run lint` limpo.
3. `pnpm run typecheck` limpo.
4. Tratamento de erro explícito — nenhum `catch` silencioso novo.
5. A arquitetura definida é respeitada — em particular, nenhuma frente introduz uma dependência que
   `apps/api/eslint.config.mjs` (antes ou depois de C) já proibiria.
6. Segurança considerada — nomeada explicitamente na entrada de `matrix.md` de cada item de V1-V2.
7. Auditabilidade considerada — nomeada explicitamente para D-5/D-13.
8. Nenhuma duplicação desnecessária introduzida — em particular, esta fase REMOVE duplicação
   existente (D-7, D-11); nenhuma tarefa pode reintroduzi-la para simplificar sua própria entrega.
9. Documentação atualizada onde a decisão for arquiteturalmente relevante — `research.md` já cobre
   as 16 decisões; nenhuma tarefa deveria precisar de uma ADR nova (nenhuma das 16 abre uma).

Mais o portão específico desta missão, deliberadamente separado dos nove de cima:

10. Ao final de todas as frentes, a linha de base de `spec.md` é re-executada por inteiro
    (`pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, as quatro suítes de teste, e
    `pnpm run build` se o impedimento ambiental do HEAD medido não estiver mais presente) e o
    resultado é registrado em `STATE.md`, comparado linha a linha com a tabela de `spec.md` — nunca
    presumido igual.
