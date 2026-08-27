"use client";

import { useActionState } from "react";
import {
  adoptSuggestedRecipe,
  lookupRecipes,
  type RecipeLookupState,
} from "@/lib/brewing/actions";

/** Ask Claude for recipe candidates ("Caffrey's clone") and adopt one. */
export function RecipeLookup() {
  const [state, formAction, pending] = useActionState<RecipeLookupState, FormData>(
    lookupRecipes,
    {}
  );

  return (
    <div className="panel" style={{ maxWidth: 980, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: "var(--text-bright)", marginBottom: 10 }}>
        Or let Claude find one
      </div>
      <form action={formAction} className="form-row">
        <input
          name="query"
          className="field"
          placeholder='What do you want to brew? e.g. "a Caffrey&apos;s clone" or "an easy hazy IPA"'
          style={{ flex: 1, minWidth: 280 }}
          required
        />
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Searching…" : "Top 3 recipes"}
        </button>
      </form>
      {pending ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Claude is researching published recipes and the real beer&apos;s specs;
          usually 30–60 seconds.
        </div>
      ) : null}
      {state.error ? (
        <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{state.error}</div>
      ) : null}
      {state.suggestions?.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 16 }}>
          {state.suggestions.map((s, i) => (
            <div
              key={i}
              style={{ border: "1px solid var(--border)", borderRadius: 3, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div style={{ color: "var(--text-bright)", fontSize: 15 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {[
                  s.style,
                  s.method === "all_grain" ? "All grain" : s.method === "partial_mash" ? "Partial mash" : "Extract",
                  s.targetABV != null ? `${s.targetABV}% ABV` : null,
                  s.targetOG != null ? `OG ${s.targetOG.toFixed(3)}` : null,
                  s.targetIBU != null ? `~${s.targetIBU} IBU` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {s.notes ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.notes}</div>
              ) : null}
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                {s.items.map((it, j) => (
                  <li key={j}>
                    {it.amount != null ? `${it.amount} ${it.unit} ` : ""}
                    <span style={{ color: "var(--text-bright)" }}>{it.name}</span>
                    {it.timingMinutes != null ? ` · ${it.timingMinutes} min` : ""}
                    {it.stage && it.stage !== "boil" ? ` · ${it.stage}` : ""}
                  </li>
                ))}
              </ul>
              <form action={adoptSuggestedRecipe} className="form-inline-flex">
                <input type="hidden" name="suggestion" value={JSON.stringify(s)} />
                <button type="submit" className="btn" style={{ marginTop: "auto" }}>
                  Use this recipe
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
