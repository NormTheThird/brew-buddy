import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { purchases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { receiptsDir } from "@/lib/purchases/storage";

// Receipts are private uploads — served only to the signed-in owner,
// never from /public.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  const p = db
    .select()
    .from(purchases)
    .where(and(eq(purchases.id, id), eq(purchases.userId, user.id)))
    .all()[0];
  if (!p?.receiptPath || !p.receiptMime) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = path.join(receiptsDir(), path.basename(p.receiptPath));
  if (!fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": p.receiptMime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
