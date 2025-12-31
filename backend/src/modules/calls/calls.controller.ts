import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallsService } from './calls.service';

@Controller('calls')
@UseGuards(AuthGuard('jwt'))
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Get('ice-servers')
  async getIceServers(@Req() req: any) {
    return {
      iceServers: this.callsService.getIceServers(req.user.id),
    };
  }

  @Get('turn-credentials')
  async getTurnCredentials(@Req() req: any) {
    return this.callsService.getTurnCredentials(req.user.id);
  }

  @Get('history/:conversationId')
  async getCallHistory(
    @Param('conversationId') conversationId: string,
  ) {
    const calls = await this.callsService.getCallHistory(conversationId);
    return { calls };
  }
}

