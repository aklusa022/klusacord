import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

const TTL_MS = 60 * 60 * 1000;

export const getCachedRealtimeKitKey = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("webhookKeyCache")
      .withIndex("by_provider", (q) => q.eq("provider", "realtimekit"))
      .unique();
    if (!row || Date.now() - row.fetchedAt > TTL_MS) return null;
    return row.publicKeyPem;
  },
});

export const setCachedRealtimeKitKey = internalMutation({
  args: { publicKeyPem: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("webhookKeyCache")
      .withIndex("by_provider", (q) => q.eq("provider", "realtimekit"))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, { publicKeyPem: args.publicKeyPem, fetchedAt: Date.now() });
    } else {
      await ctx.db.insert("webhookKeyCache", {
        provider: "realtimekit",
        publicKeyPem: args.publicKeyPem,
        fetchedAt: Date.now(),
      });
    }
  },
});
