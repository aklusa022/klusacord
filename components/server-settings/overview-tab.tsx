"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useServerPermissions } from "@/hooks/use-server-permissions";
import { PERMISSIONS } from "@/convex/permissions";

export function OverviewTab({ serverId }: { serverId: Id<"servers"> }) {
  const server = useQuery(api.servers.getServer, { serverId });
  const updateServer = useMutation(api.servers.updateServer);
  const permissions = useServerPermissions(serverId);
  const [name, setName] = useState("");

  useEffect(() => {
    if (server) setName(server.name);
  }, [server]);

  const canManage = permissions.isOwner || permissions.can(PERMISSIONS.MANAGE_SERVER);

  async function handleSave() {
    try {
      await updateServer({ serverId, name: name.trim() });
      toast.success("Server updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update server");
    }
  }

  return (
    <div className="space-y-4 p-1">
      <div className="space-y-2">
        <Label htmlFor="overview-name">Server name</Label>
        <Input
          id="overview-name"
          value={name}
          disabled={!canManage}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {canManage && (
        <Button
          disabled={!name.trim() || name === server?.name}
          onClick={handleSave}
        >
          Save changes
        </Button>
      )}
    </div>
  );
}
