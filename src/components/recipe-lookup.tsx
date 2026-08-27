"use client";

import { useActionState } from "react";
import { lookupRecipes, type RecipeLookupState } from "@/lib/brewing/actions";
import { SuggestionCards } from "./suggestion-cards";

/** Ask Claude for recipe candidates ("Caffrey's clone") and adopt one.
    Every lookup is also saved to history below the box. */
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
          usually 30&ndash;90 seconds. The results land in history below, so you
          won&apos;t need to ask twice.
        </div>
      ) : null}
      {state.error ? (
        <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{state.error}</div>
      ) : null}
      {state.suggestions?.length ? <SuggestionCards suggestions={state.suggestions} /> : null}
    </div>
  );
}
