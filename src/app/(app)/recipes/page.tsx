import { PageHeader, Placeholder } from "@/components/page-header";
import { BookIcon } from "@/components/icons";

export default function RecipesPage() {
  return (
    <>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="Recipes"
        subtitle="Specs, not shopping lists — resolved against your kettle and your current lots"
      />
      <Placeholder milestone="milestone 3 (statuses, BeerXML, brewability)" />
    </>
  );
}
