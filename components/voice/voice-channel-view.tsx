"use client";

import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useVoiceCall } from "@/hooks/use-voice-call";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { RtkMeetingView } from "@/components/voice/rtk-meeting-view";
import { Volume2 } from "lucide-react";

export function VoiceChannelView({
  serverId,
  channelId,
  channelName,
}: {
  serverId: Id<"servers">;
  channelId: Id<"channels">;
  channelName: string;
}) {
  const { meeting, status, activeChannelId, join } = useVoiceCall();
  const participants = useQuery(api.voiceChannels.listVoiceParticipants, { serverId });
  const roster = participants?.filter((p) => p.channelId === channelId) ?? [];

  if (activeChannelId === channelId && status === "connected" && meeting) {
    return <RtkMeetingView meeting={meeting} />;
  }

  const inAnotherCall = status !== "idle" && activeChannelId !== channelId;

  async function handleJoin() {
    try {
      await join(channelId, serverId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join the call");
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-2">
        <Volume2 className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold">{channelName}</p>
      </div>

      {roster.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">In this call</p>
          <div className="flex flex-wrap justify-center gap-2">
            {roster.map((p) => (
              <div key={p.userId} className="flex flex-col items-center gap-1">
                <UserAvatar name={p.user?.displayName ?? "?"} imageUrl={p.user?.imageUrl} />
                <span className="max-w-16 truncate text-xs text-muted-foreground">
                  {p.user?.displayName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button onClick={handleJoin} disabled={status === "connecting"}>
        {inAnotherCall ? "Switch to This Call" : "Join Call"}
      </Button>
    </div>
  );
}
