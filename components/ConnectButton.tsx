"use client";

import { usePrivy, useLogin, useLogout } from "@privy-io/react-auth";
import { Wallet, LogOut } from "lucide-react";
import { useEffect, useRef } from "react";
import { auth } from "@/lib/api";
import { extractPrivyWalletId } from "@/lib/wallet-utils";
import { clearWalletKeysExternal } from "@/store/walletKeys";
import { useUserProfile } from "@/hooks/useUserProfile";
import toast from "react-hot-toast";

interface ConnectButtonProps {
    className?: string;
    onClick?: () => void;
    onLoginSuccess?: (is_initialized?: boolean) => void | Promise<void>;
    onToggleSidebar?: () => void;
}

const ConnectButton = ({ className = "", onClick, onLoginSuccess, onToggleSidebar }: ConnectButtonProps) => {
    const { authenticated, user, getAccessToken } = usePrivy();
    const { logout } = useLogout();

    // ✅ Use profile hook for state management
    const { profile, loading: profileLoading, fetchProfile, clearProfile } = useUserProfile();

    // ✅ Prevent duplicate onComplete calls
    const isProcessingLogin = useRef(false);

    /**
     * Load user profile from backend and save to store
     *
     * Validates user connection before fetching profile:
     * - User is authenticated
     * - User object exists with valid ID
     * - Access token is available
     *
     * @returns Promise<boolean> - true if profile loaded successfully, false otherwise
     */
    const loadUserProfile = async (userFromCallback: any): Promise<boolean> => {
        try {
            console.log("🔍 [loadUserProfile] Starting profile load...");

            // ✅ Step 1: Validate user object
            if (!userFromCallback || !userFromCallback.user.id) {
                console.error("❌ [loadUserProfile] Invalid user object:", userFromCallback);
                return false;
            }

            console.log("✅ [loadUserProfile] User object valid:", {
                userId: userFromCallback.id,
                hasWallet: !!userFromCallback.wallet,
                walletAddress: userFromCallback.wallet?.address
            });

            // ✅ Step 2: Validate access token exists
            // const accessToken = auth.getToken();
            // if (!accessToken) {
            //     console.error("❌ [loadUserProfile] No access token found");
            //     toast.error("Authentication token missing");
            //     return false;
            // }

            console.log("✅ [loadUserProfile] Access token exists");

            // ✅ Step 3: Extract wallet ID
            const walletId = extractPrivyWalletId(userFromCallback.user.id);
            if (!walletId || walletId === userFromCallback.user.id) {
                // If walletId same as original, prefix wasn't removed - might be invalid format
                console.error("❌ [loadUserProfile] Failed to extract wallet ID:", {
                    original: userFromCallback.id,
                    extracted: walletId
                });
                toast.error("Invalid wallet ID format");
                return false;
            }

            console.log("✅ [loadUserProfile] Wallet ID extracted:", walletId);

            // ✅ Step 4: Fetch profile using hook (handles store update automatically)
            console.log("📡 [loadUserProfile] Fetching profile via useUserProfile hook...");
            const profileData = await fetchProfile(walletId);

            console.log("✅ [loadUserProfile] Profile loaded successfully!");
            console.log("📊 [loadUserProfile] Profile data:", {
                is_initialized: profileData.is_initialized,
                wallet_id: profileData.wallet_id
            });

            // ✅ Step 5: Check wallet initialization status and trigger onLoginSuccess
            console.log("📊 [loadUserProfile] Checking initialization status...");

            // ✅ Step 6: Always call onLoginSuccess with is_initialized parameter
            if (onLoginSuccess) {
                await onLoginSuccess(profileData.is_initialized);
            } else {
                console.warn("⚠️ [loadUserProfile] No onLoginSuccess callback provided");
            }

            return true;

        } catch (error) {
            console.error("❌ [loadUserProfile] Error loading profile:", error);

            // Handle specific error cases
            if (error instanceof Error) {
                if (error.message.includes('401')) {
                    // Authentication failed - user needs to login again
                    console.error("❌ [loadUserProfile] Authentication error - token invalid or expired");
                    toast.error("Authentication failed. Please login again.");
                    return false;
                } else if (error.message.includes('404')) {
                    // Profile not found - this might be a new user
                    console.warn("⚠️ [loadUserProfile] Profile not found (404) - might be new user");
                    console.log("ℹ️ [loadUserProfile] User needs to initialize wallet manually");
                    toast.error("Profile not found. Please initialize your wallet.");
                    return false;
                } else {
                    // Other errors
                    console.error("❌ [loadUserProfile] Unexpected error:", error.message);
                    toast.error(`Failed to load profile: ${error.message}`);
                    return false;
                }
            } else {
                // Unknown error type
                console.error("❌ [loadUserProfile] Unknown error type:", error);
                toast.error("Failed to load profile");
                return false;
            }
        }
    };

    const { login } = useLogin({
        onComplete: async (user, isNewUser, wasAlreadyAuthenticated, loginMethod, loginAccount) => {
            // ✅ Skip if already processing
            if (isProcessingLogin.current) {
                console.log("⏭️ Skipping duplicate onComplete call");
                return;
            }

            isProcessingLogin.current = true;

            try {
                console.log("Login completed:", {
                    user,
                    isNewUser,
                    wasAlreadyAuthenticated,
                    loginMethod,
                    loginAccount,
                });

                // Lấy Privy access token
                const privyToken = await getAccessToken();

                if (!privyToken) {
                    console.error("Failed to get Privy access token");
                    return;
                }

                console.log("Privy token:", privyToken);

                // Call backend API để đổi Privy token lấy backend token
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`,
                    {
                        method: "POST",
                        headers: {
                            accept: "application/json",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            token: privyToken,
                        }),
                    }
                );
                if (!response.ok) {
                    const errorData = await response.text();
                    console.error("Backend login failed:", response.status, errorData);
                    return;
                }

                const data = await response.json();
                console.log("Backend login response:", data);

                // Lưu token từ backend vào cookies
                // API trả về: { access_token: "...", user: {...} }
                if (data.access_token) {
                    await auth.setTokens(data.access_token, data.refresh_token);
                    console.log("✅ Backend tokens saved successfully to cookies");

                    // ✅ Step 3: Load user profile using dedicated function
                    await loadUserProfile(user);
                } else {
                    console.error("❌ No access_token in backend response");
                    toast.error("Login failed: No access token received");
                }
            } catch (error) {
                console.error("Error in login complete handler:", error);
            } finally {
                // ✅ Reset flag after processing (success or error)
                setTimeout(() => {
                    isProcessingLogin.current = false;
                }, 1000); // 1s delay to prevent rapid duplicate calls
            }
        },
        onError: (error) => {
            console.error("Login error:", error);
        },
    });

    useEffect(() => {

    }, [authenticated, user]);

    const handleClick = async() => {
        if (onClick) {
            onClick();
        }
        if (!authenticated) {
            login();
        }
    };

    const handleLogout = async () => {
        try {
            // ✅ Step 1: Clear all crypto keys from localStorage
            console.log('🔑 Clearing all crypto keys...');
            const keysToRemove = ['pk_root', 'sk_root', 'pk_match', 'sk_match'];
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`✅ Removed ${key}`);
            });

            // ✅ Step 2: Clear Jotai wallet keys atom (reactive UI update)
            clearWalletKeysExternal();
            console.log('✅ Cleared wallet keys atom');

            // ✅ Step 3: Clear profile to reset balances UI

            console.log('✅ Cleared profile');

            // ✅ Step 4: Clear backend tokens
            await auth.clearTokens();

            // ✅ Step 5: Call Privy logout
            await logout();
            await clearProfile();
            console.log('✅ Logout completed successfully');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const formatAddress = (addr: string) => {
        if (!addr) return "";
        return `${addr.slice(0, 4)}....${addr.slice(-4)}`;
    };

    const userAddress = user?.wallet?.address;

    if (authenticated && userAddress) {
        return (
            <div className="flex items-center space-x-3">
                {/* Wallet Address Display - Click to toggle sidebar */}
                <button
                    onClick={onToggleSidebar}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                >
                    <Wallet size={16} className="text-gray-400" />
                    <span className="text-sm text-white font-medium">{formatAddress(userAddress)}</span>
                </button>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors flex items-center space-x-2 text-gray-300 hover:text-white"
                >
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleClick}
            className={`px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors ${className}`}
        >
            Connect Wallet
        </button>
    );
};

export default ConnectButton;
