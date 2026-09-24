Status: provisional — mapa da implementação observada em 2026-09-24, branch refatory, commit 3102db4. Não define a arquitetura-alvo.

# Mapa do backend

Este documento localiza as partes do backend, suas responsabilidades, os principais caminhos HTTP, os pontos de integração e as dependências operacionais. Ele descreve a estrutura atual para apoiar a leitura do código e as próximas decisões arquiteturais; decisões novas precisam ser ratificadas separadamente.

## Visão geral

O backend é uma API REST em NestJS/TypeScript organizada como monólito modular. Um único processo compõe módulos de plataforma, capacidades GRC compartilhadas e domínios de negócio. A persistência é relacional em PostgreSQL via Prisma.

~~~mermaid
flowchart TD
    client[Cliente HTTP]
    bootstrap[main.ts: NestJS, Helmet, prefixo /api/v1]
    middleware[RequestContext e proteção CSRF]
    guards[Throttler, sessão, troca obrigatória de senha, permissão]
    routes[Controllers e DTOs]
    app[Casos de uso e serviços de aplicação]
    ports[Entidades, regras e portas]
    adapters[Repositórios e adaptadores de infraestrutura]
    postgres[(PostgreSQL via Prisma)]
    cache[(Redis ou cache em memória)]
    files[(Arquivos em disco local)]
    errors[ProblemDetailsFilter e logs]

    client --> bootstrap --> middleware --> guards --> routes --> app --> ports --> adapters
    adapters --> postgres
    adapters --> cache
    adapters --> files
    middleware -. erros .-> errors
    guards -. erros .-> errors
    routes -. erros .-> errors
    app -. erros .-> errors
~~~

O ponto de composição é **backend/src/app.module.ts**. O processo HTTP inicia em **backend/src/main.ts**. O prefixo global é **/api/v1**.

## Mapa de diretórios

