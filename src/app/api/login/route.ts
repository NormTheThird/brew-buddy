import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth/session";

// Login is a plain POST + redirect, not a server action: the login page is
// always a cold load (nobody has a session yet), and a server-action form
// only works reliably once React has hydrated. A submit during that window
// can be silently lost — first login fails, retry works. A native form post
// has no such window. Relative Location keeps redirects on whatever origin
// the browser used (the app sits behind a proxy).
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const fail = () =>
    new Response(null, { status: 303, headers: { Location: "/login?error=1" } });
  if (!email || !password) return fail();

  const user = db.select().from(users).where(eq(users.email, email)).limit(1).all()[0];
  // Same response for unknown email and wrong password — no account probing.
  if (!user || !user.active) return fail();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return fail();

  await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId);
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
