"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    {}
  );

  return (
    <form
      action={action}
      className="panel"
      style={{
        width: "100%",
        maxWidth: 360,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="field"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error ? (
        <div style={{ color: "var(--danger)", fontSize: 13 }}>{state.error}</div>
      ) : null}
      <button
        type="submit"
        className="btn btn-solid"
        disabled={pending}
        style={{ height: 44, fontSize: 14, fontWeight: 500, marginTop: 4 }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Sessions last 90 days — brew-day friendly.
      </div>
    </form>
  );
}
