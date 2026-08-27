/* Seeds the initial admin account. Idempotent — safe to run again.
   Override with ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD env vars.
   The default password is for local dev only — change it before deploying. */
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import {
  batches,
  batchIngredients,
  equipment,
  gravityReadings,
  stock,
  recipeItems,
  recipes,
  users,
} from "../src/lib/db/schema";

const email = (process.env.ADMIN_EMAIL ?? "normthethird@protonmail.com").toLowerCase();
const name = process.env.ADMIN_NAME ?? "Trey";
const password = process.env.ADMIN_PASSWORD ?? "brewbuddy";

async function seedAdmin(): Promise<string> {
  const existing = db.select().from(users).where(eq(users.email, email)).all()[0];
  if (existing) {
    console.log(`Admin ${email} already exists.`);
    return existing.id;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const inserted = await db
    .insert(users)
    .values({ email, name, passwordHash, role: "admin" })
    .returning({ id: users.id });
  console.log(`Created admin ${name} <${email}>.`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`Password is the dev default ("brewbuddy") — change it before deploying.`);
  }
  return inserted[0].id;
}

// Equipment from brief §7. Per-item costs weren't itemized (~$669 total from
// receipts), so cost is left null until entered from real receipts.
async function seedEquipment(userId: string) {
  const existing = db
    .select({ id: equipment.id })
    .from(equipment)
    .where(eq(equipment.userId, userId))
    .all();
  if (existing.length > 0) {
    console.log("Equipment already seeded.");
    return;
  }
  const owned = [
    { category: "kettle", name: "Brewer's Edge Mash & Boil, with pump", specs: "7.5 gal · 110V · 1600W · grain basket · glass lid" },
    { category: "chilling", name: "Immersion wort chiller", specs: '3/8" × 25 ft stainless' },
    { category: "chilling", name: "Vinyl tubing + hose adapters", specs: '3/8" ID × 10 ft · 2× garden hose adapters' },
    { category: "fermentation", name: "Fermenter with spigot", specs: "6.5 gal · gasketed lid" },
    { category: "fermentation", name: "S-bubbler airlock", specs: "swap planned for 3-piece", flag: "replace" },
    { category: "fermentation", name: "Garage refrigerator", specs: "full size · fermentation chamber" },
    { category: "fermentation", name: "Inkbird ITC-308 WiFi", specs: "temp controller · CSV export → integration target" },
    { category: "measurement", name: "SOLIGT hydrometer + test jar", specs: "SG / Brix / ABV triple scale", flag: "not calibrated" },
    { category: "measurement", name: "Digital scale", specs: null },
    { category: "bottling", name: "Bottling bucket + filler + capper", specs: "6.5 gal · spigot · spring-tip filler" },
    { category: "cleaning", name: "Star San + no-rinse cleanser", specs: "1.5 tsp/gal working dilution · bottle brush" },
    { category: "water", name: "Home RO system", specs: "preferred source from batch 2 on" },
    { category: "other", name: '21" stainless spoon + spray bottles', specs: "24 oz Veco, 360° nozzle — foam control" },
  ] as const;
  const wanted = [
    { category: "fermentation", name: "3-piece airlock", specs: "replaces the S-bubbler" },
    { category: "other", name: "Mesh hop bag", specs: null },
    { category: "chilling", name: "Pre-chiller", specs: "for summer hose water" },
    { category: "fermentation", name: "2–3 more fermenters", specs: null },
    { category: "other", name: "BIAB bag", specs: "all-grain step" },
    { category: "other", name: "4-tap kegging setup", specs: "~$900" },
    { category: "other", name: 'Brewing table, 24–26"', specs: '300 lb rating · lower shelf ~6" off floor' },
  ] as const;

  await db.insert(equipment).values([
    ...owned.map((e) => ({ userId, status: "active" as const, flag: null, ...e })),
    ...wanted.map((e) => ({ userId, status: "wanted" as const, flag: null, ...e })),
  ]);
  console.log(`Seeded ${owned.length} active + ${wanted.length} wanted equipment items.`);
}

