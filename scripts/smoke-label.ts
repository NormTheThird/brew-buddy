/* Smoke test for label reading: `npx tsx scripts/smoke-label.ts <image>`.
   Loads .env itself (tsx doesn't auto-load it the way Next.js does). */
import fs from "node:fs";

if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { extractLabel } = await import("../src/lib/inventory/label-ai");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const rt = { client: new Anthropic(), userId: "smoke-test", feature: "smoke", source: "house" as const };
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/smoke-label.ts <image>");
    process.exit(1);
  }
  const mime = file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  const proposal = await extractLabel(rt, fs.readFileSync(file), mime);
  console.log(JSON.stringify(proposal, null, 2));
}

main();
