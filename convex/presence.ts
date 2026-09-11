import { v } from "convex/values";
import { Presence } from "@convex-dev/presence";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";
import { requireMembership } from "./permissions";

export const presence = new Presence(components.presence);

// Rooms are server IDs — presence is scoped per-server, matching where the
// members panel lives.

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const me = await getCurrentUserOrThrow(ctx);
    if (userId !== me._id) throw new Error("Cannot report presence for another user");
    await requireMembership(ctx, roomId as Id<"servers">, me._id);
    return await presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    // Avoid adding per-user reads so all subscriptions can share the same cache.
    return await presence.list(ctx, roomToken);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Can't check auth here — it's called over HTTP from sendBeacon on tab close.
    return await presence.disconnect(ctx, sessionToken);
  },
});

// Authenticated helper for the members panel: presence for every member of
// a server, independent of any single caller's own room token. Requires
// membership in the server being queried.
export const listServerPresence = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requireMembership(ctx, serverId, me._id);
    return await presence.listRoom(ctx, serverId);
  },
});
