# Estado do trabalho — retomada a partir do repositório

> **Documento histórico — registro de fechamento da fase 009 (Indicadores e Relatórios).** Não
> descreve necessariamente o estado atual do produto. Fonte vigente:
> [`docs/STATE.md`](../../docs/STATE.md) e
> [`docs/modules/indicators-reports.md`](../../docs/modules/indicators-reports.md).

Este arquivo existe para que outro contexto possa continuar **sem depender de nenhuma conversa
anterior**. Ele registra onde a fase está, o que falta, as decisões que não podem ser reabertas e o
próximo passo exato — seguindo a forma e o rigor de `specs/008-incidents-problems/STATE.md`, não o
seu conteúdo.

**Última atualização**: 2026-09-12 (ver §0.2 para o corte mais recente — commits `6e66e2c` a
`5c24606`, reconciliação de `tasks.md` e desta atualização). **Diferença importante em relação ao
`STATE.md` de `008`**:
aquele documento fechava uma fase quase inteira, reconciliada por leitura de código depois do fato.
Este documento abre uma fase que **começou nesta mesma sessão** — antes dela, 71 tarefas em
`tasks.md`, nenhuma iniciada. Tudo abaixo é, portanto, um corte no meio de um trabalho em andamento,
não um fechamento.

**Método**: cada afirmação de estado carrega uma marca — VERIFICADO (execução real, nesta sessão, ou
leitura direta do código/schema), NÃO VERIFICADO (não executado contra o código atual — nunca
apresentado como se tivesse passado), ou BLOQUEADO (depende de algo fora deste repositório).
**Nenhuma tarefa de `tasks.md` foi marcada `[x]` ainda** — o coordenador revisa cada uma antes de
marcar, e esta atualização de `STATE.md` não antecipa esse julgamento.

---

## 0. Atualização — 2026-09-11, commits `e01ff32` e `e706e98` (posteriores à escrita original deste documento)

Este documento foi escrito, como a nota do topo já registra, no meio de um trabalho em andamento,
enquanto três frentes trabalhavam simultaneamente em `apps/**`. Desde então, dois commits fecharam a
Fase 2 inteira e corrigiram o defeito de harness E2E que a §2 original não conhecia ainda. Esta seção
é a atualização; o corpo do documento abaixo permanece como registro histórico do corte no tempo em
que foi escrito, e é reconciliado pontualmente onde entrava em contradição direta com o que segue.

**T001-T005, T007-T014 — ENTREGUE**, commit `e01ff32`
(`feat(indicators,reports): Phase 7 foundation — schema, registries, no use case yet`). Confirmado por
`git show --stat e01ff32` e por leitura direta de trechos do diff: os `.gitkeep` de T001, o
schema/migração de T002, os allow-lists de auditoria de T003/T011 (`indicator-audit-allowlist.ts`,
`report-audit-allowlist.ts`, `audit-field-allowlist.spec.ts` estendido), os prefixos de código de T005,
as mensagens pt-BR do lado web de T007, as seis permissões e o papel Read Only de T008/T009, **T010**
confirmado por leitura direta do diff — `IndicatorsModule` chama
`registerCommentableEntityType('INDICATOR', this.parentRecordAccessor)`, não apenas o rótulo parcial
que a tabela §1 (linha T010) registrava antes deste commit —, o catálogo estático de métricas com
teste de exaustividade de T012 (`indicator-metric-catalog.ts` + `indicator-metric-catalog.spec.ts`,
134 linhas de teste), a função pura de limiar de T013 (`indicator-threshold.ts` +
`indicator-threshold.spec.ts`, 99 linhas) e a leitura escopada de T014
(`indicator-parent-record-accessor.ts`). A tabela §1 abaixo está desatualizada nesses pontos e é
corrigida inline.

**T006 — permanece NÃO INICIADO, ao contrário do que uma leitura apressada do commit poderia sugerir.**
Verificado por leitura direta do arquivo depois do commit: `apps/api/src/shared/messages/indicators.ts`
cresceu neste commit, mas seu próprio cabeçalho continua dizendo, literalmente, "This file is a
MINIMAL, foundation-only subset — just `entityLabel` ... Fase 1's own T006 ... is separate, out of
this task's scope, and adds to this same file rather than replacing it." Não existe
`apps/api/src/shared/messages/reports.ts` no lado API em nenhum commit até `e01ff32` inclusive
(confirmado por listagem de diretório). T006 continua bloqueando T042 (Fase 5) exatamente como a
tabela §1 e a §10 originais já registravam — nenhuma mudança de estado aqui.

**Nenhuma tarefa de `tasks.md` foi marcada `[x]` neste commit** — a mesma disciplina que a nota do
topo já registrava continua valendo; isto é leitura de código, não leitura do arquivo de tarefas.

**Bateria local, medida contra `e01ff32`** (CI remota ainda bloqueada por billing, F-58): API unit
**50 arquivos / 509 testes** (todos passando — a lacuna de 484/485 que a §2 original registra está
fechada; T011 é exatamente a tarefa que fechou), contrato **53 arquivos / 728 testes**, integração
**45 arquivos / 235 testes**, typecheck, lint, format:check e os dois builds (API e web) — todos
verificados passando. Contrato e integração mantiveram os mesmos números da medição anterior (nenhum
controller/rota nasceu nesta fase, por desenho — fundação apenas). Web unit **não foi reexecutado**
contra este commit nesta atualização; o número de 596 testes citado na §2 original permanece **NÃO
VERIFICADO CONTRA O CÓDIGO DE `e01ff32`**.

**E2E, commit `e706e98`** (`fix(e2e): the suite assumed a freshly seeded database and broke on a real
one`): a suíte completa de Chromium, antes deste commit, terminava em 3 aprovados / 20 falhas / 94 não
executados contra o banco de desenvolvimento real desta máquina — causa raiz identificada e corrigida:
`getByRole('option').first()` na seleção de unidade organizacional em formulário selecionava
silenciosamente uma de duas unidades órfãs deixadas por uma verificação manual antiga (ordenadas antes
de "Vértice GRC" por nome), produzindo um gestor fora da linha organizacional da unidade e um 422 real
de `POST /risks` — o produto reagiu corretamente a um dado de teste inválido. Após a correção (seleção
determinística por nome, `apps/web/e2e/support/org-units.ts`), a suíte terminou em **20 aprovados, 9
falhas, 88 não executados**. As falhas remanescentes têm causa **diferente e já isolada**: o
`ThrottlerGuard` global de abuso da API (não o limitador de login), que devolve 429 em refetches
imediatos após escrita bem-sucedida sob carga de múltiplos workers Playwright — registrado como achado
novo, **F-59** em `docs/deferred-findings.md`, com a distinção explícita de F-48 (limitador de login,
já documentado, e cuja dor local passou a ter explicação de paridade de ambiente em
`docs/local-environment.md` D-23). `THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS` não foram alterados —
decisão de configuração de ambiente de teste permanece em aberto, ver F-59.

**Defeito de produto encontrado nesta bateria, em correção por outra frente**: o toast de sucesso viola
contraste WCAG AA em tema claro — `#70ad97` sobre `#f2f9f8`, contraste medido **2.42:1**, exigido
**4.5:1**, no cenário de acessibilidade "toast notification has no axe violations (light)". É o
segundo episódio no mesmo componente (`apps/web/src/components/ui/sonner.tsx`) — o comentário do
arquivo credita a correção anterior (`d1bc2cb`) com ter medido ≥4.5:1, e a medição desta sessão
desmente essa afirmação. Está sendo corrigido agora por outra frente de trabalho (fora do escopo desta
atualização de documentação, que não toca `apps/**`). Registrado aqui como **encontrado, em correção,
NÃO VERIFICADO por este documento** — a confirmação de que o contraste corrigido de fato atinge 4.5:1
cabe a quem fechar essa correção, com medição renderizada, não a esta entrada.

