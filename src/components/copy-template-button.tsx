"use client";

import { useState } from "react";
import { BEERXML_TEMPLATE } from "@/lib/brewing/beerxml-template";

/** Copies the BeerXML skeleton for pasting into an AI when recipe hunting. */
export function CopyTemplateButton() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(BEERXML_TEMPLATE);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Copy the template:", BEERXML_TEMPLATE);
        }
      }}
    >
      {copied ? "✓ Copied" : "Copy XML template"}
    </button>
  );
}
