/* Seeds the initial admin account. Idempotent — safe to run again.
   Override with ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD env vars.
   The default password is for local dev only — change it before deploying. */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { equipment, ingredients, users } from "../src/lib/db/schema";

const email = (process.env.ADMIN_EMAIL ?? "normthethird@protonmail.com").toLowerCase();
const name = process.env.ADMIN_NAME ?? "Trey";
const password = process.env.ADMIN_PASSWORD ?? "brewbuddy";

async function seedAdmin(): Promise<number> {
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
async function seedEquipment(userId: number) {
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
    { category: "bottling", name: "Brown bottles, 12 oz", specs: "~50 count · non-twist-off" },
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
async function seedIngredients(userId: number) {
  const existing = db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(ingredients.userId, userId))
    .all();
  if (existing.length > 0) {
    console.log("Ingredients already seeded.");
    return;
  }
  const aug2026 = new Date("2026-08-15");
  await db.insert(ingredients).values([
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

async function main() {
  const userId = await seedAdmin();
  await seedEquipment(userId);
  await seedIngredients(userId);
}

main();
