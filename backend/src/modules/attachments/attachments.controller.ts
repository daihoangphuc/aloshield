import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
@UseGuards(AuthGuard('jwt'))
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  }))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Body('conversationId') conversationId: string,
    @Req() req: any,
  ) {
    return this.attachmentsService.uploadAttachment(
      req.user.id,
      conversationId,
      file,
    );
  }

  @Get(':id')
  async getAttachment(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.attachmentsService.getAttachment(id, req.user.id);
  }

  @Get(':id/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName, mimeType } = await this.attachmentsService.getAttachmentFile(
      id,
      req.user.id,
    );

    // Use the actual MIME type from database, fallback to octet-stream if not available
    const contentType = mimeType || 'application/octet-stream';
    
    // Set headers to ensure proper file download with original filename and extension
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    
    // Use both filename and filename* for better browser compatibility
    // filename* uses UTF-8 encoding for international characters
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`
    );
    
    res.send(buffer);
  }
}




