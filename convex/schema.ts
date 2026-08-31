import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    displayName: v.string(),
    imageUrl: v.string(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_username", ["username"]),

  friendRequests: defineTable({
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("cancelled"),
    ),
  })
    .index("by_to", ["toUserId"])
    .index("by_from", ["fromUserId"])
    .index("by_from_and_to", ["fromUserId", "toUserId"]),

  friendships: defineTable({
    userA: v.id("users"),
    userB: v.id("users"),
  })
    .index("by_userA", ["userA"])
    .index("by_userB", ["userB"])
    .index("by_pair", ["userA", "userB"]),

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id("users"),
  }).index("by_owner", ["ownerId"]),

  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    nickname: v.optional(v.string()),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  bannedUsers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    bannedBy: v.id("users"),
    reason: v.optional(v.string()),
  })
    .index("by_server", ["serverId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  roles: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    color: v.optional(v.string()),
    position: v.number(),
    permissions: v.number(),
    isDefault: v.boolean(),
  })
    .index("by_server", ["serverId"])
    .index("by_server_and_position", ["serverId", "position"]),

  memberRoles: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  })
    .index("by_server_and_user", ["serverId", "userId"])
    .index("by_role", ["roleId"]),

  categories: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    position: v.number(),
  }).index("by_server", ["serverId"]),

  channels: defineTable({
    serverId: v.id("servers"),
    categoryId: v.optional(v.id("categories")),
    name: v.string(),
    position: v.number(),
    type: v.literal("text"),
  })
    .index("by_server", ["serverId"])
    .index("by_category", ["categoryId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
  }).index("by_channel", ["channelId"]),

  invites: defineTable({
    serverId: v.id("servers"),
    code: v.string(),
    createdBy: v.id("users"),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    uses: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_code", ["code"]),

  dmConversations: defineTable({
    userA: v.id("users"),
    userB: v.id("users"),
  })
    .index("by_userA", ["userA"])
    .index("by_userB", ["userB"])
    .index("by_pair", ["userA", "userB"]),

  dmMessages: defineTable({
    conversationId: v.id("dmConversations"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
  }).index("by_conversation", ["conversationId"]),
});
