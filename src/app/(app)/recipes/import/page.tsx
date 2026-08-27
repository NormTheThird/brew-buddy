import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { BeerXmlImportForm } from "@/components/beerxml-import-form";
import { CopyTemplateButton } from "@/components/copy-template-button";

export default function ImportRecipePage() {
  return (
    <>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <Link href="/recipes" style={{ color: "var(--nav-link)" }}>← Recipes</Link>
      </div>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="Import BeerXML"
        subtitle="From BeerSmith, Brewfather, kit publishers; most recipe tools export it"
      />
      <div className="panel" style={{ borderLeft: "3px solid var(--info)", padding: "12px 16px", fontSize: 13, marginBottom: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", maxWidth: 640 }}>
        <span style={{ flex: 1, minWidth: 260 }}>
          Hunting recipes with an AI? Copy the template, paste it into the chat
          with your ask (&quot;fill this in for a Pete&apos;s Wicked Ale
          clone&quot;), then import what comes back as an .xml file.
        </span>
        <CopyTemplateButton />
      </div>
      <BeerXmlImportForm />
    </>
  );
}
