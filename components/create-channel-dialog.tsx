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
import { MessageSquarePlus, Hash, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreateChannelDialog({
  serverId,
  categoryId,
  compact,
}: {
  serverId: Id<"servers">;
  categoryId?: Id<"categories">;
  /** Renders as a small icon-only button, for use next to a category header. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
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
        type,
      });
      setName("");
      setType("text");
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
      {compact ? (
        <DialogTrigger
          render={<Button size="icon" variant="ghost" className="h-6 w-6" />}
          aria-label="New channel"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" variant="secondary" className="gap-1.5" />}>
          <MessageSquarePlus className="h-4 w-4" />
          New Channel
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create {type === "voice" ? "voice" : "text"} channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Channel type</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("text")}
              className={cn(
                "flex flex-1 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm",
                type === "text" ? "border-primary bg-accent" : "border-border",
              )}
            >
              <Hash className="h-4 w-4" /> Text
            </button>
            <button
              type="button"
              onClick={() => setType("voice")}
              className={cn(
                "flex flex-1 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm",
                type === "voice" ? "border-primary bg-accent" : "border-border",
              )}
            >
              <Volume2 className="h-4 w-4" /> Voice
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="channel-name">Channel name</Label>
          <Input
            id="channel-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={type === "voice" ? "General Voice" : "new-channel"}
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
