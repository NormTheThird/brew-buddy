import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stock, stockTypes, purchases, type StockType } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { typeLabels } from "@/lib/inventory/stock-labels";
import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { StockTable, type StockGroup, type StockLot } from "@/components/stock-table";
import { TableSearch } from "@/components/table-search";

const PAGE_SIZES = ["10", "25", "50", "all"] as const;

function pageHref(
  type: string | null,
  q: string,
  size: string,
  page: number
): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (q) params.set("q", q);
  if (size !== "10") params.set("size", size);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/stock?${s}` : "/stock";
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; size?: string; page?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const params = await searchParams;
  const { type } = params;
  const q = (params.q ?? "").trim();
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

  const lots: StockLot[] = (filter ? all.filter((i) => i.type === filter) : all).map(
    (i) => ({
      ...i,
      purchaseName: i.purchaseId ? (purchaseNames.get(i.purchaseId) ?? null) : null,
    })
  );

  // One group per product (type + name); its lots are the real rows. 15 packs
  // of US-05 roll up to one line that expands into per-lot detail.
  const byProduct = new Map<string, StockGroup>();
  for (const lot of lots) {
    const key = `${lot.type}|${lot.name.toLowerCase()}`;
    const g = byProduct.get(key);
    if (g) g.lots.push(lot);
    else byProduct.set(key, { key, type: lot.type, name: lot.name, lots: [lot] });
  }
  for (const g of byProduct.values()) {
    g.lots.sort(
      (a, b) => (b.purchaseDate?.getTime() ?? 0) - (a.purchaseDate?.getTime() ?? 0)
    );
  }

  const needle = q.toLowerCase();
  const matches = (g: StockGroup) =>
    !q ||
    g.name.toLowerCase().includes(needle) ||
    typeLabels[g.type].toLowerCase().includes(needle) ||
    g.lots.some((l) =>
      [l.vendor, l.lotNumber, l.notes, l.purchaseName]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(needle))
    );

  const groups = [...byProduct.values()].filter(matches).sort(
    (a, b) =>
      stockTypes.indexOf(a.type) - stockTypes.indexOf(b.type) ||
      a.name.localeCompare(b.name)
  );

  const perPage = size === "all" ? groups.length || 1 : Number(size);
  const pageCount = Math.max(1, Math.ceil(groups.length / perPage));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const shown = groups.slice((page - 1) * perPage, page * perPage);

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
        <FilterChip href={pageHref(null, q, size, 1)} label="All" active={filter === null} />
        {stockTypes.map((t) => (
          <FilterChip
            key={t}
            href={pageHref(t, q, size, 1)}
            label={typeLabels[t]}
            active={filter === t}
          />
        ))}
        <div style={{ flex: 1, minWidth: 240, display: "flex", justifyContent: "flex-end" }}>
          <TableSearch basePath="/stock" placeholder="Type 3+ letters to filter — name, vendor, lot…" />
        </div>
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
          {q ? `Matches for "${q}" — ${groups.length}` : "On hand"}
          <span style={{ display: "flex", gap: 8, fontSize: 12, fontWeight: 400 }}>
            {PAGE_SIZES.map((s) => (
              <Link
                key={s}
                href={pageHref(filter, q, s, 1)}
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
              {q
                ? `Nothing matches "${q}".`
                : `No lots${filter ? ` of type ${typeLabels[filter]}` : ""} yet.`}
            </div>
          ) : (
            <StockTable key={`${q}|${filter ?? ""}|${page}`} groups={shown} defaultOpen={Boolean(q)} />
          )}
          {pageCount > 1 ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center", paddingTop: 14, fontSize: 13 }}>
              {page > 1 ? (
                <Link href={pageHref(filter, q, size, page - 1)} className="btn" style={{ padding: "4px 12px" }}>← Prev</Link>
              ) : null}
              <span style={{ color: "var(--text-muted)" }}>
                Page {page} of {pageCount} · {groups.length} product{groups.length === 1 ? "" : "s"}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(filter, q, size, page + 1)} className="btn" style={{ padding: "4px 12px" }}>Next →</Link>
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
