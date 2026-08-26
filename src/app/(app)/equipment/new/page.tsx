import { PageHeader } from "@/components/page-header";
import { BoxIcon } from "@/components/icons";
import { EquipmentForm } from "@/components/equipment-form";
import { createEquipment } from "@/lib/inventory/actions";

export default function NewEquipmentPage() {
  return (
    <>
      <PageHeader
        icon={<BoxIcon size={40} />}
        title="Add equipment"
        subtitle="Wanted items belong here too — set status to Wanted"
      />
      <EquipmentForm action={createEquipment} />
    </>
  );
}
