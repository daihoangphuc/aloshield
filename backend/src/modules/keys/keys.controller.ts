import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KeysService } from './keys.service';

@Controller('keys')
@UseGuards(AuthGuard('jwt'))
export class KeysController {
  constructor(private keysService: KeysService) {}

  @Post('upload')
  async uploadKeys(
    @Req() req: any,
    @Body() body: {
      identityPublicKey: string;
      signedPreKey: string;
      signedPreKeySignature: string;
      oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
    },
  ) {
    return this.keysService.uploadKeys(req.user.id, body);
  }

  @Get('users/:userId')
  async getUserKeys(@Param('userId') userId: string) {
    return this.keysService.getUserKeys(userId);
  }

  @Post('one-time-keys')
  async uploadOneTimeKeys(
    @Req() req: any,
    @Body() body: { keys: Array<{ keyId: number; publicKey: string }> },
  ) {
    return this.keysService.uploadOneTimeKeys(req.user.id, body.keys);
  }

  @Get('one-time-keys/count')
  async getOneTimeKeyCount(@Req() req: any) {
    return this.keysService.getOneTimeKeyCount(req.user.id);
  }
}





