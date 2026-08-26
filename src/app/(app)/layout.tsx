import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TopBar } from "@/components/top-bar";
import { SideNav } from "@/components/side-nav";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TopBar userName={user.name} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideNav isAdmin={user.role === "admin"} />
        <main
          style={{
            flex: 1,
            background: "var(--bg-radial)",
            padding: "24px 30px",
            minWidth: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
