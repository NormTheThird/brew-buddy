import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { IngredientForm } from "@/components/ingredient-form";
import { createIngredient } from "@/lib/inventory/actions";

export default async function NewIngredientPage() {
  const user = (await getCurrentUser())!;
  const purchaseOptions = db
    .select({ id: purchases.id, name: purchases.name })
    .from(purchases)
    .where(eq(purchases.userId, user.id))
    .all();

  return (
    <>
      <PageHeader
        icon={<DropletIcon size={40} />}
        title="Add a purchase lot"
        subtitle="One row per packet — capture the lot number and its real numbers"
      />
      <IngredientForm action={createIngredient} purchaseOptions={purchaseOptions} />
    </>
  );
}
