import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, recipeItems, recipes, stock } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { recipeDisplayStatus, statusBadge, methodLabels } from "@/lib/brewing/display";
import { checkBrewability } from "@/lib/brewing/brewability";
import { inArray } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { BeerGlass } from "@/components/beer-glass";
import { recipeGlassColor, styleFamily, STYLE_FAMILIES } from "@/lib/brewing/beer-color";

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="field-label" style={{ marginBottom: 0 }}>{label}</span>
      <span style={{ color: "var(--text-bright)", fontSize: 13 }}>{value}</span>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 14px",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 14,
        fontSize: 12,
        color: active ? "var(--accent)" : "var(--nav-link)",
      }}
    >
      {label}
    </Link>
  );
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const user = await requireUser();
  const { style: styleParam } = await searchParams;
  const all = db.select().from(recipes).where(eq(recipes.userId, user.id)).all();
  const allBatches = db
    .select({ recipeId: batches.recipeId, keeper: batches.keeper })
    .from(batches)
    .where(eq(batches.userId, user.id))
    .all();

  // Family chips only render for families that actually have recipes; the
  // list grows on its own as new styles arrive.
  const familyOf = (style: string | null) => styleFamily(style)?.key ?? "other";
  const counts = new Map<string, number>();
  for (const r of all) counts.set(familyOf(r.style), (counts.get(familyOf(r.style)) ?? 0) + 1);
  const families = STYLE_FAMILIES.filter((f) => (counts.get(f.key) ?? 0) > 0);
  const hasOther = (counts.get("other") ?? 0) > 0;
  const filter =
    styleParam && (families.some((f) => f.key === styleParam) || (styleParam === "other" && hasOther))
      ? styleParam
      : null;
  const shownRecipes = filter ? all.filter((r) => familyOf(r.style) === filter) : all;
  const allItems =
    all.length > 0
      ? db
          .select()
          .from(recipeItems)
          .where(inArray(recipeItems.recipeId, all.map((r) => r.id)))
          .all()
      : [];
  const stockRows = db.select().from(stock).where(eq(stock.userId, user.id)).all();

  return (
    <>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="Recipes"
        subtitle="Specs, not shopping lists: resolved against your kettle and your current lots"
        actions={
          <>
            <Link href="/recipes/import" className="btn">Import BeerXML</Link>
            <Link href="/recipes/new" className="btn btn-solid">+ New recipe</Link>
          </>
        }
      />
      {all.length > 0 ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <FilterChip href="/recipes" label="All" active={filter === null} />
          {families.map((f) => (
            <FilterChip key={f.key} href={`/recipes?style=${f.key}`} label={f.label} active={filter === f.key} />
          ))}
          {hasOther ? (
            <FilterChip href="/recipes?style=other" label="Other" active={filter === "other"} />
          ) : null}
        </div>
      ) : null}
      {all.length === 0 ? (
        <div className="panel" style={{ padding: "14px 16px", fontSize: 13 }}>
          No recipes yet. Create one or import a BeerXML file.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {shownRecipes.map((r) => {
            const rb = allBatches.filter((b) => b.recipeId === r.id);
            const brewability = checkBrewability(allItems.filter((i) => i.recipeId === r.id), stockRows);
            const status = recipeDisplayStatus(r, rb, brewability.verdict === "can_brew");
            const badge = statusBadge[status];
            return (
              <Link
                key={r.id}
                href={`/recipes/${r.id}`}
                className="panel"
                style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, color: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--text-bright)", fontSize: 16 }}>
                    <BeerGlass
                      color={recipeGlassColor(r.targetSRM, r.style)}
                      title={r.targetSRM != null ? `SRM ${r.targetSRM}` : `color estimated from style`}
                    />
                    {r.name}
                  </span>
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
