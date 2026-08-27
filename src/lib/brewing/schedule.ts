import type { Batch } from "@/lib/db/schema";

/* Next-up actions derived from batch state and dates — brief §6 v3's schedule,
   in its simplest useful form. Fermentation plan from the brief: raise temp
   day 4, readings day 10 and 13; tastings at 2/4/8 weeks in the bottle. */

export type NextAction = { label: string; due: Date; overdue: boolean };

const DAY = 24 * 60 * 60 * 1000;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

export function nextActions(batch: Batch, now = new Date()): NextAction[] {
  const actions: NextAction[] = [];
  const mark = (label: string, due: Date) =>
    actions.push({ label, due, overdue: due.getTime() < now.getTime() });

  if (batch.status === "planned") {
    if (batch.brewDate) mark("Brew day", batch.brewDate);
    return actions;
  }

  if (batch.status === "fermenting" && batch.brewDate) {
    const d = batch.brewDate;
    mark("Raise fridge to 70°F (day 4)", addDays(d, 4));
    mark("First gravity reading (day 10)", addDays(d, 10));
    mark("Confirming reading (day 13)", addDays(d, 13));
    mark("Bottling — gate: two matching readings", addDays(d, 14));
  }

  if (batch.status === "conditioning" && batch.bottledDate) {
    const d = batch.bottledDate;
    mark("Tasting notes — 2 weeks in bottle", addDays(d, 14));
    mark("Tasting notes — 4 weeks", addDays(d, 28));
    mark("Tasting notes — 8 weeks", addDays(d, 56));
  }

  return actions.filter((a) => a.due.getTime() > now.getTime() - 30 * DAY);
}

export function fermentationDay(batch: Batch, now = new Date()): number | null {
  if (!batch.brewDate) return null;
  return Math.floor((now.getTime() - batch.brewDate.getTime()) / DAY);
}
