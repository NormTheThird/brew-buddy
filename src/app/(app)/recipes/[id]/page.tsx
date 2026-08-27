import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, recipeItems, recipes, stock } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { addRecipeItem, deleteRecipeItem, deleteRecipe } from "@/lib/brewing/actions";
import { recipeDisplayStatus, statusBadge, methodLabels, batchStatusBadge } from "@/lib/brewing/display";
import { checkBrewability } from "@/lib/brewing/brewability";
import { formatMonth } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { DeleteButton } from "@/components/delete-button";

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

  return (
    <>
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
                            <form action={deleteRecipeItem} style={{ display: "inline" }}>
                              <input type="hidden" name="id" value={it.id} />
                              <input type="hidden" name="recipeId" value={recipe.id} />
                              <button type="submit" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>remove</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <form action={addRecipeItem} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.8fr 0.8fr 1fr 0.9fr auto", gap: 8, alignItems: "end" }}>
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
              </form>
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
