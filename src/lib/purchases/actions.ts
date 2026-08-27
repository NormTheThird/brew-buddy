"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
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
import {
  extractReceipt,
  hasApiKey,
  isSupportedReceiptType,
  type ReceiptProposal,
} from "./receipt-ai";
import { receiptsDir } from "./storage";

export type FormState = { error?: string };
export type AnalyzeState = { error?: string; proposal?: ReceiptProposal };

const RECEIPTS_DIR = receiptsDir();
const MAX_RECEIPT_BYTES = 12 * 1024 * 1024;

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

function ownedPurchase(id: number, userId: number) {
  return db
    .select()
    .from(purchases)
    .where(and(eq(purchases.id, id), eq(purchases.userId, userId)))
    .all()[0];
}

/** Reads the receipt/pasted text BEFORE the purchase exists, so the form can
    pre-fill itself. Writes nothing. */
export async function analyzeReceipt(
  _prev: AnalyzeState,
  formData: FormData
): Promise<AnalyzeState> {
  await requireUser();
  const receipt = formData.get("receipt");
  const pastedText = str(formData.get("receiptText"));
  let bytes: Buffer | null = null;
  let mime: string | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    if (!isSupportedReceiptType(receipt.type)) {
      return { error: "Receipt must be an image (JPG/PNG/WebP/GIF) or a PDF." };
    }
    if (receipt.size > MAX_RECEIPT_BYTES) {
      return { error: "Receipt file is over 12 MB — resize the photo and retry." };
    }
    bytes = Buffer.from(await receipt.arrayBuffer());
    mime = receipt.type;
  } else if (pastedText) {
    bytes = Buffer.from(pastedText, "utf8");
    mime = "text/plain";
  }
  if (!bytes || !mime) {
    return { error: "Attach a receipt or paste order text first." };
  }
  if (!hasApiKey()) {
    return { error: "No Anthropic API key configured — add ANTHROPIC_API_KEY to .env." };
  }
  try {
    return { proposal: await extractReceipt(bytes, mime) };
  } catch (e) {
    return {
      error: `Reading failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
}

export async function createPurchase(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const name = str(formData.get("name"));
  if (!name) return { error: "Name is required — e.g. 'Block Party Amber kit'." };

  const receipt = formData.get("receipt");
  const pastedText = str(formData.get("receiptText"));
  let receiptBytes: Buffer | null = null;
  let receiptMime: string | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    if (!isSupportedReceiptType(receipt.type)) {
      return { error: "Receipt must be an image (JPG/PNG/WebP/GIF) or a PDF." };
    }
    if (receipt.size > MAX_RECEIPT_BYTES) {
      return { error: "Receipt file is over 12 MB — resize the photo and retry." };
    }
    receiptBytes = Buffer.from(await receipt.arrayBuffer());
    receiptMime = receipt.type;
  } else if (pastedText) {
    // Pasted order text (email/order page) is a receipt too — same review flow.
    receiptBytes = Buffer.from(pastedText, "utf8");
    receiptMime = "text/plain";
  }

  // A proposal from the pre-create analyze step rides along so the item
  // review is waiting on the purchase page immediately.
  let proposalJson: string | null = null;
  let proposal: ReceiptProposal | null = null;
  const rawProposal = str(formData.get("proposalJson"));
  if (rawProposal) {
    try {
      const parsed = JSON.parse(rawProposal) as ReceiptProposal;
      if (Array.isArray(parsed.items)) {
        proposalJson = rawProposal;
        proposal = parsed;
      }
    } catch {}
  }

  // Auto-notes: how the receipt arrived, and any discount code it carried.
  const autoNotes: string[] = [];
  if (receiptMime === "text/plain") autoNotes.push("Receipt: pasted order text");
  else if (receiptMime === "application/pdf") autoNotes.push("Receipt: uploaded PDF");
  else if (receiptMime) autoNotes.push("Receipt: uploaded photo");
  if (proposal?.discountCode) {
    autoNotes.push(
      `Discount code ${proposal.discountCode}${
        proposal.discountAmount != null ? ` (−$${proposal.discountAmount.toFixed(2)})` : ""
      }`
    );
  }
  const userNotes = str(formData.get("notes"));
  const notes =
    [userNotes, autoNotes.join(" · ")].filter(Boolean).join("\n") || null;

  const inserted = await db
    .insert(purchases)
    .values({
      userId: user.id,
      name,
      vendor: str(formData.get("vendor")),
      purchaseDate: date(formData.get("purchaseDate")),
      totalCost: num(formData.get("totalCost")),
      proposalJson,
      notes,
    })
    .returning({ id: purchases.id });
  const id = inserted[0].id;

  if (receiptBytes && receiptMime) {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
    const ext =
      receiptMime === "application/pdf"
        ? "pdf"
        : receiptMime === "text/plain"
          ? "txt"
          : receiptMime.split("/")[1];
    const rel = `${id}.${ext}`;
    fs.writeFileSync(path.join(RECEIPTS_DIR, rel), receiptBytes);
    await db
      .update(purchases)
      .set({ receiptPath: rel, receiptMime })
      .where(eq(purchases.id, id));
  }

  revalidatePath("/purchases");
  redirect(`/purchases/${id}`);
}

export async function deletePurchase(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = num(formData.get("id"));
  if (id == null) return;
  const p = ownedPurchase(id, user.id);
  if (!p) return;
  if (p.receiptPath) {
    try {
      fs.unlinkSync(path.join(RECEIPTS_DIR, p.receiptPath));
    } catch {}
  }
  // purchaseId on items goes null via FK; the items themselves stay.
  await db.delete(purchases).where(eq(purchases.id, id));
  revalidatePath("/purchases");
  redirect("/purchases");
}

export async function runReceiptExtraction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = num(formData.get("id"));
  if (id == null) return { error: "Missing purchase id." };
  const p = ownedPurchase(id, user.id);
  if (!p) return { error: "Purchase not found." };
  if (!p.receiptPath || !p.receiptMime) {
    return { error: "This purchase has no stored receipt." };
  }
  if (!hasApiKey()) {
    return {
      error:
        "No Anthropic API key configured. Add ANTHROPIC_API_KEY=... to the .env file and restart the app.",
    };
  }

  let proposal: ReceiptProposal;
  try {
    const bytes = fs.readFileSync(path.join(RECEIPTS_DIR, p.receiptPath));
    proposal = await extractReceipt(bytes, p.receiptMime);
  } catch (e) {
    return {
      error: `Receipt reading failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }

  await db
    .update(purchases)
    .set({ proposalJson: JSON.stringify(proposal) })
    .where(eq(purchases.id, id));
  revalidatePath(`/purchases/${id}`);
  return {};
}

