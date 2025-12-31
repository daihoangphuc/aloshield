import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() body: {
      email: string;
      username: string;
      displayName?: string;
      password: string;
    },
    @Res() res: Response,
  ) {
    try {
      const user = await this.authService.register(body);
      return res.status(HttpStatus.CREATED).json({
        message: 'Đăng ký thành công',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          display_name: user.display_name,
        },
      });
    } catch (error) {
      throw new BadRequestException(error.message || 'Đăng ký thất bại');
    }
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.authService.login(body.email, body.password);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        accessToken: result.tokens.accessToken,
        user: result.user,
      });
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: error.message || 'Email hoặc mật khẩu không đúng',
      });
    }
  }

  @Post('supabase-sync')
  async supabaseSync(
    @Body() body: {
      supabaseUserId: string;
      email: string;
      displayName?: string;
      avatarUrl?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.authService.syncSupabaseUser(body);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        accessToken: result.tokens.accessToken,
        user: result.user,
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: error.message || 'Sync failed',
      });
    }
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow (legacy - use Supabase Auth instead)
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    try {
      const user = req.user;
      const tokens = await this.authService.generateTokens(user);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to frontend with access token
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      res.redirect(
        `${frontendUrl}/auth/callback?token=${tokens.accessToken}&userId=${user.id}`,
      );
    } catch (error) {
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  @Post('refresh')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          message: 'Refresh token not found',
        });
      }

      const tokens = await this.authService.refreshTokens(refreshToken);

      // Update refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        accessToken: tokens.accessToken,
      });
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: 'Invalid refresh token',
      });
    }
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Res() res: Response) {
    res.clearCookie('refreshToken');
    return res.json({ success: true });
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req: any) {
    return {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      display_name: req.user.display_name,
      avatar_url: req.user.avatar_url,
      is_online: req.user.is_online,
    };
  }
}