// Batch-1 ingredient lots from brief §8 — all consumed, so on-hand is 0.
async function seedStock(userId: string) {
  const existing = db
    .select({ id: stock.id })
    .from(stock)
    .where(eq(stock.userId, userId))
    .all();
  if (existing.length > 0) {
    console.log("Ingredients already seeded.");
    return;
  }
  const aug2026 = new Date("2026-08-15");
  await db.insert(stock).values([
    {
      userId,
      type: "fermentable",
      name: "Gold LME",
      vendor: "Northern Brewer",
      quantity: 6,
      quantityOnHand: 0,
      unit: "lb",
      ppg: 36,
      purchaseDate: aug2026,
      notes: "Block Party Amber kit",
    },
    {
      userId,
      type: "fermentable",
      name: "Kit steeping grains",
      vendor: "Northern Brewer",
      quantity: null,
      quantityOnHand: 0,
      unit: "lb",
      purchaseDate: aug2026,
      notes: "Block Party Amber kit — amount not recorded",
    },
    {
      userId,
      type: "hop",
      name: "Willamette, pellet",
      vendor: "Northern Brewer",
      lotNumber: "HP15",
      quantity: 1,
      quantityOnHand: 0,
      unit: "oz",
      alphaAcidPercent: 6.8,
      hopForm: "pellet",
      purchaseDate: aug2026,
      notes: "6.8% AA vs typical 4–6 — drove batch 1 to ~22 IBU",
    },
    {
      userId,
      type: "water",
      name: "Distilled water, store-bought",
      quantity: 5.75,
      quantityOnHand: 0,
      unit: "gal",
      purchaseDate: new Date("2026-08-23"),
      notes: "Used for batch 1 — RO preferred going forward",
    },
    {
      userId,
      type: "water",
      name: "Home RO water",
      quantity: null,
      quantityOnHand: 1,
      unit: "gal",
      notes: "From the home RO system — effectively unlimited; the default from batch 2 on",
    },
    {
      // Bottles are stock, not equipment — they leave with the beer and come
      // back only sometimes. Counted like caps.
      userId,
      type: "supply",
      name: "Brown bottles, 12 oz",
      quantity: 50,
      quantityOnHand: 50,
      unit: "ct",
      notes: "Non-twist-off — count is approximate; drops as beer is handed out",
    },
    {
      userId,
      type: "yeast",
      name: "SafAle US-05",
      vendor: "Northern Brewer",
      lotNumber: "250573",
      quantity: 11.5,
      quantityOnHand: 0,
      unit: "g",
      strain: "US-05",
      manufacturer: "Fermentis",
      generation: 1,
      bestByDate: new Date("2028-07-01"),
      purchaseDate: aug2026,
      notes: "Throws fusels above ~75°F — pitch ≤72°F",
    },
  ]);
  console.log("Seeded 4 batch-1 ingredient lots (all consumed).");
}

