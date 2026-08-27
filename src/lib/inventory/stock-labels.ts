import type { StockType } from "@/lib/db/schema";

export const typeLabels: Record<StockType, string> = {
  fermentable: "Fermentable",
  hop: "Hop",
  yeast: "Yeast",
  adjunct: "Adjunct",
  supply: "Supply",
  water: "Water",
  chemical: "Chemical",
};

export const typeBadge: Record<StockType, string> = {
  fermentable: "var(--primary)",
  hop: "var(--success)",
  yeast: "var(--info)",
  adjunct: "#8a6db1",
  supply: "#7a8a5b",
  water: "#5b8aa6",
  chemical: "#a6725b",
};
