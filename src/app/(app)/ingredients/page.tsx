import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ingredients, ingredientTypes, type Ingredient, type IngredientType } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteIngredient } from "@/lib/inventory/actions";
import { bestByStatus, formatCost, formatMonth, formatMonthYearNumeric, formatQuantity } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";

const typeLabels: Record<IngredientType, string> = {
  fermentable: "Fermentable",
  hop: "Hop",
  yeast: "Yeast",
  adjunct: "Adjunct",
  water: "Water",
  chemical: "Chemical",
};

const typeBadge: Record<IngredientType, string> = {
  fermentable: "var(--primary)",
  hop: "var(--success)",
  yeast: "var(--info)",
  adjunct: "#8a6db1",
  water: "#5b8aa6",
  chemical: "#a6725b",
};

function keyNumbers(i: Ingredient): React.ReactNode {
  if (i.type === "hop") {
    return (
      <>
        {i.alphaAcidPercent != null ? (
          <span style={{ color: "var(--text-bright)" }}>AA {i.alphaAcidPercent}%</span>
        ) : ("—")}
        {i.hopForm ? ` · ${i.hopForm}` : null}
      </>
    );
  }
  if (i.type === "fermentable") {
    const parts = [];
    if (i.ppg != null) parts.push(`${i.ppg} PPG`);
    if (i.colorLovibond != null) parts.push(`${i.colorLovibond}°L`);
    return parts.length ? <span style={{ color: "var(--text-bright)" }}>{parts.join(" · ")}</span> : "—";
  }
  if (i.type === "yeast") {
    const parts = [];
    if (i.quantity != null) parts.push(`${i.quantity} ${i.unit}`);
    if (i.generation != null) parts.push(`gen ${i.generation}`);
    if (i.attenuationPercent != null) parts.push(`${i.attenuationPercent}% atten`);
    return parts.length ? parts.join(" · ") : "—";
  }
  return "—";
}

function BestBy({ d }: { d: Date | null }) {
  const s = bestByStatus(d);
  if (s === "none") return <>—</>;
  const color =
    s === "ok" ? "var(--success)" : s === "soon" ? "var(--warning)" : "var(--danger)";
  return (
    <span style={{ color }}>
      {formatMonthYearNumeric(d!)}
      {s === "expired" ? " · expired" : s === "soon" ? " · soon" : ""}
    </span>
  );
}

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { type } = await searchParams;
  const filter = ingredientTypes.includes((type ?? "") as IngredientType)
    ? (type as IngredientType)
    : null;

  const all = db
    .select()
    .from(ingredients)
    .where(eq(ingredients.userId, user.id))
    .all();

  const shown = (filter ? all.filter((i) => i.type === filter) : all).sort(
    (a, b) =>
      ingredientTypes.indexOf(a.type) - ingredientTypes.indexOf(b.type) ||
      a.name.localeCompare(b.name)
  );

  const emptyStock = all.length > 0 && all.every((i) => i.quantityOnHand <= 0);

  return (
    <>
      <PageHeader
        icon={<DropletIcon size={40} />}
        title="Ingredient lots"
        subtitle="Tracked per purchase — because this packet is never the next packet"
        actions={<Link href="/ingredients/new" className="btn btn-solid">+ Add purchase</Link>}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <FilterChip href="/ingredients" label="All" active={filter === null} />
        {ingredientTypes.map((t) => (
          <FilterChip
            key={t}
            href={`/ingredients?type=${t}`}
            label={typeLabels[t]}
            active={filter === t}
          />
        ))}
      </div>
      {emptyStock ? (
        <div
          className="panel"
          style={{ borderLeft: "3px solid var(--accent)", padding: "12px 16px", fontSize: 13, marginBottom: 18 }}
        >
          Stock is empty — everything on hand was used. Add a purchase when the next
          ingredients arrive; the shopping list comes with recipes in milestone 3.
        </div>
      ) : null}
      <div className="panel">
        <div className="panel-heading">Lots</div>
        <div className="panel-body">
          {shown.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              No lots{filter ? ` of type ${typeLabels[filter]}` : ""} yet.
            </div>
          ) : (
            <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Lot</th>
                  <th>Key numbers</th>
                  <th>On hand</th>
                  <th>Best by</th>
                  <th>Purchased</th>
                  <th style={{ textAlign: "right" }}>Cost</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <span className="badge" style={{ background: typeBadge[i.type] }}>
                        {typeLabels[i.type].toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-bright)" }}>{i.name}</td>
                    <td>{i.lotNumber ?? "—"}</td>
                    <td>{keyNumbers(i)}</td>
                    <td>
                      {formatQuantity(i.quantityOnHand, i.unit)}
                      {i.quantityOnHand <= 0 && i.quantity != null ? (
                        <span style={{ color: "var(--text-faint)", fontSize: 12 }}> (used)</span>
                      ) : null}
                    </td>
                    <td><BestBy d={i.bestByDate} /></td>
                    <td>{formatMonth(i.purchaseDate)}</td>
                    <td style={{ textAlign: "right" }}>{formatCost(i.cost)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/ingredients/${i.id}/edit`}>Edit</Link>
                      {" · "}
                      <DeleteButton
                        action={deleteIngredient}
                        id={i.id}
                        confirmText={`Delete lot "${i.name}"? This can't be undone.`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--text-faint)", paddingTop: 12 }}>
            Replication uses the lot&apos;s numbers, not the label&apos;s — a new Willamette
            packet at 4.3% AA means weighing ~1.6 oz, not 1 oz, to hit the same IBU.
          </div>
        </div>
      </div>
    </>
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
