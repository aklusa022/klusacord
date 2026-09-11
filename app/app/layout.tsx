"use client";

import { ReactNode, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ServerRail } from "@/components/server-rail";
import { VoiceCallProvider } from "@/hooks/use-voice-call";
import { ActiveCallBar } from "@/components/voice/active-call-bar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const ensureUser = useMutation(api.users.ensureCurrentUser);
  const user = useQuery(api.users.getCurrentUser);

  useEffect(() => {
    void ensureUser();
    // Only needs to run once per session — creates the Convex user profile
    // if the Clerk webhook hasn't synced it yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every other query in the app assumes the current user's Convex profile
  // already exists, so hold off rendering anything else until it does —
  // this avoids a race with the `ensureUser` mutation above on first load.
  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <VoiceCallProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <div className="flex min-h-0 flex-1">
          <ServerRail />
          <div className="flex min-w-0 flex-1">{children}</div>
        </div>
        <ActiveCallBar />
      </div>
    </VoiceCallProvider>
  );
}
