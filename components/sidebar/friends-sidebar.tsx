"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { AddFriendDialog } from "@/components/add-friend-dialog";
import { cn } from "@/lib/utils";
import { UsersIcon } from "@phosphor-icons/react";

export function FriendsSidebar() {
  const conversations = useQuery(api.dms.listConversations);
  const pathname = usePathname();

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-12 items-center border-b px-4 font-semibold shadow-sm">
        Klusacord
      </div>
      <div className="p-2">
        <Link
          href="/app/friends"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            pathname === "/app/friends" && "bg-accent text-accent-foreground",
          )}
        >
          <UsersIcon className="h-4 w-4" />
          Friends
        </Link>
      </div>
      <div className="flex items-center justify-between px-4 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">
        Direct Messages
        <AddFriendDialog />
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-0.5 pb-2">
          {conversations?.map((c) =>
            c.otherUser ? (
              <Link
                key={c._id}
                href={`/app/dm/${c._id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  pathname === `/app/dm/${c._id}` &&
                    "bg-accent text-accent-foreground",
                )}
              >
                <UserAvatar
                  name={c.otherUser.displayName}
                  imageUrl={c.otherUser.imageUrl}
                  className="h-7 w-7"
                />
                <span className="truncate">{c.otherUser.displayName}</span>
              </Link>
            ) : null,
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
