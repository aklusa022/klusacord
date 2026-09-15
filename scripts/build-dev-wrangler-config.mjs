#!/usr/bin/env node
// `vinext build` flattens only wrangler.jsonc's TOP-LEVEL config into
// dist/server/wrangler.json — it drops the `env.dev` block entirely (verified
// by inspecting the generated file after a build). So `vinext-cloudflare
// deploy --env dev` against that flattened file has nothing to select.
//
// This script merges wrangler.jsonc's `env.dev` overrides (name/routes/vars)
// into the already-flattened dist/server/wrangler.json (which has the
// correct resolved `main`/`assets` paths that only the build step knows how
// to produce), so the result is a single, fully self-contained config for
// the dev deployment.
//
// IMPORTANT: `vinext-cloudflare deploy --config <path>` does NOT actually use
// the vars/name/routes from the file at <path> — it always re-derives those
// from wrangler.jsonc's top level regardless of --config (verified: deploying
// with --config pointed at this dev-merged file still deployed prod's
// values). So the dev deploy must go through plain `wrangler deploy --config
// dist/server/wrangler.dev.json` instead (see package.json's
// deploy:vinext:dev), which does respect the file's contents as-is.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const sourceConfigText = readFileSync(path.join(root, "wrangler.jsonc"), "utf8")
  // Strip `//` line comments (this file has no block comments) so it parses
  // as plain JSON.
  .replace(/^\s*\/\/.*$/gm, "");
const sourceConfig = JSON.parse(sourceConfigText);

const devOverrides = sourceConfig.env?.dev;
if (!devOverrides) {
  throw new Error("wrangler.jsonc has no env.dev block to merge");
}

const distConfigPath = path.join(root, "dist/server/wrangler.json");
const distConfig = JSON.parse(readFileSync(distConfigPath, "utf8"));

const merged = {
  ...distConfig,
  name: devOverrides.name,
  routes: devOverrides.routes,
  vars: devOverrides.vars,
};
delete merged.definedEnvironments;

const outPath = path.join(root, "dist/server/wrangler.dev.json");
writeFileSync(outPath, JSON.stringify(merged, null, 2));
console.log(`Wrote ${path.relative(root, outPath)} (name=${merged.name}, route=${merged.routes[0].pattern})`);
