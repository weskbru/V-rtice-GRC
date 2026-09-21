# Tasks — Convergência e Saneamento de Implementação

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) ·
**Data model**: [data-model.md](./data-model.md) · **Contratos**: [contracts/contract-changes.md](./contracts/contract-changes.md) ·
**Matrix**: [matrix.md](./matrix.md)

`[P]` = paralelizável (arquivos distintos, sem dependência pendente). Cada tarefa nomeia o **agente**
dono do arquivo (plan.md, "Mapa de propriedade de arquivo") — Agente A (domínio/persistência),
Agente B (contratos/tipos), Agente C (fronteiras/segurança/operação). Nenhuma tarefa muda de agente
sem que `plan.md` seja atualizado primeiro.

**Toda tarefa que adiciona ou muda um endpoint HTTP carrega uma tarefa de teste de contrato**
(D-11 de `docs/local-environment.md`). **Toda guarda de segurança ou estrutural carrega uma tarefa
que prova que ela FALHA quando a garantia é removida** — mandato desta missão, além de CLAUDE.md
§13.1.

Duas frentes (F) dependem de medição ainda incompleta no momento em que este arquivo foi escrito;
suas tarefas estão marcadas **PENDENTE** e serão detalhadas quando a medição chegar — não inventadas
aqui.

---

## Frente A — Convergência de Ação (C1) + Vencimento único (C2) — Agente A

### A0 — Antes de tudo

- [ ] T001 [Agente A] Ler `data-model.md` §1-§3 e `research.md` D-1 a D-7 por inteiro antes de
      escrever qualquer código desta frente. Confirmar contra o schema atual (`schema.prisma`
      linhas 1263-1297, 2167-2210, 2148-2153, 363-368) que as formas descritas continuam batendo —
      reportar imediatamente se não baterem, não prosseguir sobre uma premissa desatualizada.

### A1 — Migração (bloqueia toda a frente)

- [ ] T002 [Agente A] Escrever a migração de `data-model.md` §2 — passos 1 (backfill), 2
      (verificação com `RAISE EXCEPTION`) e 3 (`DROP`) numa única transação. Resolver a nota de
      implementação do próprio `data-model.md` §2 (o `UPDATE` de fechamento precisa casar por
      `rta_id`, não por `(risk_id, created_at)`).
      **Depende de**: T001.
- [ ] T003 [Agente A] Migrar para cima contra um banco descartável e confirmar, por consulta direta
      (não pela ausência de erro): zero `action_id IS NULL`; `action_id` único; igualdade campo a
      campo entre cada `risk_treatment_actions` e sua `Action`, para as seis colunas que migram.
      **Prova de aceitação**: as três consultas de verificação do passo 2 de `data-model.md`,
      executadas manualmente contra o resultado, devolvem zero linhas.
      **Depende de**: T002.
- [ ] T004 [Agente A] Plantar deliberadamente uma inconsistência (por exemplo, uma `Action` de
      backfill com `title` divergente da linha de origem) e confirmar que a migração **reverte**
      inteira — o `RAISE EXCEPTION` do passo 2 realmente aborta a transação antes do `DROP`.
      **Prova de aceitação, negativa**: a migração falha, e as seis colunas continuam presentes
      depois da falha — a guarda não é vácua.
      **Depende de**: T002.
- [ ] T005 [Agente A] `prisma/seed/performance.seed.ts` — a chamada `riskTreatmentAction.createMany`
      (linha ~681) passa a ser precedida por uma criação equivalente de `Action`, com o mesmo
      mapeamento de campo do backfill.
      **Depende de**: T002 (mesma forma de dado).

### A2 — Domínio: uma autoridade de escrita (D-1 a D-4)

- [ ] T006 [Agente A] `grc/action` — confirmar/expor a API que a rota de Riscos vai chamar
      diretamente: `CreateActionUseCase`, `UpdateActionUseCase`, `TransitionActionUseCase`, todas já
      atrás de `assertActionOriginInScope`.
      **Depende de**: T001.
