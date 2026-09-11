import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { PERMISSIONS } from "./permissions";

function asUser(t: ReturnType<typeof convexTest>, subject: string, name: string) {
  return t.withIdentity({ subject, name });
}

async function createUser(t: ReturnType<typeof convexTest>, subject: string, name: string) {
  const user = asUser(t, subject, name);
  await user.mutation(api.users.ensureCurrentUser, {});
  const doc = await user.query(api.users.getCurrentUser, {});
  if (!doc) throw new Error("user not created");
  return { as: user, doc };
}

async function joinServer(
  owner: Awaited<ReturnType<typeof createUser>>,
  member: Awaited<ReturnType<typeof createUser>>,
  serverId: Id<"servers">,
) {
  const inviteId = await owner.as.mutation(api.invites.createInvite, { serverId });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;
  await member.as.mutation(api.invites.joinByInvite, { code: invite.code });
}

test("a role-level deny override on @everyone blocks a member from viewing the channel", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const member = await createUser(t, "member", "Member");

  const serverId = await owner.as.mutation(api.servers.createServer, { name: "Test Server" });
  await joinServer(owner, member, serverId);

  const channels = await owner.as.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]._id;
  const roles = await owner.as.query(api.roles.listRoles, { serverId });
  const defaultRole = roles.find((r) => r.isDefault)!;

  await owner.as.mutation(api.channelPermissions.setChannelOverride, {
    channelId,
    targetType: "role",
    targetId: defaultRole._id,
    allow: 0,
    deny: PERMISSIONS.VIEW_CHANNELS,
  });

  await expect(
    member.as.query(api.messages.listMessages, {
      channelId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow();

  // The owner bypasses channel overrides entirely.
  await expect(
    owner.as.query(api.messages.listMessages, {
      channelId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).resolves.not.toThrow();
});

test("a member-specific allow override outranks a role-level deny", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const member = await createUser(t, "member", "Member");

  const serverId = await owner.as.mutation(api.servers.createServer, { name: "Test Server" });
  await joinServer(owner, member, serverId);

  const channels = await owner.as.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]._id;
  const roles = await owner.as.query(api.roles.listRoles, { serverId });
  const defaultRole = roles.find((r) => r.isDefault)!;

  await owner.as.mutation(api.channelPermissions.setChannelOverride, {
    channelId,
    targetType: "role",
    targetId: defaultRole._id,
    allow: 0,
    deny: PERMISSIONS.VIEW_CHANNELS,
  });
  await expect(
    member.as.query(api.messages.listMessages, {
      channelId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow();

  await owner.as.mutation(api.channelPermissions.setChannelOverride, {
    channelId,
    targetType: "member",
    targetId: member.doc._id,
    allow: PERMISSIONS.VIEW_CHANNELS,
    deny: 0,
  });

  await expect(
    member.as.query(api.messages.listMessages, {
      channelId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).resolves.not.toThrow();
});

test("Administrator bypasses channel overrides entirely", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const admin = await createUser(t, "admin", "Admin");

  const serverId = await owner.as.mutation(api.servers.createServer, { name: "Test Server" });
  await joinServer(owner, admin, serverId);

  const roleId = await owner.as.mutation(api.roles.createRole, {
    serverId,
    name: "Admin",
    permissions: PERMISSIONS.ADMINISTRATOR,
  });
  await owner.as.mutation(api.roles.assignRole, { serverId, userId: admin.doc._id, roleId });

  const channels = await owner.as.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]._id;

  await owner.as.mutation(api.channelPermissions.setChannelOverride, {
    channelId,
    targetType: "member",
    targetId: admin.doc._id,
    allow: 0,
    deny: PERMISSIONS.VIEW_CHANNELS,
  });

  await expect(
    admin.as.query(api.messages.listMessages, {
      channelId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).resolves.not.toThrow();
});
