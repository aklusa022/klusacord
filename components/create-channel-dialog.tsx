"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CreateChannelDialog({
  serverId,
  categoryId,
}: {
  serverId: Id<"servers">;
  categoryId?: Id<"categories">;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createChannel = useMutation(api.channels.createChannel);
  const router = useRouter();

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const channelId = await createChannel({
        serverId,
        categoryId,
        name: trimmed,
      });
      setName("");
      setOpen(false);
      router.push(`/app/servers/${serverId}/channels/${channelId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" className="h-5 w-5" />}>
        <Plus className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create text channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="channel-name">Channel name</Label>
          <Input
            id="channel-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="new-channel"
          />
        </div>
        <DialogFooter>
          <Button disabled={!name.trim() || submitting} onClick={handleSubmit}>
            Create channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
