import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recipeItems, recipes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { buildBeerXml } from "@/lib/brewing/beerxml";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return new NextResponse("Bad id", { status: 400 });

  const recipe = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, numId), eq(recipes.userId, user.id)))
    .all()[0];
  if (!recipe) return new NextResponse("Not found", { status: 404 });
  const items = db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, recipe.id))
    .all();

  const xml = buildBeerXml(recipe, items);
  const safeName = recipe.name.replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-");
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${safeName}.xml"`,
    },
  });
}
