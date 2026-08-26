import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { BoxIcon } from "@/components/icons";
import { EquipmentForm } from "@/components/equipment-form";
import { updateEquipment } from "@/lib/inventory/actions";

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const item = db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, numId), eq(equipment.userId, user.id)))
    .all()[0];
  if (!item) notFound();

  return (
    <>
      <PageHeader
        icon={<BoxIcon size={40} />}
        title={`Edit — ${item.name}`}
      />
      <EquipmentForm action={updateEquipment} item={item} />
    </>
  );
}
