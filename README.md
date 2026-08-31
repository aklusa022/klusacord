# Klusacord

A text-only Discord clone built with **Next.js**, **Convex** (realtime backend/database),
**Clerk** (authentication), and **shadcn/ui**.

Features:

- User registration & sign-in (Clerk)
- Friend requests (by exact username) + 1:1 direct messages
- Server creation, invite-code joining
- Categories and text channels
- Custom per-server roles with a permission bitmask (view/send/manage channels,
  manage roles, manage server, kick/ban members, manage messages, administrator),
  including a non-deletable `@everyone` default role and role-hierarchy enforcement
- Everything is realtime via Convex's reactive `useQuery`/`usePaginatedQuery`

## Get started

```bash
bun install
bun run dev
```

This runs the Next.js dev server and `convex dev` in parallel. On first run, `convex dev`
will prompt you to log in and create/select a Convex deployment.

## Auth setup (Clerk + Convex)

This project already has `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and
`CLERK_JWT_ISSUER_DOMAIN` configured (see `.env.local` and the Convex deployment env —
check with `npx convex env list`). If you're setting this up from scratch:

1. Create a Clerk app, then a JWT template named **`convex`** (Clerk dashboard → JWT
   Templates). Copy its **Issuer** URL.
2. Set `CLERK_JWT_ISSUER_DOMAIN` to that Issuer URL both in `.env.local` and on the
   Convex deployment: `npx convex env set CLERK_JWT_ISSUER_DOMAIN <issuer-url>`.
3. `convex/auth.config.ts` already reads this env var — no further code changes needed.

### Clerk → Convex user sync (webhook)

New/updated/deleted Clerk users are synced into the Convex `users` table via a webhook
at `convex/http.ts` (`POST /clerk-users-webhook`). To wire it up:

1. In the Clerk dashboard, go to **Webhooks** → **Add Endpoint**.
2. Set the URL to `${NEXT_PUBLIC_CONVEX_SITE_URL}/clerk-users-webhook` (the `.convex.site`
   URL, not `.convex.cloud` — see `npx convex env list` for `NEXT_PUBLIC_CONVEX_SITE_URL`).
3. Subscribe to the `user.created`, `user.updated`, and `user.deleted` events.
4. Copy the **Signing Secret** and set it on the Convex deployment:
   `npx convex env set CLERK_WEBHOOK_SECRET <whsec_...>`.

Note: even without the webhook configured, the app still works — `convex/users.ts`
lazily creates a user's Convex profile the first time they load `/app` or send a
message, as a race-safety fallback. The webhook just means a friend can find you by
username before you've ever opened the app.

## Testing

Convex functions have unit tests (via `convex-test` + Vitest) covering permission
resolution, role hierarchy, friend requests, DMs, and invite edge cases:

```bash
bun run test
```

## Project structure

- `convex/schema.ts` — data model (users, friends, servers, roles, channels, messages, invites, DMs)
- `convex/permissions.ts` — permission bitmask constants + effective-permission resolution
- `convex/*.ts` — one file per domain (`users`, `friends`, `dms`, `servers`, `roles`,
  `categories`, `channels`, `messages`, `invites`), all with argument validators and
  identity-derived auth (never trust a client-supplied user id)
- `convex/http.ts` — Clerk webhook endpoint for user sync
- `app/app/**` — the authenticated app shell (server rail, friends/DMs, servers/channels)
- `app/invite/[code]` — public invite landing page

## Learn more

- [Convex docs](https://docs.convex.dev/)
- [Clerk docs](https://clerk.com/docs)
- [Next.js docs](https://nextjs.org/docs)
# klusacord
# klusacord
