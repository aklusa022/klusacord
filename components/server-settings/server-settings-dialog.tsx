"use client";

import { useState } from "react";
import { Dialog, Tabs } from "@cloudflare/kumo";
import { Id } from "@/convex/_generated/dataModel";
import { OverviewTab } from "@/components/server-settings/overview-tab";
import { ChannelsTab } from "@/components/server-settings/channels-tab";
import { RolesTab } from "@/components/server-settings/roles-tab";
import { MembersTab } from "@/components/server-settings/members-tab";
import { InvitesTab } from "@/components/server-settings/invites-tab";

const SETTINGS_TABS = [
  { value: "overview", label: "Overview" },
  { value: "channels", label: "Channels" },
  { value: "roles", label: "Roles" },
  { value: "members", label: "Members" },
  { value: "invites", label: "Invites" },
];

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
  const [tab, setTab] = useState(defaultTab);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setTab(defaultTab);
        onOpenChange(next);
      }}
    >
      <Dialog size="xl" className="flex h-[600px] flex-col p-6">
        <Dialog.Title className="mb-4 text-lg font-semibold">Server Settings</Dialog.Title>
        <Tabs tabs={SETTINGS_TABS} value={tab} onValueChange={setTab} />
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {tab === "overview" && <OverviewTab serverId={serverId} />}
          {tab === "channels" && <ChannelsTab serverId={serverId} />}
          {tab === "roles" && <RolesTab serverId={serverId} />}
          {tab === "members" && <MembersTab serverId={serverId} />}
          {tab === "invites" && <InvitesTab serverId={serverId} />}
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
