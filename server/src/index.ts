import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import type { ClientMessage, ServerMessage } from "./types.js";

const PORT = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port: PORT });

interface Client {
  socket: WebSocket;
  roomId: string | null;
}

interface Room {
  id: string;
  clients: Set<string>;
  creatorId: string;
}

const clients = new Map<string, Client>();
const rooms = new Map<string, Room>();

function send(clientId: string, message: ServerMessage): void {
  const client = clients.get(clientId);
  if (client?.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(message));
  }
}

function sendError(clientId: string, code: string, message: string): void {
  send(clientId, { type: "error", code, message });
}

function generateRoomId(): string {
  // 6-character alphanumeric, easy to type on mobile
  return randomUUID().substring(0, 6).toUpperCase();
}

function getPeerInRoom(roomId: string, excludeClientId: string): string | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  for (const id of room.clients) {
    if (id !== excludeClientId) return id;
  }
  return null;
}

function handleCreateRoom(clientId: string): void {
  const client = clients.get(clientId);
  if (!client) return;

  if (client.roomId) {
    sendError(
      clientId,
      "ALREADY_IN_ROOM",
      "Leave current room before creating a new one"
    );
    return;
  }

  const roomId = generateRoomId();
  const room: Room = {
    id: roomId,
    clients: new Set([clientId]),
    creatorId: clientId,
  };

  rooms.set(roomId, room);
  client.roomId = roomId;

  send(clientId, { type: "room-created", roomId });
  console.log(`Room ${roomId} created by ${clientId.substring(0, 8)}`);
}

function handleJoinRoom(clientId: string, roomId: string): void {
  const client = clients.get(clientId);
  if (!client) return;

  if (client.roomId) {
    sendError(
      clientId,
      "ALREADY_IN_ROOM",
      "Leave current room before joining another"
    );
    return;
  }

  const room = rooms.get(roomId.toUpperCase());
  if (!room) {
    sendError(clientId, "ROOM_NOT_FOUND", "Room does not exist or has expired");
    return;
  }

  if (room.clients.size >= 2) {
    sendError(clientId, "ROOM_FULL", "Room already has two participants");
    return;
  }

  room.clients.add(clientId);
  client.roomId = room.id;

  // Notify the joiner
  send(clientId, { type: "room-joined", roomId: room.id, isInitiator: false });

  // Notify the creator that peer joined
  const peerId = getPeerInRoom(room.id, clientId);
  if (peerId) {
    send(peerId, { type: "peer-joined" });
  }

  console.log(`Client ${clientId.substring(0, 8)} joined room ${room.id}`);
}

function handleLeaveRoom(clientId: string): void {
  const client = clients.get(clientId);
  if (!client?.roomId) return;

  const room = rooms.get(client.roomId);
  if (room) {
    room.clients.delete(clientId);

    // Notify remaining peer
    const peerId = getPeerInRoom(room.id, clientId);
    if (peerId) {
      send(peerId, { type: "peer-left" });
    }

    // Clean up empty rooms
    if (room.clients.size === 0) {
      rooms.delete(room.id);
      console.log(`Room ${room.id} deleted (empty)`);
    }
  }

  client.roomId = null;
}

function relayToPeer(clientId: string, message: ServerMessage): void {
  const client = clients.get(clientId);
  if (!client?.roomId) {
    sendError(
      clientId,
      "NOT_IN_ROOM",
      "Join a room before sending WebRTC messages"
    );
    return;
  }

  const peerId = getPeerInRoom(client.roomId, clientId);
  if (!peerId) {
    sendError(clientId, "NO_PEER", "No peer connected to relay message to");
    return;
  }

  send(peerId, message);
}

function handleMessage(clientId: string, raw: string): void {
  let message: ClientMessage;

  try {
    message = JSON.parse(raw) as ClientMessage;
  } catch {
    sendError(clientId, "INVALID_JSON", "Message must be valid JSON");
    return;
  }

  switch (message.type) {
    case "create-room":
      handleCreateRoom(clientId);
      break;

    case "join-room":
      handleJoinRoom(clientId, message.roomId);
      break;

    case "leave-room":
      handleLeaveRoom(clientId);
      break;

    case "offer":
      relayToPeer(clientId, { type: "offer", sdp: message.sdp });
      break;

    case "answer":
      relayToPeer(clientId, { type: "answer", sdp: message.sdp });
      break;

    case "ice-candidate":
      relayToPeer(clientId, {
        type: "ice-candidate",
        candidate: message.candidate,
        sdpMid: message.sdpMid,
        sdpMLineIndex: message.sdpMLineIndex,
      });
      break;

    default:
      sendError(clientId, "UNKNOWN_MESSAGE", "Unknown message type");
  }
}

wss.on("connection", (socket) => {
  const clientId = randomUUID();
  clients.set(clientId, { socket, roomId: null });

  console.log(`Client connected: ${clientId.substring(0, 8)}`);

  socket.on("message", (data) => {
    handleMessage(clientId, data.toString());
  });

  socket.on("close", () => {
    handleLeaveRoom(clientId);
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId.substring(0, 8)}`);
  });

  socket.on("error", (err) => {
    console.error(`Socket error for ${clientId.substring(0, 8)}:`, err.message);
  });

  send(clientId, { type: "connected", clientId });
});

console.log(`Signaling server running on ws://localhost:${PORT}`);
console.log(`Rooms will use 6-character codes for QR pairing`);
