import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { ClientMessage, ServerMessage, ConnectionState } from "./types";

interface SignalingState {
  connectionState: ConnectionState;
  clientId: string | null;
  roomId: string | null;
  isInitiator: boolean;
  error: { code: string; message: string } | null;
}

interface SignalingContextValue extends SignalingState {
  send: (message: ClientMessage) => void;
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  subscribe: (handler: (message: ServerMessage) => void) => () => void;
}

const SignalingContext = createContext<SignalingContextValue | null>(null);

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

interface SignalingProviderProps {
  serverUrl: string;
  children: ReactNode;
}

export function SignalingProvider({
  serverUrl,
  children,
}: SignalingProviderProps) {
  const [state, setState] = useState<SignalingState>({
    connectionState: "disconnected",
    clientId: null,
    roomId: null,
    isInitiator: false,
    error: null,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const subscribersRef = useRef<Set<(message: ServerMessage) => void>>(
    new Set()
  );
  const messageQueueRef = useRef<ClientMessage[]>([]);

  const flushMessageQueue = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      while (messageQueueRef.current.length > 0) {
        const msg = messageQueueRef.current.shift()!;
        socket.send(JSON.stringify(msg));
      }
    }
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      messageQueueRef.current.push(message);
    }
  }, []);

  const createRoom = useCallback(() => {
    send({ type: "create-room" });
  }, [send]);

  const joinRoom = useCallback(
    (roomId: string) => {
      send({ type: "join-room", roomId: roomId.toUpperCase() });
    },
    [send]
  );

  const leaveRoom = useCallback(() => {
    send({ type: "leave-room" });
    setState((prev) => ({ ...prev, roomId: null, isInitiator: false }));
  }, [send]);

  const subscribe = useCallback((handler: (message: ServerMessage) => void) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "connected":
        setState((prev) => ({
          ...prev,
          connectionState: "connected",
          clientId: message.clientId,
          error: null,
        }));
        break;

      case "room-created":
        setState((prev) => ({
          ...prev,
          roomId: message.roomId,
          isInitiator: true,
        }));
        break;

      case "room-joined":
        setState((prev) => ({
          ...prev,
          roomId: message.roomId,
          isInitiator: message.isInitiator,
        }));
        break;

      case "peer-left":
        setState((prev) => ({ ...prev, roomId: null, isInitiator: false }));
        break;

      case "error":
        setState((prev) => ({
          ...prev,
          error: { code: message.code, message: message.message },
        }));
        break;
    }

    // Notify all subscribers
    subscribersRef.current.forEach((handler) => handler(message));
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    setState((prev) => ({ ...prev, connectionState: "connecting" }));

    const socket = new WebSocket(serverUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      flushMessageQueue();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        handleMessage(message);
      } catch (err) {
        console.error("Failed to parse server message:", err);
      }
    };

    socket.onclose = () => {
      setState((prev) => ({
        ...prev,
        connectionState: "disconnected",
        roomId: null,
        isInitiator: false,
      }));

      // Auto-reconnect with exponential backoff
      const attempt = reconnectAttemptRef.current;
      const delay =
        RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];

      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectAttemptRef.current++;
        connect();
      }, delay);
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }, [serverUrl, handleMessage, flushMessageQueue]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  const value: SignalingContextValue = {
    ...state,
    send,
    createRoom,
    joinRoom,
    leaveRoom,
    subscribe,
  };

  return (
    <SignalingContext.Provider value={value}>
      {children}
    </SignalingContext.Provider>
  );
}

export function useSignaling(): SignalingContextValue {
  const context = useContext(SignalingContext);
  if (!context) {
    throw new Error("useSignaling must be used within SignalingProvider");
  }
  return context;
}
