import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../shared/services/supabase.service';

@Injectable()
export class KeysService {
  constructor(private supabaseService: SupabaseService) {}

  async uploadKeys(
    userId: string,
    keys: {
      identityPublicKey: string;
      signedPreKey: string;
      signedPreKeySignature: string;
      oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
    },
  ) {
    const supabase = this.supabaseService.getAdminClient();

    // Update user's keys
    await supabase
      .from('users')
      .update({
        identity_public_key: keys.identityPublicKey,
        signed_pre_key: keys.signedPreKey,
        signed_pre_key_signature: keys.signedPreKeySignature,
      })
      .eq('id', userId);

    // Insert one-time pre keys
    if (keys.oneTimePreKeys && keys.oneTimePreKeys.length > 0) {
      const otpkData = keys.oneTimePreKeys.map((key) => ({
        user_id: userId,
        key_id: key.keyId,
        public_key: key.publicKey,
        used: false,
      }));

      await supabase.from('one_time_pre_keys').insert(otpkData);
    }

    return { success: true };
  }

  async getUserKeys(userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    // Get user's main keys
    const { data: user, error } = await supabase
      .from('users')
      .select('identity_public_key, signed_pre_key, signed_pre_key_signature')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new NotFoundException('User not found');
    }

    // Get one unused one-time pre key
    const { data: otpk } = await supabase
      .from('one_time_pre_keys')
      .select('id, key_id, public_key')
      .eq('user_id', userId)
      .eq('used', false)
      .limit(1)
      .single();

    // Mark the OTK as used
    if (otpk) {
      await supabase
        .from('one_time_pre_keys')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', otpk.id);
    }

    return {
      identityPublicKey: user.identity_public_key,
      signedPreKey: user.signed_pre_key,
      signedPreKeySignature: user.signed_pre_key_signature,
      oneTimePreKey: otpk?.public_key || null,
    };
  }

  async uploadOneTimeKeys(
    userId: string,
    keys: Array<{ keyId: number; publicKey: string }>,
  ) {
    const supabase = this.supabaseService.getAdminClient();

    const otpkData = keys.map((key) => ({
      user_id: userId,
      key_id: key.keyId,
      public_key: key.publicKey,
      used: false,
    }));

    await supabase.from('one_time_pre_keys').insert(otpkData);

    return { success: true, count: keys.length };
  }

  async getOneTimeKeyCount(userId: string) {
    const supabase = this.supabaseService.getAdminClient();

    const { count, error } = await supabase
      .from('one_time_pre_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('used', false);

    if (error) throw error;

    return { count: count || 0 };
  }
}



