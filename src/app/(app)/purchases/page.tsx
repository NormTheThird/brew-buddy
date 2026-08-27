import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, ingredients, purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCost, formatDate } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { ReceiptIcon } from "@/components/icons";

export default async function PurchasesPage() {
  const user = (await getCurrentUser())!;
  const all = db
    .select()
    .from(purchases)
    .where(eq(purchases.userId, user.id))
    .all()
    .sort((a, b) => (b.purchaseDate?.getTime() ?? 0) - (a.purchaseDate?.getTime() ?? 0));

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

  const total = all.reduce((sum, p) => sum + (p.totalCost ?? 0), 0);

  return (
    <>
      <PageHeader
        icon={<ReceiptIcon size={40} />}
        title="Purchases"
        subtitle="Kits and orders — one total cost, receipt attached, items linked"
        actions={<Link href="/purchases/new" className="btn btn-solid">+ New purchase</Link>}
      />
      <div className="panel" style={{ borderLeft: "3px solid var(--accent)", padding: "12px 16px", marginBottom: 18 }}>
        <div className="field-label" style={{ marginBottom: 0 }}>Total across purchases</div>
        <div style={{ color: "var(--text-bright)", fontSize: 19, fontWeight: 300 }}>{formatCost(total || null)}</div>
      </div>
      <div className="panel">
        <div className="panel-heading">All purchases</div>
        <div className="panel-body">
          {all.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              No purchases yet. A purchase groups items bought together — a kit or one
              order — and can hold a receipt for AI import.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Purchase</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Receipt</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((p) => (
                    <tr key={p.id}>
                      <td style={{ color: "var(--text-bright)" }}>
                        <Link href={`/purchases/${p.id}`}>{p.name}</Link>
                      </td>
                      <td>{p.vendor ?? "—"}</td>
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
        </div>
      </div>
    </>
  );
}
