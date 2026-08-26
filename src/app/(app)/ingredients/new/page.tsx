import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { IngredientForm } from "@/components/ingredient-form";
import { createIngredient } from "@/lib/inventory/actions";

export default function NewIngredientPage() {
  return (
    <>
      <PageHeader
        icon={<DropletIcon size={40} />}
        title="Add a purchase lot"
        subtitle="One row per packet — capture the lot number and its real numbers"
      />
      <IngredientForm action={createIngredient} />
    </>
  );
}
