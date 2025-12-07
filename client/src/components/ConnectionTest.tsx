import { useEffect, useState, useCallback, useRef } from "react";
import { useSignaling } from "@/lib/signaling";
import { usePeerConnection } from "@/lib/webrtc";
import { useFileTransfer } from "@/lib/fileTransfer";
import type { ServerMessage } from "@/lib/signaling";

// Type the data channel extension on window for safer access
declare global {
  interface Window {
    __dataChannel?: RTCDataChannel;
  }
}

export function ConnectionTest() {
  const {
    connectionState: signalingState,
    clientId,
    roomId,
    isInitiator,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    subscribe,
  } = useSignaling();

  const [joinInput, setJoinInput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [receivedFile, setReceivedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [
      ...prev.slice(-29),
      `${new Date().toLocaleTimeString()}: ${msg}`,
    ]);
  }, []);

  const { connectionState: peerState, isChannelOpen } = usePeerConnection({
    onDataChannelOpen: () => addLog("DataChannel OPEN"),
    onDataChannelClose: () => addLog("DataChannel closed"),
    onError: (err) => addLog(`Error: ${err}`),
  });

  const {
    sendFiles,
    acceptFile,
    rejectFile,
    isSending,
    isReceiving,
    sendProgress,
    receiveProgress,
    pendingOffer,
  } = useFileTransfer({
    dataChannel: isChannelOpen ? window.__dataChannel ?? null : null,
    isInitiator,
    onFileReceived: (file) => {
      addLog(`Received: ${file.name}`);
      setReceivedFile(file);
    },
    onError: (err) => addLog(`Transfer error: ${err}`),
  });

  useEffect(() => {
    return subscribe((message: ServerMessage) => {
      addLog(`Signal: ${message.type}`);
    });
  }, [subscribe, addLog]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addLog(
        `Sending: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
      );
      sendFiles([file]);
    }
  };

  const downloadReceivedFile = () => {
    if (!receivedFile) return;
    const url = URL.createObjectURL(receivedFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = receivedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const signalingColor = {
    connecting: "text-amber-400",
    connected: "text-emerald-400",
    disconnected: "text-red-400",
  }[signalingState];

  const peerColor = {
    idle: "text-slate-400",
    connecting: "text-amber-400",
    connected: "text-emerald-400",
    disconnected: "text-red-400",
    failed: "text-red-500",
  }[peerState];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-semibold tracking-tight mb-8">
        File Transfer Test
      </h1>

      {/* Status */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <h2 className="text-sm font-medium text-slate-400 mb-2">Signaling</h2>
          <div className={`text-lg font-medium ${signalingColor}`}>
            {signalingState}
          </div>
          {clientId && (
            <code className="text-xs text-slate-500 mt-1 block">
              {clientId.substring(0, 8)}
            </code>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <h2 className="text-sm font-medium text-slate-400 mb-2">
            Peer Connection
          </h2>
          <div className={`text-lg font-medium ${peerColor}`}>{peerState}</div>
          {isChannelOpen && (
            <span className="text-xs text-emerald-500">Channel ready</span>
          )}
        </div>
      </div>

      {/* Room */}
      {roomId && (
        <div className="bg-slate-900 border border-slate-800 rounded p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-sm">Room:</span>
              <code className="ml-2 text-2xl font-mono font-bold tracking-wider">
                {roomId}
              </code>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-slate-800">
              {isInitiator ? "Creator" : "Joiner"}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-2 rounded mb-6">
          {error.code}: {error.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        {!roomId ? (
          <>
            <button
              onClick={createRoom}
              disabled={signalingState !== "connected"}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded font-medium transition-colors"
            >
              Create Room
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={6}
                className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded font-mono uppercase"
              />
              <button
                onClick={() => joinRoom(joinInput)}
                disabled={
                  signalingState !== "connected" || joinInput.length < 6
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 rounded font-medium"
              >
                Join
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={leaveRoom}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-medium"
          >
            Leave Room
          </button>
        )}
      </div>

      {/* File Transfer */}
      {peerState === "connected" && (
        <div className="bg-slate-900 border border-emerald-800 rounded p-4 mb-6">
          <h2 className="text-sm font-medium text-emerald-400 mb-3">
            File Transfer
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            disabled={isSending || isReceiving}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isReceiving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded font-medium mb-4"
          >
            {isSending ? "Sending..." : "Select File"}
          </button>

          {sendProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span>Sending</span>
                <span>{sendProgress.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${sendProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {receiveProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span>Receiving</span>
                <span>{receiveProgress.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${receiveProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {receivedFile && (
            <div className="bg-slate-800 p-3 rounded flex items-center justify-between">
              <span className="text-sm">{receivedFile.name}</span>
              <button
                onClick={downloadReceivedFile}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
              >
                Download
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pending Offer */}
      {pendingOffer && (
        <div className="bg-amber-950 border border-amber-800 p-4 rounded mb-6">
          <p className="text-amber-200 mb-3">
            Incoming file: <strong>{pendingOffer.name}</strong> (
            {(pendingOffer.size / 1024 / 1024).toFixed(2)} MB)
          </p>
          <div className="flex gap-2">
            <button
              onClick={acceptFile}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded"
            >
              Accept
            </button>
            <button
              onClick={rejectFile}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4">
        <h2 className="text-sm font-medium text-slate-400 mb-2">Event Log</h2>
        <div className="font-mono text-xs space-y-1 text-slate-300 max-h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <span className="text-slate-600">Waiting...</span>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
