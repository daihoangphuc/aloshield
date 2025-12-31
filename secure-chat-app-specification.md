# ĐẶC TẢ KỸ THUẬT ỨNG DỤNG CHAT & VIDEO CALL AN TOÀN

## 1. TỔNG QUAN DỰ ÁN

### 1.1 Mục tiêu
Xây dựng ứng dụng chat và video call 1-1 với bảo mật cao, tương tự Messenger, hỗ trợ cả web và mobile.

### 1.2 Yêu cầu chính
- ✅ Chat text real-time với mã hóa end-to-end (E2EE)
- ✅ Video call 1-1 peer-to-peer
- ✅ Gửi file, hình ảnh, video an toàn
- ✅ Authentication & Authorization mạnh mẽ
- ✅ Offline message queueing
- ✅ Message delivery status (sent, delivered, seen)
- ✅ Typing indicators
- ✅ User presence (online/offline)
- ✅ Message search & history
- ✅ Bảo mật tối đa - chống MITM, XSS, CSRF, injection attacks

---

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 Tech Stack

#### Backend
- **Framework**: NestJS (TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Real-time**: Socket.io (với encryption layer)
- **Video Call**: WebRTC + TURN/STUN server
- **Caching**: Redis (cho sessions, presence)
- **Message Queue**: BullMQ (cho offline messages)

#### Frontend Web
- **Framework**: Next.js 14+ (App Router)
- **UI**: React + TailwindCSS + Shadcn/ui
- **State Management**: Zustand + React Query
- **Real-time**: Socket.io-client
- **Video**: Simple-peer hoặc PeerJS
- **Crypto**: Web Crypto API + libsodium.js

#### Frontend Mobile
- **Framework**: React Native + Expo
- **UI**: NativeWind (Tailwind for RN)
- **State Management**: Zustand + React Query
- **Real-time**: Socket.io-client
- **Video**: react-native-webrtc
- **Crypto**: react-native-quick-crypto + libsodium

### 2.2 Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENTS                                  │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  Web App     │              │  Mobile App  │            │
│  │  (Next.js)   │              │ (React Native)│           │
│  └──────┬───────┘              └──────┬───────┘            │
│         │                              │                     │
└─────────┼──────────────────────────────┼─────────────────────┘
          │                              │
          └──────────────┬───────────────┘
                         │
          ┌──────────────▼──────────────┐
          │     API Gateway / CDN        │
          │     (Rate Limiting)          │
          └──────────────┬───────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                     │
┌───▼─────┐      ┌──────▼────┐       ┌───────▼──────┐
│ REST API│      │Socket.io  │       │  TURN/STUN   │
│(NestJS) │      │ Server    │       │  Server      │
└───┬─────┘      └─────┬─────┘       └──────────────┘
    │                  │
    └──────┬───────────┘
           │
    ┌──────▼───────┐
    │  Redis Cache │
    │  (Sessions,  │
    │   Presence)  │
    └──────────────┘
           │
    ┌──────▼──────────────────┐
    │    Supabase PostgreSQL  │
    │  (Encrypted messages)   │
    └─────────────────────────┘
           │
    ┌──────▼──────────┐
    │  Cloudflare R2  │
    │ (Encrypted Files)│
    └──────────────────┘
```

---

## 3. BẢO MẬT (SECURITY) - ƯU TIÊN HÀNG ĐẦU

### 3.1 End-to-End Encryption (E2EE)

#### Mã hóa tin nhắn
```typescript
// Protocol: Signal Protocol (X3DH + Double Ratchet)
// Hoặc đơn giản hóa: Curve25519 + ChaCha20-Poly1305

// 1. Key Exchange khi bắt đầu conversation
- Mỗi user có cặp Identity Key (long-term)
- Mỗi user có cặp Signed Pre Key (medium-term) 
- Mỗi user có One-Time Pre Keys (single-use)
- Thực hiện X3DH handshake để tạo shared secret
- Derive message keys từ shared secret

// 2. Message Encryption
- Mỗi tin nhắn được mã hóa với unique key
- Key ratcheting sau mỗi message
- Không thể decrypt messages cũ nếu key hiện tại bị lộ (Forward Secrecy)
- Không thể decrypt messages mới nếu key cũ bị lộ (Backward Secrecy)

// 3. Server vai trò
- Server KHÔNG BAO GIỜ có plaintext messages
- Server chỉ lưu encrypted payloads
- Server không thể đọc nội dung
```

#### Implementation chi tiết
```typescript
// Backend: Lưu trữ public keys
interface UserKeys {
  userId: string;
  identityPublicKey: string;      // Curve25519 public
  signedPreKey: string;             // Signed with identity key
  signedPreKeySignature: string;
  oneTimePreKeys: string[];         // Pool of OTK
  createdAt: Date;
}

// Client: Encryption flow
class E2EEManager {
  // 1. Initialize keys on first launch
  async initializeKeys(): Promise<void> {
    const identityKeyPair = await generateIdentityKeyPair();
    const signedPreKey = await generateSignedPreKey(identityKeyPair.private);
    const oneTimePreKeys = await generateOneTimePreKeys(100);
    
    await uploadKeysToServer({
      identityPublicKey: identityKeyPair.public,
      signedPreKey,
      oneTimePreKeys
    });
    
    await secureStore.save('identityKeyPair', identityKeyPair);
  }
  
  // 2. Start new conversation
  async startConversation(recipientId: string): Promise<SessionState> {
    const recipientKeys = await fetchUserKeys(recipientId);
    const ephemeralKeyPair = await generateEphemeralKeyPair();
    
    // X3DH
    const sharedSecret = await computeX3DH(
      myIdentityKey,
      ephemeralKeyPair,
      recipientKeys.identityPublicKey,
      recipientKeys.signedPreKey,
      recipientKeys.oneTimePreKeys[0] // Use one OTK
    );
    
    const session = await initializeDoubleRatchet(sharedSecret);
    await saveSession(recipientId, session);
    
    return session;
  }
  
  // 3. Encrypt message
  async encryptMessage(recipientId: string, plaintext: string): Promise<EncryptedMessage> {
    const session = await getSession(recipientId);
    const messageKey = await deriveMessageKey(session);
    
    const ciphertext = await chaCha20Poly1305Encrypt(
      plaintext,
      messageKey,
      generateNonce()
    );
    
    await ratchetForward(session); // Update session state
    
    return {
      recipientId,
      ciphertext,
      sessionVersion: session.version,
      ratchetStep: session.currentStep
    };
  }
  
  // 4. Decrypt message
  async decryptMessage(senderId: string, encrypted: EncryptedMessage): Promise<string> {
    const session = await getSession(senderId);
    await syncRatchetState(session, encrypted.ratchetStep);
    
    const messageKey = await deriveMessageKey(session);
    const plaintext = await chaCha20Poly1305Decrypt(
      encrypted.ciphertext,
      messageKey
    );
    
    await ratchetForward(session);
    return plaintext;
  }
}
```

### 3.2 Transport Security

```typescript
// 1. HTTPS Everywhere - TLS 1.3
- Certificate pinning trên mobile
- HSTS headers
- Secure cookies (HttpOnly, Secure, SameSite)

// 2. WebSocket Security
const io = socketIo(server, {
  cors: {
    origin: [process.env.WEB_URL, process.env.MOBILE_URL],
    credentials: true
  },
  transports: ['websocket'], // No long-polling
  perMessageDeflate: false,   // Prevent BREACH attack
});

// Socket authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const verified = await verifyJWT(token);
  
  if (!verified) {
    return next(new Error('Unauthorized'));
  }
  
  socket.userId = verified.userId;
  next();
});

