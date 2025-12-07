import {
  MessageType,
  type FileInfo,
  type FileMetadata,
  type FileTransferCallbacks,
  type QueueInfo,
} from "./types";
import { EncryptionManager } from "../crypto/encryption";

const CHUNK_SIZE = 64 * 1024;
const BUFFER_FULL_THRESHOLD = 256 * 1024;
const BUFFER_LOW_THRESHOLD = 128 * 1024;

interface QueuedFile {
  file: File;
  info: FileInfo;
}

export class FileTransferManager {
  private sendChannel: RTCDataChannel | null = null;
  private sendQueue: QueuedFile[] = [];
  private currentSendFile: { file: File; info: FileInfo } | null = null;
  private currentChunkIndex = 0;
  private totalChunks = 0;
  private isPaused = false;

  private receivingFiles = new Map<string, FileMetadata>();
  private currentReceiveFileId: string | null = null;

  private encryption: EncryptionManager;
  private isEncryptionReady = false;

  // Speed tracking
  private lastProgressTime = 0;
  private lastTransferredBytes = 0;

  constructor(private callbacks: FileTransferCallbacks) {
    this.encryption = new EncryptionManager();
  }

  setDataChannel(channel: RTCDataChannel, isInitiator: boolean): void {
    this.sendChannel = channel;

    channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;

    channel.addEventListener("bufferedamountlow", () => {
      if (this.isPaused && this.currentSendFile) {
        console.log("[FileTransfer] Buffer drained, resuming");
        this.isPaused = false;
        this.sendNextChunk();
      }
    });

    channel.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    if (isInitiator) {
      this.initializeEncryption();
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      const keyData = await this.encryption.generateKey();
      this.isEncryptionReady = true;
      this.sendMessage(MessageType.ENCRYPTION_KEY, keyData);
      console.log("[Encryption] Key sent to peer");
    } catch (err) {
      console.error("[Encryption] Failed to generate key:", err);
      this.callbacks.onError?.("Failed to initialize encryption");
    }
  }

  async sendFiles(files: File[]): Promise<void> {
    if (!this.sendChannel || this.sendChannel.readyState !== "open") {
      throw new Error("DataChannel not ready");
    }

    if (!this.isEncryptionReady) {
      throw new Error("Encryption not initialized");
    }

    // Create queue with unique IDs
    const queuedFiles: QueuedFile[] = files.map((file) => ({
      file,
      info: {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        path: (file as any).webkitRelativePath || file.name,
      },
    }));

    this.sendQueue.push(...queuedFiles);

    console.log(
      `[FileTransfer] Queued ${files.length} files for encrypted transfer`
    );

    // Send queue info first
    const queueInfo: QueueInfo = {
      totalFiles: this.sendQueue.length,
      currentIndex: 0,
    };
    this.sendMessage(MessageType.QUEUE_INFO, this.encodeQueueInfo(queueInfo));

    // Start sending if not already
    if (!this.currentSendFile) {
      this.processNextFile();
    }
  }

  private processNextFile(): void {
    if (this.sendQueue.length === 0) {
      console.log("[FileTransfer] All files in queue sent");
      this.callbacks.onTransferComplete?.();
      return;
    }

    const queued = this.sendQueue.shift()!;
    this.currentSendFile = queued;
    this.currentChunkIndex = 0;
    this.totalChunks = queued.info.totalChunks;
    this.isPaused = false;
    this.lastProgressTime = Date.now();
    this.lastTransferredBytes = 0;

    console.log(
      `[FileTransfer] Sending: ${queued.info.name} (${queued.info.totalChunks} chunks)`
    );

    this.sendMessage(MessageType.FILE_INFO, this.encodeFileInfo(queued.info));
  }

  private async sendNextChunk(): Promise<void> {
    if (!this.currentSendFile || !this.sendChannel || this.isPaused) return;

    if (this.currentChunkIndex >= this.totalChunks) {
      console.log(
        `[FileTransfer] File complete: ${this.currentSendFile.info.name}`
      );
      this.sendMessage(MessageType.FILE_COMPLETE, new Uint8Array(0));

      const totalBytes = this.currentSendFile.file.size;
      this.notifyProgress(
        totalBytes,
        totalBytes,
        true,
        this.currentSendFile.info
      );

      this.currentSendFile = null;

      // Process next file in queue
      setTimeout(() => this.processNextFile(), 100);
      return;
    }

    if (this.sendChannel.bufferedAmount > BUFFER_FULL_THRESHOLD) {
      console.log("[FileTransfer] Buffer full, pausing");
      this.isPaused = true;
      return;
    }

    const start = this.currentChunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, this.currentSendFile.file.size);
    const chunk = this.currentSendFile.file.slice(start, end);

