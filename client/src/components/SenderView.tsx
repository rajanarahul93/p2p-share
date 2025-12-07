import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Loader2 } from "lucide-react";

interface SenderViewProps {
  roomId: string;
  connectionState:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "failed";
  onCancel: () => void;
}

export function SenderView({
  roomId,
  connectionState,
  onCancel,
}: SenderViewProps) {
  const [copied, setCopied] = useState(false);

  // For demo: use current URL origin. In production, use your deployed domain
  const joinUrl = `${window.location.origin}?room=${roomId}`;

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusText = {
    idle: "Initializing...",
    connecting: "Waiting for peer...",
    connected: "Connected! Ready to send",
    disconnected: "Peer disconnected",
    failed: "Connection failed",
  }[connectionState];

  const statusColor = {
    idle: "text-slate-400",
    connecting: "text-amber-400",
    connected: "text-emerald-400",
    disconnected: "text-red-400",
    failed: "text-red-500",
  }[connectionState];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100 mb-2">
            Share Files
          </h1>
          <p className="text-slate-400">Scan to connect from another device</p>
        </div>

        {/* QR Code Card */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-8 mb-6">
          <div className="bg-white p-6 rounded-xl mb-6 inline-block w-full">
            <QRCodeSVG
              value={joinUrl}
              size={256}
              level="M"
              includeMargin={false}
              className="w-full h-auto"
            />
          </div>

          {/* Room Code */}
          <div className="text-center mb-4">
            <span className="text-sm text-slate-400 block mb-2">Room Code</span>
            <div className="flex items-center justify-center gap-3">
              <code className="text-3xl font-mono font-bold tracking-wider text-slate-100">
                {roomId}
              </code>
              <button
                onClick={copyRoomCode}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/50 rounded-lg">
            {connectionState === "connecting" && (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            )}
            <span className={`text-sm font-medium ${statusColor}`}>
              {statusText}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-slate-400 leading-relaxed">
            Open your phone's camera and point it at the QR code, or manually
            enter the room code on the receiving device.
          </p>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
