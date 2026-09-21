# Research — Gestão de Ativos e Gestão de Processos

**Feature**: `006-assets-processes` · **Spec**: [spec.md](./spec.md) · **Date**: 2026-09-08

Cada decisão abaixo foi tomada contra o repositório real, não contra a memória de como ele
funciona. Onde existe precedente registrado, ele é citado com arquivo e linha, porque a alternativa
— seguir a intuição de como o projeto "provavelmente" faz — é exatamente o que produziu as três
causas erradas que `specs/005-audit-findings/STATE.md` §6 lista.

---

## D-1 — Dois módulos, não um "módulo de registros"

**Decisão**: `apps/api/src/modules/assets/` e `apps/api/src/modules/processes/`, separados, com a
mesma forma interna.

**Razão**: a Constituição, Princípio I, exige que "cada domínio GRC possua seu contexto delimitado".
Ativo e Processo são domínios distintos na lista da própria Constituição ("Risks, Problems,
Incidents, Controls, **Assets**, **Processes**, Action Plans, Compliance, Audits"). Um módulo
único "de registros de referência" seria a caixa genérica que o CLAUDE.md §19.3 proíbe, e
recriaria em nível de módulo exatamente o acoplamento que esta fase existe para desfazer.

**Alternativas rejeitadas**:
- *Um módulo `registries/` com os dois dentro* — junta dois domínios num contexto só e obriga
  qualquer terceiro domínio futuro (Incidentes precisa dos dois) a depender do par.
- *Manter em `modules/risk`* — é o estado atual, e é a causa do problema: as duas operações que
  existem hoje exigem `risk:view`.

---

## D-2 — `orgUnitId`: coluna que continua anulável, campo obrigatório na API

**Decisão**: seguir **exatamente** o precedente de `Control`, verificado em código:

| Camada | `Control` (Fase 2, já em produção) | `Asset`/`Process` (esta fase) |
|---|---|---|
| Coluna Prisma | `orgUnitId String?` — anulável (`schema.prisma:1368`) | idem, **inalterada** |
| DTO de criação | `orgUnitId!: string` com `@IsUUID` (`create-control-request.dto.ts:37`) | idem, obrigatório |
| Predicado de escopo | `orgUnitId IN (...)` | idem |

**Razão**: esta era a decisão mais aberta da fase, e a resposta estava escrita no repositório. A
combinação "coluna anulável + campo obrigatório na criação" dá as duas garantias ao mesmo tempo:
nada novo nasce sem unidade, e nenhuma migração destrutiva precisa inventar uma unidade para linhas
antigas.

O ponto que fecha a questão é a semântica de `applyScopeToWhere`
(`shared/persistence/scope-filter.ts`): o predicado gerado é `orgUnitId IN (...)`, e em SQL
`NULL IN (...)` **nunca** é verdadeiro. Uma linha sem unidade é, portanto, automaticamente invisível
a qualquer ator com escopo por unidade — o comportamento seguro — e visível apenas a escopo
`GLOBAL`, que só existe a partir de uma concessão explícita e auditada. Não há caminho em que
`NULL` seja lido como "visível a todos".

**A alternativa que a especificação chegou a assumir (A-2) e que esta pesquisa REJEITA**: tornar a
coluna obrigatória e atribuir as linhas existentes à unidade raiz. Rejeitada por duas razões
concretas: (1) diverge do único precedente do projeto para exatamente esta pergunta, criando
assimetria entre `Control` e `Asset` sem que nenhum requisito peça; (2) é **menos** segura, não
mais — atribuir à raiz tornaria as duas linhas de fixture visíveis a todo ator cujo escopo cubra a
raiz, enquanto hoje, com `NULL`, elas são invisíveis a qualquer escopo por unidade. Uma migração
que aumenta a visibilidade de dados não é um endurecimento.

**Consequência aceita e nomeada**: as duas linhas de fixture (`FIXTURE-ASSET-1`,
`FIXTURE-PROCESS-1`, semeadas por `platform.seed.ts:951-967` sem unidade) deixam de ser visíveis a
atores escopados por unidade assim que a listagem passar a aplicar escopo. Isto é a correção
funcionando, não uma regressão — mas quebraria qualquer teste que dependa de vê-las com um usuário
escopado. **A semeadura de fixtures passa a atribuir uma unidade organizacional às duas**, o que é
tarefa desta fase e não um efeito colateral a descobrir depois.

---

## D-3 — Situação de dois estados, não um ciclo de vida espelhando `Control`

**Decisão**: manter `isActive` (booleano) como a situação de Ativo e de Processo. **Não** introduzir
um enum de quatro estados espelhando `ControlStatus`.

**Razão**: `isActive` já tem consequência real, verificada nos dois lados —
`control-asset-link.usecase.ts:57` e `asset-link.usecase.ts:82` recusam o vínculo de um alvo
inativo. Um segundo estado só se justifica se habilitar ou proibir algo que os dois existentes não
cobrem, e **nenhum requisito desta fase pede isso**.

Este projeto já quase enviou três estados sem consequência — `FindingStatus`, o `DRAFT` de
Controles e o quase-incidente de Conformidade — e a lição está registrada. Um estado que não muda o
que o sistema permite é ruído no modelo que alguém depois vai ter que explicar.

**Alternativa rejeitada**: `AssetStatus { DRAFT, ACTIVE, SUSPENDED, RETIRED }` por simetria com
`Control`. Simetria com outro domínio não é requisito; `Control` tem quatro estados porque
efetividade, atestação e aposentadoria significam coisas diferentes para um controle. Um ativo, no
que esta fase pede, ou está em operação ou não está.

**Observação registrada, não corrigida aqui**: `Control` carrega **`isActive` e `status` ao mesmo
tempo** (`schema.prisma:1369` e `:1379`). Isso é redundância aparente naquele modelo, não neste.
Não é escopo desta fase mexer em `Control`; fica anotado para quem for tocar naquele domínio.

---

## D-4 — Prefixos de código `AST` e `PRC`, e o que fazer com os códigos livres já existentes

**Decisão**: estender o registro fechado `EntityCodePrefix`
(`grc/shared/domain/entity-code.service.ts:79`) com `'AST'` e `'PRC'`, reusando o alocador
`GrcCodeSequence` existente — nenhuma tabela de sequência nova. Códigos novos passam a ter a forma
`AST-2026-0001` / `PRC-2026-0001`.

**Razão**: é o mesmo caminho que `CTL` (Fase 2) e `FMK` (Fase 3) já percorreram, e o cabeçalho
daquele arquivo diz explicitamente que estender a união é o esperado para uma entidade de módulo de
negócio, com migração revisada e aditiva. A união é fechada de propósito: um prefixo digitado
errado não compila.

**Códigos livres já existentes**: `FIXTURE-ASSET-1` e `FIXTURE-PROCESS-1` não seguem o formato.
Eles **permanecem como estão** — são únicos, válidos, e reescrevê-los quebraria as fixtures de E2E
que os procuram por código literal. `ENTITY_CODE_PATTERN` valida a forma de códigos **gerados**;
não é uma restrição retroativa sobre a coluna. A alternativa (migrar os dois para o formato novo)
trocaria uma inconsistência cosmética por uma quebra real de teste.

---

## D-5 — A propriedade das duas listagens muda de módulo, com precedente

**Decisão**: `GET /assets` e `GET /processes` saem de `RegistryController` (`modules/risk`) para os
controllers dos módulos novos. `RegistryController` deixa de ter as duas rotas.

**Razão**: há precedente literal, registrado no próprio teste que guarda os contratos —
`contract-coverage.spec.ts` documenta que "`GET /controls` saiu de `platform.openapi.yaml` na Fase 2
(003-controls-management Task A) — a propriedade do catálogo de controles transferiu-se para
`controls.openapi.yaml`". Esta fase repete esse movimento para dois recursos.

**Obrigação que vem junto (FR-014)**: os consumidores atuais são os seletores de vínculo de Riscos e
de Controles no frontend. O caminho HTTP não muda; a autoridade exigida e o escopo aplicado mudam.
Nenhum consumidor pode quebrar por causa do caminho.

---

## D-6 — Portes de diretório, substituindo as duas leituras diretas

**Decisão**: criar `apps/api/src/shared/grc-ports/asset-directory.port.ts` e
`process-directory.port.ts`, com adaptadores fornecidos pelos módulos novos e ligados no
*composition root*. `modules/risk` e `modules/controls` passam a consumir os portes; as duas
infraestruturas que hoje leem as tabelas direto deixam de fazê-lo.

**Forma mínima exposta**, seguindo `ControlDirectoryPort`/`RiskDirectoryPort` já existentes:
`{ id, code, name, orgUnitId, isActive }` — `orgUnitId` **precisa** estar exposto, porque é o que o
chamador verifica antes de gravar (ADR-020 parte 4). Um porte que esconde `orgUnitId` torna a parte
4 impossível de cumprir; foi essa a forma do gap que F-46 fechou.

**Razão**: Constituição, Princípio I — "acesso entre domínios DEVE ocorrer através de interfaces
explícitas e declaradas; alcançar diretamente o modelo interno ou as tabelas de outro domínio é
proibido". As duas leituras de hoje violam isso literalmente. ADR-011 diz o mesmo em outra forma.

**Alternativa rejeitada**: manter as leituras diretas porque "são tabelas neutras". Esse é
exatamente o argumento escrito no cabeçalho de `reference-registry-lookup.repository.ts` hoje ("see
that port's own header for why this is not a cross-module boundary"), e ele deixa de valer no
instante em que as tabelas passam a ter dono.

---

## D-7 — Autoridade própria de cada recurso

**Decisão**: oito permissões novas, quatro por domínio:
`asset:view|create|edit|administer` e `process:view|create|edit|administer`, agregadas ao catálogo
estático `permission-catalogue.ts`. Reusam `PermissionAction` existentes — nenhum valor novo de ação.

- `view` — listar e ler.
- `create` — cadastrar.
- `edit` — corrigir nome, descrição e unidade.
- `administer` — desativar e reativar.

**Razão para `administer` em vez de um `asset:archive`**: desativar é a única transição de estado
que existe (D-3), e o projeto já usa `administer` para "a autoridade mais forte sobre o recurso"
(`finding:administer` governa arquivar). Criar um verbo próprio para uma única transição de dois
estados seria granularidade sem consequência.

**O que isto corrige (US2)**: hoje a única autoridade que dá acesso ao inventário é `risk:view`.
Depois desta fase, ler ativos exige `asset:view` — do próprio recurso, como manda o Princípio III.

**Obrigação de compatibilidade (A-6)**: todo papel semeado que hoje enxerga o inventário por ter
`risk:view` precisa receber `asset:view`/`process:view`, ou usuários perdem acesso que tinham. Isto
é tarefa, não consequência a descobrir depois — e é a mesma classe de defeito que o papel
"Audit Lead" produziu na fase anterior, onde autoridade de escrita foi semeada sem a de leitura
correspondente. A guarda estrutural que nasceu ali
(`audit-engagement-write-implies-read.spec.ts`) é o modelo a estender aqui.

---

## D-8 — Dois tipos de entidade de auditoria novos

**Decisão**: acrescentar `ASSET` e `PROCESS` a `AuditEntityType`, por migração revisada (padrão
ADR-008).

**Razão**: os quatro tipos de vínculo já existem (`RISK_ASSET_LINK`, `RISK_PROCESS_LINK`,
`CONTROL_ASSET_LINK`, `CONTROL_PROCESS_LINK`) — mas nenhum tipo para o **registro em si**, porque
até agora não havia operação que o criasse ou alterasse. Criar, editar, desativar e reativar
(FR-015) precisam de um tipo próprio, e o enum é fechado por decisão registrada.

---

## D-9 — Os dois vazamentos de escopo, e por que a correção não pode ser adiada

Ver a seção "Contexto medido" da especificação para a evidência. As duas correções:

1. **Leitura**: a listagem passa a atravessar um caso de uso que resolve `ScopeFilter` e um
   repositório que estende `ScopedRepository` — a mesma forma que `Control`, `Finding` e
   `AuditEngagement` já usam. Hoje o controller chama o repositório direto e nenhum escopo é
   aplicado.
2. **Escrita**: `LinkAssetUseCase` e `LinkProcessUseCase` (`modules/risk`) passam a verificar o
   `orgUnitId` do alvo contra o escopo do ator antes de gravar, e a exigir `asset:view`/
   `process:view` do lado referenciado — a mesma forma que `control-link.usecase.ts` recebeu em
   F-46 e que `control-asset-link.usecase.ts` já tinha.

**Por que agora e não numa "fase de correção" separada**: a verificação de escopo sobre o alvo é
impossível enquanto o alvo não tem dono nem porte que exponha sua unidade. A promoção é a
pré-condição técnica da correção. Adiar a correção para depois seria construir o dono e deixar o
vazamento aberto sabendo dele.

**Exigência sobre o teste, vinda do AGENTS.md**: a correção de segurança recebe teste de regressão
que **generaliza a todo call site que compartilha o padrão vulnerável**, não só às duas instâncias
relatadas. Concretamente: uma guarda estrutural que falhe se qualquer caso de uso de vínculo em
`modules/risk` ou `modules/controls` deixar de verificar o escopo do alvo — a lição de F-46, que
corrigiu um irmão e deixou dois.

---

## D-10 — O que esta fase deliberadamente NÃO faz

Registrado porque ausência silenciosa é indistinguível de esquecimento.

| Não faz | Por quê |
|---|---|
| Relação Processo↔Ativo | Nenhum requisito a pede e nenhum consumidor a consumiria. Seria ponto de extensão nunca exercitado — §19.10 pelo nome. Candidata explícita para Incidentes (Fase 6) |
| Taxonomia de ativo (tipo, criticidade, classificação) | Nenhum FR pede. §19.1: benchmark externo é evidência, não especificação. Um campo de classificação sem regra que o consuma é o mesmo defeito de "estado sem consequência" em outra roupa |
| Dono (`ownerUserId`) de ativo/processo | Nenhum requisito desta fase o usa para autorizar, notificar ou atribuir. `Control` tem dono porque a atestação precisa dele; aqui não há equivalente |
| Hierarquia de processos (processo pai/filho) | Não pedida; introduziria recursão em consultas de escopo sem consumidor |
| Anexar Evidência a ativo | `EvidenceSubjectType` é registro fechado; acrescentar valor sem consumidor real repete §19.10 |
| Corrigir a redundância `isActive` + `status` em `Control` | Fora do escopo; anotado em D-3 para quem tocar naquele domínio |
| Migrar `FIXTURE-ASSET-1`/`FIXTURE-PROCESS-1` para o formato de código novo | D-4: trocaria inconsistência cosmética por quebra real de fixture |

---

## D-11 — Ordem de implementação imposta por dependência real

1. Migração (enum de auditoria, prefixos de código) e permissões — nada compila sem elas.
2. Os dois módulos, simétricos, incluindo os portes de diretório e seus adaptadores.
3. Transferência das duas listagens, com escopo aplicado — fecha o vazamento 1.
4. Consumo dos portes por `modules/risk` e `modules/controls`, com verificação de escopo do alvo —
   fecha o vazamento 2 e remove as leituras diretas.
5. Semeadura: permissões novas nos papéis que hoje dependem de `risk:view`, e unidade organizacional
   nas duas linhas de fixture.
6. Interface, seguindo §18.
7. Validação: E2E, acessibilidade, regressão e as guardas estruturais.

O passo 4 é o que quebra os testes existentes de vínculo se algo estiver errado — e é o passo cuja
regressão SC-006 mede.
