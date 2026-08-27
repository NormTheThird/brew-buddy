"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/db/schema";
import type { FormState } from "@/lib/brewing/actions";

export function RecipeForm({
  action,
  item,
  locked = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  item?: Recipe;
  /** Brewed recipes freeze their spec: every field but Notes is read-only. */
  locked?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <div className="panel" style={{ maxWidth: 760, padding: 24 }}>
    <form action={formAction} className="form-stack">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {locked ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", borderLeft: "3px solid var(--warning)", paddingLeft: 12 }}>
          Batches were brewed from this recipe, so its spec is history: only
          Notes stays editable. Use Duplicate on the recipe page to make a
          version you can change.
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div>
          <label className="field-label" htmlFor="name">Name</label>
          <input id="name" name="name" className="field" defaultValue={item?.name} required disabled={locked} />
        </div>
        <div>
          <label className="field-label" htmlFor="style">Style</label>
          <input id="style" name="style" className="field" defaultValue={item?.style ?? ""} placeholder="Amber Ale" disabled={locked} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div>
          <label className="field-label" htmlFor="method">Method</label>
          <select id="method" name="method" className="field" defaultValue={item?.method ?? "extract"} disabled={locked}>
            <option value="extract">Extract</option>
            <option value="partial_mash">Partial mash</option>
            <option value="all_grain">All grain</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="status">Status</label>
          {locked ? (
            // The stored status is stale once batches exist: Brewed is derived.
            <input id="status" className="field" value="Brewed" disabled readOnly />
          ) : (
            <select id="status" name="status" className="field" defaultValue={item?.status ?? "want_to_brew"}>
              <option value="want_to_brew">Want to brew</option>
              <option value="idea">Idea</option>
            </select>
          )}
        </div>
        <div>
          <label className="field-label" htmlFor="targetVolumeGal">Into fermenter (gal)</label>
          <input id="targetVolumeGal" name="targetVolumeGal" type="number" step="0.25" min="0" className="field" defaultValue={item?.targetVolumeGal ?? ""} disabled={locked} />
        </div>
      </div>
      <div>
        <div className="field-label" style={{ marginBottom: 8 }}>
          Targets: the spec you brew against, from the kit sheet or your own design
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
          <div>
            <label className="field-label" htmlFor="targetOG">OG</label>
            <input id="targetOG" name="targetOG" type="number" step="0.001" className="field" defaultValue={item?.targetOG ?? ""} placeholder="1.044" disabled={locked} />
          </div>
          <div>
            <label className="field-label" htmlFor="targetFG">FG</label>
            <input id="targetFG" name="targetFG" type="number" step="0.001" className="field" defaultValue={item?.targetFG ?? ""} disabled={locked} />
          </div>
          <div>
            <label className="field-label" htmlFor="targetIBU">IBU</label>
            <input id="targetIBU" name="targetIBU" type="number" step="1" className="field" defaultValue={item?.targetIBU ?? ""} disabled={locked} />
          </div>
          <div>
            <label className="field-label" htmlFor="targetSRM">SRM (color)</label>
            <input id="targetSRM" name="targetSRM" type="number" step="0.5" className="field" defaultValue={item?.targetSRM ?? ""} disabled={locked} />
          </div>
          <div>
            <label className="field-label" htmlFor="targetABV">ABV %</label>
            <input id="targetABV" name="targetABV" type="number" step="0.1" className="field" defaultValue={item?.targetABV ?? ""} disabled={locked} />
          </div>
          <div>
            <label className="field-label" htmlFor="boilMinutes">Boil minutes</label>
            <input id="boilMinutes" name="boilMinutes" type="number" step="1" className="field" defaultValue={item?.boilMinutes ?? ""} placeholder="60" disabled={locked} />
          </div>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="notes">Notes{locked ? " (still editable)" : ""}</label>
        <textarea id="notes" name="notes" className="field" rows={4} defaultValue={item?.notes ?? ""} />
      </div>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Saving…" : locked ? "Save notes" : item ? "Save changes" : "Create recipe"}
        </button>
        <Link href={item ? `/recipes/${item.id}` : "/recipes"} className="btn">Cancel</Link>
      </div>
    </form>
    </div>
  );
}
