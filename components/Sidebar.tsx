'use client';

import { ArrowLeftRight, Lock } from 'lucide-react';
import ConnectButton from './ConnectButton';
import TradingActionButton from './TradingActionButton';
import TokenSelector, { TokenIconBySymbol } from './TokenSelector';
import DepositModal from './DepositModal';
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAtomValue, useSetAtom } from 'jotai';
import { orderInputAtom, toggleOrderSideAtom, tradingPairAtom, updateOrderAmountAtom, updateLimitPriceAtom } from '@/store/trading';
import { tokensAtom } from '@/store/tokens';
import { useState, useMemo } from 'react';
import { useProof, useWalletUpdateProof } from '@/hooks/useProof';
import { type OrderAction, type WalletState } from '@/hooks/useProof';
import {getAllKeys, signMessageWithSkRoot} from '@/lib/ethers-signer';
import { extractPrivyWalletId, getWalletAddressByConnectorType } from '@/lib/wallet-utils';
import { useUserProfile } from '@/hooks/useUserProfile';
import toast from 'react-hot-toast';
import { useChainId, useSwitchChain } from 'wagmi';
import { ensureSepoliaChain } from '@/lib/chain-utils';

interface SidebarProps {
    selectedCrypto: string;
    onCryptoChange: (crypto: string) => void;
}

