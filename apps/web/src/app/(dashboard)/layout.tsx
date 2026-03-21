import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard-shell";

interface Team {
  id: string;
  name: string;
  description: string;
  role: string;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { teams } = await apiFetch<{ teams: Team[] }>("GET", "/user/teams");

  return (
    <DashboardShell teams={teams}>
      {children}
    </DashboardShell>
  );
}
