import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, equipment, recipes } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { LayersIcon } from "@/components/icons";
import { BatchForm } from "@/components/batch-form";
import { createBatch } from "@/lib/brewing/actions";

export default async function NewBatchPage({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  const user = await requireUser();
  const { recipe } = await searchParams;

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
  const existing = db
    .select({ n: batches.batchNumber })
    .from(batches)
    .where(eq(batches.userId, user.id))
    .all();
  const nextNumber = existing.reduce((m, b) => Math.max(m, b.n), 0) + 1;

  return (
    <>
      <PageHeader
        icon={<LayersIcon size={40} />}
        title="Log a batch"
        subtitle="Capture in the moment: volumes and temps are unrecoverable later"
      />
      <BatchForm
        action={createBatch}
        recipeOptions={recipeOptions}
        kettleOptions={vessels.filter((v) => v.category === "kettle")}
        fermenterOptions={vessels.filter((v) => v.category === "fermentation")}
        defaults={{
          recipeId: recipe || undefined,
          batchNumber: nextNumber,
        }}
      />
    </>
  );
}
