Status: provisional — descreve o schema e o fluxo de banco implementados.

# Banco de dados

## Fonte do schema e distribuição pública

`database/prisma/schema.prisma` define os modelos. As migrações SQL em
`database/prisma/migrations/` são a fonte da estrutura aplicada. O histórico fica na tabela
`public._prisma_migrations`.

A distribuição Vértice GRC é destinada a uma instalação nova. Não contém configuração de
conexão operacional, dump, credenciais ou dados de uma instância existente. `.env.example`
usa somente `localhost`, papéis locais de exemplo e senhas `CHANGE_ME`; `.env` e variantes
locais permanecem ignoradas pelo Git. Configure sua própria instância antes de iniciar a API.

A renomeação desta distribuição alterou deliberadamente identificadores e conteúdo das migrações.
Seus checksums são os dos arquivos desta branch, e o bootstrap foi regenerado a partir deles.
**Não aplique esta distribuição sobre um banco criado com outro histórico de migrações.** Não
altere checksums de um banco existente para compatibilizá-lo com estes arquivos.

## Conexões da aplicação

`DATABASE_URL` é a única conexão PostgreSQL exigida no startup da API e usada pelo Prisma Client.
Ela deve autenticar como `vertice_app`, papel restrito, sem DDL e sem privilégios de superusuário.
`DATABASE_MIGRATION_URL` é reservada à administração/migração como `vertice_owner`, dono do
schema, e é opcional no startup normal. Quando fornecida, deve ser diferente de `DATABASE_URL`.
Não forneça credenciais do owner ou do superusuário aos containers de runtime.

`TEST_DATABASE_URL` e `TEST_DATABASE_MIGRATION_URL` são opcionais no startup normal.
As suítes que usam banco exigem ambas nos helpers, com URLs distintas e nomes de banco
terminando em `_test`. Elas apontam para uma instância descartável separada; nunca para o banco
da aplicação. Essas variáveis não fazem parte do Secret de runtime Kubernetes.

Prisma, `schema.prisma` e as migrações versionadas permanecem no projeto. O build e o startup
não aplicam migrações nem executam seed; essas rotinas são administradas separadamente.
O Secret Kubernetes exige somente `DATABASE_URL`, configurada fora do versionamento.

## PostgreSQL local opcional

Copie `.env.example` para `.env` e substitua as senhas fictícias por três senhas locais exclusivas.
Mantenha as senhas das URLs consistentes com as variáveis `POSTGRES_*`; codifique os caracteres
especiais da senha ao construir a URL. A API executada no host usa `localhost:5433`; sua
configuração é lida em `backend/.env` ou nas variáveis exportadas do processo. Os helpers de
integração também leem `backend/.env`.

O serviço `postgres` tem o perfil `local-db` e só inicia quando solicitado explicitamente:

```powershell
docker compose --profile local-db up -d postgres redis
```

O script `database/postgres/init/01-roles.sql` cria papéis separados para runtime e migrações,
concede privilégios mínimos e prepara `citext` e `pg_trgm`. Ele não aplica as migrações da aplicação.
A senha de `postgres` é usada apenas para inicializar a instância local.

Para executar também a API no Compose, use `postgres:5432` em `DATABASE_URL` com o perfil
`local-db` ativo. `localhost` dentro do container identifica o próprio container. O Compose
configura Redis por seu hostname interno. As portas publicadas são limitadas a `127.0.0.1`.
A imagem Web recebe apenas suas variáveis de runtime, sem a `.env` ou os segredos do banco.

O template usa HTTP e `NODE_ENV=development` para desenvolvimento local. Uma implantação em
produção exige `NODE_ENV=production`, HTTPS, `SESSION_COOKIE_SECURE=true` e a mesma
`APP_ORIGIN` no build Web, no runtime Web e na API.

`docker-compose.test.yml` mantém PostgreSQL e Redis descartáveis em portas separadas, com
armazenamento `tmpfs`. Configure explicitamente as variáveis `TEST_*` antes de usar suítes que
escrevem ou limpam dados. O serviço de teste não utiliza o volume persistente local.

## Bootstrap de um banco vazio

Gere o snapshot a partir das migrações desta distribuição:

```powershell
python database/postgres/generate-bootstrap.py
```

Execute `database/postgres/bootstrap-vertice-grc.sql` inteiro, uma vez, em um banco novo chamado
`vertice_grc`, com um cliente PostgreSQL. A sessão precisa poder assumir `vertice_owner`, e o
papel `vertice_app` precisa existir. O script aplica as migrações em ordem e grava seus checksums
no histórico Prisma. Ele recusa schema com tabelas da aplicação, migrações aplicadas ou falhas
pendentes. O privilégio de escrita sobre `audit_event` continua restrito pelas migrações.

O servidor precisa disponibilizar `citext` e `pg_trgm`. Se as extensões não estiverem instaladas,
o bootstrap para antes de alterar o schema. Após mudança nas migrações, gere novamente o SQL;
não edite o snapshot manualmente. A geração do arquivo não estabelece conexão PostgreSQL.
