"use client";
import {useSignTypedData} from 'wagmi'
import {HelpCircle} from 'lucide-react';
import {useState} from 'react';
import ConnectButton from './ConnectButton';
import ChainSelector from './ChainSelector';
import TokenDisplay from './TokenDisplay';
import ProofTestModal from './ProofTestModal';
import DepositModal from './DepositModal';
import {usePrivy, useSignMessage} from '@privy-io/react-auth';
import {useWallets} from '@privy-io/react-auth';
import {useProof, useWalletUpdateProof} from '@/hooks/useProof';
import {useUSDC} from '@/hooks/useUSDC';
import {usePermit2Signature} from '@/hooks/usePermit2Signature'
import {getAllTokens, getUserProfile, initWalletProof} from "@/lib/services";
import {useEffect} from 'react';
import {DARKPOOL_CORE_ADDRESS, MOCK_USDC_ADDRESS} from '@/lib/constants';
import {type OrderAction, type TransferAction, type WalletState} from '@/hooks/useProof';
import {useImportWallet} from '@privy-io/react-auth';
import {useClientProof} from '@/hooks/useClientProof';
import {useGenerateWalletInit} from '@/hooks/useGenerateWalletInit';
import {saveAllKeys, signMessageWithSkRoot} from '@/lib/ethers-signer';
import {extractPrivyWalletId} from '@/lib/wallet-utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

