import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Roles are deliberately flat (brief §2): admins manage accounts, everyone
// else has identical rights to everything except the admin Users page.
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastSignInAt: integer("last_sign_in_at", { mode: "timestamp" }),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// A Purchase groups items bought together — a kit or one order — with one
// total cost. Items in a kit show "part of <kit>", never a fake per-item price.
export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  vendor: text("vendor"),
  orderNumber: text("order_number"), // invoice/order number for admin lookups
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  totalCost: real("total_cost"),
  receiptPath: text("receipt_path"), // stored file under data/receipts/
  receiptMime: text("receipt_mime"),
  proposalJson: text("proposal_json"), // pending AI-extracted items awaiting review
  proposalAppliedAt: integer("proposal_applied_at", { mode: "timestamp" }), // read/apply happens once
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Log of every AI receipt read, keyed by content hash: the same receipt is
// only ever read once — later reads return the logged result instantly.
export const extractions = sqliteTable("extractions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sha256: text("sha256").notNull(),
  proposalJson: text("proposal_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const equipmentCategories = [
  "kettle",
  "chilling",
  "fermentation",
  "measurement",
  "bottling",
  "cleaning",
  "water",
  "other",
] as const;

// status: wanted items live in the same table so the wanted list is just a filter.
export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category", { enum: equipmentCategories }).notNull(),
  status: text("status", { enum: ["active", "wanted", "retired"] })
    .notNull()
    .default("active"),
  specs: text("specs"), // short human-readable: "7.5 gal · 110V · 1600W"
  flag: text("flag"), // badge-worthy warning: "not calibrated", "replace"
  purchaseId: integer("purchase_id").references(() => purchases.id, {
    onDelete: "set null",
  }),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  cost: real("cost"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// "chemical" is the home for consumable supplies — cleaners, sanitizers,
// water treatment. They deplete like ingredients but never gate brewability.
export const ingredientTypes = [
  "fermentable",
  "hop",
  "yeast",
  "adjunct",
  "water",
  "chemical",
] as const;

// One row per PURCHASE LOT, not per ingredient type (brief §3) — the lot's
// numbers (AA%, best-by, generation) are what replication runs on.
export const ingredients = sqliteTable("ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ingredientTypes }).notNull(),
  name: text("name").notNull(),
  vendor: text("vendor"),
  lotNumber: text("lot_number"),
  quantity: real("quantity"), // purchased amount; null when unknown (kit contents)
  quantityOnHand: real("quantity_on_hand").notNull().default(0),
  unit: text("unit").notNull().default("oz"),
  cost: real("cost"),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  bestByDate: integer("best_by_date", { mode: "timestamp" }),
  // hop-specific
  alphaAcidPercent: real("alpha_acid_percent"),
  hopForm: text("hop_form", { enum: ["pellet", "leaf"] }),
  // fermentable-specific
  ppg: real("ppg"),
  colorLovibond: real("color_lovibond"),
  // yeast-specific
  strain: text("strain"),
  manufacturer: text("manufacturer"),
  productCode: text("product_code"),
  generation: integer("generation"),
  tempRangeMinF: real("temp_range_min_f"),
  tempRangeMaxF: real("temp_range_max_f"),
  attenuationPercent: real("attenuation_percent"),
  purchaseId: integer("purchase_id").references(() => purchases.id, {
    onDelete: "set null",
  }),
  // Photo of the actual packet/label — AI reads lot, AA%, best-by from it.
  photoPath: text("photo_path"),
  photoMime: text("photo_mime"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Recipes are specifications, not shopping lists (brief §5) — they survive
// equipment changes. Brewed/Keeper display states derive from batches.
export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  style: text("style"),
  method: text("method", { enum: ["extract", "partial_mash", "all_grain"] })
    .notNull()
    .default("extract"),
  status: text("status", { enum: ["idea", "want_to_brew"] })
    .notNull()
    .default("want_to_brew"),
  targetVolumeGal: real("target_volume_gal"),
  targetOG: real("target_og"),
  targetFG: real("target_fg"),
  targetIBU: real("target_ibu"),
  targetSRM: real("target_srm"),
  targetABV: real("target_abv"),
  boilMinutes: integer("boil_minutes"),
  shared: integer("shared", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const recipeItems = sqliteTable("recipe_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  ingredientType: text("ingredient_type", { enum: ingredientTypes }).notNull(),
  name: text("name").notNull(),
  amount: real("amount"),
  unit: text("unit").notNull().default("oz"),
  timingMinutes: integer("timing_minutes"),
  stage: text("stage"), // steep | boil | fermentation | bottling | mash …
  sortOrder: integer("sort_order").notNull().default(0),
});

export const batchStatuses = [
  "planned",
  "fermenting",
  "conditioning",
  "completed",
] as const;

export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id").references(() => recipes.id, {
    onDelete: "set null",
  }),
  recipeName: text("recipe_name").notNull(), // snapshot — survives recipe deletion
  batchNumber: integer("batch_number").notNull(),
  brewDate: integer("brew_date", { mode: "timestamp" }),
  method: text("method", { enum: ["extract", "partial_mash", "all_grain"] })
    .notNull()
    .default("extract"),
  status: text("status", { enum: batchStatuses }).notNull().default("planned"),
  // Constants are per-vessel (brief §4): record which vessels this batch used.
  kettleId: integer("kettle_id").references(() => equipment.id, {
    onDelete: "set null",
  }),
  fermenterId: integer("fermenter_id").references(() => equipment.id, {
    onDelete: "set null",
  }),
  preBoilVolumeGal: real("pre_boil_volume_gal"),
  postBoilVolumeGal: real("post_boil_volume_gal"),
  intoFermenterGal: real("into_fermenter_gal"),
  og: real("og"),
  ogTempF: real("og_temp_f"),
  fg: real("fg"),
  fgTempF: real("fg_temp_f"),
  steepTempF: real("steep_temp_f"),
  steepMinutes: real("steep_minutes"),
  timeToBoilMinutes: real("time_to_boil_minutes"),
  boilMinutes: real("boil_minutes"),
  chillEndTempF: real("chill_end_temp_f"),
  timeToChillMinutes: real("time_to_chill_minutes"),
  pitchTempF: real("pitch_temp_f"),
  bottledDate: integer("bottled_date", { mode: "timestamp" }),
  primingSugarOz: real("priming_sugar_oz"),
  bottleCount: integer("bottle_count"),
  verdict: text("verdict"),
  keeper: integer("keeper", { mode: "boolean" }).notNull().default(false),
  // Estimates never silently become data points (brief §10.4): JSON array of
  // field names whose values are estimates, rendered with the EST chip.
  estimatedFields: text("estimated_fields").notNull().default("[]"),
  notes: text("notes"),
  deviations: text("deviations"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Snapshot of exactly what went in, including the lot (brief §3).
export const batchIngredients = sqliteTable("batch_ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id").references(() => ingredients.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(),
  amount: real("amount"),
  unit: text("unit"),
  timingMinutes: integer("timing_minutes"),
});

export const gravityReadings = sqliteTable("gravity_readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  takenAt: integer("taken_at", { mode: "timestamp" }).notNull(),
  value: real("value").notNull(), // raw hydrometer reading
  tempF: real("temp_f"),
  stage: text("stage"), // og | fermentation | fg
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type BatchIngredient = typeof batchIngredients.$inferSelect;
export type GravityReading = typeof gravityReadings.$inferSelect;
export type BatchStatus = (typeof batchStatuses)[number];
export type EquipmentCategory = (typeof equipmentCategories)[number];
export type IngredientType = (typeof ingredientTypes)[number];
