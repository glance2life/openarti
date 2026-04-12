import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ApiKeys } from "@/components/api-keys";

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          For scripts, CI/CD, and direct API access. Pass via{" "}
          <code className="rounded bg-muted px-1">
            Authorization: Bearer &lt;key&gt;
          </code>{" "}
          header.
        </p>
      </div>
      <ApiKeys />
    </div>
  );
}
