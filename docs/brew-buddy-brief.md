# Brew Buddy — Project Brief

A personal homebrewing admin panel: equipment inventory, recipe storage, batch
tracking, and brew-day assistance. Built to solve one specific problem — **replicating
a beer exactly once I find one I love.**

---

## 1. Why this exists

I brewed batch 1 in August 2026 after a ~20-year break. It went fine, but the process
exposed exactly what a homebrew app should do that a notebook can't:

- **My equipment has constants I have to discover empirically** (boil-off rate, kettle
  loss, chill time). No published number matches my kettle. The app should learn these
  from my own batch history and use them to plan the next batch.
- **Ingredients vary batch to batch.** My Willamette packet was 6.8% alpha acid; typical
  is 4–6%. Recording "1 oz Willamette" is useless for replication — I need the AA%, and I
  need the app to tell me to weigh ~1.6 oz next time if the new packet is 4.3%
  (scaling by AA: 6.8 ÷ 4.3 ≈ 1.6×).
- **Brew day is a timing problem.** Countdown timers, stage stopwatches, and a checklist
  that persists. I built throwaway HTML for this; it should be a real feature.
- **Measurements are unrecoverable if not captured in the moment.** The app should prompt
  for the right number at the right step.

Long term this connects to a 4-tap kegerator setup and all-grain brewing.

---

## 2. Tech stack

