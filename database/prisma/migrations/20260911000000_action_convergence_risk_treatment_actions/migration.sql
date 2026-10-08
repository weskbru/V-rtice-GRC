-- 007-implementation-remediation, Frente A, D-1/D-6 (research.md) — the
-- Action convergence. `risk_treatment_actions` stops being the authority for
-- title/description/responsible/dueOn/status/completedAt and becomes a pure
-- link row to the shared `Action` (`grc/action`). Forward-only,
-- aditiva-depois-destrutiva, in ONE transaction: if the verification step
-- (step 2) finds any discrepancy, the whole migration rolls back and the
-- DROP in step 3 never executes.
--
-- Every existing `risk_treatment_actions.id` is preserved (audit continuity:
-- `audit_event.entity_type = 'RISK_TREATMENT_ACTION'` rows point at these
-- ids and must keep resolving — Constitution Principle XV).

-- ============================================================================
-- STEP 0B — Recover the REAL completer of every already-COMPLETED row from
-- the audit trail, before writing or reconciling anything.
--
-- CORRECTED BY THE COORDINATOR, 2026-09-11, after this migration was first
-- run against real multi-shape data and found to need a value here at
-- all (see the corrected paragraph in STEP 1's INSERT, kept visible below
-- rather than silently rewritten). The original text proposed attributing
-- an unrecorded completion to the row's own `responsible_user_id` when no
-- better value was available. That is a FABRICATION and is rejected
-- outright: `responsible_user_id` is who the work was ASSIGNED to, not who
-- MARKED IT DONE — an audit trail in a compliance product must never
-- record that a person did something they did not do (the same principle
-- already applied to session expiry, D-13).
--
-- The real fact is recoverable, not merely guessable: every completion
-- through the pre-convergence risk route fired
-- `risk.treatment_action_status_changed`, keyed to the LINK ROW's own id,
-- with `new_values.status = 'COMPLETED'` and a real `actor_user_id` column
-- (populated by the request context of an authenticated PATCH — distinct
-- from the login-specific gap D-13 fixes). Taking the LATEST such event
-- per row recovers who actually completed it.
--
-- A TEMP TABLE (dropped automatically at the end of this transaction,
-- `ON COMMIT DROP`) because this fact is needed by both STEP 1 (backfill
-- INSERT) and STEP 1B (reconcile UPDATE), which are separate statements —
-- a CTE cannot span them.
CREATE TEMP TABLE recovered_completer ON COMMIT DROP AS
SELECT DISTINCT ON (rta.id)
  rta.id AS rta_id,
  ae.actor_user_id AS completed_by_user_id
FROM risk_treatment_actions rta
JOIN audit_event ae
  ON ae.entity_type = 'RISK_TREATMENT_ACTION'
 AND ae.entity_id = rta.id
 AND ae.action = 'risk.treatment_action_status_changed'
 AND ae.new_values ->> 'status' = 'COMPLETED'
WHERE rta.status = 'COMPLETED'
ORDER BY rta.id, ae.occurred_at DESC;

-- Fourth verification check, run BEFORE any write, not after: a
-- `COMPLETED` link row with NO recoverable completer is a PRE-EXISTING
-- DATA DEFECT (an actor_user_id the audit trail itself never captured, or
-- a completion this migration cannot trace) — the migration's job is to
-- SURFACE it by name, never to paper over it with an invented value.
-- Measured before accepting this design: the developer database has 75
-- link rows, every one `OPEN`, zero completion events to recover — this
-- check is expected to find NOTHING there and never fire in practice
-- today; it exists for the row that DOES complete, now and in the future.
DO $$
DECLARE
  unrecoverable_ids text;
BEGIN
  SELECT string_agg(rta.id::text, ', ')
  INTO unrecoverable_ids
  FROM risk_treatment_actions rta
  LEFT JOIN recovered_completer rc ON rc.rta_id = rta.id
  WHERE rta.status = 'COMPLETED' AND rc.completed_by_user_id IS NULL;

  IF unrecoverable_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'Action convergence: the following risk_treatment_actions row(s) are COMPLETED with no recoverable completer in the audit trail (risk.treatment_action_status_changed, actor_user_id) -- refusing to fabricate one: %',
      unrecoverable_ids;
  END IF;
END $$;

-- ============================================================================
-- STEP 1 — Backfill an `Action` for every risk_treatment_actions row that
-- does not already have one (`action_id IS NULL`).
-- ============================================================================

