"use client";

export function DeleteButton({
  action,
  id,
  label = "Delete",
  confirmText,
}: {
  action: (formData: FormData) => void;
  id: number;
  label?: string;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        style={{
          background: "none",
          border: "none",
          color: "var(--danger)",
          cursor: "pointer",
          fontSize: 13,
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        {label}
      </button>
    </form>
  );
}
