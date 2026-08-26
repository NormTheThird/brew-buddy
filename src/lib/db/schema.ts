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
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  cost: real("cost"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

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
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type EquipmentCategory = (typeof equipmentCategories)[number];
export type IngredientType = (typeof ingredientTypes)[number];
