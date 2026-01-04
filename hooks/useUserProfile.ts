import { useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { getUserProfile } from '@/lib/services';
import {
  userProfileAtom,
  profileLoadingAtom,
  profileErrorAtom,
  updateProfileAtom,
  setProfileLoadingAtom,
  setProfileErrorAtom,
  clearProfileAtom,
} from '@/store/profile';

/**
 * Custom hook to fetch and manage user profile
 *
 * Automatically updates profile store when fetching from API
 *
 * @example
 * const { profile, loading, error, fetchProfile, clearProfile } = useUserProfile();
 *
 * // Fetch profile
 * await fetchProfile('clp5abc123');
 *
 * // Access profile data
 * console.log(profile?.available_balances);
 */
export function useUserProfile() {
  const profile = useAtomValue(userProfileAtom);
  const loading = useAtomValue(profileLoadingAtom);
  const error = useAtomValue(profileErrorAtom);

  const updateProfile = useSetAtom(updateProfileAtom);
  const setLoading = useSetAtom(setProfileLoadingAtom);
  const setError = useSetAtom(setProfileErrorAtom);
  const clearProfile = useSetAtom(clearProfileAtom);

  /**
   * Fetch user profile from API and update store
   * @param walletId - Privy user ID (without "did:privy:" prefix)
   */
  const fetchProfile = useCallback(async (walletId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔄 [useUserProfile] Fetching user profile from API...');
      const backendProfile = await getUserProfile(walletId);

      console.log('✅ [useUserProfile] Profile fetched from backend');

      // ✅ Transform backend response to UserProfile format
      const profileData = {
        // Backend fields
        _id: backendProfile._id,
        wallet_id: walletId,
        wallet_address: backendProfile.wallet_address || '',
        address: backendProfile.wallet_address || '',
        available_balances: backendProfile.available_balances || Array(10).fill('0'),
        reserved_balances: backendProfile.reserved_balances || Array(10).fill('0'),
        orders_list: backendProfile.orders_list || Array(4).fill(null),
        fees: backendProfile.fees?.toString() || '0',
        nonce: backendProfile.nonce || 0,
        merkle_root: backendProfile.merkle_root || '',
        merkle_index: backendProfile.merkle_index || 0,
        sibling_paths: backendProfile.sibling_paths || [],

        // Detailed balance info (if available from backend)
        balances: (backendProfile as any).balances || undefined,

        // State management fields
        current_commitment: backendProfile.current_commitment || '',
        current_nullifier: backendProfile.current_nullifier || '',
        pk_root: backendProfile.pk_root,
        blinder: backendProfile.blinder,
        is_initialized: backendProfile.is_initialized || false,
        sync: backendProfile.sync || false,
        last_tx_hash: backendProfile.last_tx_hash,

        // Timestamps
        created_at: backendProfile.created_at,
        updated_at: backendProfile.updated_at,
      };

      console.log('💾 [useUserProfile] Updating store with transformed profile...');
      updateProfile(profileData);

      return profileData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile';
      console.error('❌ [useUserProfile] Error fetching profile:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateProfile, setLoading, setError]);

  /**
   * Refetch current profile (useful after order/transfer)
   * @param walletId - Privy user ID (without "did:privy:" prefix)
   */
  const refetchProfile = useCallback(async (walletId: string) => {
    console.log('🔄 Refetching profile to get latest state...');
    return await fetchProfile(walletId);
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    fetchProfile,
    refetchProfile,
    clearProfile,
  };
}