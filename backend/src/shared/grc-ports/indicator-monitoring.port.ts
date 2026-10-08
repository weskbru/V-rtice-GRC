export interface IndicatorMonitoringSummary {
  readonly monitored: number;
  readonly breached: number;
}

export abstract class IndicatorMonitoringPort {
  abstract getMonitoringSummary(): Promise<IndicatorMonitoringSummary>;
}
