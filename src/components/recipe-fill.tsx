"use client";

import { useActionState } from "react";
import { lookupRecipes, type RecipeLookupState } from "@/lib/brewing/actions";
import { SuggestionCards } from "./suggestion-cards";

/** On a recipe with an empty spec: ask Claude to propose it. Results save
    to lookup history tied to the recipe, and "use" fills THIS recipe. */
export function RecipeFill({
  recipeId,
  defaultQuery,
}: {
  recipeId: string;
  defaultQuery: string;
}) {
  const [state, formAction, pending] = useActionState<RecipeLookupState, FormData>(
    lookupRecipes,
    {}
  );

  return (
    <>
      <form action={formAction} className="form-row">
        <input type="hidden" name="recipeId" value={recipeId} />
        <input
          name="query"
          className="field"
          defaultValue={defaultQuery}
          style={{ flex: 1, minWidth: 260 }}
          required
        />
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? "Searching…" : "Top 3 recipes"}
        </button>
      </form>
      {pending ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Claude is researching published recipes and the real beer&apos;s specs;
          usually 30&ndash;90 seconds. Results are saved here even if you leave.
        </div>
      ) : null}
      {state.error ? (
        <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{state.error}</div>
      ) : null}
      {state.suggestions?.length ? (
        <SuggestionCards suggestions={state.suggestions} targetRecipeId={recipeId} lookupId={state.lookupId} />
      ) : null}
    </>
  );
}
