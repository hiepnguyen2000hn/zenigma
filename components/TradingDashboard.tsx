'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { tradingPairAtom } from '@/store/trading';
import { userProfileAtom } from '@/store/profile';
import { connectSSE, disconnectSSE } from '@/lib/sse.client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTokenMapping } from '@/hooks/useTokenMapping';
import Header from './Header';
import Sidebar from './Sidebar';
import Chart from './Chart';
import OrderPanel from './OrderPanel';
import PortfolioSidebar from './PortfolioSidebar';
import ProfileLoader from './ProfileLoader';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface TradingDashboardProps {
    pair?: string;
}

const TradingDashboard = ({ pair = 'btc-usdt' }: TradingDashboardProps) => {
    const [selectedCrypto, setSelectedCrypto] = useState('BTC');
    const [selectedPair, setSelectedPair] = useState(pair);
    const setTradingPair = useSetAtom(tradingPairAtom);

    // Get profile for walletId
    const profile = useAtomValue(userProfileAtom);
    const { fetchProfile } = useUserProfile();

    // Token mapping for SSE toast messages
    const { getSymbol } = useTokenMapping();

    // Sidebar state - Default: OPEN (tạm thời)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Order refetch trigger (incremented when SSE order:status event is received)
    const [orderRefetchTrigger, setOrderRefetchTrigger] = useState(0);

    // ============================================
    // SSE Message Handler
    // ============================================
    const handleSSEMessage = useCallback((event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            const eventType = data.type || data.event;

            console.log('[SSE] Received message:', eventType, data);

            switch (eventType) {
                case 'init:wallet':
                    console.log('[SSE] init:wallet:', data);
                    // Re-fetch profile to update store
                    if (profile?.wallet_id) {
                        fetchProfile(profile.wallet_id);
                    }
                    // Show toast for wallet init
                    toast.success('Wallet initialized successfully!');
                    break;

                case 'transfer:status': {
                    console.log('[SSE] transfer:status:', data);
                    // Re-fetch profile to update balances
                    if (profile?.wallet_id) {
                        fetchProfile(profile.wallet_id);
                    }
                    // Show toast based on transfer direction and status
                    const transferData = data.data || data;
                    if (transferData.status === 'completed') {
                        const tokenSymbol = getSymbol(transferData.token_index) || 'TOKEN';
                        const amount = transferData.amount || '0';
                        if (transferData.direction === 'DEPOSIT') {
                            toast.success(`Deposit successful: ${amount} ${tokenSymbol}`);
                        } else if (transferData.direction === 'WITHDRAW') {
                            toast.success(`Withdraw successful: ${amount} ${tokenSymbol}`);
                        }
                    }
                    break;
                }

                case 'order:status': {
                    console.log('[SSE] order:status:', data);
                    // Re-fetch profile to get updated orders_list
                    if (profile?.wallet_id) {
                        fetchProfile(profile.wallet_id);
                    }
                    // Trigger OrderPanel to refetch orders
                    setOrderRefetchTrigger(prev => prev + 1);
                    // Show toast based on order state
                    const orderData = data.data || data;
                    const tokenInSymbol = getSymbol(orderData.token_in) || 'TOKEN';
                    const side = orderData.side === 0 ? 'Buy' : 'Sell';
                    const qty = orderData.qty || '0';
                    const state = orderData.state;
                    if (state === 'Created') {
                        toast.success(`Order created: ${side} ${qty} ${tokenInSymbol}`);
                    } else if (state === 'Cancelled') {
                        toast.success(`Order cancelled: ${side} ${qty} ${tokenInSymbol}`);
                    } else if (state === 'Filled') {
                        toast.success(`Order filled: ${side} ${qty} ${tokenInSymbol}`);
                    }
                    break;
                }

                default:
                    console.log('[SSE] Unknown event type:', eventType, data);
            }
        } catch (error) {
            console.error('[SSE] Error parsing message:', error, event.data);
        }
    }, [profile?.wallet_id, fetchProfile, getSymbol]);

    // ============================================
    // SSE Connection Effect
    // ============================================
    useEffect(() => {
        if (!profile?.wallet_id) return;

        const walletId = profile.wallet_id;
        console.log('[SSE] Connecting with walletId:', walletId);

        const eventSource = connectSSE(walletId);

        if (eventSource) {
            // Use onmessage for all events
            eventSource.onmessage = handleSSEMessage;
        }

        // Cleanup on unmount or walletId change
        return () => {
            if (eventSource) {
                eventSource.onmessage = null;
            }
            disconnectSSE();
            console.log('[SSE] Disconnected on cleanup');
        };
    }, [profile?.wallet_id, handleSSEMessage]);

    // Update selectedPair when pair prop changes
    useEffect(() => {
        setSelectedPair(pair);
        // Extract crypto symbol from pair (e.g., 'btc-usdt' -> 'BTC')
        const [base, quote] = pair.split('-');
        const crypto = base.toUpperCase();
        setSelectedCrypto(crypto);

        // Update Jotai store
        setTradingPair({
            base: crypto,
            quote: quote.toUpperCase(),
            symbol: pair,
        });
    }, [pair, setTradingPair]);

    return (
        <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
            {/* Auto-load user profile when authenticated */}
            <ProfileLoader />

            {/* Header - Full width at top */}
            <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

            {/* Content Area - Below Header */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Trading Pairs */}
                <motion.div layout transition={{ layout: { type: "spring", stiffness: 300, damping: 30, mass: 0.8 } }}>
                    <Sidebar
                        selectedCrypto={selectedCrypto}
                        onCryptoChange={setSelectedCrypto}
                    />
                </motion.div>

                {/* Main Content - Chart & OrderPanel */}
                <motion.main
                    layout
                    transition={{
                        layout: {
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                            mass: 0.8,
                        }
                    }}
                    className="flex-1 flex flex-col overflow-hidden"
                >
                    {/* Chart - NO layout animation (lightweight-charts handles its own resize) */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Chart crypto={selectedCrypto} pair={selectedPair} />
                    </div>
                    <motion.div layout>
                        <OrderPanel refetchTrigger={orderRefetchTrigger} />
                    </motion.div>
                </motion.main>

                {/* Right Sidebar - Portfolio (Push Layout) */}
                <PortfolioSidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                />
            </div>
        </div>
    );
};

export default TradingDashboard;
