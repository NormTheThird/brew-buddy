import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, recipes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { recipeDisplayStatus, statusBadge, methodLabels } from "@/lib/brewing/display";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="field-label" style={{ marginBottom: 0 }}>{label}</span>
      <span style={{ color: "var(--text-bright)", fontSize: 13 }}>{value}</span>
    </div>
  );
}

export default async function RecipesPage() {
  const user = (await getCurrentUser())!;
  const all = db.select().from(recipes).where(eq(recipes.userId, user.id)).all();
  const allBatches = db
    .select({ recipeId: batches.recipeId, keeper: batches.keeper })
    .from(batches)
    .where(eq(batches.userId, user.id))
    .all();

  return (
    <>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="Recipes"
        subtitle="Specs, not shopping lists — resolved against your kettle and your current lots"
        actions={
          <>
            <Link href="/recipes/import" className="btn">Import BeerXML</Link>
            <Link href="/recipes/new" className="btn btn-solid">+ New recipe</Link>
          </>
        }
      />
      {all.length === 0 ? (
        <div className="panel" style={{ padding: "14px 16px", fontSize: 13 }}>
          No recipes yet — create one or import a BeerXML file.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {all.map((r) => {
            const rb = allBatches.filter((b) => b.recipeId === r.id);
            const status = recipeDisplayStatus(r, rb);
            const badge = statusBadge[status];
            return (
              <Link
                key={r.id}
                href={`/recipes/${r.id}`}
                className="panel"
                style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, color: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ color: "var(--text-bright)", fontSize: 16 }}>{r.name}</span>
                  <span className="badge" style={{ background: badge.color }}>{badge.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {[r.style, methodLabels[r.method], r.targetVolumeGal ? `${r.targetVolumeGal} gal` : null]
                    .filter(Boolean)
                    .join(" · ") || "spec not set"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, borderTop: "1px solid var(--border-row)", paddingTop: 12 }}>
                  <Spec label="Target OG" value={r.targetOG?.toFixed(3) ?? "not set"} />
                  <Spec label="Target IBU" value={r.targetIBU != null ? `~${r.targetIBU}` : "not set"} />
                  <Spec label="Boil" value={r.boilMinutes != null ? `${r.boilMinutes} min` : "not set"} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-row)", paddingTop: 10 }}>
                  {rb.length === 0 ? "No batches yet" : `${rb.length} batch${rb.length > 1 ? "es" : ""}`}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
