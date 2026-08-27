import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isEstimated, batchStatusBadge, methodLabels } from "@/lib/brewing/display";
import { abv } from "@/lib/calc/gravity";
import { PageHeader } from "@/components/page-header";
import { LayersIcon } from "@/components/icons";

export default async function BatchesPage() {
  const user = (await getCurrentUser())!;
  const all = db
    .select()
    .from(batches)
    .where(eq(batches.userId, user.id))
    .all()
    .sort((a, b) => b.batchNumber - a.batchNumber);

  return (
    <>
      <PageHeader
        icon={<LayersIcon size={40} />}
        title="Batches"
        subtitle="Every brew, measured — the data your system constants learn from"
        actions={<Link href="/batches/new" className="btn btn-solid">+ Log a batch</Link>}
      />
      <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
        <span className="chip-measured">MEASURED</span><span>captured on the day</span>
        <span className="chip-estimate" style={{ marginLeft: 10 }}>EST</span><span>estimate — never silently a data point</span>
      </div>
      <div className="panel">
        <div className="panel-heading">All batches</div>
        <div className="panel-body">
          {all.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              No batches yet — log one, or &quot;Brew this&quot; from a recipe.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th><th>Recipe</th><th>Brewed</th><th>Method</th>
                    <th>OG</th><th>FG</th><th>ABV</th><th>Status</th><th>Keeper</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((b) => {
                    const badge = batchStatusBadge[b.status];
                    const abvVal = b.og != null && b.fg != null ? abv(b.og, b.fg) : null;
                    return (
                      <tr key={b.id}>
                        <td style={{ color: "var(--text-bright)" }}>{b.batchNumber}</td>
                        <td style={{ color: "var(--text-bright)" }}>
                          <Link href={`/batches/${b.id}`}>{b.recipeName}</Link>
                        </td>
                        <td>{b.brewDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) ?? "—"}</td>
                        <td>{methodLabels[b.method]}</td>
                        <td>
                          {b.og != null ? (
                            <>
                              <span style={{ color: "var(--text-bright)" }}>{b.og.toFixed(3)}</span>{" "}
                              {isEstimated(b, "og") ? <span className="chip-estimate">EST</span> : <span className="chip-measured">M</span>}
                            </>
                          ) : "—"}
                        </td>
                        <td>
                          {b.fg != null ? (
                            <>
                              {b.fg.toFixed(3)}{" "}
                              {isEstimated(b, "fg") ? <span className="chip-estimate">EST</span> : <span className="chip-measured">M</span>}
                            </>
                          ) : "—"}
                        </td>
                        <td>{abvVal != null ? `${abvVal.toFixed(1)}%` : "—"}</td>
                        <td><span className="badge" style={{ background: badge.color }}>{badge.label}</span></td>
                        <td>{b.keeper ? <span className="badge" style={{ background: "var(--success)" }}>KEEPER</span> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
