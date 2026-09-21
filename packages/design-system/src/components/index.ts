/**
 * PharosGRC Design System — components barrel.
 *
 * Platform-wide composed patterns (T045/T046). shadcn/ui-derived primitives
 * are generated directly into `apps/web/src/components/ui/` per plan.md's
 * project structure and are NOT re-exported from here — this package must
 * never depend on an application.
 */

export * from './page-header';
export * from './card-grid';
export * from './empty-state';
export * from './empty-value';
export * from './loading-state';
export * from './pharos-loader';
export * from './error-state';
export * from './confirm-dialog';
export * from './detail-panel';
export * from './detail-layout';
export * from './disclosure-group';
export * from './status-badge';
export * from './view-toggle';
export * from './summary-stat-card';
export * from './metric-card';
export * from './threshold-breach-badge';
export * from './trend-chart';
export * from './risk/risk-level-badge';
export * from './risk/risk-matrix';
export * from './risk/risk-score';
export * from './form';
export * from './entity';
export * from './data-table';
export * from './timeline';
export * from './collaboration';
export * from '../lib/use-restore-focus';
export * from '../lib/use-delayed-visibility';
