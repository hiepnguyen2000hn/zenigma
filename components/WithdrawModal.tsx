"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Stepper, { Step } from './Stepper';
import { BALANCE_PERCISION, DARKPOOL_CORE_ADDRESS, MOCK_USDC_ADDRESS } from '@/lib/constants';
import { TokenIconBySymbol } from './TokenSelector';
import { useTokens } from '@/hooks/useTokens';
import { type Token, getUserProfile, scaleToInt } from '@/lib/services';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { useProof, useWalletUpdateProof } from '@/hooks/useProof';
import { usePermit2Signature } from '@/hooks/usePermit2Signature';
import { type TransferAction, type WalletState } from '@/hooks/useProof';
import { extractPrivyWalletId, getWalletAddressByConnectorType } from '@/lib/wallet-utils';
import { signMessageWithSkRoot } from '@/lib/ethers-signer';
import { useTokenMapping } from '@/hooks/useTokenMapping';
import { parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { useChainId, useSwitchChain } from 'wagmi';
import { ensureSepoliaChain } from '@/lib/chain-utils';

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    onWithdrawSuccess?: () => void; // Callback after successful withdrawal
}

const NETWORKS = [
    { value: 'ethereum', label: 'Ethereum Mainnet' },
    { value: 'sepolia', label: 'Sepolia Testnet' },
    { value: 'arbitrum', label: 'Arbitrum One' },
    { value: 'optimism', label: 'Optimism' },
];

