"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  batches,
  batchIngredients,
  batchStatuses,
  equipment,
  gravityReadings,
  stock,
  stockTypes,
  recipeItems,
  recipeLookups,
  recipes,
  taskCompletions,
  type StockItem,
  type StockType,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { parseBeerXml } from "./beerxml";
import { suggestRecipes, type SuggestedRecipe } from "./recipe-ai";
import { aiRuntime, userHasAiAccess } from "@/lib/ai/runtime";

export type FormState = { error?: string };
export type RecipeLookupState = {
  error?: string;
  suggestions?: SuggestedRecipe[];
  /** History row these suggestions live in; adopting one consumes it. */
  lookupId?: string;
};

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}
function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function int(v: FormDataEntryValue | null): number | null {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
}
function date(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/* ---------------- recipes ---------------- */

function recipeValues(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return { error: "Name is required." } as const;
  const method = str(formData.get("method")) ?? "extract";
  if (!["extract", "partial_mash", "all_grain"].includes(method)) {
    return { error: "Invalid method." } as const;
  }
  const status = str(formData.get("status")) ?? "want_to_brew";
  if (!["idea", "want_to_brew"].includes(status)) {
    return { error: "Invalid status." } as const;
  }
  return {
    values: {
      name,
      style: str(formData.get("style")),
      method: method as "extract" | "partial_mash" | "all_grain",
      status: status as "idea" | "want_to_brew",
      targetVolumeGal: num(formData.get("targetVolumeGal")),
      targetOG: num(formData.get("targetOG")),
      targetFG: num(formData.get("targetFG")),
      targetIBU: num(formData.get("targetIBU")),
      targetSRM: num(formData.get("targetSRM")),
      targetABV: num(formData.get("targetABV")),
      boilMinutes: int(formData.get("boilMinutes")),
      notes: str(formData.get("notes")),
    },
  } as const;
}

export async function createRecipe(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const parsed = recipeValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const inserted = await db
    .insert(recipes)
    .values({ userId: user.id, ...parsed.values })
    .returning({ id: recipes.id });
  revalidatePath("/recipes");
  redirect(`/recipes/${inserted[0].id}`);
}

export async function updateRecipe(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id == null) return { error: "Missing id." };
  if (!ownedRecipe(id, user.id)) return { error: "Unknown recipe." };
  // Brewed recipes are history: batches were made from this spec, so only
  // notes stay editable. Everything else changes on a duplicate.
  if (recipeIsBrewed(id)) {
    await db
      .update(recipes)
      .set({ notes: str(formData.get("notes")) })
      .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)));
    revalidatePath("/recipes");
    redirect(`/recipes/${id}`);
  }
  const parsed = recipeValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  await db
    .update(recipes)
    .set(parsed.values)
    .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)));
  revalidatePath("/recipes");
  redirect(`/recipes/${id}`);
}

export async function deleteRecipe(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id == null) return;
  await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)));
  revalidatePath("/recipes");
  redirect("/recipes");
}

function ownedRecipe(id: string, userId: string) {
  return db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .all()[0];
}

/** A brewed recipe's spec is history: batches were made from it, so the
    ingredient bill locks. Tweaks happen on a duplicate. */
function recipeIsBrewed(recipeId: string): boolean {
  return (
    db
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.recipeId, recipeId))
      .all().length > 0
  );
}

/** Copy a recipe + its ingredient bill so a brewed spec can be tweaked
    without rewriting history. Lands on the copy's edit page for renaming. */
export async function duplicateRecipe(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id == null) return;
  const source = ownedRecipe(id, user.id);
  if (!source) return;
  const items = db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, source.id))
    .all();
  const inserted = await db
    .insert(recipes)
    .values({
      userId: user.id,
      name: `${source.name} (my version)`,
      style: source.style,
      status: "want_to_brew",
      method: source.method,
      targetVolumeGal: source.targetVolumeGal,
      targetOG: source.targetOG,
      targetFG: source.targetFG,
      targetIBU: source.targetIBU,
      targetSRM: source.targetSRM,
      targetABV: source.targetABV,
      boilMinutes: source.boilMinutes,
      notes: source.notes,
    })
    .returning({ id: recipes.id });
  const newId = inserted[0].id;
  for (const it of items) {
    await db.insert(recipeItems).values({
      recipeId: newId,
      ingredientType: it.ingredientType,
      name: it.name,
      amount: it.amount,
      unit: it.unit,
      timingMinutes: it.timingMinutes,
      stage: it.stage,
      sortOrder: it.sortOrder,
    });
  }
  revalidatePath("/recipes");
  redirect(`/recipes/${newId}/edit`);
}

