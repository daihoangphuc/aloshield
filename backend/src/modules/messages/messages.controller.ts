import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService, SendMessageDto } from './messages.service';

@Controller('conversations/:conversationId/messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit: number = 50,
    @Query('before') before: string,
    @Req() req: any,
  ) {
    return this.messagesService.getMessages(
      conversationId,
      req.user.id,
      limit,
      before,
    );
  }

  @Post()
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: Omit<SendMessageDto, 'conversationId'>,
    @Req() req: any,
  ) {
    return this.messagesService.sendMessage(req.user.id, {
      ...body,
      conversationId,
    });
  }

  @Post(':messageId/read')
  async markAsRead(
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.messagesService.markAsRead(messageId, req.user.id);
  }

  @Delete(':messageId')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    return this.messagesService.deleteMessage(messageId, req.user.id);
  }
}






