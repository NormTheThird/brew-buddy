import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, ingredients, purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { applyProposal, combineProposalItems, deletePurchase, discardProposal } from "@/lib/purchases/actions";
import type { ReceiptProposal } from "@/lib/purchases/receipt-ai";
import { formatCost, formatDate } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { ReceiptIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";
import { ExtractButton } from "@/components/extract-button";
import { RemoveItemButton } from "@/components/remove-item-button";
import { RescanControls } from "@/components/rescan-controls";
import { findLikelyMatch } from "@/lib/inventory/match";

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

  // For individually-priced lines (never kit components), look for an existing
  // item the user added manually — they confirm same vs new in the table.
  const allEquip = proposal
    ? db.select().from(equipment).where(eq(equipment.userId, user.id)).all()
    : [];
  const allIng = proposal
    ? db.select().from(ingredients).where(eq(ingredients.userId, user.id)).all()
    : [];
  const matches: Array<{ id: number; name: string } | undefined> = (proposal?.items ?? []).map(
    (item) => {
      if (item.partOfKit) return undefined;
      const pool = (
        item.kind === "equipment"
          ? allEquip.filter((e) => e.purchaseId !== p.id)
          : allIng.filter((i) => i.purchaseId !== p.id)
      ).map((x) => ({ id: x.id, name: x.name }));
      return findLikelyMatch(item.name, pool);
    }
  );
  const isImage = p.receiptMime?.startsWith("image/") ?? false;

  return (
    <>
      <PageHeader
        icon={<ReceiptIcon size={40} />}
        title={p.name}
        subtitle={[
          p.vendor,
          p.orderNumber ? `Order ${p.orderNumber}` : null,
          formatDate(p.purchaseDate),
          formatCost(p.totalCost),
        ]
          .filter((s) => s && s !== "—")
          .join(" · ")}
        actions={
          <>
            <Link href="/purchases" className="btn">← Purchases</Link>
            <DeleteButton
              action={deletePurchase}
              id={p.id}
              label="Delete purchase"
              variant="button"
              confirmText={`Really delete "${p.name}"?\n\nThe stored receipt AND the items its import created are removed permanently. Kept safe: items that existed before (link cleared), and anything a batch has used — brew history is never touched.`}
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
                          <th style={{ width: 60, textAlign: "center" }}>Merge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposal.items.map((item, idx) => (
                          <React.Fragment key={idx}>
                          <tr>
                            <td>
                              <input type="checkbox" name="accept" value={idx} defaultChecked={!item.notBrewing} />
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{ background: item.kind === "equipment" ? "var(--primary)" : "var(--success)" }}
                              >
                                {item.kind.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ color: "var(--text-bright)" }}>
                              {item.name}
                              {item.partOfKit ? (
                                <span className="chip-estimate" style={{ marginLeft: 8, borderStyle: "solid" }}>
                                  FROM KIT
                                </span>
                              ) : null}
                              {item.notBrewing ? (
                                <span className="badge" style={{ marginLeft: 8, background: "#44464f", color: "var(--text)" }}>
                                  NOT BREWING?
                                </span>
                              ) : null}
                            </td>
                            <td>{item.category ?? item.type ?? "—"}</td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="number"
                                  name={`qty_${idx}`}
                                  defaultValue={item.quantity ?? 1}
                                  step="any"
                                  min="0"
                                  className="field"
                                  style={{ width: 72, padding: "5px 8px", fontSize: 12 }}
                                />
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.unit ?? "ct"}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>{formatCost(item.cost ?? null)}</td>
                            <td style={{ textAlign: "center" }}>
                              <input type="checkbox" name="combine" value={idx} title="Select to combine with another row" />
                            </td>
                          </tr>
                          {matches[idx] ? (
                            <tr>
                              <td></td>
                              <td colSpan={6} style={{ borderTop: "none", paddingTop: 0 }}>
                                <div style={{ background: "rgba(247,175,62,.1)", borderLeft: "3px solid var(--warning)", padding: "10px 12px", fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                  <span>
                                    Looks like <span style={{ color: "var(--text-bright)" }}>{matches[idx]!.name}</span>,
                                    which you already added — same item?
                                  </span>
                                  <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", minHeight: 24 }}>
                                    <input type="radio" name={`same_${idx}`} value={matches[idx]!.id} required style={{ margin: 0, flexShrink: 0, accentColor: "var(--accent)" }} />
                                    <span>
                                      {item.kind === "ingredient"
                                        ? "Same — restock it (adds this quantity) with this price & receipt"
                                        : "Same — update it with this price & receipt"}
                                    </span>
                                  </label>
                                  <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", minHeight: 24 }}>
                                    <input type="radio" name={`same_${idx}`} value="new" required style={{ margin: 0, flexShrink: 0, accentColor: "var(--accent)" }} />
                                    <span>Different — create a new item</span>
                                  </label>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <button type="submit" className="btn btn-solid">Apply checked items</button>
                    <button type="submit" formAction={combineProposalItems} formNoValidate className="btn">
                      Combine merge-checked into one (AI)
                    </button>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      tick 2+ in the Merge column to fuse them — name and summed cost handled for you
                    </span>
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
                <RescanControls purchaseId={p.id} />
              </div>
            </div>
          ) : p.proposalAppliedAt && equipItems.length + ingItems.length > 0 ? (
            <div className="panel" style={{ borderLeft: "3px solid var(--success)", padding: "12px 16px", fontSize: 13 }}>
              Items imported from this receipt on{" "}
              {formatDate(p.proposalAppliedAt)} — this happens once. Remove items below
              if something&apos;s wrong (removing everything re-enables the import).
            </div>
          ) : p.receiptPath ? (
            <div className="panel">
              <div className="panel-heading">Import items from this receipt</div>
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13 }}>
                  Claude reads the receipt once and proposes equipment and ingredient
                  rows — you set quantities and review every line before anything is
                  written.
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
                      <span style={{ color: "var(--text-faint)" }}>
                        {" "}· equipment{e.specs ? ` · ${e.specs}` : ""}
                      </span>{" "}
                      <RemoveItemButton kind="equipment" itemId={e.id} purchaseId={p.id} name={e.name} />
                    </li>
                  ))}
                  {ingItems.map((i) => (
                    <li key={`i${i.id}`}>
                      <Link href={`/ingredients/${i.id}/edit`}>{i.name}</Link>
                      <span style={{ color: "var(--text-faint)" }}>
                        {" "}· ingredient{i.quantity != null ? ` · ${i.quantity} ${i.unit}` : ""}
                      </span>{" "}
                      <RemoveItemButton kind="ingredient" itemId={i.id} purchaseId={p.id} name={i.name} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {p.notes ? (
            <div className="panel">
              <div className="panel-heading">Notes</div>
              <div className="panel-body" style={{ fontSize: 13, whiteSpace: "pre-line" }}>{p.notes}</div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
