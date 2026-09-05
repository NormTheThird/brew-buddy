import { UserMenu } from "./user-menu";

// Styled from globals.css (.top-bar*): full logo block on desktop, a
// compact one on phones.
export function TopBar({ userName }: { userName: string }) {
  return (
    <header className="top-bar">
      <div className="top-bar-logo">
        BREW BUDDY
        <span style={{ fontSize: 10, letterSpacing: 0, color: "var(--accent-tint)" }}>
          v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0"}
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