// 3. API Rate Limiting
@UseGuards(ThrottlerGuard)
@Throttle(10, 60) // 10 requests per 60 seconds
async sendMessage() { }
```

### 3.3 Authentication & Authorization

```typescript
// JWT với refresh token rotation
interface TokenPair {
  accessToken: string;  // Short-lived: 15 minutes
  refreshToken: string; // Long-lived: 7 days, stored in httpOnly cookie
}

// Multi-factor Authentication (Optional but recommended)
interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[]; // 10 single-use backup codes
}

// Device fingerprinting
interface DeviceInfo {
  userId: string;
  deviceId: string;        // Unique device identifier
  deviceName: string;
  platform: 'web' | 'ios' | 'android';
  lastIpAddress: string;
  lastUserAgent: string;
  isActive: boolean;
  createdAt: Date;
}

// Authorization: Verify both users in conversation
@UseGuards(JwtAuthGuard)
async sendMessage(
  @CurrentUser() user: User,
  @Body() dto: SendMessageDto
) {
  // Check if user is participant of conversation
  const canSend = await this.conversationService.isParticipant(
    dto.conversationId,
    user.id
  );
  
  if (!canSend) {
    throw new ForbiddenException();
  }
  
  // Proceed...
}
```

### 3.4 Input Validation & Sanitization

```typescript
// 1. DTO Validation với class-validator
class SendMessageDto {
  @IsUUID()
  conversationId: string;
  
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  @Transform(({ value }) => sanitizeHtml(value, {
    allowedTags: [], // No HTML tags in messages
    allowedAttributes: {}
  }))
  encryptedContent: string; // Even encrypted, validate format
  
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

// 2. SQL Injection Prevention
// Supabase/PostgreSQL: Always use parameterized queries
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId) // Safe
  .eq('user_id', userId);

// TypeORM: Always use query builder or find options
const messages = await this.messageRepo.find({
  where: {
    conversationId,
    userId
  }
});

// 3. XSS Prevention
// Frontend: React automatically escapes by default
// But for rich content, use DOMPurify
import DOMPurify from 'isomorphic-dompurify';

const SafeMessage = ({ content }: { content: string }) => {
  const clean = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  });
  
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
};
```

### 3.5 File Upload Security

```typescript
// 1. File validation
class FileUploadGuard implements CanActivate {
  private readonly allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const file = request.file;
    
    if (!file) return false;
    
    // Check MIME type
    if (!this.allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
    
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File too large');
    }
    
    // Check magic bytes (prevent MIME type spoofing)
    const actualType = this.detectFileType(file.buffer);
    if (actualType !== file.mimetype) {
      throw new BadRequestException('File type mismatch');
    }
    
    return true;
  }
  
  private detectFileType(buffer: Buffer): string {
    // Check magic bytes
    const magicNumbers = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'application/pdf': [0x25, 0x50, 0x44, 0x46]
      // Add more...
    };
    
    for (const [mime, bytes] of Object.entries(magicNumbers)) {
      if (this.matchBytes(buffer, bytes)) {
        return mime;
      }
    }
    
    return 'unknown';
  }
}

// 2. Encrypt files before upload
class FileEncryptionService {
  async encryptAndUpload(
    file: Express.Multer.File,
    conversationId: string
  ): Promise<EncryptedFileMetadata> {
    // Generate random key for this file
    const fileKey = await generateRandomKey();
    
    // Encrypt file
    const encryptedBuffer = await chaCha20Poly1305EncryptFile(
      file.buffer,
      fileKey
    );
    
    // Upload to R2
    const fileId = uuid();
    const key = `conversations/${conversationId}/${fileId}`;
    
    await this.r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: encryptedBuffer,
        ContentType: 'application/octet-stream', // Always binary
        ServerSideEncryption: 'AES256', // R2 server-side encryption
        Metadata: {
          'original-name': this.sanitizeFilename(file.originalname),
          'encrypted': 'true'
        }
      })
    );
    
    // Return metadata (file key should be sent encrypted in message)
    return {
      fileId,
      r2Key: key,
      encryptionKey: fileKey, // This will be encrypted with message encryption
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname
    };
  }
  
  async decryptAndDownload(
    fileId: string,
    fileKey: string
  ): Promise<Buffer> {
    // Download from R2
    const response = await this.r2Client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: fileId
      })
    );
    
    const encryptedBuffer = await streamToBuffer(response.Body);
    
    // Decrypt
    const decryptedBuffer = await chaCha20Poly1305DecryptFile(
      encryptedBuffer,
      fileKey
    );
    
    return decryptedBuffer;
  }
}

// 3. Virus scanning (Optional but recommended for production)
class VirusScanService {
  async scanFile(buffer: Buffer): Promise<boolean> {
    // Integrate with ClamAV or VirusTotal API
    const result = await clamav.scanBuffer(buffer);
    return result.isClean;
  }
}
```

### 3.6 Video Call Security

```typescript
// 1. TURN server authentication
interface TurnCredentials {
  urls: string[];
  username: string;      // Time-limited username
  credential: string;    // HMAC-based credential
  validUntil: number;
}

// Generate time-limited TURN credentials
class TurnService {
  async getCredentials(userId: string): Promise<TurnCredentials> {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`;
    const credential = this.generateHMAC(username, process.env.TURN_SECRET);
    
    return {
      urls: [
        'turn:turn.yourdomain.com:3478?transport=udp',
        'turn:turn.yourdomain.com:3478?transport=tcp',
        'turns:turn.yourdomain.com:5349?transport=tcp'
      ],
      username,
      credential,
      validUntil: Date.now() + 3600000 // 1 hour
    };
  }
  
  private generateHMAC(username: string, secret: string): string {
    return crypto
      .createHmac('sha1', secret)
      .update(username)
      .digest('base64');
  }
}

// 2. WebRTC security
const peerConnection = new RTCPeerConnection({
  iceServers: turnCredentials,
  iceCandidatePoolSize: 10,
  
  // Security configuration
  iceTransportPolicy: 'relay', // Force TURN relay (no direct P2P)
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  
  // Encryption
  sdpSemantics: 'unified-plan',
  // DTLS-SRTP is mandatory in WebRTC
});

// 3. Signaling security
// All signaling through encrypted WebSocket
socket.on('call:offer', async (data) => {
  // Verify caller is in conversation with recipient
  const authorized = await verifyCallAuthorization(
    data.callerId,
    data.recipientId
  );
  
  if (!authorized) {
    socket.emit('call:error', { message: 'Unauthorized' });
    return;
  }
  
  // Verify SDP is valid
  if (!isValidSDP(data.offer)) {
    socket.emit('call:error', { message: 'Invalid offer' });
    return;
  }
  
  // Forward to recipient
  io.to(data.recipientId).emit('call:offer', {
    callerId: data.callerId,
    offer: data.offer
  });
});
```

### 3.7 Additional Security Measures

```typescript
// 1. CSRF Protection
// NestJS: Use csurf middleware (for web)
app.use(csurf({ 
  cookie: { 
    httpOnly: true, 
    secure: true,
    sameSite: 'strict'
  } 
}));

// 2. Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 3. Audit Logging
interface AuditLog {
  userId: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  metadata?: Record<string, any>;
  timestamp: Date;
}

class AuditService {
  async log(entry: AuditLog): Promise<void> {
    await this.supabase
      .from('audit_logs')
      .insert([entry]);
    
    // Alert on suspicious activity
    if (this.isSuspicious(entry)) {
      await this.alertSecurityTeam(entry);
    }
  }
  
  private isSuspicious(entry: AuditLog): boolean {
    // Multiple failed login attempts
    // Access from unusual location
    // Mass message sending
    // etc.
    return false;
  }
}

// 4. Password Security
class PasswordService {
  async hash(password: string): Promise<string> {
    // Use Argon2id (winner of Password Hashing Competition)
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MB
      timeCost: 3,
      parallelism: 4
    });
  }
  
  async verify(hash: string, password: string): Promise<boolean> {
    return await argon2.verify(hash, password);
  }
}

// 5. Session Management
class SessionService {
  async createSession(userId: string, deviceInfo: DeviceInfo): Promise<string> {
    const sessionId = uuid();
    
    await this.redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify({
        userId,
        deviceId: deviceInfo.deviceId,
        createdAt: new Date(),
        lastActivity: new Date()
      })
    );
    
    return sessionId;
  }
  
  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.redis.get(`session:${sessionId}`);
    
    if (!session) return false;
    
    // Update last activity
    await this.redis.expire(`session:${sessionId}`, 7 * 24 * 60 * 60);
    
    return true;
  }
  
  async revokeSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }
  
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.redis.keys(`session:*`);
    
    for (const key of sessions) {
      const session = await this.redis.get(key);
      const data = JSON.parse(session);
      
      if (data.userId === userId) {
        await this.redis.del(key);
      }
    }
  }
}
```

---

## 4. DATABASE SCHEMA (Supabase/PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  
  -- Security
  email_verified BOOLEAN DEFAULT FALSE,
  phone_number VARCHAR(20),
  phone_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  
  -- E2EE Keys (public only)
  identity_public_key TEXT NOT NULL,
  signed_pre_key TEXT NOT NULL,
  signed_pre_key_signature TEXT NOT NULL,
  
  -- Status
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_online ON users(is_online);

-- =====================
-- ONE TIME PRE KEYS
-- =====================
CREATE TABLE one_time_pre_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, key_id)
);

