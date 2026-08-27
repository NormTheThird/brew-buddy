"use client";

export function DeleteButton({
  action,
  id,
  label = "Delete",
  confirmText,
  variant = "link",
}: {
  action: (formData: FormData) => void;
  id: number;
  label?: string;
  confirmText: string;
  variant?: "link" | "button";
}) {
  const style =
    variant === "button"
      ? ({
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 4,
          fontSize: 13,
          fontFamily: "inherit",
          border: "1px solid var(--danger)",
          color: "var(--danger)",
          background: "transparent",
          cursor: "pointer",
        } as const)
      : ({
          background: "none",
          border: "none",
          color: "var(--danger)",
          cursor: "pointer",
          fontSize: 13,
          padding: 0,
          fontFamily: "inherit",
        } as const);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={style}>
        {label}
      </button>
    </form>
  );
}
