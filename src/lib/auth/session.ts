import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";

export const SESSION_COOKIE = "bb_session";
// Brew-day friendly: nobody types a password with wet hands. 90 days.
const SESSION_DAYS = 90;

export async function createSession(userId: string): Promise<string> {
  const id = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function setSessionCookie(sessionId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  jar.delete(SESSION_COOKIE);
}

// One DB lookup per request, shared across layout and pages.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt < new Date() || !row.user.active) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return row.user;
});