CREATE INDEX idx_otpk_user_unused ON one_time_pre_keys(user_id, used) WHERE used = FALSE;

-- =====================
-- DEVICES
-- =====================
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(100),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  
  -- Push notifications
  push_token TEXT,
  
  -- Security
  last_ip_address INET,
  last_user_agent TEXT,
  
  is_active BOOLEAN DEFAULT TRUE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_devices_user_active ON devices(user_id, is_active);

-- =====================
-- CONVERSATIONS
-- =====================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name VARCHAR(255), -- For group chats
  avatar_url TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================
-- CONVERSATION PARTICIPANTS
-- =====================
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- E2EE Session info
  session_version INTEGER DEFAULT 1,
  last_message_ratchet_step INTEGER DEFAULT 0,
  
  -- Permissions
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  can_send_messages BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conv_participants_conv ON conversation_participants(conversation_id);

-- =====================
-- MESSAGES
-- =====================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Encrypted content
  encrypted_content TEXT NOT NULL, -- Base64 encoded ciphertext
  content_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'video', 'file', 'audio', 'location')),
  
  -- E2EE metadata
  session_version INTEGER NOT NULL,
  ratchet_step INTEGER NOT NULL,
  
  -- Message status
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Message metadata
  reply_to_message_id UUID REFERENCES messages(id),
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_message_id);

-- =====================
-- MESSAGE RECEIPTS
-- =====================
CREATE TABLE message_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_receipts_message ON message_receipts(message_id);
CREATE INDEX idx_receipts_user ON message_receipts(user_id);

-- =====================
-- ATTACHMENTS
-- =====================
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  
  -- R2 storage
  r2_key TEXT NOT NULL, -- Path in R2
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Encryption
  encrypted_file_key TEXT NOT NULL, -- Encrypted with message key
  
  -- Thumbnails (for images/videos)
  thumbnail_r2_key TEXT,
  thumbnail_file_key TEXT,
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- For video/audio
  
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON attachments(message_id);

-- =====================
-- CALLS
-- =====================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  caller_id UUID NOT NULL REFERENCES users(id),
  
  type VARCHAR(20) NOT NULL CHECK (type IN ('audio', 'video')),
  status VARCHAR(20) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'rejected', 'missed', 'ended', 'failed')),
  
  -- Call timing
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- Seconds
  
  -- Participants (for group calls in future)
  participants JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_calls_conversation ON calls(conversation_id, initiated_at DESC);
CREATE INDEX idx_calls_caller ON calls(caller_id);

-- =====================
-- TYPING INDICATORS (Redis preferred, but can use PG)
-- =====================
CREATE TABLE typing_indicators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_typing_conversation ON typing_indicators(conversation_id, expires_at);

-- =====================
-- BLOCKED USERS
-- =====================
CREATE TABLE blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  reason TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX idx_blocked_blocker ON blocked_users(blocker_id);
CREATE INDEX idx_blocked_blocked ON blocked_users(blocked_id);

-- =====================
-- AUDIT LOGS
-- =====================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID,
  
  ip_address INET,
  user_agent TEXT,
  
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  metadata JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource, resource_id);

-- =====================
-- ROW LEVEL SECURITY (RLS)
-- =====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Users can only see conversations they're part of
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
      AND user_id = auth.uid()
    )
  );

-- Users can only see messages in their conversations
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
      AND can_send_messages = TRUE
    )
  );

-- =====================
-- FUNCTIONS
-- =====================

-- Update conversation updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## 5. API SPECIFICATION (NestJS)

### 5.1 Cấu trúc thư mục Backend

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts
│   ├── filters/
│   │   ├── http-exception.filter.ts
│   │   └── ws-exception.filter.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── ws-auth.guard.ts
│   │   └── throttle.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts
│   └── pipes/
│       └── validation.pipe.ts
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── r2.config.ts
│   └── jwt.config.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── refresh-token.strategy.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       ├── login.dto.ts
│   │       └── refresh-token.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   └── dto/
│   │       ├── update-profile.dto.ts
│   │       └── update-keys.dto.ts
│   ├── conversations/
│   │   ├── conversations.module.ts
│   │   ├── conversations.controller.ts
│   │   ├── conversations.service.ts
│   │   ├── entities/
│   │   │   ├── conversation.entity.ts
│   │   │   └── participant.entity.ts
│   │   └── dto/
│   │       ├── create-conversation.dto.ts
│   │       └── add-participant.dto.ts
│   ├── messages/
│   │   ├── messages.module.ts
│   │   ├── messages.controller.ts
│   │   ├── messages.service.ts
│   │   ├── messages.gateway.ts
│   │   ├── entities/
│   │   │   ├── message.entity.ts
│   │   │   └── message-receipt.entity.ts
│   │   └── dto/
│   │       ├── send-message.dto.ts
│   │       └── mark-as-read.dto.ts
│   ├── attachments/
│   │   ├── attachments.module.ts
│   │   ├── attachments.controller.ts
│   │   ├── attachments.service.ts
│   │   └── dto/
│   │       └── upload-attachment.dto.ts
│   ├── calls/
│   │   ├── calls.module.ts
│   │   ├── calls.gateway.ts
│   │   ├── calls.service.ts
│   │   ├── turn.service.ts
│   │   └── dto/
│   │       ├── initiate-call.dto.ts
│   │       ├── call-offer.dto.ts
│   │       └── call-answer.dto.ts
│   ├── keys/
│   │   ├── keys.module.ts
│   │   ├── keys.controller.ts
│   │   ├── keys.service.ts
│   │   └── dto/
│   │       ├── upload-keys.dto.ts
│   │       └── get-user-keys.dto.ts
│   └── presence/
│       ├── presence.module.ts
│       ├── presence.gateway.ts
│       └── presence.service.ts
└── shared/
    ├── services/
    │   ├── supabase.service.ts
    │   ├── redis.service.ts
    │   ├── r2.service.ts
    │   └── encryption.service.ts
    └── interfaces/
        └── ...
