"use client";

import { HelpCircle } from 'lucide-react';
import { useState } from 'react';
import ConnectButton from './ConnectButton';
import ChainSelector from './ChainSelector';
import TokenDisplay from './TokenDisplay';
import ProofTestModal from './ProofTestModal';

const Header = () => {
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);

    const exchanges = [
        { name: 'BBQ Feeds', price: '' },
        { name: 'Binance', price: '$106,061.84', status: 'LIVE' },
        { name: 'Coinbase', price: '$106,171.61', status: 'LIVE' },
        { name: 'Kraken', price: '$106,149.95', status: 'LIVE' },
        { name: 'OKX', price: '$0.00', status: 'LIVE' },
    ];

    return (
        <header className="border-b border-gray-800 bg-black">
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center space-x-8">
                    <div className="text-2xl font-bold">R</div>

                    <nav className="flex items-center space-x-6">
                        <a href="#" className="text-white font-medium">Trade</a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors">Assets</a>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors">Orders</a>
                        {/*<a href="#" className="text-gray-400 hover:text-white transition-colors">Stats</a>*/}
                        {/*<a href="#" className="text-gray-400 hover:text-white transition-colors">TCA</a>*/}
                    </nav>
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setIsProofModalOpen(true)}
                        className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                        title="Test Wallet Proof API"
                    >
                        {/*<Flask size={16} />*/}
                        <span>Test Proof API</span>
                    </button>
                    <ChainSelector />
                    <ConnectButton />
                </div>
            </div>

            <div className="flex items-center space-x-8 px-6 py-2 overflow-x-auto">
                {exchanges.map((exchange, index) => (
                    <div key={index} className="flex items-center space-x-2 whitespace-nowrap">
                        <span className="text-gray-400 text-sm">{exchange.name}</span>
                        {exchange.price && (
                            <>
                                <span className="text-green-500 text-sm font-medium">{exchange.price}</span>
                                <span className="text-green-500 text-xs">{exchange.status}</span>
                            </>
                        )}
                        {index < exchanges.length - 1 && <span className="text-gray-700">•</span>}
                    </div>
                ))}
            </div>

            {/* Proof Test Modal */}
            <ProofTestModal
                isOpen={isProofModalOpen}
                onClose={() => setIsProofModalOpen(false)}
            />
        </header>
    );
};

export default Header;
