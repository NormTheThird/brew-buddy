import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, ingredients, purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCost, formatDate } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { ReceiptIcon } from "@/components/icons";
import { PurchaseSearch } from "@/components/purchase-search";

const PAGE_SIZES = ["10", "25", "50", "all"] as const;

function pageHref(q: string, size: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (size !== "10") params.set("size", size);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/purchases?${s}` : "/purchases";
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; size?: string; page?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const size = PAGE_SIZES.includes((params.size ?? "") as (typeof PAGE_SIZES)[number])
    ? (params.size as (typeof PAGE_SIZES)[number])
    : "10";

  const all = db
    .select()
    .from(purchases)
    .where(eq(purchases.userId, user.id))
    .all()
    .sort((a, b) => (b.purchaseDate?.getTime() ?? 0) - (a.purchaseDate?.getTime() ?? 0));

  const needle = q.toLowerCase();
  const filtered = q
    ? all.filter((p) =>
        [p.name, p.vendor, p.orderNumber, p.notes]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(needle))
      )
    : all;

  const perPage = size === "all" ? filtered.length || 1 : Number(size);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const shown = filtered.slice((page - 1) * perPage, page * perPage);

  const equipCounts = db
    .select({ purchaseId: equipment.purchaseId })
    .from(equipment)
    .where(eq(equipment.userId, user.id))
    .all();
  const ingCounts = db
    .select({ purchaseId: ingredients.purchaseId })
    .from(ingredients)
    .where(eq(ingredients.userId, user.id))
    .all();
  const itemCount = (id: number) =>
    equipCounts.filter((e) => e.purchaseId === id).length +
    ingCounts.filter((i) => i.purchaseId === id).length;

  const total = filtered.reduce((sum, p) => sum + (p.totalCost ?? 0), 0);

  return (
    <>
      <PageHeader
        icon={<ReceiptIcon size={40} />}
        title="Purchases"
        subtitle="Kits and orders — one total cost, receipt attached, items linked"
        actions={<Link href="/purchases/new" className="btn btn-solid">+ New purchase</Link>}
      />
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
          <PurchaseSearch />
        </div>
        <div className="panel" style={{ borderLeft: "3px solid var(--accent)", padding: "8px 14px" }}>
          <span className="field-label" style={{ marginBottom: 0 }}>
            {q ? "Total (matches)" : "Total across purchases"}{" "}
          </span>
          <span style={{ color: "var(--text-bright)", fontSize: 16, fontWeight: 300 }}>
            {formatCost(total || null)}
          </span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          {q ? `Matches for "${q}" — ${filtered.length}` : "All purchases"}
          <span style={{ display: "flex", gap: 8, fontSize: 12, fontWeight: 400 }}>
            {PAGE_SIZES.map((s) => (
              <Link
                key={s}
                href={pageHref(q, s, 1)}
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
              {q ? `Nothing matches "${q}".` : "No purchases yet. A purchase groups items bought together — a kit or one order — and can hold a receipt for AI import."}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Purchase</th>
                    <th>Vendor</th>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Receipt</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: "var(--text-bright)" }}>
                        <Link href={`/purchases/${p.id}`}>{p.name}</Link>
                      </td>
                      <td>{p.vendor ?? "—"}</td>
                      <td>{p.orderNumber ?? "—"}</td>
                      <td>{formatDate(p.purchaseDate)}</td>
                      <td>{itemCount(p.id)}</td>
                      <td>{p.receiptPath ? <Link href={`/purchases/${p.id}/receipt`} target="_blank">view</Link> : "—"}</td>
                      <td style={{ textAlign: "right" }}>{formatCost(p.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pageCount > 1 ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center", paddingTop: 14, fontSize: 13 }}>
              {page > 1 ? (
                <Link href={pageHref(q, size, page - 1)} className="btn" style={{ padding: "4px 12px" }}>← Prev</Link>
              ) : null}
              <span style={{ color: "var(--text-muted)" }}>
                Page {page} of {pageCount} · {filtered.length} purchase{filtered.length === 1 ? "" : "s"}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(q, size, page + 1)} className="btn" style={{ padding: "4px 12px" }}>Next →</Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
