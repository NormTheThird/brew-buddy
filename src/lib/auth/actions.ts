"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, setSessionCookie, destroySession } from "./session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .all()[0];

  // Same error for unknown email and wrong password — no account probing.
  const invalid = { error: "That email and password don't match." };
  if (!user || !user.active) return invalid;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return invalid;

  await db
    .update(users)
    .set({ lastSignInAt: new Date() })
    .where(eq(users.id, user.id));

  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
