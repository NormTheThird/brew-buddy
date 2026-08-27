import Anthropic from "@anthropic-ai/sdk";
import { ingredientTypes } from "@/lib/db/schema";

/* AI label reading: a photo of the actual packet (hop bag, yeast sachet,
   extract jug, sanitizer bottle) → the lot's real numbers. Pre-fills the
   lot form; the user reviews before saving — never silently written. */

export type LabelProposal = {
  name?: string;
  type?: string;
  manufacturer?: string;
  productCode?: string;
  lotNumber?: string;
  bestByDate?: string; // YYYY-MM-DD
  quantity?: number;
  unit?: string;
  alphaAcidPercent?: number;
  hopForm?: "pellet" | "leaf";
  ppg?: number;
  colorLovibond?: number;
  strain?: string;
  attenuationPercent?: number;
  tempRangeMinF?: number;
  tempRangeMaxF?: number;
  notes?: string;
  extractedAt: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export function isSupportedLabelType(mime: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(mime);
}

function buildPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `This is a photo of a homebrewing product's packaging/label (today is ${today}). Read everything useful for tracking this purchase lot.

Return ONLY a JSON object, no other text:
{
  "name": "product name as a brewer would say it, e.g. 'Willamette, pellet'",
  "type": one of ${JSON.stringify(ingredientTypes)},
  "manufacturer": "e.g. Fermentis",
  "productCode": "product/SKU code if printed",
  "lotNumber": "lot or batch number if printed",
  "bestByDate": "YYYY-MM-DD if printed (a month-year date means the last day of that month)",
  "quantity": 1, "unit": "oz|lb|g|kg|pk|gal",
  "alphaAcidPercent": 6.8 (hops),
  "hopForm": "pellet" | "leaf" (hops),
  "ppg": 36, "colorLovibond": 10 (fermentables, if printed),
  "strain": "US-05" (yeast),
  "attenuationPercent": 81 (yeast, if printed),
  "tempRangeMinF": 64, "tempRangeMaxF": 78 (yeast, if printed — convert °C to °F),
  "notes": "anything else lot-relevant printed on the label, one short line"
}

Rules:
- Cleaners/sanitizers/water treatment are type "chemical".
- An included case, tube, or jar is part of the product — mention it in notes, never as a separate thing.
- Read ONLY what is printed — omit any field you cannot actually see. Never guess a lot number, date, or AA%.
- Lot/batch codes are often stamped near the seam or best-by date.`;
}

export async function extractLabel(
  fileBytes: Buffer,
  mime: string
): Promise<LabelProposal> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mime as ImageType,
              data: fileBytes.toString("base64"),
            },
          },
          { type: "text", text: buildPrompt() },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to read this photo.");
  }
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in the model response.");
  const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  return {
    name: s(p.name),
    type: s(p.type),
    manufacturer: s(p.manufacturer),
    productCode: s(p.productCode),
    lotNumber: s(p.lotNumber),
    bestByDate: s(p.bestByDate),
    quantity: n(p.quantity),
    unit: s(p.unit),
    alphaAcidPercent: n(p.alphaAcidPercent),
    hopForm: p.hopForm === "pellet" || p.hopForm === "leaf" ? p.hopForm : undefined,
    ppg: n(p.ppg),
    colorLovibond: n(p.colorLovibond),
    strain: s(p.strain),
    attenuationPercent: n(p.attenuationPercent),
    tempRangeMinF: n(p.tempRangeMinF),
    tempRangeMaxF: n(p.tempRangeMaxF),
    notes: s(p.notes),
    extractedAt: new Date().toISOString(),
  };
}
