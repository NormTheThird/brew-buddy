import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { Recipe, RecipeItem } from "@/lib/db/schema";

/* BeerXML 1.0 import/export (brief v1). BeerXML uses metric internally:
   volumes in liters, fermentables/yeast in kg, hops in kg. We store US units. */

const L_PER_GAL = 3.78541;
const LB_PER_KG = 2.20462;
const OZ_PER_KG = 35.274;

export type ParsedRecipe = {
  name: string;
  style: string | null;
  method: "extract" | "partial_mash" | "all_grain";
  targetVolumeGal: number | null;
  targetOG: number | null;
  targetFG: number | null;
  targetIBU: number | null;
  boilMinutes: number | null;
  notes: string | null;
  items: Array<{
    ingredientType: "fermentable" | "hop" | "yeast" | "adjunct";
    name: string;
    amount: number | null;
    unit: string;
    timingMinutes: number | null;
    stage: string;
  }>;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseBeerXml(xml: string): ParsedRecipe {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true });
  const doc = parser.parse(xml);
  const recipe = doc?.RECIPES?.RECIPE ?? doc?.RECIPE;
  const r = Array.isArray(recipe) ? recipe[0] : recipe;
  if (!r?.NAME) throw new Error("No RECIPE with a NAME found in this file.");

  const typeRaw = String(r.TYPE ?? "").toLowerCase();
  const method =
    typeRaw.includes("all") ? "all_grain"
    : typeRaw.includes("partial") ? "partial_mash"
    : "extract";

  const items: ParsedRecipe["items"] = [];
  for (const f of asArray<Record<string, unknown>>(r.FERMENTABLES?.FERMENTABLE)) {
    const kg = num(f.AMOUNT);
    items.push({
      ingredientType: "fermentable",
      name: String(f.NAME ?? "Fermentable"),
      amount: kg != null ? Math.round(kg * LB_PER_KG * 100) / 100 : null,
      unit: "lb",
      timingMinutes: null,
      stage: "boil",
    });
  }
  for (const h of asArray<Record<string, unknown>>(r.HOPS?.HOP)) {
    const kg = num(h.AMOUNT);
    items.push({
      ingredientType: "hop",
      name: String(h.NAME ?? "Hop"),
      amount: kg != null ? Math.round(kg * OZ_PER_KG * 100) / 100 : null,
      unit: "oz",
      timingMinutes: num(h.TIME),
      stage: String(h.USE ?? "Boil").toLowerCase(),
    });
  }
  for (const y of asArray<Record<string, unknown>>(r.YEASTS?.YEAST)) {
    items.push({
      ingredientType: "yeast",
      name: String(y.NAME ?? "Yeast"),
      amount: null,
      unit: "pk",
      timingMinutes: null,
      stage: "fermentation",
    });
  }
  for (const m of asArray<Record<string, unknown>>(r.MISCS?.MISC)) {
    items.push({
      ingredientType: "adjunct",
      name: String(m.NAME ?? "Misc"),
      amount: null,
      unit: "oz",
      timingMinutes: num(m.TIME),
      stage: String(m.USE ?? "Boil").toLowerCase(),
    });
  }

  const batchSizeL = num(r.BATCH_SIZE);
  return {
    name: String(r.NAME),
    style: r.STYLE?.NAME ? String(r.STYLE.NAME) : null,
    method,
    targetVolumeGal:
      batchSizeL != null ? Math.round((batchSizeL / L_PER_GAL) * 100) / 100 : null,
    targetOG: num(r.OG) ?? num(r.EST_OG),
    targetFG: num(r.FG) ?? num(r.EST_FG),
    targetIBU: num(r.IBU),
    boilMinutes: num(r.BOIL_TIME),
    notes: r.NOTES ? String(r.NOTES) : null,
    items,
  };
}

export function buildBeerXml(recipe: Recipe, items: RecipeItem[]): string {
  const fermentables = items
    .filter((i) => i.ingredientType === "fermentable")
    .map((i) => ({
      NAME: i.name,
      VERSION: 1,
      TYPE: "Extract",
      AMOUNT:
        i.amount != null && i.unit === "lb"
          ? Math.round((i.amount / LB_PER_KG) * 1000) / 1000
          : i.amount ?? 0,
      YIELD: 0,
    }));
  const hops = items
    .filter((i) => i.ingredientType === "hop")
    .map((i) => ({
      NAME: i.name,
      VERSION: 1,
      AMOUNT:
        i.amount != null && i.unit === "oz"
          ? Math.round((i.amount / OZ_PER_KG) * 10000) / 10000
          : i.amount ?? 0,
      USE: i.stage ?? "Boil",
      TIME: i.timingMinutes ?? 0,
      ALPHA: 0,
    }));
  const yeasts = items
    .filter((i) => i.ingredientType === "yeast")
    .map((i) => ({ NAME: i.name, VERSION: 1, AMOUNT: 0.0115 }));

  const doc = {
    RECIPES: {
      RECIPE: {
        NAME: recipe.name,
        VERSION: 1,
        TYPE:
          recipe.method === "all_grain"
            ? "All Grain"
            : recipe.method === "partial_mash"
              ? "Partial Mash"
              : "Extract",
        STYLE: { NAME: recipe.style ?? "", VERSION: 1 },
        BATCH_SIZE:
          recipe.targetVolumeGal != null
            ? Math.round(recipe.targetVolumeGal * L_PER_GAL * 100) / 100
            : 0,
        BOIL_TIME: recipe.boilMinutes ?? 60,
        ...(recipe.targetOG != null ? { EST_OG: recipe.targetOG } : {}),
        ...(recipe.targetFG != null ? { EST_FG: recipe.targetFG } : {}),
        ...(recipe.targetIBU != null ? { IBU: recipe.targetIBU } : {}),
        ...(recipe.notes ? { NOTES: recipe.notes } : {}),
        FERMENTABLES: { FERMENTABLE: fermentables },
        HOPS: { HOP: hops },
        YEASTS: { YEAST: yeasts },
        MISCS: {},
        WATERS: {},
      },
    },
  };
  const builder = new XMLBuilder({ format: true, ignoreAttributes: true });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(doc)}`;
}
