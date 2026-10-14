-- 007-implementation-remediation, D-11/T009 — additive: denormalize
-- `control_assessments.org_unit_id` from `controls.org_unit_id`.
--
-- This exists because `ControlAssessmentRepository.listAssessmentIdsInScope`
-- (confirmed by direct reading) decides row visibility through a JOIN up to
-- `controls.org_unit_id` — exactly what this project's own ratified rule in
-- AGENTS.md forbids: "carregar o escopo organizacional em toda tabela
-- escopada, mesmo quando derivável por relação; autorização nunca deve
-- depender de um JOIN". The repository half that reads this column belongs
-- to another agent; this migration is only the schema half: the column,
-- the backfill, and the guarantee that keeps it correct going forward.
--
-- Nullable, matching `controls.org_unit_id`'s own nullability — a control
-- may have no organizational unit (a global control), and an assessment of
-- it is then equally unscoped.
--
-- THE GUARANTEE (principle §19.7 of this codebase — derived state has
-- exactly ONE calculator): no application code path ever writes this
-- column. Two triggers are the only calculator, together covering both
-- ways the value could otherwise go stale:
--
--   1. `control_assessments_set_org_unit_id` (BEFORE INSERT on
--      control_assessments): unconditionally overwrites NEW.org_unit_id
--      from the referenced control's CURRENT org_unit_id, ignoring
--      whatever value a caller supplied (there is no legitimate one — a
--      caller that tried to set this directly would just be wrong, so the
--      trigger does not merely default a NULL, it overrides always).
--
--   2. `control_assessments_cascade_org_unit_from_control` (AFTER UPDATE
--      on controls, only when org_unit_id actually changed): propagates
--      the new value onto every existing assessment of that control. This
--      is the half that matters for correctness over time — a control can
--      move to a different organizational unit after it already has
--      assessments (`UpdateControlUseCase` allows changing `orgUnitId`),
--      and without this trigger the backfilled/inserted value on old
--      assessment rows would silently disagree with the control's current
--      unit the next time it moves. Both triggers together mean the write
--      path never needs to know this column exists at all.

ALTER TABLE control_assessments
  ADD COLUMN org_unit_id UUID REFERENCES organizational_units (id);

-- Backfill every existing row from its control's CURRENT org unit — the
-- only value there is to backfill from; there is no historical record of
-- what a control's unit was at the moment each assessment was created.
UPDATE control_assessments ca
SET org_unit_id = c.org_unit_id
FROM controls c
WHERE c.id = ca.control_id;

CREATE INDEX control_assessments_org_unit_id_idx ON control_assessments (org_unit_id);

-- Trigger 1 — single calculator at INSERT time.
CREATE OR REPLACE FUNCTION control_assessments_set_org_unit_id() RETURNS trigger AS $$
BEGIN
  SELECT c.org_unit_id INTO NEW.org_unit_id
  FROM controls c
  WHERE c.id = NEW.control_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_assessments_set_org_unit_id
  BEFORE INSERT ON control_assessments
  FOR EACH ROW EXECUTE FUNCTION control_assessments_set_org_unit_id();

-- Trigger 2 — single calculator when a control moves, cascading to every
-- assessment it already has. `WHEN` guards the common case (an update that
-- does not touch org_unit_id, e.g. a status transition) so the cascading
-- UPDATE only ever runs on the row-count that can possibly need it.
CREATE OR REPLACE FUNCTION control_assessments_cascade_org_unit_from_control() RETURNS trigger AS $$
BEGIN
  UPDATE control_assessments
  SET org_unit_id = NEW.org_unit_id
  WHERE control_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER control_assessments_cascade_org_unit_from_control
  AFTER UPDATE ON controls
  FOR EACH ROW
  WHEN (OLD.org_unit_id IS DISTINCT FROM NEW.org_unit_id)
  EXECUTE FUNCTION control_assessments_cascade_org_unit_from_control();
