export type ControlEffectivenessLevel =
  'NOT_ASSESSED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'EXPIRED';

export const CONTROL_EFFECTIVENESS_LEVELS: readonly ControlEffectivenessLevel[] = [
  'NOT_ASSESSED',
  'EFFECTIVE',
  'PARTIALLY_EFFECTIVE',
  'INEFFECTIVE',
  'EXPIRED',
];

export abstract class ControlEffectivenessPort {
  abstract getEffectivenessBatch(
    controlIds: readonly string[],
    referenceDate: Date,
  ): Promise<ReadonlyMap<string, ControlEffectivenessLevel>>;
}
