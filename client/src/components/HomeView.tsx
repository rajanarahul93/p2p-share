import { Upload, Download } from "lucide-react";

interface HomeViewProps {
  onSelectMode: (mode: "send" | "receive") => void;
}

export function HomeView({ onSelectMode }: HomeViewProps) {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-100 mb-3">
            P2P Share
          </h1>
          <p className="text-slate-400 text-lg">
            Secure peer-to-peer file sharing
          </p>
        </div>

        {/* Mode Selection */}
        <div className="space-y-4">
          <button
            onClick={() => onSelectMode("send")}
            className="w-full group relative overflow-hidden bg-slate-900/50 backdrop-blur border border-slate-800 hover:border-indigo-700 rounded-2xl p-8 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center gap-6">
              <div className="p-4 bg-indigo-600/10 rounded-xl group-hover:bg-indigo-600/20 transition-colors">
                <Upload className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-xl font-semibold text-slate-100 mb-1">
                  Send Files
                </h2>
                <p className="text-slate-400 text-sm">
                  Share files from this device
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelectMode("receive")}
            className="w-full group relative overflow-hidden bg-slate-900/50 backdrop-blur border border-slate-800 hover:border-emerald-700 rounded-2xl p-8 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center gap-6">
              <div className="p-4 bg-emerald-600/10 rounded-xl group-hover:bg-emerald-600/20 transition-colors">
                <Download className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-xl font-semibold text-slate-100 mb-1">
                  Receive Files
                </h2>
                <p className="text-slate-400 text-sm">
                  Get files from another device
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-slate-600">
            End-to-end encrypted • No server storage
          </p>
        </div>
      </div>
    </div>
  );
}
