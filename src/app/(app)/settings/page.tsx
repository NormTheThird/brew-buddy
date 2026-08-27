import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { UserIcon } from "@/components/icons";
import { PasswordForm, ProfileForm, ThemePicker } from "@/components/settings-forms";

// Self-service account page — regular users never see the admin section,
// so name/email/phone/password/theme live here for everyone.
export default async function SettingsPage() {
  const user = (await getCurrentUser())!;

  return (
    <>
      <PageHeader
        icon={<UserIcon size={40} />}
        title="My settings"
        subtitle="Your account and how the app looks; phone is for text alerts, later"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
        <div className="panel">
          <div className="panel-heading">Theme</div>
          <div className="panel-body">
            <ThemePicker user={user} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, alignItems: "start" }}>
          <div className="panel">
            <div className="panel-heading">Profile</div>
            <div className="panel-body">
              <ProfileForm user={user} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-heading">Password</div>
            <div className="panel-body">
              <PasswordForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
