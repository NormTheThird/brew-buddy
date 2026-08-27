import { PageHeader } from "@/components/page-header";
import { ReceiptIcon } from "@/components/icons";
import { PurchaseForm } from "@/components/purchase-form";

export default function NewPurchasePage() {
  return (
    <>
      <PageHeader
        icon={<ReceiptIcon size={40} />}
        title="New purchase"
        subtitle="A kit or one order: attach the receipt and let AI propose the items"
      />
      <PurchaseForm />
    </>
  );
}