- [ ] T007 [Agente A] Reescrever `modules/risk/application/treatment-actions/{create,update}-treatment-action.usecase.ts`
      para chamar os casos de uso de T006 diretamente, mantendo a autorização `risk:view`/`risk:treat`
      já existente (D-4) e fazendo *upsert* da linha de `risk_treatment_actions` (vínculo opcional,
      D-2).
      **Depende de**: T003, T006.
- [ ] T008 [Agente A] Remover `MirrorActionStatusFromOriginUseCase`,
      `MirrorActionFieldsFromOriginUseCase`, `ActionRepositoryPort.mirrorTransition` e
      `.mirrorFieldUpdate` — o arquivo inteiro, não apenas o chamador.
      **Depende de**: T007 (nenhum chamador restante).
- [ ] T009 [Agente A] **Remover o código morto de Controles do lado do Agente A** (D-11/C5, F-61):
      `ControlRegistryPort`, `PrismaControlRegistryRepository` e a ligação em
      `modules/risk/risk.module.ts:198` — está dentro da árvore do Agente A, que já está editando
      este arquivo em T008. Citar a evidência do Agente C (matrix.md C5).
      **Prova de aceitação**: o contêiner Nest sobe sem erro de injeção; `LinkControlUseCase`
      continua funcionando via `ControlDirectoryPort`.
      **Depende de**: T008.

### A3 — Teste de tabela de legalidade em toda rota (D-3)

- [ ] T010 [Agente A] Teste de contrato: os 11 pares de transição hoje aceitos pela rota de Riscos e
      recusados por `POST /actions/{id}/transitions` passam a devolver `422` nos dois caminhos —
      **mesma tabela**, executada contra as duas rotas.
      **Prova negativa exigida**: reproduzir o teste contra o código de T007 SEM T008 (mirror ainda
      presente) e confirmar que ele falha — a guarda não está vácua.
      **Depende de**: T007, T008.
- [ ] T011 [Agente A] `UpdateRiskTreatmentActionRequest` ganha `reopenReason` (contracts/contract-changes.md
      §1.3); DTO da API exige quando `status: OPEN` reabre uma ação `COMPLETED`.
      **Depende de**: T007.
- [ ] T012 [Agente A] Teste de contrato: reabrir uma ação `COMPLETED` sem `reopenReason` pela rota de
      Riscos devolve `422`; com motivo, `200` e o motivo é preservado na auditoria.
      **Depende de**: T011.

### A4 — Identidade pública e listagem (D-2)

- [ ] T013 [Agente A] `GET/POST /risks/{riskId}/treatment-actions`,
      `PATCH /risks/{riskId}/treatment-actions/{actionId}` passam a identificar `Action.id`
      (contracts/contract-changes.md §1.1). A listagem inclui toda `Action` de origem
      `RISK_TREATMENT` daquele risco, com ou sem linha de vínculo.
      **Depende de**: T007, T009.
- [ ] T014 [Agente A] Teste de contrato/integração: as três `Action` órfãs (F-57) de um risco de
      fixture aparecem na listagem de tratamento daquele risco.
      **Prova de aceitação**: uma `Action` criada por `POST /actions` direto, sem vínculo, aparece em
      `GET /risks/{riskId}/treatment-actions`.
      **Depende de**: T013.

### A5 — Auditoria (D-5)

- [ ] T015 [Agente A] Criar pela rota de Riscos grava dois eventos
      (`risk.treatment_action_created` + `action.created`); mudar status/campo grava só o evento
      `action.*`; mudar `treatmentDecisionId` grava só `risk.treatment_action_updated`.
      **Depende de**: T007.
- [ ] T016 [Agente A] Teste: `GET /risks/{riskId}/history` permanece **inalterado** — mesma
      consulta (`entity_type IN ('RISK','RISK_ASSESSMENT')`), mesmo comportamento antes/depois desta
      frente. Prova por regressão, não por leitura.
      **Depende de**: T015.

### A6 — Vencimento único (D-7, C2)

- [ ] T017 [Agente A] `grc/shared/domain/overdue.service.ts` — exportar
      `OVERDUE_ELIGIBLE_ACTION_STATUSES` (hoje privado). Confirmar `isActionOverdue`/`todayDateOnlyUtc`
      já residem ali.
