import type { ActionOriginType } from './types';

const ORIGIN_HREF_BUILDER: Record<ActionOriginType, ((originId: string) => string) | null> = {
  RISK_TREATMENT: (originId) => `/risks/${originId}`,
  INCIDENT: (originId) => `/incidents/${originId}`,
  PROBLEM: (originId) => `/problems/${originId}`,
  FINDING: null,
  CONTROL_ASSESSMENT: null,
};

export function actionOriginHref(
  originType: ActionOriginType,
  originId: string,
): string | undefined {
  const builder = ORIGIN_HREF_BUILDER[originType];
  return builder ? builder(originId) : undefined;
}
