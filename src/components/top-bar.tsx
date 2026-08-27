import { UserMenu } from "./user-menu";

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
          paddingRight: 22,
        }}
      >
        <UserMenu userName={userName} />
      </div>
    </header>
  );
}
