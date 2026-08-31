import { convexTest } from "convex-test";
import { expect, test } from "vitest";
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

test("accepting a friend request creates a symmetric friendship", async () => {
  const t = convexTest(schema);
  const alice = await createUser(t, "alice", "Alice");
  const bob = await createUser(t, "bob", "Bob");

  await alice.as.mutation(api.friends.sendFriendRequest, {
    username: bob.doc.username,
  });
  const incoming = await bob.as.query(api.friends.listIncomingRequests, {});
  expect(incoming).toHaveLength(1);

  await bob.as.mutation(api.friends.respondToFriendRequest, {
    requestId: incoming[0]._id,
    accept: true,
  });

  const aliceFriends = await alice.as.query(api.friends.listFriends, {});
  const bobFriends = await bob.as.query(api.friends.listFriends, {});
  expect(aliceFriends.map((f) => f._id)).toContain(bob.doc._id);
  expect(bobFriends.map((f) => f._id)).toContain(alice.doc._id);
});

test("DMs require an existing friendship", async () => {
  const t = convexTest(schema);
  const alice = await createUser(t, "alice", "Alice");
  const bob = await createUser(t, "bob", "Bob");

  await expect(
    alice.as.mutation(api.dms.getOrCreateConversation, {
      otherUserId: bob.doc._id,
    }),
  ).rejects.toThrow();

  await alice.as.mutation(api.friends.sendFriendRequest, {
    username: bob.doc.username,
  });
  const incoming = await bob.as.query(api.friends.listIncomingRequests, {});
  await bob.as.mutation(api.friends.respondToFriendRequest, {
    requestId: incoming[0]._id,
    accept: true,
  });

  const conversationId = await alice.as.mutation(api.dms.getOrCreateConversation, {
    otherUserId: bob.doc._id,
  });
  await alice.as.mutation(api.dms.sendMessage, {
    conversationId,
    content: "hey bob",
  });

  const messages = await bob.as.query(api.dms.listMessages, {
    conversationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(messages.page).toHaveLength(1);
  expect(messages.page[0].content).toBe("hey bob");
});

test("a stranger can't send a DM without going through the conversation owner check", async () => {
  const t = convexTest(schema);
  const alice = await createUser(t, "alice", "Alice");
  const bob = await createUser(t, "bob", "Bob");
  const carol = await createUser(t, "carol", "Carol");

  await alice.as.mutation(api.friends.sendFriendRequest, {
    username: bob.doc.username,
  });
  const incoming = await bob.as.query(api.friends.listIncomingRequests, {});
  await bob.as.mutation(api.friends.respondToFriendRequest, {
    requestId: incoming[0]._id,
    accept: true,
  });
  const conversationId = await alice.as.mutation(api.dms.getOrCreateConversation, {
    otherUserId: bob.doc._id,
  });

  await expect(
    carol.as.mutation(api.dms.sendMessage, {
      conversationId,
      content: "sneaky",
    }),
  ).rejects.toThrow();
});
