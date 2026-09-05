import { UserMenu } from "./user-menu";

// Styled from globals.css (.top-bar*): full logo block on desktop, a
// compact one on phones.
export function TopBar({ userName }: { userName: string }) {
  return (
    <header className="top-bar">
      <div className="top-bar-logo">
        <span style={{ lineHeight: 1 }}>BREW BUDDY</span>
        <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--accent-tint)", lineHeight: 1 }}>
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
