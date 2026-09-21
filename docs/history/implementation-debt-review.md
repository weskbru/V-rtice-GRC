Status: provisional — diagnóstico estático e proposta de saneamento; não é ADR ratificado nem relatório de testes executados.

# Custos de implementação e preparação para continuidade

> **Documento histórico — diagnóstico datado de 2026-09-10.** Não descreve necessariamente o
> estado atual do produto; o saneamento que este diagnóstico propôs foi executado em
> `specs/007-implementation-remediation/`. Fonte vigente: [`docs/STATE.md`](../STATE.md).

## Base e limites da leitura

Revisão em 2026-09-10, sobre `a03ceb049dfaa4ae9c57d2cce3d1f7ad7f456130`.
Foram mapeados os módulos, entidades, telas, contratos e mecanismos transversais, com leitura
dirigida dos caminhos relacionados às dívidas. Isso não equivale a uma auditoria exaustiva de
cada linha, prova de ausência de defeitos ou execução das suítes da aplicação.

Fontes: [CLAUDE.md](../../CLAUDE.md), [AGENTS.md](../../AGENTS.md),
[constituição](../../.specify/memory/constitution.md),
[fronteiras](../architecture.md), [ADRs](../architecture/decisions.md),
[blueprint](grc-domain-blueprint.md), [roadmap](../architecture/grc-roadmap.md),
[benchmark](probo-benchmark.md), [assurance](foundation-assurance.md),
[findings](../deferred-findings.md), [ambiente](../local-environment.md),
[specs](../../specs/), handover em andamento (nunca versionado; sucessor vigente: [docs/HANDOVER.md](../HANDOVER.md)),
[CI](../../.github/workflows/ci.yml), manifests, schema, migrations, composição Nest,
domínio, casos de uso, consultas, tipos frontend e infraestrutura de testes.

O `git status` inicial continha `?? docs/handover/`. Esses arquivos são trabalho anterior,
não produção desta análise. O README da raiz não existe nesta revisão. O handover contém
referências a documentos ainda ausentes; não deve ser tratado como conjunto concluído.

## 1. Panorama do produto examinado

| Área | Código e responsabilidades atuais | Garantias a preservar no saneamento |
|---|---|---|
| Plataforma | [core](../../apps/api/src/core/): identidade local, sessões, RBAC, organizações, auditoria, arquivos, comentários, notificações e dashboard | Sessões opacas, autorização no servidor, escopo, transações e auditoria. Administração de usuários vive em identidade; diretório ausente não implica funcionalidade ausente. |
| Riscos | [risk](../../apps/api/src/modules/risk/), [spec 001](../../specs/001-grc-platform-foundation/spec.md) | Metodologia e avaliações históricas, oito estados, aprovações, tratamento, vínculos, histórico e agregados. |
| Núcleo GRC | [grc](../../apps/api/src/grc/), [spec 002](../../specs/002-shared-grc-foundation/spec.md) | Evidência, Ação e Achado; registros fechados de sujeitos/origens; segregação no fechamento de achados. |
| Controles | [controls](../../apps/api/src/modules/controls/), [spec 003](../../specs/003-controls-management/spec.md) | Ciclo de vida, verificações/atestação, efetividade calculada e vínculos explícitos. |
| Compliance | [compliance](../../apps/api/src/modules/compliance/), [spec 004](../../specs/004-compliance-management/spec.md) | Framework versionado, requisitos, mapeamento N:M, migração de mapeamentos, aplicabilidade e conformidade calculada. |
| Auditoria de negócio | [audit-engagements](../../apps/api/src/modules/audit-engagements/), [spec 005](../../specs/005-audit-findings/spec.md) | Engajamentos, escopo, produção de achados e integração com evidência/ação. Diferente da trilha técnica em core/audit. |
| Ativos e Processos | [assets](../../apps/api/src/modules/assets/), [processes](../../apps/api/src/modules/processes/), [estado 006](../../specs/006-assets-processes/STATE.md) | Módulos donos dos registros existentes, ativação/desativação, escopo e preservação dos quatro vínculos anteriores. |
| Frontend | [rotas](../../apps/web/src/app/), [features](../../apps/web/src/features/), [design system](../../packages/design-system/) | Next.js, contratos, pt-BR centralizado, estados de formulário, navegação e acessibilidade. |
| Persistência/operação | [Prisma](../../apps/api/prisma/), [Compose](../../docker-compose.yml), [Docker](../../docker/), [CI](../../.github/workflows/ci.yml) | Papéis separados de aplicação/migração, restrições e histórico, instalação reproduzível e verificações reais. |

