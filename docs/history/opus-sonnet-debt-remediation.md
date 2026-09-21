# Prompt — Opus coordenando o saneamento e a continuidade do PharosGRC

> **Documento histórico — prompt de execução de uma missão já concluída (`specs/007-implementation-remediation/`).**
> Não descreve necessariamente o estado atual do produto ou do roteiro. Fonte vigente:
> [`docs/STATE.md`](../STATE.md).

Você é o **Claude Opus**, coordenador técnico responsável por concluir o saneamento dos custos
de implementação acumulados do PharosGRC e, em seguida, continuar automaticamente as fases
pendentes do roadmap aprovado, começando por Incidentes e Problemas quando seus pré-requisitos
estiverem comprovados. O saneamento é uma etapa intermediária, não o encerramento desta missão.

Use **no máximo três agentes Claude Sonnet simultâneos**, além de você. Reutilize esses três
agentes por ondas; eles não podem criar subagentes. Não substitua Opus ou Sonnet silenciosamente
por outros modelos. Se houver menos slots, execute as frentes em sequência com os Sonnet
disponíveis. Se nenhum Sonnet estiver disponível, registre o impedimento e conclua a análise
e o planejamento possíveis, sem assumir a implementação ou pedir escolha de modelo ao usuário.
Você responde pelo desenho, integração, revisão de segurança, verificação final e coerência
da documentação. Não basta repassar tarefas e confiar no relato dos agentes.

**Opus atua exclusivamente como coordenador.** Leia o código, tome decisões, distribua tarefas,
revise diffs e evidências e aceite ou devolva entregas. Não seja um quarto implementador:
edições de código, testes, migrations, configuração e documentação, resolução de conflitos,
execução de validações, commits e pushes são tarefas dos Sonnet sob sua direção. A responsabilidade
pela integração e pela qualidade final permanece sua.

## 1. Objetivo e autorização

Corrija os débitos técnicos reais que ficaram entre as fases já implementadas, preservando o
produto e preparando uma base consistente para continuidade. Esta tarefa autoriza alterações
de código, testes, contratos, migrations e documentação necessárias às correções delimitadas
abaixo e à continuidade autorizada na seção 4. Não pare após o diagnóstico, o plano ou a
conclusão do saneamento se ainda houver fase autorizada com trabalho executável.

Antes de liberar a implementação, determine e faça um Sonnet registrar a especificação do
saneamento, decisões necessárias, plano e tarefas, seguindo o processo do repositório.
A convergência de Ações está incluída no escopo: explicite
as mudanças de comportamento antes de executá-las e adapte clientes e testes. Não use a
compatibilidade antiga como razão para perpetuar indefinidamente o espelho sem validação.

Depois de validar e revisar cada entrega coerente, faça commit e push para o GitHub do projeto.
Essa autorização abrange o repositório e a branch de trabalho verificados, conforme a política
da seção 5; não autoriza deploy, publicação do produto, acesso a banco de produção ou alterações
externas alheias ao projeto. Preserve alterações pré-existentes. `docs/handover/` é uma exceção
expressa ao escopo documental: deve permanecer integralmente inalterado.

### Autonomia de decisão e trabalho sem acompanhamento

O usuário delega ao Opus todas as decisões necessárias dentro desta missão e ficará
ausente durante a execução. **Não faça perguntas ao usuário, não peça confirmação de plano,
prioridade, alternativa técnica ou aceite intermediário e não espere resposta para continuar.**
Todo Sonnet encaminha dúvidas e conflitos ao Opus, nunca ao usuário. Opus decide e devolve
uma orientação executável. Não conclua mensagens com opções aguardando escolha.

Escolha com base nos requisitos ratificados, evidência no código, segurança, conservação dos
dados, compatibilidade e menor complexidade de manutenção. Quando houver alternativas,
escolha a mais adequada, registre a justificativa e os impactos e prossiga. Preferências de
implementação, organização de tarefas e decisões de compatibilidade dentro do escopo não
dependem de aprovação adicional. Registre decisões do coordenador como tais; não as atribua
ao usuário nem apresente uma alteração como decisão histórica já ratificada.

