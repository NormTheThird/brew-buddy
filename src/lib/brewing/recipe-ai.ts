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

/** What matters to a clone hunter: will it taste like the real pint, can
    the source be trusted, and how hard is brew day on this setup. */
export type SuggestedRatings = {
  fidelity: number; // 1-5, 5 = closest to the real beer
  fidelityWhy: string | null;
  simplicity: number; // 1-5, 5 = easiest on an extract setup
  source: "published" | "community" | "constructed";
  sourceName: string | null;
};

/** Ingredients can always be bought; equipment gaps decide brewability. */
export type EquipmentCheck = {
  ready: boolean;
  missing: string[];
  notes: string | null;
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
  ratings: SuggestedRatings;
  equipment: EquipmentCheck;
  items: SuggestedItem[];
};

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function prompt(query: string, equipment: string[]): string {
  return `You are helping a homebrewer find a recipe. Their request: "${query}"

Propose the TOP 3 candidate recipes for a 5 gallon batch. Search the web for
published recipes and the real beer's specs when this is a clone of a
commercial beer; prefer numbers from brewery data or well-regarded published
clones over guesses.

The brewer's ACTIVE EQUIPMENT (this is everything they own):
${equipment.map((e) => `- ${e}`).join("\n")}

Rules:
- The brewer runs an EXTRACT setup (all-in-one kettle, steeping bag). Prefer
  extract or partial-mash versions; include an all-grain option only when
  nothing else does the beer justice.
- EQUIPMENT CHECK per recipe: they can always BUY ingredients, so judge only
  whether the equipment above covers the recipe's technique (mash capability,
  fermentation temp control, chilling, bottling; nitro/keg serving if the
  beer demands it for authenticity). "equipment": {"ready": true/false,
  "missing": ["short gear names"], "notes": "one sentence, e.g. 'Your Mash &
  Boil handles the mini-mash; a mesh bag is the only extra.'"}
- Every ingredient row needs a real amount and unit (lb/oz/g/pk/tsp/gal).
- stage is one of: boil, steep, mash, fermentation, bottling. Hops get
  timingMinutes (minutes left in the boil); steeping grains get steep + minutes.
- notes: 2-3 sentences on where the recipe comes from, what makes the beer
  what it is (e.g. Caffrey's: nitro-smooth Irish ale, low carbonation), and
  any technique that matters. Mention the source if one was found.
- Differentiate the three: e.g. truest-to-source, simplest-to-brew, and an
  elevated take. Give each a distinct name ("Caffrey's Clone (true to tap)").
- RATE each candidate honestly for a clone hunter (do NOT give everything
  the same scores):
  - fidelity 1-5: how close it should taste to the real beer. Judge yeast
    authenticity, grist/sugar match, and technique. fidelityWhy is one short
    clause justifying it ("authentic Morland strain" / "dry yeast approximation").
  - simplicity 1-5: how easy brew day is on THIS extract setup. Plain
    steep-and-boil = 5; a mini-mash costs a point or two; culturing yeast
    from bottles costs more.
  - source: "published" (named book, magazine, or brewery data),
    "community" (forum/homebrew-club consensus recipes), or "constructed"
    (you built it from the beer's specs). sourceName names it when one exists.

Return ONLY JSON:
{"recipes": [{
  "name": "...", "style": "Irish Red Ale",
  "method": "extract" | "partial_mash" | "all_grain",
  "targetVolumeGal": 5, "targetOG": 1.041, "targetFG": 1.010,
  "targetIBU": 20, "targetSRM": 12, "targetABV": 3.8, "boilMinutes": 60,
  "notes": "...",
  "ratings": {"fidelity": 4, "fidelityWhy": "...", "simplicity": 3,
              "source": "published" | "community" | "constructed",
              "sourceName": "Graham Wheeler, Brew Your Own British Real Ale"},
  "equipment": {"ready": true, "missing": [], "notes": "..."},
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

export async function suggestRecipes(
  query: string,
  equipment: string[]
): Promise<SuggestedRecipe[]> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt(query, equipment) },
  ];
  // Sonnet by Trey's call: recipe hunting is exploratory and every number
  // gets reviewed before adoption, so speed/cost beat maximum accuracy here
  // (unlike receipts, which are read once and cached). Web search still on
  // so clones get published numbers instead of vibes.
  // STREAMING, not a single silent HTTP call: long non-streaming requests
  // get killed by intermediaries while the API keeps generating (and
  // billing), and the SDK then retries the whole thing — the "hangs forever
  // while money burns" failure. Streamed rounds keep bytes flowing.
  const opts = { timeout: 120_000, maxRetries: 0 };
  const req = {
    model: "claude-sonnet-5" as const,
    max_tokens: 16000, // room for search reasoning + 3 full recipes; 10k truncated mid-answer
    tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 2 }],
  };
  const round = async (n: number) => {
    const stream = client.messages.stream({ ...req, messages }, opts);
    const resp = await stream.finalMessage();
    console.log(
      `[recipe-ai] round ${n}: stop=${resp.stop_reason} in=${resp.usage.input_tokens} out=${resp.usage.output_tokens} cacheRead=${resp.usage.cache_read_input_tokens ?? 0}`
    );
    return resp;
  };
  let response = await round(0);
  // COST CONTROL: each pause_turn resume re-sends the whole conversation
  // (prompt + every search result) and would re-bill it at full price.
  // A cache breakpoint on each appended round makes resumes re-read the
  // prior pile at ~10% of the input rate. Max 4 resumes = max 4 breakpoints,
  // exactly the API limit.
  for (let i = 0; i < 4 && response.stop_reason === "pause_turn"; i++) {
    const blocks = response.content.map((b, j) =>
      j === response.content.length - 1
        ? ({ ...b, cache_control: { type: "ephemeral" } } as Anthropic.ContentBlockParam)
        : (b as Anthropic.ContentBlockParam)
    );
    messages.push({ role: "assistant", content: blocks });
    response = await round(i + 1);
  }
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request.");
  }

  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[recipe-ai] no JSON; stop_reason:", response.stop_reason, "text head:", text.slice(0, 300));
    throw new Error("No JSON found in the model response.");
  }
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
    const rr = (r.ratings ?? {}) as Record<string, unknown>;
    const clamp5 = (v: unknown, fallback: number) => {
      const n = num(v);
      return n == null ? fallback : Math.max(1, Math.min(5, Math.round(n)));
    };
    const sourceRaw = String(rr.source ?? "constructed");
    const eq = (r.equipment ?? {}) as Record<string, unknown>;
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
      ratings: {
        fidelity: clamp5(rr.fidelity, 3),
        fidelityWhy: str(rr.fidelityWhy),
        simplicity: clamp5(rr.simplicity, 3),
        source:
          sourceRaw === "published" || sourceRaw === "community"
            ? sourceRaw
            : "constructed",
        sourceName: str(rr.sourceName),
      },
      equipment: {
        ready: eq.ready !== false,
        missing: Array.isArray(eq.missing)
          ? eq.missing.map((m) => String(m)).filter(Boolean).slice(0, 6)
          : [],
        notes: str(eq.notes),
      },
      items,
    } satisfies SuggestedRecipe;
  });
}
