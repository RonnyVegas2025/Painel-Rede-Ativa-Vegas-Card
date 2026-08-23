import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth/require-role";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
