"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex/react";
import usePresence, { type PresenceState } from "@convex-dev/presence/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const ServerPresenceContext = createContext<PresenceState[] | undefined>(undefined);

/**
 * Mounts one live presence session for the whole time a user is anywhere in
 * a server (not just while the members panel is open), and shares it via
 * context so multiple consumers don't each open their own heartbeat session.
 */
export function ServerPresenceProvider({
  serverId,
  children,
}: {
  serverId: Id<"servers">;
  children: ReactNode;
}) {
  const me = useQuery(api.users.getCurrentUser);
  if (!me) return <>{children}</>;
  return (
    <ServerPresenceInner serverId={serverId} userId={me._id}>
      {children}
    </ServerPresenceInner>
  );
}

function ServerPresenceInner({
  serverId,
  userId,
  children,
}: {
  serverId: Id<"servers">;
  userId: Id<"users">;
  children: ReactNode;
}) {
  const presenceState = usePresence(api.presence, serverId, userId);
  return (
    <ServerPresenceContext.Provider value={presenceState}>
      {children}
    </ServerPresenceContext.Provider>
  );
}

/** Live presence for the current server, or `undefined` while still connecting. */
export function useServerPresence(): PresenceState[] | undefined {
  return useContext(ServerPresenceContext);
}
