-- T036/T039 — durable version counters backing the RBAC permission cache
-- and the organizational-scope cache (ADR-003, ADR-004).
--
-- Both `permission-resolver.service.ts` and `scope-resolver.service.ts`
-- cache their *resolved* answer (a permission set / a scope filter) behind
-- a key that embeds a version number, so that bumping the version is what
-- invalidates every affected cache entry on the next lookup — no TTL wait,
-- no enumerating which cache keys to delete (FR-028). That version number
-- itself must be durable and monotonic: if it lived only inside
-- `CacheProvider` (which both the Redis and in-memory adapters may evict or
-- expire independently of any single cached permission/scope entry), the
-- counter resetting to a lower value while an older, still-unexpired
-- resolved-answer entry survives under a matching lower-numbered key would
-- silently serve stale data. Two single-row tables here are the persisted,
-- authoritative home for these counters; only the resolved answers are
-- ever cache-resident.
--
-- Each table is seeded with its one singleton row so the very first
-- resolver call in a fresh environment can read a value without a
-- create-if-missing race.

-- CreateTable
CREATE TABLE "permission_cache_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "permissions_version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permission_cache_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_scope_cache_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "org_tree_version" INTEGER NOT NULL DEFAULT 1,
    "grants_version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "org_scope_cache_state_pkey" PRIMARY KEY ("id")
);

-- Seed the one singleton row each table will ever hold.
INSERT INTO "permission_cache_state" ("id", "permissions_version", "updated_at")
VALUES ('singleton', 1, CURRENT_TIMESTAMP);

INSERT INTO "org_scope_cache_state" ("id", "org_tree_version", "grants_version", "updated_at")
VALUES ('singleton', 1, 1, CURRENT_TIMESTAMP);
