import type { Ingredient, RecipeItem } from "@/lib/db/schema";

/* Brewability (brief v1): resolve a recipe's items against live stock.
   Matching is deliberately rough — by type plus loose name overlap — and the
   UI says so. Water and chemicals don't gate a brew. */

export type Brewability =
  | { verdict: "no_items" }
  | { verdict: "can_brew" }
  | { verdict: "need_to_buy"; missing: string[] };

function nameMatches(itemName: string, stockName: string): boolean {
  const a = itemName.toLowerCase();
  const b = stockName.toLowerCase();
  if (a.includes(b) || b.includes(a)) return true;
  // token overlap: "Willamette" matches "Willamette, pellet"
  const tokens = a.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
  return tokens.some((t) => b.includes(t));
}

export function checkBrewability(
  items: RecipeItem[],
  stock: Ingredient[]
): Brewability {
  const gating = items.filter(
    (i) => i.ingredientType !== "water" && i.ingredientType !== "chemical"
  );
  if (gating.length === 0) return { verdict: "no_items" };

  const missing: string[] = [];
  for (const item of gating) {
    const found = stock.some(
      (s) =>
        s.type === item.ingredientType &&
        s.quantityOnHand > 0 &&
        nameMatches(item.name, s.name)
    );
    if (!found) {
      missing.push(item.amount != null ? `${item.amount} ${item.unit} ${item.name}` : item.name);
    }
  }
  return missing.length === 0 ? { verdict: "can_brew" } : { verdict: "need_to_buy", missing };
}