/** "I want to brew a Caffrey's clone" → top 3 candidate recipes. Nothing is
    saved; the user adopts one (or none) from the results. */
export async function lookupRecipes(
  _prev: RecipeLookupState,
  formData: FormData
): Promise<RecipeLookupState> {
  const user = await requireUser();
  const query = str(formData.get("query"));
  if (!query) return { error: "Describe the beer first, e.g. \"Caffrey's clone\"." };
  if (!userHasAiAccess(user)) {
    return { error: "No AI access: add your Anthropic key in My settings." };
  }
  // Ingredients are buyable; equipment decides brewability, so the model
  // judges each candidate against what the brewer actually owns.
  const gear = db
    .select({ name: equipment.name, category: equipment.category })
    .from(equipment)
    .where(and(eq(equipment.userId, user.id), eq(equipment.status, "active")))
    .all()
    .map((g) => `${g.name} (${g.category})`);
  // Set when the lookup runs FROM a recipe page ("fill in this spec").
  const recipeId = str(formData.get("recipeId"));
  if (recipeId != null && !ownedRecipe(recipeId, user.id)) {
    return { error: "Unknown recipe." };
  }
  try {
    const suggestions = await suggestRecipes(aiRuntime(user, "recipe-lookup"), query, gear);
    // Keep every lookup: revisitable later without asking Claude again.
    const saved = await db
      .insert(recipeLookups)
      .values({
        userId: user.id,
        recipeId,
        query,
        suggestionsJson: JSON.stringify(suggestions),
      })
      .returning({ id: recipeLookups.id });
    revalidatePath("/recipes/new");
    if (recipeId != null) revalidatePath(`/recipes/${recipeId}`);
    return { suggestions, lookupId: saved[0].id };
  } catch (e) {
    console.error("[recipe-lookup] failed:", e);
    return { error: `Lookup failed: ${e instanceof Error ? e.message : "unknown error"}` };
  }
}

/** Apply a suggestion to an EXISTING unbrewed recipe: fill targets/method/
    boil, append the provenance notes, and replace the ingredient bill. The
    recipe keeps its own name and status. */
export async function applySuggestionToRecipe(formData: FormData): Promise<void> {
  const user = await requireUser();
  const recipeId = str(formData.get("recipeId"));
  const raw = str(formData.get("suggestion"));
  if (recipeId == null || raw == null) return;
  const recipe = ownedRecipe(recipeId, user.id);
  if (!recipe) return;
  if (recipeIsBrewed(recipeId)) return; // brewed specs are history
  let s: SuggestedRecipe;
  try {
    s = JSON.parse(raw) as SuggestedRecipe;
  } catch {
    return;
  }
  const ratingLine = s.ratings
    ? `Clone ratings: fidelity ${s.ratings.fidelity}/5${s.ratings.fidelityWhy ? ` (${s.ratings.fidelityWhy})` : ""}; brew-day simplicity ${s.ratings.simplicity}/5; source: ${s.ratings.source}${s.ratings.sourceName ? ` (${s.ratings.sourceName})` : ""}.`
    : null;
  const equipLine = s.equipment
    ? s.equipment.notes ??
      (!s.equipment.ready && s.equipment.missing?.length
        ? `Needs gear: ${s.equipment.missing.join(", ")}.`
        : null)
    : null;
  await consumeLookup(formData, user.id);
  await db
    .update(recipes)
    .set({
      // The suggestion's name wins: "Pete's Wicked Clone (True to Tap)"
      // says which take was chosen better than the original placeholder.
      name: String(s.name ?? recipe.name).slice(0, 200),
      style: recipe.style ?? s.style ?? null,
      method: ["extract", "partial_mash", "all_grain"].includes(s.method)
        ? s.method
        : recipe.method,
      targetVolumeGal: s.targetVolumeGal ?? recipe.targetVolumeGal,
      targetOG: s.targetOG,
      targetFG: s.targetFG,
      targetIBU: s.targetIBU,
      targetSRM: s.targetSRM,
      targetABV: s.targetABV,
      boilMinutes: s.boilMinutes ?? recipe.boilMinutes,
      notes: [recipe.notes, s.notes, ratingLine, equipLine].filter(Boolean).join("\n"),
    })
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, user.id)));
  // Replace the bill wholesale: the recipe is unbrewed and the user chose
  // this spec deliberately.
  await db.delete(recipeItems).where(eq(recipeItems.recipeId, recipeId));
  const items = Array.isArray(s.items) ? s.items.slice(0, 30) : [];
  for (const [idx, it] of items.entries()) {
    const type = stockTypes.includes(it.ingredientType) ? it.ingredientType : "adjunct";
    await db.insert(recipeItems).values({
      recipeId,
      ingredientType: type,
      name: String(it.name ?? "Ingredient").slice(0, 200),
      amount: typeof it.amount === "number" && Number.isFinite(it.amount) ? it.amount : null,
      unit: String(it.unit ?? "oz").slice(0, 10),
      timingMinutes:
        typeof it.timingMinutes === "number" && Number.isFinite(it.timingMinutes)
          ? Math.trunc(it.timingMinutes)
          : null,
      stage: it.stage ? String(it.stage).slice(0, 20) : null,
      sortOrder: idx,
    });
  }
  revalidatePath("/recipes");
  redirect(`/recipes/${recipeId}`);
}

