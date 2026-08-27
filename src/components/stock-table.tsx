"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { StockItem } from "@/lib/db/schema";
import { deleteStockItem } from "@/lib/inventory/actions";
import { bestByStatus, formatCost, formatDate, formatMonthYearNumeric, formatQuantity } from "@/lib/inventory/format";
import { typeBadge, typeLabels } from "@/lib/inventory/stock-labels";
import { DeleteButton } from "./delete-button";

export type StockLot = StockItem & {
  purchaseName: string | null;
  /** Batches whose snapshot references this lot — where it went. */
  usedIn: Array<{ id: string; label: string }>;
};

/** One product (type + name), 1..many purchase lots. The lots are the real
    rows — the group line just rolls them up so 15 packs of US-05 read as one
    line, not two pages. */
export type StockGroup = {
  key: string;
  type: StockItem["type"];
  name: string;
  lots: StockLot[];
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

/** Sum on-hand per unit: 15 pkg across lots → "15 pkg"; mixed units join. */
function onHandRollup(lots: StockLot[]): string {
  const byUnit = new Map<string, number>();
  for (const l of lots) {
    const u = l.unit ?? "ct";
    byUnit.set(u, (byUnit.get(u) ?? 0) + l.quantityOnHand);
  }
  return [...byUnit.entries()].map(([u, n]) => formatQuantity(n, u)).join(" · ");
}

function soonestBestBy(lots: StockLot[]): Date | null {
  const dates = lots.map((l) => l.bestByDate).filter((d): d is Date => d != null);
  if (!dates.length) return null;
  return dates.sort((a, b) => a.getTime() - b.getTime())[0];
}

function OnHandCell({ lot }: { lot: StockLot }) {
  return (
    <>
      {formatQuantity(lot.quantityOnHand, lot.unit)}
      {lot.usedIn.length > 0 ? (
        <span style={{ color: "var(--text-faint)", fontSize: 12 }}>
          {" "}· used in{" "}
          {lot.usedIn.map((b, i) => (
            <React.Fragment key={b.id}>
              {i > 0 ? ", " : null}
              <Link
                href={`/batches/${b.id}`}
                style={{ color: "var(--accent)" }}
                onClick={(e) => e.stopPropagation()}
                title={`Open batch ${b.label}`}
              >
                {b.label}
              </Link>
            </React.Fragment>
          ))}
        </span>
      ) : lot.quantityOnHand <= 0 && lot.quantity != null ? (
        <span style={{ color: "var(--text-faint)", fontSize: 12 }}> (used)</span>
      ) : null}
    </>
  );
}

function PurchasedCell({ lot }: { lot: StockLot }) {
  if (lot.purchaseId && lot.purchaseName) {
    return (
      <Link href={`/purchases/${lot.purchaseId}`} title={`Open purchase: ${lot.purchaseName}`}>
        {formatDate(lot.purchaseDate)}
      </Link>
    );
  }
  return <>{formatDate(lot.purchaseDate)}</>;
}

function CostCell({ lot }: { lot: StockLot }) {
  if (lot.cost != null) return <>{formatCost(lot.cost)}</>;
  if (lot.purchaseId && lot.purchaseName) {
    return (
      <Link href={`/purchases/${lot.purchaseId}`} style={{ fontSize: 12, color: "var(--text-muted)" }}>
        part of {lot.purchaseName}
      </Link>
    );
  }
  return <>—</>;
}

function ActionCell({ lot }: { lot: StockLot }) {
  return (
    <>
      <Link href={`/stock/${lot.id}/edit`}>Edit</Link>
      {" · "}
      <DeleteButton
        action={deleteStockItem}
        id={lot.id}
        confirmText={`Delete lot "${lot.name}"? This can't be undone.`}
      />
    </>
  );
}

export function StockTable({
  groups,
  defaultOpen = false,
}: {
  groups: StockGroup[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(defaultOpen ? groups.map((g) => g.key) : [])
  );
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
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
          {groups.map((g) => {
            const badge = (
              <span className="badge" style={{ background: typeBadge[g.type] }}>
                {typeLabels[g.type].toUpperCase()}
              </span>
            );
            if (g.lots.length === 1) {
              const lot = g.lots[0];
              return (
                <tr key={g.key}>
                  <td>{badge}</td>
                  <td style={{ color: "var(--text-bright)" }}>{lot.name}</td>
                  <td>{lot.lotNumber ?? "—"}</td>
                  <td>{keyNumbers(lot)}</td>
                  <td><OnHandCell lot={lot} /></td>
                  <td><BestBy d={lot.bestByDate} /></td>
                  <td><PurchasedCell lot={lot} /></td>
                  <td style={{ textAlign: "right" }}><CostCell lot={lot} /></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}><ActionCell lot={lot} /></td>
                </tr>
              );
            }
            const isOpen = open.has(g.key);
            return (
              <React.Fragment key={g.key}>
                <tr
                  onClick={() => toggle(g.key)}
                  style={{ cursor: "pointer" }}
                  title={isOpen ? "Collapse lots" : "Show the lots"}
                >
                  <td>{badge}</td>
                  <td style={{ color: "var(--text-bright)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span
                        aria-hidden
                        style={{
                          display: "inline-block",
                          transition: "transform 0.15s",
                          transform: isOpen ? "rotate(90deg)" : "none",
                          color: "var(--accent)",
                          fontSize: 11,
                        }}
                      >
                        ▶
                      </span>
                      {g.name}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{g.lots.length} lots</td>
                  <td style={{ color: "var(--text-faint)", fontSize: 12 }}>per lot ↓</td>
                  <td style={{ color: "var(--text-bright)" }}>{onHandRollup(g.lots)}</td>
                  <td><BestBy d={soonestBestBy(g.lots)} /></td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{g.lots.length} purchases</td>
                  <td style={{ textAlign: "right", color: "var(--text-faint)", fontSize: 12 }}>—</td>
                  <td style={{ textAlign: "right" }}></td>
                </tr>
                {isOpen
                  ? g.lots.map((lot) => (
                      <tr key={lot.id} style={{ background: "rgba(255,255,255,0.02)" }}>
                        <td></td>
                        <td style={{ paddingLeft: 26, color: "var(--text)" }}>↳ {lot.name}</td>
                        <td>{lot.lotNumber ?? "—"}</td>
                        <td>{keyNumbers(lot)}</td>
                        <td><OnHandCell lot={lot} /></td>
                        <td><BestBy d={lot.bestByDate} /></td>
                        <td><PurchasedCell lot={lot} /></td>
                        <td style={{ textAlign: "right" }}><CostCell lot={lot} /></td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}><ActionCell lot={lot} /></td>
                      </tr>
                    ))
                  : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