- [ ] T018 [Agente A] Remover a cópia de `todayDateOnlyUtc` em
      `grc/action/infrastructure/prisma-action.repository.ts:260-263` (F-58); importar de T017.
- [ ] T019 [Agente A] Remover `isOverdueTreatmentAction` de `modules/risk/domain/risk-overdue.ts`
      junto com a coluna que lia (a migração de T002 já a removeu); `isOverdueReview` permanece,
      perde seu parâmetro padrão, importa `todayDateOnlyUtc` de T017.
      **Depende de**: T002.
- [ ] T020 [Agente A] Novo arquivo `modules/risk/infrastructure/overdue-action-sql.ts` — o
      construtor de fragmento SQL único, a partir do conjunto exportado em T017. Documentar o custo
      aceito (research.md D-7: leitura de `modules/risk/infrastructure` contra `actions`, restrita a
      `origin_type`/`origin_id`/`status`/`due_on`).
      **Depende de**: T017.
- [ ] T021 [Agente A] `risk-query.service.ts` (a coluna `overdue_treatment` e o filtro
      `overdueTreatment`) e `dashboard-query.service.ts` (`getOverdueActions`,
      `getTreatmentActionsSummary`) passam a usar T020, lendo `actions` por
      `origin_type='RISK_TREATMENT' AND origin_id=r.id`, com o predicado de escopo **inalterado,
      ainda sobre `r`** (data-model.md §3 — nunca sobre `a.org_unit_id`).
      **Depende de**: T020, T013 (a identidade pública já precisa estar migrada).
- [ ] T022 [Agente A] Teste de equivalência: TypeScript (`isActionOverdue`) vs. SQL (T020) vs.
      `where` do Prisma, para ontem/hoje/amanhã × 4 status. Os três concordam.
      **Depende de**: T017, T020.
- [ ] T023 [Agente A] Teste de invariante de escopo (data-model.md §3): reatribuir um risco de fixture
      para outra unidade organizacional e confirmar que a bandeira de atraso e o indicador do painel
      seguem a unidade NOVA do risco — nunca um `Action.orgUnitId` desatualizado.
      **Prova negativa exigida**: reproduzir contra uma versão da consulta que escopasse por
      `a.org_unit_id` e confirmar que ela FALHA este teste.
      **Depende de**: T021.
- [ ] T024 [Agente A] `platform.openapi.yaml`/`risks.openapi.yaml` — aplicar contracts/contract-changes.md
      §1, §2.1, §2.2 (identidade de `actionId` no painel; nenhuma mudança de esquema, só de
      significado — documentado no próprio contrato via descrição).
      **Depende de**: T013, T021.

### A7 — Fechamento da frente

- [ ] T025 [Agente A] SC-002a (spec.md): confirmar que os números do painel mudam como esperado
      (as três ações órfãs passam a contar) e registrar o antes/depois em `STATE.md`.
      **Depende de**: T021.
- [ ] T026 [Agente A] `apps/api/test/unit/action-model-convergence-guard.spec.ts` — reescrever para
      proteger o estado FINAL (uma autoridade) em vez de permitir a coexistência de dois modelos.
      **Depende de**: T008, T013.

---

## Frente B — Contratos e tipos (C3) — Agente B

- [ ] T027 [P] [Agente B] Adicionar as três dependências de desenvolvimento (`ajv`, `ajv-formats`,
      `yaml`) a `apps/api/package.json`; atualizar o lockfile. Nenhuma outra frente instala
      dependência nesta fase.
- [ ] T028 [P] [Agente B] Estender `packages/api-types/scripts/generate.mjs`, `DOCUMENTS`, para os
      dez documentos (research.md D-8) — Controles, Conformidade, Auditoria, Ativos, Processos além
      dos cinco já cobertos. Namespace por documento, sem fusão.
- [ ] T029 [Agente B] Portão de CI: regenerar e falhar se `packages/api-types/src` ficar sujo. Job
      novo em `.github/workflows/ci.yml`, seção própria.
      **Depende de**: T028.
