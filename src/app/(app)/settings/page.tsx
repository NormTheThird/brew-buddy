import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { UserIcon } from "@/components/icons";
import { ApiKeyForm, PasswordForm, ProfileForm, ThemePicker } from "@/components/settings-forms";

// Self-service account page — regular users never see the admin section,
// so name/email/phone/password/theme/AI key live here for everyone.
export default async function SettingsPage() {
  const user = await requireUser();

  // This calendar month's metered AI spend — the future paid tier's cap
  // reads from the same rows.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const usage = db
    .select({ estCostUsd: aiUsage.estCostUsd, source: aiUsage.source })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, user.id), gte(aiUsage.createdAt, monthStart)))
    .all();
  const calls = usage.length;
  const cost = usage.reduce((s, u) => s + u.estCostUsd, 0);

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
        <div className="panel">
          <div className="panel-heading">
            AI
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>
              {calls > 0
                ? `this month: ${calls} call${calls === 1 ? "" : "s"} · ~$${cost.toFixed(2)}`
                : "no AI calls yet this month"}
            </span>
          </div>
          <div className="panel-body">
            <ApiKeyForm hasKey={Boolean(user.anthropicApiKey)} />
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
