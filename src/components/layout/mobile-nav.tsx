"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/constants/roles";
import { can } from "@/lib/permissions/can";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav-items";

/**
 * §6.1 e §19: no mobile a sidebar vira navegação compacta. Alvo de 44 px e área
 * segura do iOS — o consultor usa em pé, com uma mão, dentro da loja.
 */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (i) => i.enabled && i.mobile && (i.permission === null || can(role, i.permission)),
  ).slice(0, 5);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--vg-border)] bg-[var(--vg-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2",
              "text-[length:var(--vg-text-caption)]",
              active
                ? "font-semibold text-[var(--vg-brand-700)]"
                : "text-[var(--vg-ink-secondary)]",
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
