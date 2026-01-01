import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';

export interface GoogleProfile {
  id: string;
  email: string;
  displayName: string;
  picture?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  async register(data: {
    email: string;
    username: string;
    displayName?: string;
    password: string;
  }) {
    // Check if email already exists
    const existingEmail = await this.usersService.findByEmail(data.email);
    if (existingEmail) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    // Check if username already exists
    const existingUsername = await this.usersService.findByUsername(data.username);
    if (existingUsername) {
      throw new BadRequestException('Tên người dùng đã được sử dụng');
    }

    // Hash password
    const passwordHash = await argon2.hash(data.password);

    // Create user
    const user = await this.usersService.createUser({
      email: data.email,
      username: data.username,
      display_name: data.displayName || data.username,
      password_hash: passwordHash,
    });

    return user;
  }

  async login(email: string, password: string) {
    // Find user by email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Check if user has password (might be Google-only account)
    if (!user.password_hash) {
      throw new UnauthorizedException('Tài khoản này sử dụng đăng nhập Google');
    }

    // Verify password
    const isValidPassword = await argon2.verify(user.password_hash, password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
    };
  }

  async syncSupabaseUser(data: {
    supabaseUserId: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    try {
      // Validate input
      if (!data.supabaseUserId || !data.email) {
        throw new BadRequestException('Thiếu thông tin Supabase ID hoặc email');
      }

      // Check if user exists by Supabase ID
      let user = await this.usersService.findBySupabaseId(data.supabaseUserId);

      if (!user) {
        // Check if user exists by email
        user = await this.usersService.findByEmail(data.email);

        if (user) {
          // Link Supabase account to existing user and update avatar
          console.log(`Linking Supabase account to existing user: ${user.email}`);
          user = await this.usersService.updateUser(user.id, {
            supabase_id: data.supabaseUserId,
            avatar_url: data.avatarUrl || user.avatar_url, // Prefer new avatar from Google
            display_name: data.displayName || user.display_name,
          });
        } else {
          // Create new user
          console.log(`Creating new user for Supabase account: ${data.email}`);
          const username = await this.generateUniqueUsername(data.email);
          
          try {
            user = await this.usersService.createUser({
              email: data.email,
              username,
              display_name: data.displayName || username,
              avatar_url: data.avatarUrl,
              supabase_id: data.supabaseUserId,
            });
            console.log(`New user created: ${user.id}`);
          } catch (createError: any) {
            console.error('Error creating user:', createError);
            
            // If user creation failed due to duplicate, try to find and link
            if (createError.code === '23505') { // PostgreSQL unique violation
              user = await this.usersService.findByEmail(data.email);
              if (user && !user.supabase_id) {
                user = await this.usersService.updateUser(user.id, {
                  supabase_id: data.supabaseUserId,
                });
              } else if (!user) {
                throw new BadRequestException('Không thể tạo tài khoản. Email hoặc username đã tồn tại.');
              }
            } else {
              throw createError;
            }
          }
        }
      } else {
        console.log(`User found by Supabase ID: ${user.email}`);
        // Always update avatar from Google/Supabase if provided
        if (data.avatarUrl) {
          user = await this.usersService.updateUser(user.id, {
            avatar_url: data.avatarUrl,
            display_name: data.displayName || user.display_name,
          });
          console.log(`Updated avatar for user: ${user.email} -> ${data.avatarUrl}`);
        }
      }

      if (!user) {
        throw new BadRequestException('Không thể tạo hoặc tìm thấy tài khoản');
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      return {
        tokens,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        },
      };
    } catch (error: any) {
      console.error('syncSupabaseUser error:', error);
      throw new BadRequestException(error.message || 'Đồng bộ tài khoản Supabase thất bại');
    }
  }

  async validateGoogleUser(profile: GoogleProfile) {
    // Check if user exists by Google ID
    let user = await this.usersService.findByGoogleId(profile.id);

    if (!user) {
      // Check if user exists by email
      user = await this.usersService.findByEmail(profile.email);

      if (user) {
        // Link Google account to existing user
        user = await this.usersService.updateUser(user.id, {
          google_id: profile.id,
          avatar_url: user.avatar_url || profile.picture,
        });
      } else {
        // Create new user
        const username = await this.generateUniqueUsername(profile.email);
        user = await this.usersService.createUser({
          email: profile.email,
          username,
          display_name: profile.displayName,
          avatar_url: profile.picture,
          google_id: profile.id,
        });
      }
    }

    return user;
  }

  async generateTokens(user: any): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = baseUsername;
    let counter = 1;

    while (await this.usersService.findByUsername(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }
}

