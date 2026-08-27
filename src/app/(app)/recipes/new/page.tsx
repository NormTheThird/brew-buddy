import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { RecipeForm } from "@/components/recipe-form";
import { RecipeLookup } from "@/components/recipe-lookup";
import { createRecipe } from "@/lib/brewing/actions";

export default function NewRecipePage() {
  return (
    <>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <Link href="/recipes" style={{ color: "var(--nav-link)" }}>← Recipes</Link>
      </div>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="New recipe"
        subtitle="Store the spec (gravity points, IBU, color), not a shopping list"
      />
      <RecipeLookup />
      <RecipeForm action={createRecipe} />
    </>
  );
}
