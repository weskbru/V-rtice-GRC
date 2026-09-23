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
