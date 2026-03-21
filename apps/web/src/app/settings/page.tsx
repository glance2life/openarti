import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ApiKeys } from "@/components/api-keys";
import { LogoutButton } from "@/components/logout-button";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <div className="border rounded-xl p-5 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              {user.role === "admin" && (
                <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use API keys to authenticate the <code className="bg-gray-100 px-1 rounded">arti</code> CLI
          or any API client. Set via <code className="bg-gray-100 px-1 rounded">OPENARTI_TOKEN</code> environment
          variable or <code className="bg-gray-100 px-1 rounded">--token</code> flag.
        </p>
        <ApiKeys />
      </div>
    </div>
  );
}
