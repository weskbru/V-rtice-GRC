export function parseAncestorOrSelfIds(path: string): readonly string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

export function buildAssignmentLine(
  path: string,
  descendantIds: Iterable<string>,
): ReadonlySet<string> {
  const line = new Set<string>(parseAncestorOrSelfIds(path));
  for (const id of descendantIds) {
    line.add(id);
  }
  return line;
}