- [ ] T030 [Agente B] Provar que o pacote resolve pelo artefato construído (`dist/`), não só pelo
      *path alias* do workspace (F-19) — um teste que consome via `require`/`import` simulando
      resolução de fora do monorepo.
      **Depende de**: T028.
- [ ] T030a [Agente B] **Pré-requisito bloqueante de T031** (F-65/D-21): normalizar os 15 usos de
      `nullable: true` em `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`
      (linhas 796, 801, 806, 807, 811, 840, 855, 858, 886, 893, 894, 939, 949, 950, 954) para
      `type: [x, 'null']`.
      **Prova de aceitação**: regenerar `packages/api-types` depois da mudança produz **zero diff**
      em `packages/api-types/src/generated/grcfoundation.ts` (FR-017a/SC-014).
      **Depende de**: T028.
- [ ] T031 [Agente B] Validador de payload (D-9): novo suporte em
      `apps/api/test/contract/support/` usando `ajv` (dialeto 2020-12) + `ajv-formats`, lendo os
      esquemas de componente dos dez YAML via `yaml` (T027). Cobre sucesso e
      `application/problem+json`; obrigatório/opcional; enum; nulidade. Lista explícita do que fica
      de fora (sem corpo, download binário).
      **Depende de**: T027.
- [ ] T032 [Agente B] Cobrir com o validador de T031 toda operação com corpo dos dez documentos —
      tarefa grande, dividida por documento (T032a Auth/Admin/Platform, T032b Risks, T032c
      GrcFoundation, T032d Controls, T032e Compliance, T032f Audit, T032g Assets/Processes).
      **Depende de**: T031. **Nota de sequência**: T032b (Risks) e a parte de Platform de T032a
      DEVEM rodar depois que o Agente A finalizar T024 (contrato de Riscos/Painel já mudou) — a
      regeneração de T028/T029 para esses dois documentos específicos vem por último, depois de A.
- [ ] T033 [Agente B] Prova negativa: renomear um campo de resposta de uma operação coberta (por
      exemplo, `RiskSummary.title` → `titleX` temporariamente) e confirmar que T031 falha. Reverter.
      **Depende de**: T032.
- [ ] T034 [Agente B] `apps/web/src/features/*/types.ts` (exceto `risks` e `dashboard`, que são do
      Agente A): trocar tipo escrito à mão por tipo gerado onde F-18/F-40 já indicaram divergência
      (`evidence`, `findings`), sem alterar contrato algum.
      **Depende de**: T028.

---

## Frente C — Fronteiras de composição e núcleo GRC (C4) — Agente C

- [ ] T035 [Agente C] `apps/api/eslint.config.mjs` — novo tipo `composition`, cobrindo
      `src/*.ts` (`app.module.ts`, `main.ts`, `permission-catalogue.ts`) e
      `src/{core,grc,modules}/*/*.module.ts` (incluindo submódulos). Política: composição pode
      importar qualquer camada de qualquer área.
- [ ] T036 [Agente C] Habilitar `boundaries/no-unknown-files`.
      **Depende de**: T035 (senão todo `*.module.ts` passaria a falhar).
- [ ] T037 [Agente C] Estreitar `modules/* -> grc/*` para arquivos não-composição: apenas
      `domain`/`application` do lado `grc`.
      **Depende de**: T035.
- [ ] T038 [Agente C] Fechar o isolamento parcial de `grc/` (F-60): políticas `grc-infrastructure`/
      `grc-presentation` deixam de permitir importação cruzada entre capacidades; `grc-domain`/
      `grc-application` continuam permitindo (D-10).
- [ ] T039 [Agente C] Controles positivo e negativo, com um nome de módulo fictício não presente em
      lista fixa nenhuma (US4 cenário 3): `probe/domain` importando `core/*`/`grc/*` é classificado
      pela regra de caminho, não por enumeração.
      **Depende de**: T035, T037, T038.
- [ ] T040 [Agente C] Prova negativa: reverter T037 temporariamente e confirmar que a importação
      antes proibida (`modules/risk/domain` → `grc/evidence/infrastructure`) PASSA — confirmando que
      T037 é quem a bloqueia, não coincidência. Reverter de volta.
      **Depende de**: T037.
