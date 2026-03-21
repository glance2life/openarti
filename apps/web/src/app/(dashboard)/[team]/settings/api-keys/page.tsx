import { ApiKeys } from "@/components/api-keys";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manage keys</CardTitle>
          <CardDescription>
            Use API keys to authenticate the{" "}
            <code className="rounded bg-muted px-1 text-sm">arti</code> CLI or
            any API client. Set via{" "}
            <code className="rounded bg-muted px-1 text-sm">
              OPENARTI_TOKEN
            </code>{" "}
            environment variable or{" "}
            <code className="rounded bg-muted px-1 text-sm">--token</code>{" "}
            flag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeys />
        </CardContent>
      </Card>
    </div>
  );
}
