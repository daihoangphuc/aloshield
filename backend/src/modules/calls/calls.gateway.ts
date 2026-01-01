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
import { CallsService } from './calls.service';
import { ConversationsService } from '../conversations/conversations.service';

interface AuthenticatedSocket extends Socket {
  userId: string;
  user: any;
}

@WebSocketGateway({
  namespace: 'calls',
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'https://aloshield.phucndh.site',
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, string> = new Map();
  private activeCalls: Map<string, { callerId: string; recipientId: string }> = new Map();

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private callsService: CallsService,
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

      this.userSockets.set(user.id, client.id);
      client.join(`user:${user.id}`);

      console.log(`[Calls] User ${user.username} connected`);
    } catch (error) {
      console.error('[Calls] Socket authentication failed:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.userSockets.delete(client.userId);

      // End any active calls
      for (const [callId, call] of this.activeCalls.entries()) {
        if (call.callerId === client.userId || call.recipientId === client.userId) {
          const otherUserId = call.callerId === client.userId ? call.recipientId : call.callerId;
          this.server.to(`user:${otherUserId}`).emit('call:ended', {
            callId,
            endedBy: client.userId,
            reason: 'disconnected',
          });
          this.activeCalls.delete(callId);
        }
      }

      console.log(`[Calls] User ${client.user?.username} disconnected`);
    }
  }

  @SubscribeMessage('call:initiate')
  async handleInitiateCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      conversationId: string;
      recipientId: string;
      callType: 'audio' | 'video';
    },
  ) {
    try {
      // Verify caller is participant
      const isParticipant = await this.conversationsService.isParticipant(
        data.conversationId,
        client.userId,
      );

      if (!isParticipant) {
        return { success: false, error: 'Not authorized' };
      }

      // Create call record
      const call = await this.callsService.createCall(
        data.conversationId,
        client.userId,
        data.callType,
      );

      // Track active call
      this.activeCalls.set(call.id, {
        callerId: client.userId,
        recipientId: data.recipientId,
      });

      // Get caller info
      const caller = await this.usersService.findById(client.userId);

      // Check if recipient is online
      const recipientSocketId = this.userSockets.get(data.recipientId);
      console.log(`[Calls] Initiating call to ${data.recipientId}, socket: ${recipientSocketId || 'NOT CONNECTED'}`);
      
      // Notify recipient
      this.server.to(`user:${data.recipientId}`).emit('call:incoming', {
        callId: call.id,
        callerId: client.userId,
        callerName: caller.display_name || caller.username,
        callerAvatar: caller.avatar_url,
        callType: data.callType,
        conversationId: data.conversationId,
      });
      
      console.log(`[Calls] Emitted call:incoming to user:${data.recipientId}`);

      // Update call status
      await this.callsService.updateCallStatus(call.id, 'ringing');

      return {
        success: true,
        callId: call.id,
        iceServers: this.callsService.getIceServers(client.userId),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:accept')
  async handleAcceptCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      const activeCall = this.activeCalls.get(data.callId);
      if (!activeCall) {
        return { success: false, error: 'Call not found' };
      }

      await this.callsService.updateCallStatus(data.callId, 'answered');

      // Notify caller that call was accepted
      this.server.to(`user:${activeCall.callerId}`).emit('call:accepted', {
        callId: data.callId,
      });

      return {
        success: true,
        iceServers: this.callsService.getIceServers(client.userId),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:reject')
  async handleRejectCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { callId: string; reason?: string },
  ) {
    try {
      const activeCall = this.activeCalls.get(data.callId);
      if (!activeCall) {
        return { success: false, error: 'Call not found' };
      }

      await this.callsService.updateCallStatus(data.callId, 'rejected');

      // Notify caller
      this.server.to(`user:${activeCall.callerId}`).emit('call:rejected', {
        callId: data.callId,
        reason: data.reason || 'declined',
      });

      this.activeCalls.delete(data.callId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call:offer')
  async handleOffer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      callId: string;
      recipientId: string;
      offer: RTCSessionDescriptionInit;
    },
  ) {
    this.server.to(`user:${data.recipientId}`).emit('call:offer', {
      callId: data.callId,
      callerId: client.userId,
      offer: data.offer,
    });

    return { success: true };
  }

  @SubscribeMessage('call:answer')
  async handleAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      callId: string;
      recipientId: string;
      answer: RTCSessionDescriptionInit;
    },
  ) {
    this.server.to(`user:${data.recipientId}`).emit('call:answer', {
      callId: data.callId,
      answer: data.answer,
    });

    return { success: true };
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      callId: string;
      recipientId: string;
      candidate: RTCIceCandidateInit;
    },
  ) {
    this.server.to(`user:${data.recipientId}`).emit('call:ice-candidate', {
      callId: data.callId,
      candidate: data.candidate,
    });

    return { success: true };
  }

  @SubscribeMessage('call:end')
  async handleEndCall(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      const activeCall = this.activeCalls.get(data.callId);
      if (!activeCall) {
        return { success: false, error: 'Call not found' };
      }

      const call = await this.callsService.updateCallStatus(data.callId, 'ended');

      // Notify other participant
      const otherUserId = activeCall.callerId === client.userId
        ? activeCall.recipientId
        : activeCall.callerId;

      this.server.to(`user:${otherUserId}`).emit('call:ended', {
        callId: data.callId,
        endedBy: client.userId,
        duration: call.duration,
      });

      this.activeCalls.delete(data.callId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}


