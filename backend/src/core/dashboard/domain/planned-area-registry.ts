export interface PlannedAreaDefinition {
  readonly key: string;
  readonly label: string;
}

const plannedAreaRegistry = new Map<string, PlannedAreaDefinition>();

export function registerPlannedArea(definition: PlannedAreaDefinition): void {
  if (plannedAreaRegistry.has(definition.key)) {
    throw new Error(
      `Planned dashboard area "${definition.key}" is already registered. Each key may be ` +
        'registered exactly once.',
    );
  }
  plannedAreaRegistry.set(definition.key, definition);
}

export function getPlannedAreas(): readonly PlannedAreaDefinition[] {
  return Array.from(plannedAreaRegistry.values());
}

export function __resetPlannedAreaRegistryForTests(): void {
  plannedAreaRegistry.clear();
}
