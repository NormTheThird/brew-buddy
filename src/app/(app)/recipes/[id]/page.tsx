import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, recipeItems, recipeLookups, recipes, stock } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { addRecipeItem, deleteRecipeItem, deleteRecipe, duplicateRecipe } from "@/lib/brewing/actions";
import { recipeDisplayStatus, statusBadge, methodLabels, batchStatusBadge } from "@/lib/brewing/display";
import { checkBrewability } from "@/lib/brewing/brewability";
import { formatMonth } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";
import { RecipeFill } from "@/components/recipe-fill";
import { SuggestionCards } from "@/components/suggestion-cards";
import type { SuggestedRecipe } from "@/lib/brewing/recipe-ai";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;

  const recipe = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)))
    .all()[0];
  if (!recipe) notFound();

  const items = db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, recipe.id))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const recipeBatches = db
    .select()
    .from(batches)
    .where(and(eq(batches.recipeId, recipe.id), eq(batches.userId, user.id)))
    .all()
    .sort((a, b) => b.batchNumber - a.batchNumber);

  const stockRows = db.select().from(stock).where(eq(stock.userId, user.id)).all();
  const brewability = checkBrewability(items, stockRows);
  const status = recipeDisplayStatus(recipe, recipeBatches, brewability.verdict === "can_brew");
  const badge = statusBadge[status];
  // Brewed once = the spec is history; tweaks happen on a duplicate.
  const brewed = recipeBatches.length > 0;
  // An empty, unbrewed spec can be filled in by Claude; the latest lookup
  // run from this recipe is shown so results survive leaving the page.
  const specEmpty = !brewed && items.length === 0;
  const lastLookup = specEmpty
    ? db
        .select()
        .from(recipeLookups)
        .where(and(eq(recipeLookups.recipeId, recipe.id), eq(recipeLookups.userId, user.id)))
        .orderBy(desc(recipeLookups.createdAt))
        .limit(1)
        .all()[0]
    : undefined;
  let lastSuggestions: SuggestedRecipe[] = [];
  if (lastLookup) {
    try {
      lastSuggestions = JSON.parse(lastLookup.suggestionsJson) as SuggestedRecipe[];
    } catch {
      lastSuggestions = [];
    }
  }

  return (
    <>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <Link href="/recipes" style={{ color: "var(--nav-link)" }}>← Recipes</Link>
      </div>
      <PageHeader
        icon={<BookIcon size={40} />}
        title={recipe.name}
        subtitle={[recipe.style, methodLabels[recipe.method], recipe.targetVolumeGal ? `${recipe.targetVolumeGal} gal into fermenter` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <span className="badge" style={{ background: badge.color, alignSelf: "center" }}>{badge.label}</span>
            <Link href={`/batches/new?recipe=${recipe.id}`} className="btn btn-solid">Brew this</Link>
            <Link href={`/recipes/${recipe.id}/edit`} className="btn">Edit</Link>
            <Link href={`/recipes/${recipe.id}/beerxml`} className="btn">Export BeerXML</Link>
            <form action={duplicateRecipe} className="form-inline-flex">
              <input type="hidden" name="id" value={recipe.id} />
              <button type="submit" className="btn" title="Copy this recipe and its ingredients to tweak your own version">
                Duplicate
              </button>
            </form>
            <DeleteButton
              action={deleteRecipe}
              id={recipe.id}
              label="Delete"
              variant="button"
              confirmText={`Delete recipe "${recipe.name}"? Batches keep their snapshot of it.`}
            />
          </>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel">
            <div className="panel-heading">Targets</div>
            <div className="panel-body">
              <table className="data">
                <tbody>
                  <tr><td>OG</td><td style={{ color: "var(--text-bright)" }}>{recipe.targetOG?.toFixed(3) ?? "not set"}</td></tr>
                  <tr><td>FG</td><td style={{ color: "var(--text-bright)" }}>{recipe.targetFG?.toFixed(3) ?? "not set"}</td></tr>
                  <tr><td>IBU</td><td style={{ color: "var(--text-bright)" }}>{recipe.targetIBU ?? "not set"}</td></tr>
                  <tr><td>SRM</td><td style={{ color: "var(--text-bright)" }}>{recipe.targetSRM ?? "not set"}</td></tr>
                  <tr><td>ABV</td><td style={{ color: "var(--text-bright)" }}>{recipe.targetABV != null ? `${recipe.targetABV}%` : "not set"}</td></tr>
                  <tr><td>Boil</td><td style={{ color: "var(--text-bright)" }}>{recipe.boilMinutes != null ? `${recipe.boilMinutes} min` : "not set"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          {recipe.notes ? (
            <div className="panel">
              <div className="panel-heading">Notes</div>
              <div className="panel-body" style={{ fontSize: 13, whiteSpace: "pre-line" }}>{recipe.notes}</div>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {specEmpty ? (
            <div className="panel" style={{ borderLeft: "3px solid var(--accent)" }}>
              <div className="panel-heading">Fill in with Claude</div>
              <div className="panel-body">
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                  This spec is empty. Describe the beer and Claude proposes the
                  targets and ingredient bill; picking one fills THIS recipe.
                </div>
                <RecipeFill
                  recipeId={recipe.id}
                  defaultQuery={`${recipe.name}${recipe.style ? ` (${recipe.style})` : ""}`}
                />
                {lastSuggestions.length > 0 ? (
                  <>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, borderTop: "1px solid var(--border-row)", paddingTop: 10 }}>
                      Last lookup for this recipe: &quot;{lastLookup!.query}&quot;
                    </div>
                    <SuggestionCards suggestions={lastSuggestions} targetRecipeId={recipe.id} />
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="panel">
            <div className="panel-heading">Ingredients (spec)</div>
            <div className="panel-body">
              {items.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>No items yet. Add the bill below.</div>
              ) : (
                <div className="table-wrap" style={{ marginBottom: 12 }}>
                  <table className="data">
                    <thead>
                      <tr><th>Type</th><th>Name</th><th>Amount</th><th>Stage</th><th>Timing</th><th></th></tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.ingredientType}</td>
                          <td style={{ color: "var(--text-bright)" }}>{it.name}</td>
                          <td>{it.amount != null ? `${it.amount} ${it.unit}` : "—"}</td>
                          <td>{it.stage ?? "—"}</td>
                          <td>{it.timingMinutes != null ? `${it.timingMinutes} min` : "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            {brewed ? null : (
                              <form action={deleteRecipeItem} className="form-inline">
                                <input type="hidden" name="id" value={it.id} />
                                <input type="hidden" name="recipeId" value={recipe.id} />
                                <button type="submit" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>remove</button>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {brewed ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-row)", paddingTop: 10 }}>
                  This spec is locked: batches were brewed from it, so it is
                  history now. Duplicate the recipe to make your own version.
                </div>
              ) : (
              <form action={addRecipeItem}><div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.8fr 0.8fr 1fr 0.9fr auto", gap: 8, alignItems: "end" }}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <div>
                  <label className="field-label" htmlFor="ri-type">Type</label>
                  <select id="ri-type" name="ingredientType" className="field">
                    <option value="fermentable">Fermentable</option>
                    <option value="hop">Hop</option>
                    <option value="yeast">Yeast</option>
                    <option value="adjunct">Adjunct</option>
                    <option value="water">Water</option>
                    <option value="chemical">Chemical</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="ri-name">Name</label>
                  <input id="ri-name" name="name" className="field" required />
                </div>
                <div>
                  <label className="field-label" htmlFor="ri-amount">Amt</label>
                  <input id="ri-amount" name="amount" type="number" step="any" className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor="ri-unit">Unit</label>
                  <select id="ri-unit" name="unit" className="field">
                    {["oz", "lb", "g", "pk", "tsp", "tbsp"].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="ri-stage">Stage</label>
                  <select id="ri-stage" name="stage" className="field">
                    {["boil", "steep", "mash", "fermentation", "bottling"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="ri-timing">Min</label>
                  <input id="ri-timing" name="timingMinutes" type="number" step="1" className="field" />
                </div>
                <button type="submit" className="btn" style={{ height: 38 }}>Add</button>
              </div></form>
              )}
            </div>
          </div>
          <div className="panel">
            <div className="panel-heading">Batches of this recipe</div>
            <div className="panel-body">
              {recipeBatches.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>None yet. &quot;Brew this&quot; starts one.</div>
              ) : (
                <table className="data">
                  <tbody>
                    {recipeBatches.map((b) => {
                      const bb = batchStatusBadge[b.status];
                      return (
                        <tr key={b.id}>
                          <td style={{ color: "var(--text-bright)" }}><Link href={`/batches/${b.id}`}>Batch #{b.batchNumber}</Link></td>
                          <td>{formatMonth(b.brewDate)}</td>
                          <td>OG {b.og?.toFixed(3) ?? "—"}</td>
                          <td><span className="badge" style={{ background: bb.color }}>{bb.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
