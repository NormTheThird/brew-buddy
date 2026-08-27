"use client";

import { useActionState } from "react";
import { changePassword, updateProfile, type FormState } from "@/lib/account/actions";
import type { User } from "@/lib/db/schema";

const themes = [
  { value: "copper", label: "Copper", swatch: "#c1703f" },
  { value: "stainless", label: "Stainless", swatch: "#a9b7c6" },
] as const;

export function ProfileForm({ user }: { user: User }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateProfile, {});

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="p-name">Name</label>
          <input id="p-name" name="name" className="field" defaultValue={user.name} required />
        </div>
        <div>
          <label className="field-label" htmlFor="p-phone">Phone</label>
          <input id="p-phone" name="phone" type="tel" className="field" defaultValue={user.phone ?? ""} placeholder="for texts, later" />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="p-email">Email</label>
        <input id="p-email" name="email" type="email" className="field" defaultValue={user.email} required />
      </div>
      <div>
        <div className="field-label">Theme</div>
        <div style={{ display: "flex", gap: 14 }}>
          {themes.map((t) => (
            <label
              key={t.value}
              style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 3, padding: "8px 14px" }}
            >
              <input
                type="radio"
                name="theme"
                value={t.value}
                defaultChecked={user.theme === t.value}
                style={{ accentColor: t.swatch }}
              />
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: t.swatch, display: "inline-block" }} />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      {state.message ? <div style={{ color: "var(--success)", fontSize: 13 }}>{state.message}</div> : null}
      <button type="submit" className="btn btn-solid" style={{ alignSelf: "flex-start" }} disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changePassword, {});

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="pw-current">Current password</label>
          <input id="pw-current" name="currentPassword" type="password" className="field" required />
        </div>
        <div>
          <label className="field-label" htmlFor="pw-new">New password (8+)</label>
          <input id="pw-new" name="newPassword" type="password" className="field" minLength={8} required />
        </div>
      </div>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      {state.message ? <div style={{ color: "var(--success)", fontSize: 13 }}>{state.message}</div> : null}
      <button type="submit" className="btn" style={{ alignSelf: "flex-start" }} disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