| Diretório | Responsabilidade observada |
|---|---|
| **backend/src/core/** | Capacidades transversais da plataforma: identidade, sessão, autorização, unidades organizacionais, auditoria, comentários, anexos, notificações e registro de áreas do Dashboard. |
| **backend/src/grc/** | Capacidades GRC reutilizadas por vários domínios: Ação, Evidência e Achado, além de tipos e registros compartilhados. |
| **backend/src/modules/** | Domínios de negócio e superfícies compostas: riscos, controles, compliance, auditoria, ativos, processos, incidentes, problemas, indicadores, relatórios e resumo do Dashboard. |
| **backend/src/infrastructure/** | Bootstrap de configuração, cache, HTTP, logging, saúde, OpenAPI e Prisma. |
| **backend/src/shared/** | Portas de integração GRC, erros, mensagens, paginação e contrato de transação. É uma área compartilhada ampla e deve ser considerada ao avaliar limites de módulo. |
| **database/prisma/** | Schema Prisma e migrations SQL. |
| **database/postgres/init/** | Inicialização de roles PostgreSQL usada pelo Docker Compose. |
| **backend/seeds/** | Seeds operacionais da API. |
| **backend/test/** | Suítes unitárias, integração e contrato da API. |
| **backend/openapi.json** | Snapshot OpenAPI gerado a partir dos decorators NestJS. |
| **specs/*/contracts/** | Contratos HTTP escritos por fase, consumidos pelos testes de contrato. |

O padrão predominante nos domínios é **presentation/** → **application/** → **domain/** e **infrastructure/**. A camada de apresentação contém controllers, DTOs e mapeadores; aplicação contém casos de uso e serviços; domínio contém entidades, regras e portas; infraestrutura implementa as portas com Prisma, cache e outros adaptadores. Alguns módulos de core usam serviços/orquestradores em vez de reproduzir exatamente essa árvore.

## Catálogo dos módulos

### Plataforma: core

| Módulo | Responsabilidade | Prefixos HTTP |
|---|---|---|
| identity | Login local, resolução de identidade, usuários, credenciais e administração de usuários. O módulo registra atualmente apenas LocalAuthenticationProvider. | /auth, /users, /admin/users |
| sessions | Validação e ciclo de vida de sessões, revogação, expiração, enriquecimento do contexto e bloqueio de operações durante troca obrigatória de senha. | Guardas globais; operações expostas pelos controllers de identidade. |
| authorization | Papéis, permissões, resolução de permissões e guarda global; registra negações. | /admin/roles, /admin/permissions |
| organizations | Unidades organizacionais, concessões de escopo e resolução/aplicação do escopo organizacional. | /org-units, /admin/org-units, /admin/users/:userId/scope-grants |
| audit | Gravação e consulta de eventos de auditoria, contexto do ator e allowlists de campos por entidade. | Sem controller próprio; usado pelos domínios e por controllers de auditoria específicos. |
| comments | Comentários compartilhados associados a tipos fechados de entidades. | /comments |
| files | Anexos, autorização de acesso ao conteúdo e validação de upload. | /attachments |
| notifications | Notificações internas e estado de leitura. | /notifications |
| dashboard | Registro de áreas planejadas para composição do Dashboard; não é o endpoint do resumo GRC. | Sem controller próprio. |

### Capacidades GRC compartilhadas: grc

| Módulo | Responsabilidade | Prefixos HTTP |
|---|---|---|
| action | Tarefa/Ação compartilhada com origem tipada, ciclo de vida e trilha de auditoria. É consumida por riscos e outros domínios. | /actions |
| evidence | Registro de evidências, arquivamento e vínculos com sujeitos permitidos. O conteúdo do arquivo é atendido por core/files. | /evidence |
| finding | Achados, ciclo de vida e vínculos com riscos e controles; também dá suporte à remediação. | /findings |
| shared | Tipos e registries usados pelas capacidades GRC compartilhadas. | Sem controller próprio. |

### Domínios de negócio: modules

| Módulo | Responsabilidade observada | Prefixos HTTP principais |
|---|---|---|
| risk | Cadastro e consulta de riscos, avaliação e scoring, histórico, metodologia versionada, tratamento, aprovações, ciclo de vida e relacionamentos. | /risks, /risk-methodology; também controllers de Dashboard, referência, histórico, auditoria e ciclo de vida. |
| controls | Catálogo de controles, transições de ciclo de vida, avaliações, atestações e vínculos com risco, processo e ativo. | /controls |
| compliance | Frameworks e versões, requisitos, mapeamento requisito↔controle, aplicabilidade, migrações de mapeamento e resumo de conformidade. | /frameworks, /requirements |
| audit-engagements | Engajamentos de auditoria, estados, escopo por framework/requisito/controle e achados associados. | /audits |
| assets | Cadastro e ciclo de vida de ativos, consultas e vínculos reversos com incidentes. | /assets |
| processes | Cadastro e consulta de processos organizacionais. | /processes |
| incidents | Incidentes, transições e vínculos com riscos, ativos, processos e problemas. | /incidents |
| problems | Problemas, transições e vínculos com riscos e incidentes. | /problems |
| indicators | Catálogo fechado de métricas, cálculo, medições, limiares, monitoramento, notificações e ações originadas por indicador. | /indicators |
| reports | Definições de relatório, execução de consultas agregadas e exportação CSV. | /reports |
| dashboard | Resumo da plataforma GRC composto a partir de vários domínios. | /dashboard/summary |

## Integrações entre módulos

As dependências entre módulos aparecem nas declarações de composição dos arquivos *.module.ts e no AppModule. Também há 23 contratos em **backend/src/shared/grc-ports/** e módulos NestJS específicos para métricas, diretórios e leituras de relacionamentos. A tabela resume as integrações declaradas nos módulos de composição.

| Consumidor | Dependências explícitas na composição NestJS |
|---|---|
| risk | Ação, leitura de vínculos de incidentes/problemas/controles, diretório de riscos e métricas do Dashboard de riscos. |
| controls | Diretório de controles, efetividade e métricas; módulos separados expõem avaliações e relacionamentos. |
| audit-engagements | Achados e métricas de auditoria. |
| assets | Leitura de vínculos com incidentes, diretório e métricas de ativos. |
| incidents | Diretório, métricas e leituras de vínculos com ativos, processos e riscos. |
| problems | Diretório de incidentes, métricas de problemas e leitura de vínculos com riscos. |
| compliance | Diretório de compliance e resumo de conformidade. |
| indicators | Métricas de ativos, auditorias, compliance, controles, incidentes, problemas, processos e riscos; também Ação, Achado e Notificações. |
| reports | Módulo de Indicadores para reutilizar métricas/cálculos. |
| dashboard | Ação, resumo de compliance, métricas de controles/incidentes/problemas e monitoramento de indicadores. |

As capacidades AuditModule, AuthorizationModule e OrganizationsModule aparecem como dependências recorrentes dos domínios. Relacionamentos de domínio são em geral explícitos no schema e nos módulos de leitura/vínculo; os fluxos mais conectados hoje passam por Risco, Incidente, Problema, Controle e Ação.

## API e ciclo de uma requisição

main.ts aplica Helmet, define um único proxy confiável, desabilita ETag, configura o prefixo /api/v1 e inicia o servidor. AppModule registra os middlewares globais de contexto da requisição e CSRF.

A cadeia global registrada no AppModule inclui:

1. ThrottlerGuard para limitação geral;
2. SessionGuard para validar o cookie e enriquecer o ator/sessão;
3. MandatoryPasswordChangeGuard;
4. PermissionGuard, que exige @RequirePermission ou uma declaração explícita @NoPermissionRequired; a ausência da declaração falha fechada;
5. ValidationPipe global, com transformação, whitelist e rejeição de propriedades não permitidas;
6. ProblemDetailsFilter, que serializa erros no formato application/problem+json e associa correlation ID.

Endpoints públicos usam @Public(). Métodos de escrita passam pelo middleware CSRF: aceita origem de Origin ou Referer quando corresponde a APP_ORIGIN; GET, HEAD e OPTIONS são tratados como métodos seguros. Há limitação adicional para tentativas de login por conta e origem.

O catálogo HTTP principal é:

| Área | Recursos |
|---|---|
| Sistema | /health/live, /health/ready |
| Identidade e administração | /auth, /users, /admin/users, /admin/roles, /admin/permissions |
| Organização | /org-units, /admin/org-units, /admin/users/:userId/scope-grants |
| Colaboração e arquivos | /comments, /attachments, /notifications |
| Núcleo GRC | /actions, /evidence, /findings |
| Negócio | /risks, /controls, /frameworks, /requirements, /audits, /assets, /processes, /incidents, /problems, /indicators, /reports |
| Visão de plataforma | /dashboard/summary e endpoints específicos do Dashboard de riscos |

Os decorators e DTOs em **backend/src/** são a lista executável de controllers e rotas; o snapshot OpenAPI fica em **backend/openapi.json**.

## Persistência e dependências de runtime

| Recurso | Implementação atual |
|---|---|
| Banco | PostgreSQL, um schema Prisma em database/prisma/schema.prisma; migrations SQL em database/prisma/migrations/. O estado inspecionado contém 53 diretórios de migration. |
| Cliente Prisma | `pnpm install` gera o cliente pelo postinstall da raiz; `backend/scripts/generate-prisma-client.mjs` copia o schema para uma pasta temporária dentro do workspace da API durante a geração, mantendo a fonte canônica em `database/prisma/`. |
| Transações | PrismaService oferece runInTransaction e propaga a transação corrente por AsyncLocalStorage; chamadas aninhadas reutilizam a transação ativa. |
| Cache | Porta CacheProvider, com adaptadores Redis e memória. Redis é obrigatório quando NODE_ENV=production; memória serve como fallback local. |
| Anexos | Driver configurado atualmente como local, com armazenamento em disco, checksum SHA-256 e particionamento da chave por escopo organizacional. |
| Configuração | env.schema.ts valida ambiente com Zod; configuração tipada é exposta por AppConfigService. URL de runtime e URL de migration do banco precisam ser diferentes. |
| Logging | Pino, logger NestJS adaptado e contexto de requisição/correlation ID. |
| Health | Liveness simples; readiness verifica migração concluída no banco e, quando o adaptador escolhido é Redis, também o cache. |

Os grupos de entidades no schema são:

- identidade e acesso: User, LocalCredential, ExternalIdentity, Session, Permission, Role, RolePermission e UserRole;
- organização e escopo: OrganizationalUnit, OrgScopeGrant e estados de cache de autorização/escopo;
- auditoria: AuditEvent e um enum fechado de tipos de entidade auditável;
- risco: Risk, avaliação, causas/consequências, metodologia/versionamento, tratamento, ações, transições e aprovações;
- controles, ativos e processos: Control, avaliações/transições, Asset, Process e tabelas de vínculo com risco/incidente;
- colaboração GRC: Attachment, Comment, Notification, Evidence/EvidenceLink, Action e Finding;
- compliance e auditoria: Framework, FrameworkVersion, Requirement, mapeamentos, aplicabilidade, marcas de conformidade, AuditEngagement e escopos;
- incidentes e problemas: Incident, Problem e seus vínculos explícitos;
- métricas e relatórios: IndicatorDefinition, IndicatorMeasurement e ReportDefinition.

O schema usa registries tipados para superfícies compartilhadas, como AttachableEntityType, CommentableEntityType, ApprovableEntityType, ActionOriginType e EvidenceSubjectType.

## Contratos e validação automatizada

- O OpenAPI é gerado a partir da aplicação/decorators e salvo em backend/openapi.json; openapi:check compara o arquivo versionado com a geração atual.
- Contratos REST escritos por fase ficam em specs/*/contracts/.
- backend/test/contract/contract-coverage.spec.ts verifica 214 operações em 14 contratos e falha quando uma operação contratada não está registrada na aplicação.
- As suítes da API estão separadas em backend/test/unit/, integration/ e contract/, executadas com Vitest.
- Scripts disponíveis no pacote @pharos/api: build, dev, start, lint, typecheck, testes, geração de cliente Prisma, migrations, seed e geração/verificação de OpenAPI. `db:generate` usa o script temporário acima.

