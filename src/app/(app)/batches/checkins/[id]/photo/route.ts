import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { batchCheckins } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

const BATCH_PHOTOS_DIR = path.join(
  path.dirname(process.env.DATABASE_PATH ?? "./data/brewbuddy.db"),
  "batch-photos"
);

// Check-in photos are private uploads — served only to the signed-in owner.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const row = db
    .select()
    .from(batchCheckins)
    .where(and(eq(batchCheckins.id, id), eq(batchCheckins.userId, user.id)))
    .all()[0];
  if (!row?.photoPath || !row.photoMime) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = path.join(BATCH_PHOTOS_DIR, path.basename(row.photoPath));
  if (!fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": row.photoMime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
