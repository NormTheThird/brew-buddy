import { adoptSuggestedRecipe, applySuggestionToRecipe } from "@/lib/brewing/actions";
import type { SuggestedRecipe } from "@/lib/brewing/recipe-ai";

/* Candidate recipe cards, shared by the live lookup and lookup history.
   No hooks, so it renders server-side (history) and client-side (lookup). */

function Dots({ score }: { score: number }) {
  return (
    <span style={{ letterSpacing: 2, color: "var(--accent)" }}>
      {"●".repeat(score)}
      <span style={{ color: "var(--border)" }}>{"●".repeat(5 - score)}</span>
    </span>
  );
}

const sourceBadge: Record<string, { label: string; color: string }> = {
  published: { label: "PUBLISHED SOURCE", color: "var(--success)" },
  community: { label: "COMMUNITY RECIPE", color: "var(--info)" },
  constructed: { label: "AI CONSTRUCTED", color: "var(--warning)" },
};

export function SuggestionCards({
  suggestions,
  targetRecipeId,
  lookupId,
}: {
  suggestions: SuggestedRecipe[];
  /** When set, "use" fills THIS recipe instead of creating a new one. */
  targetRecipeId?: string;
  /** History row these cards came from; using one consumes it. */
  lookupId?: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 16 }}>
      {suggestions.map((s, i) => {
        const src = sourceBadge[s.ratings?.source ?? "constructed"];
        return (
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
            {s.ratings ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, borderTop: "1px solid var(--border-row)", paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>True to the real pint</span>
                  <Dots score={s.ratings.fidelity} />
                </div>
                {s.ratings.fidelityWhy ? (
                  <div style={{ color: "var(--text-faint)", marginTop: -2 }}>{s.ratings.fidelityWhy}</div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>Easy brew day (your setup)</span>
                  <Dots score={s.ratings.simplicity} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge" style={{ background: src.color }}>{src.label}</span>
                  {s.ratings.sourceName ? (
                    <span style={{ color: "var(--text-faint)" }}>{s.ratings.sourceName}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {s.equipment ? (
              <div style={{ fontSize: 12, borderTop: "1px solid var(--border-row)", paddingTop: 8 }}>
                {s.equipment.ready ? (
                  <span style={{ color: "var(--success)" }}>✓ Your gear covers this</span>
                ) : (
                  <span style={{ color: "var(--warning)" }}>
                    ⚠ Needs: {s.equipment.missing.join(", ") || "extra gear"}
                  </span>
                )}
                {s.equipment.notes ? (
                  <div style={{ color: "var(--text-faint)", marginTop: 3 }}>{s.equipment.notes}</div>
                ) : null}
              </div>
            ) : null}
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
            <form
              action={targetRecipeId ? applySuggestionToRecipe : adoptSuggestedRecipe}
              className="form-inline-flex"
            >
              <input type="hidden" name="suggestion" value={JSON.stringify(s)} />
              {targetRecipeId ? (
                <input type="hidden" name="recipeId" value={targetRecipeId} />
              ) : null}
              {lookupId ? (
                <input type="hidden" name="lookupId" value={lookupId} />
              ) : null}
              <button type="submit" className="btn" style={{ marginTop: "auto" }}>
                {targetRecipeId ? "Use for this recipe" : "Use this recipe"}
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
