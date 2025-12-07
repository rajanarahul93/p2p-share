import { useCallback, useEffect, useRef, useState } from "react";
import { FileTransferManager } from "./FileTransferManager";
import type {
  FileInfo,
  TransferProgress,
  FileTransferCallbacks,
  QueueInfo,
} from "./types";

interface UseFileTransferOptions {
  dataChannel: RTCDataChannel | null;
  isInitiator: boolean;
  onFileReceived?: (file: File, fileInfo: FileInfo) => void;
  onError?: (error: string) => void;
}

export function useFileTransfer({
  dataChannel,
  isInitiator,
  onFileReceived,
  onError,
}: UseFileTransferOptions) {
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [sendProgress, setSendProgress] = useState<TransferProgress | null>(
    null
  );
  const [receiveProgress, setReceiveProgress] =
    useState<TransferProgress | null>(null);
  const [pendingOffer, setPendingOffer] = useState<{
    fileInfo: FileInfo;
    queueInfo: QueueInfo;
  } | null>(null);
  const [currentSendFile, setCurrentSendFile] = useState<FileInfo | null>(null);
  const [currentReceiveFile, setCurrentReceiveFile] = useState<FileInfo | null>(
    null
  );

  const managerRef = useRef<FileTransferManager | null>(null);
  const resolveOfferRef = useRef<((accept: boolean) => void) | null>(null);
  const isProcessingOfferRef = useRef(false);

  const onFileReceivedRef = useRef(onFileReceived);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onFileReceivedRef.current = onFileReceived;
  }, [onFileReceived]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const callbacks: FileTransferCallbacks = {
      onFileOffer: async (fileInfo, queueInfo) => {
        if (isProcessingOfferRef.current) {
          return false;
        }

        isProcessingOfferRef.current = true;
        setPendingOffer({ fileInfo, queueInfo });

        const result = await new Promise<boolean>((resolve) => {
          resolveOfferRef.current = resolve;
        });

        return result;
      },

      onProgress: (progress, sending, fileInfo) => {
        if (sending) {
          setSendProgress(progress);
          if (fileInfo) setCurrentSendFile(fileInfo);
        } else {
          setReceiveProgress(progress);
          if (fileInfo) setCurrentReceiveFile(fileInfo);
        }
      },

      onFileReceived: (file, fileInfo) => {
        setIsReceiving(false);
        setReceiveProgress(null);
        setCurrentReceiveFile(null);
        onFileReceivedRef.current?.(file, fileInfo);
      },

      onTransferComplete: () => {
        setIsSending(false);
        setSendProgress(null);
        setCurrentSendFile(null);
      },

      onError: (err) => {
        setIsSending(false);
        setIsReceiving(false);
        setSendProgress(null);
        setReceiveProgress(null);
        setCurrentSendFile(null);
        setCurrentReceiveFile(null);
        onErrorRef.current?.(err);
      },
    };

    const manager = new FileTransferManager(callbacks);
    managerRef.current = manager;

    return () => {
      manager.reset();
      resolveOfferRef.current = null;
      isProcessingOfferRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (dataChannel && managerRef.current) {
      managerRef.current.setDataChannel(dataChannel, isInitiator);
    }
  }, [dataChannel, isInitiator]);

  const sendFiles = useCallback(async (files: File[]) => {
    if (!managerRef.current) return;

    setIsSending(true);
    setSendProgress({
      transferred: 0,
      total: files.reduce((sum, f) => sum + f.size, 0),
      percentage: 0,
    });

    try {
      await managerRef.current.sendFiles(files);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send files";
      onErrorRef.current?.(message);
      setIsSending(false);
      setSendProgress(null);
    }
  }, []);

  const acceptFile = useCallback(() => {
    if (resolveOfferRef.current) {
      resolveOfferRef.current(true);
      resolveOfferRef.current = null;
      isProcessingOfferRef.current = false;
      setPendingOffer(null);
      setIsReceiving(true);
      setReceiveProgress({ transferred: 0, total: 0, percentage: 0 });
    }
  }, []);

  const rejectFile = useCallback(() => {
    if (resolveOfferRef.current) {
      resolveOfferRef.current(false);
      resolveOfferRef.current = null;
      isProcessingOfferRef.current = false;
      setPendingOffer(null);
    }
  }, []);

  return {
    sendFiles,
    acceptFile,
    rejectFile,
    isSending,
    isReceiving,
    sendProgress,
    receiveProgress,
    pendingOffer: pendingOffer?.fileInfo || null,
    currentSendFile,
    currentReceiveFile,
  };
}