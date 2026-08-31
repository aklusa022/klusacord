import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

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

test("an invite with maxUses can't be redeemed past its limit", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const alice = await createUser(t, "alice", "Alice");
  const bob = await createUser(t, "bob", "Bob");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const inviteId = await owner.as.mutation(api.invites.createInvite, {
    serverId,
    maxUses: 1,
  });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;

  await alice.as.mutation(api.invites.joinByInvite, { code: invite.code });
  await expect(
    bob.as.mutation(api.invites.joinByInvite, { code: invite.code }),
  ).rejects.toThrow();
});

test("an expired invite can't be redeemed", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const alice = await createUser(t, "alice", "Alice");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const inviteId = await owner.as.mutation(api.invites.createInvite, {
    serverId,
    expiresInMs: 1000,
  });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;

  vi.advanceTimersByTime(2000);

  await expect(
    alice.as.mutation(api.invites.joinByInvite, { code: invite.code }),
  ).rejects.toThrow();
  vi.useRealTimers();
});

test("a banned user can't rejoin via invite", async () => {
  const t = convexTest(schema);
  const owner = await createUser(t, "owner", "Owner");
  const alice = await createUser(t, "alice", "Alice");

  const serverId = await owner.as.mutation(api.servers.createServer, {
    name: "Test Server",
  });
  const inviteId = await owner.as.mutation(api.invites.createInvite, { serverId });
  const invites = await owner.as.query(api.invites.listServerInvites, { serverId });
  const invite = invites.find((i) => i._id === inviteId)!;

  await alice.as.mutation(api.invites.joinByInvite, { code: invite.code });
  await owner.as.mutation(api.servers.banMember, {
    serverId,
    userId: alice.doc._id,
  });

  await expect(
    alice.as.mutation(api.invites.joinByInvite, { code: invite.code }),
  ).rejects.toThrow();
});
