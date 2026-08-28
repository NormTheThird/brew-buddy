"use server";

import { redirect } from "next/navigation";
import { destroySession } from "./session";

// Sign-in lives in app/api/login/route.ts as a plain POST, not here — see
// the comment there. Logout stays a server action: it only ever runs from
// an already-hydrated page.

export async function logout() {
  await destroySession();
  redirect("/login");
}
