import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, purchases, type Equipment } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteEquipment } from "@/lib/inventory/actions";
import { formatCost, formatDate } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { BoxIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";
import { TableSearch } from "@/components/table-search";

const categoryLabels: Record<string, string> = {
  kettle: "Kettle",
  chilling: "Chilling",
  fermentation: "Fermentation",
  measurement: "Measurement",
  bottling: "Bottling",
  cleaning: "Cleaning",
  water: "Water",
  other: "Other",
};
const categoryOrder = Object.keys(categoryLabels);

const PAGE_SIZES = ["10", "25", "50", "all"] as const;

function pageHref(
  status: string | null,
  q: string,
  size: string,
  page: number
): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (size !== "10") params.set("size", size);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/equipment?${s}` : "/equipment";
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
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

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; size?: string; page?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const params = await searchParams;
  const { status } = params;
  const q = (params.q ?? "").trim();
  const size = PAGE_SIZES.includes((params.size ?? "") as (typeof PAGE_SIZES)[number])
    ? (params.size as (typeof PAGE_SIZES)[number])
    : "10";
  // Active is what matters at a glance — it's the default view.
  const filter =
    status === "all"
      ? null
      : ["wanted", "retired"].includes(status ?? "")
        ? (status as "wanted" | "retired")
        : "active";
  const statusParam = status === "all" ? "all" : filter === "active" ? null : filter;

  const all = db
    .select()
    .from(equipment)
    .where(eq(equipment.userId, user.id))
    .all();

  const purchaseNames = new Map(
    db
      .select({ id: purchases.id, name: purchases.name })
      .from(purchases)
      .where(eq(purchases.userId, user.id))
      .all()
      .map((p) => [p.id, p.name] as const)
  );

  const needle = q.toLowerCase();
  const filtered = (filter ? all.filter((e) => e.status === filter) : all)
    .filter(
      (e) =>
        !q ||
        [e.name, e.specs, e.notes, e.flag, categoryLabels[e.category]]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(needle))
    )
    .sort(
      (a, b) =>
        categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
        a.name.localeCompare(b.name)
    );

  const perPage = size === "all" ? filtered.length || 1 : Number(size);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const shown = filtered.slice((page - 1) * perPage, page * perPage);

  const activeCount = all.filter((e) => e.status === "active").length;
  const wantedCount = all.filter((e) => e.status === "wanted").length;

  return (
    <>
      <PageHeader
        icon={<BoxIcon size={40} />}
        title="Equipment"
        subtitle="What you own, what it does, what it cost"
        actions={
          <>
            <Link href="/equipment/new" className="btn">Add manually</Link>
            <Link href="/purchases/new" className="btn btn-solid">+ New purchase</Link>
          </>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, marginBottom: 18 }}>
        <div className="panel" style={{ borderLeft: "3px solid var(--success)", padding: "12px 16px" }}>
          <div className="field-label" style={{ marginBottom: 0 }}>Active items</div>
          <div style={{ color: "var(--text-bright)", fontSize: 19, fontWeight: 300 }}>{activeCount}</div>
        </div>
        <div className="panel" style={{ borderLeft: "3px solid var(--info)", padding: "12px 16px" }}>
          <div className="field-label" style={{ marginBottom: 0 }}>Wanted</div>
          <div style={{ color: "var(--text-bright)", fontSize: 19, fontWeight: 300 }}>{wantedCount}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Chip href={pageHref(null, q, size, 1)} label="Active" active={filter === "active"} />
        <Chip href={pageHref("wanted", q, size, 1)} label="Wanted" active={filter === "wanted"} />
        <Chip href={pageHref("retired", q, size, 1)} label="Retired" active={filter === "retired"} />
        <Chip href={pageHref("all", q, size, 1)} label="All" active={filter === null} />
        <div style={{ flex: 1, minWidth: 240, display: "flex", justifyContent: "flex-end" }}>
          <TableSearch basePath="/equipment" placeholder="Type 3+ letters to filter: name, specs, category…" />
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          {q ? `Matches for "${q}" (${filtered.length})` : "Inventory"}
          <span style={{ display: "flex", gap: 8, fontSize: 12, fontWeight: 400 }}>
            {PAGE_SIZES.map((s) => (
              <Link
                key={s}
                href={pageHref(statusParam, q, s, 1)}
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
              {q ? `Nothing matches "${q}".` : <>Nothing here yet. Add equipment or run <code>npm run db:seed</code>.</>}
            </div>
          ) : (
            <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Key specs</th>
                  <th style={{ textAlign: "center" }}>Qty</th>
                  <th>Status</th>
                  <th>Purchased</th>
                  <th style={{ textAlign: "right" }}>Cost</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e: Equipment) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{categoryLabels[e.category]}</td>
                    <td style={{ color: "var(--text-bright)", whiteSpace: "nowrap" }}>{e.name}</td>
                    {/* Key specs is the ONE column allowed to wrap. */}
                    <td>{e.specs ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>{e.quantity}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <StatusCell item={e} />
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {e.purchaseId && purchaseNames.has(e.purchaseId) ? (
                        <Link
                          href={`/purchases/${e.purchaseId}`}
                          title={`Open purchase: ${purchaseNames.get(e.purchaseId)!}`}
                        >
                          {formatDate(e.purchaseDate)}
                        </Link>
                      ) : (
                        formatDate(e.purchaseDate)
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {e.cost != null ? (
                        formatCost(e.cost)
                      ) : e.purchaseId && purchaseNames.has(e.purchaseId) ? (
                        <Link
                          href={`/purchases/${e.purchaseId}`}
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                          title={`Part of ${purchaseNames.get(e.purchaseId)!}. Open the purchase for the cost`}
                        >
                          part of kit
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/equipment/${e.id}/edit`}>Edit</Link>
                      {" · "}
                      <DeleteButton
                        action={deleteEquipment}
                        id={e.id}
                        confirmText={`Delete "${e.name}"? This can't be undone.`}
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
                <Link href={pageHref(statusParam, q, size, page - 1)} className="btn" style={{ padding: "4px 12px" }}>← Prev</Link>
              ) : null}
              <span style={{ color: "var(--text-muted)" }}>
                Page {page} of {pageCount} · {filtered.length} item{filtered.length === 1 ? "" : "s"}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(statusParam, q, size, page + 1)} className="btn" style={{ padding: "4px 12px" }}>Next →</Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function StatusCell({ item }: { item: Equipment }) {
  // A flagged item isn't fully "Active" — the flag IS its status. It still
  // lives under the Active filter (only Retired removes it from service).
  if (item.status === "active") {
    return item.flag ? (
      <span className="badge" style={{ background: "var(--warning)" }} title="Needs attention: still in service">
        {item.flag.toUpperCase()}
      </span>
    ) : (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
        Active
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {item.status === "wanted" ? (
        <span className="badge" style={{ background: "var(--info)" }}>WANTED</span>
      ) : (
        <span className="badge" style={{ background: "#44464f", color: "var(--text)" }}>RETIRED</span>
      )}
      {item.flag ? (
        <span className="badge" style={{ background: "var(--warning)" }}>{item.flag.toUpperCase()}</span>
      ) : null}
    </span>
  );
}
