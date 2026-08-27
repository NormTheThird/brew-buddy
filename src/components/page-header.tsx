export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 20,
      }}
    >
      {icon ? <span style={{ color: "var(--accent)", display: "flex" }}>{icon}</span> : null}
      <div>
        <h1 style={{ fontSize: 19 }}>{title}</h1>
        {subtitle ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>{actions}</div> : null}
    </div>
  );
}

export function Placeholder({ milestone }: { milestone: string }) {
  return (
    <div
      className="panel"
      style={{
        borderLeft: "3px solid var(--accent)",
        padding: "12px 16px",
        fontSize: 13,
      }}
    >
      This screen lands in {milestone}; the shell you&apos;re looking at is milestone 1.
    </div>
  );
}
