import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await verifyClerkWebhook(request);
    if (!event) {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data as ClerkUserPayload;
        const username =
          data.username ??
          data.email_addresses?.[0]?.email_address?.split("@")[0] ??
          `user_${data.id.slice(-8)}`;
        const displayName =
          [data.first_name, data.last_name].filter(Boolean).join(" ") ||
          username;
        await ctx.runMutation(internal.users.upsertFromClerk, {
          clerkId: data.id,
          username,
          displayName,
          imageUrl: data.image_url ?? "",
        });
        break;
      }
      case "user.deleted": {
        const data = event.data as { id: string };
        await ctx.runMutation(internal.users.deleteByClerkId, {
          clerkId: data.id,
        });
        break;
      }
      default:
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

// Webhook deliveries are flat (no "data" wrapper) — confirmed against
// Cloudflare's docs, and distinct from the REST API's {success, data} shape.
type RealtimeKitEvent = {
  event: string;
  meeting: { id: string };
  participant?: { peerId: string; customParticipantId: string };
};

http.route({
  path: "/realtimekit-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await verifyRealtimeKitWebhook(request);
    if (!event) {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    switch (event.event) {
      case "meeting.participantJoined": {
        const participant = event.participant;
        if (participant) {
          await ctx.runMutation(internal.voiceChannels.reconcileParticipantJoined, {
            rtkMeetingId: event.meeting.id,
            userId: participant.customParticipantId as Id<"users">,
          });
        }
        break;
      }
      case "meeting.participantLeft": {
        const participant = event.participant;
        if (participant) {
          await ctx.runMutation(internal.voiceChannels.reconcileParticipantLeft, {
            rtkMeetingId: event.meeting.id,
            userId: participant.customParticipantId as Id<"users">,
          });
        }
        break;
      }
      case "meeting.ended": {
        await ctx.runMutation(internal.voiceChannels.reconcileMeetingEnded, {
          rtkMeetingId: event.meeting.id,
        });
        break;
      }
      default:
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

/**
 * Verifies a Cloudflare RealtimeKit webhook delivery. Header: `rtk-signature`
 * (base64 RSA-SHA256 over the *raw* request body — never re-serialize the
 * parsed JSON, whitespace differences invalidate the signature). The
 * well-known endpoint returns `{ data: { publicKey: "<PEM SPKI string>" } }`
 * (confirmed live, not JWK as originally assumed).
 */
async function verifyRealtimeKitWebhook(request: Request): Promise<RealtimeKitEvent | null> {
  const signature = request.headers.get("rtk-signature");
  if (!signature) return null;

  const rawBody = await request.text();

  try {
    const keysRes = await fetch("https://api.realtime.cloudflare.com/.well-known/webhooks.json");
    const keysJson = (await keysRes.json()) as { data?: { publicKey?: string } };
    const pem = keysJson.data?.publicKey;
    if (!pem) {
      console.error("No RealtimeKit webhook public key found");
      return null;
    }

    const publicKey = await crypto.subtle.importKey(
      "spki",
      pemToDer(pem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    const bodyBytes = new TextEncoder().encode(rawBody);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signatureBytes,
      bodyBytes,
    );
    if (!valid) {
      console.error("RealtimeKit webhook signature verification failed");
      return null;
    }
  } catch (err) {
    console.error("RealtimeKit webhook verification error", err);
    return null;
  }

  return JSON.parse(rawBody) as RealtimeKitEvent;
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

type ClerkUserPayload = {
  id: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string;
  email_addresses?: { email_address: string }[];
};

async function verifyClerkWebhook(
  request: Request,
): Promise<{ type: string; data: unknown } | null> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return null;
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return null;

  const body = await request.text();
  const wh = new Webhook(secret);
  try {
    return wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: unknown };
  } catch (err) {
    console.error("Clerk webhook verification failed", err);
    return null;
  }
}

export default http;
