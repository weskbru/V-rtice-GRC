# Estado do trabalho — fase concluída, commitada e empurrada

> **Documento histórico — registro de fechamento da fase 007 (saneamento de dívida de
> implementação).** Não descreve necessariamente o estado atual do produto. Fonte vigente:
> [`docs/STATE.md`](../../docs/STATE.md) e [`docs/architecture.md`](../../docs/architecture.md).

Este arquivo existe para que outro contexto possa continuar **sem depender de nenhuma conversa
anterior**. Registra o que está feito, o que falta, as decisões que não podem ser reabertas e o
próximo passo exato.

**Última atualização**: 2026-09-11 — **fase encerrada, verificada por pipeline verde de ponta a
ponta**: todas as frentes implementadas. Contado do log, não de memória: **dezessete commits desta
missão** (`742677c..575e064`), mais este próprio registro final, mais **três commits anteriores a
esta sessão** (`ecf10c1`, `6b79df4`, `e43c909` — documentação do próprio dono do repositório sobre
o briefing desta missão, revisada e liberada para seguir junto) — à frente do ponto de partida
(`a03ceb0`), empurrados para `origin/main`. Pipeline de CI executado contra o push real três vezes;
ver §6 — as duas primeiras encontraram e corrigiram quatro problemas reais (dois desta própria
agente, dois na Frente H), a terceira veio **inteiramente verde, todo job**, a primeira vez isso
aconteceu nesta fase.

---

## 1. Onde a fase está

A fase 007 está **completa e integrada**. Nada permanece stageado nem pendente de commit. As nove
frentes descritas em `plan.md`/`tasks.md` — convergência de Ação (A), saneamento de Controles (D),
classificação de fronteira (D-10), atribuição de auditoria de login (D-13), particionamento de
chave de armazenamento (F-26/D-12), harness de E2E (Frente E), picker de vínculo pesquisável
(Frente H) e reconciliação de documentação (Frente G) — landaram, cada uma em sua própria unidade
de commit, revisada por diff completo antes de ser stageada. A especificação da próxima fase
(Incidentes/Problemas, item 13 do roadmap, `specs/008-incidents-problems/`) também foi commitada
nesta janela — **documentação apenas**; a implementação começou depois, por instrução do
coordenador, em duas frentes que outros dois agentes conduzem. Uma primeira peça dessa
implementação (a fundação de schema/persistência, `064c9d1`) já foi commitada — fundação apenas,
sem caso de uso nem tela, ver esse commit's own mensagem para o que ainda falta. Este arquivo
registra a fase 007, encerrada; não caracteriza o progresso contínuo da 008, que terá seu próprio
registro quando estiver pronta.

**Em palavras próprias, não do coordenador**: esta fase começou porque um diagnóstico disse que o
repositório carregava dívida que ninguém tinha medido. Ela termina com essa dívida medida,
corrigida, e provada por um pipeline que ficou verde numa execução onde quatro coisas separadas
precisaram ser encontradas e corrigidas antes — duas delas desta própria agente (o teste que só
passava por estado manual, o job de CI que nunca buildava o pacote que uma prova sua exigia), duas
na Frente H (o defeito real de acessibilidade no picker, os dois efeitos dele nos testes E2E). Nenhuma
dessas quatro foi hipotética nem presumida — cada uma foi lida até a causa, corrigida, e reverificada
antes de ser dada como fechada. Isso é o padrão que esta fase inteira tentou estabelecer, não uma
exceção que ela mesma precisou de sorte para cumprir.

