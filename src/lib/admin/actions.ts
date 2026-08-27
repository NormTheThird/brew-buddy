"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export type FormState = { error?: string; message?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

export async function createUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const name = str(formData.get("name"));
  const email = str(formData.get("email"))?.toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = str(formData.get("role")) ?? "user";
  if (!name || !email) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!["admin", "user"].includes(role)) return { error: "Invalid role." };
  const existing = db.select().from(users).where(eq(users.email, email)).all();
  if (existing.length > 0) return { error: "That email already has an account." };

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(users).values({
    name,
    email,
    passwordHash,
    role: role as "admin" | "user",
  });
  revalidatePath("/admin/users");
  return { message: `Created ${name} — share the password with them privately.` };
}

export async function setUserActive(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  if (!Number.isInteger(id)) return;
  if (id === admin.id && !active) return; // can't deactivate yourself
  await db.update(users).set({ active }).where(eq(users.id, id));
  if (!active) {
    // Deactivation ends their sessions immediately.
    await db.delete(sessions).where(eq(sessions.userId, id));
  }
  revalidatePath("/admin/users");
}

export async function resetUserPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (!Number.isInteger(id)) return { error: "Missing user." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const target = db.select().from(users).where(eq(users.id, id)).all()[0];
  if (!target) return { error: "Unknown user." };
  const passwordHash = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  // Password change signs out that user's existing sessions.
  await db.delete(sessions).where(eq(sessions.userId, id));
  revalidatePath("/admin/users");
  return { message: `Password reset for ${target.name}.` };
}
