"use client";

import { RealtimeKitProvider } from "@cloudflare/realtimekit-react";
import {
  RtkUiProvider,
  RtkGrid,
  RtkControlbar,
  RtkParticipantsAudio,
  RtkDialogManager,
  RtkNotifications,
  createDefaultConfig,
} from "@cloudflare/realtimekit-react-ui";
import type Meeting from "@cloudflare/realtimekit";

/**
 * Maps this app's Kumo dark-theme palette onto RealtimeKit's design-token
 * API (`RtkUiProvider`'s `config.designTokens`) — the only supported
 * theming entry point per Cloudflare's "Build Your Own UI" guide (no
 * per-component style overrides exist for web/React). Values are converted
 * from `@cloudflare/kumo`'s `[data-mode="dark"]` oklch tokens to sRGB hex.
 */
const RTK_DESIGN_TOKENS = {
  theme: "darkest" as const,
  fontFamily: "var(--font-geist-sans)",
  borderRadius: "rounded" as const,
  colors: {
    background: {
      1000: "#030303", // --color-kumo-canvas
      900: "#060606", // --color-kumo-elevated
      800: "#0b0b0b", // --color-kumo-recessed
      700: "#0f0f0f", // --color-kumo-base
      600: "#262626", // --color-kumo-tint
    },
    text: "#f5f5f5", // --text-color-kumo-default
    "text-on-brand": "#f5f5f5",
    brand: {
      500: "#5865f2", // app's existing Discord-blurple accent (globals.css --primary)
    },
    danger: "#e7000b", // --color-kumo-danger
    success: "#00d492", // --color-kumo-success
    warning: "#db6809", // --color-kumo-warning
  },
};

/**
 * The only file allowed to import `@cloudflare/realtimekit-react`/
 * `@cloudflare/realtimekit-react-ui` at this level of detail. Everything
 * else talks to the call through `useVoiceCall()`.
 *
 * This composes RealtimeKit's own UI Kit components rather than a hand-built
 * grid/audio/settings implementation — Cloudflare's docs only document a
 * supported custom-UI pattern for video, and explicitly warn that omitting
 * `RtkParticipantsAudio`/`RtkDialogManager` from a custom build means
 * "you won't hear other participants in the session."
 */
export function RtkMeetingView({ meeting }: { meeting: Meeting }) {
  return (
    <RealtimeKitProvider value={meeting}>
      <RtkUiProvider
        meeting={meeting}
        config={{ ...createDefaultConfig(), designTokens: RTK_DESIGN_TOKENS }}
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <RtkGrid aspectRatio="1:1" style={{ flex: 1, minHeight: 0 }} />
        <RtkControlbar />
        <RtkParticipantsAudio />
        <RtkDialogManager />
        <RtkNotifications />
      </RtkUiProvider>
    </RealtimeKitProvider>
  );
}
