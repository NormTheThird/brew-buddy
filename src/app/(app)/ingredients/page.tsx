import { PageHeader, Placeholder } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";

export default function IngredientsPage() {
  return (
    <>
      <PageHeader
        icon={<DropletIcon size={40} />}
        title="Ingredient lots"
        subtitle="Tracked per purchase — because this packet is never the next packet"
      />
      <Placeholder milestone="milestone 2 (lots, stock levels, shopping list)" />
    </>
  );
}
