"use client";

import { useEffect, useRef } from "react";
import { RealtimeKitProvider, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import type Meeting from "@cloudflare/realtimekit";
import { useVoiceCall } from "@/hooks/use-voice-call";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MicrophoneIcon,
  MicrophoneSlashIcon,
  HeadphonesIcon,
  SpeakerSlashIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  PhoneDisconnectIcon,
} from "@phosphor-icons/react";

type TileParticipant = {
  id: string;
  name: string;
  picture: string;
  registerVideoElement: (videoElem: HTMLVideoElement) => void;
  deregisterVideoElement: (videoElem?: HTMLVideoElement) => void;
};

function ParticipantTile({
  participant,
  isSelf,
  videoOn,
  audioOn,
}: {
  participant: TileParticipant;
  isSelf: boolean;
  videoOn: boolean;
  audioOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // RealtimeKit owns pushing frames onto this element once registered — we
  // just mount the element for the participant's lifetime and toggle
  // visibility locally based on their reported video state.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    participant.registerVideoElement(el);
    return () => participant.deregisterVideoElement(el);
  }, [participant]);

  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-accent">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={cn("h-full w-full object-cover", !videoOn && "hidden")}
      />
      {!videoOn && <UserAvatar name={participant.name} imageUrl={participant.picture} className="h-16 w-16" />}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {!audioOn && <MicrophoneSlashIcon className="h-3.5 w-3.5" />}
        <span className="max-w-32 truncate">
          {participant.name}
          {isSelf ? " (you)" : ""}
        </span>
      </div>
    </div>
  );
}

function ParticipantGrid({ meeting }: { meeting: Meeting }) {
  const joined = useRealtimeKitSelector((m) => m.participants.joined);
  const { isMuted, isCameraOn } = useVoiceCall();
  const participants = joined.toArray();

  return (
    <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
      <ParticipantTile participant={meeting.self} isSelf videoOn={isCameraOn} audioOn={!isMuted} />
      {participants.map((p) => (
        <ParticipantTile
          key={p.id}
          participant={p}
          isSelf={false}
          videoOn={p.videoEnabled}
          audioOn={p.audioEnabled}
        />
      ))}
    </div>
  );
}

function CallControlBar() {
  const { isMuted, isDeafened, isCameraOn, toggleMute, toggleCamera, toggleDeafen, leave } = useVoiceCall();

  return (
    <div className="flex h-16 shrink-0 items-center justify-center gap-3 border-t bg-sidebar">
      <Button
        size="icon-lg"
        variant={isMuted ? "destructive" : "secondary"}
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicrophoneSlashIcon /> : <MicrophoneIcon />}
      </Button>
      <Button
        size="icon-lg"
        variant={isDeafened ? "destructive" : "secondary"}
        onClick={toggleDeafen}
        aria-label={isDeafened ? "Undeafen" : "Deafen"}
      >
        {isDeafened ? <SpeakerSlashIcon /> : <HeadphonesIcon />}
      </Button>
      <Button
        size="icon-lg"
        variant="secondary"
        onClick={toggleCamera}
        aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
      >
        {isCameraOn ? <VideoCameraIcon /> : <VideoCameraSlashIcon />}
      </Button>
      <Button size="icon-lg" variant="destructive" onClick={() => void leave()} aria-label="Disconnect">
        <PhoneDisconnectIcon />
      </Button>
    </div>
  );
}

/**
 * The only file in this app allowed to import `@cloudflare/realtimekit-react`
 * at this level of detail (video-tile rendering). Everything else talks to
 * the call through `useVoiceCall()`.
 */
export function RtkMeetingView({ meeting }: { meeting: Meeting }) {
  return (
    <RealtimeKitProvider value={meeting}>
      <div className="flex h-full flex-col">
        <ParticipantGrid meeting={meeting} />
        <CallControlBar />
      </div>
    </RealtimeKitProvider>
  );
}