export async function applyProposal(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = num(formData.get("id"));
  if (id == null) return;
  const p = ownedPurchase(id, user.id);
  if (!p?.proposalJson) return;

  const proposal = JSON.parse(p.proposalJson) as ReceiptProposal;
  const accepted = formData.getAll("accept").map((v) => Number(v));

  for (const idx of accepted) {
    const item = proposal.items[idx];
    if (!item) continue;
    if (item.kind === "equipment") {
      const category = equipmentCategories.includes(item.category as EquipmentCategory)
        ? (item.category as EquipmentCategory)
        : "other";
      // Countable equipment (caps, bottles) keeps its count in specs.
      const qtyNote =
        item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : " count"}` : null;
      const specs =
        [item.specs, qtyNote && !(item.specs ?? "").includes(qtyNote) ? qtyNote : null]
          .filter(Boolean)
          .join(" · ") || null;
      await db.insert(equipment).values({
        userId: user.id,
        name: item.name,
        category,
        status: "active",
        specs,
        cost: item.cost ?? null,
        purchaseDate: p.purchaseDate,
        purchaseId: p.id,
      });
    } else {
      const type = ingredientTypes.includes(item.type as IngredientType)
        ? (item.type as IngredientType)
        : "adjunct";
      const qty = item.quantity ?? null;
      await db.insert(ingredients).values({
        userId: user.id,
        type,
        name: item.name,
        vendor: p.vendor,
        quantity: qty,
        quantityOnHand: qty ?? 0,
        unit: item.unit ?? "oz",
        cost: item.cost ?? null,
        purchaseDate: p.purchaseDate,
        purchaseId: p.id,
      });
    }
  }

  await db
    .update(purchases)
    .set({ proposalJson: null })
    .where(eq(purchases.id, id));
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/equipment");
  revalidatePath("/ingredients");
  redirect(`/purchases/${id}`);
}

export async function discardProposal(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = num(formData.get("id"));
  if (id == null) return;
  const p = ownedPurchase(id, user.id);
  if (!p) return;
  await db.update(purchases).set({ proposalJson: null }).where(eq(purchases.id, id));
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}`);
}
