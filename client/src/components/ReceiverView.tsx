import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface ReceiverViewProps {
  onJoin: (roomId: string) => void;
  onCancel: () => void;
  isConnecting: boolean;
  error: string | null;
}

export function ReceiverView({
  onJoin,
  onCancel,
  isConnecting,
  error,
}: ReceiverViewProps) {
  const [roomCode, setRoomCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length === 6) {
      onJoin(roomCode.toUpperCase());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (cleaned.length === 6) {
        setRoomCode(cleaned);
      }
    } catch {
      console.error("Failed to read clipboard");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100 mb-2">
            Receive Files
          </h1>
          <p className="text-slate-400">Enter the room code to connect</p>
        </div>

        {/* Input Card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-8 mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Room Code
            </label>

            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-2xl font-mono font-bold tracking-wider text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center uppercase"
                disabled={isConnecting}
                autoFocus
              />
              <button
                type="button"
                onClick={handlePaste}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 transition-colors disabled:opacity-50"
                disabled={isConnecting}
              >
                Paste
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-900 rounded-lg mb-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={roomCode.length !== 6 || isConnecting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Join Room"
              )}
            </button>
          </div>
        </form>

        {/* Back Button */}
        <button
          onClick={onCancel}
          disabled={isConnecting}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl font-medium transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
