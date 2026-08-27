import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, recipes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { RecipeForm } from "@/components/recipe-form";
import { updateRecipe } from "@/lib/brewing/actions";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const item = db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, user.id)))
    .all()[0];
  if (!item) notFound();

  const brewed =
    db
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.recipeId, item.id))
      .all().length > 0;

  return (
    <>
      <PageHeader icon={<BookIcon size={40} />} title={`Edit · ${item.name}`} />
      <RecipeForm action={updateRecipe} item={item} locked={brewed} />
    </>
  );
}