WITH pending AS (
  SELECT
    rta.id                    AS rta_id,
    rta.risk_id               AS risk_id,
    rta.title                 AS title,
    rta.description           AS description,
    rta.responsible_user_id   AS responsible_user_id,
    rta.due_on                AS due_on,
    rta.status                AS status,
    rta.completed_at          AS completed_at,
    rc.completed_by_user_id   AS completed_by_user_id,
    rta.created_at            AS created_at,
    rta.updated_at            AS updated_at,
    r.org_unit_id             AS org_unit_id,
    -- The risk's CURRENT organizational unit (data-model.md §2/§3 invariant)
    -- — the same rule `assertActionOriginInScope` already applies at
    -- runtime for every action derived from a risk. Not a historical
    -- reconstruction: there is no column recording what the risk's unit was
    -- at the moment this treatment action was created.
    EXTRACT(YEAR FROM rta.created_at)::int AS backfill_year
    -- The code's year is the year of the ROW'S OWN created_at, never the
    -- current year — so a backfilled code does not misdate the record
    -- (data-model.md §6/D-6).
  FROM risk_treatment_actions rta
  JOIN risks r ON r.id = rta.risk_id
  LEFT JOIN recovered_completer rc ON rc.rta_id = rta.id
  WHERE rta.action_id IS NULL
),
numbered AS (
  SELECT
    pending.*,
    ROW_NUMBER() OVER (PARTITION BY backfill_year ORDER BY created_at, rta_id) AS rn
  FROM pending
),
year_totals AS (
  SELECT backfill_year, COUNT(*) AS n
  FROM numbered
  GROUP BY backfill_year
),
-- Ensure a `grc_code_sequences` row exists for every year this backfill
-- touches, before reserving a range on it.
ensured_years AS (
  INSERT INTO grc_code_sequences (prefix, year, last_value)
  SELECT 'ACT', year_totals.backfill_year, 0
  FROM year_totals
  ON CONFLICT (prefix, year) DO NOTHING
  RETURNING 1
),
-- Reserve the whole range for each year in ONE atomic UPDATE, inside this
-- same migration transaction — no concurrent `Action` creation in
-- production can interleave here because this transaction already holds
-- the row lock on every `(ACT, year)` sequence row it touches.
reserved AS (
  UPDATE grc_code_sequences gcs
  SET last_value = gcs.last_value + year_totals.n
  FROM year_totals
  WHERE gcs.prefix = 'ACT' AND gcs.year = year_totals.backfill_year
  RETURNING gcs.year AS backfill_year, gcs.last_value - year_totals.n AS starting_value
),
-- Materialized explicitly (not left to the planner's "referenced more than
-- once" default) because `new_action_id` is generated by a VOLATILE
-- function (`gen_random_uuid()`) and MUST be the identical value in both
-- places this CTE is read below (the `actions` insert and the
-- `risk_treatment_actions` update) — this is what lets the final UPDATE
-- join by `rta_id` directly instead of reconstructing identity from
-- `RETURNING`, which the correlation `(risk_id, created_at)` alone cannot
-- guarantee unique (two treatment actions for the same risk created at the
-- same instant, however unlikely with `uuid(7)` ids, would otherwise
-- collide).
to_insert AS MATERIALIZED (
  SELECT
    numbered.*,
    reserved.starting_value + numbered.rn AS sequence_number,
    gen_random_uuid() AS new_action_id
  FROM numbered
  JOIN reserved ON reserved.backfill_year = numbered.backfill_year
),
inserted_actions AS (
  INSERT INTO actions (
    id, code, org_unit_id, origin_type, origin_id,
    title, description, responsible_user_id, due_on, status,
    completed_at, completed_by_user_id, reopened_at, reopened_by_user_id, reopen_reason,
    created_at, updated_at
  )
  SELECT
    new_action_id,
    'ACT-' || backfill_year || '-' || LPAD(sequence_number::text, 4, '0'),
    org_unit_id,
    'RISK_TREATMENT',
    risk_id,
    title,
    description,
    responsible_user_id,
    due_on,
    status::text::"ActionStatus",
    completed_at,
    -- completed_by_user_id: RECOVERED FROM THE AUDIT TRAIL (STEP 0B),
    -- never fabricated. `actions_completed_pair_check`
    -- (20260907100000_pairing_invariant_check_constraints) requires this
    -- to be non-null whenever completed_at is non-null; STEP 0B's own
    -- guard already aborted the transaction above if any COMPLETED row
    -- had no recoverable value, so `completed_by_user_id` here is never
    -- null for a row that reaches this INSERT.
    --
    -- CORRECTED BY THE COORDINATOR, 2026-09-11 (kept visible, not
    -- rewritten away — this project's own standing rule): the version of
    -- this line that first ran against real data used
    -- `responsible_user_id` as a fallback attribution, flagged at the time
    -- as "not a verified historical fact". That was rejected outright:
    -- `responsible_user_id` is who the work was ASSIGNED to, not who
    -- MARKED IT DONE, and a compliance audit trail must never record that
    -- a person did something they did not do. See STEP 0B above for the
    -- real recovery mechanism.
    completed_by_user_id,
    NULL, -- reopened_at: no legacy row was ever reopened through this table's
          -- own mechanism — history starts clean.
    NULL, -- reopened_by_user_id
    NULL, -- reopen_reason
    created_at, -- preserves the ORIGINAL creation instant, never "now"
    updated_at
  FROM to_insert
  RETURNING 1
)
UPDATE risk_treatment_actions rta
SET action_id = to_insert.new_action_id
FROM to_insert
WHERE rta.id = to_insert.rta_id;

-- ============================================================================
-- STEP 1B — Reconcile, before verifying. CONFIRMED DEFECT (coordinator,
-- measured against pharos_grc_test): for a link row that was ALREADY
-- linked before this migration (the pre-existing R-003 double-write, not
-- one this migration just backfilled), the linked Action can disagree with
-- its link row — measured as a 7-millisecond difference on `completed_at`
-- alone, on an otherwise byte-identical row. Root cause: the mirror path
-- (`UpdateTreatmentActionUseCase` calling `MirrorActionStatusFromOriginUseCase`)
-- computes ITS OWN `new Date()` for the same completion instant that
-- `UpdateTreatmentActionUseCase` itself already computed independently —
-- two clock reads for one event, in the same transaction. The double-write
-- was therefore never lossless; F-36 named the coexistence window but not
-- this specific drift. This is NOT worked around with a tolerance or a
-- relaxed comparison in STEP 2 below — that would hide exactly the drift
-- class the verification exists to catch. Instead: RECONCILE first.
--
-- `RiskTreatmentAction` is the PRE-CONVERGENCE AUTHORITY — every current
-- route, response and screen reads THIS table (data-model.md §7, FR-018),
-- so its stored values are what users have actually seen and what the
-- risk audit trail actually recorded. Its six values are pushed onto the
-- linked Action, unconditionally, for EVERY link row (including the ones
-- STEP 1 just backfilled a moment ago, for which this is a harmless no-op
-- — they were built to match already).
UPDATE actions a
SET
  title = rta.title,
  description = rta.description,
  responsible_user_id = rta.responsible_user_id,
  due_on = rta.due_on,
  status = rta.status::text::"ActionStatus",
  completed_at = rta.completed_at,
  -- RECOVERED FROM THE AUDIT TRAIL (STEP 0B), never fabricated — same
  -- correction and same reasoning as STEP 1's INSERT above. `NULL` here
  -- for a non-COMPLETED row is correct (the pair-check requires it).
  completed_by_user_id = recovered_completer.completed_by_user_id
FROM risk_treatment_actions rta
LEFT JOIN recovered_completer ON recovered_completer.rta_id = rta.id
WHERE a.id = rta.action_id;

-- ============================================================================
-- STEP 2 — Verify, before any DROP. Aborts the whole transaction (RAISE
-- EXCEPTION) if any invariant fails — the DROP in step 3 below then never
-- executes, because the transaction never reaches it. Kept EXACTLY as
-- strict as before the reconciliation above — the check is what PROVES the
-- reconciliation worked, not a formality now made redundant by it.
-- ============================================================================

DO $$
DECLARE
  orphan_link_count integer;
  duplicate_count integer;
  mismatch_count integer;
  orphan_action_count integer;
BEGIN
  -- (a) Zero link rows still without an action_id.
  SELECT COUNT(*) INTO orphan_link_count
  FROM risk_treatment_actions
  WHERE action_id IS NULL;

  IF orphan_link_count <> 0 THEN
    RAISE EXCEPTION
      'Action convergence backfill left % risk_treatment_actions row(s) with a NULL action_id',
      orphan_link_count;
  END IF;

  -- (b) action_id is unique (no Action reused by two link rows).
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT action_id
    FROM risk_treatment_actions
    GROUP BY action_id
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF duplicate_count <> 0 THEN
    RAISE EXCEPTION
      'Action convergence backfill produced % duplicated action_id value(s)',
      duplicate_count;
  END IF;

  -- (c) Field-by-field equality between each link row and its Action, for
  -- the six columns that migrate, AND that the Action's origin genuinely
  -- IS this link row's risk. Coordinator review, 2026-09-11: the origin
  -- conditions previously sat in the WHERE clause as a FILTER, excluding a
  -- mismatched-origin row from the count instead of flagging it — a guard
  -- that passes because it never looks at the bad row, the exact failure
  -- mode this project keeps paying for (F-42's own name for it). Fixed by
  -- moving both origin conditions INTO the disjunction being counted, so a
  -- mismatch is a finding, never a silent exclusion.
  SELECT COUNT(*) INTO mismatch_count
  FROM risk_treatment_actions rta
  JOIN actions a ON a.id = rta.action_id
  WHERE a.origin_type IS DISTINCT FROM 'RISK_TREATMENT'::"ActionOriginType" OR
        a.origin_id IS DISTINCT FROM rta.risk_id OR
        a.title IS DISTINCT FROM rta.title OR
        a.description IS DISTINCT FROM rta.description OR
        a.responsible_user_id IS DISTINCT FROM rta.responsible_user_id OR
        a.due_on IS DISTINCT FROM rta.due_on OR
        a.status::text IS DISTINCT FROM rta.status::text OR
        a.completed_at IS DISTINCT FROM rta.completed_at;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'Action convergence backfill produced % row(s) whose Action disagrees with its link row (title/description/responsible/dueOn/status/completedAt/origin_type/origin_id)',
      mismatch_count;
  END IF;

  -- (d) The orphan-Action population (D-2): an Action with
  -- origin_type = RISK_TREATMENT, whose origin_id is a REAL risk, but with
  -- NO link row in risk_treatment_actions. This is EXPECTED and BY DESIGN
  -- (research.md D-2) — an Action created directly through `POST /actions`
  -- with originType RISK_TREATMENT never gets a link row unless a caller
  -- later sets `treatmentDecisionId` through the risk route. Measured at 3
  -- rows in the development database at spec time. Asserted here as an
  -- explicit, named invariant check — surfaced via RAISE NOTICE, never a
  -- silent fact left to be discovered later — rather than a failure,
  -- because failing the migration over BY-DESIGN orphans would be wrong.
  SELECT COUNT(*) INTO orphan_action_count
  FROM actions a
  JOIN risks r ON r.id = a.origin_id
  WHERE a.origin_type = 'RISK_TREATMENT'
    AND NOT EXISTS (
      SELECT 1 FROM risk_treatment_actions rta WHERE rta.action_id = a.id
    );

  RAISE NOTICE
    'Action convergence: % Action row(s) with origin_type=RISK_TREATMENT and a real origin risk have NO risk_treatment_actions link row. This is EXPECTED by design (research.md D-2) -- these become visible on their risk''s treatment-action listing after this migration, where they were previously invisible.',
    orphan_action_count;
END $$;

-- ============================================================================
-- STEP 3 — Only now: harden action_id, drop the six superseded columns and
-- the three indexes that referenced them, add the replacement index.
-- ============================================================================

ALTER TABLE risk_treatment_actions
  ALTER COLUMN action_id SET NOT NULL;

ALTER TABLE risk_treatment_actions
  ADD CONSTRAINT risk_treatment_actions_action_id_key UNIQUE (action_id);

DROP INDEX IF EXISTS risk_treatment_actions_risk_id_status_idx;
DROP INDEX IF EXISTS risk_treatment_actions_responsible_user_id_due_on_idx;
DROP INDEX IF EXISTS risk_treatment_actions_due_on_status_idx;

ALTER TABLE risk_treatment_actions
  DROP COLUMN title,
  DROP COLUMN description,
  DROP COLUMN responsible_user_id,
  DROP COLUMN due_on,
  DROP COLUMN status,
  DROP COLUMN completed_at;

CREATE INDEX risk_treatment_actions_risk_id_idx ON risk_treatment_actions (risk_id);

-- Coordinator review, 2026-09-11: `TreatmentActionStatus` backed only the
-- `status` column just dropped above and nothing else in the schema
-- (confirmed: no other column references it). Dropping a Postgres enum
-- TYPE outright is safe and unrestricted (unlike removing one VALUE from
-- an enum still in use) — done here, in the same migration, rather than
-- left as a separate future cleanup, so the convergence guard
-- (`test/unit/action-model-convergence-guard.spec.ts`) never has to assert
-- against an enum that backs nothing, which would be an assertion that
-- cannot fail — the exact shape this project keeps paying for.
DROP TYPE "TreatmentActionStatus";
