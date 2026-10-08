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
