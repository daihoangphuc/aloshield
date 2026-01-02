# ALO Shield - Secure Chat & Video Call

Ứng dụng chat và video call 1-1 với mã hóa đầu-cuối (E2EE), hỗ trợ cả Web và Mobile.

## 🚀 Tính năng

- ✅ Chat text real-time với mã hóa end-to-end (E2EE)
- ✅ Video call 1-1 peer-to-peer (WebRTC)
- ✅ Gửi file, hình ảnh, video an toàn (Cloudflare R2)
- ✅ Authentication với Google OAuth
- ✅ Message delivery status (sent, delivered, seen)
- ✅ Typing indicators
- ✅ User presence (online/offline)
- ✅ UI đẹp theo design mockup

## 🛠️ Tech Stack

### Backend
- NestJS (TypeScript)
- Supabase (PostgreSQL)
- Cloudflare R2 (S3-compatible storage)
- Socket.io (Real-time)
- WebRTC (Video calls)

### Frontend Web
- Next.js 14+ (App Router)
- React + TailwindCSS
- Zustand (State Management)
- Socket.io-client

## 📦 Cài đặt

### 1. Setup Database (Supabase)

1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
2. Mở SQL Editor
3. Copy và chạy nội dung file `backend/supabase-schema.sql`

### 2. Setup Backend

```bash
cd backend

# Copy file env
copy env.example .env

# Cập nhật các giá trị trong .env với credentials của bạn:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_KEY
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - AWS_ACCESS_KEY_ID (R2)
# - AWS_SECRET_ACCESS_KEY (R2)
# - AWS_S3_BUCKET
# - AWS_S3_ENDPOINT

# Cài đặt dependencies
npm install

# Chạy development server
npm run start:dev
```

Backend sẽ chạy tại: http://localhost:3001

### 3. Setup Frontend

```bash
cd frontend

# Copy file env
copy env.local.example .env.local

# Cập nhật các giá trị trong .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
# NEXT_PUBLIC_WS_URL=http://localhost:3001

# Cài đặt dependencies
npm install

# Chạy development server
npm run dev
```

Frontend sẽ chạy tại: http://localhost:3000

### 4. Setup Google OAuth

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. Tạo OAuth 2.0 Client ID
3. Thêm Authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
4. Copy Client ID và Client Secret vào file `.env` của backend

## 🔐 Cấu hình Environment Variables

### Backend (.env)

```env
# Cloudflare R2 Storage
AWS_ACCESS_KEY_ID=your_r2_access_key
AWS_SECRET_ACCESS_KEY=your_r2_secret_key
AWS_S3_BUCKET=aloshield
AWS_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
AWS_S3_REGION=auto

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

## 📱 Mobile App (React Native)

Cấu trúc cho React Native + Expo đã được chuẩn bị trong đặc tả. Để build mobile app:

```bash
# Tạo project Expo mới
npx create-expo-app@latest mobile

# Cài đặt dependencies
cd mobile
npm install socket.io-client zustand @tanstack/react-query
npm install react-native-webrtc expo-secure-store
```

## 🔒 Bảo mật

- **E2EE**: Tin nhắn được mã hóa đầu-cuối, server không thể đọc
- **HTTPS**: Tất cả kết nối được mã hóa TLS
- **JWT**: Token ngắn hạn (15 phút) với refresh token
- **File Encryption**: File được mã hóa trước khi upload lên R2

## 📄 API Endpoints

### Auth
- `GET /api/auth/google` - Đăng nhập với Google
- `GET /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Users
- `GET /api/users/search?q=query` - Tìm kiếm user
- `GET /api/users/:id` - Lấy thông tin user
- `PATCH /api/users/me` - Cập nhật profile

### Conversations
- `GET /api/conversations` - Lấy danh sách cuộc trò chuyện
- `POST /api/conversations` - Tạo cuộc trò chuyện mới
- `GET /api/conversations/:id` - Lấy chi tiết cuộc trò chuyện

### Messages
- `GET /api/conversations/:id/messages` - Lấy tin nhắn
- `POST /api/conversations/:id/messages` - Gửi tin nhắn

### WebSocket Events
- `message:send` - Gửi tin nhắn
- `message:new` - Nhận tin nhắn mới
- `typing:start` / `typing:stop` - Typing indicator
- `user:online` / `user:offline` - Presence

## 📝 License

MIT






