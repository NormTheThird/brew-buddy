import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stock, purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { DropletIcon } from "@/components/icons";
import { StockForm } from "@/components/stock-form";
import { updateStockItem } from "@/lib/inventory/actions";

export default async function EditStockItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { id } = await params;

  const item = db
    .select()
    .from(stock)
    .where(and(eq(stock.id, id), eq(stock.userId, user.id)))
    .all()[0];
  if (!item) notFound();

  const purchaseOptions = db
    .select({ id: purchases.id, name: purchases.name })
    .from(purchases)
    .where(eq(purchases.userId, user.id))
    .all();

  return (
    <>
      <PageHeader
        icon={<DropletIcon size={40} />}
        title={`Edit · ${item.name}`}
        subtitle={item.lotNumber ? `Lot ${item.lotNumber}` : undefined}
      />
      <StockForm action={updateStockItem} item={item} purchaseOptions={purchaseOptions} />
    </>
  );
}
