"use client";

import { use } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ChatPanel } from "@/components/chat/chat-panel";
import { UserAvatar } from "@/components/user-avatar";
import { useQuery } from "convex/react";

export default function DmPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const id = conversationId as Id<"dmConversations">;
  const { user } = useCurrentUser();
  const conversations = useQuery(api.dms.listConversations);
  const conversation = conversations?.find((c) => c._id === id);

  const { results, status, loadMore } = usePaginatedQuery(
    api.dms.listMessages,
    { conversationId: id },
    { initialNumItems: 30 },
  );
  const sendMessage = useMutation(api.dms.sendMessage);
  const editMessage = useMutation(api.dms.editMessage);
  const deleteMessage = useMutation(api.dms.deleteMessage);

  if (!user) return null;

  return (
    <ChatPanel
      header={
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4 font-semibold">
          {conversation?.otherUser && (
            <>
              <UserAvatar
                name={conversation.otherUser.displayName}
                imageUrl={conversation.otherUser.imageUrl}
                className="h-6 w-6"
              />
              {conversation.otherUser.displayName}
            </>
          )}
        </div>
      }
      messages={results}
      hasMore={status === "CanLoadMore"}
      isLoadingMore={status === "LoadingMore"}
      onLoadMore={() => loadMore(30)}
      currentUserId={user._id}
      onSend={(content) => sendMessage({ conversationId: id, content })}
      onEdit={(messageId, content) =>
        editMessage({ messageId: messageId as Id<"dmMessages">, content })
      }
      onDelete={(messageId) =>
        deleteMessage({ messageId: messageId as Id<"dmMessages"> })
      }
      placeholder={
        conversation?.otherUser
          ? `Message @${conversation.otherUser.displayName}`
          : "Message…"
      }
    />
  );
}