const Sidebar = ({ selectedCrypto, onCryptoChange }: SidebarProps) => {
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const orderInput = useAtomValue(orderInputAtom);
    const pair = useAtomValue(tradingPairAtom);
    const tokens = useAtomValue(tokensAtom); // Get tokens from store
    const toggleSide = useSetAtom(toggleOrderSideAtom);
    const updateAmount = useSetAtom(updateOrderAmountAtom);
    const updatePrice = useSetAtom(updateLimitPriceAtom);
    const [selectedToken, setSelectedToken] = useState('USDC');
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const { verifyProof, submitOrder, calculateNewState, initWalletClientSide, isInitializing, initStep } = useProof();
    const { generateWalletUpdateProofClient } = useWalletUpdateProof();
    const { profile, fetchProfile } = useUserProfile();
    const keys = getAllKeys()
    /**
     * Handle wallet initialization and refresh profile after
     */
    const handleInitWallet = async () => {
            const success = await initWalletClientSide(profile.is_initialized);
            if (success) {
                const walletId = extractPrivyWalletId(user.id);
                await fetchProfile(walletId);
            }
    };

    /**
     * Helper: Find token index by symbol from tokens store (instead of hardcoding)
     */
    const getTokenIndex = (symbol: string): number => {
        const token = tokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
        if (!token) {
            console.warn(`⚠️ Token "${symbol}" not found in store, defaulting to index 0`);
            return 0;
        }
        return token.index;
    };

    /**
     * ✅ Get balance for a token by symbol from profile
     * Only use profile.balances array, return 0 if not found
     */
    const getTokenBalance = (symbol: string): { pnpmavailable: string; reserved: string; total: string } => {

        // ✅ Return 0 if no profile or no balances array
        if (!profile || !profile.balances) {
            return { available: '0', reserved: '0', total: '0' };
        }

        // ✅ Find in profile.balances array by token_symbol
        const balanceInfo = profile.balances.find(b => b.token_symbol === symbol);

        if (balanceInfo) {
            return {
                available: balanceInfo.available || '0',
                reserved: balanceInfo.reserved || '0',
                total: balanceInfo.total || '0'
            };
        }

        // ✅ If not found in balances array, return 0 (don't fallback)
        return { available: '0', reserved: '0', total: '0' };
    };

    /**
     * ✅ Format balance for display (show raw value from backend)
     */
    const formatBalance = (balance: string): string => {
        return balance || '0';
    };

    // Callback to handle buy/sell order (similar to hdlUpdateWallet in Header.tsx)
    const handleTradeOrder = async () => {
        // ✅ Validate amount before proceeding
        if (!amountValidation.isValid) {
            toast.error(amountValidation.error || 'Invalid amount');
            return;
        }

        // ✅ Check if amount is empty or zero
        if (!orderInput.amount || parseFloat(orderInput.amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        try {
            // ✅ Start processing
            setIsProcessing(true);
            setProcessingStep('Initializing order...');
            console.log('🚀 Step 1: Creating order...');

            // Get wallet address
            const walletAddress = getWalletAddressByConnectorType(wallets, 'embedded', user);
            if (!walletAddress) {
                toast.error('Please connect wallet first!');
                setIsProcessing(false);
                return;
            }

            // Get Privy user ID
            if (!user?.id) {
                toast.error('Please authenticate with Privy first!');
                setIsProcessing(false);
                return;
            }

            // Check and switch to Sepolia if needed
            const canProceed = await ensureSepoliaChain(chainId, switchChainAsync, setProcessingStep);
            if (!canProceed) {
                setIsProcessing(false);
                return;
            }

            // ✅ Extract wallet_id from Privy user ID (remove "did:privy:" prefix)
            const walletId = extractPrivyWalletId(user.id);

            // ✅ Fetch user profile and auto-update store
            setProcessingStep('Fetching wallet state...');
            console.log('📊 Step 2: Fetching user profile...');
            console.log('  - Full Privy user ID:', user.id);
            console.log('  - Wallet ID (without prefix):', walletId);
            const profileData = await fetchProfile(walletId);
            console.log('✅ Profile loaded and stored:', profileData);

            // Check if system is syncing
            if (profileData.sync === false) {
                toast('System is synchronizing, please try again in a few minutes', {
                    icon: '⏳',
                    duration: 4000,
                    style: {
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        color: '#fff',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '16px 20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 10px 40px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1)',
                    },
                });
                setIsProcessing(false);
                return;
            }

            const oldState: WalletState = {
                available_balances: profileData.available_balances || Array(10).fill('0'),
                reserved_balances: profileData.reserved_balances || Array(10).fill('0'),
                orders_list: profileData.orders_list || Array(4).fill(null),
                fees: profileData.fees?.toString() || '0',
                blinder: profileData.blinder,
            };

            // ✅ Find available order slot (index của order null đầu tiên)
            const availableSlot = oldState.orders_list.findIndex(order => order === null);
            if (availableSlot === -1) {
                toast.error('No available order slots! All 4 slots are full.');
                setIsProcessing(false);
                return;
            }

            setProcessingStep('Calculating new state...');

            // ✅ Get token indices from tokens store (dynamic lookup)
            const baseTokenIndex = getTokenIndex(pair.base);    // WBTC/BTC -> lấy từ store
            const quoteTokenIndex = getTokenIndex(pair.quote);  // USDC/USDT -> lấy từ store

            // ✅ Calculate token_in and token_out based on side
            // NOTE: token_out = token trả, token_in = token nhận
            // BUY: trả USDC (quote) -> nhận WBTC (base)
            // SELL: trả WBTC (base) -> nhận USDC (quote)
            const tokenIn = orderInput.side === 'buy' ? baseTokenIndex : quoteTokenIndex;
            const tokenOut = orderInput.side === 'buy' ? quoteTokenIndex : baseTokenIndex;

            console.log(tokenIn, tokenOut, 'check------------');
            // ✅ Get price from input or default to '1'
            const orderPrice = orderInput.limitPrice || '1';

            console.log('🔍 Token calculation:', {
                pair: pair,
                side: orderInput.side,
                baseTokenIndex,
                quoteTokenIndex,
                tokenIn,
                tokenOut,
            });

            // ✅ Tạo OrderAction với tất cả tham số được fill đầy đủ
            const action: OrderAction = {
                type: 'order',
                operation_type: 0, // 0 = CREATE_ORDER
                order_index: availableSlot,    // ✅ Slot trống đầu tiên
                order_data: {
                    price: orderPrice,         // ✅ Từ limitPrice input
                    qty: orderInput.amount || '0',    // ✅ Từ amount input
                    side: orderInput.side === 'buy' ? 0 : 1,  // ✅ 0=buy, 1=sell
                    token_in: tokenIn,         // ✅ Token nhận (động từ store)
                    token_out: tokenOut,       // ✅ Token trả (động từ store)
                }
            };

            console.log('📝 Order action created:', {
                ...action,
                details: {
                    pair: pair.symbol,
                    side: orderInput.side,
                    amount: orderInput.amount,
                    price: orderPrice,
                    slot: availableSlot,
                    tokenInName: orderInput.side === 'buy' ? pair.base : pair.quote,   // BUY: nhận WBTC
                    tokenOutName: orderInput.side === 'buy' ? pair.quote : pair.base,  // BUY: trả USDC
                }
            });

            // Calculate new state
            console.log('🔐 Step 3: Calculating new state...');
            const { newState, operations } = await calculateNewState(
                oldState,
                action,
                profileData.nonce || 0
            );

            console.log('✅ New state calculated:', {
                availableBalances: newState.available_balances.slice(0, 3),
                reservedBalances: newState.reserved_balances.slice(0, 3),
                activeOrders: newState.orders_list.filter(o => o !== null).length,
                operations
            });

            // Generate proof
            setProcessingStep('Generating proof (this may take a moment)...');
            console.log('🔐 Step 4: Generating wallet update proof...', newState);
            const userSecret = '12312'; // TODO: Get from secure storage

            const proofData = await generateWalletUpdateProofClient({
                userSecret,
                oldNonce: profileData.nonce?.toString() || '0',
                oldMerkleRoot: profileData.merkle_root,
                oldMerkleIndex: profileData.merkle_index,
                oldHashPath: profileData.sibling_paths,
                oldState,
                newState,
                operations
            });
            if(!proofData.publicInputs) {
                toast.error('Something went wrong');
                setIsProcessing(false);
                return;
            }

            console.log('✅ Proof generated:', proofData);

            // Sign newCommitment
            setProcessingStep('Signing transaction...');
            console.log('🔍 Step 5: Signing newCommitment...');
            const newCommitment = proofData.publicInputs.new_wallet_commitment;
            const rootSignature = await signMessageWithSkRoot(newCommitment);
            console.log('✅ Signature created');

            // ✅ Submit order to CREATE_ORDER endpoint
            setProcessingStep('Submitting order...');
            console.log('🔍 Step 6: Submitting order to CREATE_ORDER endpoint...');
            const submitResult = await submitOrder({
                proof: proofData.proof,
                publicInputs: proofData.publicInputs,
                wallet_address: walletAddress,
                operations,
                signature: rootSignature
            });
            console.log(submitResult.success, 'submitResult1')
            if (submitResult.success) {
                toast.success('Please allow a few minutes for the system to sync');
            } else {
                console.error('❌ Step 7: Order submission failed:', submitResult.error);
                toast.error(`Order submission failed: ${submitResult.error}`);
            }

            // ✅ Done processing
            setIsProcessing(false);

        } catch (error) {
            console.error('❌ Error creating order:', error);
            toast.error('Something went wrong');
            setIsProcessing(false);
        }
    };

    // ✅ Get base and quote symbols from trading pair
    const baseSymbol = pair.base || 'WBTC';
    const quoteSymbol = pair.quote || 'USDC';

    // ✅ Get balances for current trading pair
    const baseBalance = getTokenBalance(baseSymbol);
    const quoteBalance = getTokenBalance(quoteSymbol);

    // ✅ Validate amount against available balance
    const amountValidation = useMemo(() => {
        const amount = parseFloat(orderInput.amount || '0');
        const price = parseFloat(orderInput.limitPrice || '1');

        // Skip validation if amount is 0 or empty
        if (!orderInput.amount || amount <= 0) {
            return { isValid: true, error: null };
        }

        if (orderInput.side === 'buy') {
            // BUY: Need amount * price in quote token (USDC)
            const requiredQuote = amount * price;
            const availableQuote = parseFloat(quoteBalance.available || '0');

            if (requiredQuote > availableQuote) {
                return {
                    isValid: false,
                    error: `Insufficient ${quoteSymbol}. Need ${requiredQuote.toFixed(2)}, have ${availableQuote.toFixed(2)}`
                };
            }
        } else {
            // SELL: Need amount in base token (WBTC)
            const availableBase = parseFloat(baseBalance.available || '0');

            if (amount > availableBase) {
                return {
                    isValid: false,
                    error: `Insufficient ${baseSymbol}. Need ${amount.toFixed(6)}, have ${availableBase.toFixed(6)}`
                };
            }
        }

        return { isValid: true, error: null };
    }, [orderInput.amount, orderInput.limitPrice, orderInput.side, baseBalance.available, quoteBalance.available, baseSymbol, quoteSymbol]);

    return (
        <>
            {/* ✅ Fullscreen Loading Overlay - shows when processing order or initializing wallet */}
            {(isProcessing || isInitializing) && (
                <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="w-20 h-20 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                    <div className="text-white font-medium text-xl mt-6">
                        {isInitializing ? initStep : processingStep}
                    </div>
                    <div className="text-gray-400 text-sm mt-2">Please wait, do not close this window...</div>
                </div>
            )}

            <aside className="w-80 border-r border-gray-800 bg-black">
                <div className="p-4 border-b border-gray-800">
                    {/* ✅ Token Balances and Deposit in One Row */}
                    <div className="flex items-start justify-between mb-4">
                        {/* Column 1: Token Names */}
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center space-x-2 text-gray-400 text-xs">
                                <TokenIconBySymbol symbol={baseSymbol} size="sm" />
                                <span>{baseSymbol}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-400 text-xs">
                                <TokenIconBySymbol symbol={quoteSymbol} size="sm" />
                                <span>{quoteSymbol}</span>
                            </div>
                        </div>

                        {/* Column 2: Balances */}
                        <div className="flex flex-col space-y-2">
                            <span className="text-white font-medium text-xs">
                                {formatBalance(baseBalance.available)}
                            </span>
                            <span className="text-white font-medium text-xs">
                                {formatBalance(quoteBalance.available)}
                            </span>
                        </div>

                        {/* Column 3: Deposit Button - only show when wallet is initialized */}
                        {profile?.is_initialized && keys?.pk_root && (
                            <button
                                onClick={() => setIsDepositModalOpen(true)}
                                className="px-4 py-2 bg-black border border-white text-white rounded-lg font-medium text-sm hover:bg-gray-900 transition-colors"
                            >
                                Deposit
                            </button>
                        )}
                    </div>

                <div className="flex items-center space-x-2 mb-6">
                    <button
                        onClick={toggleSide}
                        className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-200 ${
                            orderInput.side === 'buy'
                                ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/30'
                                : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                        }`}
                    >
                        <span>{orderInput.side === 'buy' ? 'Buy' : 'Sell'}</span>
                        <ArrowLeftRight className="w-4 h-4" />
                    </button>

                    <TokenSelector
                        selectedToken={selectedToken}
                        onSelectToken={setSelectedToken}
                    />
                </div>

                <div className="space-y-4">
                    {/* ✅ Amount Input with Validation */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Amount</label>
                        <div className={`flex items-center bg-gray-900 rounded-lg px-4 py-3 border transition-colors ${
                            !amountValidation.isValid
                                ? 'border-red-500'
                                : 'border-gray-800'
                        }`}>
                            <input
                                type="text"
                                placeholder="0.00"
                                value={orderInput.amount}
                                onChange={(e) => updateAmount(e.target.value)}
                                className={`bg-transparent flex-1 outline-none ${
                                    !amountValidation.isValid ? 'text-red-400' : 'text-white'
                                }`}
                            />
                            <span className="text-white font-medium ml-2">{pair.base}</span>
                            <ArrowLeftRight className="w-4 h-4 text-gray-400 ml-2" />
                        </div>

                        {/* Error Message */}
                        {!amountValidation.isValid && amountValidation.error && (
                            <p className="text-red-500 text-xs mt-1 px-1">
                                {amountValidation.error}
                            </p>
                        )}

                        <div className="flex items-center justify-between mt-2 px-1">
                            <button className="text-xs text-gray-400 hover:text-white">25%</button>
                            <button className="text-xs text-gray-400 hover:text-white">50%</button>
                            <button className="text-xs text-gray-400 hover:text-white">MAX</button>
                        </div>
                    </div>

                    {/* ✅ Price Input */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Price ({pair.quote})</label>
                        <div className="flex items-center bg-gray-900 rounded-lg px-4 py-3 border border-gray-800">
                            <input
                                type="text"
                                placeholder="0.00"
                                value={orderInput.limitPrice || ''}
                                onChange={(e) => updatePrice(e.target.value)}
                                className="bg-transparent flex-1 outline-none text-white"
                            />
                            <span className="text-gray-400 text-sm ml-2">{pair.quote}</span>
                        </div>
                    </div>

                    {!authenticated ? (
                        <ConnectButton className="w-full py-4" />
                    ) : !profile?.is_initialized || !keys.pk_root ? (
                        <button
                            onClick={handleInitWallet}
                            disabled={isInitializing}
                            className="w-full py-4 px-6 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sign Wallet
                        </button>
                    ) : (
                        <TradingActionButton className="w-full py-4" onClick={handleTradeOrder} />
                    )}

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Type</span>
                            <span className="text-white">Midpoint</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Order Value</span>
                            <span className="text-white">--</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Fee</span>
                            <span className="text-white">--</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Total Savings vs. Binance</span>
                            <span className="text-white">--</span>
                        </div>
                    </div>

                    <div className="flex items-start space-x-2 text-xs text-gray-500 pt-4">
                        <Lock className="w-3 h-3 mt-0.5" />
                        <span>All orders are pre-trade and post-trade private.</span>
                    </div>
                </div>
            </div>
        </aside>

        {/* Deposit Modal */}
        <DepositModal
            isOpen={isDepositModalOpen}
            onClose={() => setIsDepositModalOpen(false)}
        />
        </>
    );
};

export default Sidebar;