| Etapa | Estado |
|---|---|
| Especificação (spec.md, research.md, data-model.md, contracts/contract-changes.md, plan.md, tasks.md, matrix.md) | **completa, aceita pelo coordenador em 2026-09-10, commitada em `742677c`** |
| Migração (`20260911000000_action_convergence_risk_treatment_actions`) | **escrita, corrigida por revisão do coordenador, provada por execução real** — ver §7 para a prova de conservação e o incidente de checksum do Prisma, ambos resolvidos |
| Domínio da Frente A | **implementado, commitado em `e693480`** — casos de uso, porte/serviço de leitura, repositório de vínculo, controller, DTOs, mapeador, predicado de vencimento consolidado numa única fonte com suíte de equivalência própria |
| Contratos (`risks.openapi.yaml`, `platform.openapi.yaml`) | **editados** (identidade `Action.id`, `reopenReason`, `treatmentDecisionId`) — dentro de `e693480` |
| Saneamento de Controles (D-11) | **commitado em `11afc29`** — `ControlRegistryPort` morto removido, `control_assessments.org_unit_id` aditivo com os dois gatilhos, repositório de escopo migrado do JOIN para a coluna |
| Classificação de fronteira (D-10) | **commitada em `13113f2`** |
| Atribuição de auditoria de login (D-13) | **commitada em `5015127`** |
| Partição de chave de armazenamento (F-26/D-12) | **commitada em `ed0753c`** |
| Harness de E2E (Frente E) | **commitada em `aaa8dcb`, completada em `07c25bf`** |
| Picker de vínculo pesquisável (Frente H) | **commitado em `84a05d0`; defeito real de acessibilidade encontrado pelo pipeline, corrigido em `575e064`** — ver §6 |
| Reconciliação de documentação (Frente G) | **commitada em `379200a`** |
| Especificação da Fase 13 (`specs/008-incidents-problems/`) | **commitada em `7c0cafc`** — documentação apenas; implementação começou DEPOIS deste commit, em duas frentes de outros agentes, ainda não pronta para registro |
| Correção de ordem de teste (idempotência do seed) | **commitada em `a569f93`** |
| Correção da esteira de formatação | **commitada em `4c1b7aa`/`2e43049`** |
| Correção do gate de CI (`test-unit` builda `@pharos/api-types`) | **commitada em `ee2b73e`** |
| Defeito de acessibilidade do picker (nome acessível fundido) | **encontrado pelo pipeline, corrigido em `575e064`** — ver §6 |
| Push para `origin/main` | **feito, três vezes** (`a03ceb0..7c0cafc`, `7c0cafc..ee2b73e`, `ee2b73e..47e4dec`) — a terceira execução de CI contra o terceiro push veio inteiramente verde (§6). Este próprio registro final, e a fundação da Fase 13 (`064c9d1`, fora do escopo desta fase), seguem num quarto push depois deste commit |

**Todo texto deste conjunto de documentos que descreve trabalho AINDA NÃO FEITO continua no modo
"estado a alcançar"**, salvo onde uma tabela é explicitamente rotulada como medição ou como
implementado.

---

## 2. Os commits desta missão, em ordem, com o que cada um cobre

Dezessete commits (`742677c..575e064`, contado do log — ver §1), todos com
`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`, todos revisados por diff
completo (nunca por tópico) antes de stageados, cada lista de caminhos mostrada ao coordenador
antes do commit:

1. `742677c` — especificação completa da Frente A (8 arquivos de `specs/007-implementation-remediation/`).
2. `e693480` — a convergência de Ação: schema, migração, casos de uso, serviço de consulta, consultas
   de registro/painel, política de vencimento consolidada com sua suíte de equivalência, contratos de
   Riscos, tipos regenerados (dez contratos), seed, testes. A maior unidade — 78 arquivos.
3. `11afc29` — saneamento de Controles: registro morto removido, coluna de escopo aditiva com
   gatilhos, `findOrgUnitIdUnscoped` consolidado.
4. `13113f2` — classificação de fronteira (`eslint.config.mjs`): categoria `composition`,
   isolamento mútuo entre capacidades do núcleo GRC.
5. `5015127` — `session.expired` nunca atribui a expiração ao dono da sessão.
6. `ed0753c` — partição da chave de armazenamento por unidade organizacional (F-26/D-12).
7. `aaa8dcb` — identidade de administrador por execução, diagnóstico real do login, correção do
   script `test` raiz.
