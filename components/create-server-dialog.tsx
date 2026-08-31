"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CreateServerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createServer = useMutation(api.servers.createServer);
  const joinByInvite = useMutation(api.invites.joinByInvite);
  const router = useRouter();

  async function handleCreate() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const serverId = await createServer({ name: name.trim() });
      setOpen(false);
      setName("");
      router.push(`/app/servers/${serverId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create server");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const serverId = await joinByInvite({ code: trimmed });
      setOpen(false);
      setCode("");
      router.push(`/app/servers/${serverId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="icon" variant="secondary" className="h-12 w-12 rounded-2xl" />
        }
        aria-label="Add a server"
      >
        <Plus />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a server</DialogTitle>
          <DialogDescription>
            Create your own server, or join one with an invite code.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="create">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1">
              Create
            </TabsTrigger>
            <TabsTrigger value="join" className="flex-1">
              Join
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="server-name">Server name</Label>
              <Input
                id="server-name"
                placeholder="My Awesome Server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <DialogFooter>
              <Button disabled={!name.trim() || submitting} onClick={handleCreate}>
                Create server
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="join" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input
                id="invite-code"
                placeholder="e.g. aB3xY9zQ"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <DialogFooter>
              <Button disabled={!code.trim() || submitting} onClick={handleJoin}>
                Join server
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
