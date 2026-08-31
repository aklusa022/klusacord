import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Permission bitmask flags.
export const PERMISSIONS = {
  VIEW_CHANNELS: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  CREATE_INVITE: 1 << 3,
  MANAGE_CHANNELS: 1 << 4,
  MANAGE_ROLES: 1 << 5,
  MANAGE_SERVER: 1 << 6,
  KICK_MEMBERS: 1 << 7,
  BAN_MEMBERS: 1 << 8,
  ADMINISTRATOR: 1 << 9,
} as const;

export type PermissionFlag = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).reduce(
  (acc, bit) => acc | bit,
  0,
);

export const DEFAULT_ROLE_PERMISSIONS =
  PERMISSIONS.VIEW_CHANNELS | PERMISSIONS.SEND_MESSAGES | PERMISSIONS.CREATE_INVITE;

export function hasPermission(bitmask: number, flag: PermissionFlag): boolean {
  return (bitmask & PERMISSIONS.ADMINISTRATOR) !== 0 || (bitmask & flag) !== 0;
}

/**
 * Computes a member's effective permission bitmask within a server:
 * the server owner always has every permission; otherwise it's the
 * bitwise OR of every role assigned to the member (which always
 * includes the server's `@everyone` default role).
 */
export async function getEffectivePermissions(
  ctx: QueryCtx | MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
): Promise<number> {
  const server = await ctx.db.get(serverId);
  if (!server) return 0;
  if (server.ownerId === userId) return ALL_PERMISSIONS;

  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  if (!membership) return 0;

  const assignments = await ctx.db
    .query("memberRoles")
    .withIndex("by_server_and_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .collect();

  const defaultRole = await ctx.db
    .query("roles")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .filter((q) => q.eq(q.field("isDefault"), true))
    .unique();

  let bitmask = defaultRole?.permissions ?? 0;
  for (const assignment of assignments) {
    const role = await ctx.db.get(assignment.roleId);
    if (role) bitmask |= role.permissions;
  }
  return bitmask;
}

export async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
): Promise<Doc<"serverMembers"> | null> {
  const server = await ctx.db.get(serverId);
  if (!server) throw new Error("Server not found");
  if (server.ownerId === userId) return null; // owner is always allowed, no membership row needed for the check
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  if (!membership) throw new Error("Not a member of this server");
  return membership;
}

export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
  flag: PermissionFlag,
): Promise<void> {
  await requireMembership(ctx, serverId, userId);
  const bitmask = await getEffectivePermissions(ctx, serverId, userId);
  if (!hasPermission(bitmask, flag)) {
    throw new Error("You do not have permission to perform this action");
  }
}

/**
 * The highest `position` among a member's assigned roles (server owner is
 * treated as above every role). Used to enforce role-hierarchy rules so a
 * member can only manage/assign roles ranked below their own highest role.
 */
export async function getHighestRolePosition(
  ctx: QueryCtx | MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
): Promise<number> {
  const server = await ctx.db.get(serverId);
  if (server?.ownerId === userId) return Number.POSITIVE_INFINITY;

  const assignments = await ctx.db
    .query("memberRoles")
    .withIndex("by_server_and_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .collect();

  let highest = 0;
  for (const assignment of assignments) {
    const role = await ctx.db.get(assignment.roleId);
    if (role && role.position > highest) highest = role.position;
  }
  return highest;
}