```

### 5.2 REST API Endpoints

```typescript
// =====================
// AUTH MODULE
// =====================

// POST /auth/register
interface RegisterDto {
  email: string;
  username: string;
  password: string;
  displayName?: string;
  identityPublicKey: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys: string[]; // Array of 100 keys
}

interface RegisterResponse {
  user: UserDto;
  tokens: TokenPair;
}

// POST /auth/login
interface LoginDto {
  email: string;
  password: string;
  deviceInfo: {
    deviceId: string;
    deviceName: string;
    platform: 'web' | 'ios' | 'android';
  };
}

interface LoginResponse {
  user: UserDto;
  tokens: TokenPair;
}

// POST /auth/refresh
interface RefreshTokenDto {
  refreshToken: string;
}

interface RefreshTokenResponse {
  tokens: TokenPair;
}

// POST /auth/logout
// Body: { deviceId?: string } // If not provided, logout current device
// Response: { success: true }

// POST /auth/logout-all
// Logout from all devices
// Response: { success: true }

// POST /auth/verify-email
interface VerifyEmailDto {
  token: string;
}

// POST /auth/forgot-password
interface ForgotPasswordDto {
  email: string;
}

// POST /auth/reset-password
interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

// POST /auth/enable-mfa
// Response: { secret: string, qrCode: string, backupCodes: string[] }

// POST /auth/verify-mfa
interface VerifyMfaDto {
  token: string; // 6-digit TOTP
}

// =====================
// USERS MODULE
// =====================

// GET /users/me
// Response: UserDto

// PATCH /users/me
interface UpdateProfileDto {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

// GET /users/:id
// Response: UserDto (public info only)

// GET /users/search?q=query
interface SearchUsersQuery {
  q: string;
  limit?: number;
  offset?: number;
}
// Response: { users: UserDto[], total: number }

// GET /users/:id/devices
// Response: DeviceDto[]

// DELETE /users/devices/:deviceId
// Response: { success: true }

// POST /users/block/:userId
// Response: { success: true }

// DELETE /users/block/:userId
// Response: { success: true }

// GET /users/blocked
// Response: UserDto[]

// =====================
// KEYS MODULE
// =====================

// GET /keys/users/:userId
// Response: { identityPublicKey, signedPreKey, signedPreKeySignature, oneTimePreKey? }

// POST /keys/one-time-keys
interface UploadOneTimeKeysDto {
  keys: Array<{ keyId: number, publicKey: string }>;
}

// GET /keys/one-time-keys/count
// Response: { count: number }

// =====================
// CONVERSATIONS MODULE
// =====================

// GET /conversations
interface GetConversationsQuery {
  limit?: number;
  offset?: number;
}
// Response: { conversations: ConversationDto[], total: number }

// POST /conversations
interface CreateConversationDto {
  participantId: string; // For 1-1 chat
  // For group chat (future):
  // participantIds: string[];
  // name?: string;
}
// Response: ConversationDto

// GET /conversations/:id
// Response: ConversationDto

// DELETE /conversations/:id
// Leave conversation
// Response: { success: true }

// GET /conversations/:id/participants
// Response: ParticipantDto[]

// POST /conversations/:id/participants
interface AddParticipantDto {
  userId: string;
}

// DELETE /conversations/:id/participants/:userId
// Remove participant (admin only)

// =====================
// MESSAGES MODULE
// =====================

// GET /conversations/:conversationId/messages
interface GetMessagesQuery {
  limit?: number;
  before?: string; // Message ID for pagination
}
// Response: { messages: MessageDto[], hasMore: boolean }

// POST /conversations/:conversationId/messages
interface SendMessageDto {
  encryptedContent: string;
  contentType: 'text' | 'image' | 'video' | 'file' | 'audio';
  sessionVersion: number;
  ratchetStep: number;
  replyToMessageId?: string;
  attachments?: Array<{
    attachmentId: string; // From upload endpoint
    encryptedFileKey: string;
  }>;
}
// Response: MessageDto

// PATCH /messages/:messageId
interface EditMessageDto {
  encryptedContent: string;
  sessionVersion: number;
  ratchetStep: number;
}

// DELETE /messages/:messageId
// Soft delete
// Response: { success: true }

// POST /messages/:messageId/read
// Mark as read
// Response: { success: true }

// GET /messages/search
interface SearchMessagesQuery {
  q: string; // Note: Only works on decrypted messages client-side
  conversationId?: string;
  limit?: number;
}

// =====================
// ATTACHMENTS MODULE
// =====================

// POST /attachments/upload
// Content-Type: multipart/form-data
// Body: { file: File, conversationId: string }
interface UploadAttachmentResponse {
  attachmentId: string;
  encryptionKey: string; // Client should encrypt this with message key
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailId?: string; // For images/videos
}

// GET /attachments/:attachmentId
// Response: Encrypted file stream

// GET /attachments/:attachmentId/thumbnail
// Response: Encrypted thumbnail stream

// =====================
// CALLS MODULE (REST endpoints)
// =====================

// GET /calls/turn-credentials
// Response: TurnCredentials

// GET /conversations/:conversationId/calls
// Get call history
// Response: CallDto[]
```

### 5.3 WebSocket Events (Socket.io)

```typescript
// =====================
// CONNECTION
// =====================

// Client -> Server
socket.emit('authenticate', { token: 'jwt-token' });

// Server -> Client
socket.on('authenticated', { userId: string });
socket.on('error', { message: string });

// =====================
// PRESENCE
// =====================

// Server -> Client (broadcast to contacts)
socket.on('user:online', { userId: string, lastSeen: Date });
socket.on('user:offline', { userId: string, lastSeen: Date });

// =====================
// TYPING INDICATORS
// =====================

// Client -> Server
socket.emit('typing:start', { conversationId: string });
socket.emit('typing:stop', { conversationId: string });

// Server -> Client (to conversation participants)
socket.on('typing:start', { conversationId: string, userId: string });
socket.on('typing:stop', { conversationId: string, userId: string });

// =====================
// MESSAGES
// =====================

// Server -> Client (new message notification)
socket.on('message:new', {
  messageId: string,
  conversationId: string,
  senderId: string,
  encryptedContent: string,
  contentType: string,
  sessionVersion: number,
  ratchetStep: number,
  sentAt: Date
});

// Server -> Client (message edited)
socket.on('message:edited', {
  messageId: string,
  conversationId: string,
  encryptedContent: string,
  editedAt: Date
});

// Server -> Client (message deleted)
socket.on('message:deleted', {
  messageId: string,
  conversationId: string
});

// Client -> Server (mark as delivered)
socket.emit('message:delivered', { messageId: string });

// Server -> Client (delivery receipt)
socket.on('message:delivered', {
  messageId: string,
  userId: string,
  deliveredAt: Date
});

// Client -> Server (mark as read)
socket.emit('message:read', { messageId: string });

// Server -> Client (read receipt)
socket.on('message:read', {
  messageId: string,
  userId: string,
  readAt: Date
});

// =====================
// CALLS (WebRTC Signaling)
// =====================

// Client -> Server (initiate call)
socket.emit('call:initiate', {
  conversationId: string,
  recipientId: string,
  callType: 'audio' | 'video'
});

// Server -> Client (incoming call)
socket.on('call:incoming', {
  callId: string,
  callerId: string,
  callerName: string,
  callerAvatar: string,
  callType: 'audio' | 'video'
});

// Client -> Server (send offer)
socket.emit('call:offer', {
  callId: string,
  recipientId: string,
  offer: RTCSessionDescriptionInit
});

// Server -> Client (receive offer)
socket.on('call:offer', {
  callId: string,
  callerId: string,
  offer: RTCSessionDescriptionInit
});

// Client -> Server (send answer)
socket.emit('call:answer', {
  callId: string,
  recipientId: string,
  answer: RTCSessionDescriptionInit
});

// Server -> Client (receive answer)
socket.on('call:answer', {
  callId: string,
  answer: RTCSessionDescriptionInit
});

// Client -> Server (send ICE candidate)
socket.emit('call:ice-candidate', {
  callId: string,
  recipientId: string,
  candidate: RTCIceCandidateInit
});

// Server -> Client (receive ICE candidate)
socket.on('call:ice-candidate', {
  callId: string,
  candidate: RTCIceCandidateInit
});

// Client -> Server (reject call)
socket.emit('call:reject', { callId: string });

// Server -> Client (call rejected)
socket.on('call:rejected', { callId: string, reason?: string });

// Client -> Server (end call)
socket.emit('call:end', { callId: string });

// Server -> Client (call ended)
socket.on('call:ended', {
  callId: string,
  endedBy: string,
  duration: number
});

// Server -> Client (call failed)
socket.on('call:failed', { callId: string, reason: string });

// =====================
// CONVERSATIONS
// =====================

// Server -> Client (new conversation)
socket.on('conversation:new', { conversation: ConversationDto });

// Server -> Client (conversation updated)
socket.on('conversation:updated', { conversation: ConversationDto });

// Server -> Client (removed from conversation)
socket.on('conversation:removed', { conversationId: string });
```

---

## 6. FRONTEND SPECIFICATION

### 6.1 Web App (Next.js)

#### Cấu trúc thư mục
```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   └── layout.tsx
├── (main)/
│   ├── conversations/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── layout.tsx
├── api/
│   └── ... (API routes if needed)
├── layout.tsx
└── page.tsx

components/
├── auth/
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   └── MFASetup.tsx
├── chat/
│   ├── ConversationList.tsx
│   ├── ConversationItem.tsx
│   ├── ChatWindow.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── MessageInput.tsx
│   ├── TypingIndicator.tsx
│   ├── MessageStatus.tsx
│   └── AttachmentPreview.tsx
├── call/
│   ├── VideoCallWindow.tsx
│   ├── AudioCallWindow.tsx
│   ├── CallControls.tsx
│   └── IncomingCallModal.tsx
├── ui/
│   └── ... (shadcn components)
└── layout/
    ├── Sidebar.tsx
    └── TopBar.tsx

lib/
├── api/
│   ├── client.ts
│   ├── auth.ts
│   ├── conversations.ts
│   ├── messages.ts
│   └── calls.ts
├── crypto/
│   ├── e2ee.ts
│   ├── keys.ts
│   └── session.ts
├── socket/
│   ├── socket.ts
│   └── events.ts
├── webrtc/
│   ├── peer-connection.ts
│   └── media-manager.ts
├── storage/
│   ├── secure-storage.ts
│   └── db.ts (IndexedDB for local encryption keys)
└── utils/
    ├── encryption.ts
    └── file.ts

hooks/
├── useAuth.ts
├── useConversations.ts
├── useMessages.ts
├── useSocket.ts
├── useCall.ts
├── usePresence.ts
└── useE2EE.ts

stores/
├── auth-store.ts
├── conversations-store.ts
├── messages-store.ts
├── call-store.ts
└── ui-store.ts

types/
├── api.ts
├── crypto.ts
└── socket.ts
```

#### Core Components

```typescript
// =====================
// E2EE Manager (Client-side)
// =====================

// lib/crypto/e2ee.ts
import { box, randomBytes, sign } from 'libsodium-wrappers';
import { openDB, DBSchema } from 'idb';

interface E2EEDatabase extends DBSchema {
  'identity-keys': {
    key: 'current';
    value: {
      public: Uint8Array;
      private: Uint8Array;
    };
  };
  'sessions': {
    key: string; // userId
    value: {
      rootKey: Uint8Array;
      chainKey: Uint8Array;
      messageNumber: number;
      previousCounter: number;
    };
  };
  'pre-keys': {
    key: 'signed-pre-key';
    value: {
      public: Uint8Array;
      private: Uint8Array;
      signature: Uint8Array;
    };
  };
}

class E2EEManager {
  private db: IDBPDatabase<E2EEDatabase>;
  
