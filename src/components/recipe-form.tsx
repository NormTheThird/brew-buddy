"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/db/schema";
import type { FormState } from "@/lib/brewing/actions";

export function RecipeForm({
  action,
  item,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  item?: Recipe;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form
      action={formAction}
      className="panel"
      style={{ maxWidth: 680, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="name">Name</label>
          <input id="name" name="name" className="field" defaultValue={item?.name} required />
        </div>
        <div>
          <label className="field-label" htmlFor="style">Style</label>
          <input id="style" name="style" className="field" defaultValue={item?.style ?? ""} placeholder="Amber Ale" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="method">Method</label>
          <select id="method" name="method" className="field" defaultValue={item?.method ?? "extract"}>
            <option value="extract">Extract</option>
            <option value="partial_mash">Partial mash</option>
            <option value="all_grain">All grain</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="status">Status</label>
          <select id="status" name="status" className="field" defaultValue={item?.status ?? "want_to_brew"}>
            <option value="want_to_brew">Want to brew</option>
            <option value="idea">Idea</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="targetVolumeGal">Into fermenter (gal)</label>
          <input id="targetVolumeGal" name="targetVolumeGal" type="number" step="0.25" min="0" className="field" defaultValue={item?.targetVolumeGal ?? ""} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="targetOG">Target OG</label>
          <input id="targetOG" name="targetOG" type="number" step="0.001" className="field" defaultValue={item?.targetOG ?? ""} placeholder="1.044" />
        </div>
        <div>
          <label className="field-label" htmlFor="targetFG">Target FG</label>
          <input id="targetFG" name="targetFG" type="number" step="0.001" className="field" defaultValue={item?.targetFG ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="targetIBU">Target IBU</label>
          <input id="targetIBU" name="targetIBU" type="number" step="1" className="field" defaultValue={item?.targetIBU ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="targetSRM">Target SRM</label>
          <input id="targetSRM" name="targetSRM" type="number" step="0.5" className="field" defaultValue={item?.targetSRM ?? ""} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="targetABV">Target ABV %</label>
          <input id="targetABV" name="targetABV" type="number" step="0.1" className="field" defaultValue={item?.targetABV ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="boilMinutes">Boil minutes</label>
          <input id="boilMinutes" name="boilMinutes" type="number" step="1" className="field" defaultValue={item?.boilMinutes ?? ""} placeholder="60" />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" className="field" rows={3} defaultValue={item?.notes ?? ""} />
      </div>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Saving…" : item ? "Save changes" : "Create recipe"}
        </button>
        <Link href={item ? `/recipes/${item.id}` : "/recipes"} className="btn">Cancel</Link>
      </div>
    </form>
  );
}
