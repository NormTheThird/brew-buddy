"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  equipment,
  equipmentCategories,
  ingredients,
  ingredientTypes,
  purchases,
  type EquipmentCategory,
  type IngredientType,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export type FormState = { error?: string };

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

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
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

/** null when unset; rejects a purchase the user doesn't own. */
function ownedPurchaseId(
  v: FormDataEntryValue | null,
  userId: number
): number | null | { error: string } {
  const id = int(v);
  if (id == null) return null;
  const owned = db
    .select({ id: purchases.id })
    .from(purchases)
    .where(and(eq(purchases.id, id), eq(purchases.userId, userId)))
    .all()[0];
  return owned ? id : { error: "Unknown purchase." };
}

/* ---------------- equipment ---------------- */

function equipmentValues(formData: FormData) {
  const name = str(formData.get("name"));
  const category = str(formData.get("category")) as EquipmentCategory | null;
  if (!name) return { error: "Name is required." } as const;
  if (!category || !equipmentCategories.includes(category)) {
    return { error: "Pick a category." } as const;
  }
  const status = str(formData.get("status")) ?? "active";
  if (!["active", "wanted", "retired"].includes(status)) {
    return { error: "Invalid status." } as const;
  }
  return {
    values: {
      name,
      category,
      status: status as "active" | "wanted" | "retired",
      specs: str(formData.get("specs")),
      flag: str(formData.get("flag")),
      purchaseDate: date(formData.get("purchaseDate")),
      cost: num(formData.get("cost")),
      notes: str(formData.get("notes")),
    },
  } as const;
}

export async function createEquipment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const parsed = equipmentValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const purchaseId = ownedPurchaseId(formData.get("purchaseId"), user.id);
  if (purchaseId != null && typeof purchaseId === "object") return purchaseId;
  await db
    .insert(equipment)
    .values({ userId: user.id, purchaseId, ...parsed.values });
  revalidatePath("/equipment");
  redirect("/equipment");
}

export async function updateEquipment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = int(formData.get("id"));
  if (id == null) return { error: "Missing id." };
  const parsed = equipmentValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const purchaseId = ownedPurchaseId(formData.get("purchaseId"), user.id);
  if (purchaseId != null && typeof purchaseId === "object") return purchaseId;
  await db
    .update(equipment)
    .set({ ...parsed.values, purchaseId })
    .where(and(eq(equipment.id, id), eq(equipment.userId, user.id)));
  revalidatePath("/equipment");
  redirect("/equipment");
}

export async function deleteEquipment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = int(formData.get("id"));
  if (id == null) return;
  await db
    .delete(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.userId, user.id)));
  revalidatePath("/equipment");
  redirect("/equipment");
}

/* ---------------- ingredient lots ---------------- */

function ingredientValues(formData: FormData) {
  const name = str(formData.get("name"));
  const type = str(formData.get("type")) as IngredientType | null;
  if (!name) return { error: "Name is required." } as const;
  if (!type || !ingredientTypes.includes(type)) {
    return { error: "Pick a type." } as const;
  }
  const hopForm = str(formData.get("hopForm"));
  if (hopForm && !["pellet", "leaf"].includes(hopForm)) {
    return { error: "Invalid hop form." } as const;
  }
  return {
    values: {
      type,
      name,
      vendor: str(formData.get("vendor")),
      lotNumber: str(formData.get("lotNumber")),
      quantity: num(formData.get("quantity")),
      quantityOnHand: num(formData.get("quantityOnHand")) ?? 0,
      unit: str(formData.get("unit")) ?? "oz",
      cost: num(formData.get("cost")),
      purchaseDate: date(formData.get("purchaseDate")),
      bestByDate: date(formData.get("bestByDate")),
      alphaAcidPercent: num(formData.get("alphaAcidPercent")),
      hopForm: (hopForm as "pellet" | "leaf" | null) ?? null,
      ppg: num(formData.get("ppg")),
      colorLovibond: num(formData.get("colorLovibond")),
      strain: str(formData.get("strain")),
      manufacturer: str(formData.get("manufacturer")),
      productCode: str(formData.get("productCode")),
      generation: int(formData.get("generation")),
      tempRangeMinF: num(formData.get("tempRangeMinF")),
      tempRangeMaxF: num(formData.get("tempRangeMaxF")),
      attenuationPercent: num(formData.get("attenuationPercent")),
      notes: str(formData.get("notes")),
    },
  } as const;
}

export async function createIngredient(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const parsed = ingredientValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const purchaseId = ownedPurchaseId(formData.get("purchaseId"), user.id);
  if (purchaseId != null && typeof purchaseId === "object") return purchaseId;
  await db
    .insert(ingredients)
    .values({ userId: user.id, purchaseId, ...parsed.values });
  revalidatePath("/ingredients");
  redirect("/ingredients");
}

export async function updateIngredient(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = int(formData.get("id"));
  if (id == null) return { error: "Missing id." };
  const parsed = ingredientValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const purchaseId = ownedPurchaseId(formData.get("purchaseId"), user.id);
  if (purchaseId != null && typeof purchaseId === "object") return purchaseId;
  await db
    .update(ingredients)
    .set({ ...parsed.values, purchaseId })
    .where(and(eq(ingredients.id, id), eq(ingredients.userId, user.id)));
  revalidatePath("/ingredients");
  redirect("/ingredients");
}

export async function deleteIngredient(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = int(formData.get("id"));
  if (id == null) return;
  await db
    .delete(ingredients)
    .where(and(eq(ingredients.id, id), eq(ingredients.userId, user.id)));
  revalidatePath("/ingredients");
  redirect("/ingredients");
}
