import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { setUserActive } from "@/lib/admin/actions";
import { formatMonth } from "@/lib/inventory/format";
import { PageHeader } from "@/components/page-header";
import { UsersIcon } from "@/components/icons";
import { CreateUserForm, ResetPasswordForm } from "@/components/admin-user-forms";

export default async function AdminUsersPage() {
  const me = await getCurrentUser();
  if (me?.role !== "admin") redirect("/");

  const all = db.select().from(users).all();

  return (
    <>
      <PageHeader
        icon={<UsersIcon size={40} />}
        title="Users"
        subtitle="Accounts on this brewery — admins manage them, everyone else just brews"
      />
      <div className="panel" style={{ borderLeft: "3px solid var(--info)", padding: "12px 16px", fontSize: 13, marginBottom: 18 }}>
        Every account sees everything except this page — their own equipment, lots,
        recipes, batches, and timers. Deactivated accounts keep their data but can&apos;t
        sign in (and are signed out immediately).
      </div>
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">Accounts</div>
        <div className="panel-body">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>User</th><th>Email</th><th>Role</th><th>Status</th>
                  <th>Created</th><th>Last sign-in</th><th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {all.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: "var(--text-bright)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500 }}>
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                        {u.name}
                        {u.id === me.id ? <span style={{ color: "var(--text-faint)", fontSize: 12 }}>(you)</span> : null}
                      </span>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge" style={{ background: u.role === "admin" ? "var(--accent)" : "#44464f", color: u.role === "admin" ? "var(--on-accent)" : "var(--text)" }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {u.active ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />Active
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "var(--danger)" }}>INACTIVE</span>
                      )}
                    </td>
                    <td>{formatMonth(u.createdAt)}</td>
                    <td>{u.lastSignInAt ? formatMonth(u.lastSignInAt) : "never"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                        <ResetPasswordForm userId={u.id} userName={u.name} />
                        {u.id !== me.id ? (
                          <form action={setUserActive} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="active" value={(!u.active).toString()} />
                            <button type="submit" style={{ background: "none", border: "none", color: u.active ? "var(--danger)" : "var(--success)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                              {u.active ? "Deactivate" : "Reactivate"}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