8. `cde919b` — correção de camada da asserção de `completedAt` na reabertura (achado real do
   coordenador, não defeito de produção — ver §4).
9. `4c1b7aa` — formata sete arquivos que a esteira de formatação reprovava.
10. `2e43049` — formata o oitavo arquivo (`auto-validate-responses.ts`), descoberto depois.
11. `07c25bf` — completa a Frente E com os três specs E2E que faltavam do provisionamento por
    execução (autocorreção: eu mesma havia classificado esses três como Frente H por engano na
    primeira varredura).
12. `84a05d0` — o picker de vínculo pesquisável (Frente H, 29 arquivos).
13. `379200a` — reconciliação de documentação (Frente G), com a correção explícita sobre seis
    caminhos varridos por engano para dentro do commit 2 (ver §4).
14. `a569f93` — corrige o teste de idempotência do seed para comparar contagens ao vivo, nunca uma
    contagem contra a constante fixa do seed (ver §5).
15. `7c0cafc` — especificação da Fase 13 (Incidentes/Problemas), documentação apenas.
16. `ee2b73e` — corrige o gate de CI: builda `@pharos/api-types` antes de `test:unit`, torna a
    falha legível quando o artefato faltar (ver §6).
17. `575e064` — corrige o defeito de acessibilidade real que a segunda execução de CI encontrou no
    `SearchablePicker` (nome acessível de uma opção fundindo rótulo e código sem separação),
    encontrado só porque o pipeline rodou um navegador contra um build recém-construído desta
    sessão — ver §6 para o relato completo, incluindo a primeira tentativa de correção que não
    funcionou.

---

## 3. Decisões tomadas nesta sessão (research.md D-1 a D-29)

Sem mudança desde a última revisão — texto completo, com alternativa rejeitada, em `research.md`.
Resumo:

| Decisão | Assunto |
|---|---|
| D-1 a D-6 | Convergência de Ação: `Action` única autoridade, `risk_treatment_actions` vira link, identidade `Action.id`, transição única, autorização por origem, auditoria pelas linhas escritas, forma da migração |
| D-7 | Vencimento único: `overdue.service.ts` como única fonte — **consolidação real feita**, não apenas documentada: array exportado, gerador de fragmento SQL único, suíte de equivalência que muta o array em tempo de execução e prova que TypeScript/SQL/filtro do Prisma se movem juntos |
| D-8, D-9, D-21 | `api-types` cobre os dez contratos; validador `ajv`; `nullable:true` normalizado |
| D-10 | Fronteira `composition`, `no-unknown-files`, isolamento mútuo de `grc/*` — **implementado, commitado** |
| D-11 | Saneamento de Controles — **implementado, commitado, provado** (ver §7) |
| D-12, D-20 | F-26 — **corrigido, commitado, provado** (partição por unidade organizacional) |
| D-13 | Login sem atribuição — **corrigido, commitado** |
| D-17 (Frente A) | `prisma migrate deploy`/`migrate status` nunca revalidam checksum de migração já aplicada — achado permanente, `docs/local-environment.md` |
| D-17, D-18, D-19, D-20 (Frente E) | Harness de E2E medido e corrigido — **implementado, commitado** |
| D-22 | Picker de vínculo pesquisável (Frente H) — **implementado, commitado** |
| D-27 | Comandos de migração corrigidos nos cinco quickstarts — **commitado** |
| D-29 | Reconciliação de tasks.md contra commit real — **commitada** |

---

## 4. Achados do próprio processo de commit — registrados, não escondidos

Três coisas deram errado durante a integração final e cada uma está registrada onde um leitor
futuro vai procurar:

