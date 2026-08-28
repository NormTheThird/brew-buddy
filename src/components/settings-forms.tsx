"use client";

import { useActionState } from "react";
import { changePassword, clearAnthropicKey, setAnthropicKey, setTheme, updateProfile, type FormState } from "@/lib/account/actions";
import type { User } from "@/lib/db/schema";

const themes = [
  { value: "copper", label: "Copper", swatch: "#c1703f" },
  { value: "stainless", label: "Stainless", swatch: "#a9b7c6" },
] as const;

/** BYOK: paste an Anthropic key so AI features run on the user's account.
    The stored key never comes back to the client; only hasKey does. */
export function ApiKeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setAnthropicKey, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {hasKey ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ color: "var(--success)" }}>✓ Using your own Anthropic key</span>
          <form action={clearAnthropicKey} className="form-inline-flex">
            <button type="submit" className="btn" style={{ padding: "4px 12px", fontSize: 12, borderColor: "var(--danger)", color: "var(--danger)" }}>
              Remove key
            </button>
          </form>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          AI features currently run on the house key. Paste your own Anthropic
          key (console.anthropic.com) to run them on your account instead.
        </div>
      )}
      <form action={formAction} className="form-row">
        <input
          name="apiKey"
          type="password"
          className="field"
          placeholder="sk-ant-…"
          autoComplete="off"
          style={{ flex: 1, minWidth: 260 }}
          required
        />
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving…" : hasKey ? "Replace key" : "Save key"}
        </button>
      </form>
      {state.error ? <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div> : null}
      {state.message ? <div style={{ color: "var(--success)", fontSize: 13 }}>{state.message}</div> : null}
    </div>
  );
}

/** Picking a theme applies it immediately; there is nothing to save. */
export function ThemePicker({ user }: { user: User }) {
  return (
    <form action={setTheme} className="form-row">
      {themes.map((t) => (
        <label
          key={t.value}
          style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 3, padding: "10px 16px" }}
        >
          <input
            type="radio"
            name="theme"
            value={t.value}
            defaultChecked={user.theme === t.value}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            style={{ accentColor: t.swatch }}
          />
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: t.swatch, display: "inline-block" }} />
          {t.label}
        </label>
      ))}
    </form>
  );
}

export function ProfileForm({ user }: { user: User }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateProfile, {});

  return (
    <form action={formAction} className="form-stack">
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
    <form action={formAction} className="form-stack">
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
