import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
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