  async initialize(): Promise<void> {
    this.db = await openDB<E2EEDatabase>('e2ee-storage', 1, {
      upgrade(db) {
        db.createObjectStore('identity-keys');
        db.createObjectStore('sessions');
        db.createObjectStore('pre-keys');
      }
    });
    
    // Check if keys exist
    const identityKey = await this.db.get('identity-keys', 'current');
    
    if (!identityKey) {
      await this.generateAndUploadKeys();
    }
  }
  
  private async generateAndUploadKeys(): Promise<void> {
    // Generate identity key pair
    const identityKeyPair = box.keyPair();
    
    // Generate signed pre key
    const signedPreKeyPair = box.keyPair();
    const signature = sign.detached(
      signedPreKeyPair.publicKey,
      identityKeyPair.privateKey
    );
    
    // Generate one-time pre keys
    const oneTimePreKeys = Array.from({ length: 100 }, () => box.keyPair());
    
    // Save to IndexedDB
    await this.db.put('identity-keys', identityKeyPair, 'current');
    await this.db.put('pre-keys', {
      public: signedPreKeyPair.publicKey,
      private: signedPreKeyPair.privateKey,
      signature
    }, 'signed-pre-key');
    
    // Upload public keys to server
    await api.keys.upload({
      identityPublicKey: this.toBase64(identityKeyPair.publicKey),
      signedPreKey: this.toBase64(signedPreKeyPair.publicKey),
      signedPreKeySignature: this.toBase64(signature),
      oneTimePreKeys: oneTimePreKeys.map((kp, i) => ({
        keyId: i,
        publicKey: this.toBase64(kp.publicKey)
      }))
    });
  }
  
  async encryptMessage(
    recipientId: string,
    plaintext: string
  ): Promise<{ ciphertext: string; sessionVersion: number; ratchetStep: number }> {
    let session = await this.db.get('sessions', recipientId);
    
    if (!session) {
      session = await this.initializeSession(recipientId);
    }
    
    const messageKey = await this.deriveMessageKey(session);
    const nonce = randomBytes(24);
    
    const ciphertext = box(
      new TextEncoder().encode(plaintext),
      nonce,
      messageKey,
      session.chainKey
    );
    
    // Ratchet forward
    session.messageNumber++;
    await this.db.put('sessions', session, recipientId);
    
    return {
      ciphertext: this.toBase64(new Uint8Array([...nonce, ...ciphertext])),
      sessionVersion: 1,
      ratchetStep: session.messageNumber
    };
  }
  
  async decryptMessage(
    senderId: string,
    ciphertext: string,
    ratchetStep: number
  ): Promise<string> {
    const session = await this.db.get('sessions', senderId);
    
    if (!session) {
      throw new Error('No session with sender');
    }
    
    // Sync ratchet state
    await this.syncRatchet(session, ratchetStep);
    
    const messageKey = await this.deriveMessageKey(session);
    const data = this.fromBase64(ciphertext);
    const nonce = data.slice(0, 24);
    const ciphertextBytes = data.slice(24);
    
    const plaintext = box.open(
      ciphertextBytes,
      nonce,
      messageKey,
      session.chainKey
    );
    
    if (!plaintext) {
      throw new Error('Decryption failed');
    }
    
    session.messageNumber++;
    await this.db.put('sessions', session, senderId);
    
    return new TextDecoder().decode(plaintext);
  }
  
