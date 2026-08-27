"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  batches,
  batchIngredients,
  equipment,
  equipmentCategories,
  extractions,
  ingredients,
  ingredientTypes,
  purchases,
  type EquipmentCategory,
  type IngredientType,
} from "@/lib/db/schema";
import { notInArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import {
  combineItems,
  extractReceipt,
  hasApiKey,
  isSupportedReceiptType,
  normalizeVendor,
  type ReceiptProposal,
} from "./receipt-ai";
import { receiptsDir } from "./storage";

export type FormState = { error?: string };
export type AnalyzeState = {
  error?: string;
  proposal?: ReceiptProposal;
  /** An existing purchase this receipt appears to duplicate — user decides. */
  duplicateOf?: {
    id: number;
    name: string;
    totalCost: number | null;
    date: string | null;
    orderNumber: string | null;
  };
};

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

/* --- extraction log: the same receipt is only ever read once --- */

function receiptHash(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function loggedProposal(userId: number, hash: string): ReceiptProposal | null {
  const row = db
    .select()
    .from(extractions)
    .where(and(eq(extractions.userId, userId), eq(extractions.sha256, hash)))
    .all()[0];
  if (!row) return null;
  try {
    return JSON.parse(row.proposalJson) as ReceiptProposal;
  } catch {
    return null;
  }
}

async function logProposal(userId: number, hash: string, proposal: ReceiptProposal) {
  await db
    .delete(extractions)
    .where(and(eq(extractions.userId, userId), eq(extractions.sha256, hash)));
  await db
    .insert(extractions)
    .values({ userId, sha256: hash, proposalJson: JSON.stringify(proposal) });
}

/** Read from the log if this exact receipt was read before; otherwise call
    the AI once and log the result. */
async function extractOnce(
  userId: number,
  bytes: Buffer,
  mime: string
): Promise<ReceiptProposal> {
  const hash = receiptHash(bytes);
  const cached = loggedProposal(userId, hash);
  if (cached) return cached;
  const proposal = await extractReceipt(bytes, mime);
  await logProposal(userId, hash, proposal);
  return proposal;
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
  const user = await requireUser();
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
    const proposal = await extractOnce(user.id, bytes, mime);

    // Duplicate check: same order number, or same vendor + same total, as an
    // existing purchase. Flag it — the user decides.
    const existing = db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, user.id))
      .all();
    const dup = existing.find(
      (ep) =>
        (proposal.orderNumber &&
          ep.orderNumber &&
          ep.orderNumber === proposal.orderNumber) ||
        (proposal.totalCost != null &&
          ep.totalCost != null &&
          Math.abs(ep.totalCost - proposal.totalCost) < 0.005 &&
          proposal.vendor &&
          ep.vendor &&
          ep.vendor.toLowerCase() === proposal.vendor.toLowerCase())
    );

    return {
      proposal,
      ...(dup
        ? {
            duplicateOf: {
              id: dup.id,
              name: dup.name,
              totalCost: dup.totalCost,
              date: dup.purchaseDate
                ? dup.purchaseDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                : null,
              orderNumber: dup.orderNumber,
            },
          }
        : {}),
    };
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
  // The form pre-fills these after an AI read, so skip any already present.
  const userNotes = str(formData.get("notes"));
  const autoNotes: string[] = [];
  const addNote = (note: string, marker: string) => {
    if (!userNotes?.includes(marker)) autoNotes.push(note);
  };
  if (receiptMime === "text/plain") addNote("Receipt: pasted order text", "Receipt:");
  else if (receiptMime === "application/pdf") addNote("Receipt: uploaded PDF", "Receipt:");
  else if (receiptMime) addNote("Receipt: uploaded photo", "Receipt:");
  if (proposal?.discountCode) {
    addNote(
      `Discount code ${proposal.discountCode}${
        proposal.discountAmount != null ? ` (−$${proposal.discountAmount.toFixed(2)})` : ""
      }`,
      `Discount code ${proposal.discountCode}`
    );
  }
  const notes =
    [userNotes, autoNotes.join(" · ")].filter(Boolean).join("\n") || null;

  const inserted = await db
    .insert(purchases)
    .values({
      userId: user.id,
      name,
      vendor: ((v) => (v ? normalizeVendor(v) : null))(str(formData.get("vendor"))),
      orderNumber: str(formData.get("orderNumber")),
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
  // Items CREATED by this purchase's receipt import go with it; items that
  // existed before and were merely linked survive (FK clears the link).
  // BREW-HISTORY PROTECTION: anything a batch references — ingredient lots in
  // a batch snapshot, vessels a batch used — is never deleted, only unlinked.
  const userBatches = db
    .select({ kettleId: batches.kettleId, fermenterId: batches.fermenterId })
    .from(batches)
    .where(eq(batches.userId, user.id))
    .all();
  const usedEquipIds = [
    ...new Set(
      userBatches.flatMap((b) => [b.kettleId, b.fermenterId]).filter((v): v is number => v != null)
    ),
  ];
  const usedIngIds = [
    ...new Set(
      db
        .select({ ingredientId: batchIngredients.ingredientId })
        .from(batchIngredients)
        .innerJoin(batches, eq(batchIngredients.batchId, batches.id))
        .where(eq(batches.userId, user.id))
        .all()
        .map((r) => r.ingredientId)
        .filter((v): v is number => v != null)
    ),
  ];

  await db
    .delete(equipment)
    .where(
      and(
        eq(equipment.purchaseId, id),
        eq(equipment.createdByImport, true),
        usedEquipIds.length ? notInArray(equipment.id, usedEquipIds) : undefined
      )
    );
  await db
    .delete(ingredients)
    .where(
      and(
        eq(ingredients.purchaseId, id),
        eq(ingredients.createdByImport, true),
        usedIngIds.length ? notInArray(ingredients.id, usedIngIds) : undefined
      )
    );
  await db.delete(purchases).where(eq(purchases.id, id));
  revalidatePath("/purchases");
  revalidatePath("/equipment");
  revalidatePath("/ingredients");
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
  // Read-once: after items were imported, don't offer another read unless
  // everything imported has been removed again.
  if (p.proposalAppliedAt) {
    const linked =
      db.select({ id: equipment.id }).from(equipment).where(eq(equipment.purchaseId, p.id)).all().length +
      db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.purchaseId, p.id)).all().length;
    if (linked > 0) {
      return {
        error:
          "Items were already imported from this receipt. Remove them from the purchase first if you need a redo.",
      };
    }
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
    proposal = await extractOnce(user.id, bytes, p.receiptMime);
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

/** Rescan: re-reads the receipt WITH the previous result and the user's
    feedback so it improves instead of starting over. Updates the log. */
export async function rescanReceipt(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const id = num(formData.get("id"));
  if (id == null) return { error: "Missing purchase id." };
  const p = ownedPurchase(id, user.id);
  if (!p?.receiptPath || !p.receiptMime) {
    return { error: "This purchase has no stored receipt." };
  }
  if (!hasApiKey()) {
    return { error: "No Anthropic API key configured — add ANTHROPIC_API_KEY to .env." };
  }

  const hint = str(formData.get("hint")) ?? undefined;
  let previous: ReceiptProposal | undefined;
  if (p.proposalJson) {
    try {
      previous = JSON.parse(p.proposalJson) as ReceiptProposal;
    } catch {}
  }

  try {
    const bytes = fs.readFileSync(path.join(RECEIPTS_DIR, p.receiptPath));
    const proposal = await extractReceipt(bytes, p.receiptMime, { previous, hint });
    await logProposal(user.id, receiptHash(bytes), proposal);
    await db
      .update(purchases)
      .set({ proposalJson: JSON.stringify(proposal) })
      .where(eq(purchases.id, id));
  } catch (e) {
    return {
      error: `Rescan failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
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
    // User-corrected quantity from the review table; at least 1 always.
    const editedQty = num(formData.get(`qty_${idx}`));
    const qty = editedQty ?? item.quantity ?? 1;

    // User confirmed this line IS an item they added manually: update that
    // row (price + provenance) instead of creating a duplicate. Kit
    // components never go through this — they always create fresh rows.
    const sameVal = str(formData.get(`same_${idx}`));
    if (!item.partOfKit && sameVal && sameVal !== "new") {
      const existingId = Number(sameVal);
      if (Number.isInteger(existingId)) {
        // The receipt becomes the source of truth: name and details update,
        // but hand-entered specs/notes the receipt doesn't know are kept.
        const patch = {
          name: item.name,
          ...(item.cost != null ? { cost: item.cost } : {}),
          purchaseId: p.id,
          ...(p.purchaseDate ? { purchaseDate: p.purchaseDate } : {}),
        };
        if (item.kind === "equipment") {
          const existing = db
            .select()
            .from(equipment)
            .where(and(eq(equipment.id, existingId), eq(equipment.userId, user.id)))
            .all()[0];
          if (existing) {
            const mergedSpecs =
              [item.specs, existing.specs]
                .filter((s): s is string => Boolean(s))
                .filter((s, i, arr) => arr.findIndex((o) => o.toLowerCase() === s.toLowerCase()) === i)
                .join(" · ") || null;
            await db
              .update(equipment)
              .set({ ...patch, specs: mergedSpecs })
              .where(eq(equipment.id, existing.id));
          }
        } else {
          const existing = db
            .select()
            .from(ingredients)
            .where(and(eq(ingredients.id, existingId), eq(ingredients.userId, user.id)))
            .all()[0];
          if (existing) {
            await db
              .update(ingredients)
              .set({
                ...patch,
                ...(existing.quantity == null && item.quantity != null
                  ? { quantity: qty, quantityOnHand: qty, unit: item.unit ?? existing.unit }
                  : {}),
              })
              .where(eq(ingredients.id, existing.id));
          }
        }
        continue;
      }
    }

    if (item.kind === "equipment") {
      const category = equipmentCategories.includes(item.category as EquipmentCategory)
        ? (item.category as EquipmentCategory)
        : "other";
      // Countable equipment (caps, bottles) keeps its count in specs.
      const qtyNote = `${qty}${item.unit ? ` ${item.unit}` : qty > 1 ? " count" : ""}`;
      const specs =
        [item.specs, qty > 1 && !(item.specs ?? "").includes(qtyNote) ? qtyNote : null]
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
        createdByImport: true,
      });
    } else {
      const type = ingredientTypes.includes(item.type as IngredientType)
        ? (item.type as IngredientType)
        : "adjunct";
      await db.insert(ingredients).values({
        userId: user.id,
        type,
        name: item.name,
        vendor: p.vendor,
        quantity: qty,
        quantityOnHand: qty,
        unit: item.unit ?? "ct",
        cost: item.cost ?? null,
        purchaseDate: p.purchaseDate,
        purchaseId: p.id,
        createdByImport: true,
      });
    }
  }

  await db
    .update(purchases)
    .set({ proposalJson: null, proposalAppliedAt: new Date() })
    .where(eq(purchases.id, id));
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/equipment");
  revalidatePath("/ingredients");
  redirect(`/purchases/${id}`);
}

/** Combine user-selected proposal rows into one item (AI names it, costs
    sum). Edits the pending draft only — nothing is written until Apply. */
export async function combineProposalItems(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = num(formData.get("id"));
  if (id == null) return;
  const p = ownedPurchase(id, user.id);
  if (!p?.proposalJson || !hasApiKey()) return;
  const indexes = formData
    .getAll("combine")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));
  if (indexes.length < 2) return;

  const proposal = JSON.parse(p.proposalJson) as ReceiptProposal;
  const selected = indexes.map((i) => proposal.items[i]).filter(Boolean);
  if (selected.length < 2) return;

  try {
    const combined = await combineItems(selected);
    const first = Math.min(...indexes);
    const items = proposal.items.filter((_, i) => !indexes.includes(i));
    items.splice(Math.min(first, items.length), 0, combined);
    const updated: ReceiptProposal = { ...proposal, items };
    await db
      .update(purchases)
      .set({ proposalJson: JSON.stringify(updated) })
      .where(eq(purchases.id, id));
    // Keep the extraction log in step with the curated result.
    if (p.receiptPath) {
      try {
        const bytes = fs.readFileSync(path.join(RECEIPTS_DIR, p.receiptPath));
        await logProposal(user.id, receiptHash(bytes), updated);
      } catch {}
    }
  } catch {}
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}`);
}

/** Removes one imported item (equipment or ingredient row) from a purchase —
    the after-the-fact fix for a bad apply. Deletes the row itself. */
export async function removePurchaseItem(formData: FormData): Promise<void> {
  const user = await requireUser();
  const purchaseId = num(formData.get("purchaseId"));
  const itemId = num(formData.get("itemId"));
  const kind = str(formData.get("kind"));
  if (purchaseId == null || itemId == null) return;
  if (!ownedPurchase(purchaseId, user.id)) return;
  if (kind === "equipment") {
    await db
      .delete(equipment)
      .where(and(eq(equipment.id, itemId), eq(equipment.userId, user.id), eq(equipment.purchaseId, purchaseId)));
    revalidatePath("/equipment");
  } else if (kind === "ingredient") {
    await db
      .delete(ingredients)
      .where(and(eq(ingredients.id, itemId), eq(ingredients.userId, user.id), eq(ingredients.purchaseId, purchaseId)));
    revalidatePath("/ingredients");
  }
  revalidatePath(`/purchases/${purchaseId}`);
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
