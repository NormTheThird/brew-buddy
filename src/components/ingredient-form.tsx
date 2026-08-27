"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Ingredient, IngredientType } from "@/lib/db/schema";
import { ingredientTypes } from "@/lib/db/schema";
import { analyzeLabel, type FormState, type LabelAnalyzeState } from "@/lib/inventory/actions";

const typeLabels: Record<IngredientType, string> = {
  fermentable: "Fermentable",
  hop: "Hop",
  yeast: "Yeast",
  adjunct: "Adjunct",
  supply: "Supply",
  water: "Water",
  chemical: "Chemical",
};

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function Row({ children, cols = 3 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export function IngredientForm({
  action,
  item,
  purchaseOptions = [],
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  item?: Ingredient;
  purchaseOptions?: Array<{ id: number; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {}
  );
  const [labelState, labelAction, reading] = useActionState<LabelAnalyzeState, FormData>(
    analyzeLabel,
    {}
  );
  const [type, setType] = useState<IngredientType>(item?.type ?? "fermentable");
  const formRef = useRef<HTMLFormElement>(null);

  // Dispatch analyze WITHOUT submitting the form (a form action would make
  // React reset the fields, losing the chosen photo before Create).
  function readLabel() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTransition(() => labelAction(fd));
  }

  // Fill only fields the user hasn't touched; the form stays uncontrolled,
  // so set DOM values directly (they're what the submit sends).
  useEffect(() => {
    const p = labelState.proposal;
    const form = formRef.current;
    if (!p || !form) return;
    if (p.type && ingredientTypes.includes(p.type as IngredientType)) {
      setType(p.type as IngredientType);
    }
    // Type-specific fields render after setType — fill on the next frame.
    requestAnimationFrame(() => {
      const fill = (fieldName: string, value: string | number | undefined) => {
        if (value == null) return;
        const el = form.elements.namedItem(fieldName);
        if (el instanceof HTMLInputElement && !el.value) el.value = String(value);
        if (el instanceof HTMLSelectElement && value) el.value = String(value);
      };
      fill("name", p.name);
      fill("quantity", p.quantity);
      fill("quantityOnHand", undefined); // on-hand stays the user's call
      if (p.unit) fill("unit", p.unit);
      fill("lotNumber", p.lotNumber);
      fill("bestByDate", p.bestByDate);
      fill("alphaAcidPercent", p.alphaAcidPercent);
      if (p.hopForm) fill("hopForm", p.hopForm);
      fill("ppg", p.ppg);
      fill("colorLovibond", p.colorLovibond);
      fill("strain", p.strain);
      fill("manufacturer", p.manufacturer);
      fill("productCode", p.productCode);
      fill("attenuationPercent", p.attenuationPercent);
      fill("tempRangeMinF", p.tempRangeMinF);
      fill("tempRangeMaxF", p.tempRangeMaxF);
      fill("notes", p.notes);
    });
  }, [labelState.proposal]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="panel"
      style={{
        maxWidth: 680,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div>
        <label className="field-label" htmlFor="photo">Photo of the packet (optional)</label>
        <input id="photo" name="photo" type="file" accept="image/*" capture="environment" className="field" style={{ padding: 8 }} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={readLabel} className="btn" disabled={reading || pending}>
            {reading ? "Reading label…" : "Read label with AI — fill the form for me"}
          </button>
          {reading ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>usually 10–30 seconds</span> : null}
          {labelState.error ? <span style={{ color: "var(--danger)", fontSize: 13 }}>{labelState.error}</span> : null}
          {labelState.proposal ? (
            <span style={{ color: "var(--success)", fontSize: 13 }}>
              Label read — check the fields, especially lot and best-by.
            </span>
          ) : null}
        </div>
        {item?.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/ingredients/${item.id}/photo`}
            alt={`Packet photo for ${item.name}`}
            style={{ maxWidth: 220, borderRadius: 3, border: "1px solid var(--border)", marginTop: 8 }}
          />
        ) : null}
      </div>
      <Row>
        <div>
          <label className="field-label" htmlFor="type">Type</label>
          <select
            id="type"
            name="type"
            className="field"
            value={type}
            onChange={(e) => setType(e.target.value as IngredientType)}
          >
            {ingredientTypes.map((t) => (
              <option key={t} value={t}>{typeLabels[t]}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label className="field-label" htmlFor="name">Name</label>
          <input id="name" name="name" className="field" defaultValue={item?.name} required />
        </div>
      </Row>
      <Row>
        <div>
          <label className="field-label" htmlFor="vendor">Vendor</label>
          <input id="vendor" name="vendor" className="field" defaultValue={item?.vendor ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="lotNumber">Lot number</label>
          <input id="lotNumber" name="lotNumber" className="field" defaultValue={item?.lotNumber ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="cost">Cost ($)</label>
          <input id="cost" name="cost" type="number" step="0.01" min="0" className="field" defaultValue={item?.cost ?? ""} />
        </div>
      </Row>
      <Row cols={4}>
        <div>
          <label className="field-label" htmlFor="quantity">Purchased qty</label>
          <input id="quantity" name="quantity" type="number" step="any" min="0" className="field" defaultValue={item?.quantity ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="quantityOnHand">On hand</label>
          <input id="quantityOnHand" name="quantityOnHand" type="number" step="any" min="0" className="field" defaultValue={item?.quantityOnHand ?? 0} />
        </div>
        <div>
          <label className="field-label" htmlFor="unit">Unit</label>
          <select id="unit" name="unit" className="field" defaultValue={item?.unit ?? "oz"}>
            {["oz", "lb", "g", "kg", "pk", "gal", "qt", "tsp", "tbsp"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="purchaseDate">Purchased</label>
          <input id="purchaseDate" name="purchaseDate" type="date" className="field" defaultValue={toDateInput(item?.purchaseDate ?? null)} />
        </div>
      </Row>
      <Row>
        <div>
          <label className="field-label" htmlFor="bestByDate">Best by</label>
          <input id="bestByDate" name="bestByDate" type="date" className="field" defaultValue={toDateInput(item?.bestByDate ?? null)} />
        </div>
      </Row>

      {type === "hop" ? (
        <Row>
          <div>
            <label className="field-label" htmlFor="alphaAcidPercent">Alpha acid %</label>
            <input id="alphaAcidPercent" name="alphaAcidPercent" type="number" step="0.1" min="0" className="field" defaultValue={item?.alphaAcidPercent ?? ""} />
          </div>
          <div>
            <label className="field-label" htmlFor="hopForm">Form</label>
            <select id="hopForm" name="hopForm" className="field" defaultValue={item?.hopForm ?? "pellet"}>
              <option value="pellet">Pellet</option>
              <option value="leaf">Leaf</option>
            </select>
          </div>
        </Row>
      ) : null}

      {type === "fermentable" ? (
        <Row>
          <div>
            <label className="field-label" htmlFor="ppg">PPG</label>
            <input id="ppg" name="ppg" type="number" step="0.1" min="0" className="field" defaultValue={item?.ppg ?? ""} placeholder="LME ≈ 36, DME ≈ 44" />
          </div>
          <div>
            <label className="field-label" htmlFor="colorLovibond">Color (°L)</label>
            <input id="colorLovibond" name="colorLovibond" type="number" step="0.1" min="0" className="field" defaultValue={item?.colorLovibond ?? ""} />
          </div>
        </Row>
      ) : null}

      {type === "yeast" ? (
        <>
          <Row>
            <div>
              <label className="field-label" htmlFor="strain">Strain</label>
              <input id="strain" name="strain" className="field" defaultValue={item?.strain ?? ""} />
            </div>
            <div>
              <label className="field-label" htmlFor="manufacturer">Manufacturer</label>
              <input id="manufacturer" name="manufacturer" className="field" defaultValue={item?.manufacturer ?? ""} />
            </div>
            <div>
              <label className="field-label" htmlFor="productCode">Product code</label>
              <input id="productCode" name="productCode" className="field" defaultValue={item?.productCode ?? ""} />
            </div>
          </Row>
          <Row cols={4}>
            <div>
              <label className="field-label" htmlFor="generation">Generation</label>
              <input id="generation" name="generation" type="number" step="1" min="1" className="field" defaultValue={item?.generation ?? ""} />
            </div>
            <div>
              <label className="field-label" htmlFor="tempRangeMinF">Temp min °F</label>
              <input id="tempRangeMinF" name="tempRangeMinF" type="number" step="1" className="field" defaultValue={item?.tempRangeMinF ?? ""} />
            </div>
            <div>
              <label className="field-label" htmlFor="tempRangeMaxF">Temp max °F</label>
              <input id="tempRangeMaxF" name="tempRangeMaxF" type="number" step="1" className="field" defaultValue={item?.tempRangeMaxF ?? ""} />
            </div>
            <div>
              <label className="field-label" htmlFor="attenuationPercent">Attenuation %</label>
              <input id="attenuationPercent" name="attenuationPercent" type="number" step="0.1" min="0" className="field" defaultValue={item?.attenuationPercent ?? ""} />
            </div>
          </Row>
        </>
      ) : null}

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
          {pending ? "Saving…" : item ? "Save changes" : "Add lot"}
        </button>
        <Link href="/ingredients" className="btn">Cancel</Link>
      </div>
    </form>
  );
}
