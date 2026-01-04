"use client";

import { useState } from 'react';
import { X } from 'lucide-react';
import Stepper, { Step } from './Stepper';
import { useERC20Token } from '@/hooks/useERC20Token';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { DARKPOOL_CORE_ADDRESS, PERMIT2_ADDRESS, getAvailableERC20Tokens } from '@/lib/constants';
import { TokenIconBySymbol } from './TokenSelector';
import { useTokens } from '@/hooks/useTokens';
import { type Token, getUserProfile } from '@/lib/services';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { useProof, useWalletUpdateProof } from '@/hooks/useProof';
import { usePermit2Signature } from '@/hooks/usePermit2Signature';
import { type TransferAction, type WalletState } from '@/hooks/useProof';
import { extractPrivyWalletId } from '@/lib/wallet-utils';
import { signMessageWithSkRoot } from '@/lib/ethers-signer';
import { parseUnits, parseEther } from 'viem';
import toast from 'react-hot-toast';
import { useSwitchChain, useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { WETH_ADDRESSES } from '@/lib/constants';
import { WETH_ABI } from '@/lib/abis/weth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { chainMetadata } from '@/config';
import Image from 'next/image';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Token list will be updated with real balances in component

const NETWORKS = [
    { value: 'sepolia', label: 'Sepolia Testnet', chainId: 11155111, nativeSymbol: 'SepoliaETH' },
    { value: 'ethereum', label: 'Ethereum Mainnet', chainId: 1, nativeSymbol: 'ETH' },
    { value: 'arbitrum', label: 'Arbitrum One', chainId: 42161, nativeSymbol: 'ETH' },
    { value: 'optimism', label: 'Optimism', chainId: 10, nativeSymbol: 'ETH' },
];

type TokenType = 'native' | string; // 'native' or ERC20 token symbol (e.g., 'USDC', 'USDT')

const DepositModal = ({ isOpen, onClose }: DepositModalProps) => {
    // Step 1: Chain selection
    const [selectedChainId, setSelectedChainId] = useState<number>(11155111); // Default Sepolia

    // Step 2: Token type selection
    const [selectedTokenType, setSelectedTokenType] = useState<TokenType | null>(null);

    // Get available ERC20 tokens from config
    const availableERC20Tokens = getAvailableERC20Tokens();

    // Step 3: Amount
    const [amount, setAmount] = useState('');

    // Common states
    const [currentStep, setCurrentStep] = useState(1);
    const [errorMessage, setErrorMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');

    // Fetch tokens from API with cache
    const { tokens, isLoading: isLoadingTokens } = useTokens();

    // Privy hooks
    const { user } = usePrivy();
    const { wallets } = useWallets();

    // Wagmi hooks for chain switching
    const { chain: currentChain } = useAccount();
    const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

    // Wagmi config for transaction receipts
    const config = useConfig();

    // WETH contract hooks
    const { writeContractAsync: wethWriteAsync } = useWriteContract();

    // Get WETH address for selected chain
    const wethAddress = WETH_ADDRESSES[selectedChainId] as `0x${string}`;

    // Get WETH allowance for Permit2
    const {
        data: wethAllowanceData,
        refetch: refetchWethAllowance,
    } = useReadContract({
        address: wethAddress,
        abi: WETH_ABI,
        functionName: 'allowance',
        args: wallets.find(w => w.connectorType === 'embedded')?.address && PERMIT2_ADDRESS
            ? [wallets.find(w => w.connectorType === 'embedded')?.address as `0x${string}`, PERMIT2_ADDRESS]
            : undefined,
        query: {
            enabled: !!(wallets.find(w => w.connectorType === 'embedded')?.address && PERMIT2_ADDRESS),
        }
    });

    const wethAllowance = wethAllowanceData
        ? (wethAllowanceData as bigint)
        : BigInt(0);

    // Proof hooks
    const { verifyProof, calculateNewState } = useProof();
    const { generateWalletUpdateProofClient } = useWalletUpdateProof();
    const { signPermit2FE } = usePermit2Signature();

    // User profile hook for refetching after deposit
    const { refetchProfile } = useUserProfile();

    // ✅ NEW: Load balances for ALL tokens at once
    const { balances: allBalances, isLoading: isLoadingAllBalances } = useAllTokenBalances();

    // Determine which ERC20 token to use (default to USDC if no ERC20 token selected)
    const selectedERC20Token = selectedTokenType && selectedTokenType !== 'native'
        ? selectedTokenType
        : 'USDC';

    // Generic ERC20 token hook - works with any token from config!
    // ⚠️ Still need this for approve/allowance functionality
    const {
        isConnected,
        approve,
        isApprovePending,
        isApproveConfirming,
        isApproveSuccess,
        allowance,
        refetchAllowance,
        tokenConfig: selectedTokenConfig,
    } = useERC20Token(selectedERC20Token, PERMIT2_ADDRESS);

    // ✅ Don't render if modal is closed
    if (!isOpen) return null;

    const handleClose = () => {
        setSelectedChainId(11155111); // Reset to Sepolia
        setSelectedTokenType(null);
        setAmount('');
        setCurrentStep(1);
        setErrorMessage('');
        onClose();
    };

    const handleComplete = async () => {
        try {
            // ✅ Set processing state (will show loading overlay)
            setIsProcessing(true);
            setProcessingStep('Initializing...');

            console.log('💰 Starting deposit process...', {
                selectedTokenType,
                selectedChainId,
                amount,
                network: NETWORKS.find(n => n.chainId === selectedChainId)?.label
            });

            if (!isConnected) {
                toast.error('Please connect wallet first!');
                setIsProcessing(false);
                return;
            }

            if (!selectedTokenType || !amount) {
                toast.error('Missing required fields');
                setIsProcessing(false);
                return;
            }

            // Get wallet address
            const walletAddress = wallets.find(wallet => wallet.connectorType === 'embedded')?.address;
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

            // ✅ Route to correct flow based on token type
            if (selectedTokenType !== 'native') {
                // ============================================
                // ERC20 TOKEN DEPOSIT FLOW (USDC, USDT, DAI, etc.)
                // ============================================
                // console.log(`💰 Current ${selectedTokenType} Balance:`, erc20Balance);
                console.log('📊 Current allowance:', allowance);

                const requiredAmount = parseFloat(amount);
                const currentAllowance = parseFloat(allowance);

                // Step 1: Check and approve if needed
                if (currentAllowance < requiredAmount) {
                    console.log(`⚠️ Allowance insufficient! Current: ${currentAllowance} ${selectedTokenType}, Required: ${requiredAmount} ${selectedTokenType}`);
                    console.log(`🔐 Step 1: Approving ${selectedTokenType} to spender:`, PERMIT2_ADDRESS);

                    setProcessingStep(`Approving ${selectedTokenType}...`);
                    await approve(PERMIT2_ADDRESS, amount);

                    console.log('✅ Approval transaction confirmed!');
                } else {
                    console.log(`✅ Allowance already sufficient! Current: ${currentAllowance} ${selectedTokenType}, Required: ${requiredAmount} ${selectedTokenType}`);
                }

                // Step 2: Get user profile and old state
                setProcessingStep('Fetching user profile...');
                console.log('📊 Step 2: Fetching user profile...');
                const walletId = extractPrivyWalletId(user.id);
                console.log('  - Wallet ID (without prefix):', walletId);

                const profile = await getUserProfile(walletId);
                console.log('✅ Profile loaded:', profile);

                const oldState: WalletState = {
                    available_balances: profile.available_balances || Array(10).fill('0'),
                    reserved_balances: profile.reserved_balances || Array(10).fill('0'),
                    orders_list: profile.orders_list || Array(4).fill(null),
                    fees: profile.fees?.toString() || '0',
                    blinder: profile.blinder,
                };

                // Get ERC20 token info from API (match by symbol)
                const tokenFromAPI = tokens.find(t => t.symbol === selectedTokenType);
                if (!tokenFromAPI) {
                    toast.error(`${selectedTokenType} token not found in system`);
                    setIsProcessing(false);
                    return;
                }

                // Use selectedTokenConfig for address and decimals (from constants)
                const { address: tokenAddress, decimals: tokenDecimals } = selectedTokenConfig!;

                // Step 3: Sign Permit2
                setProcessingStep('Signing Permit2...');
                console.log('🔍 Step 3: Signing Permit2...');
                console.log(`  - Token: ${selectedTokenType} (${tokenAddress})`);
                console.log(`  - Amount: ${amount} (${parseUnits(amount, tokenDecimals)} base units)`);
                const permit2Data = await signPermit2FE({
                    token: tokenAddress,
                    amount: parseUnits(amount, tokenDecimals),
                    spender: DARKPOOL_CORE_ADDRESS,
                });
                console.log('✅ Permit2 signed:', {
                    nonce: permit2Data.permit2Nonce.toString(),
                    deadline: permit2Data.permit2Deadline.toString(),
                    signature: permit2Data.permit2Signature.substring(0, 20) + '...'
                });

                // Step 4: Create TransferAction
                // ⚠️ IMPORTANT: amount must be in smallest unit (base units for ERC20)
                const amountInBaseUnits = parseUnits(amount, tokenDecimals).toString();
                const action: TransferAction = {
                    type: 'transfer',
                    direction: 0,
                    token_index: tokenFromAPI.index, // Use index from API
                    amount: amount, // ✅ String of integer (base units)
                    permit2Nonce: permit2Data.permit2Nonce.toString(),
                    permit2Deadline: permit2Data.permit2Deadline.toString(),
                    permit2Signature: permit2Data.permit2Signature
                };

                // Step 5: Calculate new state
                setProcessingStep('Calculating new state...');
                console.log('🔐 Step 5: Calculating new state...');
                const { newState, operations } = await calculateNewState(
                    oldState,
                    action,
                    profile.nonce || 0
                );

                console.log('✅ New state calculated:');
                console.log(`  - Available Balances: [${newState.available_balances.slice(0, 3).join(', ')}...]`);
                console.log(`  - New Blinder: ${newState.blinder?.substring(0, 20)}...`);
                console.log('  - Operations:', operations);

                // Step 6: Generate proof
                setProcessingStep('Generating proof (this may take a moment)...');
                console.log('🔐 Step 6: Generating wallet update proof...');
                const userSecret = '12312';

                const proofData = await generateWalletUpdateProofClient({
                    userSecret,
                    oldNonce: profile.nonce?.toString() || '0',
                    oldMerkleRoot: profile.merkle_root,
                    oldMerkleIndex: profile.merkle_index,
                    oldHashPath: profile.sibling_paths,
                    oldState,
                    newState,
                    operations
                });

                console.log('✅ Proof generated successfully:', proofData);

                // Step 7: Sign newCommitment
                setProcessingStep('Signing commitment...');
                console.log('🔍 Step 7: Signing newCommitment...');
                const newCommitment = proofData.publicInputs.new_wallet_commitment;
                const rootSignature = await signMessageWithSkRoot(newCommitment);
                console.log('✅ Signature created!');

                // Step 8: Verify proof
                setProcessingStep('Verifying proof...');
                console.log('🔍 Step 8: Verifying proof...');
                const verifyResult = await verifyProof({
                    proof: proofData.proof,
                    publicInputs: proofData.publicInputs,
                    wallet_address: walletAddress,
                    operations,
                    signature: rootSignature
                });

                if (verifyResult.success) {
                    console.log('✅ Deposit completed successfully!', verifyResult);
                    setProcessingStep('Deposit completed!');
                    if (verifyResult.verified) {
                        // ✅ Refetch profile to update balances in sidebar
                        if (user?.id) {
                            const walletId = extractPrivyWalletId(user.id);
                            await refetchProfile(walletId);
                            console.log('✅ Profile refreshed with new balances');
                        }

                        toast.success(`Deposit verified successfully!\nAmount: ${amount} ${selectedTokenType}`, {
                            duration: 5000,
                        });
                    } else {
                        toast.error('Deposit verification failed');
                    }
                } else {
                    console.error('❌ Verification failed:', verifyResult.error);
                    toast.error(`Verification failed: ${verifyResult.error}`);
                    // ✅ Verification failed → ẩn loading, giữ modal
                    setIsProcessing(false);
                    setProcessingStep('');
                    return;
                }
            } else if (selectedTokenType === 'native') {
                // ============================================
                // NATIVE TOKEN DEPOSIT FLOW (WETH)
                // ============================================
                console.log('💎 Starting Native Token deposit flow...');
                console.log('  - Chain:', NETWORKS.find(n => n.chainId === selectedChainId)?.label);
                console.log('  - Native Token:', NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol);
                console.log('  - Amount:', amount);
                console.log('  - WETH Address:', wethAddress);

                const amountInWei = parseEther(amount);

                // Step 1: Wrap ETH → WETH
                setProcessingStep('Wrapping ETH to WETH...');
                console.log('🔄 Step 1: Wrapping ETH to WETH...');
                console.log('  - Amount:', amount, 'ETH');
                console.log('  - Amount in Wei:', amountInWei.toString());

                try {
                    const wrapTxHash = await wethWriteAsync({
                        address: wethAddress,
                        abi: WETH_ABI,
                        functionName: 'deposit',
                        value: amountInWei,
                    });

                    console.log('⏳ Waiting for wrap transaction...', wrapTxHash);
                    await waitForTransactionReceipt(config, {
                        hash: wrapTxHash,
                    });
                    console.log('✅ ETH wrapped to WETH successfully!');
                } catch (error) {
                    console.error('❌ Error wrapping ETH:', error);
                    toast.error('Failed to wrap ETH to WETH');
                    setIsProcessing(false);
                    setProcessingStep('');
                    return;
                }

                // Step 2: Approve WETH to Permit2
                setProcessingStep('Approving WETH to Permit2...');
                console.log('🔐 Step 2: Checking WETH allowance...');
                console.log('  - Current allowance:', wethAllowance.toString());
                console.log('  - Required amount:', amountInWei.toString());

                // Refetch allowance after wrap
                await refetchWethAllowance();

                if (wethAllowance < amountInWei) {
                    console.log('⚠️ Insufficient allowance, approving...');
                    try {
                        const approveTxHash = await wethWriteAsync({
                            address: wethAddress,
                            abi: WETH_ABI,
                            functionName: 'approve',
                            args: [PERMIT2_ADDRESS, amountInWei],
                        });

                        console.log('⏳ Waiting for approve transaction...', approveTxHash);
                        await waitForTransactionReceipt(config, {
                            hash: approveTxHash,
                        });
                        console.log('✅ WETH approved to Permit2!');

                        // Refetch allowance after approve
                        await refetchWethAllowance();
                    } catch (error) {
                        console.error('❌ Error approving WETH:', error);
                        toast.error('Failed to approve WETH to Permit2');
                        setIsProcessing(false);
                        setProcessingStep('');
                        return;
                    }
                } else {
                    console.log('✅ Allowance already sufficient!');
                }

                // Step 3: Get user profile and old state (same as USDC)
                setProcessingStep('Fetching user profile...');
                console.log('📊 Step 3: Fetching user profile...');
                const walletId = extractPrivyWalletId(user.id);
                console.log('  - Wallet ID (without prefix):', walletId);

                const profile = await getUserProfile(walletId);
                console.log('✅ Profile loaded:', profile);

                const oldState: WalletState = {
                    available_balances: profile.available_balances || Array(10).fill('0'),
                    reserved_balances: profile.reserved_balances || Array(10).fill('0'),
                    orders_list: profile.orders_list || Array(4).fill(null),
                    fees: profile.fees?.toString() || '0',
                    blinder: profile.blinder,
                };

                // Get WETH token info from API (assuming WETH is in token list)
                // For now, we'll look for "WETH" or use index 1 (if USDC is 0)
                const wethToken = tokens.find(t => t.symbol === 'WETH' || t.symbol === 'ETH');
                if (!wethToken) {
                    toast.error('WETH token not found in system. Please contact support.');
                    setIsProcessing(false);
                    setProcessingStep('');
                    return;
                }

                // Step 4: Sign Permit2
                setProcessingStep('Signing Permit2...');
                console.log('🔍 Step 4: Signing Permit2...');
                console.log(`  - Token: WETH (${wethAddress})`);
                console.log(`  - Amount: ${amount} (${amountInWei} wei)`);
                const permit2Data = await signPermit2FE({
                    token: wethAddress,
                    amount: amountInWei,
                    spender: DARKPOOL_CORE_ADDRESS,
                });
                console.log('✅ Permit2 signed:', {
                    nonce: permit2Data.permit2Nonce.toString(),
                    deadline: permit2Data.permit2Deadline.toString(),
                    signature: permit2Data.permit2Signature.substring(0, 20) + '...'
                });

                // Step 5: Create TransferAction
                // ⚠️ IMPORTANT: amount must be in Wei (18 decimals for ETH/WETH)
                const amountInWeiString = amountInWei.toString(); // Already parsed as BigInt earlier
                const actionNative: TransferAction = {
                    type: 'transfer',
                    direction: 0,
                    token_index: wethToken.index,
                    amount: amountInWeiString, // ✅ String of Wei (e.g. "100000000000000" for 0.0001 ETH)
                    permit2Nonce: permit2Data.permit2Nonce.toString(),
                    permit2Deadline: permit2Data.permit2Deadline.toString(),
                    permit2Signature: permit2Data.permit2Signature
                };

                // Step 6: Calculate new state
                setProcessingStep('Calculating new state...');
                console.log('🔐 Step 6: Calculating new state...');
                const { newState: newStateNative, operations: operationsNative } = await calculateNewState(
                    oldState,
                    actionNative,
                    profile.nonce || 0
                );

                console.log('✅ New state calculated:');
                console.log(`  - Available Balances: [${newStateNative.available_balances.slice(0, 3).join(', ')}...]`);
                console.log(`  - New Blinder: ${newStateNative.blinder?.substring(0, 20)}...`);
                console.log('  - Operations:', operationsNative);

                // Step 7: Generate proof
                setProcessingStep('Generating proof (this may take a moment)...');
                console.log('🔐 Step 7: Generating wallet update proof...');
                const userSecret = '12312';

                const proofDataNative = await generateWalletUpdateProofClient({
                    userSecret,
                    oldNonce: profile.nonce?.toString() || '0',
                    oldMerkleRoot: profile.merkle_root,
                    oldMerkleIndex: profile.merkle_index,
                    oldHashPath: profile.sibling_paths,
                    oldState,
                    newState: newStateNative,
                    operations: operationsNative
                });

                console.log('✅ Proof generated successfully:', proofDataNative);

                // Step 8: Sign newCommitment
                setProcessingStep('Signing commitment...');
                console.log('🔍 Step 8: Signing newCommitment...');
                const newCommitmentNative = proofDataNative.publicInputs.new_wallet_commitment;
                const rootSignatureNative = await signMessageWithSkRoot(newCommitmentNative);
                console.log('✅ Signature created!');

                // Step 9: Verify proof
                setProcessingStep('Verifying proof...');
                console.log('🔍 Step 9: Verifying proof...');
                const verifyResultNative = await verifyProof({
                    proof: proofDataNative.proof,
                    publicInputs: proofDataNative.publicInputs,
                    wallet_address: walletAddress,
                    operations: operationsNative,
                    signature: rootSignatureNative
                });

                if (verifyResultNative.success) {
                    console.log('✅ Native token deposit completed successfully!', verifyResultNative);
                    setProcessingStep('Deposit completed!');
                    if (verifyResultNative.verified) {
                        // ✅ Refetch profile to update balances in sidebar
                        if (user?.id) {
                            const walletId = extractPrivyWalletId(user.id);
                            await refetchProfile(walletId);
                            console.log('✅ Profile refreshed with new balances');
                        }

                        toast.success(`Deposit verified successfully!\nAmount: ${amount} ${NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol}`, {
                            duration: 5000,
                        });
                    } else {
                        toast.error('Deposit verification failed');
                    }
                } else {
                    console.error('❌ Verification failed:', verifyResultNative.error);
                    toast.error(`Verification failed: ${verifyResultNative.error}`);
                    setIsProcessing(false);
                    setProcessingStep('');
                    return;
                }
            } else {
                console.log('ℹ️ Unknown token type:', selectedTokenType);
                toast.error('Invalid token type selected');
                setIsProcessing(false);
                setProcessingStep('');
                return;
            }

            // ✅ Success → Reset all state and close modal completely
            setIsProcessing(false);
            setProcessingStep('');
            handleClose(); // ✅ Close modal and reset state
        } catch (error) {
            console.error('❌ Error in deposit process:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error occurred');
            // ✅ Error → Ẩn loading overlay, giữ modal để user thử lại
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    const handleStepChange = async (step: number) => {
        // ✅ When moving from Step 1 → Step 2, check if we need to switch chain
        if (currentStep === 1 && step === 2) {
            if (selectedChainId !== currentChain?.id) {
                try {
                    setProcessingStep('Switching chain...');
                    setIsProcessing(true);

                    await switchChain({ chainId: selectedChainId });

                    toast.success(`Switched to ${NETWORKS.find(n => n.chainId === selectedChainId)?.label}`);
                    setIsProcessing(false);
                    setProcessingStep('');
                } catch (error) {
                    console.error('Failed to switch chain:', error);
                    toast.error('Failed to switch chain. Please try again.');
                    setIsProcessing(false);
                    setProcessingStep('');
                    return; // Don't proceed to next step
                }
            }
        }

        setCurrentStep(step);
        setErrorMessage('');
    };

    // Validation logic for each step
    const getValidationForCurrentStep = (): { canProceed: boolean; errorMessage: string } => {
        switch (currentStep) {
            case 1: // Select Chain
                // Always can proceed (chain is always selected with default)
                return { canProceed: true, errorMessage: '' };

            case 2: // Select Token Type
                if (!selectedTokenType) {
                    return {
                        canProceed: false,
                        errorMessage: 'Please select a token type to continue'
                    };
                }
                return { canProceed: true, errorMessage: '' };

            case 3: // Enter Amount
                if (!amount || parseFloat(amount) <= 0) {
                    return {
                        canProceed: false,
                        errorMessage: 'Please enter a valid amount greater than 0'
                    };
                }

                // Check if amount exceeds balance
                const enteredAmount = parseFloat(amount);
                if (selectedTokenType !== 'native') {
                    // ERC20 token balance check
                    const availableBalance = parseFloat(allBalances[selectedTokenType] || '0');
                    if (enteredAmount > availableBalance) {
                        return {
                            canProceed: false,
                            errorMessage: `Insufficient balance. You have ${availableBalance} ${selectedTokenType}`
                        };
                    }
                } else if (selectedTokenType === 'native') {
                    const availableBalance = parseFloat(allBalances.native || '0');
                    if (enteredAmount > availableBalance) {
                        return {
                            canProceed: false,
                            errorMessage: `Insufficient balance. You have ${availableBalance} ${NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol}`
                        };
                    }
                }

                return { canProceed: true, errorMessage: '' };

            case 4: // Review
                return { canProceed: true, errorMessage: '' };

            default:
                return { canProceed: true, errorMessage: '' };
        }
    };

    const validation = getValidationForCurrentStep();

    return (
        <>
            {/* ✅ Fullscreen Loading Overlay - shows when processing */}
            {isProcessing && (
                <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="w-20 h-20 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                    <div className="text-white font-medium text-xl mt-6">{processingStep}</div>
                    <div className="text-gray-400 text-sm mt-2">Please wait, do not close this window...</div>
                </div>
            )}

            {/* ✅ Modal Content - hidden when processing */}
            {!isProcessing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-xl mx-4 bg-gradient-to-b from-gray-900 to-gray-900/95 border border-gray-700/70 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
                        <h2 className="text-xl font-bold text-white">Deposit Assets</h2>
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
                        {/* Step 1: Select Chain */}
                        <Step>
                            <div className="space-y-4">
                                <h3 className="text-base font-semibold text-white/90 mt-1">Select Network</h3>

                                {/* Current Chain Info */}
                                {currentChain && (
                                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                        <div className="text-xs text-blue-300">Currently connected to:</div>
                                        <div className="text-sm text-white font-medium mt-1">
                                            {NETWORKS.find(n => n.chainId === currentChain.id)?.label || `Chain ID: ${currentChain.id}`}
                                        </div>
                                    </div>
                                )}

                                {/* Network Selection */}
                                <div className="grid gap-2.5">
                                    {NETWORKS.map((network) => {
                                        const isCurrentChain = currentChain?.id === network.chainId;
                                        const isSelected = selectedChainId === network.chainId;
                                        const chainInfo = chainMetadata[network.chainId];

                                        return (
                                            <button
                                                key={network.chainId}
                                                onClick={() => setSelectedChainId(network.chainId)}
                                                className={`group w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${
                                                    isSelected
                                                        ? 'border-teal-500 bg-teal-500/10 shadow-lg shadow-teal-500/20'
                                                        : 'border-gray-700/70 bg-gray-800/30 hover:border-teal-500/50 hover:bg-gray-800/50'
                                                }`}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    {chainInfo?.imageUrl ? (
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center p-1">
                                                            <Image
                                                                src={chainInfo.imageUrl}
                                                                alt={network.label}
                                                                width={40}
                                                                height={40}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-500/20 flex items-center justify-center">
                                                            <span className="text-lg">?</span>
                                                        </div>
                                                    )}
                                                    <div className="text-left">
                                                        <div className="text-white font-semibold text-sm flex items-center gap-2">
                                                            {network.label}
                                                            {isCurrentChain && <span className="text-xs text-green-400">(Connected)</span>}
                                                        </div>
                                                        <div className="text-gray-400 text-xs">Chain ID: {network.chainId}</div>
                                                    </div>
                                                </div>
                                                {!isCurrentChain && isSelected && (
                                                    <div className="text-xs text-yellow-400">Will switch chain</div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Switch Chain Warning */}
                                {selectedChainId !== currentChain?.id && (
                                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                        <p className="text-yellow-300 text-xs">
                                            ⚠ You will be prompted to switch to <strong>{NETWORKS.find(n => n.chainId === selectedChainId)?.label}</strong> in the next step.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Step>

                        {/* Step 2: Select Token Type */}
                        <Step>
                            <div className="space-y-4">
                                <h3 className="text-base font-semibold text-white/90 mt-1">Select Token Type</h3>

                                {/* Selected Network Display */}
                                <div className="p-3 bg-gradient-to-r from-teal-500/5 to-blue-500/5 border border-teal-500/30 rounded-lg">
                                    <div className="text-xs text-teal-300">Network:</div>
                                    <div className="text-sm text-white font-medium mt-1">
                                        {NETWORKS.find(n => n.chainId === selectedChainId)?.label}
                                    </div>
                                </div>

                                {/* Token Type Selection */}
                                <div className="grid gap-3">
                                    {/* Native Token */}
                                    <button
                                        onClick={() => setSelectedTokenType('native')}
                                        className={`group w-full p-4 rounded-xl border-2 transition-all duration-200 ${
                                            selectedTokenType === 'native'
                                                ? 'border-teal-500 bg-teal-500/10 shadow-lg shadow-teal-500/20'
                                                : 'border-gray-700/70 bg-gray-800/30 hover:border-teal-500/50 hover:bg-gray-800/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                {chainMetadata[selectedChainId]?.imageUrl ? (
                                                    <div className="w-11 h-11 rounded-full overflow-hidden bg-white flex items-center justify-center p-1.5">
                                                        <Image
                                                            src={chainMetadata[selectedChainId].imageUrl}
                                                            alt={NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol || 'Native'}
                                                            width={44}
                                                            height={44}
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                                                        <span className="text-2xl">💎</span>
                                                    </div>
                                                )}
                                                <div className="text-left">
                                                    <div className="text-white font-semibold text-sm">
                                                        {NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol}
                                                    </div>
                                                    <div className="text-gray-400 text-xs">Native Token</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-gray-500 text-xs mb-0.5">Balance</div>
                                                <div className="text-white/90 font-medium text-sm">
                                                    {isLoadingAllBalances ? '...' : allBalances.native || '0'}
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* ERC20 Tokens - Auto-generated from config */}
                                    {availableERC20Tokens.map((token) => (
                                        <button
                                            key={token.symbol}
                                            onClick={() => setSelectedTokenType(token.symbol)}
                                            className={`group w-full p-4 rounded-xl border-2 transition-all duration-200 ${
                                                selectedTokenType === token.symbol
                                                    ? 'border-teal-500 bg-teal-500/10 shadow-lg shadow-teal-500/20'
                                                    : 'border-gray-700/70 bg-gray-800/30 hover:border-teal-500/50 hover:bg-gray-800/50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-11 h-11 rounded-full flex items-center justify-center">
                                                        <TokenIconBySymbol symbol={token.symbol} size="lg" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-white font-semibold text-sm">{token.symbol}</div>
                                                        <div className="text-gray-400 text-xs">{token.name}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-gray-500 text-xs mb-0.5">Balance</div>
                                                    <div className="text-white/90 font-medium text-sm">
                                                        {isLoadingAllBalances ? '...' : allBalances[token.symbol] || '0'}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </Step>

                        {/* Step 3: Enter Amount */}
                        <Step>
                            {selectedTokenType ? (
                                <div className="space-y-4">
                                    <h3 className="text-base font-semibold text-white/90">Enter Amount</h3>

                                    {/* Token Info Display */}
                                    <div className="p-3 bg-gradient-to-r from-teal-500/5 to-blue-500/5 border border-teal-500/30 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center">
                                                {selectedTokenType === 'native' ? (
                                                    chainMetadata[selectedChainId]?.imageUrl ? (
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center p-1.5">
                                                            <Image
                                                                src={chainMetadata[selectedChainId].imageUrl}
                                                                alt={NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol || 'Native'}
                                                                width={40}
                                                                height={40}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-xl">💎</span>
                                                    )
                                                ) : (
                                                    <TokenIconBySymbol symbol={selectedTokenType as string} size="md" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-white font-semibold text-sm">
                                                    {selectedTokenType === 'native'
                                                        ? NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol
                                                        : selectedTokenType}
                                                </div>
                                                <div className="text-gray-400 text-xs">
                                                    on {NETWORKS.find(n => n.chainId === selectedChainId)?.label}
                                                </div>
                                            </div>
                                        </div>
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
                                                className="w-full px-3 py-2.5 pr-20 bg-gray-800/50 border border-gray-700/70 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">
                                                {selectedTokenType === 'native'
                                                    ? NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol
                                                    : selectedTokenType}
                                            </div>
                                        </div>

                                        <div className="mt-2 space-y-1">
                                            {/* Available Balance */}
                                            <div className="text-xs text-gray-500">
                                                Available: <span className="text-gray-400 font-medium">
                                                    {selectedTokenType === 'native'
                                                        ? allBalances.native || '0'
                                                        : allBalances[selectedTokenType as string] || '0'}
                                                    {' '}
                                                    {selectedTokenType === 'native'
                                                        ? NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol
                                                        : selectedTokenType}
                                                </span>
                                            </div>

                                            {/* Gas fee warning for native */}
                                            {selectedTokenType === 'native' && (
                                                <div className="text-xs text-yellow-500">
                                                    ⚠ Reserve some balance for gas fees
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-400">
                                    Please select a token type first
                                </div>
                            )}
                        </Step>

                        {/* Step 4: Review */}
                        <Step>
                            {selectedTokenType && amount ? (
                                <div className="space-y-5">
                                    <h3 className="text-base font-semibold text-white/90 mb-4">Review your deposit</h3>

                                <div className="p-6 bg-gradient-to-br from-teal-500/10 via-blue-500/5 to-purple-500/10 border border-teal-500/30 rounded-xl space-y-4 shadow-xl shadow-teal-500/5">
                                    <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                                        <span className="text-gray-400 text-sm">Network</span>
                                        <span className="text-white font-medium text-sm">
                                            {NETWORKS.find(n => n.chainId === selectedChainId)?.label}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
                                        <span className="text-gray-400 text-sm">Token</span>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center">
                                                {selectedTokenType === 'native' ? (
                                                    chainMetadata[selectedChainId]?.imageUrl ? (
                                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white flex items-center justify-center p-1">
                                                            <Image
                                                                src={chainMetadata[selectedChainId].imageUrl}
                                                                alt={NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol || 'Native'}
                                                                width={32}
                                                                height={32}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-lg">💎</span>
                                                    )
                                                ) : (
                                                    <TokenIconBySymbol symbol={selectedTokenType as string} size="sm" />
                                                )}
                                            </div>
                                            <span className="text-white font-semibold">
                                                {selectedTokenType === 'native'
                                                    ? NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol
                                                    : selectedTokenType}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between py-3">
                                        <span className="text-gray-400 text-sm">Amount</span>
                                        <span className="text-teal-400 font-bold text-xl">
                                            {amount} {selectedTokenType === 'native'
                                                ? NETWORKS.find(n => n.chainId === selectedChainId)?.nativeSymbol
                                                : selectedTokenType}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl backdrop-blur-sm">
                                    <p className="text-yellow-300/90 text-sm leading-relaxed">
                                        ⚠ Please review your deposit details carefully. This transaction cannot be reversed once confirmed.
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

export default DepositModal;
