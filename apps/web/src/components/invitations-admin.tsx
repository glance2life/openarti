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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Copy, MoreHorizontal, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Invitation {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface CreatedInvitation extends Invitation {
  token: string;
}

export function InvitationsAdmin() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [createError, setCreateError] = useState("");
  const [created, setCreated] = useState<{ email: string; url: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  async function fetchItems() {
    const res = await fetch(`${API_URL}/admin/invitations`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = (await res.json()) as { invitations: Invitation[] };
      setItems(data.invitations);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const res = await fetch(`${API_URL}/admin/invitations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setCreateError(body?.error?.message || "Failed to create invitation");
      return;
    }
    const { invitation } = (await res.json()) as {
      invitation: CreatedInvitation;
    };
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    setCreated({
      email: invitation.email,
      url: `${origin}/register?token=${encodeURIComponent(invitation.token)}`,
    });
    setEmail("");
    setDialogOpen(false);
    fetchItems();
  }

  async function handleRevoke(id: string) {
    await fetch(`${API_URL}/admin/invitations/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    fetchItems();
  }

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
      {created && (
        <Alert>
          <AlertDescription>
            <p className="mb-2 font-medium">
              Invitation link for{" "}
              <span className="font-mono">{created.email}</span> — share it
              privately, it won&apos;t be shown again:
            </p>
            <code className="block rounded border bg-muted px-3 py-2 font-mono text-xs break-all">
              {created.url}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 gap-2"
              onClick={() => {
                navigator.clipboard.writeText(created.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <Check className="size-3 text-green-600" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copied" : "Copy link"}
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
              setEmail("");
              setCreateError("");
            }
          }}
        >
          <DialogTrigger render={<Button className="shrink-0">Invite</Button>} />
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Invite a user</DialogTitle>
                <DialogDescription>
                  A one-time link valid for 7 days will be generated.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {createError && (
                  <Alert variant="destructive">
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                  />
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button type="submit">Create invitation</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No invitations yet.
              </TableCell>
            </TableRow>
          ) : (
            items.map((it) => {
              const expired = new Date(it.expiresAt) < new Date();
              const status = it.acceptedAt
                ? "Accepted"
                : expired
                  ? "Expired"
                  : "Pending";
              return (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {status}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(it.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="sm" />}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRevoke(it.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
