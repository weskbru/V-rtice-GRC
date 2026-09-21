/**
 * PharosGRC — indicator detail route (009-indicators-reports, T060,
 * US1/US2). A thin server wrapper so the dynamic `metricKey` segment is
 * validated against the closed, eleven-key `IndicatorMetricKey` registry
 * BEFORE any client component mounts — an unknown segment renders the
 * platform's own not-found page (`notFound()`) rather than a client-side
 * 404 fetched from the API, the same way `(app)/incidents/[id]/page.tsx`
 * hands its dynamic segment straight to its client view but, unlike that
 * case (any UUID is a legal shape for an incident id), a metric key comes
 * from a CLOSED catalog this app already knows in full — validating it
 * here needs no round trip.
 */
import { notFound } from 'next/navigation';

import { indicators } from '@/lib/messages/indicators';

import { IndicatorDetailView } from './indicator-detail-view';

import type { IndicatorMetricKey } from '@/features/indicators/types';

function isKnownMetricKey(value: string): value is IndicatorMetricKey {
  return Object.prototype.hasOwnProperty.call(indicators.metricKeyLabels, value);
}

export default async function IndicatorDetailPage({
  params,
}: {
  params: Promise<{ metricKey: string }>;
}): Promise<React.JSX.Element> {
  const { metricKey } = await params;
  if (!isKnownMetricKey(metricKey)) {
    notFound();
  }
  return <IndicatorDetailView metricKey={metricKey} />;
}
