import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, taskCompletions } from "@/lib/db/schema";
import { completeTask } from "@/lib/brewing/actions";
import { isDue, nextActions } from "@/lib/brewing/schedule";

/** The in-app notification: anything due today or overdue across active
    batches shows here on every page until it's marked done. (Email/text is
    the v2 version of this once the app is deployed.) */
export async function DueTasksBanner({ userId }: { userId: string }) {
  const activeBatches = db
    .select()
    .from(batches)
    .where(eq(batches.userId, userId))
    .all()
    .filter((b) => b.status !== "completed");
  if (activeBatches.length === 0) return null;

  const done = new Set(
    db
      .select({ batchId: taskCompletions.batchId, taskKey: taskCompletions.taskKey })
      .from(taskCompletions)
      .where(inArray(taskCompletions.batchId, activeBatches.map((b) => b.id)))
      .all()
      .map((c) => `${c.batchId}|${c.taskKey}`)
  );

  const due = activeBatches.flatMap((b) =>
    nextActions(b)
      .filter((a) => isDue(a) && !done.has(`${b.id}|${a.key}`))
      .map((a) => ({ batch: b, action: a }))
  );
  if (due.length === 0) return null;

  return (
    <div
      className="panel"
      style={{
        borderLeft: "3px solid var(--warning)",
        padding: "12px 16px",
        marginBottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "var(--warning)" }}>
        Due now
      </div>
      {due.map(({ batch: b, action: a }) => (
        <div
          key={`${b.id}|${a.key}`}
          style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}
        >
          <span style={{ color: "var(--text-bright)" }}>
            {a.label}
            {a.overdue ? (
              <span className="badge" style={{ background: "var(--danger)", marginLeft: 8 }}>OVERDUE</span>
            ) : null}
          </span>
          <Link href={`/batches/${b.id}`} style={{ fontSize: 12 }}>
            Batch #{b.batchNumber} · {b.recipeName}
          </Link>
          <form action={completeTask} style={{ display: "inline", marginLeft: "auto" }}>
            <input type="hidden" name="batchId" value={b.id} />
            <input type="hidden" name="taskKey" value={a.key} />
            <button type="submit" className="btn" style={{ padding: "3px 12px", fontSize: 12 }}>
              ✓ Done
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
