import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  getHighestRolePosition,
  requireMembership,
  requirePermission,
} from "./permissions";

export const listRoles = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requireMembership(ctx, args.serverId, me._id);
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    return roles.sort((a, b) => b.position - a.position);
  },
});

export const createRole = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    color: v.optional(v.string()),
    permissions: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requirePermission(
      ctx,
      args.serverId,
      me._id,
      PERMISSIONS.MANAGE_ROLES,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Role name can't be empty");
    if ((args.permissions & ~ALL_PERMISSIONS) !== 0) {
      throw new Error("Invalid permission bitmask");
    }

    const myPosition = await getHighestRolePosition(ctx, args.serverId, me._id);
    const existingRoles = await ctx.db
      .query("roles")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    const nextPosition =
      existingRoles.reduce((max, r) => Math.max(max, r.position), 0) + 1;
    if (nextPosition > myPosition) {
      throw new Error(
        "You can't create a role ranked higher than your own highest role",
      );
    }

    return await ctx.db.insert("roles", {
      serverId: args.serverId,
      name,
      color: args.color,
      position: nextPosition,
      permissions: args.permissions,
      isDefault: false,
    });
  },
});

export const updateRole = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    permissions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    await requirePermission(
      ctx,
      role.serverId,
      me._id,
      PERMISSIONS.MANAGE_ROLES,
    );

    const myPosition = await getHighestRolePosition(
      ctx,
      role.serverId,
      me._id,
    );
    if (role.position >= myPosition) {
      throw new Error(
        "You can't manage a role ranked equal to or higher than your own",
      );
    }

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Role name can't be empty");
      if (role.isDefault && name !== "@everyone") {
        throw new Error("The @everyone role can't be renamed");
      }
      patch.name = name;
    }
    if (args.color !== undefined) patch.color = args.color;
    if (args.permissions !== undefined) {
      if ((args.permissions & ~ALL_PERMISSIONS) !== 0) {
        throw new Error("Invalid permission bitmask");
      }
      patch.permissions = args.permissions;
    }
    await ctx.db.patch(args.roleId, patch);
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    if (role.isDefault) throw new Error("The @everyone role can't be deleted");
    await requirePermission(
      ctx,
      role.serverId,
      me._id,
      PERMISSIONS.MANAGE_ROLES,
    );
    const myPosition = await getHighestRolePosition(
      ctx,
      role.serverId,
      me._id,
    );
    if (role.position >= myPosition) {
      throw new Error(
        "You can't delete a role ranked equal to or higher than your own",
      );
    }

    const assignments = await ctx.db
      .query("memberRoles")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();
    for (const assignment of assignments) await ctx.db.delete(assignment._id);
    await ctx.db.delete(args.roleId);
  },
});

export const assignRole = mutation({
  args: {
    serverId: v.id("servers"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requirePermission(
      ctx,
      args.serverId,
      me._id,
      PERMISSIONS.MANAGE_ROLES,
    );
    const role = await ctx.db.get(args.roleId);
    if (!role || role.serverId !== args.serverId) {
      throw new Error("Role not found on this server");
    }
    if (role.isDefault) {
      throw new Error("The @everyone role is assigned automatically");
    }
    const myPosition = await getHighestRolePosition(ctx, args.serverId, me._id);
    if (role.position >= myPosition) {
      throw new Error("You can't assign a role ranked equal to or higher than your own");
    }
    const targetMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.userId),
      )
      .unique();
    if (!targetMembership) throw new Error("That user isn't a member of this server");

    const existing = await ctx.db
      .query("memberRoles")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.userId),
      )
      .filter((q) => q.eq(q.field("roleId"), args.roleId))
      .unique();
    if (existing) return;

    await ctx.db.insert("memberRoles", {
      serverId: args.serverId,
      userId: args.userId,
      roleId: args.roleId,
    });
  },
});

export const unassignRole = mutation({
  args: {
    serverId: v.id("servers"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUserOrThrow(ctx);
    await requirePermission(
      ctx,
      args.serverId,
      me._id,
      PERMISSIONS.MANAGE_ROLES,
    );
    const role = await ctx.db.get(args.roleId);
    const myPosition = await getHighestRolePosition(ctx, args.serverId, me._id);
    if (role && role.position >= myPosition) {
      throw new Error("You can't manage a role ranked equal to or higher than your own");
    }
    const existing = await ctx.db
      .query("memberRoles")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.userId),
      )
      .filter((q) => q.eq(q.field("roleId"), args.roleId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
