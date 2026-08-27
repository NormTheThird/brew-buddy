"use client";

import React, { useEffect, useState } from "react";
import { useActionState } from "react";
import { setUserActive, updateUser, type FormState } from "@/lib/admin/actions";
import { formatMonth } from "@/lib/inventory/format";
import { ResetPasswordForm } from "./admin-user-forms";

/** Only what the table shows. Never pass full user rows to the client:
    they carry password hashes in the RSC payload. */
export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: Date;
  lastSignInAt: Date | null;
};

function EditUserForm({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateUser, {});

  useEffect(() => {
    if (state.message) onDone();
  }, [state.message, onDone]);

  return (
    <form
      action={formAction}
      style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 0.7fr auto auto", gap: 10, alignItems: "end", padding: "4px 0 8px" }}
    >
      <input type="hidden" name="id" value={user.id} />
      <div>
        <label className="field-label" htmlFor={`eu-name-${user.id}`}>Name</label>
        <input id={`eu-name-${user.id}`} name="name" className="field" defaultValue={user.name} required />
      </div>
      <div>
        <label className="field-label" htmlFor={`eu-email-${user.id}`}>Email</label>
        <input id={`eu-email-${user.id}`} name="email" type="email" className="field" defaultValue={user.email} required />
      </div>
      <div>
        <label className="field-label" htmlFor={`eu-role-${user.id}`}>Role</label>
        <select id={`eu-role-${user.id}`} name="role" className="field" defaultValue={user.role}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button type="submit" className="btn btn-solid" style={{ height: 38 }} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="btn"
        style={{ height: 38 }}
        onClick={onDone}
      >
        Cancel
      </button>
      {state.error ? (
        <div style={{ gridColumn: "1 / -1", color: "var(--danger)", fontSize: 13 }}>{state.error}</div>
      ) : null}
    </form>
  );
}

function UserRow({ user: u, meId }: { user: AdminUserRow; meId: string }) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <tr>
        <td style={{ color: "var(--text-bright)", whiteSpace: "nowrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500 }}>
              {u.name.charAt(0).toUpperCase()}
            </span>
            {u.name}
            {u.id === meId ? <span style={{ color: "var(--text-faint)", fontSize: 12 }}>(you)</span> : null}
          </span>
        </td>
        <td style={{ whiteSpace: "nowrap" }}>{u.email}</td>
        <td>
          <span className="badge" style={{ background: u.role === "admin" ? "var(--accent)" : "#44464f", color: u.role === "admin" ? "var(--on-accent)" : "var(--text)" }}>
            {u.role.toUpperCase()}
          </span>
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          {u.active ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />Active
            </span>
          ) : (
            <span className="badge" style={{ background: "var(--danger)" }}>INACTIVE</span>
          )}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>{formatMonth(u.createdAt)}</td>
        <td style={{ whiteSpace: "nowrap" }}>{u.lastSignInAt ? formatMonth(u.lastSignInAt) : "never"}</td>
        <td style={{ textAlign: "right" }}>
          <button
            type="button"
            className="btn"
            style={{ padding: "4px 14px", fontSize: 12, borderColor: "var(--success)", color: "var(--success)" }}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {editing ? (
        <tr>
          <td colSpan={7} style={{ borderTop: "none", paddingTop: 0 }}>
            <EditUserForm user={u} onDone={() => setEditing(false)} />
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                borderTop: "1px solid var(--border-row)",
                paddingTop: 10,
                marginTop: 4,
                paddingBottom: 8,
              }}
            >
              <ResetPasswordForm userId={u.id} userName={u.name} />
              {u.id !== meId ? (
                <form action={setUserActive} style={{ display: "inline", marginLeft: "auto" }}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="active" value={(!u.active).toString()} />
                  {u.active ? (
                    <button type="submit" className="btn btn-danger" style={{ padding: "4px 12px", fontSize: 12 }}>
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn"
                      style={{ padding: "4px 12px", fontSize: 12, borderColor: "var(--success)", color: "var(--success)" }}
                    >
                      Reactivate
                    </button>
                  )}
                </form>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AdminUserTable({ users, meId }: { users: AdminUserRow[]; meId: string }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>User</th><th>Email</th><th>Role</th><th>Status</th>
            <th>Created</th><th>Last sign-in</th><th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} meId={meId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