- [ ] T041 [Agente C] Confirmar, com o novo conjunto de regras, que `grc/finding/application/close-finding.usecase.ts`
      → `grc/evidence/domain/ports/evidence-link-repository.port.ts` continua permitido (domínio↔domínio
      entre capacidades é o desenho aceito).
      **Depende de**: T038.

---

## Frente D — Saneamento de Controles (C5) — dividida entre Agente A (schema) e Agente C (repositório)

- [ ] T042 [Agente A] Coluna aditiva `control_assessments.org_unit_id` (data-model.md §4):
      `ALTER TABLE` + backfill a partir de `controls.org_unit_id` + índice. Regra de aplicação (ou
      trigger) que mantém a coluna em sincronia quando um `Control` muda de unidade.
      **Depende de**: T003 (mesmo arquivo `schema.prisma`; A fecha sua migração antes).
- [ ] T043 [Agente C] `ControlAssessmentRepository.listAssessmentIdsInScope` passa a ler
      `org_unit_id` da própria linha, sem `JOIN` até `controls` (F-61).
      **Depende de**: T042.
- [ ] T044 [Agente C] Prova negativa: reverter T043 temporariamente (JOIN de volta) e confirmar que
      um teste que reatribui um controle de unidade e verifica visibilidade imediata FALHA contra a
      versão com JOIN sem o backfill de T042 rodado de novo — demonstrando por que a denormalização
      importa. Reverter de volta.
      **Depende de**: T043.
- [ ] T045 [Agente C] Consolidar `findOrgUnitIdUnscoped` (byte-idêntico em `control-lookup.repository.ts:61-65`
      e `control.repository.ts:104-108`) em `ControlScopedRepository`. **Não** fundir
      `ControlLookupPort` em `ControlRepositoryPort` (D-11).
- [ ] T046 [Agente C] Teste comportamental Controle→Ativo fora de escopo (F-62), simétrico ao que já
      existe para Controle→Processo: recusa idêntica à de um ativo inexistente.
      **Prova negativa exigida**: reproduzir contra o código sem a checagem (se ela não existir hoje
      nesse par) e confirmar que falha antes da correção.

---

## Frente E — E2E, CI e semeadura verificáveis (C6 + V3) — medido, Agente C (E2E/seed) + Agente B (`ci.yml`)

- [ ] T047 [Agente C] `admin-session.ts` — tentar primeiro a forma rotacionada da senha, recuar para
      a forma simples só se necessário (D-17 passo 1). Custo esperado: zero falhas num banco já
      tocado, uma falha num banco novo.
- [ ] T048 [Agente C] `attemptSignIn` — diagnosticar 429/500/erro de rede/senha errada
      separadamente, relatando qual foi visto, em vez de uma asserção de texto fixo (D-17 passo 2,
      F-43).
      **Depende de**: T047 (ordem exigida por D-17).
- [ ] T049 [Agente C] Teste: guarda para `E2E_WORKER_ADMIN_POOL_SIZE`, hoje duplicado sem import
      compartilhado (`admin-session.ts:286`, `platform.seed.ts:491`) — falha se os dois valores
      divergirem (D-17 passo 5, enquanto o pool existir).
- [ ] T050 [Agente C] Aposentar o pool estático de doze contas: identidade provisionada por execução
      via `/admin/users` real, um login de bootstrap por execução como única semente de confiança
      (D-17 passo 3, AGENTS.md). Remover o teste de T049 junto com o pool.
      **Depende de**: T047, T048 (sequenciado depois, D-17).
- [ ] T051 [Agente C] Confirmar que `signInAsFixtureUser`/`signInAsSeededUser` **não** ganham cache
      de sessão (D-17 passo 4) — teste que prova uma sessão nova a cada chamada nesses dois
      caminhos.
- [ ] T052 [Agente C] Isolar `auth.spec.ts` para não compartilhar janela de contador de origem com o
      resto da suíte (D-17 passo 6).
- [ ] T053 [Agente B] `.github/workflows/ci.yml` — job de agregação final, `if: always()`,
      dependente de todo outro job, falha quando qualquer um não é `success` (D-18, F-64).
