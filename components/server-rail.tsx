"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateServerDialog } from "@/components/create-server-dialog";
import { UserAccountPanel } from "@/components/user-account-panel";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

export function ServerRail() {
  const servers = useQuery(api.servers.listMyServers);
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-rail py-3">
      <RailButton
        href="/app/friends"
        label="Friends & DMs"
        active={
          pathname.startsWith("/app/friends") || pathname.startsWith("/app/dm")
        }
      >
        <MessageCircle className="h-6 w-6" />
      </RailButton>

      <Separator className="mx-auto w-8" />

      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {servers?.map((server) => (
          <RailButton
            key={server._id}
            href={`/app/servers/${server._id}`}
            label={server.name}
            active={pathname.startsWith(`/app/servers/${server._id}`)}
          >
            <span className="text-sm font-semibold">
              {server.name.slice(0, 2).toUpperCase()}
            </span>
          </RailButton>
        ))}
      </div>

      <CreateServerDialog />
      <div className="mt-1">
        <UserAccountPanel />
      </div>
    </div>
  );
}

function RailButton({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary transition-all hover:rounded-xl hover:bg-primary hover:text-primary-foreground",
              active && "rounded-xl bg-primary text-primary-foreground",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
