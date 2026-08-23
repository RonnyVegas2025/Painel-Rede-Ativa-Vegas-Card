"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import type { Role } from "@/constants/roles";
import { can } from "@/lib/permissions/can";
import { cn } from "@/lib/utils/cn";
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "./nav-items";

/**
 * §6.1: 248 px expandida, 72 px recolhida. Item ativo com fundo Brand 50,
 * texto Brand 700 e faixa vertical de gradiente de 3 px.
 */
export function Sidebar({ role, collapsed }: { role: Role; collapsed: boolean }) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((i) => i.permission === null || can(role, i.permission));

  const groups = (Object.keys(NAV_GROUPS) as NavItem["group"][])
    .map((key) => ({ key, label: NAV_GROUPS[key], items: visible.filter((i) => i.group === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav
      aria-label="Navegação principal"
      style={{
        width: collapsed ? "var(--vg-sidebar-width-collapsed)" : "var(--vg-sidebar-width)",
      }}
      className="hidden shrink-0 border-r border-[var(--vg-border)] bg-[var(--vg-surface)] transition-[width] md:block"
    >
      <div className="flex h-[var(--vg-topbar-height)] items-center border-b border-[var(--vg-border)] px-4">
        <Logo variant="mark" className="h-7 shrink-0" />
        {!collapsed && (
          <span className="ml-2.5 truncate font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] font-semibold text-[var(--vg-brand-700)]">
            Rede Vegas Ativa
          </span>
        )}
      </div>

      <div className="space-y-6 p-3">
        {groups.map((group) => (
          <div key={group.key}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[length:var(--vg-text-caption)] font-semibold tracking-wide text-[var(--vg-ink-secondary)] uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href} className="relative">
                    {active && (
                      <span
                        aria-hidden="true"
                        className="faixa-gradiente absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full"
                      />
                    )}
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--vg-radius-md)] px-3 py-2.5 transition-colors",
                        "text-[length:var(--vg-text-body)]",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-[var(--vg-brand-50)] font-medium text-[var(--vg-brand-700)]"
                          : "text-[var(--vg-ink-secondary)] hover:bg-[var(--vg-surface-muted)]",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
