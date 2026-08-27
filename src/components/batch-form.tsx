"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Batch } from "@/lib/db/schema";
import type { FormState } from "@/lib/brewing/actions";

type Option = { id: string; name: string };

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function estOf(item: Batch | undefined, field: string): boolean {
  if (!item) return false;
  try {
    return (JSON.parse(item.estimatedFields) as string[]).includes(field);
  } catch {
    return false;
  }
}

function NumField({
  name,
  label,
  item,
  step = "any",
  estimable = false,
  defaultValue,
}: {
  name: keyof Batch & string;
  label: string;
  item?: Batch;
  step?: string;
  estimable?: boolean;
  defaultValue?: number | null;
}) {
  const value = defaultValue ?? (item?.[name] as number | null | undefined) ?? "";
  return (
    <div>
      <label className="field-label" htmlFor={name} style={{ display: "flex", justifyContent: "space-between" }}>
        {label}
        {estimable ? (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center", textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" name={`est_${name}`} defaultChecked={estOf(item, name)} id={`est_${name}`} />
            est?
          </span>
        ) : null}
      </label>
      <input id={name} name={name} type="number" step={step} className="field" defaultValue={value} />
    </div>
  );
}

function Section({ title, children, cols = 3 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <div>
      <div style={{ color: "var(--text-bright)", fontSize: 13, margin: "6px 0 8px" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 12 }}>{children}</div>
    </div>
  );
}

export function BatchForm({
  action,
  item,
  recipeOptions,
  kettleOptions,
  fermenterOptions,
  defaults,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  item?: Batch;
  recipeOptions: Option[];
  kettleOptions: Option[];
  fermenterOptions: Option[];
  defaults?: { recipeId?: string; batchNumber?: number };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form
      action={formAction}
      className="panel"
      style={{ maxWidth: 860, padding: 20, display: "flex", flexDirection: "column", gap: 18 }}
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Section title="Batch" cols={4}>
        <div style={{ gridColumn: "span 2" }}>
          <label className="field-label" htmlFor="recipeId">Recipe</label>
          <select id="recipeId" name="recipeId" className="field" defaultValue={item?.recipeId ?? defaults?.recipeId ?? ""}>
            <option value="">— pick a recipe</option>
            {recipeOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="batchNumber">Batch #</label>
          <input id="batchNumber" name="batchNumber" type="number" step="1" min="1" className="field" defaultValue={item?.batchNumber ?? defaults?.batchNumber ?? 1} />
        </div>
        <div>
          <label className="field-label" htmlFor="brewDate">Brew date</label>
          <input id="brewDate" name="brewDate" type="date" className="field" defaultValue={toDateInput(item?.brewDate ?? null)} />
        </div>
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
          <select id="status" name="status" className="field" defaultValue={item?.status ?? "planned"}>
            <option value="planned">Planned</option>
            <option value="fermenting">Fermenting</option>
            <option value="conditioning">Conditioning</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="kettleId">Kettle</label>
          <select id="kettleId" name="kettleId" className="field" defaultValue={item?.kettleId ?? ""}>
            <option value="">—</option>
            {kettleOptions.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="fermenterId">Fermenter</label>
          <select id="fermenterId" name="fermenterId" className="field" defaultValue={item?.fermenterId ?? ""}>
            <option value="">—</option>
            {fermenterOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </Section>

      <Section title="Volumes (gal) — these feed your per-kettle constants" cols={3}>
        <NumField name="preBoilVolumeGal" label="Pre-boil" item={item} estimable />
        <NumField name="postBoilVolumeGal" label="Post-boil" item={item} estimable />
        <NumField name="intoFermenterGal" label="Into fermenter" item={item} estimable />
      </Section>

      <Section title="Gravity" cols={4}>
        <NumField name="og" label="OG (corrected)" item={item} step="0.001" estimable />
        <NumField name="ogTempF" label="OG sample °F" item={item} />
        <NumField name="fg" label="FG (corrected)" item={item} step="0.001" estimable />
        <NumField name="fgTempF" label="FG sample °F" item={item} />
      </Section>

      <Section title="Process" cols={4}>
        <NumField name="steepTempF" label="Steep °F" item={item} />
        <NumField name="steepMinutes" label="Steep min" item={item} />
        <NumField name="timeToBoilMinutes" label="Heat-to-boil min" item={item} />
        <NumField name="boilMinutes" label="Boil min" item={item} />
        <NumField name="chillEndTempF" label="Chill end °F" item={item} />
        <NumField name="timeToChillMinutes" label="Chill min" item={item} />
        <NumField name="pitchTempF" label="Pitch °F (limit 72)" item={item} estimable />
      </Section>

      <Section title="Packaging & outcome" cols={4}>
        <div>
          <label className="field-label" htmlFor="bottledDate">Bottled</label>
          <input id="bottledDate" name="bottledDate" type="date" className="field" defaultValue={toDateInput(item?.bottledDate ?? null)} />
        </div>
        <NumField name="primingSugarOz" label="Priming sugar oz" item={item} />
        <NumField name="bottleCount" label="Bottles" item={item} step="1" />
        <div>
          <label className="field-label" htmlFor="keeper" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" id="keeper" name="keeper" defaultChecked={item?.keeper ?? false} />
            Keeper — brew again
          </label>
          <input id="verdict" name="verdict" className="field" defaultValue={item?.verdict ?? ""} placeholder="verdict in a sentence" />
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" className="field" rows={3} defaultValue={item?.notes ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="deviations">Deviations from recipe</label>
          <textarea id="deviations" name="deviations" className="field" rows={3} defaultValue={item?.deviations ?? ""} />
        </div>
      </div>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Saving…" : item ? "Save changes" : "Create batch"}
        </button>
        <Link href={item ? `/batches/${item.id}` : "/batches"} className="btn">Cancel</Link>
      </div>
    </form>
  );
}
