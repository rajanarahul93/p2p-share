# P2P Share

P2P Share is a browser-based, end‑to‑end encrypted file sharing app built on WebRTC. It lets two devices connect directly using a short room code or QR code and transfer large files and folders without uploading them to any server.

https://p2p-share-eta.vercel.app/

---

## Why P2P Share?

Traditional sharing tools (email, chat apps, cloud drives) are optimized for convenience, not for privacy or large, uncompressed files. P2P Share is designed to solve a few concrete problems:

- **No size limits**  
  Files are streamed directly between browsers over WebRTC, so there is no server‑side storage or artificial size cap.

- **No compression or quality loss**  
  Media is sent in its original form (ideal for photos, videos, design assets, and builds).

- **Private by design**  
  Only a lightweight signaling server ever sees metadata; file contents never touch a backend.

- **Fast on local networks**  
  When both devices share a Wi‑Fi/LAN, transfer speed is limited by local network bandwidth, not cloud upload speed.

- **Zero‑friction pairing**  
  Connect devices with a 6‑character code or QR scan, no login or installation required.

---

## Features

- **End‑to‑end encryption**  
  - Per‑session AES‑GCM keys generated in the browser  
  - Keys exchanged over an already‑encrypted WebRTC data channel  
  - Chunk‑level IV management to prevent nonce reuse

- **WebRTC peer‑to‑peer transport**  
  - STUN/TURN configuration for NAT traversal  
  - Direct browser‑to‑browser file streaming  
  - Minimal WebSocket signaling layer

- **Multiple files & folder upload**  
  - Select one or many files  
  - Upload a full folder (preserving relative paths via `webkitdirectory`)  
  - Automatic queueing and per‑file progress tracking

- **Real‑time progress & speed**  
  - Per‑file progress bars with percentage  
  - Live throughput (e.g. `45 MB/s`) and estimated time remaining  
  - Visual states for sending, receiving, queued, completed

- **Bi‑directional transfer**  
  - Once connected, both peers can send and receive  
  - No strict “sender / receiver” roles after pairing

- **QR‑code pairing**  
  - Desktop shows a QR code with the join URL  
  - Mobile users just scan and are taken directly into the room  
  - Optional manual 6‑character room code entry

- **No account, no install**  
  - Pure web app (Vite + React + TypeScript)  
  - Works on modern desktop and mobile browsers

---

## Architecture

### High‑level

| Layer        | Tech                              | Purpose                                |
|-------------|-----------------------------------|----------------------------------------|
| Frontend    | React + Vite + TypeScript         | UI, WebRTC peer connection, crypto     |
| Signaling   | Node.js + Express + `ws`          | Room creation, SDP + ICE exchange      |
| Transport   | WebRTC DataChannel                | Encrypted, low‑latency file streaming  |
| Crypto      | Web Crypto API (AES‑GCM)          | End‑to‑end encryption of file chunks   |
| Hosting     | Vercel (client), Render (server)  | Production deployment                  |

### Signaling flow (simplified)

1. Creator opens “Send Files” → client connects to signaling server and creates a room.
2. Joiner opens “Receive Files” and enters code / scans QR → joins same room.
3. Peers exchange SDP offers/answers and ICE candidates via WebSocket.
4. Once the WebRTC data channel opens, signaling is only used for metadata and heartbeat.

### Encryption model

- A fresh AES‑GCM key is generated per session in the initiating browser.
- The key is exported and sent once over the already DTLS‑encrypted WebRTC data channel.
- Files are split into fixed‑size chunks (64 KB) and encrypted with:
  - 256‑bit AES‑GCM
  - A unique IV per chunk composed of a random session prefix and a monotonic counter
- The receiver decrypts each chunk and reconstructs the blob on the fly.

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 18+ (22.x in production)
- npm or pnpm

### Clone & install

```
git clone https://github.com/rajanarahul93/p2p-share.git
cd p2p-share
```

Install server and client dependencies:

```
cd server
npm install

cd ../client
npm install
```

### Environment variables

Create `client/.env`:

```
VITE_SIGNALING_URL=ws://localhost:8080
```

Create `client/.env.production` for production (used by Vercel):

```
VITE_SIGNALING_URL=wss://p2p-share-signaling.onrender.com
```

### Run signaling server

```
cd server
npm run dev
# Signaling server runs on ws://localhost:8080
```

### Run client (Vite dev server)

```
cd client
npm run dev
# Open http://localhost:5173
```

---

## Usage

1. Open the app in a desktop browser.
2. Click **Send Files**.
3. Share the displayed QR code or 6‑character room code with the other device.
4. On the other device, open the URL, choose **Receive Files**, and join using code / QR.
5. Once connected:
   - Either side can click **Select Files** or **Select Folder** to send.
   - The receiver gets an **Incoming File** dialog with accept / decline.
   - Progress, speed, and ETA are shown for each active transfer.
6. Download completed files directly in the receiving browser.

---

## Tech Stack

- **Frontend**
  - React 18 + TypeScript
  - Vite
  - Tailwind CSS
  - WebRTC (RTCPeerConnection, RTCDataChannel)
  - Web Crypto API (AES‑GCM)
  - QR code + icon components (`qrcode.react`, `lucide-react`)

- **Backend**
  - Node.js
  - Express
  - `ws` (WebSocket server)

---

## Possible Extensions

Ideas for future work:

- Password‑protected sessions and short‑lived room tokens
- Optional TURN server provisioning dashboard
- Transfer history (local only, using IndexedDB)
- “Share text / clipboard” mode for quick notes or OTPs
- Desktop PWA / mobile install prompts
- Rate limiting and abuse protection on the signaling server

---

## Development Notes

- The project uses a layered structure:
  - `client/src/lib/webrtc` – WebRTC connection & signaling hooks
  - `client/src/lib/fileTransfer` – protocol, encryption, chunking
  - `client/src/components` – UI (home, sender, receiver, transfer views)
  - `server/src` – signaling server, room management
- TypeScript is configured in both `client` and `server` with strict options to keep the protocol types consistent.

---