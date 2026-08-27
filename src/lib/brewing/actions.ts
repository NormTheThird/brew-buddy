"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  batches,
  batchIngredients,
  batchStatuses,
  gravityReadings,
  stock,
  stockTypes,
  recipeItems,
  recipes,
  type StockItem,
  type StockType,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { parseBeerXml } from "./beerxml";

export type FormState = { error?: string };

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

export async function addRecipeItem(formData: FormData): Promise<void> {
  const user = await requireUser();
  const recipeId = str(formData.get("recipeId"));
  const name = str(formData.get("name"));
  const type = str(formData.get("ingredientType")) as StockType | null;
  if (recipeId == null || !name || !type || !stockTypes.includes(type)) return;
  if (!ownedRecipe(recipeId, user.id)) return;
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