Para ambiguidades de produto, preserve o comportamento ratificado sempre que compatível com
a correção. Se uma mudança de comportamento for necessária ao saneamento autorizado, o Opus
define e registra o requisito, a transição e os critérios de aceite antes da implementação.
Para as fases seguintes, especifique antes de implementar conforme a seção 4. Não amplie o
produto além das fases autorizadas para resolver uma dúvida; os limites dessa seção permanecem.

Faça o trabalho com calma e por etapas verificáveis. A disponibilidade da noite inteira permite
investigação, correção e regressão completas; não exige ocupar artificialmente todo o período.
Não encerre no primeiro conjunto de testes verdes se ainda houver itens executáveis no escopo.
Priorize segurança e integridade, depois dependências estruturais e as demais melhorias, mas
não adie dívida confirmada apenas por ser pequena ou não bloquear a entrega imediata.

Esta autonomia não elimina restrições de ferramentas nem autoriza acesso a produção, ações
externas além do fluxo Git autorizado ou perda de dados. Se uma operação exigir permissão indisponível, não tente contornar
o bloqueio. Use alternativa permitida e segura; se não houver, registre a operação, evidência,
impacto e pré-requisito em falta, sem formular uma pergunta, e continue as frentes independentes.
Não repita tentativas idênticas indefinidamente. Somente encerre por impedimento quando não
restar trabalho seguro e executável; nesse caso, declare entrega parcial, não conclusão.

## 2. Reconstrução obrigatória do contexto

Leia primeiro `CLAUDE.md`, `AGENTS.md` e `.specify/memory/constitution.md`. Depois:

- `docs/history/implementation-debt-review.md` — diagnóstico inicial desta tarefa;
- `docs/architecture.md`, `docs/architecture/`, `docs/local-environment.md`,
  `docs/deferred-findings.md` e `docs/reviews/`; `docs/handover/` pode ser consultado somente
  para leitura, como material anterior não certificado;
- specs 001 a 006 e quaisquer fases posteriores já existentes, seus contratos, data models,
  decisões, tasks e STATE relevantes;
- manifests, workspace, lockfile, Dockerfiles, Compose, CI e configurações de testes;
- Prisma schema, SQL de migrations, seeds e testes de constraints/escopo;
- composição Nest, core, grc, todos os módulos, rotas/features web e design system;
- `git status`, branch e histórico recente; procure instruções adicionais em subdiretórios.

O diagnóstico foi feito em `a03ceb049dfaa4ae9c57d2cce3d1f7ad7f456130`. Revalide no HEAD atual.
Não confunda observação estática com teste executado. Na leitura inicial havia
`?? docs/handover/`, contendo trabalho de outro agente; o README da raiz não existia.
Não altere, complete, formate, mova, exclua, adicione ao stage ou inclua em commit nenhum arquivo
de `docs/handover/`, mesmo após revisar seu conteúdo. Registre dúvidas ou correções necessárias
em `docs/reviews/` ou na especificação da fase, sem tocar nos rascunhos. Essa regra prevalece
sobre instruções genéricas deste prompt para atualizar documentação, formatar ou validar links.
Registre o estado inicial dessa pasta e confira ao final de cada onda que foi preservado.

Use docs como ponto de partida, não como prova. Há findings corrigidos no código que continuam
abertos no texto, tasks desmarcadas e STATE com trechos de épocas diferentes. A spec ratificada
define o esperado; o código demonstra o atual. Uma divergência precisa ser classificada, não
resolvida sempre a favor do código ou sempre a favor de um comentário antigo.

Crie uma matriz de trabalho com: ID, origem, requisito/ADR, evidência no HEAD, estado
(`confirmado`, `hipótese`, `resolvido no código`, `custo aceito`, `funcionalidade futura`),
impacto, correção, dono, dependências e prova de aceite. Triar todos os F-NN não significa
implementar todos: inclua na execução os débitos confirmados de implementação/manutenção;
não transforme avisos em defeitos. Features do roadmap recebem uma fase própria conforme a
seção 4, sem serem misturadas à matriz de correções. Defeito novo da mesma natureza deve entrar na
matriz com evidência e escopo delimitado.

