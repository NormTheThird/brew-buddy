"use client";

export function DeleteButton({
  action,
  id,
  label = "Delete",
  confirmText,
  variant = "link",
}: {
  action: (formData: FormData) => void;
  id: string | number;
  label?: string;
  confirmText: string;
  /** "menu" renders a full-width row for use inside an ActionsMenu. */
  variant?: "link" | "button" | "menu";
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
      className={
        variant === "button" ? "form-inline-flex" : variant === "menu" ? "form-block" : "form-inline"
      }
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={
          variant === "button" ? "btn btn-danger" : variant === "menu" ? "menu-item danger" : undefined
        }
        style={variant === "link" ? linkStyle : undefined}
      >
        {label}
      </button>
    </form>
  );
}
