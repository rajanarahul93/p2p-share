import { useState, useEffect } from "react";
import { useSignaling } from "@/lib/signaling";
import { usePeerConnection } from "@/lib/webrtc";
import { HomeView } from "./HomeView";
import { SenderView } from "./SenderView";
import { ReceiverView } from "./ReceiverView";
import { TransferView } from "./TransferView";

type AppMode = "home" | "send" | "receive" | "transfer";

export function FileShareApp() {
  const [mode, setMode] = useState<AppMode>("home");
  const [joinError, setJoinError] = useState<string | null>(null);

  const {
    connectionState: signalingState,
    roomId,
    isInitiator,
    error: signalingError,
    createRoom,
    joinRoom,
    leaveRoom,
  } = useSignaling();

  const {
    connectionState: peerState,
    isChannelOpen,
    dataChannel,
  } = usePeerConnection({
    onDataChannelOpen: () => {
      console.log("[App] DataChannel opened, switching to transfer view");
      setMode("transfer");
    },
    onDataChannelClose: () => {
      console.log("[App] DataChannel closed");
    },
    onError: (err) => {
      console.error("[App] Peer error:", err);
    },
  });

  // Check for room code in URL (QR code scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");

    if (roomParam && signalingState === "connected" && mode === "home") {
      // Use queueMicrotask to defer state update
      queueMicrotask(() => {
        setMode("receive");
        joinRoom(roomParam);
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [signalingState, mode, joinRoom]);

  // Handle signaling errors
  useEffect(() => {
    if (signalingError) {
      queueMicrotask(() => {
        setJoinError(`${signalingError.code}: ${signalingError.message}`);
      });
    }
  }, [signalingError]);

  const handleSelectMode = (selectedMode: "send" | "receive") => {
    setMode(selectedMode);
    setJoinError(null);

    if (selectedMode === "send") {
      createRoom();
    }
  };

  const handleJoinRoom = (code: string) => {
    setJoinError(null);
    joinRoom(code);
  };

  const handleCancel = () => {
    leaveRoom();
    setMode("home");
    setJoinError(null);
  };

  if (signalingState === "connecting" || signalingState === "disconnected") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Connecting to signaling server...</p>
        </div>
      </div>
    );
  }

  if (mode === "home") {
    return <HomeView onSelectMode={handleSelectMode} />;
  }

  if (mode === "send" && roomId) {
    return (
      <SenderView
        roomId={roomId}
        connectionState={peerState}
        onCancel={handleCancel}
      />
    );
  }

  if (mode === "receive") {
    return (
      <ReceiverView
        onJoin={handleJoinRoom}
        onCancel={handleCancel}
        isConnecting={!!roomId || peerState === "connecting"}
        error={joinError}
      />
    );
  }

  if (mode === "transfer" && isChannelOpen) {
    return (
      <TransferView
        isInitiator={isInitiator}
        onDisconnect={handleCancel}
        dataChannel={dataChannel}
      />
    );
  }

  // Fallback
  return <HomeView onSelectMode={handleSelectMode} />;
}
