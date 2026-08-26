import { PageHeader, Placeholder } from "@/components/page-header";
import { BoxIcon } from "@/components/icons";

export default function EquipmentPage() {
  return (
    <>
      <PageHeader
        icon={<BoxIcon size={40} />}
        title="Equipment"
        subtitle="What you own, what it does, what it cost"
      />
      <Placeholder milestone="milestone 2 (inventory + per-vessel constants)" />
    </>
  );
}
