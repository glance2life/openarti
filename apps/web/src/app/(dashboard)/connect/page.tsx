import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ConnectAgents } from "@/components/connect-agents";

export default async function ConnectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <ConnectAgents />
    </div>
  );
}
