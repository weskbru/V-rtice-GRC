# Probo Benchmark — Validação da Arquitetura de Domínio do PharosGRC

> Artefato arquitetural durável. Não é relatório de conversa.
> Conclusões em pt-BR; identificadores técnicos, nomes de tabela e trechos de código permanecem
> em inglês (CLAUDE.md §11.1).

> **Artefato de evidência (CLAUDE.md §19.1) — não é especificação do PharosGRC.** O Probo é
> referência de domínio; diferença em relação a ele não é, por si, defeito nosso. Fonte vigente do
> estado atual do produto: [`docs/STATE.md`](../STATE.md).

---

## 1. Sumário executivo

O Probo foi usado como **evidência**, nunca como autoridade. A conclusão central é que o
PharosGRC **não tem defeito arquitetural fundamental** revelado por este benchmark, e é
**materialmente superior** ao Probo nos eixos que mais importam para uso institucional
brasileiro: auditabilidade, segregação de funções, reconstrução histórica e ciclo de vida do
risco.

O valor real está em outro lugar: o Probo mostra, com evidência datada em migrações reais,
**como um domínio GRC se conecta** — e onde ele se fragmenta quando não se conecta. Três
descobertas justificam sozinhas o exercício:

1. **A separação Requisito × Controle.** O Probo separa a cláusula do framework (que ele chama
   `Control`) da salvaguarda efetivamente implementada (que ele chama `Measure`), ligadas N:M.
   Uma prática passa a satisfazer cláusulas de vários frameworks sem duplicar trabalho,
   evidência ou tarefas. O histórico de migrações prova que a alternativa ingênua foi tentada
   primeiro (um campo texto `standards`) e abandonada.
2. **A validação da regra anti-genericidade (ADR-008).** O Probo tentou mecanismos
   semi-genéricos **quatro vezes** e reverteu **todas**. Não existe tabela `links`/`tags`
   genérica em 585 migrações. Nossa regra não é preferência estética — é o mesmo destino a que
   um projeto maduro chegou por tentativa e erro.
3. **O custo de não ter capacidades GRC compartilhadas.** No Probo, `Evidence` está soldada a
   `Measure` por FK obrigatória, `Task` só se liga a `Measure`, e `Finding` não tem relação
   alguma com `Control`. Achado de auditoria, incidente e remediação de conformidade **não têm
   onde registrar trabalho nem prova**.

**Nenhuma reescrita é recomendada.** Nenhuma mudança de schema, contrato REST ou do módulo de
Risco é proposta por este documento.

---

## 2. Escopo do benchmark

Inspeção estática, somente leitura, de código-fonte, migrações, schema GraphQL, documentação de
engenharia e testes. A aplicação Probo **não foi executada**, nenhum script dela foi rodado,
nenhuma dependência dela entrou no PharosGRC. O clone vive em `C:\dev\_benchmark\probo`, fora da
árvore do projeto — não é submódulo, não é dependência.

Seis análises paralelas independentes (schema e grafo de relacionamentos; pilha de controles;
risco/ativos/fornecedores; auditoria/documentos/privacidade/workflow;
plataforma/autorização/auditoria/MCP/IA; políticas de engenharia e testes), mais uma
reconstrução independente da linha de base do PharosGRC a partir do próprio repositório.
Consolidação e decisões finais são do agente principal.

---

## 3. Versão do Probo analisada

| Campo | Valor |
|---|---|
| Repositório | https://github.com/getprobo/probo |
| Branch | `main` |
| Commit | `466c07b8cafd06dd28100aa94de621967c21b1c1` |
| Data do commit | 2026-09-04 19:44:47 +0200 |
| Data do benchmark | 2026-09-07 |
| Migrações inspecionadas | 585 arquivos `pkg/coredata/migrations/*.sql` |
| Stack | Go, GraphQL (gqlgen), Relay, PostgreSQL, React |

Registrado para que a análise permaneça reproduzível conforme o Probo evolui.

---

## 4. Linha de base atual do PharosGRC

Reconstruída do repositório, não da memória. 36 modelos Prisma, 16 enums, PostgreSQL com
`citext`/`pg_trgm`.

**Implementado**: autenticação (abstração de provedor, só adaptador LOCAL), sessões,
autorização/RBAC, catálogo de permissões, usuários, papéis, unidades organizacionais e escopo,
auditoria, arquivos/anexos, comentários, dashboard, e o módulo de Gestão de Riscos completo —
CRUD, causas/consequências, metodologia versionada, avaliações append-only, decisões de
tratamento, ações de tratamento, aprovações com segregação de funções, ciclo de vida com tabela
de transições e pré-condições, histórico e revisão periódica.

**Parcial**: notificações (infraestrutura pronta, nenhum produtor de evento);
`registerPermissionDefinitions` (mecanismo existe, **zero call sites**).

**Ausente**: `core/configuration` (declarado em CLAUDE.md §4, sem implementação); listagem de
sessões pelo próprio usuário; todos os demais módulos de negócio.

