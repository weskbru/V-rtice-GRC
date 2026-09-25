-- Cria os papéis do PostgreSQL usados pela aplicação e pelas migrações.
-- As senhas e os nomes vêm do ambiente; nenhum segredo fica neste arquivo.
-- A API não recebe DDL; a migração bloqueia UPDATE e DELETE em audit_event.
-- Este script roda na criação do banco e pode ser executado novamente.

\set ON_ERROR_STOP on

\getenv target_db POSTGRES_DB
\getenv owner_role POSTGRES_OWNER_USER
\getenv owner_password POSTGRES_OWNER_PASSWORD
\getenv app_role POSTGRES_APP_USER
\getenv app_password POSTGRES_APP_PASSWORD

-- \gexec executa SQL gerado e permite manter as condições fora de blocos DO.

-- 1. Cria ou atualiza o papel de migração.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'owner_role', :'owner_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'owner_role')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'owner_role', :'owner_password')
WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'owner_role')
\gexec

-- 2. Cria ou atualiza o papel restrito da aplicação.
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
  :'app_role', :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_role')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'app_role', :'app_password')
WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_role')
\gexec

-- 3. O papel de migração é dono do banco e do schema public.
SELECT format('ALTER DATABASE %I OWNER TO %I', :'target_db', :'owner_role')
\gexec

ALTER SCHEMA public OWNER TO :"owner_role";

-- 4. Concede CONNECT ao banco e USAGE ao schema public.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'target_db', :'app_role')
UNION ALL
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_role')
\gexec

-- 5. Concede leitura e gravação nas tabelas e sequências do migrador.
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  :'owner_role', :'app_role'
)
UNION ALL
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
  :'owner_role', :'app_role'
)
\gexec

-- 6. Extensões usadas para busca e comparação sem distinção de maiúsculas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
