"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Equipment } from "@/lib/db/schema";
import { equipmentCategories } from "@/lib/db/schema";
import type { FormState } from "@/lib/inventory/actions";

const labels: Record<string, string> = {
  kettle: "Kettle",
  chilling: "Chilling",
  fermentation: "Fermentation",
  measurement: "Measurement",
  bottling: "Bottling",
  cleaning: "Cleaning",
  water: "Water",
  other: "Other",
};

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function EquipmentForm({
  action,
  item,
  purchaseOptions = [],
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  item?: Equipment;
  purchaseOptions?: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {}
  );

  return (
    <form
      action={formAction}
      className="panel"
      style={{
        maxWidth: 640,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="name">Name</label>
          <input id="name" name="name" className="field" defaultValue={item?.name} required />
        </div>
        <div>
          <label className="field-label" htmlFor="category">Category</label>
          <select id="category" name="category" className="field" defaultValue={item?.category ?? "kettle"}>
            {equipmentCategories.map((c) => (
              <option key={c} value={c}>{labels[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="status">Status</label>
          <select id="status" name="status" className="field" defaultValue={item?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="wanted">Wanted</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="specs">Key specs</label>
        <input id="specs" name="specs" className="field" defaultValue={item?.specs ?? ""} placeholder='e.g. 7.5 gal · 110V · 1600W' />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="purchaseDate">Purchased</label>
          <input id="purchaseDate" name="purchaseDate" type="date" className="field" defaultValue={toDateInput(item?.purchaseDate ?? null)} />
        </div>
        <div>
          <label className="field-label" htmlFor="cost">Cost ($)</label>
          <input id="cost" name="cost" type="number" step="0.01" min="0" className="field" defaultValue={item?.cost ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="flag">Warning flag</label>
          <input id="flag" name="flag" className="field" defaultValue={item?.flag ?? ""} placeholder="e.g. not calibrated" />
        </div>
      </div>
      {purchaseOptions.length > 0 ? (
        <div>
          <label className="field-label" htmlFor="purchaseId">Part of purchase</label>
          <select id="purchaseId" name="purchaseId" className="field" defaultValue={item?.purchaseId ?? ""}>
            <option value="">— none (priced individually)</option>
            {purchaseOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="field" rows={3} defaultValue={item?.notes ?? ""} />
      </div>
      {state.error ? (
        <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div>
      ) : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Saving…" : item ? "Save changes" : "Add equipment"}
        </button>
        <Link href="/equipment" className="btn">Cancel</Link>
      </div>
    </form>
  );
}
