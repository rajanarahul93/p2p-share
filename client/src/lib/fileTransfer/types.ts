export enum MessageType {
  FILE_INFO = 0x01,
  FILE_CHUNK = 0x02,
  FILE_COMPLETE = 0x03,
  FILE_ACCEPT = 0x04,
  FILE_REJECT = 0x05,
  PROGRESS = 0x10,
  ENCRYPTION_KEY = 0x20,
  QUEUE_INFO = 0x21, // NEW: Send queue metadata
}

export interface FileInfo {
  id: string; // NEW: Unique file ID
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  path?: string; // NEW: For folder structure
}

export interface QueueInfo {
  totalFiles: number;
  currentIndex: number;
}

export interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed?: number; // NEW: bytes per second
  timeRemaining?: number; // NEW: seconds
}

export interface FileMetadata extends FileInfo {
  receivedChunks: (Uint8Array | undefined)[];
  bytesReceived: number;
  startTime?: number; // NEW: For speed calculation
}

export interface FileTransferCallbacks {
  onFileOffer?: (fileInfo: FileInfo, queueInfo: QueueInfo) => Promise<boolean>; // UPDATED
  onProgress?: (
    progress: TransferProgress,
    sending: boolean,
    fileInfo?: FileInfo
  ) => void; // UPDATED
  onFileReceived?: (file: File, fileInfo: FileInfo) => void; // UPDATED
  onTransferComplete?: () => void;
  onError?: (error: string) => void;
}