- [ ] T054 [Agente B] Prova negativa: derrubar deliberadamente o job `audit` num branch de teste e
      confirmar que o job de agregação de T053 falha — hoje os quatro jobs a jusante ficariam
      apenas "pulados".
      **Depende de**: T053.
- [ ] T055 [Agente C] Documentar cobertura de navegador exatamente como é (D-19): Chromium automático,
      Firefox/WebKit só sob despacho manual, sem evidência de execução — em todo documento que hoje
      descreve cobertura (README novo de G, `docs/local-environment.md` se aplicável).
- [ ] T056 [Agente C] Provar o script de semeadura (`platform.seed.ts`) contra um banco descartável:
      idempotência (rodar duas vezes, mesma linha de base), baseline de permissão, invalidação de
      cache (D-20). **Nenhuma semeadura global é adicionada a `global-setup.ts`.**
- [ ] T057 [Agente C] Critério de aceitação da frente (D-17 passo 7): execução completa do Chromium,
      limites reais (conta 5, origem 20, janela 300), um worker, `retries:0`, ≤2 falhas medidas e
      relatadas.
      **Depende de**: T047-T052.

---

## Frente F — Instalação do zero e partição de armazenamento (V1 + V4) — medido (D-20 a D-25)

- [ ] T058 [Agente C] Particionar a chave de armazenamento: `FileStorageProvider.put` passa a
      receber o id da unidade organizacional; `UploadService.execute` (seu único chamador) repassa
      `parentAccess.organizationalUnitId`, já resolvido no servidor naquela linha. Novo prefixo de
      chave; `Attachment.checksumSha256` inalterado (é o checksum de conteúdo, não a chave).
- [ ] T059 [Agente C] Compartimento explícito para `organizationalUnitId: undefined` — nunca cai no
      prefixo legado sem escopo nem no compartimento de outro ator. Teste dedicado.
      **Depende de**: T058.
- [ ] T060 [Agente C] Confirmar que toda chave `sha256/...` histórica continua legível por `get` (que
      lê a chave gravada na própria linha) — nenhum backfill, nenhuma rechave.
      **Depende de**: T058.
- [ ] T061 [Agente C] Documentar o residual no próprio código/comentário da mudança (D-20): a
      partição fecha o oráculo ENTRE escopos, não o oráculo DENTRO de uma mesma unidade
      organizacional — nomeado explicitamente, nunca apresentado como fechamento total.
      **Depende de**: T058.

---

## Frente G — Documentação, achados e itens pequenos e independentes (C7 + V2 + V6)

- [ ] T062 [Agente A ou C, o que primeiro tocar o arquivo] `core/identity/infrastructure/auth-orchestrator.ts` /
      `core/sessions/application/session.service.ts` — enriquecer o contexto de `session.created`
      com `actor_user_id`/`session_id` reais, via `RequestContextEnricherPort` já existente, no
      próprio caminho de login (D-13, V2). Nenhuma linha histórica reescrita.
- [ ] T063 Teste: login real produz `session.created` com os dois campos populados.
      **Depende de**: T062.
- [ ] T064 `core/dashboard/domain/default-planned-areas.ts` — remover `CONTROLS` do registro padrão
      (D-15, F-53); atualizar `get-dashboard-planned-areas.spec.ts`, que hoje fixa o conjunto errado.
- [ ] T065 Criar `README.md` na raiz (D-16, F-54), apontando para `docs/README.md` e para os specs
      ativos, sem duplicar conteúdo.
- [ ] T066 **Corrigido de novo (D-27 — a correção anterior estava errada)**: os quickstarts de 002,
      003, 005 **e 006** (cuja correção anterior apenas trocou para `db:migrate`, que existe mas roda
      `prisma migrate dev` — proibido contra banco real pelo próprio cabeçalho de
      `schema.prisma:57-72`, por causa do particionamento manual de `audit_event`) migram para
      `pnpm --filter @pharos/api exec prisma migrate deploy` — a forma que o quickstart 001 já usa e
      que esta sessão verificou funcionando contra o banco do Compose.