interface HeaderProps {
    onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps = {}) => {
    const [isProofModalOpen, setIsProofModalOpen] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const pathname = usePathname();
    const SPENDER_ADDRESS = DARKPOOL_CORE_ADDRESS;
    const {signPermit2FE} = usePermit2Signature();
    const {exportWallet, user} = usePrivy();
    const {wallets} = useWallets();
    const {signMessage} = useSignMessage();
    const {signTypedDataAsync} = useSignTypedData();
    const {verifyProof, isVerifying, error, calculateNewState, cancelOrder} = useProof();
    const {importWallet} = useImportWallet();
    const {deriveKeysFromSignature, generateInitProofClient, isGenerating, progress} = useClientProof();
    const {generateWalletInit} = useGenerateWalletInit();
    const {generateWalletUpdateProofClient} = useWalletUpdateProof();
    const {
        approve,
        isApprovePending,
        isApproveConfirming,
        isApproveSuccess,
        balance,
        isConnected,
        allowance,
        refetchAllowance
    } = useUSDC('0x201E43b479Eb8f43bC3C2Ac83575943A9Ea6c85a');
    const exchanges = [
        {name: 'BBQ Feeds', price: ''},
        {name: 'Binance', price: '$106,061.84', status: 'LIVE'},
        {name: 'Coinbase', price: '$106,171.61', status: 'LIVE'},
        {name: 'Kraken', price: '$106,149.95', status: 'LIVE'},
        {name: 'OKX', price: '$0.00', status: 'LIVE'},
    ];
    const handleSign = async () => {
        const permit2Data = await signPermit2FE({
            token: MOCK_USDC_ADDRESS,
            amount: BigInt(100000000),
            spender: DARKPOOL_CORE_ADDRESS,
        })
        console.log('Permit2 Data:', permit2Data)
        return permit2Data
    }
    const hdlApproveUSDC = async () => {
        try {
            if (!isConnected) {
                toast.error('Please connect wallet first!');
                return;
            }
            console.log('pass')
            const AMOUNT = '200'; // 2 USDC

            console.log('💰 Current USDC Balance:', balance);

            // Step 1: Check current allowance
            console.log('🔍 Step 1: Checking current allowance...');
            console.log(`📊 Current allowance: ${allowance} USDC`);

            // Step 2: Compare allowance with amount
            const currentAllowance = parseFloat(allowance);
            const requiredAmount = parseFloat(AMOUNT);

            // if (currentAllowance >= requiredAmount) {
            //     console.log(`✅ Allowance already sufficient! Current: ${currentAllowance} USDC, Required: ${requiredAmount} USDC`);
            //     alert(`Allowance already sufficient!\nCurrent: ${currentAllowance} USDC\nRequired: ${requiredAmount} USDC\n\nNo need to approve again.`);
            //     return;
            // }

            // Step 3: Need to approve
            console.log(`⚠️ Allowance insufficient! Current: ${currentAllowance} USDC, Required: ${requiredAmount} USDC`);
            console.log('🔐 Step 2: Approving 2 USDC to spender:', SPENDER_ADDRESS);

            await approve('0xAC22c976371e123b8D5B20B7F3079C964cAfaa23', AMOUNT);

            console.log('✅ Approval transaction submitted!');
        } catch (error) {
            console.error('❌ Error approving USDC:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        }
    };

    const hdlInitProof = async () => {
        try {
            console.log('🚀 Step 1: Generating proof...');

            // Generate proof
            const response = await fetch('/api/proof/generate-wallet-init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({userSecret: '12312'}),
            });

            if (!response.ok) {
                throw new Error(`Generate proof failed: ${response.status}`);
            }

            const proofData = await response.json();
            console.log('✅ Step 2: Proof generated successfully:', proofData);
            console.log(wallets, 'wallets');
            // Get wallet address
            const walletAddress = wallets.find(wallet => wallet.connectorType === 'embedded')?.address;
            console.log('📍 Step 3: Using wallet address:', proofData);

            const signatureData = await signMessage(
                {message: proofData.publicInputs.initial_commitment},
                {address: walletAddress as string}
            );
            console.log('Signature data:', signatureData);
            // Verify proof
            console.log('🔍 Step 4: Verifying proof...');
            const verifyResult = await verifyProof({
                proof: proofData.proof,
                publicInputs: {
                    initial_commitment: proofData.publicInputs.initial_commitment
                },
                circuitName: 'wallet_balance_update',
                wallet_address: walletAddress as string,
                randomness: proofData.randomness,
                signature: signatureData.signature
            });

            if (verifyResult.success) {
                console.log('✅ Step 5: Proof verified successfully!', verifyResult);
                verifyResult.verified
                    ? toast.success('Proof verified successfully!')
                    : toast.error('Proof verification failed');
            } else {
                console.error('❌ Step 5: Verification failed:', verifyResult.error);
                toast.error(`Verification failed: ${verifyResult.error}`);
            }

        } catch (error) {
            console.error('❌ Error in proof process:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        }
    }

    const hdlUpdateWallet = async () => {
        try {
            console.log('🚀 Step 1: Updating wallet...');

            // Get wallet address
            const walletAddress = wallets.find(wallet => wallet.connectorType === 'embedded')?.address;
            if (!walletAddress) {
                toast.error('Please connect wallet first!');
                return;
            }

            // Get Privy user ID
            if (!user?.id) {
                toast.error('Please authenticate with Privy first!');
                return;
            }

            // ✅ Extract wallet_id from Privy user ID (remove "did:privy:" prefix)
            const walletId = extractPrivyWalletId(user.id);

            // Fetch user profile to get old state (using API client with wallet_id)
            console.log('📊 Step 2: Fetching user profile...');
            console.log('  - Full Privy user ID:', user.id);
            console.log('  - Wallet ID (without prefix):', walletId);
            const profile = await getUserProfile(walletId);
            console.log('✅ Profile loaded:', profile);

            const oldState: WalletState = {
                available_balances: profile.available_balances || Array(10).fill('0'),
                reserved_balances: profile.reserved_balances || Array(10).fill('0'),
                orders_list: profile.orders_list || Array(4).fill(null),
                fees: profile.fees?.toString() || '0',
                blinder: profile.blinder,  // ✅ Add blinder from profile
            };

            // ✅ Step 2.5: Sign Permit2 TRƯỚC để lấy permit2 data
            console.log('🔍 Step 2.5: Signing Permit2...');
            const permit2Data = await handleSign();
            console.log('✅ Permit2 signed:', {
                nonce: permit2Data.permit2Nonce.toString(),
                deadline: permit2Data.permit2Deadline.toString(),
                signature: permit2Data.permit2Signature.substring(0, 20) + '...'
            });

            const action: TransferAction = {
                type: 'transfer',
                direction: 0,                    // ✅ 0 = DEPOSIT
                token_index: 0,                  // ✅ Token 0 (USDC)
                amount: '100',             // 100 USDC (6 decimals)
                // ✅ Permit2 data từ handleSign
                permit2Nonce: permit2Data.permit2Nonce.toString(),
                permit2Deadline: permit2Data.permit2Deadline.toString(),
                permit2Signature: permit2Data.permit2Signature
            };

            // const action: TransferAction = {
            //     type: 'transfer',
            //     direction: 1,                    // ✅ 1 = WITHDRAW
            //     token_index: 0,                  // ✅ Token 0 (USDC)
            //     amount: '100',             // 100 USDC (6 decimals)
            //     // ✅ Permit2 data từ handleSign
            //     permit2Nonce: permit2Data.permit2Nonce.toString(),
            //     permit2Deadline: permit2Data.permit2Deadline.toString(),
            //     permit2Signature: permit2Data.permit2Signature
            // };



            // const action: OrderAction = {
            //     type: 'order',
            //     operation_type: 1,
            //     order_index: 0,
            // };


            console.log('🔐 Step 3: Calculating new state with new blinder...');
            // ✅ calculateNewState now derives newBlinder internally
            const {newState, operations} = await calculateNewState(
                oldState,
                action,
                profile.nonce || 0  // ✅ Pass oldNonce for deriving newBlinder
            );

            console.log('✅ New state calculated with new blinder:');
            console.log(`  - Available Balances: [${newState.available_balances.slice(0, 3).join(', ')}...]`);
            console.log(`  - Reserved Balances: [${newState.reserved_balances.slice(0, 3).join(', ')}...]`);
            console.log(`  - Orders: ${newState.orders_list.filter((o) => o !== null).length} active orders`);
            console.log(`  - New Blinder: ${newState.blinder?.substring(0, 20)}...`);
            console.log('  - Operations:', operations);

            // Generate proof with operations
            console.log('🔐 Step 4: Generating wallet update proof with operations...');
            const userSecret = '12312';

            // ✅ Use CLIENT-SIDE proof generation
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
            console.log('📋 Public Inputs:', proofData.publicInputs);

            // Step 5: Sign newCommitment with ethers (using sk_root from localStorage)
            console.log('🔍 Step 5: Signing newCommitment with ethers...');
            const newCommitment = proofData.publicInputs.new_wallet_commitment;
            console.log('Signing message (newCommitment):', newCommitment);

            // ✅ Sign with ethers wallet (sk_root from localStorage)
            const rootSignature = await signMessageWithSkRoot(newCommitment);
            console.log('✅ Signature created with ethers!');
            console.log('  - Root signature:', rootSignature.substring(0, 30) + '...');

            console.log('🔍 Step 6: Verifying proof with auto-generated operations...');
            // const verifyResult = await verifyProof({
            //     proof: proofData.proof,
            //     publicInputs: proofData.publicInputs,
            //     wallet_address: walletAddress,
            //     operations,
            //     signature: rootSignature
            // });

            // const verifyResult = await cancelOrder({
            //     proof: proofData.proof,
            //     publicInputs: proofData.publicInputs,
            //     wallet_address: walletAddress,
            //     operations,
            //     signature: rootSignature
            // });

            if (verifyResult.success) {
                console.log('✅ Step 7: Wallet update verified successfully!', verifyResult);
                verifyResult.verified
                    ? toast.success('Wallet update verified successfully!')
                    : toast.error('Wallet update verification failed');
            } else {
                console.error('❌ Step 7: Verification failed:', verifyResult.error);
                toast.error(`Verification failed: ${verifyResult.error}`);
            }

        } catch (error) {
            console.error('❌ Error in wallet update process:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        }
    };

    // ✅ CLIENT-SIDE PROOF GENERATION (using Noir in browser)
    const hdlInitWalletClientSide = async () => {

        try {
            console.log('🚀🌐 Step 1: CLIENT-SIDE Wallet Init (Noir in Browser)...');
            // exportWallet(); //
            // return
            // Get wallet address
            const walletAddress = wallets.find(wallet => wallet.connectorType === 'embedded')?.address;
            if (!walletAddress) {
                toast.error('Please connect wallet first!');
                return;
            }

            const chainId = 11155111; // Sepolia testnet

            const eip712Signature = await signTypedDataAsync({
                domain: {
                    name: "Renegade Auth",
                    version: "1",
                    chainId
                },
                types: {
                    Auth: [{name: "message", type: "string"}]
                },
                primaryType: 'Auth',
                message: {
                    message: "Renegade Authentication"
                }
            });

            console.log('✅ Step 2: EIP-712 signed!');
            console.log('  - Signature:', eip712Signature.substring(0, 20) + '...');

            // ============================================
            // STEP 3: Derive keys CLIENT-SIDE
            // ============================================
            console.log('🔑 Step 3: Deriving keys CLIENT-SIDE...');

            const keysResult = await deriveKeysFromSignature(eip712Signature, chainId);

            if (!keysResult.success || !keysResult.keys) {
                throw new Error(keysResult.error || 'Failed to derive keys');
            }

            const keys = keysResult.keys;
            console.log('✅ Step 3: Keys derived CLIENT-SIDE!');
            console.log('  - sk_root:', keys.sk_root.substring(0, 20) + '...');
            console.log('  - pk_root.address:', keys.pk_root.address);
            // console.log('  - pk_root.publicKey:', keys.pk_root.publicKey.substring(0, 20) + '...');
            console.log('  - pk_match:', keys.pk_match.substring(0, 20) + '...');
            console.log('  - sk_match:', keys.sk_match.substring(0, 20) + '...');
            console.log('  - blinder_seed:', keys.blinder_seed.substring(0, 20) + '...');

            // ✅ Save all 4 keys to localStorage for later use
            saveAllKeys({
                sk_root: keys.sk_root,
                pk_root: keys.pk_root.address,
                pk_match: keys.pk_match,
                sk_match: keys.sk_match
            });
            console.log('💾 All wallet keys saved to localStorage');

            // ============================================
            // STEP 4: Generate proof CLIENT-SIDE (Browser) - Using useGenerateWalletInit
            // ============================================
            console.log('🔐 Step 4: Generating proof CLIENT-SIDE with useGenerateWalletInit (may take 3-8s)...');

            // ✅ Call generateWalletInit with all required params
            const proofResult = await generateWalletInit({
                userSecret: "1234",
                blinder_seed: keys.blinder_seed,
                pk_root: keys.pk_root.address,
                pk_match: keys.pk_match,
                sk_match: keys.sk_match  // ✅ Add sk_match
            });
            console.log(proofResult, 'proofResult')
            if (!proofResult.success) {
                throw new Error(proofResult.error || 'Failed to generate proof');
            }

            console.log('✅ Step 4: Proof generated using useGenerateWalletInit!');
            console.log('  - Proof:', proofResult.proof?.substring(0, 20) + '...');
            console.log('  - Commitment:', proofResult.publicInputs?.initial_commitment.substring(0, 20) + '...');
            console.log('  - Randomness:', proofResult.randomness?.substring(0, 20) + '...');
            console.log('  - Verified:', proofResult.verified);
            console.log('  - Timing:', proofResult.timing);

            // ============================================
            // STEP 5: Sign initial commitment with ethers (using sk_root from localStorage)
            // ============================================
            console.log('📝 Step 5: Signing initial commitment with ethers...');

            // ✅ Sign with ethers wallet (sk_root from localStorage)
            const commitmentSignature = await signMessageWithSkRoot(
                proofResult.publicInputs!.initial_commitment
            );

            console.log('✅ Step 5: Commitment signed with ethers!');
            console.log('  - Signature:', commitmentSignature.substring(0, 20) + '...');

            // ============================================
            // STEP 6: Prepare final payload and call initWalletProof API
            // ============================================
            console.log('📦 Step 6: Preparing final payload...');
            const walletId = extractPrivyWalletId(user.id);

            const finalPayload = {
                proof: proofResult.proof!,
                wallet_address: walletAddress,
                signature: commitmentSignature, // ✅ ethers returns string directly
                pk_root: keys.pk_root.address, // ✅ Use Ethereum address from ECDSA wallet
                blinder: keys.blinder_seed,
                pk_match: keys.pk_match,
                sk_match: keys.sk_match,
                publicInputs: {
                    initial_commitment: proofResult.publicInputs!.initial_commitment
                },
                wallet_id: walletId,

            };

            console.log('✅ Step 6: Final payload prepared:', {
                proof: finalPayload.proof.substring(0, 30) + '...',
                wallet_address: finalPayload.wallet_address,
                signature: finalPayload.signature.substring(0, 30) + '...',
                pk_root: finalPayload.pk_root,
                blinder: finalPayload.blinder.substring(0, 30) + '...',
                pk_match: finalPayload.pk_match.substring(0, 30) + '...',
                sk_match: finalPayload.sk_match.substring(0, 30) + '...',
                publicInputs: finalPayload.publicInputs
            });

            // ============================================
            // STEP 7: Call initWalletProof API
            // ============================================
            console.log('🚀 Step 7: Calling initWalletProof API...');

            const finalResult = await initWalletProof(finalPayload);

            console.log('✅ Step 7: Wallet initialization completed (CLIENT-SIDE)!');
            console.log('Final result:', finalResult);

            toast.success(
                `Wallet initialized successfully!\nProof generated in ${proofResult.timing?.total}ms`,
                { duration: 5000 }
            );

        } catch (error) {
            console.error('❌ Error in CLIENT-SIDE wallet init:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        }
    };

    // ✅ SERVER-SIDE PROOF GENERATION (Original V2 - using backend API)
    const hdlInitWalletV2 = async () => {
        try {
            console.log('🚀 Step 1: Initializing wallet with V2 API...');

            // Get wallet address
            const walletAddress = wallets.find(wallet => wallet.connectorType === 'embedded')?.address;
            if (!walletAddress) {
                toast.error('Please connect wallet first!');
                return;
            }
            // exportWallet(); //
            // return
            // ============================================
            // STEP 2: Derive keys with V2 API
            // ============================================
            console.log('🔑 Step 2: Deriving keys with V2 API...');
            const chainId = 11155111; // Sepolia testnet

            const v2Response = await fetch(`/api/proof/generate-wallet-init-v2`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    privateKey: 'b017b8a789c3ba15fa70093ab5915805a0f776be6a3e9043bc8ebccb7ecc231f',
                    chainId: chainId
                }),
            });

            if (!v2Response.ok) {
                const errorData = await v2Response.json().catch(() => ({}));
                throw new Error(errorData.message || `V2 API error: ${v2Response.status}`);
            }

            const keysData = await v2Response.json();
            console.log('✅ Step 2: Keys derived successfully!');
            console.log('  - sk_root:', keysData.keys.sk_root.substring(0, 20) + '...');
            console.log('  - pk_root:', keysData.keys.pk_root.substring(0, 20) + '...');
            console.log('  - pk_match:', keysData.keys.pk_match.substring(0, 20) + '...');
            console.log('  - sk_match:', keysData.keys.sk_match.substring(0, 20) + '...');
            console.log('  - blinder_seed:', keysData.keys.blinder_seed.substring(0, 20) + '...');

            // ============================================
            // STEP 3: Generate initial proof (hdlInitProof logic)
            // ============================================
            console.log('🔐 Step 3: Generating initial proof...');

            const proofResponse = await fetch('/api/proof/generate-wallet-init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userSecret: keysData.keys.sk_root  // ✅ Use sk_root as userSecret
                }),
            });

            if (!proofResponse.ok) {
                throw new Error(`Generate proof failed: ${proofResponse.status}`);
            }

            const proofData = await proofResponse.json();
            console.log('✅ Step 3: Proof generated successfully!');
            console.log('  - Proof:', proofData.proof.substring(0, 20) + '...');
            console.log('  - Initial Commitment:', proofData.publicInputs.initial_commitment.substring(0, 20) + '...');
            console.log('  - Randomness:', proofData.randomness.substring(0, 20) + '...');

            // ============================================
            // STEP 4: Sign initial commitment
            // ============================================
            console.log('📝 Step 4: Signing initial commitment...');

            const signatureData = await signMessage(
                {message: proofData.publicInputs.initial_commitment},
                {address: walletAddress as string}
            );

            console.log('✅ Step 4: Commitment signed!');
            console.log('  - Signature:', signatureData.signature.substring(0, 20) + '...');

            // ============================================
            // STEP 5: Prepare final payload
            // ============================================
            console.log('📦 Step 5: Preparing final payload...');

            const finalPayload = {
                proof: proofData.proof,
                wallet_address: walletAddress,
                blinder: keysData.keys.blinder_seed,
                signature: signatureData.signature,
                pk_root: keysData.keys.pk_root,
                pk_match: keysData.keys.pk_match,
                sk_match: keysData.keys.sk_match,
                publicInputs: {
                    initial_commitment: proofData.publicInputs.initial_commitment
                }
            };

            console.log('✅ Step 5: Final payload prepared:', {
                proof: finalPayload.proof.substring(0, 30) + '...',
                wallet_address: finalPayload.wallet_address,
                blinder: finalPayload.blinder.substring(0, 30) + '...',
                signature: finalPayload.signature.substring(0, 30) + '...',
                pk_root: finalPayload.pk_root.substring(0, 30) + '...',
                pk_match: finalPayload.pk_match.substring(0, 30) + '...',
                sk_match: finalPayload.sk_match.substring(0, 30) + '...',
                publicInputs: finalPayload.publicInputs
            });

            // ============================================
            // STEP 6: Send to final API
            // ============================================
            console.log('🚀 Step 6: Sending to final API...');

            const finalResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/proofs/init-wallet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalPayload),
            });

            if (!finalResponse.ok) {
                const errorData = await finalResponse.json().catch(() => ({}));
                console.error('❌ Final API error:', errorData);
                throw new Error(errorData.message || `Final API error: ${finalResponse.status}`);
            }

            const finalResult = await finalResponse.json();

            console.log('✅ Step 6: Wallet initialization completed!');
            console.log('Final result:', finalResult);

            toast.success('Wallet V2 initialized successfully!', { duration: 5000 });

        } catch (error) {
            console.error('❌ Error in V2 wallet initialization:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        }
    };

    const fetchTokens = async () => {
        console.log('call token')
        const response = await getAllTokens()
        console.log('Tokens:', response);
    }

    useEffect(() => {
        fetchTokens()
    }, [])


    return (
        <header className="border-b border-gray-800 bg-black">
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center space-x-8">
                    <div className="text-2xl font-bold">R</div>

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
                    {/* Deposit Button */}
                    <button
                        onClick={() => setIsDepositModalOpen(true)}
                        className="px-4 py-2 bg-black border border-white text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
                    >
                        Deposit
                    </button>

                    <ChainSelector/>
                    <ConnectButton
                        onLoginSuccess={() =>hdlInitWalletClientSide}
                        onToggleSidebar={onToggleSidebar}
                    />
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
