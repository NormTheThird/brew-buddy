"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { extractLabel, isSupportedLabelType, type LabelProposal } from "./label-ai";
import { hasApiKey } from "@/lib/purchases/receipt-ai";
import {
  equipment,
  equipmentCategories,
  stock,
  stockTypes,
  purchases,
  type EquipmentCategory,
  type StockType,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export type FormState = { error?: string };
export type LabelAnalyzeState = { error?: string; proposal?: LabelProposal };

const LABELS_DIR = path.join(
  path.dirname(process.env.DATABASE_PATH ?? "./data/brewbuddy.db"),
  "labels"
);
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

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
  userId: string
): string | null | { error: string } {
  const id = str(v);
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
      quantity: Math.max(1, Math.round(num(formData.get("quantity")) ?? 1)),
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
  const id = str(formData.get("id"));
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
  const id = str(formData.get("id"));
  if (id == null) return;
  await db
    .delete(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.userId, user.id)));
  revalidatePath("/equipment");
  redirect("/equipment");
}

/* ---------------- ingredient lots ---------------- */

function stockItemValues(formData: FormData) {
  const name = str(formData.get("name"));
  const type = str(formData.get("type")) as StockType | null;
  if (!name) return { error: "Name is required." } as const;
  if (!type || !stockTypes.includes(type)) {
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

/** Reads a packet-label photo BEFORE the lot exists — pre-fills the form. */
export async function analyzeLabel(
  _prev: LabelAnalyzeState,
  formData: FormData
): Promise<LabelAnalyzeState> {
  await requireUser();
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choose a photo of the packet first." };
  }
  if (!isSupportedLabelType(photo.type)) {
    return { error: "Photo must be JPG/PNG/WebP/GIF." };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { error: "Photo is over 12 MB — resize and retry." };
  }
  if (!hasApiKey()) {
    return { error: "No Anthropic API key configured — add ANTHROPIC_API_KEY to .env." };
  }
  try {
    const proposal = await extractLabel(
      Buffer.from(await photo.arrayBuffer()),
      photo.type
    );
    return { proposal };
  } catch (e) {
    return {
      error: `Reading failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
}

async function storeLabelPhoto(
  formData: FormData,
  id: string,
  userId: string
): Promise<void> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return;
  if (!isSupportedLabelType(photo.type) || photo.size > MAX_PHOTO_BYTES) return;
  const owned = db
    .select({ id: stock.id })
    .from(stock)
    .where(and(eq(stock.id, id), eq(stock.userId, userId)))
    .all()[0];
  if (!owned) return;
  fs.mkdirSync(LABELS_DIR, { recursive: true });
  const ext = photo.type.split("/")[1];
  const rel = `${id}.${ext}`;
  fs.writeFileSync(
    path.join(LABELS_DIR, rel),
    Buffer.from(await photo.arrayBuffer())
  );
  await db
    .update(stock)
    .set({ photoPath: rel, photoMime: photo.type })
    .where(and(eq(stock.id, id), eq(stock.userId, userId)));
}

export async function createStockItem(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const parsed = stockItemValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const purchaseId = ownedPurchaseId(formData.get("purchaseId"), user.id);
  if (purchaseId != null && typeof purchaseId === "object") return purchaseId;
  const inserted = await db
    .insert(stock)
    .values({ userId: user.id, purchaseId, ...parsed.values })
    .returning({ id: stock.id });
  await storeLabelPhoto(formData, inserted[0].id, user.id);
  revalidatePath("/stock");
  redirect("/stock");
}

export async function updateStockItem(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id == null) return { error: "Missing id." };
  const parsed = stockItemValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const purchaseId = ownedPurchaseId(formData.get("purchaseId"), user.id);
  if (purchaseId != null && typeof purchaseId === "object") return purchaseId;
  await db
    .update(stock)
    .set({ ...parsed.values, purchaseId })
    .where(and(eq(stock.id, id), eq(stock.userId, user.id)));
  await storeLabelPhoto(formData, id, user.id);
  revalidatePath("/stock");
  redirect("/stock");
}

/** Inline on-hand correction from the stock list — for free inflows
    (returned bottles, breakage, recounts) that aren't purchases. */
export async function setOnHand(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  const qty = num(formData.get("quantityOnHand"));
  if (id == null || qty == null || qty < 0) return;
  await db
    .update(stock)
    .set({ quantityOnHand: qty })
    .where(and(eq(stock.id, id), eq(stock.userId, user.id)));
  revalidatePath("/stock");
}

export async function deleteStockItem(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData.get("id"));
  if (id == null) return;
  await db
    .delete(stock)
    .where(and(eq(stock.id, id), eq(stock.userId, user.id)));
  revalidatePath("/stock");
  redirect("/stock");
}