    try {
      const arrayBuffer = await chunk.arrayBuffer();
      const plainChunk = new Uint8Array(arrayBuffer);

      const { encrypted, iv } = await this.encryption.encryptChunk(plainChunk);

      const data = this.encodeEncryptedChunk(
        this.currentChunkIndex,
        encrypted,
        iv,
        this.currentSendFile.info.id
      );
      this.sendMessage(MessageType.FILE_CHUNK, data);

      this.currentChunkIndex++;
      this.notifyProgress(
        end,
        this.currentSendFile.file.size,
        true,
        this.currentSendFile.info
      );

      setTimeout(() => this.sendNextChunk(), 0);
    } catch (err) {
      console.error("[FileTransfer] Failed to encrypt/send chunk:", err);
      this.callbacks.onError?.("Failed to process file chunk");
      this.currentSendFile = null;
    }
  }

  private handleMessage(data: ArrayBuffer): void {
    const view = new DataView(data);
    const type = view.getUint8(0) as MessageType;
    const payload = new Uint8Array(data, 1);

    switch (type) {
      case MessageType.ENCRYPTION_KEY:
        this.handleEncryptionKey(payload);
        break;
      case MessageType.QUEUE_INFO:
        this.handleQueueInfo(payload);
        break;
      case MessageType.FILE_INFO:
        this.handleFileInfo(payload);
        break;
      case MessageType.FILE_CHUNK:
        this.handleFileChunk(payload);
        break;
      case MessageType.FILE_COMPLETE:
        this.handleFileComplete();
        break;
      case MessageType.FILE_ACCEPT:
        this.handleFileAccept();
        break;
      case MessageType.FILE_REJECT:
        this.handleFileReject();
        break;
    }
  }

  private async handleEncryptionKey(keyData: Uint8Array): Promise<void> {
    if (this.isEncryptionReady) {
      return;
    }

    try {
      await this.encryption.importKey(keyData);
      this.isEncryptionReady = true;
      console.log("[Encryption] Key imported successfully");
    } catch (err) {
      console.error("[Encryption] Failed to import key:", err);
      this.callbacks.onError?.("Failed to initialize encryption");
    }
  }

  private handleQueueInfo(payload: Uint8Array): void {
    const queueInfo = this.decodeQueueInfo(payload);
    console.log(
      `[FileTransfer] Receiving queue: ${queueInfo.totalFiles} files`
    );
  }

  private async handleFileInfo(payload: Uint8Array): Promise<void> {
    const fileInfo = this.decodeFileInfo(payload);
    console.log("[FileTransfer] Received file offer:", fileInfo.name);

    const queueInfo: QueueInfo = {
      totalFiles: 1,
      currentIndex: 0,
    };

    const accept = await this.callbacks.onFileOffer?.(fileInfo, queueInfo);

    if (accept) {
      const metadata: FileMetadata = {
        ...fileInfo,
        receivedChunks: new Array(fileInfo.totalChunks),
        bytesReceived: 0,
        startTime: Date.now(),
      };

      this.receivingFiles.set(fileInfo.id, metadata);
      this.currentReceiveFileId = fileInfo.id;
      this.lastProgressTime = Date.now();
      this.lastTransferredBytes = 0;

      this.sendMessage(MessageType.FILE_ACCEPT, new Uint8Array(0));
    } else {
      this.sendMessage(MessageType.FILE_REJECT, new Uint8Array(0));
    }
  }

  private async handleFileChunk(payload: Uint8Array): Promise<void> {
    const { fileId, chunkIndex, encrypted, iv } =
      this.decodeEncryptedChunk(payload);

    const receivingFile = this.receivingFiles.get(fileId);
    if (!receivingFile) {
      console.warn("[FileTransfer] Received chunk for unknown file");
      return;
    }

    try {
      const decrypted = await this.encryption.decryptChunk(encrypted, iv);

      receivingFile.receivedChunks[chunkIndex] = decrypted;
      receivingFile.bytesReceived += decrypted.byteLength;

      this.notifyProgress(
        receivingFile.bytesReceived,
        receivingFile.size,
        false,
        receivingFile
      );
    } catch (err) {
      console.error("[FileTransfer] Failed to decrypt chunk:", err);
      this.callbacks.onError?.("Failed to decrypt file chunk");
    }
  }

  private handleFileComplete(): void {
    if (!this.currentReceiveFileId) return;

    const receivingFile = this.receivingFiles.get(this.currentReceiveFileId);
    if (!receivingFile) return;

    console.log("[FileTransfer] File complete:", receivingFile.name);

    const allChunks = receivingFile.receivedChunks.filter(
      (c): c is Uint8Array => c !== undefined
    );
    const blob = new Blob(allChunks as BlobPart[], {
      type: receivingFile.type,
    });
    const file = new File([blob], receivingFile.name, {
      type: receivingFile.type,
    });

    this.callbacks.onFileReceived?.(file, receivingFile);
    this.receivingFiles.delete(this.currentReceiveFileId);
    this.currentReceiveFileId = null;
  }

  private handleFileAccept(): void {
    console.log("[FileTransfer] File accepted, starting transfer");
    this.sendNextChunk();
  }

  private handleFileReject(): void {
    console.log("[FileTransfer] File rejected");
    this.callbacks.onError?.("File transfer rejected");
    this.currentSendFile = null;
    this.sendQueue = [];
  }

  private sendMessage(type: MessageType, payload: Uint8Array): void {
    if (!this.sendChannel || this.sendChannel.readyState !== "open") return;

    const message = new Uint8Array(1 + payload.byteLength);
    message[0] = type;
    message.set(payload, 1);

    this.sendChannel.send(message.buffer);
  }

  private encodeQueueInfo(info: QueueInfo): Uint8Array {
    const json = JSON.stringify(info);
    return new TextEncoder().encode(json);
  }

  private decodeQueueInfo(payload: Uint8Array): QueueInfo {
    const json = new TextDecoder().decode(payload);
    return JSON.parse(json);
  }

  private encodeFileInfo(info: FileInfo): Uint8Array {
    const json = JSON.stringify(info);
    return new TextEncoder().encode(json);
  }

  private decodeFileInfo(payload: Uint8Array): FileInfo {
    const json = new TextDecoder().decode(payload);
    return JSON.parse(json);
  }

  private encodeEncryptedChunk(
    index: number,
    encrypted: Uint8Array,
    iv: Uint8Array,
    fileId: string
  ): Uint8Array {
    const fileIdBytes = new TextEncoder().encode(fileId);
    const result = new Uint8Array(
      4 + 1 + fileIdBytes.length + 1 + iv.byteLength + encrypted.byteLength
    );
    const view = new DataView(result.buffer);

    let offset = 0;
    view.setUint32(offset, index, false);
    offset += 4;

    view.setUint8(offset, fileIdBytes.length);
    offset += 1;
    result.set(fileIdBytes, offset);
    offset += fileIdBytes.length;

    view.setUint8(offset, iv.byteLength);
    offset += 1;
    result.set(iv, offset);
    offset += iv.byteLength;

    result.set(encrypted, offset);

    return result;
  }

  private decodeEncryptedChunk(payload: Uint8Array): {
    fileId: string;
    chunkIndex: number;
    encrypted: Uint8Array;
    iv: Uint8Array;
  } {
    const view = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength
    );

    let offset = 0;
    const chunkIndex = view.getUint32(offset, false);
    offset += 4;

    const fileIdLength = view.getUint8(offset);
    offset += 1;
    const fileIdBytes = new Uint8Array(
      payload.buffer,
      payload.byteOffset + offset,
      fileIdLength
    );
    const fileId = new TextDecoder().decode(fileIdBytes);
    offset += fileIdLength;

    const ivLength = view.getUint8(offset);
    offset += 1;
    const iv = new Uint8Array(
      payload.buffer,
      payload.byteOffset + offset,
      ivLength
    );
    offset += ivLength;

    const encrypted = new Uint8Array(
      payload.buffer,
      payload.byteOffset + offset,
      payload.byteLength - offset
    );

    return { fileId, chunkIndex, encrypted, iv };
  }

  private notifyProgress(
    transferred: number,
    total: number,
    isSending: boolean,
    fileInfo?: FileInfo
  ): void {
    const now = Date.now();
    const timeDelta = (now - this.lastProgressTime) / 1000; // seconds
    const bytesDelta = transferred - this.lastTransferredBytes;

    let speed = 0;
    let timeRemaining = 0;

    if (timeDelta > 0.1) {
      // Update every 100ms
      speed = bytesDelta / timeDelta;
      const bytesRemaining = total - transferred;
      timeRemaining = speed > 0 ? bytesRemaining / speed : 0;

      this.lastProgressTime = now;
      this.lastTransferredBytes = transferred;
    }

    const percentage = (transferred / total) * 100;

    this.callbacks.onProgress?.(
      {
        transferred,
        total,
        percentage,
        speed,
        timeRemaining,
      },
      isSending,
      fileInfo
    );
  }

  reset(): void {
    this.currentSendFile = null;
    this.sendQueue = [];
    this.currentChunkIndex = 0;
    this.totalChunks = 0;
    this.isPaused = false;
    this.receivingFiles.clear();
    this.currentReceiveFileId = null;
    this.isEncryptionReady = false;
    this.encryption.reset();
  }
}
