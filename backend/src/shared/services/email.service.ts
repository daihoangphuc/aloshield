import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    // Initialize Nodemailer transporter if SMTP config is available
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD')?.trim().replace(/\s+/g, ''); // Remove all spaces
    const smtpSecure = this.configService.get<boolean>('SMTP_SECURE', false);

    // Debug logging (hide password)
    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      this.logger.log(`📧 SMTP Config loaded:`);
      this.logger.log(`   Host: ${smtpHost}`);
      this.logger.log(`   Port: ${smtpPort}`);
      this.logger.log(`   Secure: ${smtpSecure}`);
      this.logger.log(`   User: ${smtpUser}`);
      this.logger.log(`   Password length: ${smtpPassword.length} chars`);
      this.logger.log(`   Password (first 4 chars): ${smtpPassword.substring(0, 4)}****`);
    } else {
      this.logger.warn(`⚠️ SMTP config incomplete:`);
      this.logger.warn(`   Host: ${smtpHost || 'MISSING'}`);
      this.logger.warn(`   Port: ${smtpPort || 'MISSING'}`);
      this.logger.warn(`   User: ${smtpUser || 'MISSING'}`);
      this.logger.warn(`   Password: ${smtpPassword ? `${smtpPassword.length} chars` : 'MISSING'}`);
    }

    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      try {
        // For Gmail: Use the simplest possible config
        // Let nodemailer handle all TLS/SSL negotiation automatically
        const transporterConfig: any = {
          service: smtpHost === 'smtp.gmail.com' ? 'gmail' : undefined, // Use 'gmail' service for automatic config
          host: smtpHost === 'smtp.gmail.com' ? undefined : smtpHost, // Only set host if not using service
          port: smtpHost === 'smtp.gmail.com' ? undefined : smtpPort, // Only set port if not using service
          secure: smtpSecure, // true for 465, false for 587
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
        };

        // If using Gmail service, nodemailer will auto-configure everything
        // Otherwise, set port and host manually
        if (smtpHost !== 'smtp.gmail.com') {
          transporterConfig.host = smtpHost;
          transporterConfig.port = smtpPort;
        }

        this.transporter = nodemailer.createTransport(transporterConfig);
        this.logger.log(`✅ SMTP transporter initialized (${smtpHost}:${smtpPort}, secure: ${smtpSecure})`);
        
        // Don't verify on init - verify on first send instead
        // This avoids SSL errors during startup
      } catch (error: any) {
        this.logger.error(`Failed to initialize SMTP transporter: ${error.message}`);
      }
    } else {
      this.logger.warn('⚠️ SMTP configuration not found in .env file.');
      this.logger.warn('⚠️ Please add SMTP config to backend/.env:');
      this.logger.warn('   SMTP_HOST=smtp.gmail.com');
      this.logger.warn('   SMTP_PORT=587');
      this.logger.warn('   SMTP_SECURE=false');
      this.logger.warn('   SMTP_USER=your-email@gmail.com');
      this.logger.warn('   SMTP_PASSWORD=your-app-password');
      this.logger.warn('   SMTP_FROM=ALO Shield <your-email@gmail.com>');
    }
  }

  /**
   * Send password reset email using Supabase Auth
   * Supabase will handle sending the email automatically via custom SMTP
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      const supabase = this.supabaseService.getAdminClient();
      
      // Check if user exists in our database first
      const { data: user } = await supabase
        .from('users')
        .select('id, email, supabase_id, password_hash')
        .eq('email', email)
        .single();
      
      if (!user) {
        this.logger.warn(`User not found in database for email: ${email}`);
        return; // Don't reveal if user exists (security)
      }

      // If user has supabase_id, use Supabase Auth directly
      if (user.supabase_id) {
        try {
          // Check if user has password in Supabase Auth
          const { data: authUserData } = await supabase.auth.admin.getUserById(user.supabase_id);
          const hasEmailProvider = authUserData?.user?.identities?.some((id: any) => id.provider === 'email');
          
          // Only set password if user doesn't have email provider (OAuth-only user)
          if (!hasEmailProvider) {
            this.logger.log(`User ${email} is OAuth-only, setting password for recovery...`);
            const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + 'A1!@';
            
            const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(user.supabase_id, {
              password: tempPassword,
            });
            
            if (updatePasswordError) {
              this.logger.warn(`Could not set password (user might already have one): ${updatePasswordError.message}`);
            } else {
              this.logger.log(`Password set for OAuth user ${email}`);
            }
          } else {
            this.logger.log(`User ${email} already has email provider, skipping password setup`);
          }
          
          // Try to send reset email via Supabase Auth first
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
          });
          
          if (resetError) {
            this.logger.error(`Failed to send reset email via Supabase Auth: ${resetError.message}`);
            this.logger.warn(`⚠️ Supabase email failed, trying direct SMTP...`);
            
            // Fallback: Try sending email directly via SMTP
            const smtpSent = await this.sendEmailDirectly(email, resetUrl, resetToken);
            if (!smtpSent) {
              // Final fallback: console log
              this.logger.error(`⚠️ All email methods failed. Check SMTP configuration in .env file.`);
              this.logEmailToConsole(email, resetUrl, resetToken);
            }
          } else {
            this.logger.log(`✅ Password reset email sent via Supabase Auth (custom SMTP) to ${email}`);
            this.logger.log(`📧 Email should arrive shortly. Check spam folder if not received.`);
          }
        } catch (error: any) {
          this.logger.error(`Error sending email via Supabase: ${error.message}`);
          // Fallback: Try direct SMTP
          const smtpSent = await this.sendEmailDirectly(email, resetUrl, resetToken);
          if (!smtpSent) {
            this.logEmailToConsole(email, resetUrl, resetToken);
          }
        }
        return;
      }

      // User doesn't have supabase_id - try to find or create user in Supabase Auth
      // This allows us to use Supabase's email service
      try {
        // First, try to send reset email directly (user might already exist in Supabase Auth)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: resetUrl,
        });
        
        if (!resetError) {
          // Success - user exists in Supabase Auth and email was sent
          this.logger.log(`✅ Password reset email sent via Supabase Auth (custom SMTP) to ${email}`);
          
          // Try to find and update supabase_id for future use
          try {
            const { data: listData } = await supabase.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            });
            
            if (listData?.users) {
              const foundUser = listData.users.find((u: any) => u.email === email);
              if (foundUser) {
                await supabase
                  .from('users')
                  .update({ supabase_id: foundUser.id })
                  .eq('id', user.id);
                this.logger.log(`Updated supabase_id for ${email}: ${foundUser.id}`);
              }
            }
          } catch (updateErr: any) {
            // Non-critical - just log
            this.logger.warn(`Could not update supabase_id: ${updateErr.message}`);
          }
          return;
        }
        
        // If resetPasswordForEmail failed, user might not exist in Supabase Auth
        // Try to create user in Supabase Auth
        this.logger.log(`User not found in Supabase Auth, creating...`);
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            user_id: user.id,
          },
        });

          if (createError) {
            // User might already exist but resetPasswordForEmail failed for other reason
            if (createError.message.includes('already registered') || createError.code === 'email_exists') {
              this.logger.warn(`User exists in Supabase Auth but resetPasswordForEmail failed: ${resetError?.message}`);
              // Try direct SMTP
              const smtpSent = await this.sendEmailDirectly(email, resetUrl, resetToken);
              if (!smtpSent) {
                this.logEmailToConsole(email, resetUrl, resetToken);
              }
            } else {
              this.logger.error(`Failed to create user in Supabase Auth: ${createError.message}`);
              // Try direct SMTP
              const smtpSent = await this.sendEmailDirectly(email, resetUrl, resetToken);
              if (!smtpSent) {
                this.logEmailToConsole(email, resetUrl, resetToken);
              }
            }
            return;
          }

        // Update user's supabase_id in our database
        if (authUser?.user?.id) {
          try {
            const { error: updateError } = await supabase
              .from('users')
              .update({ supabase_id: authUser.user.id })
              .eq('id', user.id);
            
            if (updateError) {
              this.logger.error(`Failed to update supabase_id: ${updateError.message}`);
            } else {
              this.logger.log(`Created Supabase Auth user for ${email}`);
            }
          } catch (updateErr: any) {
            this.logger.error(`Error updating supabase_id: ${updateErr.message}`);
          }
          
          // Now send reset email via Supabase Auth
          const { error: resetError2 } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
          });
          
          if (resetError2) {
            this.logger.error(`Failed to send reset email after creating Auth user: ${resetError2.message}`);
            // Try direct SMTP
            const smtpSent = await this.sendEmailDirectly(email, resetUrl, resetToken);
            if (!smtpSent) {
              this.logEmailToConsole(email, resetUrl, resetToken);
            }
          } else {
            this.logger.log(`✅ Password reset email sent via Supabase Auth (custom SMTP) to ${email}`);
          }
        }
      } catch (error: any) {
        this.logger.error(`Error in email service: ${error.message}`);
        this.logEmailToConsole(email, resetUrl, resetToken);
      }
    } catch (error: any) {
      this.logger.error(`Error in sendPasswordResetEmail: ${error.message}`);
      // Fallback: log to console
      this.logEmailToConsole(email, resetUrl, resetToken);
    }
  }

  /**
   * Send email directly via SMTP (fallback when Supabase fails)
   */
  private async sendEmailDirectly(email: string, resetUrl: string, resetToken: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('SMTP transporter not available. Cannot send email directly.');
      this.logger.warn('Please check SMTP configuration in .env file.');
      return false;
    }

    try {
      const smtpFrom = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@aloshield.com';
      const emailHtml = this.getPasswordResetEmailTemplate(resetUrl);

      this.logger.log(`Attempting to send email via SMTP to ${email}...`);
      
      const info = await this.transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject: 'Đặt lại mật khẩu - ALO Shield',
        html: emailHtml,
        text: `Đặt lại mật khẩu\n\nNhấp vào liên kết sau để đặt lại mật khẩu:\n${resetUrl}\n\nLiên kết này sẽ hết hạn sau 1 giờ.`,
      });

      this.logger.log(`✅ Password reset email sent directly via SMTP to ${email}`);
      this.logger.log(`📧 Message ID: ${info.messageId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email directly via SMTP: ${error.message}`);
      
      // Provide helpful error messages
      if (error.message.includes('Invalid login') || error.message.includes('authentication failed')) {
        this.logger.error('⚠️ SMTP authentication failed. Please check SMTP_USER and SMTP_PASSWORD in .env');
        this.logger.error('⚠️ For Gmail, make sure you are using App Password, not regular password');
      } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
        this.logger.error('⚠️ SSL/TLS connection error. Try using port 465 with SMTP_SECURE=true');
      } else {
        this.logger.error(`⚠️ Error details: ${error.code || 'unknown'}`);
      }
      
      return false;
    }
  }

  private logEmailToConsole(email: string, resetUrl: string, resetToken: string) {
    console.log('📧 Password Reset Email (Console Log):');
    console.log(`To: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`Token: ${resetToken}`);
    console.log('---');
    console.log('ℹ️ If user has Supabase account, email will be sent via Supabase Auth');
    console.log('ℹ️ Otherwise, use the token above to reset password manually');
  }

  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 40px auto; padding: 0; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">ALO Shield</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Bảo mật tuyệt đối</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Đặt lại mật khẩu</h2>
              <p style="color: #666; margin: 0 0 30px 0; font-size: 16px;">
                Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình. Nhấp vào nút bên dưới để đặt lại mật khẩu:
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                  Đặt lại mật khẩu
                </a>
              </div>
              
              <!-- Alternative link -->
              <p style="color: #666; margin: 30px 0 10px 0; font-size: 14px;">
                Hoặc sao chép và dán liên kết này vào trình duyệt của bạn:
              </p>
              <p style="word-break: break-all; color: #667eea; margin: 0 0 30px 0; font-size: 12px; padding: 12px; background-color: #f5f5f5; border-radius: 6px; font-family: monospace;">
                ${resetUrl}
              </p>
              
              <!-- Warning -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-top: 30px;">
                <p style="color: #856404; margin: 0; font-size: 13px;">
                  <strong>⚠️ Lưu ý:</strong> Liên kết này sẽ hết hạn sau 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} ALO Shield. Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

