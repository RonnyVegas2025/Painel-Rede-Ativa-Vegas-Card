"use client";

import { useState, type ReactNode } from "react";
import type { Profile } from "@/types/user";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** §6: sidebar, topbar e área de conteúdo. Mesma arquitetura em toda a plataforma. */
export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={profile.role} collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          profile={profile}
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
        />
        <main id="conteudo" className="flex-1 p-4 pb-24 md:p-6 md:pb-8">
          {children}
        </main>
      </div>
      <MobileNav role={profile.role} />
    </div>
  );
}
