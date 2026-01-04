"use client";

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { extractPrivyWalletId } from '@/lib/wallet-utils';

/**
 * ProfileLoader Component
 *
 * Automatically fetches user profile when user is authenticated
 * This component doesn't render anything - it just manages data loading
 */
const ProfileLoader = () => {
    const { user, authenticated } = usePrivy();
    const { fetchProfile, profile } = useUserProfile();

    useEffect(() => {
        // Only fetch if:
        // 1. User is authenticated
        // 2. User has an ID
        // 3. Profile not already loaded
        if (authenticated && user?.id && !profile) {
            const walletId = extractPrivyWalletId(user.id);
            console.log('🔄 [ProfileLoader] Auto-fetching user profile...', walletId);

            fetchProfile(walletId).catch((err) => {
                console.error('❌ [ProfileLoader] Failed to fetch profile:', err);
            });
        }
    }, [authenticated, user?.id, profile, fetchProfile]);

    // This component doesn't render anything
    return null;
};

export default ProfileLoader;
