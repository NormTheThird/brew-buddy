import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, batchIngredients, stock, stockTypes, purchases, type StockType } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { typeLabels } from "@/lib/inventory/stock-labels";
import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { StockTable, type StockGroup, type StockLot } from "@/components/stock-table";
import { TableSearch } from "@/components/table-search";

const PAGE_SIZES = ["10", "25", "50", "all"] as const;

const AVAIL = ["available", "used", "all"] as const;
type Avail = (typeof AVAIL)[number];

function pageHref(
  type: string | null,
  avail: Avail,
  q: string,
  size: string,
  page: number
): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (avail !== "available") params.set("avail", avail);
  if (q) params.set("q", q);
  if (size !== "10") params.set("size", size);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/stock?${s}` : "/stock";
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; avail?: string; q?: string; size?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { type } = params;
  const q = (params.q ?? "").trim();
  const size = PAGE_SIZES.includes((params.size ?? "") as (typeof PAGE_SIZES)[number])
    ? (params.size as (typeof PAGE_SIZES)[number])
    : "10";
  const filter = stockTypes.includes((type ?? "") as StockType)
    ? (type as StockType)
    : null;
  // What can I brew with? is the default question — used lots are one chip away.
  const avail: Avail = AVAIL.includes((params.avail ?? "") as Avail)
    ? (params.avail as Avail)
    : "available";

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

  // Which batch consumed each lot — the snapshot table already knows.
  const usedInRows = db
    .select({
      ingredientId: batchIngredients.ingredientId,
      batchId: batches.id,
      batchNumber: batches.batchNumber,
    })
    .from(batchIngredients)
    .innerJoin(batches, eq(batchIngredients.batchId, batches.id))
    .where(eq(batches.userId, user.id))
    .all();
  const usedIn = new Map<string, Array<{ id: string; label: string }>>();
  for (const r of usedInRows) {
    if (!r.ingredientId) continue;
    const list = usedIn.get(r.ingredientId) ?? [];
    if (!list.some((b) => b.id === r.batchId)) {
      list.push({ id: r.batchId, label: `#${r.batchNumber}` });
    }
    usedIn.set(r.ingredientId, list);
  }

  const lots: StockLot[] = (filter ? all.filter((i) => i.type === filter) : all)
    .filter((i) =>
      avail === "available"
        ? i.quantityOnHand > 0
        : avail === "used"
          ? i.quantityOnHand <= 0
          : true
    )
    .map((i) => ({
      ...i,
      purchaseName: i.purchaseId ? (purchaseNames.get(i.purchaseId) ?? null) : null,
      usedIn: usedIn.get(i.id) ?? [],
    }));

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
        subtitle="Ingredients, supplies, chemicals, water: tracked per purchase lot, in and out on quantity"
        actions={<Link href="/stock/new" className="btn btn-solid">+ Add purchase</Link>}
      />
      {/* Phone: a shopping list, not a ledger. What's on hand grouped by
          kind, totals only — lot numbers and history live on desktop. */}
      <div className="mobile-only">
        <div className="panel">
          <div className="panel-body">
            {groups.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
                Nothing on hand.
              </div>
            ) : (
              stockTypes
                .filter((t) => groups.some((g) => g.type === t))
                .map((t) => (
                  <div key={t} style={{ paddingBottom: 6 }}>
                    <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)", padding: "12px 0 4px" }}>
                      {typeLabels[t]}
                    </div>
                    {groups
                      .filter((g) => g.type === t)
                      .map((g) => {
                        const onHand = g.lots.reduce((s, l) => s + l.quantityOnHand, 0);
                        const unit = g.lots[0]?.unit ?? "";
                        return (
                          <div key={g.key} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border-row)", fontSize: 14 }}>
                            <span style={{ color: "var(--text-bright)", flex: 1, minWidth: 0 }}>{g.name}</span>
                            <span style={{ color: onHand > 0 || t === "water" ? "var(--text-bright)" : "var(--danger)", flexShrink: 0 }}>
                              {t === "water" ? "unlimited" : `${Math.round(onHand * 100) / 100} ${unit}`}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
      <div className="desktop-only">
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <FilterChip href={pageHref(filter, "available", q, size, 1)} label="Available" active={avail === "available"} />
        <FilterChip href={pageHref(filter, "used", q, size, 1)} label="Used" active={avail === "used"} />
        <FilterChip href={pageHref(filter, "all", q, size, 1)} label="All lots" active={avail === "all"} />
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 4px" }} />
        <FilterChip href={pageHref(null, avail, q, size, 1)} label="All" active={filter === null} />
        {stockTypes.map((t) => (
          <FilterChip
            key={t}
            href={pageHref(t, avail, q, size, 1)}
            label={typeLabels[t]}
            active={filter === t}
          />
        ))}
        <div style={{ flex: 1, minWidth: 240, display: "flex", justifyContent: "flex-end" }}>
          <TableSearch basePath="/stock" placeholder="Type 3+ letters to filter: name, vendor, lot…" />
        </div>
      </div>
      {emptyStock ? (
        <div
          className="panel"
          style={{ borderLeft: "3px solid var(--accent)", padding: "12px 16px", fontSize: 13, marginBottom: 18 }}
        >
          Stock is empty. Everything on hand was used. Add a purchase when the next
          order arrives; the shopping list comes with recipes in milestone 3.
        </div>
      ) : null}
      <div className="panel">
        <div className="panel-heading">
          {q ? `Matches for "${q}" (${groups.length})` : "On hand"}
          <span style={{ display: "flex", gap: 8, fontSize: 12, fontWeight: 400 }}>
            {PAGE_SIZES.map((s) => (
              <Link
                key={s}
                href={pageHref(filter, avail, q, s, 1)}
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
                : avail === "available"
                  ? "Nothing available on hand. Switch to All lots to see what was used."
                  : `No lots${filter ? ` of type ${typeLabels[filter]}` : ""} yet.`}
            </div>
          ) : (
            <StockTable key={`${q}|${filter ?? ""}|${avail}|${page}`} groups={shown} defaultOpen={Boolean(q)} />
          )}
          {pageCount > 1 ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center", paddingTop: 14, fontSize: 13 }}>
              {page > 1 ? (
                <Link href={pageHref(filter, avail, q, size, page - 1)} className="btn" style={{ padding: "4px 12px" }}>← Prev</Link>
              ) : null}
              <span style={{ color: "var(--text-muted)" }}>
                Page {page} of {pageCount} · {groups.length} product{groups.length === 1 ? "" : "s"}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(filter, avail, q, size, page + 1)} className="btn" style={{ padding: "4px 12px" }}>Next →</Link>
              ) : null}
            </div>
          ) : null}
          <div style={{ fontSize: 12, color: "var(--text-faint)", paddingTop: 12 }}>
            Replication uses the lot&apos;s numbers, not the label&apos;s; a new Willamette
            packet at 4.3% AA means weighing ~1.6 oz, not 1 oz, to hit the same IBU.
          </div>
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