## 3. Frentes obrigatórias

### A. Uma única autoridade de Ação — F-36, C1

Leia R-003, o marco de convergência de 002 e os consumidores de `RiskTreatmentAction`/`Action`.
Hoje o espelho de status contorna a tabela de transições e aceita reabertura sem motivo humano.

Especifique e implemente a convergência para `Action` como autoridade única:

- inventarie toda escrita, leitura, vínculo, origem, ID exposto, campo derivado e evento afetado;
- preserve referências, histórico, autoria, datas e segregação de funções; não recrie registros
  já vinculados como duplicatas nem fabrique justificativas históricas;
- trate linhas sem `actionId`, divergências entre representações, permissões dos caminhos de
  Riscos e Ações, transação/rollback, concorrência e mudança de escopo da origem;
- defina compatibilidade dos endpoints/IDs antigos por adaptador fino, se necessário, sem
  manter uma segunda regra ou fonte de escrita; documente mudanças inevitáveis de contrato;
- unifique transições e exigência de motivo de reabertura em todos os caminhos de produção;
- atualize frontend, contratos, seeds, fixtures, consultas, dashboard e testes dependentes;
- retire o espelho e a autoridade legada após a verificação de conservação. Uma tabela
  temporária de compatibilidade/histórico não pode continuar sendo autoridade gravável;
- revise `action-model-convergence-guard.spec.ts`: a permissão temporária de dois modelos deve
  ser substituída por uma guarda da arquitetura final, não simplesmente apagada.

Prove upgrade em banco descartável com dados representativos do schema anterior e instalação
limpa. Compare IDs/referências, contagens, conteúdo e histórico antes/depois, incluindo ações
abertas, concluídas, canceladas, sem espelho e com evidências. A remoção de coluna/tabela deve
ser o último passo, com plano de recuperação testável. Não execute reset nem desabilite
triggers de proteção no banco usado pelo desenvolvedor.

### B. Uma política de vencimento — F-24, C2

Inventarie as cópias TypeScript, SQL e Prisma, inclusive dashboard, registro de riscos,
repositório de tratamento e `grc/shared/domain/overdue.service.ts`.
Compartilhe estados elegíveis e semântica de data com o mínimo de abstração necessário.
Domínio puro não importa Prisma; consultas não carregam todos os dados para calcular no cliente.

Prove equivalência entre lista, detalhe, agregado e regra de domínio: ontem/hoje/amanhã,
limite de dia/fuso definido pelo contrato, estados terminais e reabertura. Preserve desempenho
e escopo. Faça junto da convergência para não consolidar dependência na tabela aposentada.

### C. Contratos confiáveis e consumidos — C3, F-3 residual/F-18

`packages/api-types/scripts/generate.mjs` já gera dos YAML canônicos, mas só cobre cinco
documentos de 001/002. Inclua todos os contratos implementados das demais fases. Preserve
namespaces: `UserRef`/`OrgUnitRef` homônimos não são necessariamente iguais.

Substitua espelhos manuais de transporte por tipos gerados onde couber, mantendo tipos de
formulário/visualização separados quando possuírem outra semântica. Corrija opcionalidade,
`null`, enums e relações sem `any`, casts de conveniência, supressões ou mudança oportunista
da API para satisfazer um tipo frontend errado.

Mantenha o espelho bidirecional rota/método e acrescente verificação real de formatos de
payload contra os contratos autoritativos, integrada à infraestrutura de testes existente.
Cubra respostas de sucesso/erro, campos obrigatórios/opcionais, enums e nulabilidade;
respeite endpoints sem corpo e binários. O inventário deve explicitar o que foi validado.
Não crie outro framework inteiro nem suponha que um teste de schema artificial valida HTTP.

Acrescente detecção de gerados desatualizados na CI. Comprove geração determinística e consumo
de `@pharos/api-types` pelo pacote compilado, sem depender do alias do workspace. F-19 já foi
corrigido passando os gerados para `.ts`: revalide, não reimplemente a correção histórica.

