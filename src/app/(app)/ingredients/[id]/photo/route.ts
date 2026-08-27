import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

const LABELS_DIR = path.join(
  path.dirname(process.env.DATABASE_PATH ?? "./data/brewbuddy.db"),
  "labels"
);

// Label photos are private uploads — served only to the signed-in owner.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return new NextResponse("Bad id", { status: 400 });

  const row = db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.id, numId), eq(ingredients.userId, user.id)))
    .all()[0];
  if (!row?.photoPath || !row.photoMime) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = path.join(LABELS_DIR, path.basename(row.photoPath));
  if (!fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": row.photoMime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
