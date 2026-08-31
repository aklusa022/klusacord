import { v } from "convex/values";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { getCurrentUserOrThrow, getOrCreateCurrentUser } from "./users";
import { Id } from "./_generated/dataModel";

function orderPair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

async function findFriendship(
  ctx: QueryCtx | MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
) {
  const [userA, userB] = orderPair(a, b);
  return await ctx.db
    .query("friendships")
    .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
}

export const sendFriendRequest = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const me = await getOrCreateCurrentUser(ctx);
    const target = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.trim()))
      .unique();
    if (!target) throw new Error("No user found with that username");
    if (target._id === me._id) {
      throw new Error("You can't friend request yourself");
    }

    const existingFriendship = await findFriendship(ctx, me._id, target._id);
    if (existingFriendship) throw new Error("You're already friends");

    const reverseRequest = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_and_to", (q) =>
        q.eq("fromUserId", target._id).eq("toUserId", me._id),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .unique();
    if (reverseRequest) {
      // They already requested us — accept it instead of creating a duplicate.
      await ctx.db.patch(reverseRequest._id, { status: "accepted" });
      const [userA, userB] = orderPair(me._id, target._id);
      await ctx.db.insert("friendships", { userA, userB });
      return { autoAccepted: true };
    }

    const existing = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_and_to", (q) =>
        q.eq("fromUserId", me._id).eq("toUserId", target._id),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .unique();
    if (existing) throw new Error("Friend request already sent");

    await ctx.db.insert("friendRequests", {
      fromUserId: me._id,
      toUserId: target._id,
      status: "pending",
    });
    return { autoAccepted: false };
  },
});

export const respondToFriendRequest = mutation({
  args: {
    requestId: v.id("friendRequests"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Friend request not found");
    if (request.toUserId !== me._id) {
      throw new Error("This request isn't addressed to you");
    }
    if (request.status !== "pending") {
      throw new Error("This request has already been resolved");
    }

    if (args.accept) {
      await ctx.db.patch(request._id, { status: "accepted" });
      const [userA, userB] = orderPair(request.fromUserId, request.toUserId);
      const existing = await findFriendship(ctx, userA, userB);
      if (!existing) {
        await ctx.db.insert("friendships", { userA, userB });
      }
    } else {
      await ctx.db.patch(request._id, { status: "declined" });
    }
  },
});

export const cancelFriendRequest = mutation({
  args: { requestId: v.id("friendRequests") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Friend request not found");
    if (request.fromUserId !== me._id) {
      throw new Error("You can only cancel requests you sent");
    }
    await ctx.db.patch(request._id, { status: "cancelled" });
  },
});

export const removeFriend = mutation({
  args: { friendUserId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const friendship = await findFriendship(ctx, me._id, args.friendUserId);
    if (!friendship) throw new Error("You're not friends with this user");
    await ctx.db.delete(friendship._id);
  },
});

export const listFriends = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUserOrThrow(ctx);
    const asA = await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", me._id))
      .collect();
    const asB = await ctx.db
      .query("friendships")
      .withIndex("by_userB", (q) => q.eq("userB", me._id))
      .collect();

    const friendIds = [
      ...asA.map((f) => f.userB),
      ...asB.map((f) => f.userA),
    ];
    const friends = await Promise.all(friendIds.map((id) => ctx.db.get(id)));
    return friends.filter((f): f is NonNullable<typeof f> => f !== null);
  },
});

export const listIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUserOrThrow(ctx);
    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_to", (q) => q.eq("toUserId", me._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    return await Promise.all(
      requests.map(async (r) => ({
        ...r,
        fromUser: await ctx.db.get(r.fromUserId),
      })),
    );
  },
});

export const listOutgoingRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUserOrThrow(ctx);
    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_from", (q) => q.eq("fromUserId", me._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    return await Promise.all(
      requests.map(async (r) => ({
        ...r,
        toUser: await ctx.db.get(r.toUserId),
      })),
    );
  },
});