**Diferença estrutural decisiva**: o PharosGRC **não tem modelo multi-tenant**. Escopo é interno
— árvore `OrganizationalUnit` com caminho materializado mais `OrgScopeGrant`. O Probo é SaaS
multi-tenant com `organization_id` e `tenant_id` em quase toda tabela. Toda lição de isolamento
do Probo traduz-se aqui como disciplina de **escopo organizacional**, não de tenancy.

---

## 5. Inventário de capacidades do Probo

Domínios reais encontrados: organizações e identidades; frameworks e cláusulas; medidas
(salvaguardas); evidências; tarefas; riscos e análise de risco (DFD/STRIDE); planos de
tratamento; obrigações legais; declaração de aplicabilidade (SoA); auditorias e achados;
documentos/políticas com versionamento e aprovação por quórum; assinatura eletrônica;
privacidade (ROPA, DPIA, TIA, DSAR); revisões de acesso; terceiros com catálogo global
enriquecido por IA; ativos; funções de negócio (BCM/BIA); sistemas de IA (EU AI Act); portal
público de conformidade; conectores (60+ provedores); CMP/cookies; agentes de IA; MCP; CLI; n8n.

Ausentes no Probo: **gestão de incidentes** e **gestão de problemas** — não existem. `Finding` é
o análogo mais próximo, e é escopado a achado de auditoria.

---

## 6. Modelo de domínio do Probo

| Probo | Significa | Vocabulário convencional |
|---|---|---|
| `Framework` | catálogo de cláusulas, por organização | Framework |
| `Control` | cláusula do framework, FK obrigatória a um framework | **Requisito** |
| `Measure` | salvaguarda que a organização implementa, sem framework | **Controle** |
| `Evidence` | prova, FK obrigatória a `Measure` | Evidência |
| `Task` | trabalho, FK opcional a `Measure` | Tarefa / Ação |
| `Obligation` | dever legal ou contratual | Obrigação |
| `Finding` | não conformidade | Achado |
| `Audit` | engajamento com firma auditora | Auditoria |

**A inversão de vocabulário é a armadilha número um deste benchmark.** Mapear "Control do
Probo" para "Controle do PharosGRC" produz um modelo errado.

---

## 7. Grafo de relacionamentos do Probo

```
Framework --1:N--> Control --N:M--> Measure --1:N--> Evidence
                                       |
                                       +--1:N--> Task
                                       +--N:M--> Risk
                                       +--N:M--> Document
                                       +--N:M--> ThirdParty
```

`measures.framework_id` **existiu e foi removido uma migração depois** da criação da tabela
(`20250327T122609Z.sql`). A independência da medida em relação ao framework é escolha
deliberada, não omissão.

Tecido conectivo real, em ordem: `iam_membership_profiles` (dono/responsável/aprovador
universal), `measures` (hub verdadeiro da cadeia de conformidade — mais conectado que
`Control`), e `files`.

**Relacionamentos que não existem no Probo**, verificados por varredura exaustiva: Risk↔Asset,
Risk↔ThirdParty, Risk↔BusinessFunction, Risk↔Control direto (sempre transita por Measure),
Finding↔Control, Finding↔ação de remediação, Evidence↔Document, Evidence↔Finding,
Evidence↔Audit, AiSystem↔qualquer coisa.

---

## 8. Comparação com o PharosGRC

| Eixo | Probo | PharosGRC | Veredito |
|---|---|---|---|
| Separação requisito × controle | sim | não existe | **lacuna do Pharos** |
| Evidência compartilhada | não, soldada a Measure | não existe | ambos fracos |
| Ação compartilhada | não, só Measure | escopo risco | ambos parciais |
| Relacionamentos explícitos e tipados | sim | sim, ADR-008 | **empate, ambos corretos** |
| Ciclo de vida do risco | **inexistente** | 8 estados + transições | **Pharos superior** |
| Histórico de avaliação | sobrescreve em lugar | cadeia append-only | **Pharos superior** |
| Segregação de funções | **inexistente** | domínio + CHECK no banco | **Pharos superior** |
| Auditoria: before/after | `metadata` fixo em `{}` | valores ant./post. | **Pharos superior** |
| Auditoria: negações | descartadas | registradas `DENIED` | **Pharos superior** |
| Auditoria: append-only | convenção | partição + trigger + privilégio | **Pharos superior** |
| Auditoria: autenticação | não coberta | coberta | **Pharos superior** |
| Reconstrução histórica | só documentos | avaliações, decisões, transições | **Pharos superior** |
| Exclusão | hard delete | nunca; soft com atribuição | **Pharos superior** |
| Escopo organizacional | plano | árvore com caminho materializado | **Pharos superior** |
| Taxonomia de risco | texto livre | tabelas de referência | **Pharos superior** |
| Metodologia | escala fixa no validador | nomeada e versionada | **Pharos superior** |
| Revisão periódica | inexistente | `nextReviewOn` + vencimento | **Pharos superior** |
| Permissão por registro | `permission(action:)` | snapshot por papel | **Probo superior** |
| Versionamento de framework | inexistente | n/a | ambos precisam resolver |
| Cálculo de conformidade | inexistente | n/a | oportunidade do Pharos |
| Aprovação de artefato publicado | documento + quórum + e-sign | inexistente | **Probo superior** |
| Isolamento E2E | tenant novo por teste | pool compartilhado | **Probo superior** |
| Cobertura de contrato | só prosa | D-11 + teste espelho | **Pharos superior** |
| Teste de frontend | ~1 arquivo | 245 testes | **Pharos superior** |

