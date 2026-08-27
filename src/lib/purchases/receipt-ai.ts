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
};

export type ReceiptProposal = {
  suggestedName?: string;
  vendor?: string;
  purchaseDate?: string; // YYYY-MM-DD
  totalCost?: number;
  items: ProposedItem[];
  extractedAt: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const PROMPT = `This is a receipt or order confirmation for homebrewing supplies. Extract the line items.

Return ONLY a JSON object, no other text, with this shape:
{
  "suggestedName": "a short human name for this purchase, from its main item or kit — e.g. 'Essential Homebrew Starter Kit'",
  "vendor": "store name if visible",
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
      "specs": "short spec string (equipment, if stated)"
    }
  ]
}

Rules:
- kind: consumables that go into beer (malt, extract, hops, yeast, sugar, finings, chemicals like Star San) are "ingredient"; durable goods are "equipment".
- Only include real line items — skip shipping, tax, and subtotals (they belong in totalCost context, not items).
- Omit any field you cannot read. Never invent a price or quantity.
- If the year is not shown, omit purchaseDate entirely — never guess a year.`;

export async function extractReceipt(
  fileBytes: Buffer,
  mime: string
): Promise<ReceiptProposal> {
  const client = new Anthropic();

  const data = fileBytes.toString("base64");
  const content: Anthropic.ContentBlockParam[] =
    mime === "text/plain"
      ? [
          {
            type: "text",
            text: `${PROMPT}\n\nReceipt text (pasted by the user):\n\n${fileBytes.toString("utf8")}`,
          },
        ]
      : mime === "application/pdf"
      ? [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data },
          },
          { type: "text", text: PROMPT },
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
          { type: "text", text: PROMPT },
        ];

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    messages: [{ role: "user", content }],
  });

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
