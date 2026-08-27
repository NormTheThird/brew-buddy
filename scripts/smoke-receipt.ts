/* One-off smoke test for receipt extraction: `npx tsx scripts/smoke-receipt.ts <image>`.
   Loads .env itself (tsx doesn't auto-load it the way Next.js does). */
import fs from "node:fs";

if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { extractReceipt } = await import("../src/lib/purchases/receipt-ai");
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/smoke-receipt.ts <image-or-pdf>");
    process.exit(1);
  }
  const mime = file.endsWith(".pdf") ? "application/pdf" : "image/png";
  const proposal = await extractReceipt(fs.readFileSync(file), mime);
  console.log(JSON.stringify(proposal, null, 2));
}

main();
