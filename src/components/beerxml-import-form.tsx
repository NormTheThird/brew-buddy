"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importBeerXmlAction, type FormState } from "@/lib/brewing/actions";

export function BeerXmlImportForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    importBeerXmlAction,
    {}
  );

  return (
    <div className="panel" style={{ maxWidth: 560, padding: 20 }}>
    <form action={formAction} className="form-stack">
      <div>
        <label className="field-label" htmlFor="file">BeerXML file (.xml)</label>
        <input id="file" name="file" type="file" accept=".xml,text/xml" className="field" style={{ padding: 8 }} required />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Imports the spec (targets, boil, fermentables, hops, yeast) as a new
        &quot;Want to brew&quot; recipe. Metric amounts convert to lb/oz/gal.
      </div>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </button>
        <Link href="/recipes" className="btn">Cancel</Link>
      </div>
    </form>
    </div>
  );
}