  private async initializeSession(recipientId: string) {
    // Fetch recipient's public keys
    const recipientKeys = await api.keys.getUserKeys(recipientId);
    
    // Perform X3DH key exchange
    const identityKey = await this.db.get('identity-keys', 'current');
    const ephemeralKeyPair = box.keyPair();
    
    // Compute shared secrets
    const dh1 = box.before(
      this.fromBase64(recipientKeys.identityPublicKey),
      identityKey.private
    );
    const dh2 = box.before(
      this.fromBase64(recipientKeys.signedPreKey),
      ephemeralKeyPair.privateKey
    );
    const dh3 = recipientKeys.oneTimePreKey
      ? box.before(this.fromBase64(recipientKeys.oneTimePreKey), ephemeralKeyPair.privateKey)
      : new Uint8Array(32);
    
    // Derive root key
    const kdf = await crypto.subtle.importKey(
      'raw',
      new Uint8Array([...dh1, ...dh2, ...dh3]),
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );
    
    const rootKey = new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(32),
          info: new TextEncoder().encode('WhisperText')
        },
        kdf,
        256
      )
    );
    
    const session = {
      rootKey,
      chainKey: rootKey,
      messageNumber: 0,
      previousCounter: 0
    };
    
    await this.db.put('sessions', session, recipientId);
    return session;
  }
  
  private async deriveMessageKey(session: any): Promise<Uint8Array> {
    const kdf = await crypto.subtle.importKey(
      'raw',
      session.chainKey,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );
    
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(32),
          info: new Uint8Array([session.messageNumber])
        },
        kdf,
        256
      )
    );
  }
  
  private toBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
  }
  
  private fromBase64(str: string): Uint8Array {
    return new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
  }
}

export const e2eeManager = new E2EEManager();

// =====================
// Socket Manager
// =====================

// lib/socket/socket.ts
import { io, Socket } from 'socket.io-client';
import { authStore } from '@/stores/auth-store';

class SocketManager {
  private socket: Socket | null = null;
  
  connect(): void {
    const token = authStore.getState().accessToken;
    
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    
    this.setupListeners();
  }
  
  private setupListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('Socket connected');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // Message events
    this.socket.on('message:new', async (data) => {
      try {
        const plaintext = await e2eeManager.decryptMessage(
          data.senderId,
          data.encryptedContent,
          data.ratchetStep
        );
        
        messagesStore.getState().addMessage({
          ...data,
          content: plaintext,
          decrypted: true
        });
        
        // Mark as delivered
        this.emit('message:delivered', { messageId: data.messageId });
      } catch (error) {
        console.error('Failed to decrypt message:', error);
      }
    });
    
    // Typing events
    this.socket.on('typing:start', (data) => {
      conversationsStore.getState().setTyping(data.conversationId, data.userId, true);
    });
    
    this.socket.on('typing:stop', (data) => {
      conversationsStore.getState().setTyping(data.conversationId, data.userId, false);
    });
    
    // Presence events
    this.socket.on('user:online', (data) => {
      conversationsStore.getState().updateUserPresence(data.userId, true);
    });
    
    this.socket.on('user:offline', (data) => {
      conversationsStore.getState().updateUserPresence(data.userId, false);
    });
    
    // Call events
    this.socket.on('call:incoming', (data) => {
      callStore.getState().setIncomingCall(data);
    });
    
    this.socket.on('call:offer', (data) => {
      callStore.getState().handleOffer(data);
    });
    
    this.socket.on('call:answer', (data) => {
      callStore.getState().handleAnswer(data);
    });
    
    this.socket.on('call:ice-candidate', (data) => {
      callStore.getState().handleIceCandidate(data);
    });
    
    this.socket.on('call:ended', (data) => {
      callStore.getState().endCall(data);
    });
  }
  
  emit(event: string, data: any): void {
    if (!this.socket) return;
    this.socket.emit(event, data);
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketManager = new SocketManager();

// =====================
// WebRTC Manager
// =====================

// lib/webrtc/peer-connection.ts
class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  
  async initialize(callType: 'audio' | 'video'): Promise<void> {
    // Get TURN credentials
    const turnCredentials = await api.calls.getTurnCredentials();
    
    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: turnCredentials.urls.map(url => ({
        urls: url,
        username: turnCredentials.username,
        credential: turnCredentials.credential
      })),
      iceTransportPolicy: 'relay', // Force TURN relay
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });
    
    // Setup event handlers
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketManager.emit('call:ice-candidate', {
          callId: callStore.getState().currentCall?.id,
          recipientId: callStore.getState().currentCall?.recipientId,
          candidate: event.candidate.toJSON()
        });
      }
    };
    
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      callStore.getState().setRemoteStream(this.remoteStream);
    };
    
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      
      if (this.peerConnection?.iceConnectionState === 'disconnected' ||
          this.peerConnection?.iceConnectionState === 'failed') {
        this.handleConnectionFailure();
      }
    };
    
    // Get local media
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } : false
    });
    
    // Add local tracks to peer connection
    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });
    
    callStore.getState().setLocalStream(this.localStream);
  }
  
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    await this.peerConnection.setLocalDescription(offer);
    
    return offer;
  }
  
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    return answer;
  }
  
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
  }
  
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  }
  
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    await this.peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  }
  
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }
  
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }
  
  async switchCamera(): Promise<void> {
    if (!this.localStream) return;
    
    const videoTrack = this.localStream.getVideoTracks()[0];
    const currentDeviceId = videoTrack.getSettings().deviceId;
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    const nextDevice = videoDevices.find(d => d.deviceId !== currentDeviceId);
    
    if (nextDevice) {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: nextDevice.deviceId }
      });
      
      const newTrack = newStream.getVideoTracks()[0];
      const sender = this.peerConnection
        ?.getSenders()
        .find(s => s.track?.kind === 'video');
      
      if (sender) {
        await sender.replaceTrack(newTrack);
        videoTrack.stop();
        this.localStream.removeTrack(videoTrack);
        this.localStream.addTrack(newTrack);
      }
    }
  }
  
  cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.remoteStream = null;
  }
  
  private handleConnectionFailure(): void {
    console.error('Call connection failed');
    callStore.getState().endCall({ reason: 'connection_failed' });
  }
}

export const webrtcManager = new WebRTCManager();
```

### 6.2 Mobile App (React Native)

#### Cấu trúc thư mục (tương tự Web, nhưng với native components)

```
src/
├── navigation/
│   ├── RootNavigator.tsx
│   ├── AuthNavigator.tsx
│   └── MainNavigator.tsx
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── ForgotPasswordScreen.tsx
│   ├── conversations/
│   │   ├── ConversationsScreen.tsx
│   │   └── ChatScreen.tsx
│   ├── calls/
│   │   ├── CallScreen.tsx
│   │   └── IncomingCallScreen.tsx
│   └── settings/
│       └── SettingsScreen.tsx
├── components/
│   ├── auth/
│   ├── chat/
│   ├── call/
│   └── ui/
├── lib/
│   ├── api/
│   ├── crypto/
│   ├── socket/
│   ├── webrtc/
│   └── storage/
├── hooks/
├── stores/
└── types/

// Key differences from web:
// - Use react-native-keychain for secure key storage
// - Use react-native-webrtc for video calls
// - Use react-native-quick-crypto for encryption
// - Use @react-native-async-storage/async-storage for general storage
// - Use react-native-permissions for camera/microphone permissions
// - Use react-native-push-notification for notifications
```

#### Mobile-specific implementations

```typescript
// Secure Storage (React Native)
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SecureStorage {
  async setItem(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword(key, value, {
      service: key,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED
    });
  }
  
  async getItem(key: string): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({ service: key });
    return credentials ? credentials.password : null;
  }
  
  async removeItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: key });
  }
}