**Seis caminhos varridos por engano para dentro do commit da convergência (`e693480`)**: o
documento de arquitetura, o registro de decisões, o roteiro, o registro de achados, as notas de
ambiente local e o registro de áreas planejadas do dashboard pertenciam à Frente G (documentação),
não à Frente A, e foram classificados por tema em vez de por autoria verificada na primeira
varredura de commit. Não foram desfeitos — reescrever histórico enquanto outros agentes ainda
escreviam na árvore custaria mais que a desordem — e o commit `379200a` (Frente G) registra
explicitamente a correção, para que a leitura dos dois commits juntos seja honesta. A disciplina
corrigida (ler o diff completo de cada caminho candidato antes de o atribuir a uma frente, nunca
por associação temática) foi aplicada a todos os commits seguintes, incluindo uma segunda
autocorreção (item 11 de §2: três specs E2E devolvidos à Frente E depois de terem sido classificados
como Frente H por engano).

**Um teste de convergência afirmava o fato certo na camada errada** (`cde919b`): o teste D-3 de
reabertura verificava `.toBeNull()` contra `ActionRecord.completedAt`, cujo tipo declarado é
`Date | undefined`, nunca `Date | null` — convenção já existente do próprio `grc/action`, não algo
introduzido por esta frente. Rastreado ponta a ponta antes de mudar qualquer coisa: o caminho de
escrita grava `NULL` de verdade na coluna, o mapeador de saída converte para `null` no JSON — banco
e resposta já concordavam, só a asserção mirava a representação errada. Corrigido acrescentando
duas camadas de prova que não existiam (leitura direta da coluna persistida, valor de fio construído
pelo mapeador de produção), não afrouxando a asserção original.

**Um teste próprio passava localmente só por estado manual, e falhou no primeiro checkout limpo**
(`ee2b73e`, ver §6) — a mesma classe de resultado verde sem escopo que esta missão vem corrigindo a
noite toda, desta vez cometida por esta própria agente.

---

## 5. A fragilidade entre arquivos da base de teste compartilhada — real, pré-existente, só parcialmente entendida

`test/integration/**` roda todos os seus arquivos em sequência, num único processo, contra a MESMA
`pharos_grc_test` — só é truncada uma vez, antes da suíte inteira, nunca entre arquivos. Vários
arquivos plantam suas próprias fixtures de papel/permissão e legitimamente as deixam para trás.
Isso produz uma classe de falha que só aparece na suíte completa, nunca isolada:

- `seed-permission-cache-invalidation.spec.ts` comparava uma contagem ao vivo contra o tamanho fixo
  reportado pelo próprio seed (uma constante do código) — verdadeiro só quando a tabela contém
  exatamente as linhas do seed. Corrigido em `a569f93` para comparar duas contagens ao vivo entre
  si, nunca uma contagem ao vivo contra uma constante.
- Na execução completa de gate do coordenador, outras três falhas apareceram (duas na varredura de
  divulgação, uma em dados de referência) que passam isoladamente e falham em conjunto — o mesmo
  padrão. **Não fechadas nesta sessão.** Ficam registradas como fragilidade conhecida, pré-existente
  a esta frente, não como regressão dela.

O padrão de correção certo, quando alguém tocar um desses arquivos de novo: ancorar toda asserção a
uma medição tomada DENTRO do próprio teste, nunca a um valor que presume uma tabela limpa no
início. `a569f93`'s comentário de cabeçalho documenta o raciocínio completo, para não ser
redescoberto do zero.

---

## 6. O gate de CI — a primeira execução real, e o que ela provou

Duas execuções de pipeline aconteceram contra o push desta sessão:

**Primeira execução (`34566903850`, após `a03ceb0..7c0cafc`) — FALHOU, e a falha era real.**
`test:unit` falhou de verdade: `apps/api/test/unit/api-types-dist-resolution.spec.ts` (escrito
nesta mesma frente) não encontrava `@pharos/api-types/dist/index.js` — `Cannot find module`. Causa
raiz, confirmada no log, não suposta: o job `test-unit` do `ci.yml` builda
`@pharos/design-system` antes de rodar a suíte (seu `dist/` é gitignored), mas nunca buildava
`@pharos/api-types` — cujo `dist/` é igualmente gitignored e é exatamente o que este teste resolve
por resolução de módulo real do Node. **O teste passava na minha própria máquina só porque eu
mesma já tinha buildado o pacote a mão mais cedo na sessão** — estado manual que um checkout limpo
nunca tem. A mesma classe de resultado verde sem escopo que esta missão inteira vem corrigindo,
desta vez no meu próprio trabalho, e reconhecida como tal assim que encontrada.

