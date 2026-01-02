# Phase 2 Implementation - Setup Guide

## 📦 Packages cần cài đặt

```bash
cd backend
npm install @nestjs/bullmq @socket.io/redis-adapter compression redis
npm install --save-dev @types/compression
```

## ✅ Đã implement

### 1. Response Compression ✅
- **File**: `backend/src/main.ts`
- **Feature**: Tự động compress responses > 1KB
- **Benefit**: 30-50% smaller payloads

### 2. Redis Adapter cho Socket.io ✅
- **File**: `backend/src/shared/adapters/redis-io.adapter.ts`
- **Feature**: Enable horizontal scaling cho Socket.io
- **Benefit**: Multiple backend instances có thể share WebSocket connections

### 3. BullMQ Queue System ✅
- **Files**: 
  - `backend/src/shared/queue/queue.module.ts`
  - `backend/src/shared/queue/message-queue.processor.ts`
  - `backend/src/shared/queue/message-queue.service.ts`
- **Feature**: Background job processing
- **Use Cases**:
  - Offline message delivery
  - Message cleanup jobs
  - Analytics aggregation

## 🔧 Configuration

### Environment Variables
```env
# Redis (required for Socket.io adapter and BullMQ)
REDIS_HOST=redis  # or your Redis host
REDIS_PORT=6379
REDIS_PASSWORD=  # optional
```

### Redis Adapter
- Tự động connect khi Redis được cấu hình
- Fallback gracefully nếu Redis không có (single instance mode)

### BullMQ
- Tự động setup khi Redis được cấu hình
- Queue workers chạy tự động trong background

## 🚀 Usage

### Message Queue Service
```typescript
// Inject MessageQueueService
constructor(private messageQueue: MessageQueueService) {}

// Queue offline message delivery
await this.messageQueue.addOfflineMessageDelivery({
  messageId: '...',
  userId: '...',
  conversationId: '...',
});

// Schedule message cleanup
await this.messageQueue.scheduleMessageCleanup(
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
);
```

## 📊 Performance Benefits

| Feature | Benefit |
|---------|---------|
| Response Compression | 30-50% smaller payloads |
| Redis Adapter | Enable horizontal scaling |
| BullMQ | Async background processing |

## ⚠️ Notes

- Redis adapter chỉ hoạt động khi `REDIS_HOST` được cấu hình
- Nếu không có Redis, Socket.io vẫn hoạt động bình thường (single instance)
- BullMQ cần Redis để hoạt động

