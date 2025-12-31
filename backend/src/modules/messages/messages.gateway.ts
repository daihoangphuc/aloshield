import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MessagesService } from './messages.service';
import { ConversationsService } from '../conversations/conversations.service';

interface AuthenticatedSocket extends Socket {
  userId: string;
  user: any;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || 
                    client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        client.disconnect();
        return;
      }

      client.userId = user.id;
      client.user = user;

      // Track user's socket connections
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(client.id);

      // Update user online status
      await this.usersService.setOnlineStatus(user.id, true);

      // Join user's personal room
      client.join(`user:${user.id}`);

      // Notify contacts about online status
      this.broadcastPresence(user.id, true);

      console.log(`User ${user.username} connected (socket: ${client.id})`);
    } catch (error) {
      console.error('Socket authentication failed:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;

    // Remove socket from user's connections
    const userSocketSet = this.userSockets.get(client.userId);
    if (userSocketSet) {
      userSocketSet.delete(client.id);

      // If no more connections, set offline
      if (userSocketSet.size === 0) {
        this.userSockets.delete(client.userId);
        await this.usersService.setOnlineStatus(client.userId, false);
        this.broadcastPresence(client.userId, false);
      }
    }

    console.log(`User ${client.user?.username} disconnected (socket: ${client.id})`);
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      conversationId: string;
      encryptedContent: string;
      contentType: string;
      sessionVersion: number;
      ratchetStep: number;
      replyToMessageId?: string;
      tempId?: string;
      nonce?: string;
      ephemeralPublicKey?: string;
    },
  ) {
    try {
      const message = await this.messagesService.sendMessage(client.userId, {
        conversationId: data.conversationId,
        encryptedContent: data.encryptedContent,
        contentType: data.contentType as any,
        sessionVersion: data.sessionVersion,
        ratchetStep: data.ratchetStep,
        replyToMessageId: data.replyToMessageId,
      });

      // Send to all participants
      const conversation = await this.conversationsService.getConversationById(
        data.conversationId,
        client.userId,
      );

      // Prepare message payload with E2EE data
      const messagePayload = {
        ...message,
        tempId: data.tempId,
        nonce: data.nonce,
        ephemeralPublicKey: data.ephemeralPublicKey,
      };

      for (const participant of conversation.participants) {
        // Emit message to participant
        this.server.to(`user:${participant.user_id}`).emit('message:new', messagePayload);
        
        // If this is a new conversation for the recipient, also send conversation update
        if (participant.user_id !== client.userId) {
          this.server.to(`user:${participant.user_id}`).emit('conversation:updated', conversation);
        }
      }

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      await this.messagesService.markAsDelivered(data.messageId, client.userId);

      // Get message to find sender
      const message = await this.messagesService.getMessageById(data.messageId);

      // Notify sender
      this.server.to(`user:${message.sender_id}`).emit('message:delivered', {
        messageId: data.messageId,
        userId: client.userId,
        deliveredAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      await this.messagesService.markAsRead(data.messageId, client.userId);

      // Get message to find sender
      const message = await this.messagesService.getMessageById(data.messageId);

      // Notify sender
      this.server.to(`user:${message.sender_id}`).emit('message:read', {
        messageId: data.messageId,
        userId: client.userId,
        readAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      const result = await this.messagesService.deleteMessage(data.messageId, client.userId);

      // Get conversation to notify participants
      const conversation = await this.conversationsService.getConversationById(
        result.conversationId,
        client.userId,
      );

      // Notify all participants
      for (const participant of conversation.participants) {
        this.server.to(`user:${participant.user_id}`).emit('message:deleted', {
          messageId: data.messageId,
          conversationId: result.conversationId,
          deletedBy: client.userId,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    try {
      const message = await this.messagesService.editMessage(
        data.messageId,
        client.userId,
        data.content,
      );

      // Notify all participants
      const conversation = await this.conversationsService.getConversationById(
        message.conversation_id,
        client.userId,
      );

      for (const participant of conversation.participants) {
        this.server.to(`user:${participant.user_id}`).emit('message:edited', {
          messageId: data.messageId,
          conversationId: message.conversation_id,
          content: data.content,
          editedAt: message.edited_at,
        });
      }

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:react')
  async handleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    try {
      const reactions = await this.messagesService.addReaction(
        data.messageId,
        client.userId,
        data.emoji,
      );

      // Get message to find conversation
      const message = await this.messagesService.getMessageById(data.messageId);
      const conversation = await this.conversationsService.getConversationById(
        message.conversation_id,
        client.userId,
      );

      // Notify all participants
      for (const participant of conversation.participants) {
        this.server.to(`user:${participant.user_id}`).emit('message:reaction', {
          messageId: data.messageId,
          conversationId: message.conversation_id,
          reactions,
          userId: client.userId,
          emoji: data.emoji,
        });
      }

      return { success: true, reactions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message:unreact')
  async handleRemoveReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ) {
    try {
      const reactions = await this.messagesService.removeReaction(
        data.messageId,
        client.userId,
      );

      // Get message to find conversation
      const message = await this.messagesService.getMessageById(data.messageId);
      const conversation = await this.conversationsService.getConversationById(
        message.conversation_id,
        client.userId,
      );

      // Notify all participants
      for (const participant of conversation.participants) {
        this.server.to(`user:${participant.user_id}`).emit('message:reaction', {
          messageId: data.messageId,
          conversationId: message.conversation_id,
          reactions,
          userId: client.userId,
          removed: true,
        });
      }

      return { success: true, reactions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const conversation = await this.conversationsService.getConversationById(
        data.conversationId,
        client.userId,
      );

      // Notify other participants
      for (const participant of conversation.participants) {
        if (participant.user_id !== client.userId) {
          this.server.to(`user:${participant.user_id}`).emit('typing:start', {
            conversationId: data.conversationId,
            userId: client.userId,
          });
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const conversation = await this.conversationsService.getConversationById(
        data.conversationId,
        client.userId,
      );

      // Notify other participants
      for (const participant of conversation.participants) {
        if (participant.user_id !== client.userId) {
          this.server.to(`user:${participant.user_id}`).emit('typing:stop', {
            conversationId: data.conversationId,
            userId: client.userId,
          });
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async broadcastPresence(userId: string, isOnline: boolean) {
    // Get user's contacts and notify them
    const contacts = await this.usersService.getContacts(userId);

    for (const contact of contacts) {
      const contactUser = contact as any;
      this.server.to(`user:${contactUser.id}`).emit(isOnline ? 'user:online' : 'user:offline', {
        userId,
        lastSeen: new Date().toISOString(),
      });
    }
  }

  // Helper method to send to specific user
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && (this.userSockets.get(userId)?.size ?? 0) > 0;
  }
}

