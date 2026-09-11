import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
  internalAction,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";
import { PERMISSIONS, requireMembership, requireChannelPermission } from "./permissions";

async function rtkFetch(path: string, method: "GET" | "POST", body?: unknown) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const appId = process.env.REALTIMEKIT_APP_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !appId || !token) {
    throw new Error(
      "Cloudflare RealtimeKit is not configured (CLOUDFLARE_ACCOUNT_ID / REALTIMEKIT_APP_ID / CLOUDFLARE_API_TOKEN)",
    );
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const json = (await res.json()) as {
    success: boolean;
    data: unknown;
    error?: unknown;
    errors?: unknown;
  };
  if (!res.ok || !json.success) {
    throw new Error(
      `RealtimeKit API error (${path}): ${JSON.stringify(json.error ?? json.errors ?? json)}`,
    );
  }
  return json.data as Record<string, unknown>;
}

export const listVoiceParticipants = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requireMembership(ctx, args.serverId, me._id);
    const rows = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    return Promise.all(
      rows.map(async (r) => ({
        channelId: r.channelId,
        userId: r.userId,
        joinedAt: r.joinedAt,
        user: await ctx.db.get(r.userId),
      })),
    );
  },
});

export const myActiveCall = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = await getCurrentUserOrThrow(ctx);
    const row = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .unique();
    if (!row) return null;
    const channel = await ctx.db.get(row.channelId);
    if (!channel) return null;
    return { channelId: row.channelId, serverId: row.serverId, channelName: channel.name };
  },
});

export const assertCanJoin = internalQuery({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (channel.type !== "voice") throw new Error("Not a voice channel");
    await requireChannelPermission(ctx, args.channelId, me._id, PERMISSIONS.CONNECT);

    const session = await ctx.db
      .query("voiceChannelSessions")
      .withIndex("by_channel_and_status", (q) =>
        q.eq("channelId", args.channelId).eq("status", "active"),
      )
      .unique();

    return {
      me,
      channel,
      activeRtkMeetingId: session?.rtkMeetingId ?? null,
    };
  },
});

export const recordMeetingCreated = internalMutation({
  args: { channelId: v.id("channels"), serverId: v.id("servers"), rtkMeetingId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("voiceChannelSessions")
      .withIndex("by_channel_and_status", (q) =>
        q.eq("channelId", args.channelId).eq("status", "active"),
      )
      .unique();
    if (existing) return existing.rtkMeetingId;
    await ctx.db.insert("voiceChannelSessions", {
      channelId: args.channelId,
      serverId: args.serverId,
      rtkMeetingId: args.rtkMeetingId,
      status: "active",
      startedAt: Date.now(),
    });
    return args.rtkMeetingId;
  },
});

async function upsertVoiceParticipant(
  ctx: MutationCtx,
  args: {
    channelId: Id<"channels">;
    serverId: Id<"servers">;
    userId: Id<"users">;
    rtkMeetingId: string;
    rtkParticipantId?: string;
  },
) {
  const elsewhere = await ctx.db
    .query("voiceParticipants")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .unique();
  if (elsewhere) await ctx.db.delete(elsewhere._id);

  await ctx.db.insert("voiceParticipants", {
    channelId: args.channelId,
    serverId: args.serverId,
    userId: args.userId,
    rtkMeetingId: args.rtkMeetingId,
    rtkParticipantId: args.rtkParticipantId,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
}

export const recordUserJoinedVoiceChannel = internalMutation({
  args: {
    channelId: v.id("channels"),
    serverId: v.id("servers"),
    userId: v.id("users"),
    rtkMeetingId: v.string(),
    rtkParticipantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await upsertVoiceParticipant(ctx, args);
  },
});

export const joinVoiceChannel = action({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args): Promise<{ authToken: string; meetingId: string }> => {
    const {
      me,
      channel,
      activeRtkMeetingId,
    }: { me: Doc<"users">; channel: Doc<"channels">; activeRtkMeetingId: string | null } =
      await ctx.runQuery(internal.voiceChannels.assertCanJoin, { channelId: args.channelId });

    let rtkMeetingId = activeRtkMeetingId;
    if (!rtkMeetingId) {
      const meeting = await rtkFetch("/meetings", "POST", {
        title: `channel-${args.channelId}`,
      });
      rtkMeetingId = (await ctx.runMutation(internal.voiceChannels.recordMeetingCreated, {
        channelId: args.channelId,
        serverId: channel.serverId,
        rtkMeetingId: meeting.id as string,
      })) as string;
    }

    const participant = await rtkFetch(`/meetings/${rtkMeetingId}/participants`, "POST", {
      name: me.displayName,
      preset_name: process.env.REALTIMEKIT_PRESET_NAME,
      custom_participant_id: me._id,
    });

    await ctx.runMutation(internal.voiceChannels.recordUserJoinedVoiceChannel, {
      channelId: args.channelId,
      serverId: channel.serverId,
      userId: me._id,
      rtkMeetingId,
      rtkParticipantId: participant.id as string | undefined,
    });

    return { authToken: participant.token as string, meetingId: rtkMeetingId };
  },
});

export const leaveVoiceChannel = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUserOrThrow(ctx);
    const row = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUserOrThrow(ctx);
    const row = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .unique();
    if (row) await ctx.db.patch(row._id, { lastSeenAt: Date.now() });
  },
});

export const reconcileParticipantJoined = internalMutation({
  args: { rtkMeetingId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("voiceChannelSessions")
      .withIndex("by_rtkMeetingId", (q) => q.eq("rtkMeetingId", args.rtkMeetingId))
      .unique();
    if (!session) return; // untracked/expired meeting, ignore
    await upsertVoiceParticipant(ctx, {
      channelId: session.channelId,
      serverId: session.serverId,
      userId: args.userId,
      rtkMeetingId: args.rtkMeetingId,
    });
  },
});

export const reconcileParticipantLeft = internalMutation({
  args: { rtkMeetingId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("voiceParticipants")
      .withIndex("by_rtkMeetingId_and_userId", (q) =>
        q.eq("rtkMeetingId", args.rtkMeetingId).eq("userId", args.userId),
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const reconcileMeetingEnded = internalMutation({
  args: { rtkMeetingId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("voiceChannelSessions")
      .withIndex("by_rtkMeetingId", (q) => q.eq("rtkMeetingId", args.rtkMeetingId))
      .unique();
    if (session && session.status === "active") {
      await ctx.db.patch(session._id, { status: "ended", endedAt: Date.now() });
    }

    const rows = await ctx.db.query("voiceParticipants").collect();
    for (const row of rows) {
      if (row.rtkMeetingId === args.rtkMeetingId) await ctx.db.delete(row._id);
    }
  },
});

// One-time setup per environment: registers the Cloudflare RealtimeKit
// webhook against this deployment's HTTP action URL. Run manually via
// `npx convex run voiceChannels:registerWebhook` (and again with `--prod`)
// — never automatically, since re-running it would create a duplicate.
export const registerWebhook = internalAction({
  args: {},
  handler: async () => {
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) throw new Error("CONVEX_SITE_URL is not available");
    const result = await rtkFetch("/webhooks", "POST", {
      name: "disclone",
      url: `${siteUrl}/realtimekit-webhook`,
      events: ["meeting.participantJoined", "meeting.participantLeft", "meeting.ended"],
      enabled: true,
    });
    console.log("Registered RealtimeKit webhook:", result);
    return result;
  },
});
