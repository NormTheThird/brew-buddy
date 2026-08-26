/* Small display helpers for inventory screens. Pure functions. */

/* Date-only values are stored at UTC midnight; format them in UTC or the
   local-timezone shift rolls them back a day (07/2028 renders as 06/2028). */
export function formatMonth(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthYearNumeric(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatCost(cost: number | null): string {
  if (cost == null) return "—";
  return `$${cost.toFixed(2)}`;
}

export type BestByStatus = "none" | "ok" | "soon" | "expired";

/** Best-by health: "soon" within 60 days, "expired" past date. */
export function bestByStatus(bestBy: Date | null, now = new Date()): BestByStatus {
  if (!bestBy) return "none";
  const ms = bestBy.getTime() - now.getTime();
  if (ms < 0) return "expired";
  if (ms < 60 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

/** "0 oz", "5.75 gal", "—" when quantity is unknown. */
export function formatQuantity(qty: number | null, unit: string): string {
  if (qty == null) return "—";
  const n = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${n} ${unit}`;
}
