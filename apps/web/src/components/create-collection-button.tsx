"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Globe, Lock, Check } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function CreateCollectionButton({ iconOnly }: { iconOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description, visibility }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data as { error?: { message?: string } } | null)?.error?.message ||
            `HTTP ${res.status}`
        );
      }

      setOpen(false);
      setName("");
      setDescription("");
      setVisibility("private");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          iconOnly ? (
            <button className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors" />
          ) : (
            <Button className="gap-2" />
          )
        }
      >
        <Plus className={iconOnly ? "size-3.5" : "size-4"} />
        {!iconOnly && "New collection"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create collection</DialogTitle>
            <DialogDescription>
              Create a new collection to store your artifacts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                placeholder="my-collection"
                pattern="^[a-zA-Z0-9_-]+$"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collection-desc">Description</Label>
              <Input
                id="collection-desc"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collection-vis">Visibility</Label>
              <Select value={visibility} onValueChange={(v) => v && setVisibility(v)}>
                <SelectTrigger id="collection-vis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="w-72">
                  <SelectPrimitive.Item
                    value="public"
                    className="relative flex w-full cursor-default gap-2 rounded-md px-2 py-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <SelectPrimitive.ItemIndicator
                      render={<span className="flex size-5 shrink-0 items-center justify-center" />}
                    >
                      <Check className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                    <div className="flex flex-col gap-0.5">
                      <SelectPrimitive.ItemText className="flex items-center gap-1.5 font-medium">
                        <Globe className="size-4" />
                        Public
                      </SelectPrimitive.ItemText>
                      <span className="text-xs text-muted-foreground font-normal">
                        Anyone on the internet can see this collection. You choose who can commit.
                      </span>
                    </div>
                  </SelectPrimitive.Item>
                  <SelectPrimitive.Item
                    value="private"
                    className="relative flex w-full cursor-default gap-2 rounded-md px-2 py-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <SelectPrimitive.ItemIndicator
                      render={<span className="flex size-5 shrink-0 items-center justify-center" />}
                    >
                      <Check className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                    <div className="flex flex-col gap-0.5">
                      <SelectPrimitive.ItemText className="flex items-center gap-1.5 font-medium">
                        <Lock className="size-4" />
                        Private
                      </SelectPrimitive.ItemText>
                      <span className="text-xs text-muted-foreground font-normal">
                        You choose who can see and commit to this collection.
                      </span>
                    </div>
                  </SelectPrimitive.Item>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
