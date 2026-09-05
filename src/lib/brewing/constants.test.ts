import { describe, expect, it } from "vitest";
import type { Batch, StockItem, RecipeItem } from "@/lib/db/schema";
import { learnedConstants } from "./constants";
import { checkBrewability } from "./brewability";
import { nextActions, fermentationDay } from "./schedule";

function batch(partial: Partial<Batch>): Batch {
  return {
    estimatedFields: "[]",
    status: "completed",
    ...partial,
  } as Batch;
}

describe("learnedConstants", () => {
  it("averages measured boil-off and kettle loss", () => {
    const c = learnedConstants([
      batch({ preBoilVolumeGal: 6.4, postBoilVolumeGal: 5.98, intoFermenterGal: 5.55, boilMinutes: 60 }),
      batch({ preBoilVolumeGal: 6.5, postBoilVolumeGal: 6.0, intoFermenterGal: 5.6, boilMinutes: 60 }),
    ]);
    expect(c.boilOffGalPerHr!.value).toBeCloseTo(0.46, 2);
    expect(c.boilOffGalPerHr!.batches).toBe(2);
    expect(c.kettleLossGal!.value).toBeCloseTo(0.415, 3);
  });

  it("refuses to learn from estimates — batch 1's exact situation", () => {
    const c = learnedConstants([
      batch({
        preBoilVolumeGal: 6.25,
        postBoilVolumeGal: null,
        intoFermenterGal: 5.5,
        boilMinutes: 60,
        timeToChillMinutes: 30,
        estimatedFields: JSON.stringify(["preBoilVolumeGal", "intoFermenterGal"]),
      }),
    ]);
    expect(c.boilOffGalPerHr).toBeNull();
    expect(c.kettleLossGal).toBeNull();
    expect(c.chillMinutes!.value).toBe(30);
  });
});

describe("checkBrewability", () => {
  const items = [
    { ingredientType: "fermentable", name: "Gold LME", amount: 6, unit: "lb" },
    { ingredientType: "hop", name: "Willamette", amount: 1, unit: "oz" },
  ] as RecipeItem[];

  it("reports missing items when stock is empty", () => {
    const r = checkBrewability(items, []);
    expect(r.verdict).toBe("need_to_buy");
    if (r.verdict === "need_to_buy") expect(r.missing).toHaveLength(2);
  });

  it("matches loose names against on-hand stock", () => {
    const stock = [
      { type: "fermentable", name: "Gold LME", quantityOnHand: 6 },
      { type: "hop", name: "Willamette, pellet", quantityOnHand: 1 },
    ] as StockItem[];
    expect(checkBrewability(items, stock).verdict).toBe("can_brew");
  });

  it("ignores zero-stock lots", () => {
    const stock = [{ type: "hop", name: "Willamette, pellet", quantityOnHand: 0 }] as StockItem[];
    const r = checkBrewability(items, stock);
    expect(r.verdict).toBe("need_to_buy");
  });
});

describe("schedule", () => {
  const brewed = batch({ status: "fermenting", brewDate: new Date("2026-08-23") });

  it("computes fermentation day and upcoming actions", () => {
    const now = new Date("2026-08-26");
    expect(fermentationDay(brewed, now)).toBe(3);
    const actions = nextActions(brewed, [], now);
    expect(actions[0].label).toContain("day 4");
    expect(actions[0].overdue).toBe(false);
  });

  it("marks past actions overdue", () => {
    const actions = nextActions(brewed, [], new Date("2026-09-10"));
    expect(actions.find((a) => a.label.includes("day 10"))!.overdue).toBe(true);
  });

  const adj = (over: Partial<import("@/lib/db/schema").BatchTask>) => ({
    id: "t1",
    batchId: "b1",
    userId: "u1",
    taskKey: null as string | null,
    label: null as string | null,
    dueAt: new Date("2026-09-07"),
    createdAt: new Date(),
    ...over,
  });

  it("overrides a derived task's due date", () => {
    const actions = nextActions(
      brewed,
      [adj({ taskKey: "reading-d13" })],
      new Date("2026-09-05")
    );
    const moved = actions.find((a) => a.key === "reading-d13")!;
    expect(moved.due.toISOString().slice(0, 10)).toBe("2026-09-07");
    expect(moved.overdue).toBe(false);
  });

  it("appends a custom task under a stable key", () => {
    const actions = nextActions(
      brewed,
      [adj({ label: "Cold crash at 34°F" })],
      new Date("2026-09-05")
    );
    const custom = actions.find((a) => a.key === "custom:t1")!;
    expect(custom.label).toBe("Cold crash at 34°F");
    expect(custom.due.toISOString().slice(0, 10)).toBe("2026-09-07");
  });
});
