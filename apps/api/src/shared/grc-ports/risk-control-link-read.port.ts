/**
 * The ADR-020 part 3 boundary port for the REVERSE direction of the
 * Risk<->Control relationship: `modules/controls` reading the
 * `RiskControlLink` row that `modules/risk` owns (FR-021,
 * `contracts/controls.openapi.yaml`'s `listControlRiskLinks`,
 * `GET /controls/{controlId}/risks`). "Read-only by design":
 * `RiskControlLink` is created/withdrawn only from
 * `POST`/`DELETE /risks/{riskId}/controls` on the Risk side — this port
 * exposes the one link table that already exists, never a second vínculo.
 *
 * Mirrors `control-directory.port.ts` (the FORWARD direction — Risk reading
 * Control) exactly, for the opposite direction: lives in `shared/grc-ports/`
 * — not `grc/shared/`, `RiskControlLink` is not a GRC-kernel concept, it is
 * owned entirely by `modules/risk` (ADR-020 part 1) — with `modules/risk`
 * (the OWNING module) providing the adapter
 * (`modules/risk/infrastructure/risk-control-link-read.adapter.ts`, bound by
 * `modules/risk/risk-control-link-read.module.ts`, a small `@Global()`
 * module `RiskModule` itself imports, exactly the shape
 * `ControlsModule`/`ControlDirectoryModule` already establish for the
 * opposite direction) and the composition root (`AppModule`, transitively
 * via `RiskModule`) doing the binding. Neither module imports the other:
 * `test/unit/controls-risk-module-boundary.spec.ts` (SC-007) is the static
 * proof, unaffected by which module a `shared/**` file's adapter lives in.
 *
 * `shared/**` may not import from `core/**`, `grc/**` or `modules/**`
 * (`apps/api/eslint.config.mjs`); this file imports nothing beyond the
 * plain TypeScript below, so both `modules/risk` and `modules/controls` may
 * depend on it without violating that boundary in either direction.
 *
 * ## The exposed shape is deliberately minimal (ADR-020 part 4)
 *
 * `RiskRefRecord` is exactly `{ id, code, title }` — never `description`,
 * `probability`, `impact`, `status`, `ownerUserId` or any other `Risk`
 * domain field. `ListControlRiskLinksUseCase` only ever needs to say WHICH
 * risk a control treats, for display — not to reproduce the Risk aggregate
 * on the Controls side. ADR-020 part 4 also requires a port to expose the
 * target's organizational unit so the side that REGISTERS a link can check
 * scope before writing; that requirement does not apply to this port,
 * because this port never registers anything. The write path (creating
 * `RiskControlLink`) is `LinkControlUseCase`
 * (`modules/risk/application/links/control-link.usecase.ts`), which already
 * resolves the control through `ControlDirectoryPort` — the port that DOES
 * carry `orgUnitId`, because that is the port a write depends on. This port
 * only lists links a control's own scope has already been checked for (by
 * `ControlAccessResolver.resolveControl`, on the Controls side, before this
 * port is ever called) — so no organizational-scope field belongs on
 * `RiskRefRecord`, and adding one would be exactly the "expose more than
 * the minimum" ADR-020 part 4 forbids.
 *
 * ## History: this direction was first built as a documented deviation
 *
 * This port originally lived in `modules/controls/domain/ports/`, with its
 * own adapter reading `risk_control_links`/`risks` directly from inside
 * `modules/controls` — a deviation from ADR-020 part 3, taken only because
 * the task that built it (T038/003-controls-management, User Story 3) was
 * explicitly forbidden from editing `modules/risk` (owned by a concurrent
 * workstream at the time). Once a single change could touch both modules,
 * the deviation was closed: the port moved here, and its adapter moved into
 * `modules/risk`, the module that owns the table it reads. The pattern now
 * holds symmetrically in both directions — see
 * `specs/003-controls-management/research.md` D-4 for the full account of
 * what actually happened when ADR-020 was exercised in both directions.
 */
export interface RiskRefRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface ControlUserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RiskControlLinkReadRecord {
  readonly id: string;
  readonly risk: RiskRefRecord;
  readonly linkedBy: ControlUserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedBy: ControlUserRefRecord | undefined;
  readonly unlinkedAt: Date | undefined;
}

export abstract class RiskControlLinkReadPort {
  abstract listByControl(
    controlId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly RiskControlLinkReadRecord[]>;
}
