"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RealtimeKitProvider, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import type Meeting from "@cloudflare/realtimekit";
import { useVoiceCall } from "@/hooks/use-voice-call";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, Select } from "@cloudflare/kumo";
import { cn } from "@/lib/utils";
import {
  MicrophoneIcon,
  MicrophoneSlashIcon,
  HeadphonesIcon,
  SpeakerSlashIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  PhoneDisconnectIcon,
  GearIcon,
} from "@phosphor-icons/react";

type TileParticipant = {
  id: string;
  name: string;
  picture: string;
  registerVideoElement: (videoElem: HTMLVideoElement) => void;
  deregisterVideoElement: (videoElem?: HTMLVideoElement) => void;
};

// Lays participants out in as close to a square grid as possible, the same
// way Discord/RealtimeKit's own UI Kit do — tiles shrink as more people
// join rather than staying a fixed size.
function computeGridDims(count: number): { cols: number; rows: number } {
  const n = Math.max(count, 1);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

function ParticipantTile({
  participant,
  isSelf,
  videoOn,
  audioOn,
  speaking,
}: {
  participant: TileParticipant;
  isSelf: boolean;
  videoOn: boolean;
  audioOn: boolean;
  speaking: boolean;
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
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-xl bg-accent ring-2 ring-transparent transition-[box-shadow]",
        speaking && "ring-emerald-500",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={cn("h-full w-full object-cover", !videoOn && "hidden")}
      />
      {!videoOn && (
        <UserAvatar
          name={participant.name}
          imageUrl={participant.picture}
          className="h-1/2 w-1/2 max-h-32 max-w-32"
        />
      )}
      <div className="absolute bottom-2 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {!audioOn && <MicrophoneSlashIcon className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">
          {participant.name}
          {isSelf ? " (you)" : ""}
        </span>
      </div>
    </div>
  );
}

function ParticipantGrid({ meeting }: { meeting: Meeting }) {
  const joined = useRealtimeKitSelector((m) => m.participants.joined);
  const activeSpeakerPeers = useRealtimeKitSelector((m) => m.participants.selectedPeers.activeSpeakerPeers);
  const { isMuted, isCameraOn } = useVoiceCall();
  const participants = joined.toArray();
  const { cols, rows } = useMemo(() => computeGridDims(participants.length + 1), [participants.length]);

  return (
    <div
      className="grid flex-1 min-h-0 min-w-0 gap-3 overflow-y-auto p-4"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(96px, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(96px, 1fr))`,
      }}
    >
      <ParticipantTile
        participant={meeting.self}
        isSelf
        videoOn={isCameraOn}
        audioOn={!isMuted}
        speaking={activeSpeakerPeers.includes(meeting.self.id)}
      />
      {participants.map((p) => (
        <ParticipantTile
          key={p.id}
          participant={p}
          isSelf={false}
          videoOn={p.videoEnabled}
          audioOn={p.audioEnabled}
          speaking={activeSpeakerPeers.includes(p.id)}
        />
      ))}
    </div>
  );
}

function deviceItems(devices: MediaDeviceInfo[], fallback: string) {
  return devices.map((d, i) => ({ value: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
}

function CallSettingsDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [current, setCurrent] = useState(() => meeting.self.getCurrentDevices());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadDevices() {
      const [audioRes, videoRes, speakerRes] = await Promise.allSettled([
        meeting.self.getAudioDevices(),
        meeting.self.getVideoDevices(),
        meeting.self.getSpeakerDevices(),
      ]);
      if (cancelled) return;
      if (audioRes.status === "fulfilled") setAudioDevices(audioRes.value);
      if (videoRes.status === "fulfilled") setVideoDevices(videoRes.value);
      if (speakerRes.status === "fulfilled") setSpeakerDevices(speakerRes.value);
      setCurrent(meeting.self.getCurrentDevices());
    }
    void loadDevices();

    const onDeviceListUpdate = () => void loadDevices();
    meeting.self.on("deviceListUpdate", onDeviceListUpdate);
    return () => {
      cancelled = true;
      meeting.self.off("deviceListUpdate", onDeviceListUpdate);
    };
  }, [open, meeting]);

  async function selectDevice(devices: MediaDeviceInfo[], deviceId: string) {
    const device = devices.find((d) => d.deviceId === deviceId);
    if (!device) return;
    await meeting.self.setDevice(device);
    setCurrent(meeting.self.getCurrentDevices());
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="sm" className="p-6">
        <Dialog.Title className="mb-4 text-lg font-semibold">Voice &amp; Video Settings</Dialog.Title>
        <div className="space-y-4">
          <Select
            label="Microphone"
            className="w-full"
            placeholder="Default microphone"
            items={deviceItems(audioDevices, "Microphone")}
            value={current.audio?.deviceId}
            onValueChange={(v) => v && selectDevice(audioDevices, v)}
          />
          <Select
            label="Speaker"
            className="w-full"
            placeholder="Default speaker"
            items={deviceItems(speakerDevices, "Speaker")}
            value={current.speaker?.deviceId}
            onValueChange={(v) => v && selectDevice(speakerDevices, v)}
          />
          <Select
            label="Camera"
            className="w-full"
            placeholder="Default camera"
            items={deviceItems(videoDevices, "Camera")}
            value={current.video?.deviceId}
            onValueChange={(v) => v && selectDevice(videoDevices, v)}
          />
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function CallControlBar({ meeting }: { meeting: Meeting }) {
  const { isMuted, isDeafened, isCameraOn, toggleMute, toggleCamera, toggleDeafen, leave } = useVoiceCall();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      <Button
        size="icon-lg"
        variant="secondary"
        onClick={() => setSettingsOpen(true)}
        aria-label="Voice and video settings"
      >
        <GearIcon />
      </Button>
      <Button size="icon-lg" variant="destructive" onClick={() => void leave()} aria-label="Disconnect">
        <PhoneDisconnectIcon />
      </Button>
      <CallSettingsDialog meeting={meeting} open={settingsOpen} onOpenChange={setSettingsOpen} />
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
      <div className="flex h-full min-h-0 flex-col">
        <ParticipantGrid meeting={meeting} />
        <CallControlBar meeting={meeting} />
      </div>
    </RealtimeKitProvider>
  );
}
