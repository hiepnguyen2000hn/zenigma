"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserBalance } from '@/hooks/useUserBalance';
import { useTokens } from '@/hooks/useTokens';
import { useZenigmaAddress } from '@/hooks/useWalletKeys';
import { clearWalletKeysExternal } from '@/store/walletKeys';
import { useProof } from '@/hooks/useProof';
import { extractPrivyWalletId, getWalletAddressByConnectorType } from '@/lib/wallet-utils';
import { getAvailableERC20Tokens } from '@/lib/constants';
import { TokenIconBySymbol } from './TokenSelector';
import DepositModal from './DepositModal';
import { X, ChevronRight, ChevronUp, ChevronDown, Copy, ExternalLink, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import * as Popover from '@radix-ui/react-popover';
import Image from 'next/image';

/**
 * Portfolio Sidebar Component - Full Height
 *
 * Displays:
 * - Token list with balances
 * - Deposit button
 * - Fixed position, full height from top
 */
interface PortfolioSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const PortfolioSidebar = ({ isOpen, onClose }: PortfolioSidebarProps) => {
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [shouldInitZenigma, setShouldInitZenigma] = useState(false);
    const router = useRouter();

    // Get Privy wallet address and logout
    const { user, logout } = usePrivy();
    const { wallets } = useWallets();
    const privyWalletAddress = getWalletAddressByConnectorType(wallets, 'embedded', user);

    // Get pk_root (Zenigma wallet address) - reactive via Jotai atom
    const zenigmaAddress = useZenigmaAddress();

    // Get user profile data (for is_initialized check)
    const { profile, loading: profileLoading, fetchProfile, clearProfile } = useUserProfile();
    // Get user balance from API
    const { balance: userBalance, loading: balanceLoading, fetchBalance } = useUserBalance();

    // Get initWalletClientSide from useProof hook
    const { initWalletClientSide } = useProof();

    // Fetch balance if not already loaded
    useEffect(() => {
        if (!user?.id || userBalance) return;
        const walletId = extractPrivyWalletId(user.id);
        fetchBalance(walletId);
    }, [user?.id, userBalance, fetchBalance]);

    // Privy login hook
    const { login } = useLogin({
        onComplete: async () => {
            console.log('✅ [PortfolioSidebar] Privy login completed');

            // If Zenigma wallet init was pending, trigger it now
            if (shouldInitZenigma) {
                console.log('🔐 [PortfolioSidebar] Auto-triggering Zenigma init after Privy login...');
                setShouldInitZenigma(false);
                await handleZenigmaInit();
            }
        },
        onError: (error) => {
            console.error('❌ [PortfolioSidebar] Login error:', error);
            toast.error('Login failed');
            setShouldInitZenigma(false);
        },
    });

    // Helper function to format address
    const formatAddress = (addr: string) => {
        if (!addr) return "";
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    // Copy address to clipboard
    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address);
        toast.success('Address copied!');
    };

    // View on explorer
    const handleViewExplorer = (address: string, type: 'zenigma' | 'sepolia') => {
        const explorerUrl = type === 'sepolia'
            ? `https://sepolia.etherscan.io/address/${address}`
            : `https://sepolia.etherscan.io/address/${address}`;
        window.open(explorerUrl, '_blank');
    };

    // Handle actual Zenigma initialization (called after Privy is connected)
    const handleZenigmaInit = async () => {
        try {
            console.log('🔐 [PortfolioSidebar] Initializing Zenigma wallet...');
            const success = await initWalletClientSide(profile?.is_initialized);
            if (success && user?.id) {
                const walletId = extractPrivyWalletId(user.id);
                await fetchProfile(walletId);
                toast.success('Your wallet initialization is queued, please allow a few minutes for it to sync');
            }
        } catch (error) {
            console.error('❌ [PortfolioSidebar] Zenigma init error:', error);
            toast.error('Failed to initialize Zenigma wallet');
        }
    };

    // Handle Zenigma wallet button click
    const handleZenigmaConnect = async () => {
        if (zenigmaAddress) return; // Already connected

        // Step 1: Check if Privy is connected
        if (!privyWalletAddress) {
            console.log('🔐 [PortfolioSidebar] Privy not connected, triggering login first...');
            setShouldInitZenigma(true); // Flag to init Zenigma after login
            login();
            return;
        }

        // Step 2: If Privy already connected, directly init Zenigma
        await handleZenigmaInit();
    };

    // Handle Sepolia wallet connection (Privy login)
    const handleSepoliaConnect = () => {
        if (privyWalletAddress) return; // Already connected

        console.log('🔐 [PortfolioSidebar] Triggering Privy login...');
        login();
    };

    // Handle Zenigma wallet disconnect (clear localStorage keys + store)
    const handleZenigmaDisconnect = () => {
        try {
            console.log('🔌 [PortfolioSidebar] Disconnecting Zenigma wallet...');

            // Step 1: Remove all wallet keys from localStorage
            localStorage.removeItem('sk_root');
            localStorage.removeItem('pk_root');
            localStorage.removeItem('pk_match');
            localStorage.removeItem('sk_match');

            // Step 2: Clear walletKeysAtom store
            // This will trigger UI update via useZenigmaAddress hook
            clearWalletKeysExternal();

            // Step 3: Clear profile to reset balances UI
            clearProfile();

            console.log('✅ [PortfolioSidebar] Zenigma wallet disconnected (localStorage + store cleared)');
            toast.success('Zenigma wallet disconnected');

            // No need to reload - UI updates automatically via Jotai atom!
        } catch (error) {
            console.error('❌ [PortfolioSidebar] Error disconnecting Zenigma:', error);
            toast.error('Failed to disconnect Zenigma wallet');
        }
    };

    // Handle Sepolia wallet disconnect (Privy logout)
    const handleSepoliaDisconnect = async () => {
        try {
            console.log('🔌 [PortfolioSidebar] Disconnecting Sepolia wallet (Privy logout)...');
            await logout();

            // Clear profile to reset balances UI
            clearProfile();

            console.log('✅ [PortfolioSidebar] Sepolia wallet disconnected');
            toast.success('Sepolia wallet disconnected');
        } catch (error) {
            console.error('❌ [PortfolioSidebar] Error disconnecting Sepolia:', error);
            toast.error('Failed to disconnect Sepolia wallet');
        }
    };

    // Get all tokens from API
    const { tokens: apiTokens, isLoading: tokensLoading } = useTokens();

    // Get ERC20 tokens config for icons
    const erc20TokensConfig = getAvailableERC20Tokens();

    // Combine token data with balances from useUserBalance
    const tokenBalances = useMemo(() => {
        if (!apiTokens || apiTokens.length === 0) return [];

        return apiTokens.map((token) => {
            const tokenBalance = userBalance?.balances?.find(
                b => b.token_index === token.index
            );
            const balance = tokenBalance?.available || '0';

            // Get icon from ERC20_TOKENS config
            const tokenConfig = erc20TokensConfig.find(t => t.symbol === token.symbol);

            return {
                ...token,
                balance,
                icon: tokenConfig?.icon,
            };
        });
    }, [userBalance, apiTokens, erc20TokensConfig]);

    // Calculate total portfolio value (assume 1:1 USD for stablecoins)
    const totalPortfolioValue = useMemo(() => {
        if (!tokenBalances || tokenBalances.length === 0) return 0;

        return tokenBalances.reduce((total, token) => {
            const balance = parseFloat(token.balance);
            // For demo, assume all tokens are worth $1 each
            // In production, multiply by token price
            return total + balance;
        }, 0);
    }, [tokenBalances]);

    const isLoading = profileLoading || balanceLoading || tokensLoading;

    return (
        <>
            {/* Sidebar - Push Layout with framer-motion */}
            <motion.aside
                initial={false}
                animate={{
                    width: isOpen ? 280 : 0, // 280px - Compact portfolio
                    borderLeftWidth: isOpen ? 1 : 0,
                }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    mass: 0.8,
                }}
                className="bg-black border-l border-gray-800 flex flex-col flex-shrink-0 overflow-hidden"
            >
                {/* Inner wrapper to maintain width */}
                <div className="w-[280px] flex flex-col h-full">
                    {/* Wallet Cards Section */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isOpen ? 1 : 0 }}
                        transition={{ delay: isOpen ? 0.1 : 0 }}
                        className="p-3 space-y-2"
                    >
                        {/* Zenigma Wallet Card */}
                        <Popover.Root>
                            <Popover.Trigger asChild disabled={!zenigmaAddress}>
                                <div
                                    onClick={!zenigmaAddress ? handleZenigmaConnect : undefined}
                                    className={`flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 transition-colors ${
                                        zenigmaAddress
                                            ? 'hover:border-gray-700 cursor-pointer data-[state=open]:border-gray-600'
                                            : 'cursor-pointer hover:border-blue-500/50 hover:bg-gray-900/70'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center border border-dashed border-gray-600 overflow-hidden">
                                            {zenigmaAddress ? (
                                                <Image
                                                    src="/favicon.png"
                                                    alt="Zenigma"
                                                    width={13}
                                                    height={13}
                                                />
                                            ) : (
                                                <Plus size={18} className="text-gray-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm">
                                                {zenigmaAddress ? 'Zenigma Wallet' : 'Sign in to Zenigma'}
                                            </div>
                                            {zenigmaAddress && user?.id && (
                                                <div className="text-gray-500 text-xs">
                                                    {formatAddress(extractPrivyWalletId(user.id))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {zenigmaAddress && (
                                        <div className="flex flex-col text-gray-500">
                                            <ChevronUp size={14} />
                                            <ChevronDown size={14} className="-mt-1" />
                                        </div>
                                    )}
                                </div>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content
                                    side="left"
                                    sideOffset={8}
                                    className="w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[9999] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                                >
                                    {zenigmaAddress && user?.id && (
                                        <>
                                            {/* Wallet ID */}
                                            <div className="p-3 border-b border-gray-800">
                                                <div className="text-gray-400 text-xs font-mono break-all">
                                                    {extractPrivyWalletId(user.id)}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="py-1">
                                                <Popover.Close asChild>
                                                    <button
                                                        onClick={handleZenigmaDisconnect}
                                                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-red-900/20 hover:text-red-400 transition-colors outline-none"
                                                    >
                                                        <X size={16} className="text-gray-400" />
                                                        <span className="text-white text-sm">Disconnect</span>
                                                    </button>
                                                </Popover.Close>
                                            </div>
                                        </>
                                    )}
                                    <Popover.Arrow className="fill-gray-700" />
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>

                        {/* Sepolia Wallet Card */}
                        <Popover.Root>
                            <Popover.Trigger asChild disabled={!privyWalletAddress}>
                                <div
                                    onClick={!privyWalletAddress ? handleSepoliaConnect : undefined}
                                    className={`flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 transition-colors ${
                                        privyWalletAddress
                                            ? 'hover:border-gray-700 cursor-pointer data-[state=open]:border-gray-600'
                                            : 'cursor-pointer hover:border-blue-500/50 hover:bg-gray-900/70'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="w-9 h-9 rounded-lg bg-[#213147] flex items-center justify-center overflow-hidden border border-dashed border-gray-600">
                                            {privyWalletAddress ? (
                                                <Image
                                                    src="/sepolia.png"
                                                    alt="Zenigma"
                                                    width={30}
                                                    height={30}
                                                />
                                            ) : (
                                                <Plus size={18} className="text-gray-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm">
                                                {privyWalletAddress ? 'Sepolia Wallet' : 'Connect Wallet'}
                                            </div>
                                            {privyWalletAddress && (
                                                <div className="text-gray-500 text-xs">
                                                    {formatAddress(privyWalletAddress)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {privyWalletAddress && (
                                        <div className="flex flex-col text-gray-500">
                                            <ChevronUp size={14} />
                                            <ChevronDown size={14} className="-mt-1" />
                                        </div>
                                    )}
                                </div>
                            </Popover.Trigger>
                            <Popover.Portal>
                                <Popover.Content
                                    side="left"
                                    sideOffset={8}
                                    className="w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[9999] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                                >
                                    {privyWalletAddress && (
                                        <>
                                            {/* Full Address */}
                                            <div className="p-3 border-b border-gray-800">
                                                <div className="text-gray-400 text-xs font-mono break-all">
                                                    {privyWalletAddress}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="py-1">
                                                <Popover.Close asChild>
                                                    <button
                                                        onClick={() => handleCopyAddress(privyWalletAddress)}
                                                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-gray-800 transition-colors outline-none"
                                                    >
                                                        <Copy size={16} className="text-gray-400" />
                                                        <span className="text-white text-sm">Copy Address</span>
                                                    </button>
                                                </Popover.Close>
                                                <Popover.Close asChild>
                                                    <button
                                                        onClick={() => handleViewExplorer(privyWalletAddress, 'sepolia')}
                                                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-gray-800 transition-colors outline-none"
                                                    >
                                                        <ExternalLink size={16} className="text-gray-400" />
                                                        <span className="text-white text-sm">View on Explorer</span>
                                                    </button>
                                                </Popover.Close>
                                                <Popover.Close asChild>
                                                    <button
                                                        onClick={handleSepoliaDisconnect}
                                                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-red-900/20 hover:text-red-400 transition-colors outline-none"
                                                    >
                                                        <X size={16} className="text-gray-400" />
                                                        <span className="text-white text-sm">Disconnect</span>
                                                    </button>
                                                </Popover.Close>
                                            </div>
                                        </>
                                    )}
                                    <Popover.Arrow className="fill-gray-700" />
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>
                    </motion.div>

                    {/* Assets Header */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isOpen ? 1 : 0 }}
                        transition={{ delay: isOpen ? 0.15 : 0 }}
                        className="flex items-center justify-between px-3 py-2"
                    >
                        <h2 className="text-base font-semibold text-white">Assets</h2>
                        <div
                            onClick={() => router.push("/assets")}   // ← route bạn muốn
                            className="flex items-center space-x-1 text-white cursor-pointer hover:text-gray-300 transition-colors"
                        >
                            <span className="text-sm font-medium">
                                ${totalPortfolioValue.toFixed(2)}
                            </span>
                            <ChevronRight size={16} />
                        </div>
                    </motion.div>

                    {/* Token List - No Scroll */}
                    <div className="flex-1 overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isOpen ? 1 : 0 }}
                            transition={{ delay: isOpen ? 0.2 : 0 }}
                            className="px-3 space-y-1.5"
                        >
                            {isLoading ? (
                            // Loading skeleton - Compact
                            <>
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : 20 }}
                                        transition={{ delay: isOpen ? 0.05 * i : 0 }}
                                        className="p-2 bg-gray-900/50 rounded-lg animate-pulse"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-7 h-7 bg-gray-800 rounded-full"></div>
                                                <div className="h-3 w-10 bg-gray-800 rounded"></div>
                                            </div>
                                            <div className="h-3 w-12 bg-gray-800 rounded"></div>
                                        </div>
                                    </motion.div>
                                ))}
                            </>
                        ) : tokenBalances.length === 0 ? (
                            // Empty state
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: isOpen ? 1 : 0, scale: isOpen ? 1 : 0.9 }}
                                transition={{ delay: isOpen ? 0.2 : 0 }}
                                className="text-center py-12 text-gray-500"
                            >
                                <div className="text-4xl mb-4">💳</div>
                                <div className="text-sm">No tokens found</div>
                                <div className="text-xs mt-2">Deposit tokens to get started</div>
                            </motion.div>
                        ) : (
                            // Token list - Compact design without scroll
                            tokenBalances.map((token, index) => {
                                const balance = parseFloat(token.balance);
                                const hasBalance = balance > 0;

                                return (
                                    <motion.div
                                        key={token.symbol}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : 20 }}
                                        transition={{
                                            delay: isOpen ? 0.1 + (index * 0.05) : 0,
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 25,
                                        }}
                                        className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                                            hasBalance
                                                ? 'bg-gray-900/50 border-gray-800 hover:bg-gray-800/80 hover:border-teal-500/60 hover:scale-[1.02] hover:translate-x-1 hover:shadow-lg hover:shadow-teal-500/10'
                                                : 'bg-gray-900/20 border-gray-800/50 opacity-50 hover:opacity-70 hover:bg-gray-900/30'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            {/* Token Info */}
                                            <div className="flex items-center space-x-1.5">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center">
                                                    <TokenIconBySymbol symbol={token.symbol} size="sm" />
                                                </div>
                                                <div>
                                                    <div className="text-white font-semibold text-[11px]">
                                                        {token.symbol}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Balance */}
                                            <div className="text-right">
                                                <div className={`font-semibold text-[11px] ${hasBalance ? 'text-white' : 'text-gray-600'}`}>
                                                    {token.balance}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                            )}
                        </motion.div>
                    </div>

                </div>
            </motion.aside>
        </>
    );
};

export default PortfolioSidebar;