/** Using a suggestion consumes ONLY that card: its siblings stay in Past
    lookups. The row disappears when the last candidate is spent. */
async function consumeLookup(formData: FormData, userId: string) {
  const lookupId = str(formData.get("lookupId"));
  if (lookupId == null) return;
  const row = db
    .select()
    .from(recipeLookups)
    .where(and(eq(recipeLookups.id, lookupId), eq(recipeLookups.userId, userId)))
    .all()[0];
  if (!row) return;
  let usedName: string | null = null;
  try {
    usedName = (JSON.parse(str(formData.get("suggestion")) ?? "") as SuggestedRecipe).name ?? null;
  } catch {}
  let remaining: SuggestedRecipe[] = [];
  try {
    const all = JSON.parse(row.suggestionsJson) as SuggestedRecipe[];
    remaining = usedName == null ? [] : all.filter((s) => s.name !== usedName);
  } catch {}
  if (remaining.length === 0) {
    await db.delete(recipeLookups).where(eq(recipeLookups.id, row.id));
  } else {
    await db
      .update(recipeLookups)
      .set({ suggestionsJson: JSON.stringify(remaining) })
      .where(eq(recipeLookups.id, row.id));
  }
  revalidatePath("/recipes/new");
}

/** Adopt one suggestion: create the recipe + its ingredient bill, land on it. */
export async function adoptSuggestedRecipe(formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = str(formData.get("suggestion"));
  if (!raw) return;
  let s: SuggestedRecipe;
  try {
    s = JSON.parse(raw) as SuggestedRecipe;
  } catch {
    return;
  }
  if (!s?.name) return;
  await consumeLookup(formData, user.id);
  // The ratings and equipment verdict ride along in the notes so they
  // survive past the lookup screen.
  const ratingLine = s.ratings
    ? `Clone ratings: fidelity ${s.ratings.fidelity}/5${s.ratings.fidelityWhy ? ` (${s.ratings.fidelityWhy})` : ""}; brew-day simplicity ${s.ratings.simplicity}/5; source: ${s.ratings.source}${s.ratings.sourceName ? ` (${s.ratings.sourceName})` : ""}.`
    : null;
  const equipLine = s.equipment
    ? s.equipment.notes ??
      (!s.equipment.ready && s.equipment.missing?.length
        ? `Needs gear: ${s.equipment.missing.join(", ")}.`
        : null)
    : null;
  const inserted = await db
    .insert(recipes)
    .values({
      userId: user.id,
      name: String(s.name).slice(0, 200),
      style: s.style ?? null,
      status: "want_to_brew",
      method: ["extract", "partial_mash", "all_grain"].includes(s.method)
        ? s.method
        : "extract",
      targetVolumeGal: s.targetVolumeGal,
      targetOG: s.targetOG,
      targetFG: s.targetFG,
      targetIBU: s.targetIBU,
      targetSRM: s.targetSRM,
      targetABV: s.targetABV,
      boilMinutes: s.boilMinutes,
      notes: [s.notes, ratingLine, equipLine].filter(Boolean).join("\n"),
    })
    .returning({ id: recipes.id });
  const recipeId = inserted[0].id;
  const items = Array.isArray(s.items) ? s.items.slice(0, 30) : [];
  for (const [idx, it] of items.entries()) {
    const type = stockTypes.includes(it.ingredientType) ? it.ingredientType : "adjunct";
    await db.insert(recipeItems).values({
      recipeId,
      ingredientType: type,
      name: String(it.name ?? "Ingredient").slice(0, 200),
      amount: typeof it.amount === "number" && Number.isFinite(it.amount) ? it.amount : null,
      unit: String(it.unit ?? "oz").slice(0, 10),
      timingMinutes:
        typeof it.timingMinutes === "number" && Number.isFinite(it.timingMinutes)
          ? Math.trunc(it.timingMinutes)
          : null,
      stage: it.stage ? String(it.stage).slice(0, 20) : null,
      sortOrder: idx,
    });
  }
  revalidatePath("/recipes");
  redirect(`/recipes/${recipeId}`);
}

