import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader, Placeholder } from "@/components/page-header";
import { GridIcon } from "@/components/icons";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader
        icon={<GridIcon size={40} />}
        title="Dashboard"
        subtitle="Your brewery at a glance — what's fermenting, what's next, what you're set up to brew"
      />
      <div
        className="panel"
        style={{ padding: "14px 16px", marginBottom: 16, fontSize: 13 }}
      >
        Signed in as <span style={{ color: "var(--text-bright)" }}>{user?.name}</span> (
        {user?.role}). Auth, the shell, and the database are live.
      </div>
      <Placeholder milestone="milestone 4 (overview, learned constants, recipe pipeline)" />
    </>
  );
}
