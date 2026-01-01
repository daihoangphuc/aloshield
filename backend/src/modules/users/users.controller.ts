import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('search')
  async searchUsers(
    @Query('q') query: string,
    @Query('limit') limit: number = 20,
    @Req() req: any,
  ) {
    if (!query || query.length < 2) {
      return { users: [] };
    }
    const users = await this.usersService.searchUsers(query, req.user.id, limit);
    return { users };
  }

  @Get('contacts')
  async getContacts(@Req() req: any) {
    const contacts = await this.usersService.getContacts(req.user.id);
    return { contacts };
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return { error: 'User not found' };
    }
    // Return public info only
    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      is_online: user.is_online,
      last_seen_at: user.last_seen_at,
    };
  }

  @Patch('me')
  async updateProfile(@Req() req: any, @Body() body: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  }) {
    const updatedUser = await this.usersService.updateUser(req.user.id, body);
    return {
      id: updatedUser.id,
      username: updatedUser.username,
      display_name: updatedUser.display_name,
      avatar_url: updatedUser.avatar_url,
      bio: updatedUser.bio,
    };
  }
}



