import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader, Placeholder } from "@/components/page-header";
import { UsersIcon } from "@/components/icons";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/");

  return (
    <>
      <PageHeader
        icon={<UsersIcon size={40} />}
        title="Users"
        subtitle="Accounts on this brewery — admins manage them, everyone else just brews"
      />
      <Placeholder milestone="milestone 4 (user CRUD, password resets, deactivation)" />
    </>
  );
}