A sequência praticada antecipou o núcleo GRC e Controles em relação a Incidentes/Problemas.
Não foi identificado impedimento estrutural irreversível decorrente dessa ordem. O custo mais
direto é a coexistência das ações de Riscos e do núcleo. A promoção posterior de Ativos e
Processos exigiu integração adicional, já realizada em pontos importantes.

## 2. Correções técnicas confirmadas por leitura de código

### C1 — Convergência de Ação pendente (F-36): antes de Incidentes

O [schema](../../apps/api/prisma/schema.prisma) ainda contém `RiskTreatmentAction`, `Action` e
`RiskTreatmentAction.actionId` anulável. O
[update de tratamento](../../apps/api/src/modules/risk/application/treatment-actions/update-treatment-action.usecase.ts)
chama os espelhos de status e campos. O
espelho de status (`apps/api/src/grc/action/application/mirror-action-status-from-origin.usecase.ts`, removido depois em `e693480`)
não chama `assertLegalActionTransition`; a
[transição própria de Action](../../apps/api/src/grc/action/application/transition-action.usecase.ts)
chama essa validação. A justificativa fixa do espelho é atribuível, mas não foi fornecida pelo usuário.

**Impacto:** regras diferentes para a mesma ação conforme a entrada utilizada, duas autoridades
de dados e maior custo de integração dos próximos módulos.

**Resultado necessário:** uma autoridade de escrita e uma política de transição. Especificar
migração, compatibilidade de IDs/rotas, tratamento de linhas sem `actionId`, estados históricos,
origens, permissões e auditoria antes de implementar. Não remover a tabela legada antes de
provar a conservação dos dados e referências; não fabricar justificativas históricas humanas.
Adaptar o [teste de convergência](../../apps/api/test/unit/action-model-convergence-guard.spec.ts),
que hoje permite dois modelos, para proteger o estado final em vez de perpetuar a coexistência.

### C2 — Vencimento possui múltiplas implementações (F-24)

Há regras em [risk-overdue](../../apps/api/src/modules/risk/domain/risk-overdue.ts),
[dashboard-query](../../apps/api/src/modules/risk/infrastructure/dashboard-query.service.ts),
[risk-query](../../apps/api/src/modules/risk/infrastructure/risk-query.service.ts),
[repositório de tratamento](../../apps/api/src/modules/risk/infrastructure/risk-treatment-action.repository.ts)
e [overdue do núcleo](../../apps/api/src/grc/shared/domain/overdue.service.ts).
O inventário atual não deve ser limitado às quatro cópias descritas no finding original.

**Impacto:** lista, detalhe e dashboard podem divergir após uma mudança de status ou data.
**Resultado necessário:** política compartilhada de estados elegíveis/data de referência, com
implementações SQL/Prisma coerentes e testes de equivalência. Não importar Prisma no domínio
puro nem carregar todos os registros em memória para reutilizar uma função TypeScript.
Coordenar com C1 para não consolidar consultas numa tabela que será aposentada.

### C3 — Contratos e tipos não acompanham todo o produto (F-3 residual e F-18)

O [gerador](../../packages/api-types/scripts/generate.mjs) usa corretamente os YAML canônicos,
mas sua lista contém apenas Auth, Admin, Platform, Risks e GrcFoundation. Os contratos de
Controles, Compliance, Auditoria, Ativos e Processos não entram nela. O
[índice gerado](../../packages/api-types/src/index.ts) confirma esses cinco namespaces.

