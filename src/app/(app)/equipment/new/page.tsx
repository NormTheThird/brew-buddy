import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { BoxIcon } from "@/components/icons";
import { EquipmentForm } from "@/components/equipment-form";
import { createEquipment } from "@/lib/inventory/actions";

export default async function NewEquipmentPage() {
  const user = (await getCurrentUser())!;
  const purchaseOptions = db
    .select({ id: purchases.id, name: purchases.name })
    .from(purchases)
    .where(eq(purchases.userId, user.id))
    .all();

  return (
    <>
      <PageHeader
        icon={<BoxIcon size={40} />}
        title="Add equipment"
        subtitle="Wanted items belong here too: set status to Wanted"
      />
      <EquipmentForm action={createEquipment} purchaseOptions={purchaseOptions} />
    </>
  );
}
