import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-radial)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        padding: 16,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            color: "var(--accent)",
            fontSize: 22,
            letterSpacing: 5,
            fontWeight: 300,
          }}
        >
          BREW BUDDY
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          homebrew, measured
        </div>
      </div>
      <LoginForm />
      <div style={{ fontSize: 11, color: "#5c626b" }}>
        Self-hosted · accounts created by the admin
      </div>
    </div>
  );
}