[Tipos de Riscos](../../apps/web/src/features/risks/types.ts) e
[autenticação](../../apps/web/src/lib/auth-types.ts) ainda possuem campos obrigatórios/anuláveis
onde o finding F-18 registra campos opcionais. Conferir payload real e YAML campo a campo:
não mudar a API para fazer um tipo manual incorreto passar.

O [openapi:check](../../apps/api/scripts/check-openapi.ts) compara a reflexão Nest com o JSON
versionado. O [teste de cobertura](../../apps/api/test/contract/contract-coverage.spec.ts) inventaria
rotas/métodos dos dez documentos atuais. Nenhum desses mecanismos, por si, prova o formato
completo de respostas em execução.

**Resultado necessário:** geração para todos os contratos implementados, consumo seguro dos
tipos, verificação de atualidade dos gerados e validação de payloads reais. Preservar namespaces
distintos para esquemas homônimos diferentes. Não alegar cobertura de formato apenas por
existir rota, DTO ou compilação.

### C4 — Arquivos de composição fora da classificação de fronteiras (F-25)

[apps/api/eslint.config.mjs](../../apps/api/eslint.config.mjs) classifica camadas internas de
core/grc/modules, mas não os respectivos `*.module.ts`, `app.module.ts` e `main.ts`.
São justamente pontos de ligação entre provedores e módulos.

**Resultado necessário:** regras próprias para composição, permitindo a ligação legítima no
composition root e recusando acesso indevido a detalhes internos. Provar com exemplos permitidos
e proibidos, incluindo módulos novos não enumerados numa lista fixa. Revisar o grafo real antes
de endurecer a regra; não liberar tudo para fazer lint passar.

### C5 — Código legado e consultas duplicadas de Controles (F-44 #1/#2)

ControlRegistryPort (`apps/api/src/modules/risk/domain/ports/registry-repository.port.ts`, removido depois em `11afc29`)
e adaptador (`apps/api/src/modules/risk/infrastructure/prisma-registry.repository.ts`, removido depois em `11afc29`)
continuam ligados em RiskModule; a busca de referências não encontrou consumidor funcional
da porta além de sua ligação/implementação. A leitura de alvo usa `ControlDirectoryPort`.

[ControlLookupRepository](../../apps/api/src/modules/controls/infrastructure/control-lookup.repository.ts)
e [ControlRepository](../../apps/api/src/modules/controls/infrastructure/control.repository.ts)
mantêm caminhos próprios de consulta de controle escopado.

**Resultado necessário:** comprovar ausência de consumidores e retirar o legado morto;
compartilhar a mecânica de escopo/consulta realmente duplicada sem transformar uma leitura
estreita em carregamento de agregado caro. Não criar mais uma porta apenas para evitar conflito
entre agentes. Provar bootstrap Nest e consumidores após a integração.

### C6 — Execução E2E e evidência de CI divergentes (F-43/F-48)

[admin-session.ts](../../apps/web/e2e/support/admin-session.ts) cacheia a sessão de administrador
de worker, mas `signInAsSeededUser`/`signInAsFixtureUser` continuam fazendo login. O auxiliar
ainda pode reportar senha incompatível sem distinguir adequadamente o bloqueio por frequência.
[playwright.config.ts](../../apps/web/playwright.config.ts) usa quatro workers e retries na CI.

**Achado adicional de configuração:** os jobs E2E da [CI](../../.github/workflows/ci.yml) usam
limites de login `200/1000`, enquanto contrato/integração usam `5/20`, todos com janela `300`.
Isso contraria uma explicação baseada somente em retries para a diferença local/CI. É uma
diferença confirmada nos arquivos, não prova de exposição em produção nem medição desta revisão.

