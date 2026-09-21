'use client';

/**
 * PharosGRC — control detail, "Visão geral" section, three cards
 * (021-control-detail-experience, Fase B — replaces the flat, card-less
 * `<dl>` this component used to be, mirroring `ProblemOverview`'s/
 * `ActionOverview`'s own Fase B correction on the sibling screens).
 *
 * Three cards, mirroring the platform's established hierarchy (CLAUDE.md
 * §18.12): "Descrição" gets its own prominent card, "Efetividade" gets its
 * OWN card right after it (see below for why), and the record's remaining
 * classification/ownership facts sit together in "Detalhes do controle",
 * each field anchored by a small semantic icon via the shared `DetailField`
 * (`@/components/detail/detail-field`).
 *
 * The FOURTH card this section shows on screen — "Ciclo de vida" — is
 * `ControlLifecycleSection` (`components/detail/`), composed by the detail
 * view alongside this component, not inside it: a different concern
 * (lifecycle trajectory, transitions, outcome facts), not a classification
 * fact about the record's identity. `retiredAt`/`retiredBy`/
 * `retirementReason` — this component's own flat `<dl>` used to render all
 * three, conditionally on `status === 'RETIRED'` — now live there instead,
 * each independently gated on its own field being present.
 *
 * ## Why "Efetividade" is not a `DetailField` cell (the point of this phase)
 *
 * A control exists to WORK — `effectiveness` is the fact central to the
 * record, the same way "Causa raiz" is the point of a Problem's own record
 * and "Origem" is the point of an Action's. Before this phase it was a
 * discreet badge in the header and nothing else on this section; the
 * verification history lived only inside the "Verificações" tab. This card
 * gives it first-class treatment: the current `ControlEffectiveness` value,
 * `controlEffectivenessHint`'s own explanatory sentence when one applies
 * (`NOT_ASSESSED`/`EXPIRED`), and `frequency` — the field that makes
 * effectiveness VENCIBLE at all. `frequency === null` is rendered with an
 * honest sentence (`overview.frequencyNoExpiry`), never the generic "Não
 * definido" placeholder, because a null frequency is a deliberate fact
 * (FR-015), not a data gap. Nothing here invents a "próxima verificação" or
 * "dias em atraso" — `ControlDetail` carries no such field, and the
 * coordinator's own instruction for this phase was explicit that no
 * derivation the payload does not support may appear.
 */
import { StatusBadge } from '@pharos/design-system/components';
import {
  Building2,
  CalendarPlus,
  Cog,
  FileText,
  Repeat,
  ShieldCheck,
  Tag,
  User,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { controls, controlEffectivenessHint } from '@/lib/messages/controls';

import { formatTimestampDate } from '../date';
import {
  controlEffectivenessBadgeVariant,
  controlEffectivenessIcon,
  controlEffectivenessLabel,
} from '../status';

import type { ControlDetail } from '../types';

export interface ControlOverviewProps {
  control: ControlDetail;
}

export function ControlOverview({ control }: ControlOverviewProps): React.JSX.Element {
  const overview = controls.detail.overview;
  const fields = overview.fields;
  const hint = controlEffectivenessHint(control.effectiveness);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.descriptionCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-foreground">{control.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.effectivenessCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* `self-start` — F-80 (docs/deferred-findings.md, resolved
              022-asset-detail-experience): a `flex flex-col` parent
              stretches a child with no intrinsic width to its own full
              width by default, regardless of the child's own `inline-flex`
              display. Without this, the badge rendered as a full-width bar
              instead of a compact pill. */}
          <StatusBadge
            variant={controlEffectivenessBadgeVariant(control.effectiveness)}
            label={controlEffectivenessLabel(control.effectiveness)}
            icon={controlEffectivenessIcon(control.effectiveness)}
            className="self-start"
          />
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          <dl className="border-t border-border pt-3">
            <DetailField
              icon={Repeat}
              label={fields.frequency}
              value={control.frequency ? controls.frequencyLabels[control.frequency] : null}
              emptyLabel={overview.frequencyNoExpiry}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={control.orgUnit ? control.orgUnit.name : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={control.owner ? control.owner.fullName : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Cog}
              label={fields.nature}
              value={control.nature ? controls.natureLabels[control.nature] : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Tag}
              label={fields.type}
              value={control.type ? controls.typeLabels[control.type] : null}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.createdAt}
              value={formatTimestampDate(control.createdAt)}
              emptyLabel={overview.notSet}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