---

## 9. Comparação de Gestão de Riscos

Pergunta da §11: *o Probo demonstra lacuna estrutural no módulo de Risco já implementado?*

**Não.** O modelo do Probo é significativamente menos maduro:

- nenhum enum de status ou ciclo de vida; `treatment` acumula papel de estratégia e de status
  implícito, sem regra de transição;
- `Risk.Update()` é `UPDATE` direto — reavaliar destrói os valores anteriores;
- sem código legível (`RSK-…`), embora `Measure`, `Task` e `BusinessFunction` tenham;
- categoria em texto livre, sem tabela de taxonomia;
- escala 1–5 fixa no validador de serviço, não configurável, sem objeto de metodologia;
- sem cadência de revisão e sem conceito de vencimento;
- sem aprovação para aceitação de risco — é edição de campo comum;
- sem ligação a ativo, fornecedor ou processo.

A evidência mais forte para a §10: o Probo **tinha** separação avaliador/aprovador nas
avaliações de fornecedor (`assessed_by` + `approved_by`) e **removeu deliberadamente as duas
colunas** em `20250922T120000Z.sql`.

Duas ideias merecem adaptação futura, ambas DEFER: **expiração de avaliação**
(`ThirdPartyRiskAssessment.ExpiresAt`, dirigindo reavaliação) e **modelagem de ameaças
estruturada** (DFD/STRIDE gerando riscos com proveniência).

---

## 10. Controles, medidas e evidências

**O que adotar conceitualmente**: dois conceitos, não um. A cláusula do framework e a
salvaguarda organizacional são coisas diferentes, com donos, ciclos e cardinalidades
diferentes, ligadas N:M.

**O que corrigir**: usar vocabulário convencional — `Requirement` para a cláusula, `Control`
para a salvaguarda — e não a inversão do Probo.

**O que fazer melhor**:

- Evidência **não** pode ser soldada a um único tipo de entidade. No Probo,
  `evidences.measure_id` é NOT NULL, e por isso achado de auditoria e obrigação legal não têm
  trilha de prova própria.
- Estado de conformidade deve ser **calculado**, não digitado. No Probo, `measure.state`,
  `control.maturity_level` e `obligation.status` são três enums independentes editados à mão,
  sem reconciliação: um controle pode marcar `DEFINED` enquanto sua única medida marca
  `NOT_STARTED`.

---

## 11. Frameworks e conformidade

Conteúdo de framework no Probo é JSON estático empacotado no frontend
(`apps/console/public/data/frameworks/*.json`, 13 frameworks), importado por `importFramework`,
que gera um `Framework` novo e uma `Control` nova por cláusula.

**Versionamento de framework é inexistente.** Não há campo de versão, tabela de versões nem
mutação de atualização. Reimportar uma revisão cria um `Framework` desconectado com IDs novos —
toda ligação a medidas, documentos, obrigações e auditorias, e toda a Declaração de
Aplicabilidade, precisa ser refeita à mão.

Para o PharosGRC isso é aviso, não modelo: framework precisa de **versão como entidade de
primeira classe** desde o início, e o mapeamento requisito↔controle precisa sobreviver à
revisão de uma norma. ISO 27001, LGPD e normas de governo são revisadas.

---

## 12. Ativos e processos

`Asset` no Probo é fino: enum de dois valores (PHYSICAL/VIRTUAL), `Amount` como contador de
quantidade, classificação de dados em texto livre, sem criticidade, sem código. Liga-se a
`BusinessFunction` e `ThirdParty` — **não** a Risk nem a Control.

`BusinessFunction` é a entidade de processo, orientada a continuidade de negócio (MTD/RTO/RPO).
Não se liga a Risk.

**Aviso concreto**: o Probo tem **dois conceitos de ativo desconectados** — o registro de
conformidade `Asset` e o `Device` do subsistema ITAM (postura, heartbeat, MDM), sem nenhuma FK
entre eles. Um notebook gerenciado existe duas vezes no modelo. O PharosGRC deve promover
`Asset` de registro de referência a módulo **sem** criar um segundo conceito paralelo.

---

## 13. Modelo de ação e tarefa

`Task` é entidade única compartilhada, escopada à organização, com quadro kanban — mas liga-se a
no máximo **uma** `Measure`, por FK anulável, e não é polimórfica.

Consequência: achado de auditoria, incidente e remediação de conformidade **não têm onde
registrar trabalho**. `Finding.CorrectiveAction` é campo de texto livre.

