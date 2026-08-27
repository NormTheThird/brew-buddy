import { logout } from "@/lib/auth/actions";
import { LogoutIcon } from "./icons";

export function TopBar({ userName }: { userName: string }) {
  return (
    <header
      style={{
        height: 60,
        background: "var(--chrome)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 200,
          height: 60,
          background: "var(--accent)",
          color: "var(--on-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 15,
          letterSpacing: 3,
        }}
      >
        BREW BUDDY
        <span style={{ fontSize: 11, letterSpacing: 0, color: "var(--accent-tint)" }}>
          v1
        </span>
      </div>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingRight: 22,
          fontSize: 13,
        }}
      >
        <span>{userName}</span>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "var(--on-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <form action={logout} style={{ display: "flex" }}>
          <button
            type="submit"
            title="Sign out"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              padding: 4,
            }}
          >
            <LogoutIcon size={18} />
          </button>
        </form>
      </div>
    </header>
  );
}
