"use client";

import { useAtomValue } from "jotai";
import { tradingPairAtom, orderInputAtom, canPlaceOrderAtom, balancesAtom } from "@/store/trading";
import { usePrivy, useFundWallet, useWallets } from "@privy-io/react-auth";
import { getWalletAddressByConnectorType } from "@/lib/wallet-utils";
import { ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { useState } from "react";

interface TradeButtonProps {
    className?: string;
    onClick?: () => void;
}

const TradeButton = ({ className = "", onClick }: TradeButtonProps) => {
    const pair = useAtomValue(tradingPairAtom);
    const orderInput = useAtomValue(orderInputAtom);
    const canPlaceOrder = useAtomValue(canPlaceOrderAtom);
    const balances = useAtomValue(balancesAtom);
    const { fundWallet } = useFundWallet();
    const { user } = usePrivy();
    const { wallets } = useWallets();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleClick = async () => {
        if (!canPlaceOrder) return;

        setIsProcessing(true);
        try {
            // Get embedded wallet address
            const walletAddress = getWalletAddressByConnectorType(wallets, 'embedded', user);

            if (!walletAddress) {
                console.error("No embedded wallet address found");
                setIsProcessing(false);
                return;
            }

            // Get balance của token cần check
            // Nếu BUY -> cần check USDT/quote balance
            // Nếu SELL -> cần check BTC/base balance
            let tokenToCheck = orderInput.side === 'buy' ? pair.quote : pair.base;

            // Map USDT → USDC (vì testnet chỉ có USDC, cả 2 đều là stablecoin)
            if (tokenToCheck === 'USDT') {
                tokenToCheck = 'USDC';
                console.log('⚠️ Mapped USDT → USDC (testnet only has USDC)');
            }

            const balanceObj = balances.find((b) => b.token === tokenToCheck);
            const balance = balanceObj?.balance || 0;

            console.log('💰 Balance Check:', {
                side: orderInput.side,
                originalToken: orderInput.side === 'buy' ? pair.quote : pair.base,
                mappedToken: tokenToCheck,
                balance,
                allBalances: balances,
            });

            // Check balance - nếu = 0 thì mở popup fund wallet
            if (balance === 0) {
                console.log(`❌ Balance của ${tokenToCheck} = 0, opening fund wallet popup...`);
                await fundWallet({ address: walletAddress });
                setIsProcessing(false);
                return;
            } else {
                console.log(`✅ Balance sufficient: ${balance} ${tokenToCheck}`);
            }

            if (onClick) {
                await onClick();
            }

            // Add your trade execution logic here
            console.log("Executing trade:", {
                side: orderInput.side,
                amount: orderInput.amount,
                pair: pair.symbol,
                balance,
                tokenToCheck,
            });
        } catch (error) {
            console.error("Trade error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const isBuy = orderInput.side === "buy";
    const baseToken = pair.base;

    // Button text based on state
    const getButtonText = () => {
        if (isProcessing) return "Processing...";
        if (!canPlaceOrder) {
            if (!orderInput.amount || parseFloat(orderInput.amount) <= 0) {
                return `Enter Amount`;
            }
            return "Insufficient Balance";
        }
        return isBuy ? `Buy ${baseToken}` : `Sell ${baseToken}`;
    };

    // Icon based on side
    const Icon = isProcessing ? Loader2 : isBuy ? ArrowUpRight : ArrowDownRight;

    return (
        <button
            onClick={handleClick}
            disabled={!canPlaceOrder || isProcessing}
            className={`
                flex items-center justify-center space-x-2
                font-medium rounded-lg transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isBuy
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }
                ${className}
            `}
        >
            <Icon
                size={18}
                className={isProcessing ? "animate-spin" : ""}
            />
            <span>{getButtonText()}</span>
        </button>
    );
};

export default TradeButton;