- [ ] T067 `docs/deferred-findings.md` — correções pontuais, preservando todo texto original:
      F-18 recategorizado (D-14); F-40 marcado resolvido com data; **F-37 marcado resolvido com data
      e evidência** (`FindingRiskLink` em `schema.prisma:2798-2810`, confirmado pelo coordenador —
      matrix.md F-63); F-48 corrigido com a aritmética real (D-17) sem apagar a cifra original —
      anotar ao lado que estava errada e por quê; **F-12 e F-14 marcados resolvidos** (D-23); **F-13
      dividido** em metade fechada (boot) e metade medida-falsa-para-Chromium (D-24), preservando a
      ausência de TLS como aberta.
- [ ] T068 Triagem final: reconferir cada linha de `matrix.md` Seção 3 contra o estado real do
      código no momento da implementação (não apenas contra o que esta especificação registrou) —
      itens marcados "não medido nesta sessão" precisam de uma leitura real antes do fechamento da
      fase.
- [ ] T069 `specs/001-grc-platform-foundation/quickstart.md` linhas 91-92 — corrigir os comandos de
      migração Docker para a forma verificada no host (D-25/F-67), dizendo qual serve para
      instalação (`migrate deploy`) e qual para autoria (`migrate dev`).
- [ ] T070 Mesmo quickstart: uma frase sobre a mensagem obscura que o Compose dá quando o passo
      `Copy-Item .env.example .env` (já documentado na linha 43) é pulado — não uma mudança de
      fluxo, só uma nota de diagnóstico (D-25).
- [ ] T071 Documentar cobertura de navegador exatamente como é (D-19) em todo lugar que a descreve,
      incluindo a nova nota de F-13/D-24 (escopo explícito "Chromium" na garantia de cookie de
      sessão).
- [ ] T081 [Agente B, dono de `apps/api/package.json`/scripts] `apps/api/vitest.config.ts` — estreitar
      `include` para `test/unit/**/*.spec.ts`/`src/**/*.spec.ts` (D-26/F-68). Confirmar antes que
      nenhum quickstart usa `pnpm --filter @pharos/api run test -- <padrão>` mirando um spec fora de
      `test/unit` (005 e 006 usam essa forma; seus alvos continuam funcionando).
- [ ] T082 [Agente B] Acrescentar `"test": "vitest run"` a `apps/web/package.json`.
      **Depende de**: nenhuma, paralelizável com T081.
- [ ] T083 `specs/001-grc-platform-foundation/quickstart.md:483-484` — trocar `pnpm test` pelos
      quatro comandos que a CI de fato roda, já listados individualmente acima no mesmo arquivo.
      **Depende de**: T081, T082.
- [ ] T085 `docs/architecture/grc-roadmap.md` — adendo datado corrigindo as Fases 2-5 (já entregues)
      e a recomendação de próximo módulo (D-28), preservando o texto original marcado superado.
- [ ] T086 `docs/architecture.md` — três correções factuais por adendo (D-28): tabela-resumo (seis
      módulos de negócio, não um); lista de capacidades do núcleo alinhada com a seção "known gaps"
      do mesmo documento; exemplo de "módulo número dois" reformulado em torno de um módulo
      realmente construído.
- [ ] T087 Reconciliar as caixas de tarefa de `specs/002-shared-grc-foundation/tasks.md`,
      `specs/003-controls-management/tasks.md` e `specs/004-compliance-management/tasks.md` contra o
      commit de fechamento de cada fase (D-29/F-70) — linha datada no topo de cada arquivo, nenhuma
      caixa marcada por inferência, cada uma citando o arquivo/commit que a comprova.
- [ ] T088 Resolver a ambiguidade do T071 de `004-compliance-management` (relatório sobre
      `ControlEffectivenessPort`): registrar explicitamente "encaixou em todo lugar, nada a
      relatar", no formato que o T058 irmão de `003-controls-management` já usa.
      **Depende de**: T087 (mesma reconciliação).

---

## Frente H — Seletores de vínculo buscáveis (achado novo F-66/D-22) — propriedade de arquivo A DEFINIR

