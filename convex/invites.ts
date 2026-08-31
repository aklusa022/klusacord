import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUserOrThrow, getOrCreateCurrentUser } from "./users";
import { PERMISSIONS, requirePermission } from "./permissions";

const CODE_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateInviteCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

export const createInvite = mutation({
  args: {
    serverId: v.id("servers"),
    expiresInMs: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requirePermission(
      ctx,
      args.serverId,
      me._id,
      PERMISSIONS.CREATE_INVITE,
    );

    let code = generateInviteCode();
    while (
      await ctx.db
        .query("invites")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique()
    ) {
      code = generateInviteCode();
    }

    return await ctx.db.insert("invites", {
      serverId: args.serverId,
      code,
      createdBy: me._id,
      expiresAt: args.expiresInMs ? Date.now() + args.expiresInMs : undefined,
      maxUses: args.maxUses,
      uses: 0,
    });
  },
});

export const listServerInvites = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requirePermission(
      ctx,
      args.serverId,
      me._id,
      PERMISSIONS.CREATE_INVITE,
    );
    return await ctx.db
      .query("invites")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");
    await requirePermission(
      ctx,
      invite.serverId,
      me._id,
      PERMISSIONS.CREATE_INVITE,
    );
    await ctx.db.delete(args.inviteId);
  },
});

export const getInviteInfo = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!invite) return null;
    if (invite.expiresAt && invite.expiresAt < Date.now()) return null;
    if (invite.maxUses !== undefined && invite.uses >= invite.maxUses) {
      return null;
    }
    const server = await ctx.db.get(invite.serverId);
    if (!server) return null;
    const memberCount = (
      await ctx.db
        .query("serverMembers")
        .withIndex("by_server", (q) => q.eq("serverId", invite.serverId))
        .collect()
    ).length;
    return { server, memberCount };
  },
});

export const joinByInvite = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const me = await getOrCreateCurrentUser(ctx);
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!invite) throw new Error("Invalid invite code");
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      throw new Error("This invite has expired");
    }
    if (invite.maxUses !== undefined && invite.uses >= invite.maxUses) {
      throw new Error("This invite has reached its use limit");
    }

    const ban = await ctx.db
      .query("bannedUsers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", invite.serverId).eq("userId", me._id),
      )
      .unique();
    if (ban) throw new Error("You are banned from this server");

    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", invite.serverId).eq("userId", me._id),
      )
      .unique();
    if (existing) return invite.serverId;

    await ctx.db.insert("serverMembers", {
      serverId: invite.serverId,
      userId: me._id,
    });
    await ctx.db.patch(invite._id, { uses: invite.uses + 1 });
    return invite.serverId;
  },
});
