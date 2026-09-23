export interface OrgUnitPathInfo {
  readonly id: string;
  readonly path: string;
  readonly depth: number;
}

export interface OrgUnitNode {
  readonly id: string;
  readonly path: string;
  readonly depth: number;
}

export function computeRootPath(id: string): OrgUnitPathInfo {
  return { id, path: `/${id}/`, depth: 0 };
}

export function computeChildPath(parent: OrgUnitPathInfo, childId: string): OrgUnitPathInfo {
  return { id: childId, path: `${parent.path}${childId}/`, depth: parent.depth + 1 };
}

export function isSelfOrDescendantPath(path: string, ofPath: string): boolean {
  return path === ofPath || path.startsWith(ofPath);
}

export function isStrictDescendantPath(path: string, ofPath: string): boolean {
  return path !== ofPath && path.startsWith(ofPath);
}

export function canReparent(unit: OrgUnitPathInfo, newParent: OrgUnitPathInfo): boolean {
  if (unit.id === newParent.id) {
    return false;
  }
  return !isSelfOrDescendantPath(newParent.path, unit.path);
}

export interface SubtreeRecomputation {
  readonly movedUnit: OrgUnitPathInfo;
  readonly updatedDescendants: readonly OrgUnitNode[];
}

export function recomputeSubtreePaths(
  unit: OrgUnitPathInfo,
  newParent: OrgUnitPathInfo,
  currentDescendants: readonly OrgUnitNode[],
): SubtreeRecomputation {
  if (!canReparent(unit, newParent)) {
    throw new Error(
      `Reparenting ${unit.id} under ${newParent.id} would create a cycle (${newParent.id} is ${unit.id} or one of its descendants).`,
    );
  }

  const oldPrefix = unit.path;
  const newPath = `${newParent.path}${unit.id}/`;
  const newDepth = newParent.depth + 1;
  const depthDelta = newDepth - unit.depth;

  const updatedDescendants = currentDescendants.map((descendant) => {
    if (!isStrictDescendantPath(descendant.path, oldPrefix)) {
      throw new Error(
        `${descendant.id} (path ${descendant.path}) is not a descendant of ${unit.id} (path ${oldPrefix}).`,
      );
    }

    return {
      id: descendant.id,
      path: newPath + descendant.path.slice(oldPrefix.length),
      depth: descendant.depth + depthDelta,
    };
  });

  return {
    movedUnit: { id: unit.id, path: newPath, depth: newDepth },
    updatedDescendants,
  };
}