**Decided August 2026** (supersedes the original C#/Blazor suggestion):

- **App:** Next.js (React + TypeScript) — UI and API in one codebase, one process
- **Database:** SQLite, one file (`brewbuddy.db`), accessed via an ORM. The ORM keeps a
  Postgres migration open if user count ever grows beyond friends-scale.
- **Mobile:** PWA — installable from the browser, no native app. Must work well on a phone
  in a hot garage with wet hands: large tap targets, dark theme, offline-tolerant timers,
  push notifications.
- **Hosting:** AWS — one small always-on VM (Lightsail or EC2) running the app in Docker.
  Domain + HTTPS (auto-certs), nightly SQLite backup to S3. Target ≤ ~$8/month all-in.
- **Accounts:** real login from day one. Every owned record (equipment, lots, recipes,
  batches) carries a user id; recipes get a private/shared flag. Single account at launch;
  friends get logins later, and recipe sharing builds on the flag.
- **Roles — exactly two:** **Admin** (Trey; more admins possible) and **User**. All users
  have identical rights: everything in the app except the admin Users page. Admins
  additionally manage accounts: create, edit, reset password, deactivate. Deactivated
  accounts keep their data but can't sign in. No per-feature permissions — keep it flat.
- **Design reference:** purchased Luna v1.4 admin theme (`theme/`) — visual reference only
  (look, layout, colors), not code to port. Chrome is fully dark (no white top bar);
  Luna's stock bright amber #f6a821 was rejected as too loud.
- **Theming:** accent themes are named after brewing-metal finishes, driven by one CSS
  variable from day one. **Copper #c1703f is the default.** **Stainless #a9b7c6** is the
  second theme (light accent → solid buttons and the brand block use dark text, not
  white). A settings picker (curated swatches that pass contrast on the dark background —
  not a color wheel) is a small later feature; per-user once friends have accounts.
  Candidate future names: Brass, Bronze, Cast Iron.

---

## 3. Domain model

### Equipment
```
Equipment
  Id, Name, Category, PurchaseDate, Cost, Notes, Active
  Specs (JSON or typed): capacity, wattage, material, dimensions
  PurchaseId (nullable)  -- set when the item came in a kit/order
```

### Purchase (kits and orders)
```
Purchase
  Id, UserId, Name ("Block Party Amber kit"), Vendor, PurchaseDate
  TotalCost, ReceiptFile (stored upload, viewable later), Notes
  -- Equipment and Ingredient rows point at a Purchase via PurchaseId.
  -- An item shows its own Cost OR "part of <kit>" — never both; totals
  -- count the kit's TotalCost once, plus individually-priced items.
```

### Ingredient (per-purchase, not per-type — lot matters)

> **Amendment (2026-08-27):** this entity is now named **Stock** (table `stock`,
> page "Stock"). The split is durable vs consumable: equipment is one row per
> unit (vessels/instruments each have their own history), stock is everything
> that flows in and out on a quantity basis — ingredients, supplies (incl.
> bottles and caps), chemicals, water. Types gained "supply". In batch context
> the word "ingredient" survives (`batch_ingredients` snapshot, recipe item
> types) because there it means "what went into the beer".
```
Ingredient
  Id, Type (Fermentable | Hop | Yeast | Adjunct | Water | Chemical)
  Name, Vendor, PurchaseDate, Quantity, Unit, Cost
  BestByDate, LotNumber
  -- Hop-specific:    AlphaAcidPercent, Form (Pellet|Leaf)
  -- Fermentable:     PPG (points per pound per gallon), ColorLovibond
  -- Yeast:           Strain, Manufacturer, ProductCode, Generation,
                      TempRangeMinF, TempRangeMaxF, AttenuationPercent
```

### Recipe (equipment-independent — see §5)
```
Recipe
  Id, Name, Style, TargetVolumeGal
  TargetOG, TargetFG, TargetIBU, TargetSRM, TargetABV
  BoilMinutes, Method (Extract | PartialMash | AllGrain)
RecipeItem
  IngredientType, Name, Amount, Unit, TimingMinutes, Stage
```

### Batch
```
Batch
  Id, RecipeId, BatchNumber, BrewDate, Method
  KettleId, FermenterId        -- which vessels this batch used (constants are per-vessel)
  -- Volumes (the constants I'm trying to learn)
  PreBoilVolumeGal, PostBoilVolumeGal, IntoFermenterGal
  -- Gravity
  OG, OGTempF, FG, FGTempF
  -- Process
  SteepTempF, SteepMinutes, TimeToBoilMinutes, BoilMinutes
  ChillEndTempF, TimeToChillMinutes, PitchTempF
  -- Outcome
  BottledDate, PrimingSugarOz, BottleCount, Verdict, Keeper (bool)
  Notes, Deviations
BatchIngredient   -- snapshot of exactly what went in, incl. lot + AA%
GravityReading    -- Id, BatchId, TakenAt, Value, TempF, Stage
FermentationLog   -- Id, BatchId, TakenAt, BeerTempF, AmbientTempF, Source
TastingNote       -- Id, BatchId, WeeksInBottle, Notes, Rating
```

---

## 4. Calculations to implement

```
ABV                  = (OG − FG) × 131.25
ApparentAttenuation  = (OG − FG) / (OG − 1.000) × 100

HydrometerCorrection -- calibrated at 60°F; roughly +0.001 per 10°F above.
                        Also store a per-instrument offset from a distilled-water test.

GravityPoints        = Σ(lbs × PPG) / volumeGal
                        LME ≈ 36 PPG, DME ≈ 44 PPG

BoilOffRateGalPerHr  = (PreBoilVolume − PostBoilVolume) / (BoilMinutes / 60)
KettleLossGal        = PostBoilVolume − IntoFermenterVolume

IBU (Tinseth)        -- needs AA%, weight, boil time, post-boil gravity, volume
HopWeightForTargetIBU -- inverse of the above: THE replication feature

PrimingSugar         -- from volume, target CO2 volumes, and beer temp at bottling
StrikeVolume         = TargetFermenterVolume + BoilOff + KettleLoss − ExtractVolume
```

**The system-constants feature:** boil-off rate and kettle loss should be computed as a
rolling average across batches and fed into the strike-volume planner. This is the core
value of the app — it turns guesses into measurements.

**Constants are per-vessel, not global.** Boil-off and kettle loss belong to a specific
kettle, chill time to a specific chiller/setup. Each batch records which vessels it used
(`KettleId`, `FermenterId`), each constant is a rolling average over that vessel's
batches, and a new kettle starts learning from zero. Constants live on the equipment
profile; the dashboard only surfaces the current setup's numbers.

---

## 5. Recipes must be equipment-independent

Store recipes as *specifications*, not shopping lists, so they survive an equipment change
(extract → all-grain, or a bigger kettle):

| Store | Not |
|---|---|
| Gravity points | "6 lb LME" |
| Target IBU | "1 oz Willamette" |
| Color in °L | "some caramel malt" |
| Volume into fermenter | Volume in kettle |

The app resolves a recipe against *my current equipment profile and current ingredient
lots* to produce the actual shopping list and brew-day amounts.

---

## 6. Feature scope

### v1 — the core loop
- [x] Accounts & login — single user at launch, per-user ownership on all records
- [x] Admin → Users page — list accounts, create, edit, reset password, deactivate
      (Admin role only; hidden from regular users)
- [x] Equipment inventory (CRUD, cost tracking, category grouping)
- [x] Ingredient inventory with lot numbers, AA%, best-by dates
- [x] Live stock levels — purchases minus usage; shopping list for a planned batch
- [x] Purchases & kits — a Purchase groups items bought together (a kit or one order)
      with one total cost and vendor; items in a kit show "part of kit", not a fake
      per-item price, and kit cost counts once in totals
- [x] Receipt import with AI — upload a receipt photo/PDF, Claude extracts the line
      items, user reviews the proposed equipment/ingredient rows before anything is
      written, receipt file stored on the Purchase for later viewing.
      Requires an Anthropic API key (env `ANTHROPIC_API_KEY`, never committed).
- [x] Recipe storage — brewed recipes *and* a to-brew backlog. Status per recipe:
      Idea / Want to brew / Brewed (has batches) / Keeper
- [x] Brewability check — resolve any recipe against my equipment profile and current
      stock: **"can brew now"**, **"need to buy: …"** (shopping list), or **"equipment
      can't do this yet"** (e.g. all-grain method, or volume exceeds kettle/fermenter)
- [x] BeerXML import/export (recipes in, data never trapped)
- [ ] BJCP style ranges per style; batch plotted against its style's box
- [x] Batch records with all fields above
- [x] Gravity calculator (ABV, attenuation, temp correction, hydrometer offset)
- [x] Batch index / list view with sorting and comparison
- [x] System constants dashboard — my boil-off, kettle loss, chill time over time

### v2 — brew day mode
- [ ] Interactive checklist, persisted, phone-optimized
- [ ] Countdown timers: steep (20 min), boil (60 min) with a chiller alert at 15:00 left
- [ ] Stage stopwatch: heat-to-155, steep, heat-to-boil, boil, chill, transfer
- [ ] Auto-timestamped brew log — every stage tap stamps the clock and fills the batch's
      process fields (TimeToBoil, TimeToChill, …) automatically; manual entry is fallback
- [ ] Inline number capture at the step where the measurement happens
- [ ] Hard-limit warnings: 170°F steep ceiling, 72°F pitch ceiling
- [ ] Photos + voice notes attached to the batch (wort color, krausen, foam moments)
- [ ] Miss analysis — post-brew reconciliation of predicted vs. actual OG and volumes,
      pointing at the likely culprit (short extract? volume misread? measurement error?)
- [ ] Learned checklist — post-brew prompt "anything to add next time?" feeds the template

### v3 — fermentation & packaging
- [ ] Fermentation schedule with reminders (raise temp day 4, readings day 10 / 13)
- [ ] Push notifications (PWA) — reminders reach the phone, not just the app
- [ ] "Today" home screen — actions due / overdue across all active batches
- [ ] Inkbird ITC-308 CSV import → temperature curve per batch (built as the **first
      integration adapter** — see §13 — not as a one-off importer)
- [ ] "Two matching readings" gate before bottling is allowed
- [ ] Priming sugar calculator
- [ ] Tasting notes at 2 / 4 / 8 weeks, with a KEEPER flag
- [ ] Off-flavor tags in tasting notes, each mapped to likely cause + process fix
      (green apple → acetaldehyde → too young; banana → esters → fermented hot)

### v4 — replication engine
- [ ] Given a keeper batch + current ingredient lots, compute adjusted amounts
- [ ] Hop weight adjusted for the new packet's AA% to hit the same IBU
- [ ] Freshness-adjusted ingredients — estimated *current* hop AA% (storage decay since
      packaging) and yeast viability at pitch date, used instead of printed packet values
- [ ] Diff view: batch A vs batch B, highlighting what actually differed
- [ ] Recipe scaling to different volumes

### Later
- [ ] All-grain support: mash temp, grain bill, efficiency, water chemistry
- [ ] Kegging: keg inventory, carbonation, 4-tap kegerator "what's on tap"
- [ ] Cost per batch / per bottle
- [ ] Recipe sharing between users (friends' logins; builds on the private/shared flag)
- [ ] "What can I brew tonight?" — inverse inventory query against stored recipes
- [ ] Brew-day weather capture (hose-water temp vs. chill-stall correlation)
- [ ] Yeast harvesting & generation tracking; starter calculator
- [ ] Printable brew sheet generated from recipe + system constants
- [ ] Accent color picker in settings — curated swatches on the one CSS variable (§2)
- [ ] More device adapters as hardware arrives (§13): Tilt / iSpindel / RAPT Pill
      (live gravity during fermentation), kegerator monitoring for the 4-tap setup

---

## 7. Seed data — equipment I own

**Total invested: ~$669**

| Category | Item | Notes |
|---|---|---|
| Kettle | Brewer's Edge Series 2 Mash & Boil **with pump** | 7.5 gal, 110V, 1600W, three power levels (600/1000/1600), digital thermostat, 24-hr delay timer, grain basket, glass lid. All-grain capable. |
| Chilling | Vigorous immersion wort chiller | 3/8" × 25 ft stainless |
| Chilling | Vinyl tubing 3/8" ID × 10 ft, 2× garden hose adapters w/ clamps | |
| Fermentation | Fermenter, 6.5 gal, gasketed lid, **spigot** | |
| Fermentation | S-shaped bubbler airlock | *Replace with 3-piece — this one is a nuisance* |
| Fermentation | Garage refrigerator (full size) as fermentation chamber | |
| Fermentation | **Inkbird WiFi ITC-308** temperature controller | CSV export — integration target |
| Measurement | SOLIGT triple-scale hydrometer (SG/Brix/ABV) + glass test jar | *Not yet calibrated* |
| Measurement | Digital scale | |
| Cleaning | Northern Brewer No-Rinse Cleanser; Star San 32 oz; bottle brush | Star San: 1.5 tsp/gal |
| Bottling | Bottling bucket 6.5 gal **with spigot**, spring-tip filler, tubing, capper, caps | |
| Bottling | 50–55 brown 12 oz non-twist-off bottles | |
| Other | 21" stainless spoon; 24 oz spray bottles (Veco, 360° nozzle) | |
| Water | Home RO system | Not used batch 1 (bought distilled); preferred going forward |

**Wanted / future:** 3-piece airlock, mesh hop bag, pre-chiller for summer, 2–3 more
fermenters, BIAB bag, 4-tap kegging setup (~$900), **24" brewing table** (see §9).

---

## 8. Seed data — Batch 1

**Block Party Amber Ale** (Northern Brewer extract kit) · brewed & pitched Sunday 9 PM,
August 2026 · Corpus Christi, TX garage

| Field | Value |
|---|---|
| Method | Extract, full-volume boil |
| Pre-boil water | 5.75 gal distilled |
| Pre-boil after extract | ~6.25 gal (estimated) |
| Post-boil | **not measured** — gap in the data |
| Into fermenter | ~5.5 gal (eyeballed off bucket markings) |
| OG | **1.036** (read 1.034 @ ~95°F, temp corrected) |
| Target OG | 1.044 |
| Fermentables | 6 lb gold LME + kit steeping grains |
| Hops | 1 oz Willamette, **6.8% AA**, lot HP15, single 60-min addition |
| Estimated IBU | ~22 (vs recipe ~18, due to high AA + full-volume boil) |
| Yeast | SafAle US-05, **lot 250573**, best by 07/2028, 11.5 g, gen 1 |
| Finings | none (kit had no Whirlfloc) |
| Steep | 155°F / 20 min |
| Boil | 60 min at 212°F |
| Chill | stalled at ~95–100°F after ~30 min; handed off to fridge |
| Pitch temp | ~75°F (fridge took 4+ hrs to bring it down) |
| Fermentation | 66°F days 1–3, then 70°F |
| Projected FG | ~1.009 |
| Projected ABV | **~3.5%** — a session amber |

---

## 9. Environmental constraints (encode these as warnings/defaults)

- **Garage runs 90°F+ in summer.** Fermentation without the fridge is not viable — beer
  runs 5–8°F above ambient and US-05 throws fusels above 75°F.
- **Immersion chiller stalls at 95–100°F** in August hose water. Established workflow:
  chill as far as the hose allows → transfer → seal → refrigerate → pitch when the Inkbird
  reads ≤72°F. A pre-chiller is the hardware fix.
- **Boil is gentle** at 1600W with 6+ gal. Setting the thermostat above 212°F (e.g. 220)
  stops it throttling and gives a stronger boil.
- **Boil-off ~0.25–0.5 gal/hr** — well below the commonly assumed 0.65. Needs confirming
  with real pre/post measurements on batch 2.
- **Foam hit the 7 gal line** in a 7.5 gal kettle during hot break. A spray bottle
  collapses it instantly. Flag this in brew-day mode.
- **Brewing table wanted:** 24–26" tall (the kettle is ~21" itself, so counter height is
  too tall to see into or stir comfortably), 300 lb rating, lower shelf ~6" off the floor
  for the fermenter during transfer. Goal: never lift the kettle full.

---

## 10. Known data-quality issues to design around

1. **Hydrometer is uncalibrated.** Build in a per-instrument offset, set by a
   distilled-water-at-60°F test. Apply it to every reading.
2. **Bucket volume markings are unreliable.** Support a per-vessel calibration table
   (measured gallons → marked level).
3. **Post-boil volume wasn't captured on batch 1.** The UI must make it hard to skip a
   measurement that feeds a system constant.
4. Estimates and measurements should be visually distinct — never let a guess silently
   become a data point.

---

## 11. Design principles

- **Log fifteen fields well, not sixty badly.** A form people abandon by batch four is
  worse than no form. Every field must answer: *would I do something differently based on
  this?*
- **Capture in the moment.** Volumes and temperatures are unrecoverable later; tasting
  notes can wait.
- **Phone-first for brew day, desktop-fine for everything else.**
- **Distinguish hard limits from tolerances.** 170°F steep and 72°F pitch are hard limits.
  Boil length ±10 min is nothing. The UI should reflect that difference.

---

## 12. Next batch

**Pete's Wicked Ale clone** — a replication target, which is exactly the use case this app
is being built for.

---

## 13. Integration platform

Any equipment with an API (owned now or bought later) should plug in as an adapter, not a
rewrite. Design for this from day one:

- **Normalized readings table.** One `DeviceReading` store: `BatchId, Source, Kind
  (BeerTemp | AmbientTemp | Gravity | Pressure | …), Value, Unit, TakenAt`. Every chart,
  alert, and calculation reads from this table and never cares where a number came from.
  (`FermentationLog.Source` grows into this.)
- **Adapter contract.** Each integration is a self-contained module implementing one small
  interface: how to ingest (file upload, API poll on a schedule, or inbound webhook), how
  to map raw payloads to `DeviceReading` rows, and what config it needs (API key, device
  id). Adding a device = adding one module + its config screen. Core app untouched.
- **Manual entry is an adapter too.** Hand-typed readings go through the same pipeline —
  keeps estimates-vs-measurements tagging (§10.4) uniform.
- **Adapter roadmap:** Inkbird ITC-308 CSV (v3, first proof of the pattern) → Inkbird
  cloud API if usable → Tilt / iSpindel / RAPT Pill for live gravity → kegerator
  monitoring when the 4-tap setup exists.
- **Rule:** no integration gets to invent its own table or bypass the readings pipeline.
  Plug-and-play stays true only if the contract is the only door in.