Este é o argumento mais forte a favor de **uma** capacidade de Ação compartilhada no PharosGRC,
consumível por tratamento de risco, achados, incidentes e remediação de conformidade. O código
atual já antecipa isso: `RiskTreatmentAction` traz comentário dizendo que foi moldada para um
futuro módulo compartilhado de Planos de Ação.

---

## 14. Auditorias e achados

`Audit` é engajamento com firma externa, escopado a organização + framework. `Finding` tem
`kind` (não conformidade menor/maior, observação, exceção), `status` e `priority`.

Relacionamentos: Audit↔Finding via `findings_audits`; Finding→Risk por FK anulável.
**Finding↔Control não existe.** Finding↔evidência não existe. Finding↔ação de remediação não
existe.

O papel `AUDITOR` é membro de primeira classe com política somente-leitura. O PharosGRC já tem
papel `Auditor` equivalente com `risk:view` + `audit:view` em escopo global.

---

## 15. Terceiros e fornecedores

A área mais rica do Probo. `ThirdParty` traz hierarquia de subprocessadores
(`parent_third_party_id` + `level`), contratos com validade (DPA, BAA, relatórios de
conformidade), estado de vetting assíncrono e ligação a um **catálogo global cross-tenant**
(`common_third_parties`) enriquecido por agentes de IA.

`ThirdPartyRiskAssessment` é genuinamente historizado, com `ExpiresAt` que força reavaliação —
único ponto onde o Probo historiza avaliação melhor que no próprio Risco.

Decisão: **DEFER**. Gestão de terceiros não está no roteiro aprovado (CLAUDE.md §1) e não deve
ser adicionada porque o Probo a tem. O padrão de proveniência do enriquecimento por IA (§24) é o
que vale guardar.

---

## 16. Privacidade

ROPA é sólida. DPIA e TIA são, na prática, modelos de documento vestidos de tabela — quase todos
os campos em texto livre, e nenhum dos dois referencia a tabela `risks`. Retenção é um único
campo texto. DSAR tem enum de tipo e prazo.

Para a LGPD, o conceito a preservar no modelo-alvo é **atividade de tratamento** ligada a
terceiros, ativos e riscos — precisamente a ligação que o Probo não fez. Implementação DEFER.

---

## 17. Revisões de acesso

Modelo real e bem construído: campanha → fonte → entrada → decisão, com histórico append-only
(a tabela não tem `updated_at` e o tipo Go não expõe `Update`/`Delete`), e `Upsert` que exclui
campos de decisão do `ON CONFLICT` — reprocessar a fonte nunca sobrescreve o veredito de um
revisor.

Fraquezas: não há atribuição de revisor (qualquer OWNER/ADMIN decide qualquer entrada, inclusive
a própria) e a campanha **não produz Evidência nem Achado** — o resultado morre no módulo.

DEFER, mas o princípio "reprocessar a fonte nunca sobrescreve decisão humana" é a guardar.

---

## 18. Governança documental

Forte. `Document` + `DocumentVersion` com major/minor, índice parcial garantindo uma única
versão não publicada, e edição de versão publicada sempre bifurcando novo rascunho. Aprovação
por **quórum unânime** de aprovadores nomeados. Assinatura eletrônica de nível de produção: hash
SHA-256, selo criptográfico, carimbo de tempo RFC 3161 de TSA real, PDF marcado, certificado de
conclusão e trilha própria de eventos com IP e user agent.

**Mas**: aprovar uma versão **não satisfaz nada** no grafo de conformidade — as tabelas de
quórum e decisão não têm coluna apontando para controle, medida ou framework. E `Evidence` não
tem `document_id`: uma política aprovada **não pode servir como evidência**.

---

## 19. Workflow e aprovações

Não existe mecanismo de aprovação reutilizável. Existem três formas construídas à mão (quórum de
documento; assinatura de documento; decisão de revisão de acesso) e **quatro domínios sem porta
alguma** — aceitação de risco, maturidade de controle, fechamento de achado e estado de
auditoria são edição direta de campo.

O padrão minimalista merece atenção: em vez de portas por domínio, o Probo canaliza assinatura
para **um** lugar, o Documento, e faz os demais domínios passarem por ali **gerando um
documento** que retrata periodicamente aquele domínio (`publishRiskList`, `publishFindingList`,
`publishStatementOfApplicability`, todos recebendo `approverIds`). Aprovar o registro de riscos
não é workflow sobre `Risk`; é aprovar o documento imutável que o retrata.

Custo real: ações de nível de registro ficam **sem porta nenhuma**.

Conclusão: são **duas primitivas complementares**, não uma. Aprovação de registro (que já temos,
e melhor, porque tem segregação de funções) e aprovação de artefato publicado (que não temos, e
que é exatamente o que sustenta defensabilidade sob inspeção).

---

## 20. Comparação de autorização

Probo: ABAC estilo AWS IAM — `Statement{Effect, Actions, Resources, Conditions}` com curingas e
condições sobre atributos de principal e recurso. Papel é apenas atributo que seleciona o pacote
de políticas. Isolamento **não** usa RLS: é `tenant_id` embutido no próprio identificador mais um
fragmento SQL em toda consulta, com o escopo derivado no servidor a partir da resolução do
recurso — nunca fornecido pelo cliente. Autorização é chamada **por resolver**, não por
middleware.

