import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, ingredients, purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { applyProposal, deletePurchase, discardProposal } from "@/lib/purchases/actions";
import type { ReceiptProposal } from "@/lib/purchases/receipt-ai";
import { formatCost, formatMonth } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { ReceiptIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";
import { ExtractButton } from "@/components/extract-button";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const p = db
    .select()
    .from(purchases)
    .where(and(eq(purchases.id, numId), eq(purchases.userId, user.id)))
    .all()[0];
  if (!p) notFound();

  const equipItems = db
    .select()
    .from(equipment)
    .where(and(eq(equipment.purchaseId, p.id), eq(equipment.userId, user.id)))
    .all();
  const ingItems = db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.purchaseId, p.id), eq(ingredients.userId, user.id)))
    .all();

  const proposal: ReceiptProposal | null = p.proposalJson
    ? (JSON.parse(p.proposalJson) as ReceiptProposal)
    : null;
  const isImage = p.receiptMime?.startsWith("image/") ?? false;

  return (
    <>
      <PageHeader
        icon={<ReceiptIcon size={40} />}
        title={p.name}
        subtitle={[p.vendor, formatMonth(p.purchaseDate), formatCost(p.totalCost)]
          .filter((s) => s && s !== "—")
          .join(" · ")}
        actions={
          <>
            <Link href="/purchases" className="btn">← Purchases</Link>
            <DeleteButton
              action={deletePurchase}
              id={p.id}
              label="Delete purchase"
              confirmText={`Delete "${p.name}"? Linked items stay but lose the link; the receipt file is removed.`}
            />
          </>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, alignItems: "start" }}>
        <div className="panel">
          <div className="panel-heading">Receipt</div>
          <div className="panel-body">
            {p.receiptPath ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/purchases/${p.id}/receipt`}
                    alt={`Receipt for ${p.name}`}
                    style={{ maxWidth: "100%", borderRadius: 3, border: "1px solid var(--border)" }}
                  />
                ) : (
                  <div style={{ fontSize: 13 }}>
                    {p.receiptMime === "text/plain" ? "Pasted order text stored." : "PDF receipt stored."}
                  </div>
                )}
                <Link href={`/purchases/${p.id}/receipt`} target="_blank" style={{ fontSize: 13 }}>
                  Open full receipt
                </Link>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No receipt attached to this purchase.
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {proposal ? (
            <div className="panel" style={{ borderLeft: "3px solid var(--accent)" }}>
              <div className="panel-heading">Review AI-proposed items</div>
              <div className="panel-body">
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                  Nothing is saved until you apply. Uncheck anything the AI misread
                  {proposal.vendor ? ` · vendor read as "${proposal.vendor}"` : ""}
                  {proposal.totalCost != null ? ` · total read as ${formatCost(proposal.totalCost)}` : ""}.
                </div>
                <form action={applyProposal}>
                  <input type="hidden" name="id" value={p.id} />
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}></th>
                          <th>Kind</th>
                          <th>Name</th>
                          <th>Category / type</th>
                          <th>Qty</th>
                          <th style={{ textAlign: "right" }}>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposal.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <input type="checkbox" name="accept" value={idx} defaultChecked />
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{ background: item.kind === "equipment" ? "var(--primary)" : "var(--success)" }}
                              >
                                {item.kind.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ color: "var(--text-bright)" }}>{item.name}</td>
                            <td>{item.category ?? item.type ?? "—"}</td>
                            <td>{item.quantity != null ? `${item.quantity} ${item.unit ?? ""}` : "—"}</td>
                            <td style={{ textAlign: "right" }}>{formatCost(item.cost ?? null)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button type="submit" className="btn btn-solid">Apply checked items</button>
                  </div>
                </form>
                <form action={discardProposal} style={{ marginTop: 10 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: 0, fontFamily: "inherit" }}
                  >
                    Discard proposal
                  </button>
                </form>
              </div>
            </div>
          ) : p.receiptPath ? (
            <div className="panel">
              <div className="panel-heading">Import items from this receipt</div>
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13 }}>
                  Claude reads the receipt and proposes equipment and ingredient rows —
                  you review every line before anything is written.
                </div>
                <ExtractButton purchaseId={p.id} />
              </div>
            </div>
          ) : null}
          <div className="panel">
            <div className="panel-heading">Items in this purchase</div>
            <div className="panel-body">
              {equipItems.length + ingItems.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Nothing linked yet — apply an AI proposal above, or set this purchase
                  on an item&apos;s edit form.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                  {equipItems.map((e) => (
                    <li key={`e${e.id}`}>
                      <Link href={`/equipment/${e.id}/edit`}>{e.name}</Link>
                      <span style={{ color: "var(--text-faint)" }}> · equipment</span>
                    </li>
                  ))}
                  {ingItems.map((i) => (
                    <li key={`i${i.id}`}>
                      <Link href={`/ingredients/${i.id}/edit`}>{i.name}</Link>
                      <span style={{ color: "var(--text-faint)" }}> · ingredient</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {p.notes ? (
            <div className="panel">
              <div className="panel-heading">Notes</div>
              <div className="panel-body" style={{ fontSize: 13 }}>{p.notes}</div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
