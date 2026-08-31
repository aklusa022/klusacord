"use client";

import { ReactNode, use } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { ServerSidebar } from "@/components/sidebar/server-sidebar";

export default function ServerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = use(params);
  return (
    <>
      <ServerSidebar serverId={serverId as Id<"servers">} />
      <div className="flex min-w-0 flex-1">{children}</div>
    </>
  );
}