PharosGRC: RBAC `resource:action` com registro de permissões, guarda global que **recusa
qualquer rota sem declaração** de permissão, escopo organizacional hierárquico obrigatório e sem
valor padrão no `ScopedRepository`, e negação auditada.

O que o Probo tem de melhor: **projeção de permissão por registro**. `permission(action:)`
responde "este usuário pode esta ação **neste registro**?", executando a mesma avaliação da
mutação em modo simulação. Nosso snapshot por papel responde apenas "este usuário detém
`risk:approve`?" — o que não consegue expressar requerente ≠ aprovador, obrigando o frontend a
recodificar a regra ou descobri-la em um 403.

Duas disciplinas que se traduzem diretamente: **escopo desnormalizado em toda tabela escopada**
(autorização nunca depende de join nem de FK vinda do cliente) e **`authorize()` devolve o
escopo resolvido; o código a jusante usa aquele escopo, jamais rederiva a partir do id do
cliente** — regra que existe lá por causa de IDOR reincidente.

---

## 21. Comparação de auditabilidade

O eixo mais importante para o contexto do PharosGRC, e onde a distância é maior.

| Item | Probo | PharosGRC |
|---|---|---|
| Valores anterior/posterior | **não** — `metadata` fixo em `{}` | sim |
| IP e user agent | não | sim |
| ID de correlação | não | sim |
| Ações negadas | **descartadas** | registradas como `DENIED` |
| Autenticação e sessão | **não cobertas** | cobertas |
| Ações de sistema/worker | invisíveis (`ActorTypeSystem` nunca atribuído) | atribuídas |
| Append-only | convenção | partição + trigger + privilégios revogados |
| Acoplamento transacional | não | sim (`AuditNotInTransactionError`) |
| Evidência de adulteração | nenhuma | nenhuma (ver §38) |
| Retenção | nenhuma | a definir |
| Caminho privilegiado sem auditoria | `proboctl` fala direto com o Postgres | não existe |

O log do Probo é, na prática, "qual ação autorizada sobre recurso escopado teve sucesso" — não
uma trilha de auditoria de conformidade. Não sustentaria inspeção que exija eventos de
autenticação, registro de negações, valores anteriores ou política de retenção.

**Onde o PharosGRC deve mirar mais alto que ambos**: evidência de adulteração (encadeamento de
hash ou assinatura) e política explícita de retenção e exportação.

---

## 22. Reconstrução histórica

Probo: só `document_versions` permite reconstrução real. `Risk`, `ThirdParty`, `Control` e
`Identity` têm apenas `created_at`/`updated_at`. Como o log de auditoria não guarda payload,
**não é possível reconstruir como um risco, fornecedor, controle ou usuário estava em uma data
passada**. Existem tabelas de evento append-only para `measure_events` e `treatment_plan_events`;
o subsistema genérico de snapshot foi construído e **removido**.

PharosGRC: `RiskAssessment` (cadeia `previousAssessmentId`), `RiskTreatmentDecision` (cadeia de
supersessão), `RiskLifecycleTransition` e `RiskMethodologyVersion` são append-only por desenho. A
reconstrução "como estava em X" é possível para risco.

Ponto honesto: o append-only do `RiskAssessment` é **convenção de aplicação**, sem trigger de
banco — diferente do `AuditEvent`, protegido no banco. Registrado como decisão consciente em
aberto, não como omissão.

Recomendação: **não** generalizar um mecanismo "as-of" agora. Padronizar o *padrão* (cadeia
append-only tipada por domínio) e aplicá-lo a cada novo domínio que precise. Um subsistema
genérico de snapshot é exatamente o que o Probo construiu e arrancou.

---

## 23. Automação, API, CLI e MCP

O Probo expõe GraphQL (três schemas), CLI (`prb` para usuário final, `proboctl` para operação),
MCP (354 handlers de ferramenta) e nó n8n. A regra escrita exige que toda funcionalidade exista
nas quatro superfícies — **sem nenhum mecanismo de CI que verifique isso**.

Descoberta verificada no código: **o MCP não contorna autorização nem auditoria.** `AddRiskTool`
chama o mesmo `Authorizer.Authorize` e o mesmo `RiskService.Create` que a mutação GraphQL. Como
o log está embutido no autorizador, toda escrita via MCP também é auditada pelo mesmo caminho.

Contraexemplo no mesmo produto: `proboctl` conecta **direto ao PostgreSQL**, sem escopo, sem
autenticação de sessão e sem gerar linha de auditoria.

Princípio para o PharosGRC (preparação arquitetural, sem implementação): qualquer superfície de
automação futura — MCP, CLI, integração — **chama os mesmos serviços de aplicação e a mesma
camada de autorização e auditoria**. Nunca um caminho de dados paralelo. O REST permanece a
arquitetura aprovada; um eventual adaptador MCP é adaptador, não segunda porta para o banco.

