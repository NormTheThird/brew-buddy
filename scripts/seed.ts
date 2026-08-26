/* Seeds the initial admin account. Idempotent — safe to run again.
   Override with ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD env vars.
   The default password is for local dev only — change it before deploying. */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";

const email = (process.env.ADMIN_EMAIL ?? "normthethird@protonmail.com").toLowerCase();
const name = process.env.ADMIN_NAME ?? "Trey";
const password = process.env.ADMIN_PASSWORD ?? "brewbuddy";

async function main() {
  const existing = db.select().from(users).where(eq(users.email, email)).all();
  if (existing.length > 0) {
    console.log(`Admin ${email} already exists — nothing to do.`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(users).values({ email, name, passwordHash, role: "admin" });
  console.log(`Created admin ${name} <${email}>.`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`Password is the dev default ("brewbuddy") — change it before deploying.`);
  }
}

main();
