"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Check, Copy, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const EXPIRATION_OPTIONS = [
  { value: "never", label: "No expiration" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
  { value: "90d", label: "90 days" },
  { value: "180d", label: "180 days" },
  { value: "365d", label: "1 year" },
] as const;

interface ApiKey {
  id: string;
  label: string;
  keyHint: string | null;
  enabled: boolean;
  usageCount: number;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [expiration, setExpiration] = useState("never");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function fetchKeys() {
    const res = await fetch(`${API_URL}/api-keys`, { credentials: "include" });
    const data = await res.json();
    setKeys(data.keys || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, string> = { label };
    if (expiration !== "never") {
      const days = parseInt(expiration);
      const expiresAt = new Date(
        Date.now() + days * 24 * 60 * 60 * 1000
      ).toISOString();
      body.expiresAt = expiresAt;
    }
    const res = await fetch(`${API_URL}/api-keys`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setNewKey(data.key);
    setLabel("");
    setExpiration("never");
    setDialogOpen(false);
    fetchKeys();
  }

  async function handleToggle(id: string, enabled: boolean) {
    await fetch(`${API_URL}/api-keys/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    fetchKeys();
  }

  async function handleDelete(id: string) {
    await fetch(`${API_URL}/api-keys/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    fetchKeys();
  }

  const [activityKey, setActivityKey] = useState<ApiKey | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-6">
      {newKey && (
        <Alert>
          <AlertDescription>
            <p className="mb-2 font-medium">
              API key created — copy it now, it won&apos;t be shown again:
            </p>
            <code className="block rounded border bg-muted px-3 py-2 font-mono text-sm break-all">
              {newKey}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 gap-2"
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <Check className="size-3 text-green-600" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copied" : "Copy to clipboard"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-end">
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setLabel("");
              setExpiration("never");
            }
          }}
        >
          <DialogTrigger
            render={
              <Button className="shrink-0">
                Create
              </Button>
            }
          />
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>
                  The key will only be shown once after creation.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    id="key-name"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder='e.g. "CI pipeline", "deploy script"'
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expiration</Label>
                  <Select value={expiration} onValueChange={(v) => v && setExpiration(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No API keys yet.
              </TableCell>
            </TableRow>
          ) : (
            keys.map((key) => (
              <TableRow key={key.id} className={key.enabled ? "" : "opacity-50"}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.label || "—"}</span>
                    {!key.enabled && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </div>
                  {key.keyHint && (
                    <code className="text-xs font-mono text-muted-foreground">
                      {key.keyHint}
                    </code>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.expiresAt
                    ? new Date(key.expiresAt).toLocaleDateString()
                    : "Never"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.lastUsedAt
                    ? new Date(key.lastUsedAt).toLocaleDateString()
                    : "Never"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.usageCount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setActivityKey(key)}>
                        <Activity className="mr-2 size-4" />
                        Activity
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(key.id, !key.enabled)}>
                        {key.enabled ? (
                          <>
                            <Pause className="mr-2 size-4" />
                            Disable
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 size-4" />
                            Enable
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(key.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Dialog open={!!activityKey} onOpenChange={(open) => !open && setActivityKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key activity</DialogTitle>
            <DialogDescription>
              {activityKey?.label || "Unnamed key"}
              {activityKey?.keyHint && (
                <code className="ml-2 text-xs font-mono">{activityKey.keyHint}</code>
              )}
            </DialogDescription>
          </DialogHeader>
          {activityKey && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{activityKey.enabled ? "Enabled" : "Disabled"}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(activityKey.createdAt).toLocaleString()}</dd>
              <dt className="text-muted-foreground">Expires</dt>
              <dd>
                {activityKey.expiresAt
                  ? new Date(activityKey.expiresAt).toLocaleString()
                  : "Never"}
              </dd>
              <dt className="text-muted-foreground">Last used</dt>
              <dd>
                {activityKey.lastUsedAt
                  ? new Date(activityKey.lastUsedAt).toLocaleString()
                  : "Never"}
              </dd>
              <dt className="text-muted-foreground">Total requests</dt>
              <dd>{activityKey.usageCount.toLocaleString()}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