// Recipes from brief §6/§12 and batch 1 from §8.
async function seedRecipesAndBatch1(userId: string) {
  const existing = db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .all();
  if (existing.length > 0) {
    console.log("Recipes already seeded.");
    return;
  }

  const [blockParty] = await db
    .insert(recipes)
    .values({
      userId,
      name: "Block Party Amber Ale",
      style: "Amber Ale",
      method: "extract",
      status: "want_to_brew",
      targetVolumeGal: 5,
      targetOG: 1.044,
      targetIBU: 18,
      boilMinutes: 60,
      notes: "Northern Brewer extract kit. Batch 1 missed OG low — see miss analysis.",
    })
    .returning({ id: recipes.id });

  await db.insert(recipeItems).values([
    { recipeId: blockParty.id, ingredientType: "fermentable", name: "Gold LME", amount: 6, unit: "lb", stage: "boil", sortOrder: 0 },
    { recipeId: blockParty.id, ingredientType: "fermentable", name: "Kit steeping grains", amount: null, unit: "lb", stage: "steep", timingMinutes: 20, sortOrder: 1 },
    { recipeId: blockParty.id, ingredientType: "hop", name: "Willamette", amount: 1, unit: "oz", stage: "boil", timingMinutes: 60, sortOrder: 2 },
    { recipeId: blockParty.id, ingredientType: "yeast", name: "SafAle US-05", amount: 1, unit: "pk", stage: "fermentation", sortOrder: 3 },
  ]);

  await db.insert(recipes).values({
    userId,
    name: "Pete's Wicked Ale clone",
    style: "American Brown",
    method: "extract",
    status: "want_to_brew",
    targetVolumeGal: 5,
    notes: "Replication target — the reason this app exists. Targets TBD.",
  });

  const kettle = db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.userId, userId), eq(equipment.category, "kettle")))
    .all()[0];
  const fermenter = db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.userId, userId), eq(equipment.name, "Fermenter with spigot")))
    .all()[0];

  const [b1] = await db
    .insert(batches)
    .values({
      userId,
      recipeId: blockParty.id,
      recipeName: "Block Party Amber Ale",
      batchNumber: 1,
      brewDate: new Date("2026-08-23"),
      method: "extract",
      status: "fermenting",
      kettleId: kettle?.id ?? null,
      fermenterId: fermenter?.id ?? null,
      preBoilVolumeGal: 6.25,
      postBoilVolumeGal: null, // the famous gap — feeds nothing until batch 2
      intoFermenterGal: 5.5,
      og: 1.036,
      ogTempF: 95,
      steepTempF: 155,
      steepMinutes: 20,
      boilMinutes: 60,
      timeToChillMinutes: 30,
      pitchTempF: 75,
      estimatedFields: JSON.stringify(["preBoilVolumeGal", "intoFermenterGal", "pitchTempF"]),
      notes: "Full-volume boil. Estimated ~22 IBU vs recipe ~18 (6.8% AA + full boil).",
      deviations:
        "No finings — kit had no Whirlfloc. Foam hit the 7-gal line at hot break; spray bottle collapsed it. Chill stalled ~95–100°F after ~30 min; fridge handoff took 4+ hrs; pitched ~75°F (above the 72°F limit). Fermenting 66°F days 1–3, then 70°F.",
    })
    .returning({ id: batches.id });

  const lot = (name: string) =>
    db
      .select({ id: stock.id })
      .from(stock)
      .where(and(eq(stock.userId, userId), eq(stock.name, name)))
      .all()[0]?.id ?? null;

  await db.insert(batchIngredients).values([
    { batchId: b1.id, ingredientId: lot("Gold LME"), description: "Gold LME (36 PPG)", amount: 6, unit: "lb" },
    { batchId: b1.id, ingredientId: lot("Kit steeping grains"), description: "Kit steeping grains — 155°F steep", timingMinutes: 20 },
    { batchId: b1.id, ingredientId: lot("Willamette, pellet"), description: "Willamette pellet · 6.8% AA · lot HP15", amount: 1, unit: "oz", timingMinutes: 60 },
    { batchId: b1.id, ingredientId: lot("SafAle US-05"), description: "SafAle US-05 · lot 250573 · gen 1", amount: 11.5, unit: "g" },
    { batchId: b1.id, ingredientId: lot("Distilled water, store-bought"), description: "Distilled water, store-bought", amount: 5.75, unit: "gal" },
  ]);

  await db.insert(gravityReadings).values({
    batchId: b1.id,
    takenAt: new Date("2026-08-23"),
    value: 1.034,
    tempF: 95,
    stage: "og",
  });

  console.log("Seeded 2 recipes, batch #1 with ingredient snapshot and OG reading.");
}

async function main() {
  const userId = await seedAdmin();
  await seedEquipment(userId);
  await seedStock(userId);
  await seedRecipesAndBatch1(userId);
}

main();
