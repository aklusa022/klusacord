"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { LogOut, ShieldCheck } from "lucide-react";

export function AccountSettingsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: Doc<"users">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [saving, setSaving] = useState(false);
  const updateProfile = useMutation(api.users.updateProfile);
  const clerk = useClerk();

  useEffect(() => {
    if (open) {
      setDisplayName(user.displayName);
      setUsername(user.username);
    }
  }, [open, user]);

  const dirty = displayName.trim() !== user.displayName || username.trim() !== user.username;

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ displayName, username });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My Account</DialogTitle>
          <DialogDescription>
            Manage how you appear across Klusacord.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <UserAvatar name={displayName || user.displayName} imageUrl={user.imageUrl} className="h-14 w-14" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.displayName}</p>
            <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="account-display-name">Display name</Label>
            <Input
              id="account-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-username">Username</Label>
            <Input
              id="account-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">
              Friends add you by this exact username.
            </p>
          </div>
          <Button disabled={!dirty || saving} onClick={handleSave} className="w-full">
            Save changes
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => clerk.openUserProfile()}
          >
            <ShieldCheck className="h-4 w-4" />
            Manage email, password &amp; security
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={() => clerk.signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
