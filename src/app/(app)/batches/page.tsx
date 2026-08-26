import { PageHeader, Placeholder } from "@/components/page-header";
import { LayersIcon } from "@/components/icons";

export default function BatchesPage() {
  return (
    <>
      <PageHeader
        icon={<LayersIcon size={40} />}
        title="Batches"
        subtitle="Every brew, measured — the data your system constants learn from"
      />
      <Placeholder milestone="milestone 3 (batch records, gravity calculators, seed data)" />
    </>
  );
}
