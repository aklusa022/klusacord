"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Id } from "@/convex/_generated/dataModel";
import { OverviewTab } from "@/components/server-settings/overview-tab";
import { ChannelsTab } from "@/components/server-settings/channels-tab";
import { RolesTab } from "@/components/server-settings/roles-tab";
import { MembersTab } from "@/components/server-settings/members-tab";
import { InvitesTab } from "@/components/server-settings/invites-tab";

export function ServerSettingsDialog({
  serverId,
  open,
  onOpenChange,
  defaultTab = "overview",
}: {
  serverId: Id<"servers">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[600px] max-w-3xl flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Server Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue={defaultTab}
          key={defaultTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invites">Invites</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto">
            <OverviewTab serverId={serverId} />
          </TabsContent>
          <TabsContent value="channels" className="min-h-0 flex-1 overflow-y-auto">
            <ChannelsTab serverId={serverId} />
          </TabsContent>
          <TabsContent value="roles" className="min-h-0 flex-1 overflow-y-auto">
            <RolesTab serverId={serverId} />
          </TabsContent>
          <TabsContent value="members" className="min-h-0 flex-1 overflow-y-auto">
            <MembersTab serverId={serverId} />
          </TabsContent>
          <TabsContent value="invites" className="min-h-0 flex-1 overflow-y-auto">
            <InvitesTab serverId={serverId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