---

## 24. Arquitetura pronta para IA

O Probo tem IA embutida: SDK de laço agêntico, execução durável em Postgres, wrapper de
provedores, descritor de evidência e enriquecimento de fornecedores.

**A fronteira está no lugar certo**, rastreada ponta a ponta: a ferramenta de IA obtém a
identidade de um contexto de execução preenchido pelo servidor — **não forjável pelo modelo** — e
chama o mesmo serviço de domínio e o mesmo autorizador que a mutação humana.

**Onde o Probo não sustenta a própria fronteira**: construiu primitiva de aprovação humana e
guardrail de prompt injection e **não ligou nenhuma das duas em produção** (a busca por uso
encontra apenas testes). Escrita iniciada por IA é confirmada assim que o IAM passa. E a
auditoria não distingue ação originada por IA de qualquer chamada com chave de API.

O padrão realmente bom está no enriquecimento de fornecedores:
`EnrichedField{Value, Confidence, SourceURL}` — cada campo escrito por IA carrega confiança e
fonte, há limiar mínimo, contadores de tentativa, portão de revisão humana e proteção para que
edição humana nunca seja sobrescrita silenciosamente.

Princípios registrados para o PharosGRC:

1. IA chama serviços de aplicação, nunca o banco nem o modelo diretamente.
2. Identidade vem do contexto do servidor, nunca da saída do modelo.
3. Ação de IA é auditável e atribuível, com **tipo de ator distinto**.
4. Portão de revisão humana para escrita iniciada por IA — construído **e ligado**.
5. Dado escrito por IA carrega proveniência e nunca sobrescreve edição humana em silêncio.

---

## 25. Padrões de produto de UI/UX

O Design System e a política de UI/UX (CLAUDE.md §18) permanecem autoritativos. Nada da
aparência do Probo é adotado.

**ADAPT** — arquitetura de informação da página de detalhe: o detalhe de um `Control` no Probo
mostra o registro e então **cartões de entidades ligadas** espelhando exatamente as conexões do
domínio (medidas, documentos, auditorias, obrigações). Relacionamento como cidadão de primeira
classe da página, não aba escondida. Nosso detalhe de risco já caminha nessa direção; o padrão
deve ser explícito para módulos futuros.

**ADAPT** — gating de UI por permissão consumida do servidor, colocado no componente que
renderiza a ação, com a regra explícita de que esconder botão é conveniência, não controle de
segurança.

**REJECT** — portal público de conformidade: audiência errada para nosso contexto.

---

## 26. Políticas de engenharia

O `AGENTS.md` do Probo tem 47 linhas e **nenhuma regra** — é índice puro, uma linha por tópico
apontando para `contrib/claude/<tópico>.md`. Nosso `CLAUDE.md` passa de 600 linhas e cresceu 13
subseções na fase anterior. O padrão índice + arquivos por tópico é resposta direta ao inchaço.

Regras que se traduzem e merecem virar política permanente aqui:

1. Erro opaco por padrão — só categorias mapeadas revelam mensagem; o ramo `default` sempre
   devolve erro interno genérico e registra o original no servidor.
2. Log estruturado sem PII — registrar identificadores, nunca valores.
3. Proteção contra SSRF por padrão em toda chamada HTTP de saída.
4. Três níveis de segredo em repouso: hash para token, hash de senha para senha, cifra reversível
   só para o que precisa ser lido de volta.
5. Escala de decisão de estado no frontend, e a regra que nomeia nosso próprio defeito: **um hook
   de estado de URL nunca tem espelho em `useState` com efeito de escrita de volta.**
6. Dado buscado não desce por prop de ancestral; o componente que usa lê onde usa.
7. Validação de formulário no nível mais baixo que expressa a regra.
8. Teste de regressão de segurança generaliza para **todo call site que compartilha o padrão
   vulnerável**, não só a instância reportada.

Rejeitado como culto à carga, no próprio contexto do Probo: "toda funcionalidade em quatro
superfícies", mantida apenas por prosa, sem portão de CI.

---

## 27. Testes

Probo: pirâmide pesada em integração backend, com E2E como arnês primário. **Frontend
praticamente sem testes** — um único arquivo `.test.ts` em toda a superfície JS/TS.

**Isolamento E2E — o achado mais acionável.** Não há banco por teste nem rollback transacional.
Cada teste cria **o próprio tenant pelo fluxo real de cadastro** (e-mail único, confirmação via
Mailpit, organização nova). O isolamento **é** a fronteira de tenancy de produção, exercitada de
verdade. O que não é escopado usa geradores de nome seguro.

Nosso problema é o oposto: pool compartilhado e mutável de contas, que produziu a corrida da
F-16 e os 37 usuários órfãos da F-34.

Fraquezas do Probo: nenhum portão de CI garantindo cobertura por operação de schema; nenhuma
enumeração do catálogo de permissões (cobertura RBAC é template copiado em ~170 arquivos); e
cinco vulnerabilidades de cross-tenant/IDOR divulgadas em cerca de seis meses de 2026, achadas
por pesquisadores externos, não pela suíte.

