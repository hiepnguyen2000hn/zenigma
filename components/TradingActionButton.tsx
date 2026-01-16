"use client";

import { useAtomValue } from "jotai";
import { tradingPairAtom, orderInputAtom, balancesAtom } from "@/store/trading";
import { usePrivy, useFundWallet, useWallets } from "@privy-io/react-auth";
import { getWalletAddressByConnectorType } from "@/lib/wallet-utils";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface TradingActionButtonProps {
    className?: string;
    onClick?: () => void;
}

const TradingActionButton = ({ className = "", onClick }: TradingActionButtonProps) => {
    const pair = useAtomValue(tradingPairAtom);
    const orderInput = useAtomValue(orderInputAtom);
    const balances = useAtomValue(balancesAtom);
    const { fundWallet } = useFundWallet();
    const { wallets } = useWallets();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleClick = async () => {
        setIsProcessing(true);
        try {
            // Get embedded wallet address
            const walletAddress = getWalletAddressByConnectorType(wallets, 'embedded');
            console.log('test11111111111111',walletAddress)
            if (!walletAddress) {
                console.error("No embedded wallet address found");
                setIsProcessing(false);
                return;
            }

            // Check USDC balance - chỉ cần USDC > 0 là pass
            const usdcBalance = balances.find((b) => b.token === 'USDC')?.balance || 0;

            console.log('💰 USDC Balance:', usdcBalance);

            // Nếu USDC = 0 → mở popup fund wallet
            if (usdcBalance === 0) {
                console.log('❌ USDC balance = 0, opening fund wallet popup...');
                await fundWallet({
                    address: walletAddress
                });
                setIsProcessing(false);
                return;
            }

            console.log('✅ USDC balance > 0, proceeding with trade');

            // Nếu có callback từ parent, gọi callback
            if (onClick) {
                await onClick();
            }

            // Add your trade logic here
            console.log("Execute trade:", {
                side: orderInput.side,
                pair: pair.symbol,
                amount: orderInput.amount,
                usdcBalance,
            });

            // TODO: Implement actual trade execution
            // Example: call smart contract, call API, generate proof, etc.
        } catch (error) {
            console.error("Error in trade action:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const action = orderInput.side === 'buy' ? 'Buy' : 'Sell';
    const isBuy = orderInput.side === 'buy';

    return (
        <button
            onClick={handleClick}
            disabled={isProcessing}
            className={`rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${
                isBuy
                    ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/30'
                    : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
            } ${className}`}
        >
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{action} {pair.base}</span>
        </button>
    );
};

export default TradingActionButton;
