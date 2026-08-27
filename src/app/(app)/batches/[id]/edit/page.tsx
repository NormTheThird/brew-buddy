import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, equipment, recipes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { LayersIcon } from "@/components/icons";
import { BatchForm } from "@/components/batch-form";
import { updateBatch } from "@/lib/brewing/actions";

export default async function EditBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const item = db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.userId, user.id)))
    .all()[0];
  if (!item) notFound();

  const recipeOptions = db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(eq(recipes.userId, user.id))
    .all();
  const vessels = db
    .select({ id: equipment.id, name: equipment.name, category: equipment.category })
    .from(equipment)
    .where(and(eq(equipment.userId, user.id), inArray(equipment.category, ["kettle", "fermentation"])))
    .all();

  return (
    <>
      <PageHeader
        icon={<LayersIcon size={40} />}
        title={`Edit — Batch #${item.batchNumber} · ${item.recipeName}`}
      />
      <BatchForm
        action={updateBatch}
        item={item}
        recipeOptions={recipeOptions}
        kettleOptions={vessels.filter((v) => v.category === "kettle")}
        fermenterOptions={vessels.filter((v) => v.category === "fermentation")}
      />
    </>
  );
}