**Esta frente não tem dono declarado no mapa de três agentes vigente** (plan.md, "Lacuna de
propriedade") — `packages/design-system` e os componentes de
`features/{controls,compliance,audit-engagements,findings}` não pertencem a nenhum dos três. As
tarefas abaixo estão prontas para execução assim que o coordenador atribuir um dono; a correção das
duas especificações E2E (T078/T079) já tem dono claro (Agente C).

- [ ] T072 [dono a definir] Novo primitivo buscável em `packages/design-system` — busca no servidor
      conforme o usuário digita (debounce), usando o parâmetro `q` que cada API já aceita; declara
      explicitamente quando a lista mostrada é parcial; toda string por prop, pt-BR, dos catálogos
      centralizados (§11.1).
- [ ] T073 [dono a definir] Verificação renderizada do primitivo (§18.11): teclado, nome acessível,
      os dois temas — antes de qualquer consumidor real o adotar.
      **Depende de**: T072.
- [ ] T074 [dono a definir] `risk-controls-section.tsx` (3 usos, linhas 362/378/394) migra para T072.
      **Depende de**: T073.
- [ ] T075 [dono a definir] `control-links-section.tsx` (2 usos, linhas 418/434) migra para T072.
      **Depende de**: T073.
- [ ] T076 [dono a definir] `requirement-controls-section.tsx:111` e `audit-scope-control-picker.tsx:56`
      migram para T072.
      **Depende de**: T073.
- [ ] T077 [dono a definir] `finding-links-section.tsx` — os dois seletores (controle e risco)
      migram para T072; `ensureOptionsLoaded` deixa de cachear uma busca vazia única.
      **Depende de**: T073.
- [ ] T078 [Agente C] `assets-processes.spec.ts:296,302` — parar de presumir que o registro
      recém-criado está na primeira página; buscar pelo próprio código.
      **Depende de**: T072 (o comportamento de busca precisa existir no catálogo de ativos/processos
      também, mesmo que esse catálogo não seja um dos nove seletores de vínculo — confirmar se usa o
      mesmo primitivo ou um mecanismo de busca já existente próprio).
- [ ] T079 [Agente C] `risk-treatment.spec.ts:78` — buscar `FIXTURE-CONTROL-1` pelo código em vez de
      presumir que está entre os primeiros 25.
      **Depende de**: T074.
- [ ] T080 [dono a definir] Prova negativa e critério de aceitação (SC-013): contra o banco de
      desenvolvimento como está (57 controles, 26 ativos numa unidade), as três jornadas de T078/T079
      passam, e um teste prova que um seletor alcança uma entrada fora da primeira página —
      **nunca** por aumento de `DEFAULT_PAGE_SIZE` (proibido, FR-025n).
      **Depende de**: T074-T079.

---

## Dependências entre frentes (resumo)

```
A (migração) ──► A (domínio) ──► A (identidade/auditoria) ──► A (vencimento)
                                      │
                                      ▼
D (schema, Agente A) ──► D (repositório, Agente C)
                                      │
B (geração/validador, com T030a bloqueando T031) ──┴──► B (regenerar Risks/Platform por último, depois de A)
C (fronteiras) — independente de A/B/D
E (E2E/CI) — independente de A/B/C/D, mas ci.yml é do Agente B
F (armazenamento/instalação) — medido, independente das demais
G — a maioria independente; T062/T063 (auditoria de login) sem dependência; T067 depende de D-13/D-14/D-17/D-23/D-24/F-63 já decididos (estão)
H — bloqueada pela decisão de propriedade de arquivo; T078/T079 (E2E) são do Agente C e podem esperar o resto
```

## MVP

Frente A sozinha (T001-T026) já entrega o item mais citado como bloqueante pelo roadmap (CLAUDE.md
§17: esta convergência precisa fechar antes de Incidentes começar). As demais frentes são
independentes entre si e podem correr em paralelo depois que A começa — exceto H, que aguarda
decisão de propriedade.

## Cobertura

Toda User Story de `spec.md` (US1-US8) tem pelo menos uma tarefa nomeada acima. Toda linha
`confirmado` de `matrix.md` Seções 1-2 e todo item novo da Seção 4 tem uma tarefa correspondente,
exceto os itens explicitamente listados na cauda da Seção 5 (capacidade futura, não desta fase).
