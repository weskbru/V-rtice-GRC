Status: provisional — descreve o schema e o fluxo de banco implementados.

# Banco de dados

## Fonte do schema

`database/prisma/schema.prisma` define os modelos. As migrações SQL em
`database/prisma/migrations/` são a fonte da estrutura aplicada. O histórico fica na tabela
`public._prisma_migrations`.

## Bootstrap de um banco externo vazio

O Compose não inicia PostgreSQL local no uso padrão. Para preparar uma instância externa vazia pelo
DBeaver, gere `database/postgres/bootstrap-pharos-grc.sql` com:

```powershell
python database/postgres/generate-bootstrap.py
```

Execute o arquivo inteiro, uma vez, conectado ao banco `pharos_grc`. A sessão precisa poder assumir
`pharos_owner`, e o papel `pharos_app` precisa existir. O script aplica as migrações em ordem e grava
seus checksums no histórico Prisma. Ele recusa um schema que já tenha tabelas da aplicação ou
migrações aplicadas.

O servidor PostgreSQL precisa disponibilizar as extensões `citext` e `pg_trgm`. Se os arquivos das
extensões não estiverem instalados no servidor, o bootstrap para antes de alterar o schema. Após uma
mudança nas migrações, gere novamente o SQL; não edite o snapshot manualmente.

## Conexões da aplicação

`DATABASE_URL` é a única conexão PostgreSQL exigida no startup da API e usada pelo Prisma Client.
`DATABASE_MIGRATION_URL` continua disponível para aplicar migrações como `pharos_owner`, mas é
opcional no startup normal. Quando fornecida, deve ser diferente de `DATABASE_URL`.
`TEST_DATABASE_URL` e `TEST_DATABASE_MIGRATION_URL` também são opcionais no startup normal;
os helpers das suítes que usam banco continuam exigindo ambas e validando o destino dos testes.
Quando ambas são fornecidas à configuração, devem ser distintas.

O papel restrito previsto para runtime continua sendo `pharos_app`; a homologação utiliza
temporariamente o login `usr_pharos_grc` no único banco externo `pharos_grc`.
Prisma, `schema.prisma` e as migrações versionadas permanecem no projeto. O build e o runtime
Kubernetes não executam migrações nem seed; essas rotinas são administradas separadamente.
O Secret Kubernetes exige somente `DATABASE_URL`; variáveis `TEST_*` não fazem parte desse runtime.

## PostgreSQL local

O serviço `postgres` tem o perfil `local-db`; só inicia quando solicitado explicitamente:

```powershell
docker compose --profile local-db up -d postgres
```
