"use client";
import {useState, useEffect, useRef} from 'react';
import ConnectButton from './ConnectButton';
import DepositModal from './DepositModal';
import {useUserProfile} from '@/hooks/useUserProfile';
import {useProof} from '@/hooks/useProof';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Image from 'next/image';
import { getAllKeys } from '@/lib/ethers-signer';
import { usePrivy } from '@privy-io/react-auth';

interface HeaderProps {
    onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps = {}) => {
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const pathname = usePathname();
    const hasAutoInitRef = useRef(false);

    const { authenticated } = usePrivy();
    const { initWalletClientSide } = useProof();
    const { profile } = useUserProfile();
    const keys = getAllKeys();

    useEffect(() => {
        const autoInitWallet = async () => {
            // Only run once per session (use sessionStorage to persist across page navigations)
            if (hasAutoInitRef.current) return;

            const hasAttempted = sessionStorage.getItem('zenigma_auto_init_attempted');
            if (hasAttempted === 'true') return;

            // Check conditions: authenticated + is_initialized + no keys in localStorage
            const currentKeys = getAllKeys();
            if (authenticated && profile?.is_initialized && !currentKeys.pk_root) {
                console.log('🔄 [Header] Auto-init wallet for returning user...');
                hasAutoInitRef.current = true;
                sessionStorage.setItem('zenigma_auto_init_attempted', 'true');
                await initWalletClientSide(true); // true = already initialized, skip API call
            }
        };

        autoInitWallet();
    }, [authenticated, profile?.is_initialized, initWalletClientSide]);

    useEffect(() => {
        if (!authenticated) {
            hasAutoInitRef.current = false;
            sessionStorage.removeItem('zenigma_auto_init_attempted');
        }
    }, [authenticated]);

    return (
        <header className="border-b border-gray-800 bg-black">
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center space-x-8">
                    <div className="relative group cursor-pointer">
                        <div className="relative">
                            <Image
                                src="/favicon.png"
                                alt="Logo"
                                width={17}
                                height={17}
                                priority
                            />
                        </div>
                    </div>

                    <nav className="flex items-center space-x-6">
                        <Link
                            href="/TradingDashboard/btc-usdc"
                            className={`font-medium transition-colors ${
                                pathname?.startsWith('/TradingDashboard')
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Trade
                        </Link>
                        <Link
                            href="/assets"
                            className={`font-medium transition-colors ${
                                pathname?.startsWith('/assets')
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Assets
                        </Link>
                        <Link
                            href="/orders"
                            className={`font-medium transition-colors ${
                                pathname?.startsWith('/orders')
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Orders
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Deposit Button - only show when wallet is initialized */}
                    {profile?.is_initialized && keys?.pk_root && (
                        <button
                            onClick={() => setIsDepositModalOpen(true)}
                            className="px-4 py-2 bg-black border border-white text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
                        >
                            Deposit
                        </button>
                    )}

                    <ConnectButton
                        onLoginSuccess={() => {}}
                        onToggleSidebar={onToggleSidebar}
                    />
                    {/*<button onClick={myTest}>*/}
                    {/*    test*/}
                    {/*</button>*/}
                </div>
            </div>

            {/* Deposit Modal */}
            <DepositModal
                isOpen={isDepositModalOpen}
                onClose={() => setIsDepositModalOpen(false)}
            />
        </header>
    );
};

export default Header;