**Resultado necessário:** fixtures próprias por execução, reaproveitamento de sessões apenas
onde não mascara o comportamento testado, separação de testes de autenticação e diagnóstico
correto de 429. Não aumentar limites, simular IP confiável ou desativar controles para obter verde.
Comprovar a suíte contra limites normais e explicitar a política de CI. Chromium é automático;
Firefox/WebKit estão em job manual: a cobertura deve ser descrita nesses termos.

### C7 — Documentação operacional e de estado desatualizada (F-42/F-51)

Os quickstarts de [002](../../specs/002-shared-grc-foundation/quickstart.md),
[003](../../specs/003-controls-management/quickstart.md) e
[005](../../specs/005-audit-findings/quickstart.md) ainda usam `db:migrate:dev`, inexistente no
[manifest da API](../../apps/api/package.json). O script real é `db:migrate` (`prisma migrate dev`).
Para aplicar migrations versionadas numa instalação, distinguir esse comando de `migrate deploy`.

Blueprint/roadmap/assurance contêm snapshots antigos; ADR-020 ainda tem uma tabela que deixa
abertas permissões já exigidas pelo código. Existem tasks desmarcadas e trechos de STATE que
divergem dos fechamentos posteriores. O handover ainda tem destinos ausentes.

**Resultado necessário:** índice navegável, guia de instalação efetivamente exercitado em
ambiente descartável, links válidos e estado atual datado. Preservar decisões históricas;
marcar superação em vez de apagar evidência. Código descreve o comportamento atual, mas a spec
ratificada continua sendo a autoridade do comportamento esperado.

## 3. Pontos que exigem prova ou decisão delimitada

| ID | Evidência atual | Tratamento proposto |
|---|---|---|
| V1 — F-26, armazenamento | [LocalDiskStorageProvider](../../apps/api/src/core/files/infrastructure/local-disk-storage-provider.ts) deriva a chave só do conteúdo e ignora `EEXIST`; não recebe escopo. Existe diferença estrutural de caminhos; explorabilidade por tempo não foi medida aqui. | Medir com harness controlado e revisar a fronteira de autorização. Se corrigir, evitar deduplicação entre sujeitos sem autorização comum; unidade organizacional isoladamente pode ser insuficiente. Preservar checksum, download, chaves antigas, rollback e anexos compartilhados. Não usar atraso arbitrário como prova de segurança. |
| V2 — atribuição da autenticação | [SessionService](../../apps/api/src/core/sessions/application/session.service.ts) grava `session.created`; [AuditRecorder](../../apps/api/src/core/audit/application/audit-recorder.service.ts) obtém ator do contexto; [login](../../apps/api/src/core/identity/infrastructure/auth-orchestrator.ts) não evidencia preenchimento desse contexto no caminho lido. | Confirmar evento persistido com login real. Corrigir a atribuição se ausente, usando identidade resolvida pelo servidor. Decidir conforme contrato se o evento de sessão basta; não inventar evento duplicado por estética. Não reescrever eventos históricos. |
| V3 — baseline de seed, F-5 | [global setup](../../apps/api/test/integration/support/global-setup.ts) migra e limpa dados mutáveis, sem seed global. | Verificar cobertura específica do seed; testar idempotência, papéis e invalidação em banco descartável. Banco deliberadamente vazio para fixtures próprias é opção válida, não defeito automático. |
| V4 — Compose/TLS | [Compose](../../docker-compose.yml) configura API em produção, cookie Secure e frontend HTTP; não há terminador TLS nesse arquivo. | Verificar login/logout em navegador e modo de execução pretendido, incluindo exceções de localhost. Entregar caminho local reproduzível e instruções claras para HTTPS; não afirmar incompatibilidade universal de Secure em localhost nem implantar infraestrutura de produção por inferência. |
| V5 — F-44 #3 e estado redundante de Control | Edição de controle aposentado foi permitida deliberadamente; `isActive` e `status` coexistem. | Verificar invariantes e consumidores, corrigir inconsistências comprovadas. Não congelar controles ou remover campo contratual automaticamente. Registrar decisão e testes da política preservada. |
| V6 — demais findings | Findings e revisões são históricos e misturam problemas resolvidos, avisos e hipóteses. | Triar todos por ID, exigir prova antes de corrigir, incluir defeitos residuais confirmados no escopo desta manutenção. Não encerrar por conveniência nem implementar roadmap como correção. |

