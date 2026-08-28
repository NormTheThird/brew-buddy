// A plain HTML form posting to /api/login — deliberately NOT a server action.
// Server-action forms need hydration before a submit is reliably captured;
// the login page is always a cold load, so a fast first submit could vanish
// (sign in "didn't work", retry did). A native post works from the first
// paint, JavaScript or none.
export function LoginForm({ error }: { error?: boolean }) {
  return (
    <div className="panel" style={{ width: "100%", maxWidth: 360, padding: 24 }}>
      <form method="post" action="/api/login" className="form-stack">
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
        {error ? (
          <div style={{ color: "var(--danger)", fontSize: 13 }}>
            That email and password don&apos;t match.
          </div>
        ) : null}
        <button
          type="submit"
          className="btn btn-solid"
          style={{ height: 44, fontSize: 14, fontWeight: 500, marginTop: 4 }}
        >
          Sign in
        </button>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Sessions last 90 days, brew-day friendly.
        </div>
      </form>
    </div>
  );
}
