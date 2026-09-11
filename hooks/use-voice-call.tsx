"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAction, useMutation } from "convex/react";
import { useRealtimeKitClient } from "@cloudflare/realtimekit-react";
import type Meeting from "@cloudflare/realtimekit";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type CallStatus = "idle" | "connecting" | "connected";

type VoiceCallContextValue = {
  meeting: Meeting | undefined;
  status: CallStatus;
  activeChannelId: Id<"channels"> | null;
  activeServerId: Id<"servers"> | null;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  join: (channelId: Id<"channels">, serverId: Id<"servers">) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleDeafen: () => void;
};

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

const HEARTBEAT_INTERVAL_MS = 20_000;

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [status, setStatus] = useState<CallStatus>("idle");
  const [activeChannelId, setActiveChannelId] = useState<Id<"channels"> | null>(null);
  const [activeServerId, setActiveServerId] = useState<Id<"servers"> | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const joinVoiceChannel = useAction(api.voiceChannels.joinVoiceChannel);
  const leaveVoiceChannel = useMutation(api.voiceChannels.leaveVoiceChannel);
  const heartbeat = useMutation(api.voiceChannels.heartbeat);

  const meetingRef = useRef(meeting);
  meetingRef.current = meeting;

  const reset = useCallback(() => {
    setStatus("idle");
    setActiveChannelId(null);
    setActiveServerId(null);
    setIsMuted(false);
    setIsDeafened(false);
    setIsCameraOn(false);
  }, []);

  const leave = useCallback(async () => {
    meetingRef.current?.leave();
    await leaveVoiceChannel({});
    reset();
  }, [leaveVoiceChannel, reset]);

  const join = useCallback(
    async (channelId: Id<"channels">, serverId: Id<"servers">) => {
      if (status !== "idle") await leave();

      setStatus("connecting");
      setActiveChannelId(channelId);
      setActiveServerId(serverId);
      try {
        const { authToken } = await joinVoiceChannel({ channelId });
        const joined = await initMeeting({
          authToken,
          defaults: { audio: true, video: false },
        });
        if (!joined) throw new Error("Failed to initialize the call");
        await joined.join();
        setStatus("connected");
      } catch (err) {
        reset();
        throw err;
      }
    },
    [status, leave, joinVoiceChannel, initMeeting, reset],
  );

  // Clears local state if the call ends from outside this client (kicked,
  // host ended the meeting, or the RealtimeKit webhook-driven server side
  // otherwise tore the session down).
  useEffect(() => {
    if (!meeting) return;
    const onRoomLeft = () => reset();
    meeting.self.on("roomLeft", onRoomLeft);
    return () => {
      meeting.self.off("roomLeft", onRoomLeft);
    };
  }, [meeting, reset]);

  // Derive mute/camera state from the SDK itself rather than only from our
  // own toggle handlers — the in-call view's mic/camera buttons now live
  // inside RealtimeKit's own `RtkControlbar`, which calls the SDK directly,
  // so this hook's state would otherwise go stale whenever that's used.
  useEffect(() => {
    if (!meeting) return;
    const onAudioUpdate = ({ audioEnabled }: { audioEnabled: boolean }) =>
      setIsMuted(!audioEnabled);
    const onVideoUpdate = ({ videoEnabled }: { videoEnabled: boolean }) =>
      setIsCameraOn(videoEnabled);
    meeting.self.on("audioUpdate", onAudioUpdate);
    meeting.self.on("videoUpdate", onVideoUpdate);
    return () => {
      meeting.self.off("audioUpdate", onAudioUpdate);
      meeting.self.off("videoUpdate", onVideoUpdate);
    };
  }, [meeting]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => void heartbeat({}), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, heartbeat]);

  const toggleMute = useCallback(() => {
    if (!meeting) return;
    if (isMuted) meeting.self.enableAudio();
    else meeting.self.disableAudio();
    setIsMuted((v) => !v);
  }, [meeting, isMuted]);

  const toggleCamera = useCallback(() => {
    if (!meeting) return;
    if (isCameraOn) meeting.self.disableVideo();
    else meeting.self.enableVideo();
    setIsCameraOn((v) => !v);
  }, [meeting, isCameraOn]);

  // RealtimeKit has no first-class "deafen" primitive — this is a v1
  // simplification tracked only locally; the UI Kit view is expected to
  // mute rendered remote audio when this is on.
  const toggleDeafen = useCallback(() => setIsDeafened((v) => !v), []);

  return (
    <VoiceCallContext.Provider
      value={{
        meeting,
        status,
        activeChannelId,
        activeServerId,
        isMuted,
        isDeafened,
        isCameraOn,
        join,
        leave,
        toggleMute,
        toggleCamera,
        toggleDeafen,
      }}
    >
      {children}
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCall(): VoiceCallContextValue {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within a VoiceCallProvider");
  return ctx;
}