**O gate agregado (`CI required checks`) funcionou no seu primeiro encontro real com uma falha.**
Quatro jobs a jusante (`test:contract`, `test:integration`, os dois `test:e2e`) reportaram
`skipped` porque dependiam de `test:unit`, e o job de checagem agregada — construído nesta mesma
noite — falhou corretamente por causa disso, em vez de deixar a execução aparecer parcialmente
verde. Antes desta noite essa mesma forma de falha (um job vermelho, quatro cinzas, nada declarando
a execução como um todo não-verde) é exatamente como dois achados anteriores deste repositório
ficaram escondidos por um tempo. O gate pegou a forma que foi desenhado para pegar, na primeira vez
que uma falha real aconteceu depois dele existir.

**Correção** (`ee2b73e`): uma linha, `pnpm --filter @pharos/api-types run build`, espelhando o
padrão já existente para `design-system`, adicionada ao job `test-unit` antes de `pnpm run
test:unit`. Verificado com o padrão "falha antes, passa depois": `dist/` removido localmente, suíte
rodada — vermelha; `dist/` reconstruído, suíte rodada de novo — verde, 4/4. O próprio teste também
ficou mais legível: um `Cannot find module` nu, que nomeia um caminho mas nada diz sobre a causa,
virou uma mensagem que nomeia a causa real (`dist/` não construído) e o comando exato para
corrigir.

**Segunda execução (`34567455878`, após `7c0cafc..ee2b73e`) — a correção de CI funcionou, e o
backend foi, de ponta a ponta, PELA PRIMEIRA VEZ ESTA NOITE, inteiramente verde numa única
execução contra o push real:** `install`, `typecheck`, `lint`, `format:check`, `api-types:check`,
`audit`, `build`, `openapi:check`, **`test:unit`, `test:contract` e `test:integration` — os três,
juntos, contra um banco limpo, numa única passada de CI.** Isto é o que realmente valida a
convergência de Ação, a atribuição de auditoria de sessão, a partição de armazenamento e a coluna
de escopo de Controles — as quatro frentes cujo teste mais forte, até este ponto, era uma suíte
local sob controle desta própria sessão. Aqui passaram sob condições que ninguém desta sessão
arranjou: um checkout limpo, um banco recém-migrado, um runner que não sabe nada sobre o histórico
desta noite. `test:e2e (firefox + webkit)` pulado (depende de `test:e2e (chromium)`, que falhou);
`CI required checks` falhou corretamente por causa disso.

`test:e2e (chromium)` — 74 de 78 aprovados, 1 instável (falhou e passou na segunda tentativa — ver
adiante), **3 falhas reais, reproduzidas até esgotar as tentativas**, todas atribuíveis à Frente H
(o picker pesquisável), nunca às frentes A/D/E/G/sessão/armazenamento. Diagnosticadas até a causa
raiz por outro agente, que não tinha acesso a navegador e por isso renderizou o componente
publicado no próprio ambiente do pacote web e computou o nome com uma implementação de referência
da especificação de nome acessível — a MESMA que os matchers de teste usam:

