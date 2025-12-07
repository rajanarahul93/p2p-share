import { useCallback, useEffect, useRef, useState } from "react";
import { useSignaling } from "@/lib/signaling";
import type { ServerMessage } from "@/lib/signaling";

export type PeerConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

interface UsePeerConnectionOptions {
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
  onDataChannelMessage?: (data: ArrayBuffer | string) => void;
  onError?: (error: string) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const DATA_CHANNEL_CONFIG: RTCDataChannelInit = {
  ordered: true,
};

export function usePeerConnection(options: UsePeerConnectionOptions = {}) {
  const { send, subscribe, roomId, isInitiator } = useSignaling();

  const [connectionState, setConnectionState] =
    useState<PeerConnectionState>("idle");
  const [iceGatheringState, setIceGatheringState] =
    useState<RTCIceGatheringState>("new");
  const [isChannelOpen, setIsChannelOpen] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Use refs to avoid stale closures
  const isInitiatorRef = useRef(isInitiator);
  const optionsRef = useRef(options);

  // Keep refs in sync
  useEffect(() => {
    isInitiatorRef.current = isInitiator;
  }, [isInitiator]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const cleanup = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingCandidatesRef.current = [];
    setConnectionState("idle");
    setIceGatheringState("new");
    setIsChannelOpen(false);
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      console.log("[WebRTC] DataChannel opened");
      setConnectionState("connected");
      setIsChannelOpen(true);

      // Expose globally (temporary)
      (window as any).__dataChannel = channel;

      optionsRef.current.onDataChannelOpen?.();
    };

    channel.onclose = () => {
      console.log("[WebRTC] DataChannel closed");
      setConnectionState("disconnected");
      setIsChannelOpen(false);

      // Clean up global reference
      if ((window as any).__dataChannel === channel) {
        (window as any).__dataChannel = undefined;
      }

      optionsRef.current.onDataChannelClose?.();
    };

    channel.onerror = (event) => {
      console.error("[WebRTC] DataChannel error:", event);
      optionsRef.current.onError?.("DataChannel error");
    };

    channel.onmessage = (event) => {
      optionsRef.current.onDataChannelMessage?.(event.data);
    };

    dataChannelRef.current = channel;
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log("[WebRTC] Creating RTCPeerConnection");
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[WebRTC] Sending ICE candidate");
        send({
          type: "ice-candidate",
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] ICE gathering state:", pc.iceGatheringState);
      setIceGatheringState(pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);
      switch (pc.connectionState) {
        case "connecting":
          setConnectionState("connecting");
          break;
        case "connected":
          setConnectionState("connected");
          break;
        case "disconnected":
        case "closed":
          setConnectionState("disconnected");
          break;
        case "failed":
          setConnectionState("failed");
          optionsRef.current.onError?.("Connection failed");
          break;
      }
    };

    pc.ondatachannel = (event) => {
      console.log("[WebRTC] Received DataChannel");
      setupDataChannel(event.channel);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [send, setupDataChannel]);

  const addPendingCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(candidate);
        console.log("[WebRTC] Added pending ICE candidate");
      } catch (err) {
        console.error("[WebRTC] Failed to add ICE candidate:", err);
      }
    }
    pendingCandidatesRef.current = [];
  }, []);

  const initiateConnection = useCallback(async () => {
    console.log("[WebRTC] Initiating connection as creator");
    setConnectionState("connecting");
    const pc = createPeerConnection();

    const channel = pc.createDataChannel("file-transfer", DATA_CHANNEL_CONFIG);
    setupDataChannel(channel);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[WebRTC] Sending offer");
      send({ type: "offer", sdp: offer.sdp! });
    } catch (err) {
      console.error("[WebRTC] Failed to create offer:", err);
      optionsRef.current.onError?.("Failed to create offer");
      cleanup();
    }
  }, [createPeerConnection, setupDataChannel, send, cleanup]);

  const handleOffer = useCallback(
    async (sdp: string) => {
      console.log("[WebRTC] Received offer, creating answer");
      setConnectionState("connecting");
      const pc = createPeerConnection();

      try {
        await pc.setRemoteDescription({ type: "offer", sdp });
        await addPendingCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("[WebRTC] Sending answer");
        send({ type: "answer", sdp: answer.sdp! });
      } catch (err) {
        console.error("[WebRTC] Failed to handle offer:", err);
        optionsRef.current.onError?.("Failed to handle offer");
        cleanup();
      }
    },
    [createPeerConnection, addPendingCandidates, send, cleanup]
  );

  const handleAnswer = useCallback(
    async (sdp: string) => {
      console.log("[WebRTC] Received answer");
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription({ type: "answer", sdp });
        await addPendingCandidates();
      } catch (err) {
        console.error("[WebRTC] Failed to handle answer:", err);
        optionsRef.current.onError?.("Failed to handle answer");
      }
    },
    [addPendingCandidates]
  );

  const handleIceCandidate = useCallback(
    async (
      candidate: string,
      sdpMid: string | null,
      sdpMLineIndex: number | null
    ) => {
      const pc = peerConnectionRef.current;
      const iceCandidate: RTCIceCandidateInit = {
        candidate,
        sdpMid,
        sdpMLineIndex,
      };

      if (!pc || !pc.remoteDescription) {
        console.log("[WebRTC] Queuing ICE candidate");
        pendingCandidatesRef.current.push(iceCandidate);
        return;
      }

      try {
        await pc.addIceCandidate(iceCandidate);
        console.log("[WebRTC] Added ICE candidate");
      } catch (err) {
        console.error("[WebRTC] Failed to add ICE candidate:", err);
      }
    },
    []
  );

  function sendOverDataChannel(
    channel: RTCDataChannel,
    data: string | ArrayBuffer
  ): void {
    // Narrow types explicitly to match the DOM overloads
    if (typeof data === "string") {
      channel.send(data);
    } else {
      // ArrayBuffer branch
      channel.send(data as ArrayBuffer);
    }
  }

  const sendData = useCallback((data: ArrayBuffer | string) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      console.warn("[WebRTC] DataChannel not open");
      return false;
    }

    sendOverDataChannel(channel, data);
    return true;
  }, []);

  // Subscribe to signaling messages
  useEffect(() => {
    const unsubscribe = subscribe((message: ServerMessage) => {
      switch (message.type) {
        case "peer-joined":
          // Use ref to get current value, not stale closure
          console.log(
            "[WebRTC] Peer joined, isInitiator:",
            isInitiatorRef.current
          );
          if (isInitiatorRef.current) {
            initiateConnection();
          }
          break;
        case "offer":
          handleOffer(message.sdp);
          break;
        case "answer":
          handleAnswer(message.sdp);
          break;
        case "ice-candidate":
          handleIceCandidate(
            message.candidate,
            message.sdpMid,
            message.sdpMLineIndex
          );
          break;
        case "peer-left":
          console.log("[WebRTC] Peer left, cleaning up");
          cleanup();
          break;
      }
    });

    return unsubscribe;
  }, [
    subscribe,
    initiateConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup,
  ]);

  // Cleanup on unmount or room change
  useEffect(() => {
    // When roomId becomes null, we avoid calling cleanup() immediately
    // inside the effect body to prevent state updates during render.

    return () => {
      cleanup();
    };
  }, [roomId, cleanup]);

  return {
    connectionState,
    iceGatheringState,
    sendData,
    cleanup,
    isChannelOpen,
    dataChannel: dataChannelRef.current,
  };
}
