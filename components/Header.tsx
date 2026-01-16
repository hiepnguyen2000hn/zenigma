"use client";
import {useState, useEffect} from 'react';
import ConnectButton from './ConnectButton';
import DepositModal from './DepositModal';
import {getAllTokens} from "@/lib/services";
import {useProof} from '@/hooks/useProof';
import {useUserProfile} from '@/hooks/useUserProfile';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Image from 'next/image';
import { getAllKeys } from '@/lib/ethers-signer';
interface HeaderProps {
    onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps = {}) => {
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const pathname = usePathname();

    // ✅ Use initWalletClientSide from useProof hook
    const { initWalletClientSide, isInitializing, initStep } = useProof();
    const { profile } = useUserProfile();
    const keys = getAllKeys()
    const fetchTokens = async () => {
        const response = await getAllTokens()

    }

    const hdlGenWallet = async() => {
        const keys = getAllKeys()
        console.log(profile, 'profile11111111111111111', keys)
        if(profile && profile.is_initialized && !keys.pk_root) {
            await initWalletClientSide()
        }
        return
    }

    useEffect(() => {
        fetchTokens()
    }, [])


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