const WithdrawModal = ({ isOpen, onClose, onWithdrawSuccess }: WithdrawModalProps) => {
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [selectedNetwork, setSelectedNetwork] = useState('sepolia');
    const [amount, setAmount] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const [errorMessage, setErrorMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [darkpoolBalances, setDarkpoolBalances] = useState<string[]>(Array(10).fill('0'));

    // Fetch tokens from API with cache
    const { tokens, isLoading: isLoadingTokens } = useTokens();
    const { getSymbol } = useTokenMapping();

    // Privy hooks
    const { user } = usePrivy();
    const { wallets } = useWallets();

    // Wagmi hooks for chain management
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();

    // Proof hooks
    const { verifyProof, calculateNewState } = useProof();
    const { generateWalletUpdateProofClient } = useWalletUpdateProof();
    const { signPermit2FE } = usePermit2Signature();

    // ✅ Fetch DarkPool balances when modal opens
    useEffect(() => {
        if (isOpen && user?.id) {
            const fetchDarkpoolBalances = async () => {
                try {
                    const walletId = extractPrivyWalletId(user.id);
                    const profile = await getUserProfile(walletId);
                    setDarkpoolBalances(profile.available_balances || Array(10).fill('0'));
                    console.log('✅ DarkPool balances loaded:', profile.available_balances);
                } catch (error) {
                    console.error('❌ Error fetching balances:', error);
                }
            };
            fetchDarkpoolBalances();
        }
    }, [isOpen, user?.id]);

    // ✅ Don't render if modal is closed
    if (!isOpen) return null;

    const handleClose = () => {
        setSelectedToken(null);
        setAmount('');
        setCurrentStep(1);
        setErrorMessage('');
        onClose();
    };

    const handleComplete = async () => {
        try {
            setIsProcessing(true);
            setProcessingStep('Initializing...');

            console.log('💸 Starting withdraw process...', { selectedToken, selectedNetwork, amount });
            console.log('📋 Withdraw Flow:');
            console.log('  1. Fetch user profile');
            console.log('  2. Sign Permit2 (required for withdraw)');
            console.log('  3. Create TransferAction (direction: 1 = WITHDRAW)');
            console.log('  4. Calculate new state');
            console.log('  5. Generate proof');
            console.log('  6. Sign commitment');
            console.log('  7. Verify proof');

            if (!selectedToken || !amount) {
                toast.error('Missing required fields');
                setIsProcessing(false);
                return;
            }

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

            // Step 1: Get user profile and old state
            setProcessingStep('Fetching user profile...');
            console.log('📊 Step 1: Fetching user profile...');
            const walletId = extractPrivyWalletId(user.id);
            const profile = await getUserProfile(walletId);
            console.log('✅ Profile loaded:', profile);

            // Check if account is locked
            if (profile && profile.is_locked) {
                toast('System is synchronizing, please try again in a few minutes', {
                    icon: '⚠️',
                    duration: 4000,
                    style: {
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        color: '#fff',
                        border: '1px solid rgba(251, 191, 36, 0.5)',
                        padding: '16px 20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 10px 40px rgba(251, 191, 36, 0.15), 0 0 0 1px rgba(251, 191, 36, 0.1)',
                    },
                });
                setIsProcessing(false);
                setProcessingStep('');
                return;
            }

            const oldState: WalletState = {
                available_balances: profile.available_balances || Array(10).fill('0'),
                reserved_balances: profile.reserved_balances || Array(10).fill('0'),
                orders_list: profile.orders_list || Array(4).fill(null),
                fees: profile.fees?.toString() || '0',
                blinder: profile.blinder,
            };

            // Step 2: Sign Permit2 (required for WITHDRAW)
            setProcessingStep('Signing Permit2...');
            console.log('🔍 Step 2: Signing Permit2...');
            console.log(`  - Token: ${selectedToken.symbol} (${selectedToken.address})`);
            console.log(`  - Amount: ${amount} (${parseUnits(amount, selectedToken.decimals)} wei)`);

            const permit2Data = await signPermit2FE({
                token: selectedToken.address, // ✅ Use selected token address
                amount: parseUnits(amount, selectedToken.decimals), // ✅ Convert to token decimals
                spender: DARKPOOL_CORE_ADDRESS,
            });
            console.log('✅ Permit2 signed:', {
                nonce: permit2Data.permit2Nonce.toString(),
                deadline: permit2Data.permit2Deadline.toString(),
                signature: permit2Data.permit2Signature.substring(0, 20) + '...'
            });

            // Step 3: Create TransferAction for WITHDRAW
            const withdrawAmountScaled = scaleToInt(amount, BALANCE_PERCISION);

            const action: TransferAction = {
                type: 'transfer',
                direction: 1,
                token_index: selectedToken.index,
                amount: withdrawAmountScaled,
                permit2Nonce: permit2Data.permit2Nonce.toString(),
                permit2Deadline: permit2Data.permit2Deadline.toString(),
                permit2Signature: permit2Data.permit2Signature
            };

            // Step 4: Calculate new state
            setProcessingStep('Calculating new state...');
            console.log('🔐 Step 4: Calculating new state...');
            const { newState, operations } = await calculateNewState(
                oldState,
                action,
                profile.nonce || 0
            );

            // Step 5: Generate proof
            setProcessingStep('Generating proof (this may take a moment)...');
            console.log('🔐 Step 5: Generating wallet update proof...');

            const proofData = await generateWalletUpdateProofClient({
                oldNonce: profile.nonce?.toString() || '0',
                oldMerkleRoot: profile.merkle_root,
                oldMerkleIndex: profile.merkle_index,
                oldHashPath: profile.sibling_paths,
                oldState,
                newState,
                operations
            });

            console.log('✅ Proof generated successfully:', proofData);

            // Step 6: Sign newCommitment
            setProcessingStep('Signing commitment...');
            console.log('🔍 Step 6: Signing newCommitment...');
            const newCommitment = proofData.publicInputs.new_wallet_commitment;
            const rootSignature = await signMessageWithSkRoot(newCommitment);
            console.log('✅ Signature created!');

            // Step 7: Verify proof
            setProcessingStep('Verifying proof...');
            console.log('🔍 Step 7: Verifying proof...');
            if (operations.transfer) {
                operations.transfer.amount = amount
            }
            const verifyResult = await verifyProof({
                proof: proofData.proof,
                publicInputs: proofData.publicInputs,
                wallet_address: walletAddress,
                operations,
                signature: rootSignature
            });

            if (verifyResult.success) {
                console.log('✅ Withdraw completed successfully!', verifyResult);
                setProcessingStep('Withdraw completed!');
                if (verifyResult.verified) {
                    toast.success(`Withdraw verified successfully!\nAmount: ${amount} ${selectedToken.symbol}`, {
                        duration: 5000,
                    });
                    // ✅ Call callback để refetch transfer history
                    onWithdrawSuccess?.();
                } else {
                    toast.error('Withdraw verification failed');
                }
            } else {
                console.error('❌ Verification failed:', verifyResult.error);
                toast.error(`Verification failed: ${verifyResult.error}`);
                setIsProcessing(false);
                setProcessingStep('');
                return;
            }

            // ✅ Success → Reset all state and close modal
            setIsProcessing(false);
            setProcessingStep('');
            handleClose();
        } catch (error) {
            console.error('❌ Error in withdraw process:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error occurred');
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    const handleStepChange = (step: number) => {
        setCurrentStep(step);
        setErrorMessage('');
    };

    // Validation logic for each step
    const getValidationForCurrentStep = (): { canProceed: boolean; errorMessage: string } => {
        switch (currentStep) {
            case 1:
                if (!selectedToken) {
                    return {
                        canProceed: false,
                        errorMessage: 'Please select a token to continue'
                    };
                }
                return { canProceed: true, errorMessage: '' };

            case 2:
                if (!amount || parseFloat(amount) <= 0) {
                    return {
                        canProceed: false,
                        errorMessage: 'Please enter a valid amount greater than 0'
                    };
                }

                // ✅ Check if amount exceeds DarkPool balance
                const enteredAmount = parseFloat(amount);
                const availableBalance = parseFloat(darkpoolBalances[selectedToken?.index || 0] || '0');

                if (enteredAmount > availableBalance) {
                    return {
                        canProceed: false,
                        errorMessage: `Insufficient DarkPool balance. You have ${availableBalance} ${selectedToken?.symbol}`
                    };
                }

                return { canProceed: true, errorMessage: '' };

            case 3:
                return { canProceed: true, errorMessage: '' };

            default:
                return { canProceed: true, errorMessage: '' };
        }
    };

    const validation = getValidationForCurrentStep();

    return (
        <>
            {/* ✅ Fullscreen Loading Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="w-20 h-20 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                    <div className="text-white font-medium text-xl mt-6">{processingStep}</div>
                    <div className="text-gray-400 text-sm mt-2">Please wait, do not close this window...</div>
                </div>
            )}

            {/* ✅ Modal Content */}
            {!isProcessing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-xl mx-4 bg-gradient-to-b from-gray-900 to-gray-900/95 border border-gray-700/70 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
                            <h2 className="text-xl font-bold text-white">Withdraw Assets</h2>
                            <button
                                onClick={handleClose}
                                disabled={isProcessing}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Stepper */}
                        <div className="px-5 py-4">
                            <Stepper
                                initialStep={1}
                                onStepChange={handleStepChange}
                                onFinalStepCompleted={handleComplete}
                                stepCircleContainerClassName="stepper-custom"
                                contentClassName="stepper-content"
                                footerClassName="stepper-footer"
                                backButtonText="Back"
                                nextButtonText="Next"
                                disableStepIndicators={false}
                                canProceed={validation.canProceed}
                                errorMessage={validation.errorMessage}
                            >
                                {/* Step 1: Select Token */}
                                <Step>
                                    <div className="space-y-4">
                                        <h3 className="text-base font-semibold text-white/90 mt-1">Choose a token to withdraw</h3>
                                        {isLoadingTokens ? (
                                            <div className="text-center py-10 text-gray-400">Loading tokens...</div>
                                        ) : (
                                            <div className="max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-red-500/50 scrollbar-track-gray-800/50 hover:scrollbar-thumb-red-500/70 scroll-smooth">
                                                <div className="grid gap-2.5">
                                                    {tokens.map((token) => {
                                                        const balance = parseFloat(darkpoolBalances[token.index] || '0');
                                                        return (
                                                            <button
                                                                key={token.symbol}
                                                                onClick={() => setSelectedToken(token)}
                                                                disabled={balance <= 0}
                                                                className={`group w-full p-3 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                                                                    selectedToken?.symbol === token.symbol
                                                                        ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
                                                                        : balance > 0
                                                                        ? 'border-gray-700/70 bg-gray-800/30 hover:border-red-500/50 hover:bg-gray-800/50'
                                                                        : 'border-gray-700/30 bg-gray-800/10 opacity-50 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <div className="flex items-center space-x-3">
                                                                    <div className="w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                                                                        <TokenIconBySymbol symbol={token.symbol} size="md" />
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <div className="text-white font-semibold text-sm">{token.symbol}</div>
                                                                        <div className="text-gray-400 text-xs">{token.name}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-gray-500 text-xs mb-0.5">DarkPool Balance</div>
                                                                    <div className={`font-medium text-xs ${balance > 0 ? 'text-white/90' : 'text-gray-600'}`}>
                                                                        {balance.toFixed(2)}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Step>

                                {/* Step 2: Network & Amount */}
                                <Step>
                                    {selectedToken ? (
                                        <div className="space-y-4">
                                            <h3 className="text-base font-semibold text-white/90">Enter withdraw details</h3>

                                            {/* Selected Token Display */}
                                            <div className="p-3 bg-gradient-to-r from-red-500/5 to-orange-500/5 border border-red-500/30 rounded-lg flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center">
                                                    <TokenIconBySymbol symbol={selectedToken.symbol} size="md" />
                                                </div>
                                                <div>
                                                    <div className="text-white font-semibold text-sm">{selectedToken.symbol}</div>
                                                    <div className="text-gray-400 text-xs">{selectedToken.name}</div>
                                                </div>
                                            </div>

                                            {/* Network Selection */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-300 mb-2">
                                                    Network
                                                </label>
                                                <select
                                                    value={selectedNetwork}
                                                    onChange={(e) => setSelectedNetwork(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700/70 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                                                >
                                                    {NETWORKS.map((network) => (
                                                        <option key={network.value} value={network.value}>
                                                            {network.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Amount Input */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-300 mb-2">
                                                    Amount
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={amount}
                                                        onChange={(e) => setAmount(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full px-3 py-2.5 pr-16 bg-gray-800/50 border border-gray-700/70 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">
                                                        {selectedToken.symbol}
                                                    </div>
                                                </div>
                                                <div className="mt-2 text-xs text-gray-500">
                                                    Available in DarkPool: <span className="text-gray-400 font-medium">
                                                        {parseFloat(darkpoolBalances[selectedToken.index] || '0').toFixed(2)} {selectedToken.symbol}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-gray-400">
                                            Please select a token first
                                        </div>
                                    )}
                                </Step>

                                {/* Step 3: Review */}
                                <Step>
                                    {selectedToken && amount ? (
                                        <div className="space-y-5">
                                            <h3 className="text-base font-semibold text-white/90 mb-4">Review your withdrawal</h3>

                                            <div className="p-6 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-yellow-500/10 border border-red-500/30 rounded-xl space-y-4 shadow-xl shadow-red-500/5">
                                                <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                                                    <span className="text-gray-400 text-sm">Token</span>
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center">
                                                            <TokenIconBySymbol symbol={selectedToken.symbol} size="sm" />
                                                        </div>
                                                        <span className="text-white font-semibold">{selectedToken.symbol}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                                                    <span className="text-gray-400 text-sm">Network</span>
                                                    <span className="text-white font-medium text-sm">
                                                        {NETWORKS.find(n => n.value === selectedNetwork)?.label}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between py-3">
                                                    <span className="text-gray-400 text-sm">Amount</span>
                                                    <span className="text-red-400 font-bold text-xl">
                                                        {amount} {selectedToken.symbol}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl backdrop-blur-sm">
                                                <p className="text-yellow-300/90 text-sm leading-relaxed">
                                                    ⚠ Please review your withdrawal details carefully. Funds will be sent to your connected wallet address.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-gray-400">
                                            Please complete previous steps
                                        </div>
                                    )}
                                </Step>
                            </Stepper>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WithdrawModal;
