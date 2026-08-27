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
  notBrewing?: boolean; // clearly unrelated to brewing — unchecked by default
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

/** Bump whenever the extraction rules change — cached reads from older rule
    versions are then ignored instead of serving stale results. */
export const EXTRACTION_RULES_VERSION = "2";

/** "Amazon.com" / "Amazon (Hobby Homebrew)" → "Amazon" — one canonical name
    per retailer, whatever the receipt says. */
export function normalizeVendor(v: string): string {
  let s = v
    .replace(/\s*\([^)]*\)\s*/g, " ") // drop marketplace-seller parentheticals
    .replace(/\.(com|net|org|co)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/amazon/i.test(s)) s = "Amazon";
  if (/northern\s*brewer/i.test(s)) s = "Northern Brewer";
  return s;
}

function buildPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `This is a receipt or order confirmation for homebrewing supplies (today is ${today}). Extract the line items.

Return ONLY a JSON object as your final answer, no other text around it, with this shape:
{
  "suggestedName": "a short human name for this purchase, from its main item or kit — e.g. 'Essential Homebrew Starter Kit'",
  "vendor": "the retailer's plain canonical name — 'Amazon' (never 'Amazon.com' or 'Amazon (Seller)'), 'Northern Brewer'; a marketplace seller goes in notes-worthy info, not vendor",
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
      "partOfKit": "kit name — only on rows expanded from a kit",
      "notBrewing": true — only on items clearly unrelated to brewing (clothing, sunglasses, household goods)
    }
  ]
}

Rules:
- kind: consumables that go into beer (malt, extract, hops, yeast, sugar, finings, chemicals like Star San) are "ingredient"; durable goods are "equipment".
- MIXED ORDERS: include non-brewing items (sunglasses, clothing, household goods) as rows so the totals reconcile, but set "notBrewing": true on them — the app leaves them unchecked for import.
- AIRLOCKS ARE ALWAYS THEIR OWN EQUIPMENT ROW — they move between vessels and get replaced independently. A vessel's attached lid, spigot, or gasket folds into the vessel ("fermenter bucket with gasketed lid & spigot"); the airlock does not.
- COUNTABLE CONSUMABLES — bottle caps, corks, muslin/hop bags, filters — are kind "ingredient" with type "supply" and a real quantity (e.g. 60 ct caps). NEVER fold a consumable into the tool that uses it: caps and capper are separate rows.
- INCLUDED ACCESSORIES ARE NOT SEPARATE ITEMS: a case, sleeve, stand, storage tube, lid, spigot, or test jar that comes WITH a product is part of that product — one row, e.g. "Hydrometer with case and test jar", with the accessory noted in the name or specs. Never emit the accessory as its own row.
- Only include real line items — skip shipping, tax, and subtotals (they belong in totalCost context, not items).
- Omit any field you cannot read. Never invent a price.
- QUANTITY IS REQUIRED on every item row: use the stated amount and unit when given; otherwise quantity 1 (unit "ct" for countable things). Never leave quantity out.
- purchaseDate: if the year is missing, infer it — receipts are from the past, so use the most recent year that puts the date at or before today.
- KITS vs ACCESSORY BUNDLES — decide first: expand a kit ONLY when it contains multiple INDEPENDENT products a brewer would use separately (fermenter + bottling bucket + capper…). A bundle where everything serves ONE main product — e.g. a hydrometer "test kit" (hydrometer + test jar + storage case + jar brush), a tool with its case/stand — is ONE row named for the main product with the accessories in the name or specs ("Triple scale hydrometer with test jar, storage case & brush"). Never split those.
- KITS: if a line item is a true kit or starter set (multiple independent products), determine its contents — use web search on the vendor + kit name if you don't know them — and expand it into one row per component with the right kind/category/type and "partOfKit" set to the kit's name. Do NOT emit a row for the kit container itself, and do NOT invent per-component prices (the kit's price stays at the purchase level). If you cannot determine the contents, fall back to a single row for the kit with no partOfKit.
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
    vendor:
      typeof parsed.vendor === "string" ? normalizeVendor(parsed.vendor) : undefined,
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
        notBrewing: it.notBrewing === true ? true : undefined,
      })),
    extractedAt: new Date().toISOString(),
  };
}

/** Merge user-selected proposal rows into one item: AI names it, costs sum. */
export async function combineItems(items: ProposedItem[]): Promise<ProposedItem> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1000,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: `These purchased items belong together as ONE product (e.g. a tool and its case/accessories). Combine them into a single inventory row.

Items:
${items.map((i) => `- ${i.name}${i.specs ? ` (${i.specs})` : ""} [${i.kind}${i.category ? `/${i.category}` : i.type ? `/${i.type}` : ""}]`).join("\n")}

Return ONLY JSON: {"name": "combined name, main product first with accessories after — e.g. 'Triple scale hydrometer with test jar & case'", "kind": "equipment"|"ingredient", "category": equipment category of the MAIN product, "type": ingredient type if kind is ingredient, "specs": "merged short specs or omit"}`,
      },
    ],
  });
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in combine response.");
  const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  const costs = items.map((i) => i.cost).filter((c): c is number => c != null);
  const kits = new Set(items.map((i) => i.partOfKit ?? ""));
  return {
    kind: p.kind === "ingredient" ? "ingredient" : "equipment",
    name: typeof p.name === "string" && p.name ? p.name : items.map((i) => i.name).join(" + "),
    category: typeof p.category === "string" ? p.category : items[0].category,
    type: typeof p.type === "string" ? p.type : items[0].type,
    specs: typeof p.specs === "string" ? p.specs : undefined,
    quantity: 1,
    unit: "ct",
    cost: costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) * 100) / 100 : undefined,
    partOfKit: kits.size === 1 && items[0].partOfKit ? items[0].partOfKit : undefined,
  };
}

export function isSupportedReceiptType(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime === "text/plain" ||
    (IMAGE_TYPES as readonly string[]).includes(mime)
  );
}
