import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { UsersIcon } from "@/components/icons";
import { CreateUserForm } from "@/components/admin-user-forms";
import { AdminUserTable, type AdminUserRow } from "@/components/admin-user-table";
import { TableSearch } from "@/components/table-search";

const PAGE_SIZES = ["10", "25", "50", "all"] as const;

function pageHref(q: string, size: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (size !== "10") params.set("size", size);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; size?: string; page?: string }>;
}) {
  const me = await getCurrentUser();
  if (me?.role !== "admin") redirect("/");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const size = PAGE_SIZES.includes((params.size ?? "") as (typeof PAGE_SIZES)[number])
    ? (params.size as (typeof PAGE_SIZES)[number])
    : "10";

  // Only the fields the table shows: full rows carry password hashes and
  // must never reach the client component.
  const all: AdminUserRow[] = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
      lastSignInAt: users.lastSignInAt,
    })
    .from(users)
    .all()
    .sort((a, b) => a.name.localeCompare(b.name));

  const needle = q.toLowerCase();
  const filtered = q
    ? all.filter((u) =>
        [u.name, u.email, u.role].some((s) => s.toLowerCase().includes(needle))
      )
    : all;

  const perPage = size === "all" ? filtered.length || 1 : Number(size);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const shown = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <PageHeader
        icon={<UsersIcon size={40} />}
        title="Users"
        subtitle="Accounts on this brewery: admins manage them, everyone else just brews"
      />
      <div className="panel" style={{ borderLeft: "3px solid var(--info)", padding: "12px 16px", fontSize: 13, marginBottom: 18 }}>
        Every account sees everything except this page: their own equipment, lots,
        recipes, batches, and timers. Deactivated accounts keep their data but can&apos;t
        sign in (and are signed out immediately).
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <TableSearch basePath="/admin/users" placeholder="Type 3+ letters to filter: name, email, role…" />
        </div>
      </div>
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          {q ? `Matches for "${q}" (${filtered.length})` : "Accounts"}
          <span style={{ display: "flex", gap: 8, fontSize: 12, fontWeight: 400 }}>
            {PAGE_SIZES.map((s) => (
              <Link
                key={s}
                href={pageHref(q, s, 1)}
                style={{ color: s === size ? "var(--accent)" : "var(--nav-link)", textDecoration: s === size ? "underline" : "none" }}
              >
                {s}
              </Link>
            ))}
          </span>
        </div>
        <div className="panel-body">
          {shown.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              {q ? `Nothing matches "${q}".` : "No accounts yet."}
            </div>
          ) : (
            <AdminUserTable users={shown} meId={me.id} />
          )}
          {pageCount > 1 ? (
            <div style={{ display: "flex", gap: 14, alignItems: "center", paddingTop: 14, fontSize: 13 }}>
              {page > 1 ? (
                <Link href={pageHref(q, size, page - 1)} className="btn" style={{ padding: "4px 12px" }}>← Prev</Link>
              ) : null}
              <span style={{ color: "var(--text-muted)" }}>
                Page {page} of {pageCount} · {filtered.length} account{filtered.length === 1 ? "" : "s"}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(q, size, page + 1)} className="btn" style={{ padding: "4px 12px" }}>Next →</Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">Add a user</div>
        <div className="panel-body">
          <CreateUserForm />
        </div>
      </div>
    </>
  );
}
