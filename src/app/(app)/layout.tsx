import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TopBar } from "@/components/top-bar";
import { SideNav } from "@/components/side-nav";
import { DueTasksBanner } from "@/components/due-tasks-banner";

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
        <main className="app-main">
          <DueTasksBanner userId={user.id} />
          {children}
        </main>
      </div>
    </div>
  );
}