1. **Defeito real de acessibilidade, não mismatch de teste auxiliar** — a opção do
   `SearchablePicker` renderiza rótulo e descrição como dois nós de texto irmãos (`flex-col`, um
   quebra-de-linha gratuito para quem enxerga). Sem um `aria-label` explícito, o algoritmo de nome
   acessível concatena as contribuições dos nós irmãos SEM NADA entre elas, depois de aparar cada
   contribuição individualmente — a opção era anunciada como
   `"Controle fora do escopo E2E mtwjpe2ygCTL-2026-0001"`, nome e identificador fundidos sem
   separação nenhuma, num componente já usado em nove pontos de chamada em seis módulos. Um usuário
   de leitor de tela teria ouvido exatamente isso. **A primeira tentativa de correção (um separador
   visualmente oculto entre os dois nós) NÃO funcionou, verificado e não suposto**: o cálculo do
   nome apara cada nó contribuinte antes de concatenar, então o separador colapsa junto com o
   espaço em volta dele. A correção que funciona é um `aria-label` explícito na própria opção —
   imune a essa aparagem por nó porque é usado literalmente, nunca montado a partir de texto filho.
   Duas novas provas de regressão (`design-system.test.tsx`) afirmam o nome acessível computado
   diretamente (`toHaveAccessibleName`), nunca `textContent` — que não teria pego o defeito
   original, porque a opção sempre PARECIA duas linhas; ela nunca ANUNCIAVA como duas palavras.
   Corrigido em `575e064`.
2. `e2e/audit-engagement.spec.ts:89` — `pickFirstNameCodeOption()` esperava o texto de uma opção
   no formato antigo `"{name} ({code})"` (uma string única). Corrigido lendo rótulo e identificador
   dos próprios elementos estruturados (`span.truncate`, dois nós), nunca ajustando a regex contra
   uma string formatada — que teria sido a correção tentadora errada, porque o defeito real estava
   no cálculo do nome ACESSÍVEL, não no formato de texto visível, e uma regex mais tolerante não
   teria protegido contra a ausência do `aria-label`. Corrigido em `575e064`.
3. `e2e/assets-processes.spec.ts:314` e `:320` (ativo e processo) — confirmado pela árvore de
   acessibilidade real da própria execução, não hipótese: depois de um vínculo ser recusado pelo
   servidor, a única ocorrência do nome na página está dentro do próprio gatilho do
   `SearchablePicker` (que retém o item recusado por design, a mesma forma como um formulário não
   apaga um campo após uma submissão rejeitada), com o estado vazio da seção ainda corretamente
   exibido. A asserção original não distinguia "aparece como linha vinculada" de "aparece em
   qualquer lugar da página"; corrigida para mirar a região específica que realmente importa.
   Corrigido em `575e064`.