// Push Notifications
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

class NotificationService {
  async initialize(): Promise<void> {
    await messaging().requestPermission();
    
    const token = await messaging().getToken();
    await api.users.updatePushToken(token);
    
    messaging().onMessage(async (remoteMessage) => {
      await this.displayNotification(remoteMessage);
    });
    
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      await this.displayNotification(remoteMessage);
    });
  }
  
  private async displayNotification(message: any): Promise<void> {
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel'
    });
    
    await notifee.displayNotification({
      title: message.notification.title,
      body: message.notification.body,
      android: {
        channelId,
        pressAction: {
          id: 'default'
        }
      }
    });
  }
}

// WebRTC (React Native)
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCIceCandidate,
  RTCSessionDescription
} from 'react-native-webrtc';

class MobileWebRTCManager {
  // Similar to web implementation but using react-native-webrtc
  
  async getLocalStream(callType: 'audio' | 'video'): Promise<MediaStream> {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? {
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: 'user'
      } : false
    });
    
    return stream;
  }
  
  // Rest similar to web implementation
}
```

---

## 7. ĐẶC TẢ CHI TIẾT CÁC TÍNH NĂNG

### 7.1 Message Delivery Flow

```typescript
// Complete flow with E2EE and delivery tracking

// 1. User A types message
const plaintext = "Hello!";

// 2. Encrypt with E2EE
const encrypted = await e2eeManager.encryptMessage(userB.id, plaintext);

// 3. Send to server via API
const message = await api.messages.send({
  conversationId,
  encryptedContent: encrypted.ciphertext,
  contentType: 'text',
  sessionVersion: encrypted.sessionVersion,
  ratchetStep: encrypted.ratchetStep
});

// 4. Server stores encrypted message in DB
await db.messages.insert({
  id: message.id,
  conversationId,
  senderId: userA.id,
  encryptedContent: encrypted.ciphertext,
  // ... server never has plaintext
});

// 5. Server sends to User B via WebSocket (if online)
io.to(userB.socketId).emit('message:new', {
  messageId: message.id,
  conversationId,
  senderId: userA.id,
  encryptedContent: encrypted.ciphertext,
  sessionVersion: encrypted.sessionVersion,
  ratchetStep: encrypted.ratchetStep,
  sentAt: new Date()
});

// 6. User B receives and decrypts
socket.on('message:new', async (data) => {
  const plaintext = await e2eeManager.decryptMessage(
    data.senderId,
    data.encryptedContent,
    data.ratchetStep
  );
  
  // Display message
  messagesStore.addMessage({ ...data, content: plaintext });
  
  // Send delivery receipt
  socket.emit('message:delivered', { messageId: data.messageId });
});

// 7. Server updates delivery status
await db.messageReceipts.insert({
  messageId: data.messageId,
  userId: userB.id,
  deliveredAt: new Date()
});

// 8. Notify User A
io.to(userA.socketId).emit('message:delivered', {
  messageId: data.messageId,
  userId: userB.id,
  deliveredAt: new Date()
});

// 9. User B reads message
socket.emit('message:read', { messageId: data.messageId });

// 10. Update read status
await db.messageReceipts.update({
  where: { messageId: data.messageId, userId: userB.id },
  data: { readAt: new Date() }
});

// 11. Notify User A
io.to(userA.socketId).emit('message:read', {
  messageId: data.messageId,
  userId: userB.id,
  readAt: new Date()
});
```

### 7.2 Video Call Flow

```typescript
// Complete video call flow

// 1. User A initiates call
const call = await api.calls.initiate({
  recipientId: userB.id,
  callType: 'video'
});

// Initialize WebRTC
await webrtcManager.initialize('video');

// 2. Server notifies User B
io.to(userB.socketId).emit('call:incoming', {
  callId: call.id,
  callerId: userA.id,
  callerName: userA.displayName,
  callerAvatar: userA.avatar,
  callType: 'video'
});

// 3. User B accepts
await api.calls.accept(call.id);
await webrtcManager.initialize('video');

// 4. User A creates offer
const offer = await webrtcManager.createOffer();
socket.emit('call:offer', {
  callId: call.id,
  recipientId: userB.id,
  offer
});

// 5. Server forwards offer to User B
io.to(userB.socketId).emit('call:offer', {
  callId: call.id,
  callerId: userA.id,
  offer
});

// 6. User B handles offer and creates answer
await webrtcManager.handleOffer(offer);
const answer = await webrtcManager.createAnswer();
socket.emit('call:answer', {
  callId: call.id,
  recipientId: userA.id,
  answer
});

// 7. Server forwards answer to User A
io.to(userA.socketId).emit('call:answer', {
  callId: call.id,
  answer
});

// 8. User A handles answer
await webrtcManager.handleAnswer(answer);

// 9. ICE candidates exchange
// Both users send ICE candidates to each other via signaling server
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit('call:ice-candidate', {
      callId,
      recipientId,
      candidate: event.candidate.toJSON()
    });
  }
};

// 10. Connection established - media streaming begins
peerConnection.ontrack = (event) => {
  remoteStream = event.streams[0];
  // Display remote video
};

// 11. During call - controls
webrtcManager.toggleAudio(false); // Mute
webrtcManager.toggleVideo(false); // Turn off camera
webrtcManager.switchCamera();     // Switch front/back camera

// 12. End call
socket.emit('call:end', { callId });
webrtcManager.cleanup();

// Server updates call record
await db.calls.update({
  where: { id: callId },
  data: {
    endedAt: new Date(),
    duration: calculateDuration(call.answeredAt, new Date())
  }
});

// Notify other user
io.to(userB.socketId).emit('call:ended', {
  callId,
  endedBy: userA.id,
  duration
});
```

### 7.3 File Upload & Encryption Flow

```typescript
// Secure file upload with encryption

// 1. User selects file
const file = selectedFile; // File object

// 2. Validate file
if (file.size > 100 * 1024 * 1024) {
  throw new Error('File too large');
}

if (!allowedMimeTypes.includes(file.type)) {
  throw new Error('File type not allowed');
}

// 3. Generate random encryption key for this file
const fileKey = await crypto.getRandomValues(new Uint8Array(32));

// 4. Encrypt file client-side
const fileBuffer = await file.arrayBuffer();
const encryptedFile = await chaCha20Poly1305EncryptFile(
  new Uint8Array(fileBuffer),
  fileKey
);

// 5. Upload encrypted file to server
const formData = new FormData();
formData.append('file', new Blob([encryptedFile]), 'encrypted.bin');
formData.append('conversationId', conversationId);
formData.append('originalName', file.name);
formData.append('mimeType', file.type);

const uploadResult = await api.attachments.upload(formData);

// 6. Server uploads to R2 (still encrypted)
const r2Key = `conversations/${conversationId}/${uploadResult.attachmentId}`;
await r2Client.putObject({
  Bucket: process.env.R2_BUCKET,
  Key: r2Key,
  Body: encryptedFile,
  ServerSideEncryption: 'AES256', // R2 encryption at rest
  ContentType: 'application/octet-stream'
});

// 7. Encrypt file key with message encryption
const encryptedFileKey = await e2eeManager.encryptMessage(
  recipientId,
  JSON.stringify({
    fileKey: Array.from(fileKey),
    attachmentId: uploadResult.attachmentId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type
  })
);

