"use client";

import { useVoiceCall } from "@/hooks/use-voice-call";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Headphones, HeadphoneOff, Video, VideoOff, PhoneOff, Volume2 } from "lucide-react";

export function ActiveCallBar() {
  const { status, activeChannelId, isMuted, isDeafened, isCameraOn, toggleMute, toggleCamera, toggleDeafen, leave } =
    useVoiceCall();

  if (status === "idle" || !activeChannelId) return null;

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-t bg-sidebar px-3">
      <Volume2 className="h-4 w-4 shrink-0 text-emerald-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-emerald-500">
          {status === "connecting" ? "Connecting…" : "Voice Connected"}
        </p>
      </div>
      <Button size="icon-sm" variant="ghost" onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"}>
        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={toggleDeafen}
        aria-label={isDeafened ? "Undeafen" : "Deafen"}
      >
        {isDeafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={toggleCamera}
        aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
      >
        {isCameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
      </Button>
      <Button
        size="icon-sm"
        variant="destructive"
        onClick={() => void leave()}
        aria-label="Disconnect"
      >
        <PhoneOff className="h-4 w-4" />
      </Button>
    </div>
  );
}
