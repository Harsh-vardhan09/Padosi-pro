/** IDs the client asked for that the catalogue does not contain, in the order they were sent. */
export function unknownTaskIds(requested: number[], existing: number[]): number[] {
  const known = new Set(existing);
  return requested.filter((id) => !known.has(id));
}

export function duplicateTaskIds(requested: number[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const id of requested) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  return [...duplicates];
}
