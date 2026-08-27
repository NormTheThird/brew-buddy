/* Loose name matching shared by brewability and receipt-import dedup.
   Deliberately rough — it finds CANDIDATES; a human confirms. */

export function nameMatches(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.includes(y) || y.includes(x)) return true;
  // token overlap: "Willamette" matches "Willamette, pellet"
  const tokens = x.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
  return tokens.some((t) => y.includes(t));
}

export function findLikelyMatch<T extends { id: number; name: string }>(
  name: string,
  candidates: T[]
): T | undefined {
  return candidates.find((c) => nameMatches(name, c.name));
}
