"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/auth/actions";
import { LogoutIcon, UserIcon } from "./icons";

/** Name + avatar in the top bar → dropdown with account actions. This is a
    regular user's only door to their settings (no admin section for them). */
export function UserMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: 13,
          fontFamily: "inherit",
          padding: 4,
        }}
      >
        <span>{userName}</span>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "var(--on-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {userName.charAt(0).toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▼
        </span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "var(--chrome)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            minWidth: 190,
            zIndex: 50,
            boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
            padding: "6px 0",
          }}
        >
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", color: "var(--nav-link)", fontSize: 13 }}
          >
            <UserIcon size={15} />
            My settings
          </Link>
          <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
          <form action={logout}>
            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                background: "none",
                border: "none",
                color: "var(--nav-link)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                padding: "9px 16px",
                textAlign: "left",
              }}
            >
              <LogoutIcon size={15} />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
