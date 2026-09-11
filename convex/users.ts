import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const DEFAULT_AVATAR_URL = "https://cdn.discordapp.com/embed/avatars/1.png";

/**
 * Resolves the Convex `users` doc for the currently authenticated Clerk
 * identity. Throws if there's no identity, or if the Clerk webhook hasn't
 * synced the user yet. Use `getOrCreateCurrentUser` from mutations if you
 * need a race-safe lazy-create fallback.
 */
export async function getCurrentUserOrThrow(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!existing) {
    throw new Error(
      "User profile not found yet. Please wait a moment and try again.",
    );
  }
  return existing;
}

/**
 * Same as `getCurrentUserOrThrow`, but lazily creates the user record if
 * the Clerk webhook hasn't synced it yet. Only usable from mutations.
 */
export async function getOrCreateCurrentUser(
  ctx: MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (existing) return existing;

  const username = await uniqueUsernameFromIdentity(ctx, identity);
  const userId = await ctx.db.insert("users", {
    clerkId: identity.subject,
    username,
    displayName: identity.name ?? username,
    imageUrl: identity.pictureUrl || DEFAULT_AVATAR_URL,
  });
  return (await ctx.db.get(userId))!;
}

async function uniqueUsernameFromIdentity(
  ctx: MutationCtx,
  identity: { nickname?: string; givenName?: string; subject: string },
): Promise<string> {
  const base = (
    identity.nickname ??
    identity.givenName ??
    `user_${identity.subject.slice(-8)}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  let candidate = base || `user${identity.subject.slice(-8)}`;
  let suffix = 0;
  while (
    await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .unique()
  ) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    return user;
  },
});

export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getOrCreateCurrentUser(ctx);
    return user;
  },
});

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getOrCreateCurrentUser(ctx);
    const patch: Record<string, string> = {};

    if (args.username !== undefined) {
      const username = normalizeUsername(args.username);
      if (username.length < 3 || username.length > 32) {
        throw new Error("Username must be 3-32 characters (letters, numbers, underscore)");
      }
      if (username !== me.username) {
        const existing = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", username))
          .unique();
        if (existing && existing._id !== me._id) {
          throw new Error("That username is already taken");
        }
      }
      patch.username = username;
    }

    if (args.displayName !== undefined) {
      const displayName = args.displayName.trim();
      if (!displayName || displayName.length > 32) {
        throw new Error("Display name must be 1-32 characters");
      }
      patch.displayName = displayName;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(me._id, patch);
    }
    return await ctx.db.get(me._id);
  },
});

export const setStatus = mutation({
  args: {
    status: v.union(
      v.literal("online"),
      v.literal("idle"),
      v.literal("dnd"),
      v.literal("invisible"),
    ),
  },
  handler: async (ctx, args) => {
    const me = await getOrCreateCurrentUser(ctx);
    await ctx.db.patch(me._id, { status: args.status });
    return null;
  },
});

export const backfillMissingAvatars = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (!u.imageUrl) await ctx.db.patch(u._id, { imageUrl: DEFAULT_AVATAR_URL });
    }
    return null;
  },
});

export const searchUsersByUsername = query({
  args: { prefix: v.string() },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);
    const prefix = args.prefix.trim().toLowerCase();
    if (!prefix) return [];
    const results = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", prefix).lt("username", prefix + "\uffff"),
      )
      .take(10);
    return results.map((u) => ({
      _id: u._id,
      username: u.username,
      displayName: u.displayName,
      imageUrl: u.imageUrl,
    }));
  },
});

export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    username: v.string(),
    displayName: v.string(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      // Username and display name are user-managed in-app (see
      // `updateProfile`) once created, so a later Clerk profile change
      // doesn't clobber them — only the avatar stays Clerk-sourced.
      await ctx.db.patch(existing._id, { imageUrl: args.imageUrl });
      return existing._id;
    }

    let username = args.username;
    const usernameOwner = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (usernameOwner) {
      username = `${username}_${args.clerkId.slice(-6)}`;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      username,
      displayName: args.displayName,
      imageUrl: args.imageUrl,
    });
  },
});

export const deleteByClerkId = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
