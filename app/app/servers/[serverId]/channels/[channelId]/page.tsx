"use client";

import { use } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServerPermissions } from "@/hooks/use-server-permissions";
import { PERMISSIONS } from "@/convex/permissions";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Hash } from "lucide-react";

export default function ChannelPage({
  params,
}: {
  params: Promise<{ serverId: string; channelId: string }>;
}) {
  const { serverId, channelId } = use(params);
  const sId = serverId as Id<"servers">;
  const cId = channelId as Id<"channels">;
  const { user } = useCurrentUser();
  const permissions = useServerPermissions(sId);
  const channels = useQuery(api.channels.listChannels, { serverId: sId });
  const channel = channels?.find((c) => c._id === cId);

  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.listMessages,
    { channelId: cId },
    { initialNumItems: 30 },
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);

  if (!user) return null;

  return (
    <ChatPanel
      header={
        <div className="flex h-12 shrink-0 items-center gap-1.5 border-b px-4 font-semibold">
          <Hash className="h-4 w-4 text-muted-foreground" />
          {channel?.name ?? "channel"}
        </div>
      }
      messages={results}
      hasMore={status === "CanLoadMore"}
      isLoadingMore={status === "LoadingMore"}
      onLoadMore={() => loadMore(30)}
      currentUserId={user._id}
      canManageMessages={permissions.can(PERMISSIONS.MANAGE_MESSAGES)}
      onSend={(content) => sendMessage({ channelId: cId, content })}
      onEdit={(messageId, content) =>
        editMessage({ messageId: messageId as Id<"messages">, content })
      }
      onDelete={(messageId) =>
        deleteMessage({ messageId: messageId as Id<"messages"> })
      }
      placeholder={channel ? `Message #${channel.name}` : "Message…"}
    />
  );
}
