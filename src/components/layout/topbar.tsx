"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ROLE_LABELS } from "@/constants/roles";
import type { Profile } from "@/types/user";

interface TopbarProps {
  profile: Profile;
  collapsed: boolean;
  onToggleSidebar: () => void;
}

/** §6.2: altura de 64 px, contexto à esquerda, ações à direita. */
export function Topbar({ profile, collapsed, onToggleSidebar }: TopbarProps) {
  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-30 flex h-[var(--vg-topbar-height)] items-center justify-between gap-4 border-b border-[var(--vg-border)] bg-[var(--vg-surface)] px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          className="hidden size-9 place-items-center rounded-[var(--vg-radius-sm)] text-[var(--vg-ink-secondary)] transition-colors hover:bg-[var(--vg-surface-muted)] md:grid"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-5" />
          )}
        </button>
        <Logo variant="mark" className="md:hidden" />
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-[length:var(--vg-text-body-sm)] font-medium text-[var(--vg-ink)]">
            {profile.fullName}
          </p>
          <p className="text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
            {ROLE_LABELS[profile.role]}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--vg-brand-50)] text-[length:var(--vg-text-body-sm)] font-semibold text-[var(--vg-brand-700)]"
        >
          {initials}
        </span>
      </div>
    </header>
  );
}
