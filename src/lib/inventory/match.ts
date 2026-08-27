/* Loose name matching shared by brewability and receipt-import dedup.
   Deliberately rough — it finds CANDIDATES; a human confirms. */

// Filler and generic brewing words never count as a match signal on their
// own ("hydrometer WITH case" must not match "kettle WITH pump").
const NOISE = new Set([
  "with",
  "from",
  "and",
  "the",
  "for",
  "this",
  "that",
  "your",
  "pack",
  "count",
  "size",
  "inch",
  "inches",
  "foot",
  "feet",
  "quart",
  "gallon",
  "ounce",
  "piece",
  "brewing",
  "brewer",
  "brewers",
  "homebrew",
  "stainless",
  "steel",
  "glass",
  "clear",
  "digital",
  "premium",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3 && !NOISE.has(t));
}

export function nameMatches(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.includes(y) || y.includes(x)) return true;
  // A distinctive token shared between the names ("willamette", "tubing",
  // "hydrometer") — filler and generic words don't count.
  return tokens(x).some((t) => y.includes(t));
}

export function findLikelyMatch<T extends { id: string; name: string }>(
  name: string,
  candidates: T[]
): T | undefined {
  return candidates.find((c) => nameMatches(name, c.name));
}