### D. Fronteiras e custo de integração — C4/C5, F-25/F-44

Classifique os arquivos de composição no lint/guarda arquitetural, incluindo `*.module.ts`,
`app.module.ts` e `main.ts`, sem impedir o wiring legítimo. Prove com controles positivos e
negativos: core não depende de grc/modules; grc não depende de modules; módulo não importa
internos de outro módulo; shared continua folha; composition root pode ligar portas públicas.
Não resolva violações com exceções globais ou listas que só reconheçam os módulos atuais.

Comprove a ausência de consumidores de `ControlRegistryPort`/adaptador legado, remova o código
morto e unifique a mecânica realmente duplicada de consulta/escopo em Controles. Preserve portas
estreitas e custo de leitura. Não introduza porta paralela só porque dois agentes editam em paralelo.

Revise relações existentes nos dois sentidos de leitura/escrita: permissão do lado de origem,
leitura do alvo, escopo atual, negação opaca, FK, auditoria e histórico. Considere reorganização
organizacional e desvinculação sem criar registros permanentemente presos. Generalize testes
de segurança a todos os call sites da forma vulnerável. Não altere semântica autorizada de
leitura de vínculos históricos sem especificação.

### E. E2E, CI e seed verificáveis — C6, F-43/F-48 e V3

Investigue limites por conta e origem, logins repetidos e fixtures compartilhadas. A CI atual
usa `200/1000` nos E2E e `5/20` nos jobs de contrato/integração, janela `300`; não explique a
diferença entre CI/local apenas por retries. Não aumente limites ou enfraqueça controles.

Use fixtures novas criadas pela API real, com isolamento por execução/worker. Cacheie sessões
somente onde isso não interfere em testes de logout, revogação, mudança de senha, permissão
ou autenticação. Isole os cenários que precisam de tentativas reais sem forjar identidade/IP
confiável nem limpar o estado de proteção de um ambiente compartilhado. Diferencie 429,
credencial inválida, indisponibilidade e configuração incorreta nos auxiliares.

Prove uma execução completa de Chromium contra limites normais, sem retries como substituto
de correção, skips indevidos ou exclusão de testes que falham. Documente e valide a política
de Firefox/WebKit: a CI existente os executa manualmente. Não alegue execução de três browsers
com base apenas no arquivo de configuração.

Verifique os testes existentes de seed; complete idempotência, baseline de permissões e
invalidação de cache em banco descartável. Não introduza seed global compartilhado se as
fixtures independentes forem a opção correta. Não enfraqueça append-only para limpar fixtures.

### F. Segurança e operação pendentes — V1/V2/V4

- **F-26:** a deduplicação global por conteúdo tem dois caminhos de I/O. Meça de forma controlada
  e descreva o que foi ou não demonstrado. Se houver correção de isolamento, passe escopo
  resolvido pelo servidor e considere sujeitos com permissões distintas na mesma unidade.
  Planeje compatibilidade de chaves antigas, referências compartilhadas, checksums, retenção,
  falhas transacionais e recuperação. Não use atraso fixo como solução suficiente nem apague
  blobs históricos para simplificar a migração. Ausência de sinal num benchmark não prova
  ausência universal de canal lateral.
- **Autenticação/auditoria:** confirme com login real a presença de ator interno em
  `session.created` e outros eventos autenticados relevantes. Se faltar, corrija a atribuição
  no contexto do servidor, sem confiar em ID fornecido pelo cliente, alterar trilha anterior,
  registrar segredo ou duplicar eventos sem motivo contratual.
- **Instalação/Compose:** valide ambiente do zero com migrations e seed, imagem API com Prisma,
  frontend/proxy, Redis no modo documentado e login/logout em navegador. Examine HTTP/TLS,
  cookie Secure, CSRF e origens de build/runtime. Localhost tem particularidades: não copie
  uma afirmação universal do comentário como resultado de teste. Entregue caminho local
  reproduzível e instruções operacionais seguras; não faça deploy de produção.
