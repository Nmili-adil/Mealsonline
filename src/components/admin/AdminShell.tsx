"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartBar,
  Package,
  Tag,
  Receipt,
  ArrowsClockwise,
  FileText,
  ImageSquare,
  Gear,
  Plug,
  Scroll,
  SignOut,
  Globe,
} from "@phosphor-icons/react";
import { useAdmin } from "./AdminProvider";
import { canManageStorefronts } from "@/lib/caisse212/storefront/roles";

const NAV_ITEMS = [
  { href: "/admin", label: "Vue d'ensemble", icon: ChartBar },
  { href: "/admin/products", label: "Produits", icon: Package },
  { href: "/admin/categories", label: "Catégories", icon: Tag },
  { href: "/admin/orders", label: "Commandes", icon: Receipt },
  { href: "/admin/websites", label: "Sites web", icon: Globe },
  { href: "/admin/sync", label: "Synchronisation", icon: ArrowsClockwise },
  { href: "/admin/pages", label: "Contenu du site", icon: FileText },
  { href: "/admin/media", label: "Médias", icon: ImageSquare },
  { href: "/admin/settings", label: "Paramètres", icon: Gear },
  { href: "/admin/integrations", label: "Intégrations", icon: Plug },
  { href: "/admin/audit-logs", label: "Journal d'audit", icon: Scroll },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin } = useAdmin();
  const canManageSites = canManageStorefronts(admin.role);
  const visibleNav = NAV_ITEMS.filter(
    (item) => item.href !== "/admin/websites" || canManageSites,
  );

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} data-active={active}>
              <Icon weight="bold" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </aside>
      <div className="admin-main">
        <div className="admin-topbar">
          <h1>Administration</h1>
          <div className="spacer" />
          <span style={{ color: "#a3aca6", fontSize: 13 }}>
            {admin.name} · {admin.role}
          </span>
          <button type="button" className="admin-button admin-button-secondary" onClick={logout}>
            <SignOut weight="bold" aria-hidden="true" /> Déconnexion
          </button>
        </div>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
