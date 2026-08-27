import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stock, stockTypes, purchases, type StockItem, type StockType } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteStockItem } from "@/lib/inventory/actions";
import { bestByStatus, formatCost, formatDate, formatMonth, formatMonthYearNumeric, formatQuantity } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";

const PAGE_SIZES = ["10", "25", "50", "all"] as const;

function pageHref(type: string | null, size: string, page: number): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (size !== "10") params.set("size", size);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/stock?${s}` : "/stock";
}

const typeLabels: Record<StockType, string> = {
  fermentable: "Fermentable",
  hop: "Hop",
  yeast: "Yeast",
  adjunct: "Adjunct",
  supply: "Supply",
  water: "Water",
  chemical: "Chemical",
};

const typeBadge: Record<StockType, string> = {
  fermentable: "var(--primary)",
  hop: "var(--success)",
  yeast: "var(--info)",
  adjunct: "#8a6db1",
  supply: "#7a8a5b",
  water: "#5b8aa6",
  chemical: "#a6725b",
};

function keyNumbers(i: StockItem): React.ReactNode {
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

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; size?: string; page?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const params = await searchParams;
  const { type } = params;
  const size = PAGE_SIZES.includes((params.size ?? "") as (typeof PAGE_SIZES)[number])
    ? (params.size as (typeof PAGE_SIZES)[number])
    : "10";
  const filter = stockTypes.includes((type ?? "") as StockType)
    ? (type as StockType)
    : null;

  const all = db
    .select()
    .from(stock)
    .where(eq(stock.userId, user.id))
    .all();

  const purchaseNames = new Map(
    db
      .select({ id: purchases.id, name: purchases.name })
      .from(purchases)
      .where(eq(purchases.userId, user.id))
      .all()
      .map((p) => [p.id, p.name] as const)
  );

  const filtered = (filter ? all.filter((i) => i.type === filter) : all)
    .sort(
      (a, b) =>
        stockTypes.indexOf(a.type) - stockTypes.indexOf(b.type) ||
        a.name.localeCompare(b.name)
    );

  const perPage = size === "all" ? filtered.length || 1 : Number(size);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const shown = filtered.slice((page - 1) * perPage, page * perPage);

  const emptyStock = all.length > 0 && all.every((i) => i.quantityOnHand <= 0);

  return (
    <>
      <PageHeader
        icon={<DropletIcon size={40} />}
        title="Stock"
        subtitle="Ingredients, supplies, chemicals, water — tracked per purchase lot, in and out on quantity"
        actions={<Link href="/stock/new" className="btn btn-solid">+ Add purchase</Link>}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip href={pageHref(null, size, 1)} label="All" active={filter === null} />
        {stockTypes.map((t) => (
          <FilterChip
            key={t}
            href={pageHref(t, size, 1)}
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
          order arrives; the shopping list comes with recipes in milestone 3.
        </div>
      ) : null}
      <div className="panel">
        <div className="panel-heading">
          Lots
          <span style={{ display: "flex", gap: 8, fontSize: 12, fontWeight: 400 }}>
            {PAGE_SIZES.map((s) => (
              <Link
                key={s}
                href={pageHref(filter, s, 1)}
                style={{ color: s === size ? "var(--accent)" : "var(--nav-link)", textDecoration: s === size ? "underline" : "none" }}
              >
                {s}
              </Link>
            ))}
          </span>
        </div>
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
                    <td>
                      {i.purchaseId && purchaseNames.has(i.purchaseId) ? (
                        <Link
                          href={`/purchases/${i.purchaseId}`}
                          title={`Open purchase: ${purchaseNames.get(i.purchaseId)!}`}
                        >
                          {formatDate(i.purchaseDate)}
                        </Link>
                      ) : (
                        formatDate(i.purchaseDate)
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {i.cost != null ? (
                        formatCost(i.cost)
                      ) : i.purchaseId && purchaseNames.has(i.purchaseId) ? (
                        <Link
                          href={`/purchases/${i.purchaseId}`}
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                        >
                          part of {purchaseNames.get(i.purchaseId)!}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/stock/${i.id}/edit`}>Edit</Link>
                      {" · "}
                      <DeleteButton
                        action={deleteStockItem}
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
          {pageCount > 1 ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center", paddingTop: 14, fontSize: 13 }}>
              {page > 1 ? (
                <Link href={pageHref(filter, size, page - 1)} className="btn" style={{ padding: "4px 12px" }}>← Prev</Link>
              ) : null}
              <span style={{ color: "var(--text-muted)" }}>
                Page {page} of {pageCount} · {filtered.length} lot{filtered.length === 1 ? "" : "s"}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(filter, size, page + 1)} className="btn" style={{ padding: "4px 12px" }}>Next →</Link>
              ) : null}
            </div>
          ) : null}
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
