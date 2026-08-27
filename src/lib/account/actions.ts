"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export type FormState = { error?: string; message?: string };

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

/** Self-service profile — every user gets this; admin pages are separate. */
export async function updateProfile(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const name = str(formData.get("name"));
  const email = str(formData.get("email"))?.toLowerCase() ?? null;
  const phone = str(formData.get("phone"));
  if (!name) return { error: "Name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required." };

  const taken = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, user.id)))
    .all();
  if (taken.length > 0) return { error: "That email belongs to another account." };

  await db
    .update(users)
    .set({ name, email, phone })
    .where(eq(users.id, user.id));
  // The name in the top bar lives in the layout.
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}

/** Theme applies the moment it's picked; no Save button involved. */
export async function setTheme(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const theme = str(formData.get("theme"));
  if (theme !== "copper" && theme !== "stainless") return;
  await db.update(users).set({ theme }).where(eq(users.id, user.id));
  // data-theme sits on <html> in the root layout.
  revalidatePath("/", "layout");
}

export async function changePassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const current = str(formData.get("currentPassword"));
  const next = str(formData.get("newPassword"));
  if (!current || !next) return { error: "Both passwords are required." };
  if (next.length < 8) return { error: "New password needs 8+ characters." };

  const row = db.select().from(users).where(eq(users.id, user.id)).all()[0];
  if (!row) return { error: "Account not found." };
  const ok = await bcrypt.compare(current, row.passwordHash);
  if (!ok) return { error: "Current password is wrong." };

  const passwordHash = await bcrypt.hash(next, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  return { message: "Password changed." };
}
