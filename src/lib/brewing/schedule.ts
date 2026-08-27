import type { Batch } from "@/lib/db/schema";

/* Next-up actions derived from batch state and dates — brief §6 v3's schedule,
   in its simplest useful form. Fermentation plan from the brief: raise temp
   day 4, readings day 10 and 13; tastings at 2/4/8 weeks in the bottle. */

/** `key` is stable per batch — completions in task_completions point at it. */
export type NextAction = { key: string; label: string; due: Date; overdue: boolean };

const DAY = 24 * 60 * 60 * 1000;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

/* Due dates are date-only values stored at UTC midnight; "today" is the
   user's local calendar day. Compare calendar days, never timestamps —
   otherwise a task due today reads as overdue all day. */
function dueDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY;
}
function todayDay(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY;
}

export function nextActions(batch: Batch, now = new Date()): NextAction[] {
  const actions: NextAction[] = [];
  const mark = (key: string, label: string, due: Date) =>
    actions.push({ key, label, due, overdue: dueDay(due) < todayDay(now) });

  if (batch.status === "planned") {
    if (batch.brewDate) mark("brew-day", "Brew day", batch.brewDate);
    return actions;
  }

  if (batch.status === "fermenting" && batch.brewDate) {
    const d = batch.brewDate;
    mark("raise-temp-d4", "Raise fridge to 70°F (day 4)", addDays(d, 4));
    mark("reading-d10", "First gravity reading (day 10)", addDays(d, 10));
    mark("reading-d13", "Confirming reading (day 13)", addDays(d, 13));
    mark("bottling-gate", "Bottling — gate: two matching readings", addDays(d, 14));
  }

  if (batch.status === "conditioning" && batch.bottledDate) {
    const d = batch.bottledDate;
    mark("tasting-2w", "Tasting notes — 2 weeks in bottle", addDays(d, 14));
    mark("tasting-4w", "Tasting notes — 4 weeks", addDays(d, 28));
    mark("tasting-8w", "Tasting notes — 8 weeks", addDays(d, 56));
  }

  return actions.filter((a) => a.due.getTime() > now.getTime() - 30 * DAY);
}

/** Due = its calendar day has arrived (today or earlier). */
export function isDue(a: NextAction, now = new Date()): boolean {
  return dueDay(a.due) <= todayDay(now);
}

export function fermentationDay(batch: Batch, now = new Date()): number | null {
  if (!batch.brewDate) return null;
  return Math.floor((now.getTime() - batch.brewDate.getTime()) / DAY);
}