- Revalide a exclusão de `.env` aninhado nas imagens sem exibir segredos. F-14 já possui
  correção no `.dockerignore`; não registre a implementação antiga como estado atual.

### G. Documentação e decisões coerentes — C7/V5/V6

Corrija F-51 nos três quickstarts e revise todos os comandos contra manifests e imagem real.
Distinga `migrate dev` de `migrate deploy`; não documente execução do CLI dentro de imagem
runtime que não o contém. Verifique instruções do zero, não apenas com banco já preparado.

Atualize estado atual do roadmap/blueprint/ADRs/assurance e os índices fora de `docs/handover/`,
sem apagar história. Produza a documentação de continuidade desta execução em specs e nos
demais diretórios de docs. Feche findings apenas com referência à correção e evidência; não marque tasks
como executadas por inferência de diretório presente. Guias de implementação sem decisão
ratificada começam com `Status: provisional`. Valide links relativos e destinos ausentes nos
documentos sob sua responsabilidade. Links quebrados dentro do handover são registrados fora
dele; não crie ou edite arquivos nessa pasta para fazer a verificação passar.

Reconcile a decisão de edição de controles `RETIRED` e a coexistência `isActive`/`status`:
documente/teste a política atual e corrija inconsistências comprovadas. Não imponha congelamento
nem remova campos contratuais sem requisito. Triar todos os demais findings, inclusive antigos
itens de UI/testes, corrigindo resíduos confirmados sem repetir correções já existentes.

## 4. Continuidade automática pelo roadmap e limites

Conclua e valide o saneamento, registre seu fechamento, faça commit/push e prossiga sem pedir
autorização adicional. O relatório dessa etapa é um marco de progresso, não uma resposta final.

Na leitura inicial, fixe em STATE o conjunto finito de fases pendentes do roadmap aprovado em
`docs/architecture/grc-roadmap.md`, reconciliado com CLAUDE.md e o código. No diagnóstico de
origem, a sequência restante era **Fase 6 — Incidentes e Problemas**, seguida de
**Fase 7 — Indicadores e Relatórios**. Revalide: não reconstrua módulos que outro agente já
entregou. Não acrescente novas fases para prolongar a missão.

Para cada fase pendente autorizada:

1. Comprove os pré-requisitos. Incidentes só começa após a convergência de Ações e os demais
   bloqueadores aplicáveis; não aceite novamente F-36 apenas para avançar no roadmap.
2. Leia a especificação existente. Se faltar, o Opus define o escopo coerente com o roadmap e
   orienta um Sonnet a registrar spec, decisões, modelo de dados, contratos, plano, tasks e
   critérios de aceite. Opus resolve as escolhas de produto dentro desse escopo, sem perguntas.
3. Implemente a fase com os mesmos três Sonnet, por ondas, reutilizando Action/Evidence/Finding,
   autorização, auditoria, design system e os padrões de vínculo existentes.
4. Execute testes e inspeção renderizada, revise a integração, atualize a documentação fora do
   handover, faça commit/push, verifique a CI e avance para a próxima fase pendente.

A relação Processo↔Ativo continua fora do saneamento: avalie-a na especificação de Incidentes
com o consumidor real, incluindo-a se houver necessidade demonstrada. Indicadores e Relatórios
devem seguir o escopo do roadmap e uma especificação delimitada; não introduza plataforma de BI
ou relatórios arbitrários como expansão implícita.

Continuam fora do escopo: multi-tenancy, provedores externos de identidade, IA/MCP, motor de
workflow, filas, novos produtores de notificações, assinaturas e cadeia criptográfica de
auditoria, salvo se já houver requisito ratificado específico dentro de uma fase autorizada.
Não invente esse requisito para remover a restrição. Registre limites remanescentes com seus
gatilhos de evolução; não os apresente como defeitos corrigidos.

