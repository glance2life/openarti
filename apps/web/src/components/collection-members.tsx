"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  Copy,
  Link2,
  Link2Off,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Collaborator {
  userId: string;
  level: "read" | "edit";
  createdAt: string;
  userName: string;
  userEmail: string;
  userUsername: string;
}

interface InviteLink {
  id: string;
  token: string;
  enabled: boolean;
  createdAt: string;
}

interface CollectionMembersProps {
  owner: string;
  collection: string;
}

export function CollectionMembers({ owner, collection }: CollectionMembersProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addLevel, setAddLevel] = useState<"read" | "edit">("read");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<Collaborator | null>(null);

  // Invite link copied
  const [copied, setCopied] = useState(false);

  const basePath = `/collections/${owner}/${collection}`;

  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}${basePath}/access`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError("Only the collection owner can manage members.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setCollaborators(data.collaborators || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [basePath]);

  const fetchInviteLink = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}${basePath}/invite-link`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setInviteLink(data.inviteLink ?? null);
      }
    } catch {
      // ignore
    }
  }, [basePath]);

  useEffect(() => {
    Promise.all([fetchCollaborators(), fetchInviteLink()]).finally(() =>
      setLoading(false)
    );
  }, [fetchCollaborators, fetchInviteLink]);

  // ---- Add member ----
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      const res = await fetch(`${API_URL}${basePath}/access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, level: addLevel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data as { error?: { message?: string } } | null)?.error?.message ||
            `HTTP ${res.status}`
        );
      }
      setAddOpen(false);
      setAddEmail("");
      setAddLevel("read");
      fetchCollaborators();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  }

  // ---- Update level ----
  async function handleUpdateLevel(userId: string, level: "read" | "edit") {
    await fetch(`${API_URL}${basePath}/access/${userId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level }),
    });
    fetchCollaborators();
  }

  // ---- Remove member ----
  async function handleRemove(userId: string) {
    await fetch(`${API_URL}${basePath}/access/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setRemoveTarget(null);
    fetchCollaborators();
  }

  // ---- Invite link ----
  async function handleCreateInviteLink() {
    const res = await fetch(`${API_URL}${basePath}/invite-link`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setInviteLink(data.inviteLink);
    }
  }

  async function handleToggleInviteLink(enabled: boolean) {
    const res = await fetch(`${API_URL}${basePath}/invite-link`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteLink(data.inviteLink);
    }
  }

  async function handleDeleteInviteLink() {
    await fetch(`${API_URL}${basePath}/invite-link`, {
      method: "DELETE",
      credentials: "include",
    });
    setInviteLink(null);
  }

  function copyInviteLink() {
    if (!inviteLink) return;
    const url = `${window.location.origin}/join/${inviteLink.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {/* ---- Members section ---- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Members</CardTitle>
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open);
              if (!open) {
                setAddEmail("");
                setAddLevel("read");
                setAddError("");
              }
            }}
          >
            <DialogTrigger
              render={
                <Button size="sm" className="gap-1.5">
                  <UserPlus className="size-3.5" />
                  Add member
                </Button>
              }
            />
            <DialogContent>
              <form onSubmit={handleAdd}>
                <DialogHeader>
                  <DialogTitle>Add member</DialogTitle>
                  <DialogDescription>
                    Invite a user by email to collaborate on this collection.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                  {addError && (
                    <Alert variant="destructive">
                      <AlertDescription>{addError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      required
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Access level</Label>
                    <Select value={addLevel} onValueChange={(v) => setAddLevel(v as "read" | "edit")}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="edit">Edit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="mt-4">
                  <Button type="submit" disabled={addLoading}>
                    {addLoading ? "Adding..." : "Add member"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No members yet. Add a member or share an invite link.
                  </TableCell>
                </TableRow>
              ) : (
                collaborators.map((c) => (
                  <TableRow key={c.userId}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{c.userName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          @{c.userUsername}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.userEmail}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.level === "edit" ? "default" : "secondary"}>
                        {c.level === "edit" ? (
                          <><Pencil className="mr-1 size-3" />Edit</>
                        ) : (
                          <><ShieldCheck className="mr-1 size-3" />Read</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="sm" />}
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {c.level === "read" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateLevel(c.userId, "edit")
                              }
                            >
                              <Pencil className="mr-2 size-4" />
                              Change to Edit
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateLevel(c.userId, "read")
                              }
                            >
                              <ShieldCheck className="mr-2 size-4" />
                              Change to Read
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setRemoveTarget(c)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ---- Invite link section ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Invite link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {inviteLink ? (
            <>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded border bg-muted px-3 py-2 text-sm font-mono">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/join/${inviteLink.token}`}
                </code>
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  {copied ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={inviteLink.enabled ? "default" : "secondary"}>
                  {inviteLink.enabled ? "Active" : "Disabled"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Created {new Date(inviteLink.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleToggleInviteLink(!inviteLink.enabled)
                  }
                >
                  {inviteLink.enabled ? (
                    <><Link2Off className="mr-1.5 size-3.5" />Disable</>
                  ) : (
                    <><Link2 className="mr-1.5 size-3.5" />Enable</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateInviteLink}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteInviteLink}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground">
                Create a link to let anyone join this collection.
              </p>
              <Button size="sm" onClick={handleCreateInviteLink}>
                <Link2 className="mr-1.5 size-3.5" />
                Create invite link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Remove confirmation ---- */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeTarget?.userName}</strong> (@
              {removeTarget?.userUsername}) from this collection? They will lose
              access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removeTarget && handleRemove(removeTarget.userId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
