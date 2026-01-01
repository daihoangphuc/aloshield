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
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(AuthGuard('jwt'))
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  async getConversations(
    @Req() req: any,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    
    return this.conversationsService.getConversations(req.user.id, limit, offset);
  }

  @Post()
  async createConversation(
    @Req() req: any,
    @Body() body: { participantId: string },
  ) {
    return this.conversationsService.createDirectConversation(
      req.user.id,
      body.participantId,
    );
  }

  @Get(':id')
  async getConversation(@Param('id') id: string, @Req() req: any) {
    return this.conversationsService.getConversationById(id, req.user.id);
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.conversationsService.markAsRead(id, req.user.id);
  }

  @Delete(':id')
  async deleteConversation(@Param('id') id: string, @Req() req: any) {
    return this.conversationsService.softDeleteConversation(id, req.user.id);
  }
}

