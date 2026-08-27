import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ingredients, purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { IngredientForm } from "@/components/ingredient-form";
import { updateIngredient } from "@/lib/inventory/actions";

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const item = db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.id, numId), eq(ingredients.userId, user.id)))
    .all()[0];
  if (!item) notFound();

  const purchaseOptions = db
    .select({ id: purchases.id, name: purchases.name })
    .from(purchases)
    .where(eq(purchases.userId, user.id))
    .all();

  return (
    <>
      <PageHeader
        icon={<DropletIcon size={40} />}
        title={`Edit — ${item.name}`}
        subtitle={item.lotNumber ? `Lot ${item.lotNumber}` : undefined}
      />
      <IngredientForm action={updateIngredient} item={item} purchaseOptions={purchaseOptions} />
    </>
  );
}
