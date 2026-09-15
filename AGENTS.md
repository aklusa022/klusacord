<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Outpost project notes

- Package manager: `bun` (see `bun.lock`).
- Dev: `bun run dev` (runs `next dev` + `convex dev` in parallel).
- Verification commands: `bunx tsc --noEmit`, `bun run lint`, `bun run test`
  (Vitest + `convex-test` unit tests for Convex functions live at `convex/*.test.ts`),
  and `bunx convex dev --once` to confirm a clean deploy.
- See `README.md` for the Clerk↔Convex auth/webhook setup steps.