## 4. Itens que não devem ser corrigidos novamente

- F-1: [catálogo de Riscos](../../apps/web/src/lib/messages/risks.ts) já usa mapas tipados por união.
- F-2: [StatusBadge](../../packages/design-system/src/components/status-badge.tsx) e
  [RiskScore](../../packages/design-system/src/components/risk/risk-score.tsx) já retiraram o
  status estático; LoadingState possui decisão própria. Não eliminar todas as live regions.
- F-19: o gerador passou de entradas `.d.ts` para `.ts`, permitindo emissão das declarações.
  Ainda cabe verificar o pacote com resolução normal; não presumir o defeito antigo vigente.
- F-23 #3: [user-messages](../../apps/api/src/shared/messages/user-messages.ts) já compõe catálogos
  por assunto. Editar o agregador é custo de registro, não ausência de modularização.
- F-14: [.dockerignore](../../.dockerignore) já exclui `.env` aninhado. Revalidar proteção,
  sem reproduzir a afirmação histórica como defeito atual.
- F-46/F-49: vínculos Risco→Controle/Ativo/Processo receberam correções de escopo.
  [Controle→Ativo](../../apps/api/src/modules/controls/application/links/control-asset-link.usecase.ts)
  e [Controle→Processo](../../apps/api/src/modules/controls/application/links/control-process-link.usecase.ts)
  também já exigem `asset:view`/`process:view`, apesar do texto antigo do ADR-020.

Essas observações são de código; o executor deve confirmar as regressões e atualizar os findings
sem inventar execuções anteriores.

## 5. Limites de produto, não custos a eliminar nesta manutenção

- **Processo↔Ativo:** relação adiada explicitamente em
  [006/research D-10](../../specs/006-assets-processes/research.md). Definir com o consumidor
  real de Incidentes; não implementar antecipadamente nesta manutenção.
- **Multi-instituição:** o blueprint escolhe instalação institucional única. Multi-tenancy exige
  especificação própria de identidade, vínculo e isolamento; não adicionar `tenantId` em massa.
- **Prova criptográfica de integridade, artefatos assinados e reconstrução temporal universal:**
  capacidades distintas de auditoria append-only e dos históricos que existem. Não retrofitá-las
  silenciosamente, nem prometer prova retroativa para eventos anteriores à sua implementação.
- **Incidentes, Problemas, relatórios avançados, novos provedores de identidade, IA/MCP, filas e
  produtores de notificações:** ausência não autoriza construção como limpeza técnica.
- **Prisma exige relações reversas e registros fechados exigem agregação:** custos aceitos da
  arquitetura, não motivos para criar metamodelos, relações genéricas ou mudar a stack.

## 6. Sequência recomendada e entrega ao coordenador

1. Revalidar baseline e classificar todos os findings; registrar spec/plano/testes do saneamento.
2. Definir contratos e migração de C1 antes de paralelizar backend e frontend.
3. Executar C1/C2 integrados; em paralelo, C4/C5 e a base de testes de C3/C6 em arquivos separados.
4. Concluir C3, C6 e os V confirmados, sem concorrência destrutiva no banco ou build compartilhado.
5. Atualizar C7 e handover, executar regressão consolidada e conferir os dados migrados.
6. Revisar diff e fazer commits por unidade coerente, sem incluir arquivos anteriores indevidamente.

O [prompt de execução](./opus-sonnet-debt-remediation.md) detalha responsabilidades,
limite de agentes, aceitação, autorização e entregas. Esta revisão não realizou as correções.
