import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, purchases, type Equipment } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteEquipment } from "@/lib/inventory/actions";
import { formatCost, formatMonth } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { BoxIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";

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
  searchParams: Promise<{ status?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { status } = await searchParams;
  // Active is what matters at a glance — it's the default view.
  const filter =
    status === "all"
      ? null
      : ["wanted", "retired"].includes(status ?? "")
        ? (status as "wanted" | "retired")
        : "active";

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
      .map((p) => [p.id, p.name])
  );

  const shown = (filter ? all.filter((e) => e.status === filter) : all).sort(
    (a, b) =>
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
      a.name.localeCompare(b.name)
  );

  const enteredCosts = all
    .filter((e) => e.status === "active" && e.cost != null)
    .reduce((sum, e) => sum + (e.cost ?? 0), 0);
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20, marginBottom: 18 }}>
        <div className="panel" style={{ borderLeft: "3px solid var(--accent)", padding: "12px 16px" }}>
          <div className="field-label" style={{ marginBottom: 0 }}>Entered costs</div>
          <div style={{ color: "var(--text-bright)", fontSize: 19, fontWeight: 300 }}>{formatCost(enteredCosts || null)}</div>
        </div>
        <div className="panel" style={{ borderLeft: "3px solid var(--success)", padding: "12px 16px" }}>
          <div className="field-label" style={{ marginBottom: 0 }}>Active items</div>
          <div style={{ color: "var(--text-bright)", fontSize: 19, fontWeight: 300 }}>{activeCount}</div>
        </div>
        <div className="panel" style={{ borderLeft: "3px solid var(--info)", padding: "12px 16px" }}>
          <div className="field-label" style={{ marginBottom: 0 }}>Wanted</div>
          <div style={{ color: "var(--text-bright)", fontSize: 19, fontWeight: 300 }}>{wantedCount}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <Chip href="/equipment" label="Active" active={filter === "active"} />
        <Chip href="/equipment?status=wanted" label="Wanted" active={filter === "wanted"} />
        <Chip href="/equipment?status=retired" label="Retired" active={filter === "retired"} />
        <Chip href="/equipment?status=all" label="All" active={filter === null} />
      </div>
      <div className="panel">
        <div className="panel-heading">
          Inventory
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>
            costs sum only what&apos;s been entered
          </span>
        </div>
        <div className="panel-body">
          {shown.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              Nothing here yet — add equipment or run <code>npm run db:seed</code>.
            </div>
          ) : (
            <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Key specs</th>
                  <th>Status</th>
                  <th>Purchased</th>
                  <th style={{ textAlign: "right" }}>Cost</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e: Equipment) => (
                  <tr key={e.id}>
                    <td>{categoryLabels[e.category]}</td>
                    <td style={{ color: "var(--text-bright)" }}>{e.name}</td>
                    <td>{e.specs ?? "—"}</td>
                    <td>
                      <StatusCell item={e} />
                    </td>
                    <td>
                      {e.purchaseId && purchaseNames.has(e.purchaseId) ? (
                        <Link
                          href={`/purchases/${e.purchaseId}`}
                          title={`Open purchase: ${purchaseNames.get(e.purchaseId)}`}
                        >
                          {formatMonth(e.purchaseDate)}
                        </Link>
                      ) : (
                        formatMonth(e.purchaseDate)
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {e.cost != null ? (
                        formatCost(e.cost)
                      ) : e.purchaseId && purchaseNames.has(e.purchaseId) ? (
                        <Link
                          href={`/purchases/${e.purchaseId}`}
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                        >
                          part of {purchaseNames.get(e.purchaseId)}
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
        </div>
      </div>
    </>
  );
}

function StatusCell({ item }: { item: Equipment }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {item.status === "active" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
          Active
        </span>
      ) : item.status === "wanted" ? (
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
