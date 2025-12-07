// Signaling message types - used by both client and server

export interface CreateRoomMessage {
  type: "create-room";
}

export interface JoinRoomMessage {
  type: "join-room";
  roomId: string;
}

export interface LeaveRoomMessage {
  type: "leave-room";
}

export interface OfferMessage {
  type: "offer";
  sdp: string;
}

export interface AnswerMessage {
  type: "answer";
  sdp: string;
}

export interface IceCandidateMessage {
  type: "ice-candidate";
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

// Messages FROM client TO server
export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage;

// Messages FROM server TO client
export interface ConnectedMessage {
  type: "connected";
  clientId: string;
}

export interface RoomCreatedMessage {
  type: "room-created";
  roomId: string;
}

export interface RoomJoinedMessage {
  type: "room-joined";
  roomId: string;
  isInitiator: boolean;
}

export interface PeerJoinedMessage {
  type: "peer-joined";
}

export interface PeerLeftMessage {
  type: "peer-left";
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
}

export interface RelayedOfferMessage {
  type: "offer";
  sdp: string;
}

export interface RelayedAnswerMessage {
  type: "answer";
  sdp: string;
}

export interface RelayedIceCandidateMessage {
  type: "ice-candidate";
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type ServerMessage =
  | ConnectedMessage
  | RoomCreatedMessage
  | RoomJoinedMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | ErrorMessage
  | RelayedOfferMessage
  | RelayedAnswerMessage
  | RelayedIceCandidateMessage;
