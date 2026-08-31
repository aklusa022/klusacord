import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { PERMISSIONS, requireMembership, requirePermission } from "./permissions";

export const listCategories = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requireMembership(ctx, args.serverId, me._id);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    return categories.sort((a, b) => a.position - b.position);
  },
});

export const createCategory = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requirePermission(
      ctx,
      args.serverId,
      me._id,
      PERMISSIONS.MANAGE_CHANNELS,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Category name can't be empty");
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    const position =
      existing.reduce((max, c) => Math.max(max, c.position), -1) + 1;
    return await ctx.db.insert("categories", {
      serverId: args.serverId,
      name,
      position,
    });
  },
});

export const renameCategory = mutation({
  args: { categoryId: v.id("categories"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    await requirePermission(
      ctx,
      category.serverId,
      me._id,
      PERMISSIONS.MANAGE_CHANNELS,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Category name can't be empty");
    await ctx.db.patch(args.categoryId, { name });
  },
});

export const reorderCategory = mutation({
  args: { categoryId: v.id("categories"), position: v.number() },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    await requirePermission(
      ctx,
      category.serverId,
      me._id,
      PERMISSIONS.MANAGE_CHANNELS,
    );
    await ctx.db.patch(args.categoryId, { position: args.position });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    await requirePermission(
      ctx,
      category.serverId,
      me._id,
      PERMISSIONS.MANAGE_CHANNELS,
    );
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    for (const channel of channels) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
        .collect();
      for (const message of messages) await ctx.db.delete(message._id);
      await ctx.db.delete(channel._id);
    }
    await ctx.db.delete(args.categoryId);
  },
});
