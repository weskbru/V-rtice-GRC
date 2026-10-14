"""Gera o bootstrap SQL a partir das migrações Prisma versionadas."""

from hashlib import sha256
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "database" / "prisma" / "migrations"
OUTPUT = Path(__file__).with_name("bootstrap-vertice-grc.sql")


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    folders = sorted(path for path in MIGRATIONS.iterdir() if path.is_dir())
    if not folders:
        raise SystemExit("Nenhuma migração Prisma encontrada.")

    statements = [
        "-- Inicialização única do schema Vértice GRC.",
        "-- Fonte: database/prisma/migrations.",
        "-- Execute uma vez em um banco vertice_grc novo, com um cliente PostgreSQL.",
        "-- Requer citext e pg_trgm instaladas no servidor PostgreSQL.",
        "-- Registra os checksums das migrações desta distribuição no histórico Prisma.",
        "",
        "DO $bootstrap_check$",
        "DECLARE",
        "    missing_extensions TEXT;",
        "    has_applied_migrations BOOLEAN;",
        "    has_unresolved_failures BOOLEAN;",
        "BEGIN",
        "    IF current_database() <> 'vertice_grc' THEN",
        "        RAISE EXCEPTION 'Conecte ao banco vertice_grc antes de executar este script.';",
        "    END IF;",
        "    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vertice_owner') THEN",
        "        RAISE EXCEPTION 'O papel vertice_owner não existe.';",
        "    END IF;",
        "    IF current_user <> 'vertice_owner' AND NOT pg_has_role(current_user, 'vertice_owner', 'SET') THEN",
        "        RAISE EXCEPTION 'A conexão precisa poder assumir o papel vertice_owner.';",
        "    END IF;",
        "    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vertice_app') THEN",
        "        RAISE EXCEPTION 'O papel vertice_app não existe.';",
        "    END IF;",
        "    SELECT string_agg(required.name, ', ' ORDER BY required.name)",
        "      INTO missing_extensions",
        "      FROM unnest(ARRAY['citext', 'pg_trgm']) AS required(name)",
        "     WHERE NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = required.name);",
        "    IF missing_extensions IS NOT NULL THEN",
        "        RAISE EXCEPTION 'Extensões ausentes no servidor PostgreSQL: %.', missing_extensions",
        "            USING HINT = 'Peça ao administrador para instalar citext e pg_trgm no PostgreSQL 17.';",
        "    END IF;",
        "    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') THEN",
        "        RAISE EXCEPTION 'O schema public já contém tabelas da aplicação; este bootstrap exige um schema vazio.';",
        "    END IF;",
        "    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN",
        "        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)'",
        "            INTO has_applied_migrations;",
        "        IF has_applied_migrations THEN",
        "            RAISE EXCEPTION 'Já há migrações aplicadas; não execute o bootstrap novamente.';",
        "        END IF;",
        "        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)'",
        "            INTO has_unresolved_failures;",
        "        IF has_unresolved_failures THEN",
        "            RAISE EXCEPTION 'Há uma migração Prisma com falha não resolvida.';",
        "        END IF;",
        "    END IF;",
        "END",
        "$bootstrap_check$;",
        "",
        "BEGIN;",
        "SET LOCAL ROLE vertice_owner;",
        "REVOKE ALL ON SCHEMA public FROM PUBLIC;",
        "GRANT CONNECT ON DATABASE vertice_grc TO vertice_app;",
        "GRANT USAGE ON SCHEMA public TO vertice_app;",
        "ALTER DEFAULT PRIVILEGES FOR ROLE vertice_owner IN SCHEMA public",
        "    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vertice_app;",
        "ALTER DEFAULT PRIVILEGES FOR ROLE vertice_owner IN SCHEMA public",
        "    GRANT USAGE, SELECT ON SEQUENCES TO vertice_app;",
        "",
        'CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (',
        '    "id" VARCHAR(36) NOT NULL,',
        '    "checksum" VARCHAR(64) NOT NULL,',
        '    "finished_at" TIMESTAMPTZ,',
        '    "migration_name" VARCHAR(255) NOT NULL,',
        '    "logs" TEXT,',
        '    "rolled_back_at" TIMESTAMPTZ,',
        '    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),',
        '    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,',
        '    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")',
        ");",
        "",
    ]

    for folder in folders:
        migration = folder / "migration.sql"
        if not migration.is_file():
            raise SystemExit(f"Migração sem migration.sql: {folder.name}")

        raw_sql = migration.read_bytes()
        sql = raw_sql.decode("utf-8").rstrip()
        checksum = sha256(raw_sql).hexdigest()
        migration_id = str(uuid5(NAMESPACE_URL, f"verticegrc:{folder.name}"))

        statements.extend(
            [
                f"-- Migração: {folder.name}",
                sql,
                "",
                'INSERT INTO public."_prisma_migrations"',
                '    ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")',
                "VALUES (",
                f"    {sql_literal(migration_id)},",
                f"    {sql_literal(checksum)},",
                "    CURRENT_TIMESTAMP,",
                f"    {sql_literal(folder.name)},",
                "    NULL,",
                "    NULL,",
                "    CURRENT_TIMESTAMP,",
                "    1",
                ");",
                "",
            ]
        )

    statements.extend(["RESET ROLE;", "COMMIT;", ""])
    OUTPUT.write_text("\n".join(statements), encoding="utf-8", newline="\n")
    print(f"Gerado: {OUTPUT.relative_to(ROOT)} ({len(folders)} migrações)")


if __name__ == "__main__":
    main()
