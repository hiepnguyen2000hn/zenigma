"use client";

import { useState, useMemo } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTokens } from '@/hooks/useTokens';
import { getAvailableERC20Tokens } from '@/lib/constants';
import { TokenIconBySymbol } from './TokenSelector';
import DepositModal from './DepositModal';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

    // Get user profile data (contains available_balances array)
    const { profile, loading: profileLoading } = useUserProfile();

    // Get all tokens from API
    const { tokens: apiTokens, isLoading: tokensLoading } = useTokens();

    // Get ERC20 tokens config for icons
    const erc20TokensConfig = getAvailableERC20Tokens();

    // Combine token data with balances
    const tokenBalances = useMemo(() => {
        if (!profile || !apiTokens || apiTokens.length === 0) return [];

        return apiTokens.map((token) => {
            // ✅ FIXED: Use token.index (tokenIndex from API) instead of array index
            const balance = profile.available_balances?.[token.index] || '0';

            // Get icon from ERC20_TOKENS config
            const tokenConfig = erc20TokensConfig.find(t => t.symbol === token.symbol);

            return {
                ...token,
                balance,
                icon: tokenConfig?.icon,
            };
        });
    }, [profile, apiTokens, erc20TokensConfig]);

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

    const isLoading = profileLoading || tokensLoading;

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
                    {/* Header with Close Button */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isOpen ? 1 : 0 }}
                        transition={{ delay: isOpen ? 0.1 : 0 }}
                        className="flex items-center justify-between p-3 border-b border-gray-800"
                    >
                        <h2 className="text-base font-semibold text-white">Assets</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <X size={18} className="text-gray-400" />
                        </button>
                    </motion.div>

                    {/* Token List - No Scroll */}
                    <div className="flex-1 overflow-hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isOpen ? 1 : 0 }}
                            transition={{ delay: isOpen ? 0.15 : 0 }}
                            className="p-3 space-y-1.5"
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
                                        className={`p-2 rounded-lg border transition-all duration-200 ${
                                            hasBalance
                                                ? 'bg-gray-900/50 border-gray-800 hover:border-teal-500/50'
                                                : 'bg-gray-900/20 border-gray-800/50 opacity-50'
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
