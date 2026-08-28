import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recipeLookups } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { BookIcon } from "@/components/icons";
import { RecipeForm } from "@/components/recipe-form";
import { RecipeLookup } from "@/components/recipe-lookup";
import { SuggestionCards } from "@/components/suggestion-cards";
import { createRecipe } from "@/lib/brewing/actions";
import type { SuggestedRecipe } from "@/lib/brewing/recipe-ai";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ lookup?: string }>;
}) {
  const user = await requireUser();
  const { lookup } = await searchParams;

  // Every AI lookup is kept; reopening one costs nothing and asks no one.
  const history = db
    .select({ id: recipeLookups.id, query: recipeLookups.query, createdAt: recipeLookups.createdAt })
    .from(recipeLookups)
    .where(eq(recipeLookups.userId, user.id))
    .orderBy(desc(recipeLookups.createdAt))
    .limit(15)
    .all();

  const opened = lookup
    ? db
        .select()
        .from(recipeLookups)
        .where(eq(recipeLookups.id, lookup))
        .all()
        .find((l) => l.userId === user.id)
    : undefined;
  let openedSuggestions: SuggestedRecipe[] = [];
  if (opened) {
    try {
      openedSuggestions = JSON.parse(opened.suggestionsJson) as SuggestedRecipe[];
    } catch {
      openedSuggestions = [];
    }
  }

  return (
    <>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <Link href="/recipes" style={{ color: "var(--nav-link)" }}>← Recipes</Link>
      </div>
      <PageHeader
        icon={<BookIcon size={40} />}
        title="New recipe"
        subtitle="Store the spec (gravity points, IBU, color), not a shopping list"
      />
      <RecipeLookup />
      {history.length > 0 ? (
        <div className="panel" style={{ maxWidth: 980, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "var(--text-bright)", marginBottom: 10 }}>
            Past lookups
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {history.map((h) => (
              <Link
                key={h.id}
                href={`/recipes/new?lookup=${h.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  border: `1px solid ${opened?.id === h.id ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 14,
                  fontSize: 12,
                  color: opened?.id === h.id ? "var(--accent)" : "var(--nav-link)",
                }}
              >
                {h.query}
                <span style={{ color: "var(--text-faint)" }}>
                  {h.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </Link>
            ))}
          </div>
          {openedSuggestions.length > 0 ? (
            <SuggestionCards suggestions={openedSuggestions} lookupId={opened!.id} />
          ) : opened ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
              This lookup could not be read back.
            </div>
          ) : null}
        </div>
      ) : null}
      <RecipeForm action={createRecipe} />
    </>
  );
}
