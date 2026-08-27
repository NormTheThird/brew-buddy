import Anthropic from "@anthropic-ai/sdk";
import { stockTypes, type StockType } from "@/lib/db/schema";

/* AI recipe lookup: "I want to brew a Caffrey's clone" → the top 3 recipe
   candidates, each a complete spec + ingredient bill the user can adopt with
   one click. Sonnet + web search: exploratory, user-reviewed work where
   speed and cost beat maximum accuracy. */

export type SuggestedItem = {
  ingredientType: StockType;
  name: string;
  amount: number | null;
  unit: string;
  stage: string | null;
  timingMinutes: number | null;
};

export type SuggestedRecipe = {
  name: string;
  style: string | null;
  method: "extract" | "partial_mash" | "all_grain";
  targetVolumeGal: number | null;
  targetOG: number | null;
  targetFG: number | null;
  targetIBU: number | null;
  targetSRM: number | null;
  targetABV: number | null;
  boilMinutes: number | null;
  notes: string | null;
  items: SuggestedItem[];
};

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function prompt(query: string): string {
  return `You are helping a homebrewer find a recipe. Their request: "${query}"

Propose the TOP 3 candidate recipes for a 5 gallon batch. Search the web for
published recipes and the real beer's specs when this is a clone of a
commercial beer; prefer numbers from brewery data or well-regarded published
clones over guesses.

Rules:
- The brewer runs an EXTRACT setup (all-in-one kettle, steeping bag). Prefer
  extract or partial-mash versions; include an all-grain option only when
  nothing else does the beer justice.
- Every ingredient row needs a real amount and unit (lb/oz/g/pk/tsp/gal).
- stage is one of: boil, steep, mash, fermentation, bottling. Hops get
  timingMinutes (minutes left in the boil); steeping grains get steep + minutes.
- notes: 2-3 sentences on where the recipe comes from, what makes the beer
  what it is (e.g. Caffrey's: nitro-smooth Irish ale, low carbonation), and
  any technique that matters. Mention the source if one was found.
- Differentiate the three: e.g. truest-to-source, simplest-to-brew, and an
  elevated take. Give each a distinct name ("Caffrey's Clone (true to tap)").

Return ONLY JSON:
{"recipes": [{
  "name": "...", "style": "Irish Red Ale",
  "method": "extract" | "partial_mash" | "all_grain",
  "targetVolumeGal": 5, "targetOG": 1.041, "targetFG": 1.010,
  "targetIBU": 20, "targetSRM": 12, "targetABV": 3.8, "boilMinutes": 60,
  "notes": "...",
  "items": [{"ingredientType": "fermentable" | "hop" | "yeast" | "adjunct" | "water" | "chemical",
             "name": "...", "amount": 6, "unit": "lb",
             "stage": "boil", "timingMinutes": null}]
}]}`;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function suggestRecipes(query: string): Promise<SuggestedRecipe[]> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt(query) },
  ];
  // Sonnet by Trey's call: recipe hunting is exploratory and every number
  // gets reviewed before adoption, so speed/cost beat maximum accuracy here
  // (unlike receipts, which are read once and cached). Web search still on
  // so clones get published numbers instead of vibes.
  let response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 20000,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages,
  });
  for (let i = 0; i < 4 && response.stop_reason === "pause_turn"; i++) {
    messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 20000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
      messages,
    });
  }
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request.");
  }

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in the model response.");
  const parsed = JSON.parse(jsonMatch[0]) as { recipes?: unknown[] };
  if (!Array.isArray(parsed.recipes) || parsed.recipes.length === 0) {
    throw new Error("The model returned no recipes.");
  }

  return parsed.recipes.slice(0, 3).map((raw) => {
    const r = raw as Record<string, unknown>;
    const methodRaw = String(r.method ?? "extract");
    const items = (Array.isArray(r.items) ? r.items : []).map((it) => {
      const i = it as Record<string, unknown>;
      const type = String(i.ingredientType ?? "adjunct") as StockType;
      return {
        ingredientType: stockTypes.includes(type) ? type : "adjunct",
        name: str(i.name) ?? "Ingredient",
        amount: num(i.amount),
        unit: str(i.unit) ?? "oz",
        stage: str(i.stage),
        timingMinutes: num(i.timingMinutes),
      } satisfies SuggestedItem;
    });
    return {
      name: str(r.name) ?? "Suggested recipe",
      style: str(r.style),
      method: methodRaw.includes("all")
        ? "all_grain"
        : methodRaw.includes("partial")
          ? "partial_mash"
          : "extract",
      targetVolumeGal: num(r.targetVolumeGal),
      targetOG: num(r.targetOG),
      targetFG: num(r.targetFG),
      targetIBU: num(r.targetIBU),
      targetSRM: num(r.targetSRM),
      targetABV: num(r.targetABV),
      boilMinutes: num(r.boilMinutes),
      notes: str(r.notes),
      items,
    } satisfies SuggestedRecipe;
  });
}
