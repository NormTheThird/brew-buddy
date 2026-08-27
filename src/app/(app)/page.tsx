import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, equipment, stock, recipeItems, recipes, taskCompletions } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isEstimated, batchStatusBadge, recipeDisplayStatus, statusBadge } from "@/lib/brewing/display";
import { learnedConstants } from "@/lib/brewing/constants";
import { isDue, nextActions, fermentationDay } from "@/lib/brewing/schedule";
import { completeTask, uncompleteTask } from "@/lib/brewing/actions";
import { checkBrewability } from "@/lib/brewing/brewability";
import { abv } from "@/lib/calc/gravity";
import { PageHeader } from "@/components/page-header";
import { GridIcon } from "@/components/icons";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border-row)", fontSize: 13 }}>
      <span>{label}</span>
      <span style={{ color: "var(--text-bright)", display: "flex", alignItems: "center", gap: 8, textAlign: "right" }}>{children}</span>
    </div>
  );
}

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;

  const allBatches = db.select().from(batches).where(eq(batches.userId, user.id)).all();
  const active = allBatches
    .filter((b) => b.status !== "completed")
    .sort((a, b) => b.batchNumber - a.batchNumber)[0];
  const allRecipes = db.select().from(recipes).where(eq(recipes.userId, user.id)).all();
  const allItems =
    allRecipes.length > 0
      ? db
          .select()
          .from(recipeItems)
          .where(inArray(recipeItems.recipeId, allRecipes.map((r) => r.id)))
          .all()
      : [];
  const stockRows = db.select().from(stock).where(eq(stock.userId, user.id)).all();
  const gear = db.select().from(equipment).where(and(eq(equipment.userId, user.id), eq(equipment.status, "active"))).all();

  const kettle = gear.find((g) => g.category === "kettle");
  const kettleBatches = kettle ? allBatches.filter((b) => b.kettleId === kettle.id) : [];
  const constants = learnedConstants(kettleBatches);
  const flags = gear.filter((g) => g.flag).map((g) => `${g.name}: ${g.flag}`);

  const doneKeys = new Set(
    active
      ? db
          .select({ taskKey: taskCompletions.taskKey })
          .from(taskCompletions)
          .where(eq(taskCompletions.batchId, active.id))
          .all()
          .map((c) => c.taskKey)
      : []
  );
  const actions = active ? nextActions(active).slice(0, 4) : [];
  const day = active ? fermentationDay(active) : null;
  const activeBadge = active ? batchStatusBadge[active.status] : null;
  const activeAbv = active?.og != null && active?.fg != null ? abv(active.og, active.fg) : null;

  return (
    <>
      <PageHeader
        icon={<GridIcon size={40} />}
        title="Dashboard"
        subtitle="Your brewery at a glance — what's fermenting, what's next, what you're set up to brew"
        actions={<Link href="/batches/new" className="btn btn-solid">+ Log a batch</Link>}
      />
      <div className="dash-grid">
        <div className="panel dash-span-2">
          <div className="panel-heading">Active batch<Link href="/batches" style={{ fontSize: 12 }}>All batches</Link></div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {!active ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing fermenting — pick a recipe and brew.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <Link href={`/batches/${active.id}`} style={{ color: "var(--text-bright)", fontSize: 17 }}>
                    #{active.batchNumber} · {active.recipeName}
                  </Link>
                  <span className="badge" style={{ background: activeBadge!.color }}>{activeBadge!.label}</span>
                </div>
                <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
                  {day != null && active.status === "fermenting" ? <span>Day {day} of ~14</span> : null}
                  {active.og != null ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      OG {active.og.toFixed(3)}{" "}
                      {isEstimated(active, "og") ? <span className="chip-estimate">EST</span> : <span className="chip-measured">M</span>}
                    </span>
                  ) : null}
                  {active.fg != null ? <span>FG {active.fg.toFixed(3)}</span> : <span>FG pending</span>}
                  {activeAbv != null ? <span>ABV {activeAbv.toFixed(1)}%</span> : null}
                </div>
                {day != null && active.status === "fermenting" ? (
                  <div style={{ background: "var(--field)", borderRadius: 3, height: 8, overflow: "hidden", margin: "6px 0" }}>
                    <div style={{ background: "var(--accent)", height: 8, width: `${Math.min(100, Math.max(2, (day / 14) * 100))}%` }} />
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 10 }}>
                  <Link href={`/batches/${active.id}`} className="btn">Open batch</Link>
                  <Link href={`/batches/${active.id}/edit`} className="btn">Log a reading / update</Link>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Next up</div>
          <div className="panel-body">
            {actions.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing scheduled.</div>
            ) : (
              actions.map((a, i) => {
                const done = doneKeys.has(a.key);
                return (
                  <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border-row)" : "none", fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: done ? "var(--success)" : a.overdue ? "var(--danger)" : i === 0 ? "var(--accent)" : "#4a4f5a", flexShrink: 0 }} />
                    <span style={{ color: done ? "var(--text-muted)" : a.overdue ? "var(--danger)" : undefined, textDecoration: done ? "line-through" : "none" }}>
                      {a.label}
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--text-muted)", flexShrink: 0 }}>
                      {a.due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    {done ? (
                      <form action={uncompleteTask} style={{ display: "inline", flexShrink: 0 }}>
                        <input type="hidden" name="batchId" value={active!.id} />
                        <input type="hidden" name="taskKey" value={a.key} />
                        <button type="submit" title="Undo" style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit" }}>
                          undo
                        </button>
                      </form>
                    ) : isDue(a) ? (
                      <form action={completeTask} style={{ display: "inline", flexShrink: 0 }}>
                        <input type="hidden" name="batchId" value={active!.id} />
                        <input type="hidden" name="taskKey" value={a.key} />
                        <button type="submit" className="btn" style={{ padding: "1px 10px", fontSize: 12 }}>
                          ✓ Done
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">My setup<Link href="/equipment" style={{ fontSize: 12 }}>Equipment</Link></div>
          <div className="panel-body">
            <Row label="Kettle">{kettle?.name.split(",")[0] ?? "—"}</Row>
            <Row label="Fermenter">
              {gear.find((g) => g.name.toLowerCase().includes("fermenter"))?.name ?? "—"}
              {active && active.fermenterId ? <span className="badge" style={{ background: "var(--success)", fontSize: 10 }}>IN USE · B{active.batchNumber}</span> : null}
            </Row>
            <Row label="Chamber">{gear.find((g) => g.name.toLowerCase().includes("refrigerator")) ? "Garage fridge + Inkbird" : "—"}</Row>
            <div style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 10, borderTop: "1px solid var(--border-row)", marginTop: 4 }}>
              {gear.length} active items
              {flags.length ? ` · ${flags.length} flag${flags.length > 1 ? "s" : ""}: ${flags.join("; ")}` : ""}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Learned constants</div>
          <div className="panel-body">
            {kettle ? (
              <div style={{ padding: "8px 0", borderTop: "1px solid var(--border-row)", fontSize: 13, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={kettle.name}>
                {kettle.name}
              </div>
            ) : null}
            {/* The constants belong to the kettle above — indented under it. */}
            <div style={{ paddingLeft: 16 }}>
              <Row label="Boil-off">
                {constants.boilOffGalPerHr ? `${constants.boilOffGalPerHr.value.toFixed(2)} gal/hr · ${constants.boilOffGalPerHr.batches} batch${constants.boilOffGalPerHr.batches > 1 ? "es" : ""}` : <span style={{ color: "var(--danger)" }}>no measured data</span>}
              </Row>
              <Row label="Kettle loss">
                {constants.kettleLossGal ? `${constants.kettleLossGal.value.toFixed(2)} gal · ${constants.kettleLossGal.batches}` : <span style={{ color: "var(--danger)" }}>no measured data</span>}
              </Row>
              <Row label="Chill">
                {constants.chillMinutes ? `${constants.chillMinutes.value.toFixed(0)} min avg` : "—"}
              </Row>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 10, borderTop: "1px solid var(--border-row)", marginTop: 4 }}>
              Learned only from measured values — estimates never feed a constant. Batch
              1&apos;s volumes were estimates; batch 2 starts the real numbers.
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">Recipe pipeline<Link href="/recipes" style={{ fontSize: 12 }}>Recipes</Link></div>
          <div className="panel-body">
            {allRecipes.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No recipes yet.</div>
            ) : (
              allRecipes.slice(0, 4).map((r) => {
                const rb = allBatches.filter((b) => b.recipeId === r.id);
                const st = recipeDisplayStatus(r, rb);
                const badge = statusBadge[st];
                const brewability = checkBrewability(allItems.filter((i) => i.recipeId === r.id), stockRows);
                // What matters depends on where the recipe is in its life:
                // brewing now → the batch; brewed before → outcome + re-brew;
                // never brewed → can I start, and what's missing.
                const inProgress = rb.find((b) => b.status !== "completed");
                const lastDone = rb
                  .filter((b) => b.status === "completed")
                  .sort((a, b) => (b.brewDate?.getTime() ?? 0) - (a.brewDate?.getTime() ?? 0))[0];
                const shopping =
                  brewability.verdict === "no_items"
                    ? "no ingredient spec yet"
                    : brewability.verdict === "can_brew"
                      ? `✓ can ${rb.length ? "re-brew" : "brew"} from stock`
                      : `to ${rb.length ? "re-brew" : "brew"}, buy: ${brewability.missing.slice(0, 3).join(", ")}${brewability.missing.length > 3 ? "…" : ""}`;
                return (
                  <div key={r.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border-row)", fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <Link href={`/recipes/${r.id}`} style={{ color: "var(--text-bright)" }}>{r.name}</Link>
                      <span className="badge" style={{ background: badge.color }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {inProgress ? (
                        <Link href={`/batches/${inProgress.id}`} style={{ color: "var(--text-muted)" }}>
                          batch #{inProgress.batchNumber} {inProgress.status}
                          {inProgress.status === "fermenting" && fermentationDay(inProgress) != null
                            ? ` · day ${fermentationDay(inProgress)}`
                            : ""}
                          {" →"}
                        </Link>
                      ) : lastDone ? (
                        <>
                          last brewed{" "}
                          {lastDone.brewDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) ?? "—"}
                          {lastDone.keeper ? " · keeper" : ""}
                          {lastDone.verdict ? ` · “${lastDone.verdict}”` : ""}
                          {" · "}
                          {shopping}
                        </>
                      ) : (
                        shopping
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