// 8. Send message with encrypted file metadata
await api.messages.send({
  conversationId,
  encryptedContent: encryptedFileKey.ciphertext,
  contentType: 'file',
  sessionVersion: encryptedFileKey.sessionVersion,
  ratchetStep: encryptedFileKey.ratchetStep,
  attachments: [{
    attachmentId: uploadResult.attachmentId,
    encryptedFileKey: encryptedFileKey.ciphertext
  }]
});

// 9. Recipient downloads and decrypts
// a. Receive message and decrypt file metadata
const fileMetadata = JSON.parse(
  await e2eeManager.decryptMessage(
    senderId,
    message.encryptedContent,
    message.ratchetStep
  )
);

// b. Download encrypted file from R2
const encryptedFileBlob = await api.attachments.download(
  fileMetadata.attachmentId
);

// c. Decrypt file with file key
const decryptedFile = await chaCha20Poly1305DecryptFile(
  new Uint8Array(await encryptedFileBlob.arrayBuffer()),
  new Uint8Array(fileMetadata.fileKey)
);

// d. Display or save file
const blob = new Blob([decryptedFile], { type: fileMetadata.mimeType });
const url = URL.createObjectURL(blob);
// Show in UI or trigger download
```

---

## 8. TESTING & DEPLOYMENT

### 8.1 Testing Strategy

```typescript
// Backend Testing
// - Unit tests: Jest
// - Integration tests: Supertest
// - E2E tests: Jest + Supertest
// - Load testing: Artillery or K6

// Example test
describe('Messages', () => {
  describe('POST /conversations/:id/messages', () => {
    it('should send encrypted message', async () => {
      const response = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          encryptedContent: 'base64-encrypted-content',
          contentType: 'text',
          sessionVersion: 1,
          ratchetStep: 5
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.encryptedContent).toBe('base64-encrypted-content');
    });
    
    it('should reject if user not in conversation', async () => {
      const response = await request(app)
        .post(`/conversations/${otherConversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          encryptedContent: 'base64-encrypted-content',
          contentType: 'text',
          sessionVersion: 1,
          ratchetStep: 5
        });
      
      expect(response.status).toBe(403);
    });
  });
});

// Frontend Testing
// - Unit tests: Jest + React Testing Library
// - E2E tests: Playwright or Cypress
// - Visual regression: Chromatic or Percy

// Example test
describe('ChatWindow', () => {
  it('should encrypt and send message', async () => {
    const { getByPlaceholderText, getByText } = render(<ChatWindow />);
    
    const input = getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    
    const sendButton = getByText('Send');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(api.messages.send).toHaveBeenCalledWith(
        expect.objectContaining({
          encryptedContent: expect.any(String),
          contentType: 'text'
        })
      );
    });
  });
});
```

### 8.2 Environment Variables

```bash
# Backend (.env)
# Database
DATABASE_URL=postgresql://user:password@host:5432/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# R2 Storage
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=your-bucket-name
R2_PUBLIC_URL=https://your-bucket.r2.dev

# JWT
JWT_SECRET=your-very-long-random-secret-key-min-256-bits
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# WebSocket
WS_PORT=3001
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# TURN Server
TURN_SERVER_URL=turn:turn.yourdomain.com:3478
TURN_SECRET=your-turn-secret

# Email (for verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Security
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=4

# Rate Limiting
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX=100

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.r2.dev
```

### 8.3 Deployment

```yaml
# Docker Compose for development
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: chatapp
      POSTGRES_PASSWORD: password
      POSTGRES_DB: chatapp
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
  
  backend:
    build: ./backend
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://chatapp:password@postgres:5432/chatapp
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
  
  frontend:
    build: ./frontend
    ports:
      - "3002:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
      - NEXT_PUBLIC_WS_URL=ws://localhost:3001

volumes:
  postgres-data:
  redis-data:

# Production deployment (Kubernetes example)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/backend:latest
        ports:
        - containerPort: 3000
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

---

## 9. SECURITY CHECKLIST

### Pre-deployment Security Audit

- [ ] All API endpoints have authentication
- [ ] All API endpoints have authorization checks
- [ ] Rate limiting is enabled on all endpoints
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitization + CSP)
- [ ] CSRF protection enabled
- [ ] CORS configured correctly
- [ ] Security headers set (Helmet)
- [ ] HTTPS enforced
- [ ] Certificate pinning (mobile)
- [ ] E2EE implemented and tested
- [ ] Keys stored securely (IndexedDB + encryption web, Keychain mobile)
- [ ] Files encrypted before upload
- [ ] WebRTC uses TURN relay
- [ ] TURN credentials are time-limited
- [ ] Audit logging enabled
- [ ] Error messages don't leak sensitive info
- [ ] Passwords hashed with Argon2id
- [ ] JWT tokens are short-lived
- [ ] Refresh token rotation
- [ ] Session management secure
- [ ] Database RLS enabled
- [ ] Secrets in environment variables
- [ ] Dependencies up to date
- [ ] Security scanning (Snyk, npm audit)
- [ ] Penetration testing completed

---

## 10. PERFORMANCE OPTIMIZATION

```typescript
// Database indexing
- Index on messages(conversation_id, created_at DESC)
- Index on conversation_participants(user_id)
- Index on users(email), users(username)

// Caching strategy
- Redis for:
  * User sessions
  * User presence (online/offline)
  * Typing indicators (with TTL)
  * Conversation metadata
  * Frequently accessed messages

// Message pagination
- Cursor-based pagination
- Fetch 50 messages at a time
- Infinite scroll with virtualization

// Image/Video optimization
- Generate thumbnails on upload
- Use WebP format where supported
- Lazy loading
- Progressive image loading

// WebSocket optimization
- Binary protocol where possible
- Message batching
- Compression (but be careful with BREACH attack)

// Frontend optimization
- Code splitting
- Lazy loading routes
- React.memo for expensive components
- Virtual scrolling for message lists
- Service worker for offline support
- IndexedDB for local message cache

// Mobile optimization
- Native performance optimizations
- Hermes engine (React Native)
- ProGuard/R8 (Android)
- App bundle size optimization
```

---

## 11. MONITORING & OBSERVABILITY

```typescript
// Logging
- Winston (backend)
- Structured JSON logs
- Log levels: error, warn, info, debug
- Correlation IDs for request tracing

// Metrics
- Prometheus + Grafana
- Key metrics:
  * API response times
  * WebSocket connection count
  * Message throughput
  * Error rates
  * Database query performance
  * Redis hit/miss rates

// Alerting
- PagerDuty or similar
- Alerts for:
  * High error rates
  * Slow response times
  * Database connection issues
  * Redis failures
  * High memory usage
  * Failed logins (potential attack)

// Error tracking
- Sentry for both backend and frontend
- Error grouping and deduplication
- Release tracking
- Performance monitoring

// APM (Application Performance Monitoring)
- New Relic or DataDog
- Distributed tracing
- Real user monitoring (RUM)
```

---

## CONCLUSION

Bản đặc tả này cung cấp blueprint chi tiết để xây dựng một ứng dụng chat & video call an toàn với:

1. **Bảo mật tối đa**: E2EE, HTTPS, secure storage, input validation
2. **Kiến trúc mở rộng**: Microservices-ready, caching, load balancing
3. **Trải nghiệm người dùng tốt**: Real-time, offline support, responsive UI
4. **Tuân thủ best practices**: Clean code, testing, documentation

### Next Steps để Implement:

1. Setup project structure
2. Implement authentication module
3. Implement E2EE key exchange
4. Build real-time messaging
5. Integrate WebRTC video calling
6. Add file upload with encryption
7. Implement UI/UX
8. Testing thoroughly
9. Security audit
10. Deploy to production

Mọi thứ đã được đặc tả chi tiết. AI Agent có thể sử dụng document này để implement từng module một cách tuần tự và đầy đủ.
