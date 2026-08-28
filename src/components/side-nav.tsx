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
    <Link href={href} className={`side-nav-link${active ? " active" : ""}`}>
      <Icon size={16} />
      {label}
    </Link>
  );
}

// Styled entirely from globals.css (.side-nav*): a left rail on desktop,
// a fixed bottom tab bar under 768px.
export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="side-nav">
      {items.map((it) => (
        <NavLink key={it.href} {...it} active={isActive(it.href)} />
      ))}
      {isAdmin ? (
        <>
          <div className="side-nav-admin">Admin</div>
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
