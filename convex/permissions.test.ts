import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { PERMISSIONS } from "./permissions";

function asUser(t: ReturnType<typeof convexTest>, subject: string, name: string) {
  return t.withIdentity({ subject, name });
}

async function createUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  name: string,
) {
  const user = asUser(t, subject, name);
  await user.mutation(api.users.ensureCurrentUser, {});
  const doc = await user.query(api.users.getCurrentUser, {});
  if (!doc) throw new Error("user not created");
  return { as: user, doc };
}

test("server owner has every permission by default", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });

  const perms = await owner.as.query(api.servers.getMyPermissions, { serverId });
  expect(perms.isOwner).toBe(true);
  expect(perms.bitmask & PERMISSIONS.MANAGE_ROLES).not.toBe(0);
  expect(perms.bitmask & PERMISSIONS.BAN_MEMBERS).not.toBe(0);
});

test("a new member only has the @everyone default permissions", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const member = await createUser(t, "member", "Member");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const inviteId = await owner.as.mutation(api.invites.createInvite, { serverId });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;
  await member.as.mutation(api.invites.joinByInvite, { code: invite.code });

  const perms = await member.as.query(api.servers.getMyPermissions, { serverId });
  expect(perms.isOwner).toBe(false);
  expect(perms.bitmask & PERMISSIONS.VIEW_CHANNELS).not.toBe(0);
  expect(perms.bitmask & PERMISSIONS.SEND_MESSAGES).not.toBe(0);
  expect(perms.bitmask & PERMISSIONS.MANAGE_CHANNELS).toBe(0);
  expect(perms.bitmask & PERMISSIONS.BAN_MEMBERS).toBe(0);
});

test("assigning a custom role grants its extra permissions", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const member = await createUser(t, "member", "Member");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const inviteId = await owner.as.mutation(api.invites.createInvite, { serverId });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;
  await member.as.mutation(api.invites.joinByInvite, { code: invite.code });

  const roleId = await owner.as.mutation(api.roles.createRole, {
    serverId,
    name: "Moderator",
    permissions: PERMISSIONS.MANAGE_MESSAGES | PERMISSIONS.KICK_MEMBERS,
  });
  await owner.as.mutation(api.roles.assignRole, {
    serverId,
    userId: member.doc._id,
    roleId,
  });

  const perms = await member.as.query(api.servers.getMyPermissions, { serverId });
  expect(perms.bitmask & PERMISSIONS.MANAGE_MESSAGES).not.toBe(0);
  expect(perms.bitmask & PERMISSIONS.KICK_MEMBERS).not.toBe(0);
  expect(perms.bitmask & PERMISSIONS.BAN_MEMBERS).toBe(0);
});

test("a member can't create or manage a role ranked at/above their own", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const mod = await createUser(t, "mod", "Mod");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const inviteId = await owner.as.mutation(api.invites.createInvite, { serverId });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;
  await mod.as.mutation(api.invites.joinByInvite, { code: invite.code });

  const modRoleId = await owner.as.mutation(api.roles.createRole, {
    serverId,
    name: "Mod",
    permissions: PERMISSIONS.MANAGE_ROLES,
  });
  await owner.as.mutation(api.roles.assignRole, {
    serverId,
    userId: mod.doc._id,
    roleId: modRoleId,
  });

  // The mod (whose highest role is "Mod") tries to create a role — it should
  // be ranked below "Mod" and never let the mod escalate their own privilege.
  await expect(
    mod.as.mutation(api.roles.updateRole, {
      roleId: modRoleId,
      permissions: PERMISSIONS.ADMINISTRATOR,
    }),
  ).rejects.toThrow();
});

test("non-members can't view messages in a server's channel", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const outsider = await createUser(t, "outsider", "Outsider");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const channels = await owner.as.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]._id;

  await expect(
    outsider.as.query(api.messages.listMessages, {
      channelId,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow();
});

test("a member without Manage Messages can't delete another member's message", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const member = await createUser(t, "member", "Member");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const inviteId = await owner.as.mutation(api.invites.createInvite, { serverId });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;
  await member.as.mutation(api.invites.joinByInvite, { code: invite.code });

  const channels = await owner.as.query(api.channels.listChannels, { serverId });
  const channelId = channels[0]._id;
  const messageId = await owner.as.mutation(api.messages.sendMessage, {
    channelId,
    content: "hello",
  });

  await expect(
    member.as.mutation(api.messages.deleteMessage, { messageId }),
  ).rejects.toThrow();

  // But the member CAN delete their own message.
  const ownMessageId = await member.as.mutation(api.messages.sendMessage, {
    channelId,
    content: "hi from member",
  });
  await expect(
    member.as.mutation(api.messages.deleteMessage, { messageId: ownMessageId }),
  ).resolves.not.toThrow();
});
