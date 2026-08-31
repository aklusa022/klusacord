"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export function AddFriendDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sendFriendRequest = useMutation(api.friends.sendFriendRequest);

  async function handleSubmit() {
    const trimmed = username.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const result = await sendFriendRequest({ username: trimmed });
      toast.success(
        result.autoAccepted
          ? `You're now friends with ${trimmed}!`
          : `Friend request sent to ${trimmed}`,
      );
      setUsername("");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send friend request",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="icon" variant="ghost" className="h-6 w-6" />}
        aria-label="Add friend"
      >
        <UserPlus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add friend</DialogTitle>
          <DialogDescription>
            You can add a friend by their exact username.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="e.g. alexk"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        <DialogFooter>
          <Button disabled={!username.trim() || submitting} onClick={handleSubmit}>
            Send friend request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
