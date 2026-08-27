import type { Batch, Recipe } from "@/lib/db/schema";

/** Was this batch field recorded as an estimate? (brief §10.4) */
export function isEstimated(batch: Batch, field: string): boolean {
  try {
    return (JSON.parse(batch.estimatedFields) as string[]).includes(field);
  } catch {
    return false;
  }
}

export type RecipeDisplayStatus =
  | "idea"
  | "want_to_brew"
  | "ready_to_brew"
  | "brewed"
  | "keeper";

/** Brewed/Keeper derive from batches; Idea/Want to brew are the stored
    status. A want-to-brew recipe whose ingredients are ALL in stock
    promotes itself to Ready to brew: the lifecycle is
    want to brew → (buy) → ready to brew → brewed. */
export function recipeDisplayStatus(
  recipe: Recipe,
  recipeBatches: Pick<Batch, "keeper">[],
  canBrew = false
): RecipeDisplayStatus {
  if (recipeBatches.some((b) => b.keeper)) return "keeper";
  if (recipeBatches.length > 0) return "brewed";
  if (recipe.status === "want_to_brew" && canBrew) return "ready_to_brew";
  return recipe.status;
}

export const statusBadge: Record<RecipeDisplayStatus, { label: string; color: string }> = {
  idea: { label: "IDEA", color: "#6d747d" },
  want_to_brew: { label: "WANT TO BREW", color: "var(--accent)" },
  ready_to_brew: { label: "READY TO BREW", color: "var(--success)" },
  brewed: { label: "BREWED", color: "var(--primary)" },
  keeper: { label: "KEEPER", color: "var(--success)" },
};

export const batchStatusBadge: Record<string, { label: string; color: string }> = {
  planned: { label: "PLANNED", color: "#44464f" },
  fermenting: { label: "FERMENTING", color: "var(--success)" },
  conditioning: { label: "CONDITIONING", color: "var(--info)" },
  completed: { label: "COMPLETED", color: "#6d747d" },
};

export const methodLabels: Record<string, string> = {
  extract: "Extract",
  partial_mash: "Partial mash",
  all_grain: "All grain",
};