## Pontos para a reorganização arquitetural

Estes são pontos observados no código que ajudam a planejar o trabalho; não são decisões nem defeitos declarados:

1. **Três raízes de domínio:** core/, grc/ e modules/ têm distinções semânticas; mantenha explícito qual capacidade pertence à plataforma, ao núcleo GRC compartilhado ou a um domínio de negócio.
2. **Composição cruzada:** Indicadores, Dashboard e Relatórios têm mais integrações declaradas que módulos CRUD isolados. Comece por esses grafos ao decidir ownership de portas e contratos.
3. **Módulos globais de domínio:** existem módulos @Global() de diretório/consulta em riscos, controles, compliance, ativos, processos e incidentes. Seus providers podem ser injetados sem import direto nos consumidores; vale revisar esse alcance ao reorganizar os limites de dependência.
4. **Três superfícies de Dashboard:** core/dashboard registra áreas planejadas; modules/dashboard agrega a visão GRC; modules/risk contém métricas/telas de risco. São responsabilidades distintas no código atual.
5. **Capacidades locais ainda não extensíveis por configuração:** Identity registra somente provedor local; anexos aceitam somente driver local. O schema prevê métodos de autenticação adicionais, mas enums/tabelas não equivalem a provedores implementados.
6. **Documentação da branch:** docs/README.md aponta para vários documentos de arquitetura e estado que não estão presentes nesta branch; ao organizar o backend, confirme as specs/ADRs disponíveis antes de tratar texto histórico como decisão vigente.

## Fontes de código para navegação

- Composição e bootstrap: **backend/src/app.module.ts**, **backend/src/main.ts**.
- Segurança HTTP: **backend/src/core/sessions/**, **backend/src/core/authorization/**, **backend/src/infrastructure/http/**.
- Schema e adapters de banco: **database/prisma/schema.prisma**, **backend/src/infrastructure/prisma/**, **backend/src/shared/persistence/**.
- Portas de comunicação entre domínios: **backend/src/shared/grc-ports/**.
- Contratos e cobertura: **backend/openapi.json**, **backend/test/contract/contract-coverage.spec.ts**, **specs/*/contracts/**.
- Decisões e regras do projeto: **CLAUDE.md**, especialmente as seções 17 e 19, e os ADRs/specs que existirem nesta branch.
