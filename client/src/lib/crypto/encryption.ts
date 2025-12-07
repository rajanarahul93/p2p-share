const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const SESSION_ID_LENGTH = 4;

export class EncryptionManager {
  private key: CryptoKey | null = null;
  private sessionId: Uint8Array;
  private counter = 0n;

  constructor() {
    this.sessionId = new Uint8Array(SESSION_ID_LENGTH);
    crypto.getRandomValues(this.sessionId);
  }

  async generateKey(): Promise<Uint8Array> {
    this.key = await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: AES_KEY_LENGTH,
      },
      true,
      ["encrypt", "decrypt"]
    );

    const exportedKey = await crypto.subtle.exportKey("raw", this.key);
    return new Uint8Array(exportedKey);
  }

  async importKey(keyData: Uint8Array): Promise<void> {
    const buffer = keyData.buffer.slice(
      keyData.byteOffset,
      keyData.byteOffset + keyData.byteLength
    ) as ArrayBuffer;

    this.key = await crypto.subtle.importKey(
      "raw",
      buffer,
      {
        name: "AES-GCM",
        length: AES_KEY_LENGTH,
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  private generateIV(): Uint8Array {
    const iv = new Uint8Array(IV_LENGTH);

    // First 4 bytes: session ID (prevents IV collision across sessions)
    iv.set(this.sessionId, 0);

    // Last 8 bytes: counter (big-endian)
    const counterView = new DataView(iv.buffer, SESSION_ID_LENGTH, 8);
    counterView.setBigUint64(0, this.counter, false);

    this.counter++;

    return iv;
  }

  async encryptChunk(
    data: Uint8Array
  ): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
    if (!this.key) {
      throw new Error("Encryption key not initialized");
    }

    const iv = this.generateIV();

    const dataBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    ) as ArrayBuffer;

    const ivBuffer = iv.buffer.slice(
      iv.byteOffset,
      iv.byteOffset + iv.byteLength
    ) as ArrayBuffer;

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      this.key,
      dataBuffer
    );

    return {
      encrypted: new Uint8Array(encryptedBuffer),
      iv,
    };
  }

  async decryptChunk(
    encrypted: Uint8Array,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    if (!this.key) {
      throw new Error("Encryption key not initialized");
    }

    const encryptedBuffer = encrypted.buffer.slice(
      encrypted.byteOffset,
      encrypted.byteOffset + encrypted.byteLength
    ) as ArrayBuffer;

    const ivBuffer = iv.buffer.slice(
      iv.byteOffset,
      iv.byteOffset + iv.byteLength
    ) as ArrayBuffer;

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      this.key,
      encryptedBuffer
    );

    return new Uint8Array(decryptedBuffer);
  }

  reset(): void {
    this.key = null;
    this.counter = 0n;
    crypto.getRandomValues(this.sessionId);
  }
}