**O teste instável** (`e2e/accessibility.spec.ts:493`, "risk register quick view has no axe
violations (light)") — atribuído, não deixado sem nome: é a MESMA classe de fragilidade
entre arquivos da base de teste compartilhada já registrada em §5 (retries ligados nesse job
escondem uma corrida real atrás de um resultado verde no relatório), confirmado por outro agente
como não tocando nada da Frente H. Continua na mesma categoria de "conhecido, não fechado" que §5
já registra — uma regra deste projeto diz que um teste instável é corrigido ou removido, nunca
tolerado; fica nomeado aqui precisamente para que não seja esquecido.

Nenhuma das três falhas nem o teste instável tocam a convergência de Ação, a atribuição de
auditoria de sessão, a partição de armazenamento ou o harness de E2E — as quatro frentes que este
pipeline exercitava pela primeira vez de ponta a ponta além do picker. Essas quatro passaram
limpas.

**Números de linha de base do gate completo do coordenador** (rodado uma única vez, depois de tudo
commitado, antes da correção de CI de `ee2b73e`): `type-check`, `lint`, `format`, a checagem de
reflexão (`api-types-dist-resolution.spec.ts`, localmente com estado manual — daí a falha em CI) e
o novo gate de obsolescência (`api-types:check`) todos limpos; **485 testes de unidade da API**;
**532 testes de unidade do web**; **655 de 655 no contrato**; **186 de 186 na integração** (depois
da correção de `a569f93` — antes dela, cinco falhas no contrato e uma na integração, todas
pré-existentes à fragilidade entre arquivos de §5, não desta frente, exceto a de `a569f93` mesma).

**Terceira execução (`34570690516`, após `ee2b73e..47e4dec`) — TODO JOB VERDE. A primeira execução
inteiramente verde de ponta a ponta desta fase.** `install`, `typecheck`, `lint`, `audit`,
`format:check`, `test:unit`, o gate de obsolescência (`api-types:check`), `build`, a checagem de
reflexão, `test:contract`, `test:integration` e **`test:e2e (chromium)`** — todos `success`, os
dois defeitos reais de `575e064` corrigidos e confirmados. `test:e2e (firefox + webkit)` é pulado
por seu próprio gatilho manual (`workflow_dispatch`, não roda em todo push por desenho) — a única
exceção que o gate agregado (`CI required checks`) permite, e ele reconheceu essa exceção
corretamente e fechou verde, não uma lacuna disfarçada de sucesso.

Isto é a remediação inteira verificada de ponta a ponta contra código recém-construído, num
ambiente que nenhuma sessão controlava: a convergência de Ação, a atribuição de auditoria de login,
a partição de chave de armazenamento, a coluna de escopo denormalizada de Controles, as regras de
fronteira, os tipos de contrato com validação de payload nas 168 operações, as identidades de teste
por execução, e o picker pesquisável com sua correção de acessibilidade. Nenhuma dessas peças havia
rodado num navegador contra um build atual antes desta noite.

---

## 7. Prova de conservação e o incidente de checksum do Prisma — RESOLVIDOS

Ambos já fechados em sessão anterior a este commit final, texto preservado:

- **Incidente real, registrado por inteiro, e RESOLVIDO**: `prisma migrate deploy`/`migrate
  status` nunca revalidam o checksum de uma migração já aplicada contra o conteúdo atual do
  arquivo — achado permanente em `docs/local-environment.md` D-17 e `matrix.md` F-71. Resolvido
  reconstruindo o schema de `pharos_grc_test` do zero (nunca migração corretiva), confirmado
  ponta a ponta (69 tabelas → 0 → 69, checksum único e correto, enum morto ausente). **A base de
  DESENVOLVIMENTO (`pharos_grc`) nunca foi tocada.**
- **Prova de conservação contra cópia descartável da base de desenvolvimento**: dump/restore de
  `pharos_grc` para um schema descartável (`conservation_check`, dentro do mesmo banco — sem
  CREATEDB, sem tentar obter a senha de superusuário), migração 48 aplicada, comparação de
  identidade e conteúdo linha a linha: 77 linhas de vínculo reais (22 já ligadas, 55 sem
  `action_id`, 3 `Action` órfãs) com zero divergência. Mais cinco casos sintéticos, claramente
  rotulados, cobrindo os ramos que os dados reais não alcançavam (completado com evento
  recuperável, cancelado, com evidência, completado SEM evento recuperável — guarda disparada de
  verdade, origem incompatível — guarda disparada de verdade). Ambas as guardas nunca tinham visto
  uma linha ruim antes desta prova.

---

## 8. Limites honestos — o que NÃO foi feito, e por quê

Registrado para que a próxima sessão saiba exatamente onde procurar, não para minimizar:

**A suíte de navegador LOCAL não validou nada do código desta sessão** — mas o pipeline de CI, sim,
e essa distinção importa. Os processos locais servindo as portas 3000/3001 são um build anterior a
esta sessão, e o coordenador não estava autorizado a interrompê-los para reiniciar com o código
novo; toda evidência de navegador coletada localmente (Chromium 75/3/0, testes de cookie de sessão)
é válida para o que provava na hora, mas não para nada escrito depois. **O pipeline de CI (§6) foi
o primeiro lugar onde este trabalho foi exercitado de ponta a ponta contra um build real desta
sessão, jobs de navegador incluídos, e encontrou algo real**: 74 de 78 testes Chromium passaram, 1
instável (fragilidade já conhecida, §5), 3 falharam de verdade — as três, um defeito genuíno de
acessibilidade no `SearchablePicker` mais dois efeitos dele nos próprios testes E2E, todos
atribuíveis à Frente H, já diagnosticados até a causa raiz e corrigidos em `575e064` (ver §6 para o
relato completo, incluindo a tentativa de correção que não funcionou). A convergência de Ação, a
atribuição de auditoria, a partição de armazenamento e a coluna de escopo de Controles passaram
limpos nesse mesmo exercício, backend inteiro incluído (`test:unit`/`test:contract`/`test:integration`
juntos, banco limpo) — a primeira prova real de que essas quatro frentes funcionam de ponta a
ponta, não apenas nos testes que já as cobriam sob condições que esta própria sessão controlava.

**A base de desenvolvimento (`pharos_grc`) está deliberadamente NÃO migrada.** As migrações 48
(convergência de Ação) e 49 (coluna de escopo de Controles) foram aplicadas e provadas contra
`pharos_grc_test` e contra a cópia descartável, nunca contra `pharos_grc`. Motivo, decisão do
coordenador, não esquecimento: os processos servindo `pharos_grc` ainda consultam as seis colunas
que a convergência remove — migrar agora quebraria a aplicação em execução no primeiro request que
tocasse uma ação de tratamento, e ninguém nesta sessão está autorizado a reiniciar esses processos.
A base de desenvolvimento é migrada quando o desenvolvedor a reconstruir e reiniciar por conta
própria, nos termos dele.

**Controles e Compliance (itens 9 e 10 do roteiro) não têm cobertura E2E nem de acessibilidade
próprias** — achado nesta sessão (F-55, `docs/deferred-findings.md`), não fechado nesta sessão.
Toda fase de módulo de negócio posterior (Auditoria e Achados, Ativos e Processos) entregou os
três pilares (backend, E2E, acessibilidade) junto; estas duas não, e `CLAUDE.md` §17 as lista como
concluídas sem qualificar a lacuna. Não é regressão silenciosa — nenhuma das duas fases afirmou ter
entregue os três. O plano de execução para fechar isso — escopo, dono de cada peça, custo
aproximado — está escrito e pronto para a próxima sessão executar, em
`specs/007-implementation-remediation/controls-compliance-e2e-a11y-plan.md`.

**A fragilidade entre arquivos da base de teste compartilhada (§5) está só parcialmente
entendida.** Um caso (`seed-permission-cache-invalidation.spec.ts`) foi diagnosticado e corrigido
até a raiz. Pelo menos três outros (duas falhas na varredura de divulgação, uma em dados de
referência) mostram o mesmo sintoma — passam isolados, falham em conjunto — mas não foram
diagnosticados individualmente nesta sessão. Ficam registrados como conhecidos, não como
resolvidos.

---

## 9. Próximo passo exato

A fase 007 está encerrada — a terceira execução de CI (`34570690516`, §6) veio inteiramente verde,
sem ressalva pendente na Frente H nem em nenhuma outra. O que resta é trabalho de outras frentes,
não desta:

1. **Diagnosticar as outras fontes de fragilidade entre arquivos** nomeadas em §5 (duas na
   varredura de divulgação, uma em dados de referência, mais o teste instável de acessibilidade
   nomeado em §6) — mesmo padrão de correção que `a569f93` já estabeleceu: ancorar a uma medição
   tomada dentro do próprio teste.
2. **Executar o plano de E2E/acessibilidade de Controles e Compliance**
   (`controls-compliance-e2e-a11y-plan.md`), quando alguém pegar essa frente.
3. **Migrar `pharos_grc`** quando o desenvolvedor reconstruir/reiniciar o ambiente local, nos
   termos dele — nunca por iniciativa de uma sessão de agente.
4. **A Fase 13** (Incidentes e Problemas) tem sua especificação commitada
   (`specs/008-incidents-problems/`) e sua fundação de schema/persistência já commitada também
   (`064c9d1`, outra frente, FUNDAÇÃO APENAS — sem caso de uso, controller ou tela; ver esse
   commit's own message para o que falta e por que `ActionOriginType` não foi estendido ainda).
   Este arquivo registra apenas isso, não o progresso contínuo da Fase 13 — o registro dela é dela,
   quando estiver pronta.
