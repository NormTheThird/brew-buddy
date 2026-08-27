import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { BeerXmlImportForm } from "@/components/beerxml-import-form";

export default function ImportRecipePage() {
  return (
    <>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="Import BeerXML"
        subtitle="From BeerSmith, Brewfather, kit publishers; most recipe tools export it"
      />
      <BeerXmlImportForm />
    </>
  );
}