**Inconsistência interna do `spec.md`, encontrada e resolvida por leitura de código, registrada aqui
para não se repetir**: a tabela de relacionamentos de `spec.md` (linha 452, "Comentários/Anexos
brutos") afirma que Indicador **não** recebe comentários nesta fase ("`CommentableEntityType` hoje
cobre só `RISK`/`INCIDENT`/`PROBLEM`"), enquanto **FR-018** e **FR-033** do mesmo `spec.md`, e o
comentário escrito junto com a migração no schema, dizem o oposto: Indicador é comentável e **nunca**
anexável. A implementação (`e01ff32`) seguiu FR-018/FR-033 e o schema, não a tabela de relacionamentos
— o próprio commit registra a escolha ("The schema comment and the functional requirements won").
`CommentableEntityType` ganhou `INDICATOR`; `AttachableEntityType` não foi tocado. Quem revisar
`spec.md` no futuro deve corrigir a linha 452 para refletir FR-018/FR-033, não o contrário.

**Próximo passo real**: T010-T014 (a dependência que bloqueava o início da Fase 3, `tasks.md`
"Dependências") estão fechadas desde `e01ff32`, e a Fase 3 (US1, T015-T032) já está reportada como
**em execução** por outra frente desta mesma sessão — NÃO VERIFICADO diretamente por este documento
(nenhum arquivo sob `apps/**` de Fase 3 apareceu em `git status` no momento desta edição; esta seção
documenta apenas escopo em `docs/`/`specs/`). Ver §11 abaixo, atualizado.

---

## 0.1 Atualização — 2026-09-12, commits `ca3cd19` a `8135915` (reconciliação de `tasks.md`)

**Motivo desta seção**: dez commits chegaram a `main` nesta mesma sessão (`e01ff32` a `8135915`) e,
até este corte, nenhuma caixa de `tasks.md` tinha sido marcada — o mesmo defeito que
`specs/008-incidents-problems/STATE.md` §1 já teve de registrar (tarefas e código fora de sincronia)
estava prestes a se repetir aqui. Esta seção reconcilia `tasks.md` contra o código commitado e
substitui, no que houver contradição direta, as afirmações de §1/§2/§10/§11 abaixo — que permanecem
como registro histórico do corte em que foram escritas.

**Commits desta sessão, do mais antigo ao mais recente**: `e01ff32` (fundação Fase 2), `e706e98` (fix
e2e — seleção determinística de unidade organizacional), `fcaec35` (docs), `6491320` (fix test),
`ca3cd19` (docs — dois achados novos), `4043ce0` (fix a11y — contraste do toast), `da6db1d` (catálogo
pt-BR e tipos gerados — fecha T006/T007 do lado API), `fe99a79` (test a11y — varredura espera
animação terminar), `48b316b` (Design System — `MetricCard`, `ThresholdBreachBadge`, `TrendChart`,
T057-T059), `8135915` (onze provedores de métrica + `IndicatorCalculationService`, T019-T029).

**Tarefas marcadas `[x]` em `tasks.md` nesta reconciliação (28 ao todo)**: T001-T014 (fundação
completa das Fases 1-2 — inclui T006, que a §0 acima registrava como não iniciada; fechada por
`da6db1d`, que criou `apps/api/src/shared/messages/reports.ts` e completou `indicators.ts` além do
subconjunto mínimo que T010 tinha criado), T019-T029 (onze `IndicatorMetricProvider` mais
`IndicatorCalculationService`, commit `8135915`, com os provedores não exportados do módulo), T057-
T059 (três componentes do Design System, commit `48b316b`) — nestas três últimas, `tasks.md` carrega
na própria linha a ressalva exigida pelo §18.1: entregues, mas **NÃO VERIFICADAS em navegador**,
porque nenhuma tela ainda as consome; o portão do §18.11 fica aberto até T060/T061/T066.

**Explicitamente deixadas sem `[x]`, apesar de trabalho em andamento ou de nome parecido**:
- T015-T017 e T030-T031 (contrato e implementação de `GET /indicators/{metricKey}/current`) — **EM
  ANDAMENTO**, não concluído. Não presumir entregue por T019-T029 já existirem.
- T018 (`CreateIndicatorDefinitionUseCase`) e T032 (teste de integração de paridade de escopo, nove
  domínios) — **NÃO INICIADO**.
- T064 — permanece **sem** `[x]`. Já estava marcada OBSOLETA em `tasks.md` desde 2026-09-11 (o
  trabalho que pedia foi entregue por `cffb553`, antes desta fase começar); marcá-la `[x]` agora
  repetiria exatamente o erro que a nota da própria tarefa já previne.
- Fases 4-7 e 9 inteiras (T033-T056, T060-T063, T065-T071) — **NÃO INICIADO**.

**Bateria local, medida em série no commit `8135915`** (a razão de "em série" está na quinta decisão
abaixo) — todos os números **VERIFICADOS** pelo coordenador nesta sessão: API `test:unit` **51
arquivos / 518 testes**; `test:contract` **53 arquivos / 728 testes**; `test:integration` **45
arquivos / 235 testes**; `lint`, `typecheck`, `format:check` e `openapi:check` — todos limpos. Web
`test:unit` **110 arquivos / 603 testes**. Isto substitui os números de §2 (509/509 contra `e01ff32`,
com web unit então NÃO VERIFICADO) — a árvore está verde neste corte, incluindo o lado web, que não
tinha sido reexecutado nas duas atualizações anteriores.

**Decisões do coordenador tomadas nesta sessão, registradas para não serem reabertas**:

1. **Papel "Auditor" estendido** com `indicator:view`/`report:view`. Razão: toda fase anterior que
   acrescentou um domínio operacional legível estendeu esse mesmo leitor global, com a razão escrita
   no próprio seed, e a descrição do papel promete leitura de toda a plataforma — deixá-lo de fora
   repetiria a lacuna que `005` e `008` já corrigiram.
2. **`COMPLIANCE_PERCENTAGE` não aciona a marca de auditoria por requisito.** O adaptador
   organization-wide faz leituras Prisma próprias em vez de reutilizar
   `RequirementComplianceReaderService`, evitando importar o módulo de Conformidade inteiro. O
   **cálculo** continua sendo o único (`calculateRequirementComplianceState`), então CLAUDE.md §19.7
   está satisfeito. Decisão **aceita** pelo coordenador: o agregado não expõe o estado de nenhum
   requisito individual, e auditar toda leitura agregada inundaria a trilha. Não reabrir por engano.
3. **`ACTION_OVERDUE_COUNT` expressa o predicado de atraso em SQL**, reutilizando a constante
   compartilhada `OVERDUE_ELIGIBLE_ACTION_STATUSES` de `overdue.service.ts`, porque `isActionOverdue`
   é função sobre objeto já carregado e não serve como cláusula `WHERE`. **Pendência com dono — a
   própria T032**: um teste de integração precisa provar que a contagem via SQL é idêntica à
   contagem obtida aplicando `isActionOverdue` às mesmas linhas. Razão: F-24, o achado que registrou
   o custo de haver quatro expressões independentes do mesmo predicado.
4. **Defeito de fiação `@Global()` corrigido, e um irmão latente registrado.** Oito módulos finos de
   porta eram `@Global()` sem que seus consumidores os importassem explicitamente; o teste de
   contrato de Controles, que monta grafo parcial via `overrideModule`, quebrou de verdade e expôs o
   problema. Corrigido tornando a dependência explícita. Os cinco `*LinkReadModule` do commit
   `2a39b52` têm o mesmo risco estrutural e **nunca falharam** só porque nenhum teste substitui
   aqueles módulos ainda — **EM ANDAMENTO por outra frente** nesta mesma sessão, fora do escopo desta
   atualização de documentação.
5. **Lição de processo, não defeito de produto**: duas suítes de contrato rodaram simultaneamente
   contra `vertice_grc_test` nesta sessão, truncando as fixtures uma da outra e produzindo duas
   falhas diferentes e não reprodutíveis — inclusive num arquivo de dados de referência sem relação
   com esta fase. É exatamente o que CLAUDE.md §22 proíbe. A partir daí as suítes passaram a ser
   executadas em série — é o motivo da bateria acima ter sido medida "em série no commit `8135915`".

**Próximo passo exato, atualizando §11 abaixo**: concluir T015-T017/T030-T031 (endpoint de valor
atual e seus testes de contrato — **EM ANDAMENTO**, não presumir entregue), depois T018
(`CreateIndicatorDefinitionUseCase`) e T032 (teste de integração de paridade de escopo, com a guarda
de SQL-vs-`isActionOverdue` da decisão 3 acima incluída), fechando a Fase 3 (MVP). Em seguida, Fase 4
(US2 — histórico organização inteira, T033 em diante).

---

## 0.2 Atualização — 2026-09-12, commits `6e66e2c` a `5c24606` (Fase 7 quase completa; interface parcial)

**Motivo desta seção**: dez commits adicionais chegaram a `main` desde `8135915` (o corte de §0.1),
fechando a Fase 3 inteira, as Fases 4 a 7 inteiras, a maior parte da Fase 8 (interface) e a guarda
estrutural de SC-005 (T069) — sem que `tasks.md` tivesse sido reconciliado até este corte. Esta
seção fecha essa lacuna e substitui, no que houver contradição direta, as afirmações das seções
anteriores, que permanecem como registro histórico do corte em que foram escritas.

**Commits desta atualização, do mais antigo ao mais recente, com o que cada um entrega — verificado
pelo coordenador**:

| Tarefas | Commit | Entrega |
|---|---|---|
| T015-T018, T030, T031 | `6e66e2c` | `GET /indicators`, `POST /indicators`, `GET /indicators/{metricKey}/current`, com 20 testes de contrato. Autorização de duas camadas: `indicator:view` no controller, e a `sourcePermission` da chave verificada no caso de uso depois de resolver o catálogo. |
| T032 | `aa0a312` | 11 testes de paridade de escopo, contagem esperada por consulta independente; mais a guarda que prova que a contagem de ação atrasada por SQL é idêntica à obtida aplicando `isActionOverdue` às mesmas linhas (decisão 3 de §0.1). |
| T033-T038 | `0cf985a` | `POST`/`GET /indicators/{metricKey}/measurements`, escopo `GLOBAL` exigido e verificado antes de qualquer leitura de fonte; imutabilidade provada por `404`/`405` de roteamento, nunca `403`. |
| T039-T042 | `9d885f9` | Notificação de rompimento de limiar — primeiro produtor real de `NotificationService`, lida do repositório real e não de dublê. |
| T043-T046 | `dd64cb4` | `ActionOriginType += INDICATOR`, migração própria junto do acessor, com experimento de remoção provando a guarda de convergência. |
| T047-T056 | `2e52cfd` e `063dae0` | Camada de aplicação de Relatórios com CSV escrito à mão, e as três rotas com JSON e CSV numa rota só. |
| T060, T062 | `d2a3c8a`, `893f33a` | Camada de feature e telas de Indicadores. |
| T061 | `e18e26d` | Telas de Relatórios, com download de CSV verificado em navegador real. |
| T069 | `5c24606` | Guarda estrutural de SC-005, com experimento de mutação executado. |

**Tarefas marcadas `[x]` em `tasks.md` nesta reconciliação**: T015-T018, T030-T032, T033-T038,
T039-T042, T043-T046, T047-T056, T060-T062, T069 — 35 caixas, somadas às 28 já marcadas em §0.1
(total: **63 de 71**). T060/T061/T062 carregam, na própria linha de `tasks.md`, a ressalva de que a
verificação renderizada de Indicadores foi feita enquanto o banco ainda recusava permissão (decisão
3 abaixo, detalhe em §7) e que a recaptura com dado real é parte de T066, ainda em andamento. As
ressalvas de T057-T059 (§0.1, "nenhuma tela ainda consome") permanecem escritas em `tasks.md` por
registro histórico — hoje já obsoletas nesse ponto específico, porque T060-T062 passaram a consumir
os três componentes —, mas a conclusão de que a verificação renderizada está **completa** ainda não
pode ser feita: falta T066.

**Explicitamente deixadas sem `[x]`, EM ANDAMENTO** (não presumir concluídas por proximidade com
tarefas já fechadas): T063 (navegação — `navigation-registry.ts`), T065 (varredura de acessibilidade
axe) e T066 (captura renderizada com `ui-capture.mjs`); e T068 (portão de cobertura de contrato),
este último junto das **cinco operações contratadas que faltavam** — ver decisão 1 abaixo.

**Não iniciado**: T067, T070, T071.

**Números medidos em série pelo coordenador** — cada um **VERIFICADO no momento da própria medição**,
mas o conjunto é **NÃO VERIFICADO para o estado atual do repositório**: nenhuma execução completa
da bateria aconteceu **depois** de `e18e26d`; T070 é a tarefa que produz a medição de fechamento da
fase, e nenhuma afirmação de "está tudo verde" pode ser feita antes dela rodar.

- No commit `dd64cb4`: API `test:unit` **55 arquivos / 549 testes**; `test:integration` **52
  arquivos / 258 testes**; `test:contract` **55 arquivos / 778 testes**.
- No commit `5c24606`: API `test:unit` subiu para **56 arquivos / 560 testes**, com a guarda
  estrutural nova de T069.
- No commit `e18e26d`: Web `test:unit` **123 arquivos / 661 testes**.

Não medidos nesta janela (e portanto NÃO VERIFICADOS): `test:contract`/`test:integration` da API
depois de `dd64cb4` (T047-T069 podem ter acrescentado testes de contrato/integração sem que a
contagem tenha sido reconfirmada), `test:e2e`, `lint`, `typecheck`, `format:check`, `openapi:check` e
os dois builds — todos contra o código atual.

**Decisões do coordenador desta rodada, registradas para não serem reabertas**:

1. **Lacuna entre contrato e tarefas, descoberta e fechada.** Os dois contratos
   (`contracts/indicators.openapi.yaml`, `contracts/reports.openapi.yaml`) declaravam operações que
   nenhuma tarefa de `tasks.md` cobria — oito declaradas contra cinco implementadas em Indicadores
   (faltavam `listIndicatorMetricKeys`, `getIndicatorDefinition`, `updateIndicatorDefinition`), cinco
   contra três em Relatórios (faltavam `getReportDefinition`, `updateReportDefinition`). Operação
   contratada e não implementada é exatamente o que o portão de cobertura (T068) existe para pegar —
   este repositório já pagou três vezes por essa mesma classe de defeito (F-31, e o próprio §3 de
   `specs/005-audit-findings/STATE.md`, que T068 já cita em `tasks.md`). Por isso o coordenador
   autorizou implementar as cinco operações faltantes primeiro, e só então os dois contratos entram
   em `CONTRACT_SOURCES` (T068) — nunca o inverso, que deixaria o portão vermelho, ou pior, verde
   sem proteger nada. **Esta lacuna não estava registrada em `tasks.md`** antes desta rodada; foi
   encontrada porque um agente recusou uma instrução do coordenador que teria deixado o portão
   vermelho — a recusa estava certa. T068 permanece **EM ANDAMENTO** até as cinco operações e os
   dois contratos fecharem juntos, na mesma tarefa.
2. **Unidade organizacional de uma `Action` de origem Indicador.** A coluna `org_unit_id` de
   `Action` é obrigatória, e `IndicatorDefinition` não tem unidade (research.md D-8). Decidido: a
   `Action` recebe a unidade **do responsável (owner) pelo indicador**, re-resolvida no momento da
   criação da ação — nunca a unidade de quem executa a ação —, reusando o mesmo conceito de "dono"
   que a decisão D-7 (notificação de rompimento) já emprega. Estável por origem: a unidade gravada na
   ação não muda retroativamente se o dono do indicador mudar depois. Recusa (erro explícito, nunca
   um valor default silencioso) quando o dono do indicador não tem unidade organizacional própria.
   **Nenhum documento da fase (spec.md, research.md, data-model.md) resolvia esta pergunta antes** —
   é decisão nova do coordenador, tomada durante T043-T046, e fica registrada aqui como não
   reabrível.
3. **Dado de seed defasado no banco de desenvolvimento** — registrado em detalhe no §7 (armadilhas
   de ambiente) abaixo, com o sintoma exato para a próxima sessão reconhecer sem repetir o
   diagnóstico.
4. **Contaminação do cliente Prisma compartilhado durante o experimento de mutação de T069** —
   registrada em detalhe no §7 (armadilhas de ambiente) abaixo.

**Próximo passo exato, atualizando §11 abaixo**: concluir T063 (navegação — desbloqueada agora que
T060/T061 existem), T065 (varredura axe, dois temas, conteúdo real renderizado) e T066 (captura
renderizada com `ui-capture.mjs`, incluindo a recaptura de Indicadores com o seed corrigido — decisão
3/§7); em paralelo, fechar T068 implementando as **cinco operações contratadas que faltavam**
(`listIndicatorMetricKeys`, `getIndicatorDefinition`, `updateIndicatorDefinition`,
`getReportDefinition`, `updateReportDefinition`) e só então acrescentando os dois contratos a
`CONTRACT_SOURCES`. Depois, nesta ordem: T067 (linha de base de testes, comparando com os números
acima), T070 (suíte completa — `test:unit`, `test:contract`, `test:integration`, `test:e2e` — a
primeira execução completa desde `e18e26d`, e a medição que fecha a fase) e T071 (revisão final
`Indicator`/`Report` arquivo a arquivo). Isto fecha a Fase 7.

---

## 1. Onde a fase está

**Nota sobre concorrência**: esta atualização de `STATE.md` foi escrita enquanto três frentes de
implementação trabalhavam simultaneamente em `apps/**`. Alguns arquivos (por exemplo,
`apps/api/src/shared/messages/indicators.ts`) surgiram como trabalho parcial de uma tarefa
posterior (T010) durante a própria escrita deste documento — sinal de que a árvore continua em
movimento. Trate a tabela abaixo como um corte no tempo, não como garantia de que nada mudou entre
a escrita e a leitura.

| Tarefa/Grupo | Estado | Evidência |
|---|---|---|
| T001 — pastas dos dois módulos | **ENTREGUE** | `apps/api/src/modules/{indicators,reports}/{domain,application,infrastructure,presentation}/` — cada subpasta vazia usa `.gitkeep`, confirmado por listagem de diretório nesta sessão (`domain/`, `application/`, `infrastructure/`, `presentation/` de ambos os módulos). Ver §3 sobre a correção de `tasks.md` que esta decisão registra. |
| T002 — enums e três modelos no `schema.prisma` | **ENTREGUE** | `IndicatorMetricKey` (onze valores), `IndicatorThresholdComparator` (quatro), `IndicatorDefinition`, `IndicatorMeasurement`, `ReportDefinition`. Nenhuma coluna de unidade organizacional em nenhum dos três (research.md D-8/D-6 — decisão registrada, não esquecimento). |
| T003 — `AuditEntityType`/`CommentableEntityType` estendidos | **ENTREGUE** | `AuditEntityType` +`INDICATOR`, +`INDICATOR_MEASUREMENT`, +`REPORT`; `CommentableEntityType` +`INDICATOR`. `ActionOriginType` **não** foi tocado — de propósito, fica para T043 junto com o acessor (CLAUDE.md §19.10, mesma disciplina que `008` já registrou em `research.md` D-5). |
| T004 — migração `20260911040000_indicators_reports_foundation_baseline` | **VERIFICADO, nos dois bancos locais** | Verificação objeto-por-objeto pelo coordenador: onze valores de `IndicatorMetricKey` e quatro de `IndicatorThresholdComparator` na ordem declarada; três tabelas com 12/7/9 colunas conferidas uma a uma contra `data-model.md`; 7 índices e 4 chaves estrangeiras conferidos; `information_schema.columns` de toda tabela pré-existente comparado byte a byte, zero diferenças; contagens de linha idênticas antes/depois em `risks` (200), `controls` (72), `requirements` (28), `assets` (41), `processes` (41), `actions` (55), `incidents` (27), `problems` (19), `findings` (50). |
| T005 — `EntityCodePrefix`/`ENTITY_CODE_PATTERN` +`IND`/+`RPT` | **ENTREGUE** | `apps/api/src/grc/shared/domain/entity-code.service.ts` — confirmado nesta sessão por leitura direta (linhas 90-152: comentário de atualização T005, `'IND'`/`'RPT'` no union type, no mapa `EntityCodePrefix` e no regex `ENTITY_CODE_PATTERN`). Ver §4 sobre a lacuna de cobertura de teste, pré-existente às oito fases anteriores. |
| T006 — `apps/api/src/shared/messages/indicators.ts`/`reports.ts` | **ENTREGUE — ver §0.1** (commit `da6db1d`) | Descrição abaixo é o corte anterior a `da6db1d`, mantida por registro histórico: `apps/api/src/shared/messages/indicators.ts` existia apenas como subconjunto mínimo criado por T010, e `reports.ts` (lado API) não existia. **Fechado em `da6db1d`**: os dois arquivos completos, ligados em `user-messages.ts`. Não presumir T006 concluída por causa apenas do arquivo parcial anterior — a evidência é o commit posterior. |
| T007 — `apps/web/src/lib/messages/indicators.ts`/`reports.ts` | **ENTREGUE** | Registrados em `apps/web/src/lib/messages/index.ts`, com os onze rótulos pt-BR de métrica e os quatro de comparador. Confirmado nesta sessão por leitura do cabeçalho de `indicators.ts`. Ver §5 sobre a pendência nomeada de T012 (tipo `Record<string, string>` provisório). |
| T008/T009 — seis permissões + catálogo + papel "Read Only" | **ENTREGUE** | `indicator:view/create/edit`, `report:view/create/edit`, todas reusando valores existentes de `PermissionAction` — sem migração. Confirmado nesta sessão por `grep` em `apps/api/src/permission-catalogue.ts` (linhas 62/65/100: import de `INDICATOR_PERMISSION_DEFINITIONS`/`REPORT_PERMISSION_DEFINITIONS`, comentário "the ninth and tenth business modules"). Papel "Read Only" estendido com `indicator:view`/`report:view`. `apps/api/test/unit/permissions.spec.ts` cresceu junto, somando o comprimento de todos os conjuntos — sem afrouxar a guarda. |
| T010 — `INDICATOR` em `registerCommentableEntityType` | **ENTREGUE — ver §0** (commit `e01ff32`) | Descrição abaixo é o corte anterior a `e01ff32`, mantida por registro histórico: parte da Fase 2 desta sessão, `apps/api/src/shared/messages/indicators.ts` já existia com `entityLabel: 'Indicador'`, criado como trabalho parcial desta tarefa — mas, no momento em que este documento foi escrito originalmente, nenhuma chamada a `registerCommentableEntityType('INDICATOR', ...)` havia sido encontrada. **Fechado em `e01ff32`**: `IndicatorsModule` chama `registerCommentableEntityType('INDICATOR', this.parentRecordAccessor)` — confirmado por leitura direta do diff, não por grep no estado final apenas. |
| T011 — allow-list de auditoria dos três tipos novos | **ENTREGUE — ver §0** (commit `e01ff32`) | Fechada; `pnpm --filter @vertice/api run test:unit` passa em 509/509 nesta bateria (§2, atualizado), não mais 484/485. |
| T012 — catálogo estático de métricas + teste de exaustividade | **ENTREGUE — ver §0** (commit `e01ff32`) | `domain/indicator-metric-catalog.ts` + `indicator-metric-catalog.spec.ts` (134 linhas), com exaustividade derivada do enum gerado, nunca de segunda lista escrita à mão (mensagem do commit). Resolve a pendência nomeada em T007 (§5) — reverificar se `apps/web/src/lib/messages/indicators.ts` já foi migrado para `Record<IndicatorMetricKey, string>` antes de fechar aquela linha de §5 também, o que **não foi verificado nesta atualização**. |
| T013 — `evaluateThresholdBreach` (função pura) | **ENTREGUE — ver §0** (commit `e01ff32`) | `domain/indicator-threshold.ts` + `indicator-threshold.spec.ts` (99 linhas); única função que calcula `breached`, lança em comparador desconhecido em vez de responder `false` em silêncio (mensagem do commit, alinhado a CLAUDE.md §19.7). |
| T014 — leitura escopada dos dois módulos | **ENTREGUE — ver §0** (commit `e01ff32`) | `indicator-parent-record-accessor.ts`; os dois ports de repositório não recebem `ScopeFilter`, com justificativa comentada em três pontos — as tabelas-fonte não têm coluna de unidade (research.md D-6/D-8), não é omissão. |
| Fase 3 (US1, T015-T032) | **PARCIAL — ver §0.1** (commit `8135915`) | T019-T029 **ENTREGUE** (onze `IndicatorMetricProvider` + `IndicatorCalculationService`). T015-T017 e T030-T031 **EM ANDAMENTO**, não concluído. T018 e T032 **NÃO INICIADO**. Não presumir a fase fechada — o checkpoint (valor atual servido por HTTP) depende de T018/T030/T031 ainda em aberto. |
| Fase 8 (interface, T057-T066) | **PARCIAL — ver §0.1** (commit `48b316b`) | T057-T059 (Design System: `MetricCard`, `ThresholdBreachBadge`, `TrendChart`) **ENTREGUE, porém NÃO VERIFICADO em navegador** — nenhuma tela consome os componentes ainda; portão do §18.11 aberto até T060/T061/T066. T060-T063, T065-T066 **NÃO INICIADO**. |
| Fases 4-7 e 9 (T033-T056, T067-T071) | **NÃO INICIADO** | — |

**28 caixas de `tasks.md` foram marcadas `[x]` nesta reconciliação (§0.1)**: T001-T014, T019-T029,
T057-T059. Isto corrige a afirmação anterior desta seção, escrita quando a Fase 3 mal tinha
começado — a mesma distinção que `008-incidents-problems/STATE.md` §1 precisou registrar quando
tarefas e código ficaram fora de sincronia é o que esta reconciliação existe para evitar aqui.

**Atualização (§0.2)**: mais 35 caixas foram marcadas `[x]` na reconciliação seguinte — T015-T018,
T030-T032, T033-T038, T039-T042, T043-T046, T047-T056, T060-T062, T069 —, somando **63 de 71**
caixas marcadas no total. T063, T065, T066 e T068 permanecem **EM ANDAMENTO**, sem `[x]`; T067, T070
e T071 permanecem **NÃO INICIADO**; T064 permanece obsoleta em prosa, nunca marcada. Ver §0.2 para
o detalhe completo, incluindo os commits e as quatro decisões desta rodada.

---

## 2. Estado de teste, medido nesta sessão

- `pnpm --filter @vertice/api run test:unit`: **484 de 485**. Única falha:
  `apps/api/test/unit/audit-field-allowlist.spec.ts` — exige allow-list de auditoria para todo valor
  de `AuditEntityType`; os três valores novos (`INDICATOR`, `INDICATOR_MEASUREMENT`, `REPORT`) ainda
  não têm um. **T011 é a tarefa que fecha isto.** Falha esperada e mecânica — consequência direta de
  T003 ter estendido o enum antes de T011 registrar as listas correspondentes — não é defeito de
  produto nem regressão inesperada.
- **A árvore NÃO está verde neste instante.** Não presumir 485/485 até T011 estar concluída e a
  suíte reexecutada.
- Todos os demais portões — typecheck, lint, format:check, audit, web unit (110 arquivos, 596
  testes), openapi:check, api-types:check, integração (45 arquivos, 235 testes), contrato (53
  arquivos, 728 testes) e build — **NÃO VERIFICADOS CONTRA O CÓDIGO DA FASE 7**. Os números citados
  são os últimos medidos nesta mesma sessão de trabalho, mas **antes** de qualquer alteração desta
  fase (medição registrada em `specs/008-incidents-problems/STATE.md` §11.5, contra o commit
  `795343b`). Mudanças de schema, permissão e código-fonte já aconteceram desde então (T001-T009);
  nenhum desses portões foi reexecutado contra o resultado.

> **Atualização, commit `e01ff32`** (ver §0 para o detalhe completo): `pnpm --filter @vertice/api run
> test:unit` passa em **509 de 509** (50 arquivos) — a falha de `audit-field-allowlist.spec.ts` acima
> está fechada, exatamente pela conclusão de T011. Contrato (53 arquivos / 728 testes) e integração (45
> arquivos / 235 testes) foram reexecutados e mantiveram os mesmos números — VERIFICADO. Typecheck,
> lint, format:check e os dois builds (API e web) — VERIFICADO, passando. **Web unit permanece NÃO
> VERIFICADO CONTRA `e01ff32`**; o número de 596 testes acima segue sendo o último medido, contra
> `795343b`. E2E Chromium, medido contra `e706e98` (posterior a `e01ff32`): **20 aprovados, 9 falhas, 88
> não executados** — as falhas atribuídas ao `ThrottlerGuard` global, F-59. Ver §0 para a análise
> completa de causa.

> **Atualização, commit `8135915`** (ver §0.1 para o detalhe completo — esta é a medição mais
> recente, e substitui as duas acima para todo portão que não seja E2E): bateria rodada **em série**
> (razão na decisão 5 de §0.1) — `test:unit` **51 arquivos / 518 testes**, `test:contract` **53
> arquivos / 728 testes**, `test:integration` **45 arquivos / 235 testes**, `lint`, `typecheck`,
> `format:check` e `openapi:check` limpos, todos VERIFICADOS. **Web `test:unit` reexecutado e
> VERIFICADO contra este commit**: 110 arquivos / 603 testes — fecha a pendência de reconfirmação que
> as duas atualizações anteriores desta seção deixaram em aberto. E2E não foi remedido nesta
> reconciliação; os números de `e706e98` acima seguem sendo os últimos conhecidos.

---

## 3. Correção de `tasks.md` registrada nesta sessão

**T001** pedia pastas com "`index.ts` de barril". O agente que executou a tarefa optou por
`.gitkeep` em cada subpasta vazia, e o coordenador aceitou a decisão: **nenhum módulo deste
repositório tem barril em subpasta** (`domain/index.ts`, `application/index.ts`, etc.) — nem
`modules/risk`, nem `modules/incidents`, nem nenhum dos outros sete. `tasks.md` presumiu um padrão
que não existe neste código-base. Isto é registrado como **correção de `tasks.md`**, não como
desvio da tarefa — quem ler T001 no futuro deve seguir o código real (`.gitkeep`), não a literal do
arquivo de tarefas.

---

## 4. Defeito encontrado e corrigido durante T002

`report_definitions.metric_keys` saía anulável no schema gerado, porque um campo de lista escalar
no Prisma só recebe `NOT NULL` quando tem `@default([])` — contrariando `data-model.md` §1, que
declara a coluna obrigatória. Corrigido no `schema.prisma` e na migração antes de fechar T002.
Registrado aqui pela mesma razão que `008`/`006` registram defeitos de schema encontrados durante a
própria implementação: verificação de que o Prisma gera exatamente a forma que o modelo de dados
pede, não a forma que parece razoável à primeira vista.

---

## 5. Lacunas de cobertura conhecidas, com dono

| Lacuna | Onde | Dono |
|---|---|---|
| Nenhum teste existe para `entity-code.service.ts`, nem para os oito prefixos anteriores a `IND`/`RPT` | `apps/api/src/grc/shared/domain/entity-code.service.ts` | A próxima tarefa que tocar o alocador de códigos — não é bloqueio desta fase, é lacuna pré-existente que esta fase herdou sem agravar nem corrigir. |
| `INDICATOR_METRIC_KEY_LABELS`/`INDICATOR_THRESHOLD_COMPARATOR_LABELS` em `apps/web/src/lib/messages/indicators.ts` são `Record<string, string>`, não `Record<IndicatorMetricKey, string>` | `apps/web/src/lib/messages/indicators.ts` (T007) | **T012 entregue em `e01ff32`** (ver §0) — `domain/indicator-metric-catalog.ts` do lado API existe, com exaustividade derivada do enum gerado. **NÃO VERIFICADO nesta atualização**: se o tipo em `apps/web/src/lib/messages/indicators.ts` já foi trocado de `Record<string, string>` para `Record<IndicatorMetricKey, string>` — essa migração do lado frontend depende de `@vertice/api-types` regenerado, e não foi confirmada por leitura nesta atualização. Reverificar antes de fechar esta linha. |
| `T006` (mensagens pt-BR do lado API) não iniciada | `apps/api/src/shared/messages/` | Fase 1, mesma sessão — bloqueia o corpo de notificação de rompimento de limiar que a Fase 5 (US3, T042) precisa. |

---

## 6. Como verificar sem se enganar

> **Atualização, `e01ff32`** (ver §0/§2): T011 já fechou, e `test:unit` já reporta **509/509**, não
> mais 484/485. O corpo original abaixo é o corte de antes desse commit, mantido por registro
> histórico — para os números atuais, usar §0/§2, não os desta seção.

Comandos reais, com os números desta sessão — **não** confiar em nenhum número anterior a T011 estar
concluída:

```
pnpm --filter @vertice/api run db:generate      # regenerar o cliente Prisma antes de qualquer coisa — ver §7
pnpm --filter @vertice/api run test:unit        # 484 de 485 nesta sessão; a única falha é
                                                # audit-field-allowlist.spec.ts, e É esperada até T011
pnpm --filter @vertice/api run typecheck && pnpm --filter @vertice/api run lint
pnpm --filter @vertice/api run test:contract
pnpm --filter @vertice/api run test:integration
pnpm --filter @vertice/web  run test:unit
pnpm --filter @vertice/api run openapi:check
pnpm run format:check
```

**Antes de confiar em qualquer contagem futura**: os números de contrato/integração/web unit acima
(728/235/596) são os últimos medidos nesta sessão, mas contra o código de `008`, **antes** de
qualquer arquivo desta fase (T001-T009) existir. Rodar de novo depois de T010-T014 é o que confirma
se algum desses números mudou — não presumir que continuam iguais.

**Sinal de que T011 está de fato concluída**: `pnpm --filter @vertice/api run test:unit` reporta
485/485, não 484/485 — nenhuma outra evidência (leitura de código, comentário, mensagem de commit)
substitui essa execução. **Esse sinal já ocorreu**: contra `e01ff32`, a suíte reporta 509/509 (o total
cresceu de 485 para 509 porque T011/T012/T013 também acrescentaram arquivos de teste novos, não só
fecharam a lacuna original) — ver §0/§2.

---

## 7. Armadilhas de ambiente

A sequência de bootstrap num clone limpo e cinco armadilhas pagas nesta sessão de trabalho estão em
`docs/local-environment.md` D-22 — não repetidas aqui.

**Específico da Fase 7, acrescentado nesta sessão**: o cliente Prisma precisa ser regenerado
(`pnpm --filter @vertice/api run db:generate`) para que os tipos de `IndicatorMetricKey`,
`IndicatorThresholdComparator`, `IndicatorDefinition`, `IndicatorMeasurement` e `ReportDefinition`
existam no código TypeScript. Essa regeneração **falha com `EPERM`** enquanto um servidor da API
estiver rodando no Windows, porque o processo em execução segura
`query_engine-windows.dll.node` — o arquivo nativo que o gerador precisa substituir. Sequência
correta: parar o servidor da API, rodar `db:generate`, subir o servidor de novo.

**Dado de seed defasado no banco de desenvolvimento, encontrado e corrigido nesta sessão** (decisão
3 de §0.2): a tabela de permissões deste banco tinha 64 identificadores e nenhum dos seis novos de
Indicadores/Relatórios, embora o seed já os declarasse no código — a tabela existente **precede** a
adição ao catálogo, e nada re-executa o seed automaticamente quando o catálogo cresce. **Sintoma**:
toda tela de Indicadores mostrava recusa de permissão (403 silencioso na interface), e a verificação
renderizada do caminho feliz ficou bloqueada até o diagnóstico. **Correção**: re-executar o seed
(a tabela passou a ter 70 permissões) **e** reconstruir a API — o servidor em execução estava
servindo um build anterior à existência do controlador de Indicadores, um segundo sintoma
independente do primeiro que mascarava a mesma causa. **Para a próxima sessão**: se uma tela nova
mostra recusa de permissão apesar de o papel do usuário logado incluir a permissão certa no código,
suspeitar primeiro de seed defasado (contar linhas da tabela de permissões contra o catálogo) e de
build da API desatualizado, antes de suspeitar de autorização quebrada.

**Contaminação do cliente Prisma compartilhado durante o experimento de mutação de T069** (decisão 4
de §0.2): o agente da guarda estrutural (SC-005) editou o `schema.prisma` real do repositório para
plantar o contra-exemplo deliberado do experimento de mutação. A geração do cliente falhou no
binário nativo por lock de arquivo do Windows (o mesmo `EPERM` de `query_engine-windows.dll.node`
descrito acima), mas os arquivos **JavaScript** do cliente Prisma **compartilhado** já tinham sido
reescritos com o campo plantado antes da falha — afetando, por um intervalo, os agentes concorrentes
de outras frentes que também importam esse cliente. O agente percebeu a contaminação, reverteu o
`schema.prisma`, regerou o cliente compartilhado e refez o experimento de mutação contra um cliente
Prisma isolado, sem repetir a exposição. **Lição de operação, não defeito de produto**: um
experimento de mutação sobre `schema.prisma` precisa rodar contra um cliente Prisma isolado sempre
que houver trabalho concorrente de outra frente no mesmo repositório — nunca contra o schema/cliente
real compartilhado, mesmo que a intenção seja reverter antes de terminar.

---

## 8. Bloqueio externo

**F-58** (`docs/deferred-findings.md`) — a CI remota do GitHub Actions não inicia; todo job falha em
1-2 segundos no passo `install (pnpm cache)` com a anotação "recent account payments have failed or
your spending limit needs to be increased". Nenhuma mudança neste repositório resolve isto — exige
ação humana na conta de billing do GitHub. **BLOQUEADO.** A bateria local (§6 acima) é a evidência
substituta enquanto o bloqueio persistir; não é substituto de igual força — commits desta fase ainda
não passaram por nenhuma execução de CI real.

---

## 9. Decisões que não devem ser reabertas

Tiradas de `spec.md` "Decisões do coordenador" (Q1-Q7) e `research.md` (D-1 a D-13). Resumidas aqui,
não reescritas — ver os documentos originais para a justificativa completa com citação de
arquivo/linha.

- **Q1/D-1** — Dois módulos distintos (`modules/indicators`, `modules/reports`), não um módulo
  único de "analytics". `Report` depende de leitura de `Indicator`, mas isso não os funde — mesma
  relação de dependência que `Problem`↔`Incident` já tem sem deixar de ser dois módulos.
- **Q1/Q2/D-2** — `IndicatorDefinition` (metadado editável) e valor "atual" (sempre recalculado,
  nunca armazenado) são conceitos distintos que nunca se misturam no mesmo registro. O histórico
  (`IndicatorMeasurement`) é a única coisa armazenada, e é append-only — sem `PATCH`/`PUT`/`DELETE`
  no contrato. `metric_key` é `UNIQUE` em `indicator_definitions`: no máximo uma definição por chave
  do catálogo.
- **Q6/D-3** — Nove domínios de negócio hoje implementados entram como fonte (dez chaves de
  catálogo, porque Auditoria/Achado são duas tabelas-fonte distintas): Risco, Controle,
  Conformidade, Auditoria, Achado, Ativo, Processo, Ação, Incidente, Problema. Nenhum domínio
  "planejado mas não construído" entra — Planos de Ação não é módulo (CLAUDE.md §17) e não tem
  chave própria; a métrica de "ações em atraso" já cobre isso via `grc/action`.
- **D-4** — `IndicatorMetricKey` é um registro fechado, verificado em compilação. Cada valor reusa
  um serviço/porta de consulta **já existente** do domínio-fonte — nunca uma consulta genérica
  parametrizável pelo cliente (proibido por CLAUDE.md §19.3, mesmo raciocínio de `related_entity`
  genérico aplicado a leitura).
- **D-5** — `ActionOriginType += INDICATOR` só acontece em T043, na mesma tarefa que o acessor
  `IndicatorActionOriginAccessor` de quatro métodos — nunca em migração separada de antes do
  acessor existir. `008-incidents-problems` já pagou o custo de separar os dois; esta fase aplica a
  lição desde o início.
- **Q1/D-6** — Histórico (`IndicatorMeasurement`) exige `ScopeFilter.kind === 'GLOBAL'` do chamador,
  tanto para criar quanto para ler — nunca por unidade, mesmo que o conjunto de unidades do
  chamador cubra hoje toda a árvore. O valor "atual" (US1), ao contrário, sempre usa o escopo real
  do chamador, `UNIT` incluso. Checagem é do **tipo** da concessão (`GLOBAL`), nunca de "a árvore
  hoje está toda coberta".
- **Q3/D-7** — Limiar rompido produz **notificação** (primeiro produtor real de
  `NotificationService`, capacidade "pronta, sem produtor" desde o blueprint), nunca uma `Action`
  automática. Toda `Action` desta plataforma nasce de decisão humana explícita — sem exceção
  introduzida por esta fase.
- **Q4/D-1/D-9** — `ReportDefinition` é uma composição nomeada e salva de indicadores já
  existentes, executada sob demanda, sob o escopo de quem executa. Não é construtor de consulta
  genérico, não é documento gerado (PDF), não é exportação agendada.
- **Q5/D-10** — Exportação apenas em CSV, gerado por código próprio, sem biblioteca nova. PDF/XLSX
  ficam de fora da v1 — exigiriam dependência nova que nenhum requisito desta fase justifica.
- **FR-004/D-8** — `IndicatorDefinition` não tem coluna de unidade organizacional. Métricas de
  Conformidade **nunca** são filtráveis por unidade (`Requirement` não tem essa coluna) — a
  resposta declara `scopeApplicability: 'ORGANIZATION_WIDE'` em vez de fingir um filtro que a fonte
  não sustenta. Nunca inferir escopo por junção com outra tabela (a mesma classe de vazamento que
  `006-assets-processes/STATE.md` §3 já fechou).
- **Q7/D-11/D-12** — `GET /dashboard` não cresce uma área por domínio novo; `Indicators` é o módulo
  que generaliza esse papel. O mecanismo de "área planejada" do Dashboard (`default-planned-areas.ts`)
  fica permanentemente vazio a partir desta fase, nunca removido do contrato, só esvaziado — e
  **T064 (`tasks.md`) já está marcada obsoleta**: a correção que ela pedia (remover `PROBLEMS`/
  `INCIDENTS` do registro) já tinha sido feita pelo commit `cffb553`, antes de esta fase começar.
  Não reabrir T064 nem tentar "completá-la" — não há mais o que fazer ali.
- **D-13** — Seis permissões novas (`indicator:view/create/edit`, `report:view/create/edit`), todas
  reusando `PermissionAction` já existente — nenhum verbo novo (`APPROVE`/`TRANSITION`/`LINK`), sem
  migração.
- **Decisão do coordenador, 2026-09-12 (§0.2, decisão 2)** — Unidade organizacional de uma `Action`
  de origem `INDICATOR`: a ação recebe a unidade **do responsável (owner) pelo indicador**,
  re-resolvida no momento da criação da ação, nunca a unidade de quem age. Reusa o conceito de dono
  que D-7 já emprega para notificação. Recusa (erro explícito) quando o dono do indicador não tem
  unidade organizacional própria — nunca um valor default silencioso. Nenhum documento da fase
  resolvia isto antes; não reabrir.

---

## 10. Pendências, com dono

> **Atualização, `e01ff32`/`e706e98`** (ver §0): T010-T014 saem desta tabela como pendência — estão
> ENTREGUES. T006 permanece como estava. Duas pendências novas entram: F-59 (limitador global
> derrubando E2E) e o defeito de contraste do toast, em correção por outra frente. A tabela abaixo é o
> corte anterior a esses dois commits, mantido por registro histórico; a lista efetiva de pendências
> abertas é a soma das linhas restantes aqui (T006, cobertura de `entity-code.service.ts`, CI bloqueada,
> web unit a reexecutar) com as duas novas.

| Item | Onde | Dono / próximo passo |
|---|---|---|
| T010 — registro `INDICATOR` como comentável | `core/comments/domain/entity-registry.ts` | **ENTREGUE em `e01ff32`** — ver §0. |
| T011 — allow-list de auditoria dos três tipos novos | `core/audit/domain/` | **ENTREGUE em `e01ff32`** — `test:unit` em 509/509 (§0/§2). |
| T012 — catálogo estático de métricas + exaustividade | `domain/indicator-metric-catalog.ts` | **ENTREGUE em `e01ff32`** — pendência de tipo em `apps/web/src/lib/messages/indicators.ts` (§5) permanece NÃO VERIFICADA quanto a ter sido de fato resolvida no frontend. |
| T013 — `evaluateThresholdBreach` | `domain/indicator-threshold.ts` | **ENTREGUE em `e01ff32`**. |
| T014 — leitura escopada dos dois módulos | `modules/{indicators,reports}` | **ENTREGUE em `e01ff32`**. |
| T006 — mensagens pt-BR do lado API | `apps/api/src/shared/messages/{indicators,reports}.ts` | **ENTREGUE em `da6db1d`, ver §0.1.** Necessária para T042 (corpo da notificação de rompimento, Fase 5), ainda não iniciada. |
| Cobertura de teste ausente para `entity-code.service.ts` | `grc/shared/domain/entity-code.service.ts` | A próxima tarefa que tocar o alocador — não é bloqueio desta fase (§5). |
| CI remota bloqueada por billing | GitHub Actions | Ação humana na conta de billing — F-58, fora do alcance de qualquer commit (§8). |
| Reexecução do web unit | `apps/web` | **Feito, ver §0.1**: 110 arquivos / 603 testes, VERIFICADO contra `8135915`. |
| `ThrottlerGuard` global derruba jornadas E2E sob carga (F-59) | API inteira, via `APP_GUARD` | Quem retomar a estabilização E2E — mesma frente de F-48. Três opções em aberto, nenhuma decidida (ver F-59). Sem atualização nesta reconciliação. |
| Contraste do toast de sucesso abaixo de WCAG AA (tema claro) | `apps/web/src/components/ui/sonner.tsx` | Dois commits desta sessão tocam este ponto (`4043ce0`, `fe99a79`) — **NÃO VERIFICADO por este documento** se resolvem o defeito ou corrigem o instrumento de medição; confirmar com medição renderizada antes de fechar. |
| **Novo** — guarda de paridade SQL-vs-`isActionOverdue` para `ACTION_OVERDUE_COUNT` (decisão 3, §0.1) | `T032`, teste de integração | **T032**, dono explícito do coordenador — F-24 é a razão (quatro expressões independentes do mesmo predicado já custaram caro). Ainda não iniciada. |
| **Novo** — cinco `*LinkReadModule` (commit `2a39b52`) com o mesmo risco estrutural de fiação `@Global()` já corrigido em oito outros módulos (decisão 4, §0.1) | `modules/{incidents,problems,...}/*LinkReadModule` | **EM ANDAMENTO por outra frente** nesta mesma sessão — fora do escopo desta atualização de documentação. |
| **Novo (§0.2)** — cinco operações contratadas sem implementação (`listIndicatorMetricKeys`, `getIndicatorDefinition`, `updateIndicatorDefinition`, `getReportDefinition`, `updateReportDefinition`) | `contracts/{indicators,reports}.openapi.yaml` | **T068**, dono explícito do coordenador (decisão 1, §0.2) — implementar as cinco antes de acrescentar os dois contratos a `CONTRACT_SOURCES`. EM ANDAMENTO. |
| **Novo (§0.2)** — navegação de Indicadores/Relatórios ainda `status: 'planned'` | `navigation-registry.ts` | **T063** — desbloqueada agora que T060/T061 existem. NÃO INICIADO. |
| **Novo (§0.2)** — varredura de acessibilidade e captura renderizada das telas novas, com dado de seed corrigido | `apps/web/e2e/`, `apps/web/scripts/ui-capture.mjs` | **T065/T066** — a recaptura de Indicadores precisa do seed reexecutado (decisão 3/§7), já feito nesta sessão. EM ANDAMENTO. |
| **Novo (§0.2)** — medição de fechamento da fase (nenhuma bateria completa rodou depois de `e18e26d`) | Fase 9 | **T067/T070/T071** — NÃO INICIADO; T070 é quem produz a medição final. |

---

## 11. Próximo passo exato

> **Atualização, `6e66e2c` a `5c24606`** (ver §0.2 para o detalhe completo — esta é a medição mais
> recente e substitui as três abaixo): a Fase 3 (US1, MVP) e as Fases 4-7 (US2-US5) estão
> **ENTREGUES**; a Fase 8 (interface) está parcial — T057-T062 entregues (com as ressalvas de
> verificação renderizada registradas em `tasks.md` e em §0.2), T063/T065/T066 **EM ANDAMENTO**;
> T069 (Fase 9) entregue, T067/T068/T070/T071 **NÃO INICIADO**. O próximo passo real agora é:
> concluir T063, T065 e T066; em paralelo, fechar T068 implementando as cinco operações contratadas
> que faltavam (`listIndicatorMetricKeys`, `getIndicatorDefinition`, `updateIndicatorDefinition`,
> `getReportDefinition`, `updateReportDefinition`) antes de acrescentar os dois contratos a
> `CONTRACT_SOURCES`; depois T067, T070 (medição de fechamento — nenhuma bateria completa rodou
> desde `e18e26d`) e T071, nesta ordem, fechando a Fase 7. Ver §0.2 para o detalhe completo.

> **Atualização, `8135915`** (ver §0.1): o item 3 abaixo está **parcialmente** concluído — T019-T029
> (onze provedores + `IndicatorCalculationService`) estão ENTREGUES, mas T015-T017/T030-T031 seguem
> EM ANDAMENTO e T018/T032 NÃO INICIADO. O próximo passo real agora é: concluir T015-T017/T030-T031,
> depois T018 e T032 (incluindo a guarda de paridade SQL-vs-`isActionOverdue` da decisão 3 de §0.1),
> fechando a Fase 3 (MVP); em seguida, Fase 4 (US2 — histórico organização inteira, T033 em diante).
> Ver §0.1 para o detalhe completo. A atualização anterior (`e01ff32`/`e706e98`, abaixo) e a lista
> original permanecem por registro histórico.

> **Atualização, `e01ff32`/`e706e98`** (ver §0): os itens 1 e 2 abaixo estão concluídos. O item 3 é o
> próximo passo real, e já está reportado como em execução por outra frente desta mesma sessão — NÃO
> VERIFICADO diretamente por este documento (ver §0). A lista original abaixo é mantida por registro
> histórico de como a sequência foi planejada.

1. ~~**Concluir T010-T014**~~ (o resto da Fase 2) — registro `INDICATOR` como comentável, allow-list de
   auditoria dos três tipos novos, catálogo estático de métricas com teste de exaustividade, função
   pura de avaliação de limiar, e leitura escopada dos dois módulos. **Concluído em `e01ff32`.**
2. ~~**Reexecutar `pnpm --filter @vertice/api run test:unit`** e confirmar 485/485~~ — **feito**: a
   suíte, contra `e01ff32`, reporta 509/509 (o total cresceu porque T011-T013 também acrescentaram
   arquivos de teste, não só fecharam a lacuna original).
3. **Seguir para a Fase 3 (US1, T015-T032)**, cujo checkpoint é: um usuário autorizado consegue ler
   o valor atual de qualquer indicador do catálogo, corretamente escopado — a primeira fatia de
   valor demonstrável desta fase (MVP, `tasks.md` "MVP"). **Este é o próximo passo exato agora.**
   Reportado como já em execução por outra frente — confirmar por leitura de código/teste antes de
   presumir progresso específico, e reexecutar a bateria completa (§2) ao fechar qualquer tarefa da
   Fase 3, já que web unit segue sem reconfirmação contra `e01ff32`.

---

## 12. T067 — linha de base de testes, antes e depois (análise, não medição)

**Método**: `git diff --stat 795343b..HEAD` restrito aos diretórios de teste
(`apps/api/test/{unit,contract,integration}`, `apps/web/src/**/*.test.ts(x)`, `apps/web/e2e/**`),
cruzado com `git log`/`git show` de cada commit que tocou um arquivo pré-existente, para separar
criação de arquivo novo de modificação de arquivo já existente. Nenhuma suíte foi executada por
este agente — os números de "antes" e "depois" abaixo são os que o coordenador forneceu, não uma
remedição; **T070 é quem produz a medição de fechamento**.

### 12.1 Contagens — o que está VERIFICADO e o que não está

| Suíte | Antes (`795343b`, `specs/008-incidents-problems/STATE.md` §11.5) | Depois | Commit da medição de "depois" | Status |
|---|---|---|---|---|
| API unidade | 48 arquivos / 485 testes | — | — | **NÃO VERIFICADO contra `311549c`** (HEAD). Medido pelo coordenador como 56/560, mas em commit não identificado como `311549c` neste pacote de instruções — tratado como não verificado contra o commit atual até T070 confirmar. |
| API contrato | 53 arquivos / 728 testes | 55 arquivos / 807 testes | `311549c` (HEAD) | **VERIFICADO** (valor fornecido pelo coordenador como medição em série contra o commit atual). |
| API integração | 45 arquivos / 235 testes | 52 arquivos / 258 testes | não identificado como `311549c` | **NÃO VERIFICADO contra `311549c`** — medido "pouco antes", por declaração do próprio coordenador. |
| Web unidade | 110 arquivos / 596 testes | 123 arquivos / 661 testes | `e18e26d` | **NÃO VERIFICADO contra `311549c`** — `e18e26d` é um commit intermediário (a Fase 8 antes de T068), não o HEAD atual. Cinco commits separam `e18e26d` de `311549c`. |

Nenhuma das quatro contagens de "depois" está confirmada, pela leitura deste agente, contra o commit
`311549c` exato — apenas a de contrato foi explicitamente rotulada pelo coordenador como medição em
série contra o commit atual. As demais três ficam **NÃO VERIFICADAS** neste documento até T070 medir.
Isto não é uma suposição de que estejam erradas — apenas que este agente não as confirmou e a
instrução recebida foi explícita em não fazê-lo (nenhuma suíte foi executada).

### 12.2 Arquivos de teste PRÉ-EXISTENTES modificados por esta fase (795343b..HEAD)

Confirmado por `git show 795343b:<path>` (existe na baseline) + `git diff --stat` (teve linhas
alteradas, não só um arquivo novo). **Nenhum arquivo de teste foi removido** — `git diff
--diff-filter=D --stat 795343b..HEAD -- apps/api/test apps/web/src apps/web/e2e` não lista nenhuma
entrada. Confirmado.

#### Grupo A — crescimento exaustivo, causado diretamente por uma tarefa desta fase, com FR/T citado no próprio diff

| Arquivo | O que mudou | Classificação | Justificativa (citada no próprio código) |
|---|---|---|---|
| `apps/api/test/unit/permissions.spec.ts` | +14/-2: `INDICATOR_PERMISSION_DEFINITIONS`/`REPORT_PERMISSION_DEFINITIONS` somados ao total esperado de `getAllPermissionDefinitions()`; seis novos `identifiers` verificados (`indicator:view/create/edit`, `report:view/create/edit`) | Crescimento legítimo | **T009** — "o nono e décimo módulo de negócio, acrescentados da mesma forma" (comentário do próprio diff) |
| `apps/api/test/unit/audit-field-allowlist.spec.ts` | +12/-0: `registerIndicatorAuditAllowlists()`/`registerReportAuditAllowlists()` somados à composição que a suíte testa | Crescimento legítimo | **T011** — mesmo padrão de `registerIncidentAuditAllowlists()`/`registerProblemAuditAllowlists()` já presentes |
| `apps/api/test/contract/contract-coverage.spec.ts` | +55/-17: `indicators.openapi.yaml`/`reports.openapi.yaml` somados a `CONTRACT_SOURCES`; total de sanidade movido de 198 para 211, com o comentário do próprio arquivo documentando que 211 foi **lido de uma execução falha da própria asserção**, nunca calculado à mão (`198 + 8 + 5`) | Alteração de valor esperado, mas legítima — mesmo mecanismo (leitura pós-falha) que a suíte já exige de si mesma desde o F-31 | **T068** — "a two-two entries added in the SAME change that implements the last operation of each contract" |
| `apps/api/test/contract/support/openapi-documents.ts` | +21/-0: `Indicators`/`Reports` somados a `CONTRACT_DOCUMENTS` | Crescimento legítimo, puramente aditivo | **T030/T031 (Fase 3) + T054 (Fase 7) + T068 (Fase 8)** |
| `apps/api/test/contract/information-disclosure.spec.ts` | +170/-0 (puramente aditivo — confirmado por `git diff --stat`, zero remoções): varredura de 13 novas operações (`IndicatorController_*`, `ReportController_*`) inserida ENTRE a criação e o fim do fluxo de fixtures existente, nunca depois — mesma disciplina de posicionamento que o resto do arquivo já usa | Crescimento legítimo | **Fase 3/US1, Fase 4/US2, Fase 7/US5, T068** — comentário explica point-a-ponto por que cada chamada foi colocada onde foi |
| `apps/web/src/components/design-system.test.tsx` | +110/-0 (puramente aditivo) | Crescimento legítimo | **T057-T059** — testes do cartão de métrica, badge de rompimento e componente de tendência histórica, todos novos, nenhuma asserção pré-existente tocada |

#### Grupo B — correção pontual, não crescimento, com causa raiz identificada e citada

| Arquivo | O que mudou | Classificação | Justificativa |
|---|---|---|---|
| `apps/api/test/unit/registered-entity-type-validator.spec.ts` | 2 linhas: `buildUploadAttachmentDto`/`buildListAttachmentsDto` trocam o cast `... as unknown as CreateCommentRequestDto['entityType']` pelo tipo correto da própria DTO (`UploadAttachmentRequestDto['entityType']`/`ListAttachmentsQueryDto['entityType']`) | Correção de defeito pré-existente, **sem mudança de comportamento em tempo de execução** (o cast duplo via `unknown` compilava para qualquer tipo de destino; só o rótulo estava errado) | Citada pelo próprio commit `e01ff32`: "compiled only while `CommentableEntityType` and `AttachableEntityType` happened to hold identical literals; growing one of them broke the coincidence and exposed the cast" — a causa raiz é **T003** (schema.prisma cresce `CommentableEntityType` em um, `AttachableEntityType` em zero, por FR-033) |

Nenhum item do Grupo A ou B carece de justificativa rastreável. Os seis itens que o coordenador já
sabia (`permissions.spec.ts`, `audit-field-allowlist.spec.ts`, `information-disclosure.spec.ts`,
`contract-coverage.spec.ts`, `registered-entity-type-validator.spec.ts`, `accessibility.spec.ts` —
este último no Grupo C abaixo) estão todos confirmados; nenhum item adicional do Grupo A/B ficou sem
justificativa.

### 12.3 Grupo C — achado: modificações de teste pré-existente dentro da janela `795343b..HEAD`, mas **não** causadas por nenhum FR de `009-indicators-reports`

Isto é o que a Seção 12.2 pediu para procurar "além" da lista já conhecida pelo coordenador, e é um
achado que precisa ser dito sem suavizar: sete commits dentro da janela `795343b..HEAD` modificam
teste pré-existente por razões **inteiramente alheias** ao escopo funcional desta especificação —
fechamento de pendências deixadas por `008-incidents-problems` (o commit de reversão de vínculos,
`2a39b52`, que antecede a baseline) e um defeito de acessibilidade não relacionado a Indicadores ou
Relatórios. Cronologicamente, todos antecedem `e01ff32` ("Phase 7 foundation"), ou seja: aconteceram
no intervalo entre a baseline `795343b` e o início do trabalho funcional desta fase — mas **dentro**
da janela de commits que a instrução deste agente define como "esta fase" (`795343b..HEAD`).

| Commit | Arquivo(s) de teste pré-existente tocado(s) | O que mudou | Causa raiz (rastreável, mas não é FR de 009) |
|---|---|---|---|
| `6491320` | `apps/api/test/contract/information-disclosure.spec.ts` (+28/-0) | Quatro operações de leitura reversa (`RiskRelationshipController_listIncidentLinks`/`listProblemLinks`, `AssetController_listIncidentLinks`, `ProcessController_listIncidentLinks`) chegaram ao `main` sem varredura de disclosure | Defeito do commit `2a39b52` (`008-incidents-problems`, anterior à baseline), não de `009`. Commit próprio cita `docs/deferred-findings.md` F-58 (CI bloqueada por billing, então nada pegou o gap antes do merge) |
| `e706e98` | `apps/web/e2e/{accessibility,assets-processes,grc-foundation,incident-problem-collaboration,incidents,problems,risk-assessment,risk-collaboration,risk-create,risk-register,risk-treatment}.spec.ts` (+22/-... até +38/-...) + `apps/web/e2e/support/org-units.ts` (novo, +101) | `.first()` na seleção de unidade organizacional trocado por `selectSeededRootOrgUnit` em 18 pontos de chamada, porque o banco de desenvolvimento (sobrevivente à recuperação de SSD) tinha duas unidades órfãs que ordenavam antes de "Vértice GRC" | Defeito de harness E2E contra um banco real, não-seedado do zero — nada a ver com Indicadores/Relatórios. Commit próprio documenta a causa raiz completa |
| `fe99a79` | `apps/web/e2e/accessibility.spec.ts` (+42/-0) | `waitForNoRunningAnimations` — a varredura axe passa a esperar que animações CSS terminem antes de escanear, via `getAnimations({ subtree: true })` | Defeito de instrumento de medição de acessibilidade (mesma classe do F-28 já registrado), generalizando a correção pontual do toast — não é um FR de 009, embora a captura do toast (abaixo) tenha sido descoberta enquanto se verificava a Fase 8 desta mesma especificação |
| `97dc954` | Nenhum arquivo de teste — só módulos-fonte (`assets.module.ts`, `processes.module.ts`, `risk.module.ts`, cinco `*LinkReadModule`) | Quatro dos cinco ports de vínculo reverso deixam de depender de `@Global()` | Mesmo defeito estrutural de `8135915` (que é desta fase, mas para os *MetricsModule* de Indicadores) — aplicado por analogia aos módulos de `008`. Não é modificação de teste, citado aqui só por completude de rastreio |

`4043ce0` (contraste do toast) modifica `apps/web/src/components/ui/sonner.tsx`, que **não é arquivo
de teste** — é o componente que `fe99a79` acima motivou a corrigir. Citado aqui porque explica por
que `fe99a79` existe, não como item do Grupo C.

**Leitura do achado**: nenhum destes sete commits viola SC-007 no sentido de "alteração sem causa
rastreável" — cada um tem commit message com causa raiz completa e verificável. Mas nenhum cita um
FR de `009-indicators-reports`, porque nenhum é causado por um requisito desta especificação — são
fechamento de dívida técnica de `008-incidents-problems` e de uma classe de defeito de instrumento de
teste (animação em andamento) que caiu dentro da janela de commits usada para medir "esta fase". Se
T070/o fechamento da fase exigir que toda alteração dentro de `795343b..HEAD` cite um FR de **009**
especificamente, estes sete commits não atendem a essa leitura estrita — e é uma leitura estrita
defensável, dado o texto de SC-007 ("exceto onde um teste precisou mudar para refletir esta fase").
Registro para o coordenador decidir: (a) aceitar como fora do perímetro de SC-007 por pertencerem a
outra especificação, citando a causa raiz de cada um (como a tabela acima já faz), ou (b) tratar como
desvio a documentar explicitamente em `spec.md`/`tasks.md`. Este agente não decide — apenas relata.

### 12.4 Pendência explícita para o coordenador

- **T070** é quem produz a medição de fechamento contra `311549c`; as contagens de API unidade,
  API integração e Web unidade da tabela em 12.1 permanecem NÃO VERIFICADAS contra o commit atual
  até essa tarefa rodar.
- **Decisão do coordenador pendente** (12.3): se os sete commits do Grupo C contam como "dentro do
  perímetro de SC-007 desta fase" (e portanto precisariam, em rigor, citar um FR de 009 que não têm)
  ou se são reconhecidos como pertencentes a `008-incidents-problems`/manutenção geral e por isso
  fora desse perímetro apesar de estarem na janela de commits `795343b..HEAD`.

---

## 13. T071 — Indicador vs. Relatório, arquivo a arquivo

**Método**: leitura completa de `apps/api/src/modules/indicators/**` e `apps/api/src/modules/reports/**`,
camada por camada (domínio, portas, aplicação, infraestrutura, apresentação), mais os quatro arquivos
de composição (`indicators.module.ts`/`reports.module.ts`) e os DTOs de criação/edição. As quatro
divergências que o coordenador já confirmou como legítimas (Indicador comentável/Relatório não,
FR-033; série histórica só em Indicador, FR-028; Indicador é origem de Ação/Relatório não; exportação
CSV só em Relatório) não são repetidas abaixo — só o que está **além** delas.

### 13.1 Estrutura de diretório — paridade confirmada

| | Indicators | Reports |
|---|---|---|
| domínio (entidades) | 2 (`indicator-definition`, `indicator-measurement`) | 1 (`report-definition`) |
| domínio (portas) | 3 (`indicator-definition-repository`, `indicator-measurement-repository`, `indicator-reference-data`) | 2 (`report-definition-repository`, `report-reference-data`) |
| domínio (contrato de provedor) | `indicator-metric-provider.ts` (dois shapes de provider — `Scoped`/`OrganizationWide`) | nenhum — Relatório nunca calcula, só delega (ver 13.2) |
| domínio (catálogo) | `indicator-metric-catalog.ts` | nenhum — mesma razão |
| aplicação (`collaboration/`) | 2 accessors (`indicator-action-origin-accessor`, `indicator-parent-record-accessor`) | nenhum |
| aplicação (metric-providers) | 10 arquivos, 11 provedores (`RiskIndicatorMetricProvider` exporta dois) | nenhum |
| aplicação (use cases) | 10 | 7 |
| apresentação (DTOs) | 7 | 6 |
| composição (`*.module.ts`) | 1 | 1 |

Toda divergência de contagem acima está explicada por uma das quatro diferenças já conhecidas do
coordenador, ou pelo item 13.2 abaixo (que é uma quinta diferença, implícita nas quatro mas nunca
declarada como tal): **Relatório não tem catálogo de métricas nem provedor próprio porque nunca
calcula uma métrica — delega inteiramente ao `IndicatorCalculationService` de Indicadores através de
um port de fronteira**, o que está documentado nos dois `*.module.ts` mas não em nenhum D-N de
`research.md` sob esse nome.

### 13.2 Achado 1 — o mecanismo de delegação de cálculo é uma quinta diferença estrutural real, bem documentada em código, mas não nomeada como decisão em `research.md`

`reports.module.ts` liga `IndicatorCalculationPort` (`shared/grc-ports/indicator-calculation.port.ts`)
a uma fábrica que injeta o `IndicatorCalculationService` exportado de `IndicatorsModule` diretamente —
o mesmo padrão de fronteira (`shared/grc-ports/*`) que os oito `*MetricsModule` já usam para os
provedores de Indicador lerem os nove domínios-fonte. Isto está correto e seguindo CLAUDE.md §19.7
("um único calculador") — mas é uma peça de arquitetura consequente o bastante (é o mecanismo inteiro
que faz FR-025 valer) que caber em um `D-N` de `research.md`, ao lado de D-4 (catálogo fechado) e D-11
(Indicadores generaliza o Dashboard), em vez de existir só como comentário de cabeçalho de módulo.
**Classificação**: não é defeito de código — é uma lacuna de registro de decisão. Sugestão para o
coordenador: promover a um `D-14` em `research.md`, sem alterar nenhuma linha de código.

### 13.3 Achado 2 — assimetria de camada de teste unitário entre os dois "create" use case, sem decisão que a distinga

- `apps/api/test/unit/create-report-definition.usecase.spec.ts` existe: testa
  `CreateReportDefinitionUseCase` isoladamente, com todas as portas como fake manual (`as unknown as
  <Port>`), cobrindo validação de `metricKeys` (vazio, pertencimento ao catálogo) e o caminho feliz de
  auditoria.
- **Não existe** `create-indicator-definition.usecase.spec.ts` (confirmado por `grep -rl
  "CreateIndicatorDefinitionUseCase" apps/api/test/` — zero resultados em qualquer teste, unitário,
  de integração ou de contrato). A cobertura equivalente (Invariante T1 par-ou-nenhum, pertencimento
  ao catálogo, unicidade de `metricKey`, `ownerUserId` referenciando usuário existente) só existe
  indiretamente, via HTTP, em `apps/api/test/contract/indicators.spec.ts` e nos testes de integração
  de escopo organizacional.

As duas classes têm complexidade de validação comparável (`assertIndicatorThresholdInvariant`
correspondente a `assertValidReportMetricKeys`), e nenhuma das duas funções de validação em si tem
teste unitário isolado próprio (nenhum resultado de `grep` para
`assertIndicatorThresholdInvariant`/`assertValidReportMetricKeys` em `apps/api/test/`) — então a
assimetria não é "uma tem teste de função pura e a outra não"; é especificamente "o use case de
criação de Relatório tem teste unitário dedicado e o de Indicador não". O mesmo padrão se repete para
`RunReportUseCase`/`ExportReportCsvUseCase` (ambos com unitário dedicado) contra
`GetIndicatorCurrentValueUseCase` (sem unitário dedicado, coberto só por integração/contrato) — mas
aqui a assimetria é mais defensável, porque a lógica específica de `GetIndicatorCurrentValueUseCase`
é fina (delega ao calculador, que tem `indicator-calculation-service.spec.ts` próprio), enquanto
`RunReportUseCase`/`ExportReportCsvUseCase` têm lógica que não existe em nenhum outro lugar
(marcação `available: false` por item, serialização CSV manual).
**Classificação**: `CreateIndicatorDefinitionUseCase` sem unitário dedicado é uma inconsistência a
registrar — não um defeito funcional (a lógica está coberta, só não isoladamente), mas uma divergência
de forma sem decisão registrada que a distinga da sua contraparte em Relatório. Nenhum `D-N` de
`research.md` fala sobre estratégia de camada de teste para os use cases de criação.

### 13.4 Verificado como consistente (sem achado) — itens que pareciam candidatos a divergência e não são

- **Erro 422 vs. 400 para chave de métrica desconhecida**: `CreateIndicatorDefinitionRequestDto.metricKey`
  não é validado contra o enum fechado no DTO (decisão diferida ao use case, `422`); já
  `CreateReportDefinitionRequestDto.metricKeys` É validado no DTO (`400`, via `@IsIn(..., { each:
  true })`). **Isto está documentado, intencional e citado nos dois lados** — o cabeçalho de cada DTO
  e de cada use case explica que os dois contratos (`indicators.openapi.yaml`/`reports.openapi.yaml`)
  decidiram isto deliberadamente diferente, e `CreateReportDefinitionUseCase` ainda faz o mesmo
  recheque em profundidade (`assertValidReportMetricKeys`) como defesa contra um chamador que
  contorne o DTO — não há duplicação de regra, há duas camadas para o mesmo domínio de checagem.
  Único ponto fraco: nenhum `D-N` de `research.md` nomeia essa escolha — mesma lacuna de registro do
  Achado 1 (13.2), não um segundo achado de código.
- **`owner` (Indicador) vs. `createdBy` (Relatório) no corpo de resposta**: `IndicatorDefinitionResponse`
  expõe `owner: UserRef` e nunca `createdBy`, mesmo a entidade tendo `createdByUserId`;
  `ReportDefinitionResponse` expõe `createdBy: UserRef` e não tem conceito de `owner` porque a entidade
  não tem essa coluna. Confirmado contra os dois `.openapi.yaml`: é decisão de contrato (schema
  `IndicatorDefinition.required` inclui `owner`, nunca `createdBy`; `ReportDefinition.required` inclui
  `createdBy`). Consequência direta de FR-017/US3 (o indicador precisa de um dono para notificar no
  rompimento de limiar) — Relatório não tem esse requisito. Sem achado.
- **Nomenclatura `resolve-indicator-owner.ts` vs. `resolve-report-created-by.ts`**: reflete os dois
  campos diferentes acima, não uma divergência de padrão — o arquivo de Indicador resolve DOIS campos
  (`ownerUserId` e `computedByUserId`, este último de `IndicatorMeasurement`), o de Relatório resolve
  UM (`createdByUserId`), porque só Indicador tem medição (FR-028, já conhecida). Sem achado.
- **`indicator.controller.ts` (249 linhas) vs. `report.controller.ts` (195 linhas)**: a diferença de
  tamanho é inteiramente as duas operações de medição (`createMeasurement`/`listMeasurements`, FR-028)
  mais o roteamento estático-antes-de-dinâmico de `metric-keys`; a forma de cada operação equivalente
  (paginação, `RequirePermission`, mappers) é idêntica linha a linha entre os dois controllers. A
  exportação CSV do Relatório usa `@Res()` sem `passthrough` — documentado no próprio cabeçalho do
  arquivo como necessário para não disparar um segundo `response.send()` do NestJS; não tem
  equivalente em Indicador porque Indicador não serve `text/csv`. Sem achado, já esperado (diferença
  conhecida).
- **`indicators.module.ts` (mais longo) vs. `reports.module.ts`**: a diferença é o registro dos onze
  provedores de métrica e dos dois accessors de colaboração — nenhum dos dois existe em Relatório
  pelas razões já conhecidas. Ambos os módulos seguem a mesma disciplina de import explícito (nunca
  `@Global()`) para tudo que atravessa fronteira de módulo, e ambos registram seu próprio allow-list
  de auditoria no construtor, no mesmo padrão. Sem achado.
- **Módulo de dados de referência (`*-reference-data.port.ts`)**: ambos os módulos têm um — a
  pergunta do coordenador ("um módulo com porta de dados de referência e o outro não") não se
  confirma; a única diferença é que `IndicatorReferenceDataPort` tem um segundo método
  (`findUserOrgUnitId`), usado exclusivamente por `IndicatorActionOriginAccessor` (FR relacionado a
  US4, que Relatório não tem) — documentado no próprio cabeçalho do port.

### 13.5 Pendências para o coordenador decidir

| Achado | Tipo | Ação sugerida | Dono |
|---|---|---|---|
| 13.2 — mecanismo de delegação de cálculo (Relatório -> `IndicatorCalculationPort` -> `IndicatorCalculationService`) não tem `D-N` próprio em `research.md` | Lacuna de registro, não de código | Promover a `D-14` em `research.md` | Coordenador |
| 13.3 — `CreateIndicatorDefinitionUseCase` sem teste unitário dedicado (`CreateReportDefinitionUseCase` tem) | Inconsistência de forma de teste | Decidir se vale um `create-indicator-definition.usecase.spec.ts` simétrico, ou se documentar por que a assimetria é aceitável | Coordenador |
| 13.4 (400 vs. 422) — decisão de contrato bem documentada em código, mas sem `D-N` em `research.md` | Lacuna de registro, não de código | Mesma ação de 13.2 — pode ser o mesmo `D-14` ou um `D-15` separado | Coordenador |

Nenhum destes três itens foi corrigido por este agente — só `specs/009-indicators-reports/STATE.md`
foi tocado, conforme a restrição recebida.

---

## 14. Fechamento da fase — medição do coordenador, commit `d31e140` — FASE CONCLUÍDA

**Método desta seção**: a medição abaixo foi executada pelo coordenador, uma suíte de cada vez, em
série, sem concorrência entre portões. Não foi reexecutada por este agente de documentação, que
registra o resultado tal como reportado — rotulada **VERIFICADO (medição do coordenador, em série,
contra `d31e140`)**, seguindo o mesmo padrão que §12.1 já usa para números fornecidos pelo
coordenador sem execução direta por quem escreve o documento.

### 14.1 Portões de fechamento

| Portão | Resultado | Status |
|---|---|---|
| Unidade da API | 57 arquivos / 569 testes | VERIFICADO (coordenador) |
| Unidade da web | 123 arquivos / 663 testes | VERIFICADO (coordenador) |
| Contrato | 55 arquivos / 807 testes | VERIFICADO (coordenador) |
| Integração | 52 arquivos / 258 testes | VERIFICADO (coordenador) |
| typecheck | limpo, 4 projetos | VERIFICADO (coordenador) |
| lint | limpo, 4 projetos | VERIFICADO (coordenador) |
| format:check | limpo | VERIFICADO (coordenador) |
| openapi:check | documento atualizado | VERIFICADO (coordenador) |
| audit | passa; 2 vulnerabilidades moderadas abaixo do limiar (F-57) | VERIFICADO (coordenador) |
| Builds | API, web, design system e api-types | VERIFICADO (coordenador) |
| E2E Chromium | **129 de 129 aprovados**, 7,5 minutos | VERIFICADO (coordenador) — ver §14.3 sobre por que foi preciso um único worker |

Este documento não reexecutou nenhum destes comandos (fora do escopo recebido por este agente) — a
marca acima é leitura fiel do que o coordenador relatou ter executado, não uma segunda execução
independente.

### 14.2 Comparação com o início da fase

Contra o commit `795343b` (início da Fase 7 — números publicados em
`specs/008-incidents-problems/STATE.md` §11.5):

| Suíte | Antes (`795343b`) | Depois (`d31e140`) |
|---|---|---|
| Contrato | 728 testes | 807 testes |
| Unidade da API | 485 testes | 569 testes |
| Integração | 235 testes | 258 testes |
| Unidade da web | 596 testes | 663 testes |

**Nenhum teste foi removido** — confirmado por filtro de diff, o mesmo método que a análise de §12
já vinha aplicando por commit (incluindo os sete commits do "Grupo C" de §12.3, aceitos pelo
coordenador como fora do perímetro de SC-007 por pertencerem a `008-incidents-problems`/manutenção
geral, não a um FR de 009). Isto fecha a pendência que §12.4 deixava explícita: a comparação de
linha de base agora está medida contra o commit de fechamento real (`d31e140`), não contra um
commit intermediário — as contagens de §12.1 marcadas NÃO VERIFICADO contra `311549c` ficam
substituídas por esta medição final.

### 14.3 O achado de E2E — três execuções, e por que a segunda desmentiu a primeira hipótese

A suíte completa de E2E **falhou** em duas execuções antes de passar. A causa importa mais que o
resultado, e por isso as três execuções ficam registradas na ordem em que ocorreram:

1. **4 trabalhadores (o padrão), contra servidor de desenvolvimento**: 23 aprovados, 96 não
   executados.
2. **4 trabalhadores, contra build de produção**: 10 aprovados, 105 não executados. Esta execução
   testou — e desmentiu — a hipótese inicial do coordenador de que o modo de desenvolvimento
   dobrava as chamadas por reexecução de efeito: o resultado piorou contra o build de produção, não
   melhorou, o que descarta essa causa.
3. **1 trabalhador, mesmo build de produção**: **129 de 129, sem nenhuma falha**.

**Causa, confirmada por log da API, não por suposição**: o `ThrottlerGuard` **global**
(`THROTTLE_LIMIT=100` por `THROTTLE_TTL_SECONDS=60`, por IP) recusava com **429** — inclusive as
tentativas de **login**, produzindo o sintoma enganoso de testes voltando à tela de entrada com
"esperado `/dashboard`, recebido `/login`" (a mesma classe de sintoma que F-43 já documentou para um
mecanismo de limitação diferente, o de autenticação). O log da API registrou milhares de
`ThrottlerException` durante as execuções paralelas.

**Por que a CI passa com o mesmo limite**: este banco de desenvolvimento carrega dados acumulados
de todas as sessões (cerca de 200 riscos, mais de 100 usuários), e o harness pagina até encontrar o
que procura — a mesma condição de fundo que `docs/local-environment.md` D-20 já registrou para a
busca de papéis. Num banco recém-semeado como o da CI, a mesma jornada emite uma fração das
requisições que emite aqui, e por isso nunca se aproxima do teto de 100/60s.

**Decisão do coordenador, registrada aqui**: `THROTTLE_LIMIT` **não** foi alterado. A CI mantém
esse valor em 100 para o próprio job de E2E, então elevá-lo localmente seria **divergir** dela, não
igualá-la — diferente do limitador de autenticação, onde a CI declara valores próprios de job e o
ambiente local passou a reproduzi-los (`docs/local-environment.md` D-23). Reduzir a concorrência
para um trabalhador ataca a taxa de requisições diretamente e não enfraquece nenhum controle: o
próprio `playwright.config.ts` (comentário de cabeçalho) documenta que o número de trabalhadores é
uma escolha de vazão, não um requisito de segurança.

### 14.4 F-59 atualizado com esta evidência

`docs/deferred-findings.md` F-59 foi atualizado com o conteúdo de §14.3 acima — texto anterior
preservado, nada apagado. F-59 já registrava o limitador global como causa; a atualização acrescenta
as três execuções, a confirmação por log (não suposição), a explicação de por que a CI não reproduz
o sintoma com o mesmo teto, e a mitigação verificada: rodar a suíte completa com um único
trabalhador Playwright. As três opções que F-59 já deixava em aberto (elevar o teto só em E2E,
isentar rotas `GET`, reduzir o volume de requisições por jornada) continuam **sem decisão tomada**
— a mitigação adotada (reduzir concorrência para um trabalhador) é uma quarta via, que ataca a
concorrência em vez do volume ou do teto, e não estava entre as três originalmente listadas.

### 14.5 Declaração de fechamento

**A Fase 7 — Indicadores e Relatórios está CONCLUÍDA.** 70 de 71 tarefas de `tasks.md` marcadas
`[x]`; a tarefa restante, T064, permanece obsoleta em prosa — o que ela pedia já havia sido
entregue antes de esta fase começar (ver a própria tarefa e `spec.md`, "Achados fora do escopo
desta especificação", achado 1). Os onze portões de §14.1 passam; a comparação de §14.2 confirma
crescimento de cobertura em toda suíte, sem remoção de teste; o achado de E2E de §14.3 está
diagnosticado por evidência de log, não por suposição, com mitigação verificada (129 de 129, um
trabalhador); T071 (§13) comparou `Indicator` e `Report` arquivo a arquivo, sem divergência sem
justificativa — só três pendências de registro (§13.5), nenhuma bloqueando o fechamento.

### 14.6 Aberto e conhecido — não bloqueia o fechamento

| Item | Onde | Estado |
|---|---|---|
| **F-57** — `pnpm audit` reporta 2 vulnerabilidades moderadas em `vitest`/`@vitest/mocker`, abaixo do limiar `--audit-level=high` do portão | dependência de teste, sem caminho de execução em produção | ABERTO — decisão do coordenador de não atualizar sem a rede de segurança de CI disponível (F-58 segue bloqueada); ver `docs/deferred-findings.md` F-57. |
| **F-59** — `ThrottlerGuard` global derruba jornadas E2E sob concorrência | API inteira, via `APP_GUARD` | ABERTO — atualizado nesta fase com a evidência das três execuções (§14.3/§14.4); mitigação verificada (um trabalhador), mas nenhuma das opções de configuração permanente foi decidida. |
| Exposição de contraste latente no formulário de Ativos, idêntica à corrigida no formulário de Processos | `AssetForm`, construído na mesma forma que `ProcessForm` | ABERTO, deliberadamente **não corrigido às cegas** — commit `d31e140`: o defeito real (botão de envio em `disabled:opacity-50` até o próprio fetch de unidades organizacionais resolver, medindo abaixo de 4,5:1 no tema escuro) foi reproduzido 5 de 5 vezes e corrigido no formulário de Processos, que a varredura desta fase alcançou nesse estado transitório. `AssetForm` carrega a mesma exposição, mas não falhou nesta execução — a varredura não o alcançou no mesmo instante transitório — e por isso não foi tocado: corrigir sem antes reproduzir seria correção às cegas. Registrado para quem tocar `AssetForm` a seguir, ou para a próxima varredura de acessibilidade que o alcance no estado certo. |

Nenhum dos três itens acima bloqueia a declaração de fechamento de §14.5 — são achados registrados,
com dono, não pendências de escopo da Fase 7 em si.
