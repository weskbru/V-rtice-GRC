-- T020/003-controls-management, User Story 1 — `ControlLifecycleTransition`
-- baseline (D-6, FR-004). Genuine data-model gap found during
-- implementation: the contract's `getControlLifecycle`/`transitionControl`
-- operations (`contracts/controls.openapi.yaml`) reference a
-- `ControlLifecycleTransition` response schema, but `data-model.md` never
-- defines a table for it — an audit event alone does not satisfy a typed
-- history endpoint. Same shape as `risk_lifecycle_transitions`
-- (`20260905170100_risk_lifecycle_and_approvals_baseline`), minus
-- `approval_id`: Controls' lifecycle has no approval-gated transition
-- (research.md D-6's own "Descartado explicitamente: um estado
-- PENDING_APPROVAL").
--
-- Hand-written (never `prisma migrate dev` — see schema.prisma's header and
-- docs/local-environment.md), corresponding 1:1 to the
-- `ControlLifecycleTransition` model added to schema.prisma in this same
-- change.

-- CreateTable
CREATE TABLE "control_lifecycle_transitions" (
    "id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "from_status" "ControlStatus" NOT NULL,
    "to_status" "ControlStatus" NOT NULL,
    "performed_by_user_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL,
    "justification" TEXT,

    CONSTRAINT "control_lifecycle_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "control_lifecycle_transitions_control_id_performed_at_idx" ON "control_lifecycle_transitions"("control_id", "performed_at" DESC);

-- AddForeignKey
ALTER TABLE "control_lifecycle_transitions" ADD CONSTRAINT "control_lifecycle_transitions_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_lifecycle_transitions" ADD CONSTRAINT "control_lifecycle_transitions_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Append-only enforcement — transcribed from `risk_lifecycle_transitions`'s
-- own migration (`20260905170100_risk_lifecycle_and_approvals_baseline`),
-- same reasoning applied identically: a transition row records "the
-- control moved from X to Y, performed by this user, at this instant" — a
-- historical fact complete and correct the moment it is inserted
-- (`PerformControlTransitionUseCase`). No later event ever needs to revise
-- a PAST transition's columns; the NEXT transition is simply a NEW row.
-- Privilege revocation (not a trigger) removes every legitimate
-- application code path that could violate append-only-ness, because there
-- is no legitimate `UPDATE`/`DELETE` path to preserve.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    app_role text := (SELECT value FROM pharos_config WHERE key = 'app_role');
BEGIN
    IF app_role IS NULL THEN
        RAISE EXCEPTION 'pharos_config has no app_role row — cannot enforce control_lifecycle_transitions append-only privileges';
    END IF;

    EXECUTE format('GRANT SELECT, INSERT ON %I TO %I', 'control_lifecycle_transitions', app_role);
    EXECUTE format('REVOKE UPDATE, DELETE ON %I FROM %I', 'control_lifecycle_transitions', app_role);
END;
$$;