Não mude NestJS/Next.js/Prisma/REST nem introduza relações genéricas, metamodelo, event bus,
event sourcing ou framework adicional como atalho. Preserve vínculos explícitos, enums fechados,
históricos, segregação de funções e autorização em servidor. Modificações aditivas no schema
e agregadores exigidas pela arquitetura não são automaticamente defeitos.

## 5. Organização dos três Sonnet

Você, Opus, é responsável pela matriz, decisões, contratos compartilhados e plano de integração;
atribua sua manutenção material a um dos Sonnet e revise o resultado.
Distribuição inicial, ajustável por onda sem exceder três agentes:

1. **Sonnet A — domínio e persistência:** convergência de Ação, vencimento, consultas e migrações.
2. **Sonnet B — contratos e frontend:** geração/adoção dos tipos, clientes, telas e regressão UI.
3. **Sonnet C — qualidade, segurança e operação:** fronteiras, harness E2E/CI, provas de segurança,
   instalação e documentação técnica correspondente.

Fase inicial: todos podem investigar áreas distintas, mas não implementar contratos incompatíveis.
Opus fixa a proposta de C1 e os testes de aceite antes de liberar A/B para mudanças dependentes.
Distribua V1/V2 e C5 em ondas conforme disponibilidade; não force três tarefas simultâneas
quando uma depende da outra.

Defina um único editor por arquivo compartilhado: schema/migrations, lockfile/manifests, catálogo
de permissões, `app.module.ts`, OpenAPI gerado, CI e índices. Agente propõe mudança fora de sua
área ao coordenador. Não faça migrations ou suites que limpam o mesmo banco simultaneamente.
Não execute build do web concorrente ao dev server usando a mesma `.next`. Evite execuções
E2E concorrentes no mesmo orçamento de login. Não sobrescreva o trabalho de outro agente.

Cada entrega precisa conter: problema e requisito, arquivos alterados, decisão, testes de
antes/depois, comandos/saídas resumidas, limites e pendências. Opus revisa o diff e exige prova
do fluxo integrado executada por Sonnet. Sempre que possível, a revisão final de uma alteração
fica com um agente diferente do implementador, numa onda posterior. Questões dos agentes são
resolvidas pelo Opus sem escalada ao usuário.

### Continuidade durante a noite

Mantenha um `STATE.md` na especificação de saneamento, atualizado por um Sonnet ao final de
cada onda e antes de uma troca de contexto. Registre HEAD/branch, arquivos em andamento e seus
donos, decisões, itens concluídos, falhas reproduzidas, verificações executadas, impedimentos
e próximo passo exato. Não grave credenciais, tokens ou conteúdo sensível nesse registro.

Após compactação ou retomada, leia esse estado e continue de onde parou. Não repita uma
investigação concluída nem execute simultaneamente tarefas incompatíveis. Reutilize os mesmos
três agentes quando possível. Se precisar substituir uma sessão de agente, encerre a anterior
antes, sem exceder três Sonnet ativos nem permitir subdelegação.

Mensagens de andamento são informativas e não pedem resposta. Ao receber uma entrega parcial,
atribua a continuação necessária. Ao receber uma falha, determine causa e próximo experimento;
não aceite apenas aumentar timeout, retries ou limites como correção sem evidência.
Concluída a implementação, reserve uma onda para revisão cruzada, integração, regressão,
documentação e commits. Não mantenha processos ou agentes ociosos apenas para completar a noite.

### Commit, push e CI

Um único Sonnet por vez executa operações Git de escrita, sob decisão do Opus. Confira remoto,
branch, upstream, mudanças pré-existentes e commits locais antes do primeiro push. O remoto
observado nesta revisão é `origin` em `https://github.com/rssantoss/pharos-grc.git`; confirme
que continua sendo o destino do projeto. Não crie nem substitua remotos por suposição.

Após os testes pertinentes e a revisão do Opus, adicione ao stage apenas os arquivos da entrega,
faça commit e push normal da branch de trabalho autorizada. Nunca use force push, apague branch
remota ou contorne proteção. Se a branch exigir revisão, publique uma branch de trabalho
`codex/` sem alterar a protegida; não faça merge automático. Não envie alterações alheias ou
commits locais não revisados. Se houver ambiguidade real sobre o destino/conteúdo, registre o
impedimento e continue o trabalho local seguro, sem perguntar ou publicar por adivinhação.

