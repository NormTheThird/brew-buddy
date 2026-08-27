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
  const linkStyle = {
    background: "none",
    border: "none",
    color: "var(--danger)",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    fontFamily: "inherit",
  } as const;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      style={{ display: variant === "button" ? "inline-flex" : "inline" }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={variant === "button" ? "btn btn-danger" : undefined}
        style={variant === "button" ? undefined : linkStyle}
      >
        {label}
      </button>
    </form>
  );
}
