"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createPurchase, type FormState } from "@/lib/purchases/actions";

export function PurchaseForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPurchase,
    {}
  );

  return (
    <form
      action={formAction}
      className="panel"
      style={{ maxWidth: 640, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div>
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" name="name" className="field" placeholder='e.g. "Block Party Amber kit"' required />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="vendor">Vendor</label>
          <input id="vendor" name="vendor" className="field" placeholder="Northern Brewer" />
        </div>
        <div>
          <label className="field-label" htmlFor="purchaseDate">Date</label>
          <input id="purchaseDate" name="purchaseDate" type="date" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="totalCost">Total cost ($)</label>
          <input id="totalCost" name="totalCost" type="number" step="0.01" min="0" className="field" />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="receipt">Receipt (photo or PDF, optional)</label>
        <input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" className="field" style={{ padding: 8 }} />
      </div>
      <div>
        <label className="field-label" htmlFor="receiptText">…or paste order text (email / order page)</label>
        <textarea
          id="receiptText"
          name="receiptText"
          className="field"
          rows={5}
          placeholder="Paste the order confirmation here — line items, prices, totals. Ignored if a file is chosen above."
        />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Stored privately with the purchase. AI can read either and propose items — you
          review everything before it&apos;s saved.
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="field" rows={3} />
      </div>
      {state.error ? (
        <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div>
      ) : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Saving…" : "Create purchase"}
        </button>
        <Link href="/purchases" className="btn">Cancel</Link>
      </div>
    </form>
  );
}
