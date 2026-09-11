import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";

test("getCachedRealtimeKitKey returns null when no row exists", async () => {
  const t = convexTest(schema);
  const pem = await t.query(internal.webhookKeys.getCachedRealtimeKitKey, {});
  expect(pem).toBeNull();
});

test("setCachedRealtimeKitKey inserts then updates the same row in place", async () => {
  const t = convexTest(schema);

  await t.mutation(internal.webhookKeys.setCachedRealtimeKitKey, { publicKeyPem: "pem-1" });
  expect(await t.query(internal.webhookKeys.getCachedRealtimeKitKey, {})).toBe("pem-1");

  await t.mutation(internal.webhookKeys.setCachedRealtimeKitKey, { publicKeyPem: "pem-2" });
  expect(await t.query(internal.webhookKeys.getCachedRealtimeKitKey, {})).toBe("pem-2");

  const rows = await t.run(async (ctx) => ctx.db.query("webhookKeyCache").collect());
  expect(rows).toHaveLength(1);
});

test("getCachedRealtimeKitKey treats a stale row as a cache miss", async () => {
  const t = convexTest(schema);
  vi.useFakeTimers();
  try {
    await t.mutation(internal.webhookKeys.setCachedRealtimeKitKey, { publicKeyPem: "pem-1" });
    expect(await t.query(internal.webhookKeys.getCachedRealtimeKitKey, {})).toBe("pem-1");

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(await t.query(internal.webhookKeys.getCachedRealtimeKitKey, {})).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