O PharosGRC é superior aqui: D-11 exige cobertura de contrato para todo endpoint, existe teste
espelho contrato↔implementação, e há 245 testes de frontend.

---

## 28. Matriz de lacunas de capacidade

| Capacidade | Probo | PharosGRC hoje | Alvo | Decisão | Prioridade |
|---|---|---|---|---|---|
| Requisito × Controle separados | sim | não | sim | **ADAPT** | A (decisão) / B (código) |
| Evidência compartilhada | não | não | sim | **ADAPT** | B |
| Ação compartilhada | não | parcial | sim | **ADAPT** | B |
| Achado (Finding) | sim, isolado | não | integrado | **ADAPT** | C |
| Versão de framework | não | n/a | sim | **ADAPT** | C |
| Cálculo de conformidade | não | n/a | calculado | **ADAPT (mirar mais alto)** | C |
| Aprovação de artefato publicado | sim | não | sim | **ADAPT** | C |
| Permissão por registro | sim | não | sim | **ADAPT** | B |
| Isolamento E2E por fixture nova | sim | não | sim | **ADAPT** | B |
| Escopo desnormalizado | sim | parcial | sim | **ADOPT** | B |
| Escopo resolvido propagado | sim | sim | manter | **ALREADY SUPERIOR** | — |
| Ciclo de vida do risco | não | sim | manter | **ALREADY SUPERIOR** | — |
| Segregação de funções | não | sim | manter | **ALREADY SUPERIOR** | — |
| Auditoria com before/after | não | sim | manter | **ALREADY SUPERIOR** | — |
| Auditoria de negação | não | sim | manter | **ALREADY SUPERIOR** | — |
| Append-only no banco | não | sim | estender | **ALREADY SUPERIOR** | — |
| Hierarquia organizacional | não | sim | manter | **ALREADY SUPERIOR** | — |
| Evidência de adulteração | não | não | sim | **ADAPT (ninguém tem)** | D |
| Assinatura eletrônica | sim, robusta | não | avaliar | **DEFER** | D |
| Terceiros | sim, rico | não | avaliar | **DEFER** | D |
| Privacidade/LGPD | parcial | não | avaliar | **DEFER** | D |
| Revisão de acesso | sim | não | avaliar | **DEFER** | D |
| Modelagem de ameaças | sim | não | avaliar | **DEFER** | D |
| Adaptador MCP | sim | não | preparar | **DEFER (preparação)** | D |
| GraphQL / Relay / Go | sim | não | não | **REJECT** | E |
| Tabela genérica de links | não | não | não | **REJECT (ambos)** | E |
| Subsistema genérico de snapshot | removido | não | não | **REJECT** | E |
| Portal público de conformidade | sim | não | não | **REJECT** | E |
| CMP / cookies / trackers | sim | não | não | **REJECT** | E |
| Hard delete | sim | não | não | **REJECT** | E |
| Auditoria só de permitidos | sim | não | não | **REJECT** | E |
| Tenancy plana | sim | não | não | **REJECT** | E |

---

## 29. Matriz de lacunas de relacionamento

| A | B | No Probo | No Pharos hoje | Recomendado | Por que importa |
|---|---|---|---|---|---|
| Risk | Control | indireto via Measure | `RiskControlLink` | manter direto | tratamento cita controle |
| Risk | Asset | **não existe** | `RiskAssetLink` | manter | risco recai sobre ativo |
| Risk | Process | **não existe** | `RiskProcessLink` | manter | risco recai sobre processo |
| Risk | Incident | n/a | não existe | N:M explícito | incidente materializa risco |
| Risk | Finding | FK anulável | não existe | N:M explícito | achado gera ou confirma risco |
| Requirement | Control | N:M | não existe | **N:M** | um controle serve muitas normas |
| Framework | Requirement | 1:N | não existe | 1:N via versão | cláusula pertence a uma versão |
| Control | Evidence | via Measure | não existe | N:M por registro | prova de efetividade |
| Control | Process | **não existe** | não existe | N:M | controle opera sobre processo |
| Control | Asset | **não existe** | não existe | N:M | controle protege ativo |
| Finding | Control | **não existe** | não existe | N:M | achado aponta falha de controle |
| Finding | Action | **não existe** | não existe | 1:N | remediação é trabalho rastreável |
| Finding | Evidence | **não existe** | não existe | N:M | prova de fechamento |
| Audit | Requirement | via Control | não existe | N:M | escopo da auditoria |
| Audit | Finding | N:M | não existe | 1:N | achado nasce da auditoria |
| Action | origem | só Measure | só risco | **registro de tipo fechado** | trabalho precisa de uma casa |
| Evidence | sujeito | só Measure | não existe | **registro de tipo fechado** | prova serve a vários |
| Document | Requirement | **não existe** | n/a | N:M | política satisfaz requisito |
| Document | Evidence | **não existe** | n/a | documento pode ser evidência | política aprovada é prova |

---

## 30. Decisões consolidadas

