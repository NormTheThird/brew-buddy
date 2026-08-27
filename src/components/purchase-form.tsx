"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  analyzeReceipt,
  createPurchase,
  type AnalyzeState,
  type FormState,
} from "@/lib/purchases/actions";

export function PurchaseForm() {
  const [state, createAction, creating] = useActionState<FormState, FormData>(
    createPurchase,
    {}
  );
  const [analysis, analyzeAction, analyzing] = useActionState<AnalyzeState, FormData>(
    analyzeReceipt,
    {}
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [totalCost, setTotalCost] = useState("");

  // Dispatch analyze WITHOUT submitting the form — a form-action submission
  // makes React reset uncontrolled fields, losing the pasted text / chosen file
  // before Create runs.
  function runAnalyze() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTransition(() => analyzeAction(fd));
  }

  // When the AI reads the receipt, fill any field the user hasn't typed in.
  useEffect(() => {
    const p = analysis.proposal;
    if (!p) return;
    setName((v) => v || p.suggestedName || "");
    setVendor((v) => v || p.vendor || "");
    setPurchaseDate((v) => v || p.purchaseDate || "");
    setTotalCost((v) => v || (p.totalCost != null ? String(p.totalCost) : ""));
  }, [analysis.proposal]);

  const proposal = analysis.proposal;

  return (
    <form
      ref={formRef}
      action={createAction}
      className="panel"
      style={{ maxWidth: 640, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div>
        <label className="field-label" htmlFor="receipt">Receipt (photo or PDF)</label>
        <input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" className="field" style={{ padding: 8 }} />
      </div>
      <div>
        <label className="field-label" htmlFor="receiptText">…or paste order text (email / order page)</label>
        <textarea
          id="receiptText"
          name="receiptText"
          className="field"
          rows={5}
          placeholder="Paste the order confirmation — line items, prices, totals. Ignored if a file is chosen above."
        />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={runAnalyze} className="btn" disabled={analyzing || creating}>
          {analyzing ? "Reading…" : "Read with AI — fill the form for me"}
        </button>
        {analyzing ? (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            usually 10–60 seconds — kits get looked up to expand their contents
          </span>
        ) : null}
        {analysis.error ? (
          <span style={{ color: "var(--danger)", fontSize: 13 }}>{analysis.error}</span>
        ) : null}
      </div>
      {proposal ? (
        <div className="panel" style={{ borderLeft: "3px solid var(--success)", padding: "10px 14px", fontSize: 13 }}>
          Read {proposal.items.length} line item{proposal.items.length === 1 ? "" : "s"}
          {proposal.items.length > 0
            ? `: ${proposal.items.slice(0, 3).map((i) => i.name).join(", ")}${proposal.items.length > 3 ? "…" : ""}`
            : ""}
          {proposal.discountCode
            ? `. Discount code ${proposal.discountCode} spotted — it'll be noted on the purchase`
            : ""}
          . Fields below are filled from the order — fix anything it misread, then
          create; you&apos;ll review the items before they&apos;re saved.
          <input type="hidden" name="proposalJson" value={JSON.stringify(proposal)} />
        </div>
      ) : null}
      <div>
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" name="name" className="field" placeholder='e.g. "Block Party Amber kit"' value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="vendor">Vendor</label>
          <input id="vendor" name="vendor" className="field" placeholder="Northern Brewer" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="purchaseDate">Date</label>
          <input id="purchaseDate" name="purchaseDate" type="date" className="field" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="totalCost">Total cost ($)</label>
          <input id="totalCost" name="totalCost" type="number" step="0.01" min="0" className="field" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="field" rows={3} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Receipt or pasted text is stored privately with the purchase, viewable later.
      </div>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-solid" disabled={creating || analyzing}>
          {creating ? "Saving…" : "Create purchase"}
        </button>
        <Link href="/purchases" className="btn">Cancel</Link>
      </div>
    </form>
  );
}
