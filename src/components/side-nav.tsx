"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GridIcon,
  BoxIcon,
  DropletIcon,
  BookIcon,
  LayersIcon,
  ReceiptIcon,
  UsersIcon,
} from "./icons";

const items = [
  { href: "/", label: "Dashboard", icon: GridIcon },
  { href: "/equipment", label: "Equipment", icon: BoxIcon },
  { href: "/stock", label: "Stock", icon: DropletIcon },
  { href: "/purchases", label: "Purchases", icon: ReceiptIcon },
  { href: "/recipes", label: "Recipes", icon: BookIcon },
  { href: "/batches", label: "Batches", icon: LayersIcon },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (p: { size?: number }) => React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: active ? "9px 15px 9px 19px" : "9px 15px 9px 25px",
        borderLeft: active ? "6px solid var(--accent)" : "none",
        color: active ? "var(--nav-link-active)" : "var(--nav-link)",
        fontSize: 13,
      }}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      style={{
        width: 200,
        background: "var(--chrome)",
        paddingTop: 15,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {items.map((it) => (
        <NavLink key={it.href} {...it} active={isActive(it.href)} />
      ))}
      {isAdmin ? (
        <>
          <div
            style={{
              marginTop: 18,
              padding: "10px 15px 4px 25px",
              fontSize: 10,
              letterSpacing: 1,
              color: "var(--text-bright)",
              textTransform: "uppercase",
            }}
          >
            Admin
          </div>
          <NavLink
            href="/admin/users"
            label="Users"
            icon={UsersIcon}
            active={isActive("/admin/users")}
          />
        </>
      ) : null}
    </nav>
  );
}
