import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getCurrentUserOrThrow } from "./users";
import { PERMISSIONS, requirePermission } from "./permissions";

export const listChannelOverrides = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requirePermission(ctx, channel.serverId, me._id, PERMISSIONS.MANAGE_CHANNELS);
    return await ctx.db
      .query("channelPermissionOverrides")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();
  },
});

export const setChannelOverride = mutation({
  args: {
    channelId: v.id("channels"),
    targetType: v.union(v.literal("role"), v.literal("member")),
    targetId: v.union(v.id("roles"), v.id("users")),
    allow: v.number(),
    deny: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requirePermission(ctx, channel.serverId, me._id, PERMISSIONS.MANAGE_ROLES);

    if (args.targetType === "role") {
      const role = await ctx.db.get(args.targetId as Id<"roles">);
      if (!role || role.serverId !== channel.serverId) {
        throw new Error("Role not found on this server");
      }
    }

    const existing = await ctx.db
      .query("channelPermissionOverrides")
      .withIndex("by_channel_and_target", (q) =>
        q
          .eq("channelId", args.channelId)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { allow: args.allow, deny: args.deny });
      return existing._id;
    }
    return await ctx.db.insert("channelPermissionOverrides", {
      channelId: args.channelId,
      serverId: channel.serverId,
      targetType: args.targetType,
      targetId: args.targetId,
      allow: args.allow,
      deny: args.deny,
    });
  },
});

export const deleteChannelOverride = mutation({
  args: {
    channelId: v.id("channels"),
    targetType: v.union(v.literal("role"), v.literal("member")),
    targetId: v.union(v.id("roles"), v.id("users")),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requirePermission(ctx, channel.serverId, me._id, PERMISSIONS.MANAGE_ROLES);

    const existing = await ctx.db
      .query("channelPermissionOverrides")
      .withIndex("by_channel_and_target", (q) =>
        q
          .eq("channelId", args.channelId)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