export async function addRecipeItem(formData: FormData): Promise<void> {
  const user = await requireUser();
  const recipeId = str(formData.get("recipeId"));
  const name = str(formData.get("name"));
  const type = str(formData.get("ingredientType")) as StockType | null;
  if (recipeId == null || !name || !type || !stockTypes.includes(type)) return;
  if (!ownedRecipe(recipeId, user.id)) return;
  if (recipeIsBrewed(recipeId)) return;
  const count = db
    .select({ id: recipeItems.id })
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, recipeId))
    .all().length;
  await db.insert(recipeItems).values({
    recipeId,
    ingredientType: type,
    name,
    amount: num(formData.get("amount")),
    unit: str(formData.get("unit")) ?? "oz",
    timingMinutes: int(formData.get("timingMinutes")),
    stage: str(formData.get("stage")),
    sortOrder: count,
  });
  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipeItem(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const recipeId = str(formData.get("recipeId"));
  if (id == null || recipeId == null) return;
  if (!ownedRecipe(recipeId, user.id)) return;
  if (recipeIsBrewed(recipeId)) return;
  await db
    .delete(recipeItems)
    .where(and(eq(recipeItems.id, id), eq(recipeItems.recipeId, recipeId)));
  revalidatePath(`/recipes/${recipeId}`);
}

