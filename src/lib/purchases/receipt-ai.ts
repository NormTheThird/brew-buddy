import Anthropic from "@anthropic-ai/sdk";
import { equipmentCategories, ingredientTypes } from "@/lib/db/schema";

/* AI receipt extraction. The model proposes items; nothing is written until
   the user reviews and applies — an AI misread must never silently become
   inventory (same rule as estimates never becoming measurements). */

export type ProposedItem = {
  kind: "equipment" | "ingredient";
  name: string;
  category?: string; // equipment category guess
  type?: string; // ingredient type guess
  quantity?: number;
  unit?: string;
  cost?: number;
  specs?: string;
  partOfKit?: string; // set when this row is a component expanded from a kit
};

export type ReceiptProposal = {
  suggestedName?: string;
  vendor?: string;
  orderNumber?: string;
  purchaseDate?: string; // YYYY-MM-DD
  totalCost?: number;
  discountCode?: string; // promo/coupon code, e.g. WELCOME15
  discountAmount?: number; // dollars saved
  items: ProposedItem[];
  extractedAt: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function buildPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `This is a receipt or order confirmation for homebrewing supplies (today is ${today}). Extract the line items.

Return ONLY a JSON object as your final answer, no other text around it, with this shape:
{
  "suggestedName": "a short human name for this purchase, from its main item or kit — e.g. 'Essential Homebrew Starter Kit'",
  "vendor": "store name if visible",
  "orderNumber": "order/invoice number if visible, e.g. 5500001631510",
  "discountCode": "promo/coupon code if one was used, e.g. WELCOME15",
  "discountAmount": 14.99,
  "purchaseDate": "YYYY-MM-DD if visible",
  "totalCost": 123.45,
  "items": [
    {
      "kind": "equipment" | "ingredient",
      "name": "item name as a brewer would say it",
      "category": one of ${JSON.stringify(equipmentCategories)} (equipment only),
      "type": one of ${JSON.stringify(ingredientTypes)} (ingredients only),
      "quantity": 6, "unit": "lb" (ingredients, if stated),
      "cost": 12.34 (this line's price, if itemized),
      "specs": "short spec string (equipment, if stated)",
      "partOfKit": "kit name — only on rows expanded from a kit"
    }
  ]
}

Rules:
- kind: consumables that go into beer (malt, extract, hops, yeast, sugar, finings, chemicals like Star San) are "ingredient"; durable goods are "equipment".
- Only include real line items — skip shipping, tax, and subtotals (they belong in totalCost context, not items).
- Omit any field you cannot read. Never invent a price.
- QUANTITY IS REQUIRED on every item row: use the stated amount and unit when given; otherwise quantity 1 (unit "ct" for countable things). Never leave quantity out.
- purchaseDate: if the year is missing, infer it — receipts are from the past, so use the most recent year that puts the date at or before today.
- KITS: if a line item is a kit, bundle, or starter set, determine its contents — use web search on the vendor + kit name if you don't know them — and expand it into one row per component with the right kind/category/type and "partOfKit" set to the kit's name. Do NOT emit a row for the kit container itself, and do NOT invent per-component prices (the kit's price stays at the purchase level). If you cannot determine the contents, fall back to a single row for the kit with no partOfKit.
- KIT COMPONENT QUANTITIES: when the kit listing states counts, sizes, or amounts, capture them — ingredient components get "quantity"/"unit" (e.g. 6 lb LME, 4 oz cleaner); equipment components get counts and sizes in "specs" (e.g. "60 count" caps, "6.5 gal" bucket, "5/16 in × 4 ft" tubing) and "quantity" when it's a countable multiple. Only what the listing states — never invent numbers.
- NESTED KITS: a kit inside a kit (e.g. a recipe/ingredient kit bundled in a starter kit) also expands into its components (fermentables, hops, yeast, finings) when its contents are known, each with partOfKit set to the inner kit's name; otherwise leave it as one row.`;
}

export type ExtractOptions = {
  /** A previous read of the same receipt — the model builds on it instead of starting over. */
  previous?: ReceiptProposal;
  /** User feedback steering a rescan, e.g. "you missed the bottle capper". */
  hint?: string;
};

export async function extractReceipt(
  fileBytes: Buffer,
  mime: string,
  opts: ExtractOptions = {}
): Promise<ReceiptProposal> {
  const client = new Anthropic();

  let prompt = buildPrompt();
  if (opts.previous) {
    prompt += `\n\nA previous read of this SAME receipt produced this result:\n${JSON.stringify(
      { ...opts.previous, extractedAt: undefined }
    )}\nBuild on it: keep what is correct, fix mistakes, and add anything it missed (kit components included). Do not drop correct items.`;
  }
  if (opts.hint) {
    prompt += `\n\nUser feedback for this rescan — treat it as corrections to apply: ${opts.hint}`;
  }
  const data = fileBytes.toString("base64");
  const content: Anthropic.ContentBlockParam[] =
    mime === "text/plain"
      ? [
          {
            type: "text",
            text: `${prompt}\n\nReceipt text (pasted by the user):\n\n${fileBytes.toString("utf8")}`,
          },
        ]
      : mime === "application/pdf"
      ? [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data },
          },
          { type: "text", text: prompt },
        ]
      : [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mime as ImageType,
              data,
            },
          },
          { type: "text", text: prompt },
        ];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];
  // Receipts read once (results are logged/cached), so use the strongest
  // model at full effort — accuracy beats per-read cost here.
  let response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    // Web search lets the model look up a kit's actual contents.
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    messages,
  });

  // Server tools can pause the turn; resume until the answer is complete.
  for (let i = 0; i < 3 && response.stop_reason === "pause_turn"; i++) {
    messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages,
    });
  }

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to read this file.");
  }

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in the model response.");
  const parsed = JSON.parse(jsonMatch[0]) as Omit<ReceiptProposal, "extractedAt">;
  if (!Array.isArray(parsed.items)) {
    throw new Error("Model response had no items array.");
  }

  return {
    suggestedName:
      typeof parsed.suggestedName === "string" ? parsed.suggestedName : undefined,
    vendor: typeof parsed.vendor === "string" ? parsed.vendor : undefined,
    orderNumber:
      typeof parsed.orderNumber === "string" ? parsed.orderNumber : undefined,
    discountCode:
      typeof parsed.discountCode === "string" ? parsed.discountCode : undefined,
    discountAmount:
      typeof parsed.discountAmount === "number" ? parsed.discountAmount : undefined,
    purchaseDate:
      typeof parsed.purchaseDate === "string" ? parsed.purchaseDate : undefined,
    totalCost:
      typeof parsed.totalCost === "number" ? parsed.totalCost : undefined,
    items: parsed.items
      .filter(
        (it): it is ProposedItem =>
          it != null &&
          typeof it.name === "string" &&
          (it.kind === "equipment" || it.kind === "ingredient")
      )
      .map((it) => ({
        kind: it.kind,
        name: it.name,
        category: typeof it.category === "string" ? it.category : undefined,
        type: typeof it.type === "string" ? it.type : undefined,
        quantity: typeof it.quantity === "number" ? it.quantity : undefined,
        unit: typeof it.unit === "string" ? it.unit : undefined,
        cost: typeof it.cost === "number" ? it.cost : undefined,
        specs: typeof it.specs === "string" ? it.specs : undefined,
        partOfKit: typeof it.partOfKit === "string" ? it.partOfKit : undefined,
      })),
    extractedAt: new Date().toISOString(),
  };
}

export function isSupportedReceiptType(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime === "text/plain" ||
    (IMAGE_TYPES as readonly string[]).includes(mime)
  );
}
