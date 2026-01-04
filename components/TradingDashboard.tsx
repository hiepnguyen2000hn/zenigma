'use client';
import { useState, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { tradingPairAtom } from '@/store/trading';
import Header from './Header';
import Sidebar from './Sidebar';
import Chart from './Chart';
import OrderPanel from './OrderPanel';
import PortfolioSidebar from './PortfolioSidebar';
import ProfileLoader from './ProfileLoader';
import { motion } from 'framer-motion';

interface TradingDashboardProps {
    pair?: string;
}

const TradingDashboard = ({ pair = 'btc-usdt' }: TradingDashboardProps) => {
    const [selectedCrypto, setSelectedCrypto] = useState('BTC');
    const [selectedPair, setSelectedPair] = useState(pair);
    const setTradingPair = useSetAtom(tradingPairAtom);

    // Sidebar state - Default: OPEN (tạm thời)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
                        <OrderPanel />
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