export async function importBeerXmlAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a BeerXML (.xml) file." };
  }
  if (file.size > 2 * 1024 * 1024) return { error: "File too large." };
  let recipeId: string;
  try {
    const parsed = parseBeerXml(await file.text());
    const inserted = await db
      .insert(recipes)
      .values({
        userId: user.id,
        name: parsed.name,
        style: parsed.style,
        method: parsed.method,
        status: "want_to_brew",
        targetVolumeGal: parsed.targetVolumeGal,
        targetOG: parsed.targetOG,
        targetFG: parsed.targetFG,
        targetIBU: parsed.targetIBU,
        boilMinutes: parsed.boilMinutes,
        notes: parsed.notes,
      })
      .returning({ id: recipes.id });
    recipeId = inserted[0].id;
    for (const [idx, item] of parsed.items.entries()) {
      await db.insert(recipeItems).values({ recipeId, sortOrder: idx, ...item });
    }
  } catch (e) {
    return {
      error: `Import failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
  revalidatePath("/recipes");
  redirect(`/recipes/${recipeId}`);
}

/* ---------------- batches ---------------- */

const EST_FIELDS = [
  "preBoilVolumeGal",
  "postBoilVolumeGal",
  "intoFermenterGal",
  "og",
  "fg",
  "pitchTempF",
] as const;

function batchValues(formData: FormData, userId: string) {
  const recipeId = str(formData.get("recipeId"));
  const recipe = recipeId != null ? ownedRecipe(recipeId, userId) : undefined;
  const recipeName = recipe?.name ?? str(formData.get("recipeName"));
  if (!recipeName) return { error: "Pick a recipe." } as const;
  const status = str(formData.get("status")) ?? "planned";
  if (!batchStatuses.includes(status as (typeof batchStatuses)[number])) {
    return { error: "Invalid status." } as const;
  }
  const method = str(formData.get("method")) ?? "extract";
  if (!["extract", "partial_mash", "all_grain"].includes(method)) {
    return { error: "Invalid method." } as const;
  }
  const estimated = EST_FIELDS.filter((f) => formData.get(`est_${f}`) === "on");
  return {
    values: {
      recipeId: recipe?.id ?? null,
      recipeName,
      batchNumber: int(formData.get("batchNumber")) ?? 1,
      brewDate: date(formData.get("brewDate")),
      method: method as "extract" | "partial_mash" | "all_grain",
      status: status as (typeof batchStatuses)[number],
      kettleId: str(formData.get("kettleId")),
      fermenterId: str(formData.get("fermenterId")),
      preBoilVolumeGal: num(formData.get("preBoilVolumeGal")),
      postBoilVolumeGal: num(formData.get("postBoilVolumeGal")),
      intoFermenterGal: num(formData.get("intoFermenterGal")),
      og: num(formData.get("og")),
      ogTempF: num(formData.get("ogTempF")),
      fg: num(formData.get("fg")),
      fgTempF: num(formData.get("fgTempF")),
      steepTempF: num(formData.get("steepTempF")),
      steepMinutes: num(formData.get("steepMinutes")),
      timeToBoilMinutes: num(formData.get("timeToBoilMinutes")),
      boilMinutes: num(formData.get("boilMinutes")),
      chillEndTempF: num(formData.get("chillEndTempF")),
      timeToChillMinutes: num(formData.get("timeToChillMinutes")),
      pitchTempF: num(formData.get("pitchTempF")),
      bottledDate: date(formData.get("bottledDate")),
      primingSugarOz: num(formData.get("primingSugarOz")),
      bottleCount: int(formData.get("bottleCount")),
      verdict: str(formData.get("verdict")),
      keeper: formData.get("keeper") === "on",
      estimatedFields: JSON.stringify(estimated),
      notes: str(formData.get("notes")),
      deviations: str(formData.get("deviations")),
    },
  } as const;
}

export async function createBatch(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const parsed = batchValues(formData, user.id);
  if ("error" in parsed) return { error: parsed.error };
  const inserted = await db
    .insert(batches)
    .values({ userId: user.id, ...parsed.values })
    .returning({ id: batches.id });
  revalidatePath("/batches");
  redirect(`/batches/${inserted[0].id}`);
}

export async function updateBatch(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id == null) return { error: "Missing id." };
  const parsed = batchValues(formData, user.id);
  if ("error" in parsed) return { error: parsed.error };
  await db
    .update(batches)
    .set(parsed.values)
    .where(and(eq(batches.id, id), eq(batches.userId, user.id)));
  revalidatePath("/batches");
  revalidatePath(`/batches/${id}`);
  redirect(`/batches/${id}`);
}

export async function deleteBatch(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id == null) return;
  await db
    .delete(batches)
    .where(and(eq(batches.id, id), eq(batches.userId, user.id)));
  revalidatePath("/batches");
  redirect("/batches");
}

function ownedBatch(id: string, userId: string) {
  return db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.userId, userId)))
    .all()[0];
}

export async function addGravityReading(formData: FormData): Promise<void> {
  const user = await requireUser();
  const batchId = str(formData.get("batchId"));
  const value = num(formData.get("value"));
  if (batchId == null || value == null) return;
  if (!ownedBatch(batchId, user.id)) return;
  await db.insert(gravityReadings).values({
    batchId,
    takenAt: date(formData.get("takenAt")) ?? new Date(),
    value,
    tempF: num(formData.get("tempF")),
    stage: str(formData.get("stage")),
  });
  revalidatePath(`/batches/${batchId}`);
}

export async function deleteGravityReading(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const batchId = str(formData.get("batchId"));
  if (id == null || batchId == null) return;
  if (!ownedBatch(batchId, user.id)) return;
  await db
    .delete(gravityReadings)
    .where(and(eq(gravityReadings.id, id), eq(gravityReadings.batchId, batchId)));
  revalidatePath(`/batches/${batchId}`);
}

export async function addBatchIngredient(formData: FormData): Promise<void> {
  const user = await requireUser();
  const batchId = str(formData.get("batchId"));
  const description = str(formData.get("description"));
  if (batchId == null || !description) return;
  if (!ownedBatch(batchId, user.id)) return;
  await db.insert(batchIngredients).values({
    batchId,
    ingredientId: str(formData.get("ingredientId")),
    description,
    amount: num(formData.get("amount")),
    unit: str(formData.get("unit")),
    timingMinutes: int(formData.get("timingMinutes")),
  });
  revalidatePath(`/batches/${batchId}`);
}

/** Snapshot description in the house style: name · key numbers · lot. */
function lotDescription(lot: StockItem): string {
  const parts = [lot.name];
  if (lot.type === "hop" && lot.alphaAcidPercent != null) parts.push(`${lot.alphaAcidPercent}% AA`);
  if (lot.lotNumber) parts.push(`lot ${lot.lotNumber}`);
  if (lot.type === "yeast" && lot.generation != null) parts.push(`gen ${lot.generation}`);
  return parts.join(" · ");
}

async function consumeLot(batchId: string, lot: StockItem, amount: number) {
  await db.insert(batchIngredients).values({
    batchId,
    ingredientId: lot.id,
    description: lotDescription(lot),
    amount,
    unit: lot.unit,
  });
  // Water is effectively unlimited (RO system) — snapshot it, never deduct.
  if (lot.type !== "water") {
    await db
      .update(stock)
      .set({ quantityOnHand: Math.max(0, lot.quantityOnHand - amount) })
      .where(eq(stock.id, lot.id));
  }
}

function ownedLot(lotId: string, userId: string): StockItem | undefined {
  return db
    .select()
    .from(stock)
    .where(and(eq(stock.id, lotId), eq(stock.userId, userId)))
    .all()[0];
}

/** Consume a stock lot into a batch: snapshot line + on-hand deduction.
    Deleting the snapshot line does NOT refund stock — corrections happen
    inline on the stock list, so counts track the physical world. */
export async function useStockInBatch(formData: FormData): Promise<void> {
  const user = await requireUser();
  const batchId = str(formData.get("batchId"));
  const lotId = str(formData.get("lotId"));
  const amount = num(formData.get("amount"));
  if (batchId == null || lotId == null || amount == null || amount <= 0) return;
  if (!ownedBatch(batchId, user.id)) return;
  const lot = ownedLot(lotId, user.id);
  if (!lot) return;
  await consumeLot(batchId, lot, amount);
  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/stock");
}

/** Bottling day in one submit: bottles, caps, priming sugar — each row is a
    lot pick + amount; empty rows are skipped. */
export async function useBottlingSupplies(formData: FormData): Promise<void> {
  const user = await requireUser();
  const batchId = str(formData.get("batchId"));
  if (batchId == null || !ownedBatch(batchId, user.id)) return;
  for (const key of ["bottles", "caps", "sugar"]) {
    const lotId = str(formData.get(`lot_${key}`));
    const amount = num(formData.get(`amount_${key}`));
    if (lotId == null || amount == null || amount <= 0) continue;
    const lot = ownedLot(lotId, user.id);
    if (!lot) continue;
    await consumeLot(batchId, lot, amount);
  }
  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/stock");
}

/** Mark a schedule task done (idempotent) — clears it from the login banner. */
export async function completeTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const batchId = str(formData.get("batchId"));
  const taskKey = str(formData.get("taskKey"));
  if (batchId == null || taskKey == null) return;
  if (!ownedBatch(batchId, user.id)) return;
  const existing = db
    .select({ id: taskCompletions.id })
    .from(taskCompletions)
    .where(and(eq(taskCompletions.batchId, batchId), eq(taskCompletions.taskKey, taskKey)))
    .all();
  if (existing.length === 0) {
    await db.insert(taskCompletions).values({ userId: user.id, batchId, taskKey });
  }
  // The banner lives in the (app) layout — revalidate the layout so it
  // clears on every page, not just the dashboard.
  revalidatePath("/", "layout");
}

/** Undo a mis-click on Done. */
export async function uncompleteTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const batchId = str(formData.get("batchId"));
  const taskKey = str(formData.get("taskKey"));
  if (batchId == null || taskKey == null) return;
  if (!ownedBatch(batchId, user.id)) return;
  await db
    .delete(taskCompletions)
    .where(and(eq(taskCompletions.batchId, batchId), eq(taskCompletions.taskKey, taskKey)));
  revalidatePath("/", "layout");
}

export async function deleteBatchIngredient(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const batchId = str(formData.get("batchId"));
  if (id == null || batchId == null) return;
  if (!ownedBatch(batchId, user.id)) return;
  await db
    .delete(batchIngredients)
    .where(and(eq(batchIngredients.id, id), eq(batchIngredients.batchId, batchId)));
  revalidatePath(`/batches/${batchId}`);
}
