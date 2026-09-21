/**
 * PharosGRC — risk detail, "Detalhes do risco" block within Visão geral
 * (T097, FR-053, FR-069, FR-093; regrouped by 016-risk-detail-experience
 * §4.5; icon scan pass by 017-risk-overview-polish).
 *
 * Read-only presentation of the risk's description, classification and
 * ownership/dates. Inherent/residual level are deliberately NOT rendered
 * here any more — 016 §4.3 moved both to the record's own executive summary
 * row (`RiskSummaryRow`, in `components/detail/`), which every reader sees
 * before opening any section, so nothing about them is lost (SC-013's
 * honesty guarantee is now `RiskSummaryRow`'s to keep: "Não avaliado" there,
 * never a fabricated level). This section keeps the plain facts a level
 * doesn't depend on.
 *
 * ## Hierarchy (CLAUDE.md §18, wave 4; regrouped again by 016 §4.5)
 *
 * The original single "Dados do risco" card put the description, three
 * classification enums and five ownership/date facts at identical visual
 * weight; wave 4 split classification from ownership/dates into two cards.
 * 016 merges those two back into ONE "Detalhes do risco" card — with the
 * level cards gone, two small cards side by side under a full-width
 * description card read as more fragmentation than the content needs — but
 * keeps wave 4's actual distinction alive within it: classification
 * (category/type/origin) still renders with the `muted` treatment, genuinely
 * secondary metadata, while ownership/dates keep normal weight. No field is
 * removed and no data changes; only the card boundary moves.
 *
 * ## Icon scan pass (017-risk-overview-polish)
 *
 * The nine attributes were stacked as label-over-value with no visual
 * anchor — scannable only by reading every label in order. This pass adds a
 * small, discrete semantic icon ahead of each label so a reader can locate
 * "the org unit one" or "the date ones" by shape before reading text. Three
 * decisions worth recording because they were deliberately NOT made:
 *
 * 1. `ReadOnlyField` (`packages/design-system/src/components/form/
 *    read-only-field.tsx`) is used across the whole product and has no icon
 *    prop. It is NOT changed here — no other screen asked for icons on it,
 *    and CLAUDE.md §19.4/§18.3 both say a shared primitive changes for a
 *    proven cross-screen need, not one screen's polish. `DetailField`
 *    (`@/components/detail/detail-field`, promoted to shared infrastructure
 *    in 018-incident-detail-experience once Incidents became its second
 *    real consumer — CLAUDE.md §19.10) composes the identical `dt`/`dd`
 *    typography (`ReadOnlyField`'s own classes, copied verbatim) plus an
 *    icon slot, so this card's read-only semantics stay visually identical
 *    to every other `ReadOnlyField` on the platform — only this card adds
 *    an icon.
 * 2. Labels stay UPPERCASE. `ReadOnlyField` renders every label in the
 *    product this way; changing case here alone would invent a convention
 *    exclusive to this screen, which CLAUDE.md explicitly rules out. If
 *    normal-case labels are ever wanted, that is a `ReadOnlyField` decision
 *    made once for the whole platform, not a per-screen override.
 * 3. Icon choices reuse the vocabulary this exact module already
 *    established, rather than inventing a second one: `FolderTree` for
 *    category, `Building2` for org unit and `User` for a person are lifted
 *    directly from `risk-card.tsx`'s own field icons. `CalendarClock` for
 *    "Próxima revisão" is the SAME icon `RiskSummaryRow`'s "Revisão" card
 *    uses one section above — it is the same concept on the same screen, so
 *    it gets the same shape (diverging there would read as two different
 *    things). The remaining icons (`Tag`, `Compass`, `UserCheck`,
 *    `CalendarPlus`, `CalendarCheck`, `FileText`) are chosen from the same
 *    library for the fields this module had not iconified before.
 *
 * An empty value ("Não definido") now renders through the platform's own
 * `EmptyValue` (already used by `risk-card.tsx` for the same word) instead
 * of full-weight body text — CLAUDE.md §18.11's "a informação importante
 * domina os metadados secundários" applied to a fact that has no value yet,
 * reusing the exact component built for that purpose rather than a local
 * style (§19.4).
 */
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Compass,
  FileText,
  FolderTree,
  Tag,
  User,
  UserCheck,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { risks } from '@/lib/messages/risks';

import { formatDateOnly } from '../date';

import type { RiskDetail } from '../types';

export interface RiskOverviewProps {
  risk: RiskDetail;
}

function formatDate(value: string | null): string | null {
  return value ? formatDateOnly(value) : null;
}

export function RiskOverview({ risk }: RiskOverviewProps): React.JSX.Element {
  const fields = risks.overview.fields;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
            {risks.overview.descriptionCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-foreground">{risk.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{risks.overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={FolderTree}
              label={fields.category}
              value={risk.category?.name ?? null}
              emptyLabel={risks.overview.notSet}
              muted
            />
            <DetailField
              icon={Tag}
              label={fields.type}
              value={risk.type?.name ?? null}
              emptyLabel={risks.overview.notSet}
              muted
            />
            <DetailField
              icon={Compass}
              label={fields.origin}
              value={risk.origin?.name ?? null}
              emptyLabel={risks.overview.notSet}
              muted
            />
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={risk.orgUnit.name}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={risk.owner.fullName}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={UserCheck}
              label={fields.responsible}
              value={risk.responsible?.fullName ?? null}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.identifiedOn}
              value={formatDate(risk.identifiedOn)}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={CalendarCheck}
              label={fields.lastAssessedOn}
              value={formatDate(risk.lastAssessedOn ?? null)}
              emptyLabel={risks.overview.notSet}
            />
            <DetailField
              icon={CalendarClock}
              label={fields.nextReviewOn}
              value={formatDate(risk.nextReviewOn ?? null)}
              emptyLabel={risks.overview.notSet}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