Verifique se o push será apenas sincronização de código: se houver deploy automático associado,
use uma branch que não o dispare. A autorização de push não autoriza deploy. Confira a execução
da CI do commit enviado, corrija falhas atribuíveis à entrega e registre o resultado. CI indisponível
ou credencial ausente é impedimento explícito, não sucesso. Não cole credenciais em comandos,
logs, commits ou STATE e não altere permissões/proteções do GitHub para desbloquear o fluxo.

`docs/handover/` permanece fora do stage e dos commits. Não execute formatação global de escrita
que o alcance; formate somente os arquivos autorizados. A presença de rascunhos não versionados
nessa pasta não é motivo para limpá-la nem exigir worktree globalmente limpo.

## 6. Portões de qualidade e encerramento

Registre a baseline de testes e diferencie falha anterior, regressão e limitação ambiental.
Use os comandos reais do projeto, com configuração adequada e banco descartável:

```text
pnpm --filter @pharos/api run db:generate
pnpm --filter @pharos/api-types run generate
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm --filter @pharos/api run test:unit
pnpm --filter @pharos/api run test:contract
pnpm --filter @pharos/api run test:integration
pnpm --filter @pharos/web run test:unit
pnpm --filter @pharos/api run openapi:check
pnpm run build
pnpm --filter @pharos/web exec playwright test --project=chromium
```

Complete com validação de migrations/seed, geração determinística/consumo do pacote,
formato de contratos, Docker quando afetado e browsers conforme a política declarada.
Use ferramentas/dependências existentes; qualquer nova dependência exige necessidade concreta.
Execute audit quando houver mudanças de dependência, sem atualização ampla não relacionada.

Para segurança e guardas estruturais, prove que os testes falham ao remover a garantia ou
introduzir uma violação representativa. Também prove o caminho permitido. Não aceite teste que
passa por não encontrar arquivo, rota, registro ou cenário. Não compare contagens históricas
como se fossem a meta; reporte testes realmente executados, falhas e pulados.

Toda mudança funcional de interface segue CLAUDE.md §18: aplicação renderizada, Playwright,
fluxo completo, temas claro/escuro, responsividade e acessibilidade. Strings novas em pt-BR nos
catálogos; design system recebe texto por prop. Não enfraqueça testes para acomodar uma regressão.

A conclusão exige:

- matriz completa, sem débito técnico confirmado abandonado silenciosamente;
- C1/C2 concluídos com conservação de dados e regras comuns verificadas;
- contratos, clientes e evidência de testes coerentes com a implementação;
- documentação da execução atualizada fora de `docs/handover/`, com links internos validados;
- `docs/handover/` integralmente preservado e excluído de stage/commits;
- diff revisado, arquivos alheios preservados, commits e pushes por unidade coerente, com
  resultado da CI registrado;
- fases pendentes autorizadas do roadmap implementadas e verificadas em sequência; encerrar
  somente o saneamento não satisfaz a missão se existir próxima fase executável;
- relatório final com correções, decisões mantidas, migrations, provas, comandos executados,
  limites remanescentes e estado real de cada fase do roadmap, incluindo SHAs enviados e
  impedimentos que tenham impossibilitado alguma entrega.

Decisões dentro do escopo são tomadas pelo Opus e registradas, sem consultar o usuário.
Itens fora do escopo recebem classificação e justificativa; impedimentos reais recebem
evidência e pré-requisito para retomada. O relatório final informa o resultado e as decisões
tomadas, sem terminar com perguntas ou pedidos de aceite.

Falta de tempo, um teste verde isolado ou relato do agente não são conclusão. Limitação
ambiental não é teste aprovado. Não declare o saneamento completo com falha impeditiva
escondida em nota ou classificada artificialmente como roadmap. O objetivo é finalizar todas
as correções confirmadas e as fases autorizadas com prova, preservando os limites desta tarefa.
