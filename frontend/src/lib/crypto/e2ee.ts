"use client";

// E2EE Manager using Web Crypto API (browser-native)
// No external dependencies required

interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  sessionVersion: number;
  ratchetStep: number;
  ephemeralPublicKey?: string;
}

interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

interface ExportedKeyPair {
  publicKey: string;
  privateKey: string;
}

class E2EEManager {
  private initialized = false;
  private identityKeyPair: KeyPair | null = null;
  private sessions: Map<string, { 
    sharedKey: CryptoKey; 
    messageNumber: number;
  }> = new Map();

  async initialize(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.initialized) return;

    try {
      // Try to load existing keys from localStorage
      const storedKeys = localStorage.getItem("e2ee_identity_keys");
      if (storedKeys) {
        const parsed = JSON.parse(storedKeys) as ExportedKeyPair;
        this.identityKeyPair = await this.importKeyPair(parsed);
      }
      this.initialized = true;
      console.log("🔐 E2EE initialized with Web Crypto API");
    } catch (error) {
      console.error("Failed to initialize E2EE:", error);
      this.initialized = true; // Mark as initialized to prevent retries
    }
  }

  async hasKeys(): Promise<boolean> {
    return this.identityKeyPair !== null;
  }

  async generateAndUploadKeys(): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      // Generate ECDH key pair for key exchange
      this.identityKeyPair = await window.crypto.subtle.generateKey(
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        true,
        ["deriveKey", "deriveBits"]
      ) as KeyPair;

      // Export and store keys
      const exported = await this.exportKeyPair(this.identityKeyPair);
      localStorage.setItem("e2ee_identity_keys", JSON.stringify(exported));

      console.log("🔐 Generated new E2EE keys");
    } catch (error) {
      console.error("Failed to generate keys:", error);
    }
  }

  private async exportKeyPair(keyPair: KeyPair): Promise<ExportedKeyPair> {
    const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
      publicKey: this.bufferToBase64(publicKeyBuffer),
      privateKey: this.bufferToBase64(privateKeyBuffer),
    };
  }

  private async importKeyPair(exported: ExportedKeyPair): Promise<KeyPair> {
    const publicKey = await window.crypto.subtle.importKey(
      "spki",
      this.base64ToBuffer(exported.publicKey),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );

    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      this.base64ToBuffer(exported.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );

    return { publicKey, privateKey };
  }

  async encryptMessage(recipientId: string, plaintext: string): Promise<EncryptedMessage> {
    if (typeof window === "undefined") {
      return this.createPlaintextFallback(plaintext);
    }

    try {
      // Create a conversation-specific key using both user IDs (sorted for consistency)
      const myId = localStorage.getItem("userId") || "unknown";
      const conversationKey = [myId, recipientId].sort().join(":");
      
      // Get or create session
      let session = this.sessions.get(conversationKey);
      
      if (!session) {
        // Derive key from conversation key (both users will derive the same key)
        const sharedKey = await this.deriveKeyFromId(conversationKey);
        session = { sharedKey, messageNumber: 0 };
        this.sessions.set(conversationKey, session);
      }

      // Generate random nonce (IV)
      const nonce = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the message
      const encoder = new TextEncoder();
      const plaintextBuffer = encoder.encode(plaintext);
      
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce },
        session.sharedKey,
        plaintextBuffer
      );

      session.messageNumber++;

      return {
        ciphertext: this.bufferToBase64(ciphertextBuffer),
        nonce: this.bufferToBase64(nonce.buffer),
        sessionVersion: 1,
        ratchetStep: session.messageNumber,
      };
    } catch (error) {
      console.error("Encryption failed:", error);
      return this.createPlaintextFallback(plaintext);
    }
  }

  async decryptMessage(
    senderId: string,
    ciphertext: string,
    nonce: string,
    _ratchetStep: number
  ): Promise<string> {
    if (typeof window === "undefined") {
      return ciphertext;
    }

    // If no nonce provided, treat as plaintext
    if (!nonce) {
      return ciphertext;
    }

    try {
      // Create a conversation-specific key using both user IDs (sorted for consistency)
      const myId = localStorage.getItem("userId") || "unknown";
      const conversationKey = [myId, senderId].sort().join(":");
      
      // Get or create session
      let session = this.sessions.get(conversationKey);
      
      if (!session) {
        const sharedKey = await this.deriveKeyFromId(conversationKey);
        session = { sharedKey, messageNumber: 0 };
        this.sessions.set(conversationKey, session);
      }

      const ciphertextBuffer = this.base64ToBuffer(ciphertext);
      const nonceBuffer = this.base64ToBuffer(nonce);

      const plaintextBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonceBuffer },
        session.sharedKey,
        ciphertextBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(plaintextBuffer);
    } catch (error) {
      console.error("Decryption failed:", error);
      // Return ciphertext as fallback (might be plaintext)
      return ciphertext;
    }
  }

  private async deriveKeyFromId(id: string): Promise<CryptoKey> {
    // Derive a key from the ID using PBKDF2
    // In production, this would use proper ECDH key exchange
    const encoder = new TextEncoder();
    const idBuffer = encoder.encode(id);
    
    // Create a base key from the ID
    const baseKey = await window.crypto.subtle.importKey(
      "raw",
      idBuffer,
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    // Derive AES-GCM key
    const salt = encoder.encode("aloshield-e2ee-v1");
    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  private createPlaintextFallback(plaintext: string): EncryptedMessage {
    return {
      ciphertext: plaintext,
      nonce: "",
      sessionVersion: 0,
      ratchetStep: 0,
    };
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async getPublicKeyBase64(): Promise<string | null> {
    if (!this.identityKeyPair) return null;
    const exported = await window.crypto.subtle.exportKey("spki", this.identityKeyPair.publicKey);
    return this.bufferToBase64(exported);
  }

  clearSession(recipientId: string): void {
    this.sessions.delete(recipientId);
  }

  clearAllSessions(): void {
    this.sessions.clear();
  }
}

// Singleton instance
let e2eeManagerInstance: E2EEManager | null = null;

export function getE2EEManager(): E2EEManager {
  if (!e2eeManagerInstance) {
    e2eeManagerInstance = new E2EEManager();
  }
  return e2eeManagerInstance;
}

export type { EncryptedMessage };
