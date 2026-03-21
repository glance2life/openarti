import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface Team {
  id: string;
  name: string;
}

export default async function OldSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { teams } = await apiFetch<{ teams: Team[] }>("GET", "/user/teams");
  const firstTeam = teams[0]?.name;
  redirect(firstTeam ? `/${firstTeam}/settings` : "/");
}
