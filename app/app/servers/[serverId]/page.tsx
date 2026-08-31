"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export default function ServerIndexPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const { serverId } = use(params);
  const id = serverId as Id<"servers">;
  const channels = useQuery(api.channels.listChannels, { serverId: id });
  const router = useRouter();

  useEffect(() => {
    if (!channels) return;
    const first = [...channels].sort((a, b) => a.position - b.position)[0];
    if (first) {
      router.replace(`/app/servers/${id}/channels/${first._id}`);
    }
  }, [channels, id, router]);

  return null;
}
