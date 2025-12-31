import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../../shared/services/supabase.service';
import { R2Service } from '../../shared/services/r2.service';
import { ConversationsService } from '../conversations/conversations.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

@Injectable()
export class AttachmentsService {
  constructor(
    private supabaseService: SupabaseService,
    private r2Service: R2Service,
    private conversationsService: ConversationsService,
  ) {}

  async uploadAttachment(
    userId: string,
    conversationId: string,
    file: Express.Multer.File,
  ) {
    // Verify user is participant
    const isParticipant = await this.conversationsService.isParticipant(
      conversationId,
      userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    // Validate file
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large (max 100MB)');
    }

    // Upload to R2 (file is already encrypted on client-side)
    const { key, fileId } = await this.r2Service.uploadFile(
      file.buffer,
      conversationId,
      file.originalname,
      file.mimetype,
    );

    // Create attachment record
    const supabase = this.supabaseService.getAdminClient();
    const { data: attachment, error } = await supabase
      .from('attachments')
      .insert([{
        r2_key: key,
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        encrypted_file_key: '', // Will be updated when message is sent
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      attachmentId: attachment.id,
      r2Key: key,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async getAttachment(attachmentId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Get attachment with message and conversation info
    const { data: attachment, error } = await supabase
      .from('attachments')
      .select(`
        *,
        message:messages!message_id (
          conversation_id,
          sender_id
        )
      `)
      .eq('id', attachmentId)
      .single();

    if (error) throw error;
    if (!attachment) throw new BadRequestException('Attachment not found');

    // Verify user has access
    if (attachment.message) {
      const isParticipant = await this.conversationsService.isParticipant(
        attachment.message.conversation_id,
        userId,
      );

      if (!isParticipant) {
        throw new ForbiddenException('You do not have access to this attachment');
      }
    }

    // Get signed URL for download
    const downloadUrl = await this.r2Service.getSignedDownloadUrl(attachment.r2_key);

    return {
      ...attachment,
      downloadUrl,
    };
  }

  async getAttachmentFile(attachmentId: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { data: attachment, error } = await supabase
      .from('attachments')
      .select(`
        *,
        message:messages!message_id (
          conversation_id
        )
      `)
      .eq('id', attachmentId)
      .single();

    if (error) throw error;
    if (!attachment) throw new BadRequestException('Attachment not found');

    // Verify access
    if (attachment.message) {
      const isParticipant = await this.conversationsService.isParticipant(
        attachment.message.conversation_id,
        userId,
      );

      if (!isParticipant) {
        throw new ForbiddenException('You do not have access to this attachment');
      }
    }

    // Get file from R2
    const fileBuffer = await this.r2Service.getFile(attachment.r2_key);

    return {
      buffer: fileBuffer,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
    };
  }
}


