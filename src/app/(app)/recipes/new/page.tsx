import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { RecipeForm } from "@/components/recipe-form";
import { createRecipe } from "@/lib/brewing/actions";

export default function NewRecipePage() {
  return (
    <>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="New recipe"
        subtitle="Store the spec (gravity points, IBU, color), not a shopping list"
      />
      <RecipeForm action={createRecipe} />
    </>
  );
}
