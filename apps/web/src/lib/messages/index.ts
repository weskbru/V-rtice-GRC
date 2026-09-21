/**
 * PharosGRC — centralized, typed pt-BR message catalog.
 *
 * PharosGRC ships a single locale (pt-BR) — there is no runtime language
 * switch and no i18n library (adding one, e.g. `next-intl`, would expand
 * scope beyond a pure localization pass). This catalog exists purely so
 * every user-facing string in `apps/web` lives in one place, organized by
 * area, instead of scattered as inline literals:
 *
 *   - a screen/component imports only the slice(s) it needs
 *     (`import { auth } from '@/lib/messages/auth'`, or the aggregate
 *     `messages.auth` from here);
 *   - each area file is `as const`, so `messages.auth.login.emailLabel`
 *     is a literal string type — a typo'd or removed key is a **compile
 *     error**, not a silent `undefined` rendered to the screen;
 *   - `errors` holds the small set of canonical, backend-aligned strings
 *     (FR-007 credential rejection, rate limiting, HTTP problem titles,
 *     ...) that MUST match `apps/api`'s own copy exactly — see its doc
 *     comment before changing any of them.
 *
 * `packages/design-system` does not depend on this catalog (and must not —
 * dependencies only ever point from `apps/web` to the design system, never
 * the other way around). Its components keep taking text through props;
 * where one has a built-in default, that default is pt-BR directly in the
 * component itself.
 */
export { actions } from './actions';
export { admin } from './admin';
export { auditEngagements } from './audit-engagements';
export { auth } from './auth';
export { common } from './common';
export { dashboard } from './dashboard';
export { errors } from './errors';
export { evidence } from './evidence';
export { findings } from './findings';
export { indicators } from './indicators';
export { profile } from './profile';
export { reports } from './reports';
export { risks } from './risks';
export { shell } from './shell';
export { validation } from './validation';

import { actions } from './actions';
import { admin } from './admin';
import { auditEngagements } from './audit-engagements';
import { auth } from './auth';
import { common } from './common';
import { dashboard } from './dashboard';
import { errors } from './errors';
import { evidence } from './evidence';
import { findings } from './findings';
import { indicators } from './indicators';
import { profile } from './profile';
import { reports } from './reports';
import { risks } from './risks';
import { shell } from './shell';
import { validation } from './validation';

/** Convenience aggregate — prefer importing the specific area module directly when you only need one slice. */
export const messages = {
  actions,
  admin,
  auditEngagements,
  auth,
  common,
  dashboard,
  errors,
  evidence,
  findings,
  indicators,
  profile,
  reports,
  risks,
  shell,
  validation,
} as const;
