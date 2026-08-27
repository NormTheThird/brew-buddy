import { describe, expect, it } from "vitest";
import { buildBeerXml, parseBeerXml } from "./beerxml";
import { BEERXML_TEMPLATE } from "./beerxml-template";
import type { Recipe, RecipeItem } from "@/lib/db/schema";

const SAMPLE = `<?xml version="1.0"?>
<RECIPES><RECIPE>
  <NAME>Test Amber</NAME><VERSION>1</VERSION><TYPE>Extract</TYPE>
  <STYLE><NAME>Amber Ale</NAME></STYLE>
  <BATCH_SIZE>18.93</BATCH_SIZE><BOIL_TIME>60</BOIL_TIME>
  <EST_OG>1.044</EST_OG><EST_FG>1.010</EST_FG><IBU>18</IBU>
  <FERMENTABLES><FERMENTABLE><NAME>Gold LME</NAME><AMOUNT>2.72155</AMOUNT></FERMENTABLE></FERMENTABLES>
  <HOPS><HOP><NAME>Willamette</NAME><AMOUNT>0.02835</AMOUNT><USE>Boil</USE><TIME>60</TIME></HOP></HOPS>
  <YEASTS><YEAST><NAME>SafAle US-05</NAME></YEAST></YEASTS>
</RECIPE></RECIPES>`;

describe("parseBeerXml", () => {
  const r = parseBeerXml(SAMPLE);

  it("reads core spec fields with metric→US conversion", () => {
    expect(r.name).toBe("Test Amber");
    expect(r.style).toBe("Amber Ale");
    expect(r.method).toBe("extract");
    expect(r.targetVolumeGal).toBeCloseTo(5, 1);
    expect(r.targetOG).toBeCloseTo(1.044, 3);
    expect(r.targetIBU).toBe(18);
    expect(r.boilMinutes).toBe(60);
  });

  it("converts fermentable kg→lb and hop kg→oz", () => {
    const lme = r.items.find((i) => i.ingredientType === "fermentable")!;
    expect(lme.amount).toBeCloseTo(6, 1);
    expect(lme.unit).toBe("lb");
    const hop = r.items.find((i) => i.ingredientType === "hop")!;
    expect(hop.amount).toBeCloseTo(1, 1);
    expect(hop.unit).toBe("oz");
    expect(hop.timingMinutes).toBe(60);
  });

  it("throws on a file without a recipe", () => {
    expect(() => parseBeerXml("<RECIPES></RECIPES>")).toThrow();
  });

  it("the copy-paste template parses cleanly (AI recipe-hunting flow)", () => {
    const t = parseBeerXml(BEERXML_TEMPLATE);
    expect(t.name).toBe("Recipe name here");
    expect(t.method).toBe("extract");
    expect(t.targetVolumeGal).toBeCloseTo(5, 1);
    expect(t.items.length).toBe(3);
    expect(t.items.map((i) => i.ingredientType)).toEqual(["fermentable", "hop", "yeast"]);
  });
});

describe("round trip", () => {
  it("export → import preserves the spec", () => {
    const parsed = parseBeerXml(SAMPLE);
    const recipe = {
      name: parsed.name,
      style: parsed.style,
      method: parsed.method,
      targetVolumeGal: parsed.targetVolumeGal,
      targetOG: parsed.targetOG,
      targetFG: parsed.targetFG,
      targetIBU: parsed.targetIBU,
      boilMinutes: parsed.boilMinutes,
      notes: null,
    } as Recipe;
    const items = parsed.items.map(
      (i, idx) => ({ ...i, id: String(idx), recipeId: "r1", sortOrder: idx }) as RecipeItem
    );
    const xml = buildBeerXml(recipe, items);
    const again = parseBeerXml(xml);
    expect(again.name).toBe("Test Amber");
    expect(again.targetVolumeGal).toBeCloseTo(5, 1);
    expect(again.items.find((i) => i.ingredientType === "fermentable")?.amount).toBeCloseTo(6, 1);
    expect(again.items.find((i) => i.ingredientType === "hop")?.amount).toBeCloseTo(1, 1);
  });
});
