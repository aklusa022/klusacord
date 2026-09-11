import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserOrThrow, getOrCreateCurrentUser } from "./users";
import {
  PERMISSIONS,
  hasPermission,
  getEffectivePermissions,
  requireMembership,
  requireChannelPermission,
} from "./permissions";

export const listMessages = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requireChannelPermission(
      ctx,
      args.channelId,
      me._id,
      PERMISSIONS.VIEW_CHANNELS,
    );
    const results = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      results.page.map(async (m) => ({
        ...m,
        author: await ctx.db.get(m.authorId),
      })),
    );
    return { ...results, page };
  },
});

export const searchMessages = query({
  args: { channelId: v.id("channels"), query: v.string() },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requireChannelPermission(
      ctx,
      args.channelId,
      me._id,
      PERMISSIONS.VIEW_CHANNELS,
    );
    const query = args.query.trim();
    if (!query) return [];
    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) =>
        q.search("content", query).eq("channelId", args.channelId),
      )
      .take(25);
    return await Promise.all(
      results.map(async (m) => ({
        ...m,
        author: await ctx.db.get(m.authorId),
      })),
    );
  },
});

export const sendMessage = mutation({
  args: { channelId: v.id("channels"), content: v.string() },
  handler: async (ctx, args) => {
    const me = await getOrCreateCurrentUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    await requireChannelPermission(
      ctx,
      args.channelId,
      me._id,
      PERMISSIONS.SEND_MESSAGES,
    );
    const content = args.content.trim();
    if (!content) throw new Error("Message can't be empty");
    return await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: me._id,
      content,
    });
  },
});

export const editMessage = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.authorId !== me._id) {
      throw new Error("You can only edit your own messages");
    }
    const content = args.content.trim();
    if (!content) throw new Error("Message can't be empty");
    await ctx.db.patch(args.messageId, { content, editedAt: Date.now() });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    const channel = await ctx.db.get(message.channelId);
    if (!channel) throw new Error("Channel not found");

    if (message.authorId !== me._id) {
      await requireMembership(ctx, channel.serverId, me._id);
      const bitmask = await getEffectivePermissions(
        ctx,
        channel.serverId,
        me._id,
      );
      if (!hasPermission(bitmask, PERMISSIONS.MANAGE_MESSAGES)) {
        throw new Error(
          "You can only delete your own messages, unless you have Manage Messages",
        );
      }
    }
    await ctx.db.delete(args.messageId);
  },
});
