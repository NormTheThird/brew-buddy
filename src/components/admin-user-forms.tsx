"use client";

import { useActionState } from "react";
import { createUser, resetUserPassword, type FormState } from "@/lib/admin/actions";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createUser, {});

  return (
    <form action={formAction}><div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 0.8fr auto", gap: 10, alignItems: "end" }}>
      <div>
        <label className="field-label" htmlFor="nu-name">Name</label>
        <input id="nu-name" name="name" className="field" required />
      </div>
      <div>
        <label className="field-label" htmlFor="nu-email">Email</label>
        <input id="nu-email" name="email" type="email" className="field" required />
      </div>
      <div>
        <label className="field-label" htmlFor="nu-password">Password (8+)</label>
        <input id="nu-password" name="password" type="text" className="field" required minLength={8} />
      </div>
      <div>
        <label className="field-label" htmlFor="nu-role">Role</label>
        <select id="nu-role" name="role" className="field" defaultValue="user">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button type="submit" className="btn btn-solid" style={{ height: 38 }} disabled={pending}>
        {pending ? "Creating…" : "Add user"}
      </button>
      {state.error ? <div style={{ gridColumn: "1 / -1", color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      {state.message ? <div style={{ gridColumn: "1 / -1", color: "var(--success)", fontSize: 13 }}>{state.message}</div> : null}
    </div></form>
  );
}

export function ResetPasswordForm({ userId, userName }: { userId: string; userName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(resetUserPassword, {});

  return (
    <form action={formAction} className="form-inline-flex">
      <input type="hidden" name="id" value={userId} />
      <input
        name="password"
        type="text"
        className="field"
        placeholder={`new password for ${userName}`}
        minLength={8}
        required
        style={{ width: 180, padding: "5px 8px", fontSize: 12 }}
      />
      <button
        type="submit"
        className="btn"
        style={{ padding: "4px 12px", fontSize: 12, borderColor: "var(--warning)", color: "var(--warning)" }}
        disabled={pending}
      >
        {pending ? "…" : "Reset"}
      </button>
      {state.error ? <span style={{ color: "var(--danger)", fontSize: 12 }}>{state.error}</span> : null}
      {state.message ? <span style={{ color: "var(--success)", fontSize: 12 }}>done</span> : null}
    </form>
  );
}
