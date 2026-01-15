"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSetAtom } from "jotai";
import { updateTradingPairAtom } from "@/store/trading";
import { useTokens } from "@/hooks/useTokens";
import { type Token } from "@/lib/services";

interface TokenSelectorProps {
  selectedToken: string;
  onSelectToken: (token: string) => void;
  className?: string;
}

// Icon/Color mapping for tokens (fallback for display when CDN fails)
const TOKEN_DISPLAY: Record<string, { icon: string; color: string }> = {
  WBTC: { icon: "🟠", color: "text-orange-500" },
  BTC: { icon: "🟠", color: "text-orange-500" },
  ETH: { icon: "💎", color: "text-blue-500" },
  USDC: { icon: "💵", color: "text-blue-500" },
  USDT: { icon: "💚", color: "text-green-500" },
  BNB: { icon: "🟡", color: "text-yellow-500" },
  SOL: { icon: "🌐", color: "text-purple-500" },
  MATIC: { icon: "🔮", color: "text-purple-500" },
  AVAX: { icon: "🔺", color: "text-red-500" },
  LINK: { icon: "🔗", color: "text-blue-500" },
  UNI: { icon: "🦄", color: "text-pink-500" },
};

const getTokenDisplay = (symbol: string) => {
  return TOKEN_DISPLAY[symbol] || { icon: "💰", color: "text-gray-400" };
};

/**
 * Get token icon URL from CoinCap CDN
 * Uses symbol (not address) - simpler and more reliable
 * Falls back to emoji if CDN fails
 */
const getTokenIconUrl = (symbol: string) => {
  if (!symbol) return null;
  // CoinCap CDN: https://assets.coincap.io/assets/icons/{symbol}@2x.png
  // @2x = Retina resolution (high quality)
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
};

/**
 * TokenIcon component with CDN fallback to emoji
 * Exported for reuse in other components
 */
export interface TokenIconProps {
  token: Token;
  size?: "sm" | "md" | "lg";
}

/**
 * Simple token icon by symbol only (for cases without full Token object)
 */
export const TokenIconBySymbol = ({ symbol, size = "sm" }: { symbol: string; size?: "sm" | "md" | "lg" }) => {
  const [imageError, setImageError] = useState(false);
  const display = getTokenDisplay(symbol);
  const iconUrl = getTokenIconUrl(symbol);

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const emojiSizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl",
  };

  // If no icon URL or image failed to load, show emoji
  if (!iconUrl || imageError) {
    return <span className={`${emojiSizes[size]} ${display.color}`}>{display.icon}</span>;
  }

  return (
    <img
      src={iconUrl}
      alt={symbol}
      className={`${sizeClasses[size]} rounded-full object-cover inline-block`}
      loading="lazy"
      decoding="async"
      onError={() => setImageError(true)}
    />
  );
};

export const TokenIcon = ({ token, size = "md" }: TokenIconProps) => {
  const [imageError, setImageError] = useState(false);
  const display = getTokenDisplay(token.symbol);
  const iconUrl = getTokenIconUrl(token.symbol); // ✅ Dùng symbol thay vì address

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const emojiSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
  };

  // If no icon URL or image failed to load, show emoji
  if (!iconUrl || imageError) {
    return <span className={`${emojiSizes[size]} ${display.color}`}>{display.icon}</span>;
  }

  return (
    <img
      src={iconUrl}
      alt={token.symbol}
      className={`${sizeClasses[size]} rounded-full object-cover`}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        console.error(`❌ [CoinCap CDN Failed] ${token.symbol}:`, iconUrl);
        setImageError(true);
      }}
      onLoad={() => {

      }}
    />
  );
};

const TokenSelector = ({ selectedToken, onSelectToken, className = "" }: TokenSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();
  const updateTradingPair = useSetAtom(updateTradingPairAtom);

  // ✅ Fetch tokens from API with cache
  const { tokens, isLoading } = useTokens();

  // ✅ Auto-detect token from URL (e.g., /TradingDashboard/btc-usdc -> BTC)
  const getTokenFromUrl = (): string | null => {
    if (!pathname) return null;

    // Match pattern: /TradingDashboard/btc-usdc or /TradingDashboard/[pair]
    const match = pathname.match(/\/TradingDashboard\/([^\/]+)/);
    if (!match) return null;

    const pair = match[1]; // e.g., "btc-usdc"
    const [baseToken] = pair.split('-'); // e.g., "btc"

    return baseToken ? baseToken.toUpperCase() : null;
  };

  // ✅ Priority: URL token > selectedToken prop
  const urlToken = getTokenFromUrl();
  const effectiveToken = urlToken || selectedToken;
  const selected = tokens.find((t) => t.symbol === effectiveToken) || tokens[0];

  // ✅ Auto-update parent when URL changes (sync URL -> state)
  useEffect(() => {
    if (urlToken && urlToken !== selectedToken) {
      onSelectToken(urlToken);
    }
  }, [urlToken, selectedToken, onSelectToken]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectToken = (token: Token) => {
    // ✅ Update parent state
    onSelectToken(token.symbol);

    // ✅ Update URL and store if we're on TradingDashboard page
    if (pathname && pathname.includes('/TradingDashboard/')) {
      const match = pathname.match(/\/TradingDashboard\/([^\/]+)/);
      if (match) {
        const currentPair = match[1]; // e.g., "btc-usdc"
        const [_, quoteToken] = currentPair.split('-'); // Get quote token (e.g., "usdc")

        // Build new pair
        const newPairSymbol = `${token.symbol.toLowerCase()}-${quoteToken || 'usdc'}`;
        const newUrl = `/TradingDashboard/${newPairSymbol}`;


        // ✅ Update store (triggers Chart re-render)
        updateTradingPair({
          base: token.symbol.toUpperCase(),
          quote: (quoteToken || 'usdc').toUpperCase(),
          symbol: newPairSymbol,
        });

        // ✅ Update URL without reload page
        window.history.pushState({}, '', newUrl);
      }
    }

    setIsOpen(false);
    setSearchQuery("");
  };

  // Show loading state
  if (isLoading) {
    return (
      <button
        disabled
        className={`px-6 py-3 border border-gray-700 rounded-lg font-medium flex items-center space-x-2 opacity-50 ${className}`}
      >
        <span className="text-gray-400">⏳</span>
        <span>Loading...</span>
      </button>
    );
  }

  return (
    <>
      {/* Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`px-6 py-3 border border-gray-700 rounded-lg font-medium flex items-center space-x-2 hover:border-gray-600 transition-colors ${className}`}
      >
        {selected && <TokenIcon token={selected} size="sm" />}
        <span>{selected?.symbol || 'Select'}</span>
        <span className="text-gray-400">▼</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl z-50 border border-gray-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold text-white">Select Token</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Search */}
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search token..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              {/* Token List */}
              <div className="max-h-96 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent hover:scrollbar-thumb-gray-600">
                {filteredTokens.length > 0 ? (
                  <motion.div layout className="space-y-1">
                    {filteredTokens.map((token) => {
                      return (
                        <motion.button
                          key={token.index}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.05)" }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectToken(token)}
                          className={`w-full flex items-center space-x-4 p-4 rounded-lg transition-colors ${
                            token.symbol === effectiveToken
                              ? "bg-white/10 border border-white/20"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <TokenIcon token={token} size="lg" />
                          <div className="flex-1 text-left">
                            <div className="font-medium text-white">{token.symbol}</div>
                            <div className="text-sm text-gray-400">{token.name}</div>
                          </div>
                          {token.symbol === effectiveToken && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 bg-green-500 rounded-full"
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No tokens found
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default TokenSelector;
