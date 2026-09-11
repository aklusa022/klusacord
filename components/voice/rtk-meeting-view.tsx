"use client";

import { RealtimeKitProvider } from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import type Meeting from "@cloudflare/realtimekit";

/**
 * The only file in this app allowed to import
 * `@cloudflare/realtimekit-react-ui`. Everything else talks to the call
 * through `useVoiceCall()`, so swapping this one component for a fully
 * custom in-call UI later doesn't touch anything else.
 */
export function RtkMeetingView({ meeting }: { meeting: Meeting }) {
  return (
    <RealtimeKitProvider value={meeting}>
      <RtkMeeting mode="fill" meeting={meeting} showSetupScreen={false} />
    </RealtimeKitProvider>
  );
}