**ADOPT** (princípio, reescrito para nossa stack): escopo desnormalizado em toda tabela
escopada; escopo resolvido propagado, nunca rederivado; erro opaco por padrão; log sem PII;
SSRF por padrão; três níveis de segredo; escala de decisão de estado no frontend; teste de
regressão de segurança generalizado ao padrão; índice de política + arquivos por tópico.

**ADAPT**: separação Requisito × Controle com nomes convencionais; Evidência como capacidade
compartilhada por registro de tipo fechado; Ação compartilhada idem; Achado integrado; versão de
framework de primeira classe; estado de conformidade calculado; aprovação de artefato publicado;
permissão projetada por registro; isolamento E2E por fixture nova; arquitetura de informação de
detalhe com relacionamentos; princípios de fronteira de IA com proveniência.

**ALREADY SUPERIOR** (preservar, não regredir): ciclo de vida do risco; histórico append-only de
avaliação; segregação de funções em dois níveis; auditoria com valores anterior/posterior, IP,
user agent, correlação, negações e acoplamento transacional; append-only garantido no banco;
escopo organizacional hierárquico; taxonomia e metodologia versionada; revisão periódica;
ausência de hard delete; cobertura de contrato garantida por teste; camada real de teste de
frontend.

**REJECT**: migração para Go/GraphQL/Relay; tabela genérica de relacionamento; subsistema
genérico de snapshot; portal público de conformidade; CMP/cookies; hard delete; auditoria só de
ações permitidas; tenancy plana; caminho administrativo direto ao banco sem auditoria.

**DEFER**: terceiros; privacidade/LGPD; revisões de acesso; modelagem de ameaças; assinatura
eletrônica; inventário de sistemas de IA; adaptador MCP; enriquecimento por IA.

---

## 31. Núcleo GRC compartilhado recomendado

Recomenda-se reconhecer formalmente uma camada entre `core/` (plataforma) e `modules/`
(negócio). Critério de admissão, deliberadamente estreito: **um conceito só entra se pelo menos
três domínios de negócio precisarem dele e nenhum puder ser seu dono exclusivo.**

Entram: **Control** (salvaguarda), **Evidence**, **Action**, **Finding**.

Já existem e permanecem em `core/`: Approval (já genérico via `ApprovableEntityType`),
Attachment, Comment, Notification, Audit, Files, escopo organizacional.

**Não entram agora**, por não passarem no critério: Assessment (só o Risco tem hoje —
generalizar seria abstração prematura), Workflow (a infraestrutura de aprovação existente
basta), Tag, Relationship genérico.

---

## 32. Blueprint do domínio-alvo

Ver `docs/history/grc-domain-blueprint.md`.

## 33. Mapa integrado de entidades

Ver `docs/history/grc-domain-blueprint.md`.

## 34. Dependências entre módulos

Ver `docs/architecture/grc-roadmap.md`.

## 35. Roteiro de implementação recomendado

Ver `docs/architecture/grc-roadmap.md`.

## 36. Mudanças recomendadas antes do próximo módulo

Ver `docs/architecture/grc-roadmap.md`, seção *Portão arquitetural*.

---

## 37. Diferenciais de setor público

Onde o PharosGRC deve permanecer distinto do Probo, por exigência do contexto institucional
brasileiro: hierarquia organizacional real; segregação de funções aplicada e verificada no
banco; auditoria de negações e de eventos de autenticação; valores anterior e posterior;
imutabilidade garantida por privilégio e trigger, não por convenção; preservação histórica sem
exclusão física; interface e terminologia em pt-BR; aprovação com responsabilidade nominal; e,
à frente de ambos os produtos, **evidência de adulteração e pacote exportável de evidência para
inspeção**.

---

## 38. Oportunidades adiadas

Evidência de adulteração no log de auditoria (encadeamento de hash ou assinatura) e política
explícita de retenção e exportação — nenhum dos dois produtos tem, e é onde o PharosGRC pode
liderar. Assinatura eletrônica com carimbo de tempo. Expiração de avaliação dirigindo
reavaliação. Modelagem de ameaças estruturada gerando riscos com proveniência. Adaptador MCP.

---

## 39. Recomendações arquiteturais finais

1. **Não reescrever nada.** Nenhum defeito arquitetural fundamental foi demonstrado.
2. **Adotar a separação Requisito × Controle** com vocabulário convencional, antes que qualquer
   módulo de Controles ou Conformidade comece.
3. **Reconhecer o núcleo GRC compartilhado** com critério de admissão estreito, contendo
   Evidence, Action, Finding e Control.
4. **Estender o registro de tipo fechado já provado** (Attachment, Comment, Approval,
   Notification) para Evidence e Action. Não inventar mecanismo novo; não usar tabela genérica.
5. **Calcular estado de conformidade**, com a disciplina de calculador único já aplicada ao
   `RiskScoringService`.
6. **Preservar integralmente** as garantias listadas em §30 sob ALREADY SUPERIOR.
7. **Provar os pontos de extensão que nunca foram executados** antes de depender deles.
