import { useRef, useState } from "react";
import { useFileTransfer } from "@/lib/fileTransfer";
import {  Download, X, Check, Folder, Files } from "lucide-react";

interface TransferViewProps {
  isInitiator: boolean;
  onDisconnect: () => void;
  dataChannel: RTCDataChannel | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function TransferView({
  isInitiator,
  onDisconnect,
  dataChannel,
}: TransferViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [receivedFiles, setReceivedFiles] = useState<
    Array<{ file: File; info: any }>
  >([]);

  const {
    sendFiles,
    acceptFile,
    rejectFile,
    isSending,
    isReceiving,
    sendProgress,
    receiveProgress,
    pendingOffer,
    currentSendFile,
    currentReceiveFile,
  } = useFileTransfer({
    dataChannel,
    isInitiator,
    onFileReceived: (file, fileInfo) => {
      console.log("[Transfer] File received:", file.name);
      setReceivedFiles((prev) => [...prev, { file, info: fileInfo }]);
    },
    onError: (err) => {
      console.error("[Transfer] Error:", err);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      sendFiles(files);
    }
    e.target.value = "";
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      console.log(`[Transfer] Sending folder with ${files.length} files`);
      sendFiles(files);
    }
    e.target.value = "";
  };

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllFiles = () => {
    receivedFiles.forEach(({ file }) => downloadFile(file));
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-700 rounded-full mb-4">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-emerald-400">
              Connected
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">
            File Transfer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Encrypted • Direct • No limits
          </p>
        </div>

        {/* Pending Offer */}
        {pendingOffer && (
          <div className="bg-amber-950/50 border border-amber-800 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-amber-100 mb-2">
              Incoming File
            </h2>
            <p className="text-amber-200 mb-4">
              <strong>{pendingOffer.name}</strong>
              <span className="text-amber-400 ml-2">
                ({formatBytes(pendingOffer.size)})
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={acceptFile}
                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Accept
              </button>
              <button
                onClick={rejectFile}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Send Progress */}
        {sendProgress && currentSendFile && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium text-sm truncate max-w-[60%]">
                {currentSendFile.name}
              </span>
              <span className="text-slate-400 text-sm">
                {sendProgress.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${sendProgress.percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>
                {formatBytes(sendProgress.transferred)} /{" "}
                {formatBytes(sendProgress.total)}
              </span>
              {sendProgress.speed && sendProgress.speed > 0 && (
                <span className="text-indigo-400 font-medium">
                  {formatSpeed(sendProgress.speed)}
                  {sendProgress.timeRemaining && sendProgress.timeRemaining > 1
                    ? ` • ${formatTime(sendProgress.timeRemaining)}`
                    : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Receive Progress */}
        {receiveProgress && currentReceiveFile && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium text-sm truncate max-w-[60%]">
                {currentReceiveFile.name}
              </span>
              <span className="text-slate-400 text-sm">
                {receiveProgress.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${receiveProgress.percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>
                {formatBytes(receiveProgress.transferred)} /{" "}
                {formatBytes(receiveProgress.total)}
              </span>
              {receiveProgress.speed && receiveProgress.speed > 0 && (
                <span className="text-emerald-400 font-medium">
                  {formatSpeed(receiveProgress.speed)}
                  {receiveProgress.timeRemaining &&
                  receiveProgress.timeRemaining > 1
                    ? ` • ${formatTime(receiveProgress.timeRemaining)}`
                    : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Received Files */}
        {receivedFiles.length > 0 && (
          <div className="bg-emerald-950/30 border border-emerald-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-emerald-100">
                Received Files ({receivedFiles.length})
              </h2>
              {receivedFiles.length > 1 && (
                <button
                  onClick={downloadAllFiles}
                  className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Download All
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {receivedFiles.map(({ file }, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg"
                >
                  <div className="p-2 bg-emerald-600/20 rounded-lg">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-100 font-medium text-sm truncate">
                      {file.name}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Send Controls */}
        {!isSending && !isReceiving && !pendingOffer && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              /* @ts-ignore */
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium flex flex-col items-center justify-center gap-2 transition-colors"
              >
                <Files className="w-6 h-6" />
                <span className="text-sm">Select Files</span>
              </button>

              <button
                onClick={() => folderInputRef.current?.click()}
                className="py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium flex flex-col items-center justify-center gap-2 transition-colors"
              >
                <Folder className="w-6 h-6" />
                <span className="text-sm">Select Folder</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 text-center mt-3">
              No file size limit • Multiple files supported
            </p>
          </div>
        )}

        {/* Waiting State for Receiver */}
        {!isSending &&
          !isReceiving &&
          !pendingOffer &&
          receivedFiles.length === 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center mb-6">
              <Download className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400 mb-1">Ready to transfer</p>
              <p className="text-sm text-slate-500">
                Both devices can send and receive files
              </p>
            </div>
          )}

        <button
          onClick={onDisconnect}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}