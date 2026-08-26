/* Sets a user's password (and optionally name) from the command line.
   Usage: USER_EMAIL=... USER_PASSWORD=... [USER_NAME=...] npm run user:set-password
   The admin Users page (milestone 4) replaces this for day-to-day resets. */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";

const email = process.env.USER_EMAIL?.toLowerCase();
const password = process.env.USER_PASSWORD;
const name = process.env.USER_NAME;

async function main() {
  if (!email || !password) {
    console.error("USER_EMAIL and USER_PASSWORD are required.");
    process.exit(1);
  }
  const existing = db.select().from(users).where(eq(users.email, email)).all()[0];
  if (!existing) {
    console.error(`No user with email ${email}.`);
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .update(users)
    .set({ passwordHash, ...(name ? { name } : {}) })
    .where(eq(users.id, existing.id));
  console.log(`Updated ${email}${name ? ` (name: ${name})` : ""}.`);
}

main();
