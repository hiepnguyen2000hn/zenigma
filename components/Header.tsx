"use client";
import {useSignTypedData} from 'wagmi'
import {HelpCircle} from 'lucide-react';
import {useState} from 'react';
import ConnectButton from './ConnectButton';
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
    /**
     * PART 1: Generate wallet keys and proof payload
     * Returns the prepared payload ready for API submission
     */
    const generateWalletPayload = async () => {
        console.log('🚀🌐 Step 1: CLIENT-SIDE Wallet Init (Noir in Browser)...');

        const walletAddress = wallets.find(wallet => wallet.connectorType === 'embedded')?.address;
        if (!walletAddress) {
            throw new Error('Please connect wallet first!');
        }

        const chainId = 11155111; // Sepolia testnet

        // Step 2: Sign EIP-712 message
        const eip712Signature = await signTypedDataAsync({
            domain: {
                name: "Zenigma Auth",
                version: "1",
                chainId
            },
            types: {
                Auth: [{name: "message", type: "string"}]
            },
            primaryType: 'Auth',
            message: {
                message: "Zenigma Authentication"
            }
        });

        console.log('✅ Step 2: EIP-712 signed!');
        console.log('  - Signature:', eip712Signature.substring(0, 20) + '...');

        // Step 3: Derive keys CLIENT-SIDE
        console.log('🔑 Step 3: Deriving keys CLIENT-SIDE...');
        const keysResult = await deriveKeysFromSignature(eip712Signature, chainId);

        if (!keysResult.success || !keysResult.keys) {
            throw new Error(keysResult.error || 'Failed to derive keys');
        }

        const keys = keysResult.keys;
        console.log('✅ Step 3: Keys derived CLIENT-SIDE!');
        console.log('  - sk_root:', keys.sk_root.substring(0, 20) + '...');
        console.log('  - pk_root.address:', keys.pk_root.address);
        console.log('  - pk_match:', keys.pk_match.substring(0, 20) + '...');
        console.log('  - sk_match:', keys.sk_match.substring(0, 20) + '...');
        console.log('  - blinder_seed:', keys.blinder_seed.substring(0, 20) + '...');

        // Save all keys to localStorage
        saveAllKeys({
            sk_root: keys.sk_root,
            pk_root: keys.pk_root.address,
            pk_match: keys.pk_match,
            sk_match: keys.sk_match
        });
        console.log('💾 All wallet keys saved to localStorage');

        // Step 4: Generate proof CLIENT-SIDE
        console.log('🔐 Step 4: Generating proof CLIENT-SIDE with useGenerateWalletInit (may take 3-8s)...');
        const proofResult = await generateWalletInit({
            userSecret: "1234",
            blinder_seed: keys.blinder_seed,
            pk_root: keys.pk_root.address,
            pk_match: keys.pk_match,
            sk_match: keys.sk_match
        });

        console.log(proofResult, 'proofResult');
        if (!proofResult.success) {
            throw new Error(proofResult.error || 'Failed to generate proof');
        }

        console.log('✅ Step 4: Proof generated using useGenerateWalletInit!');
        console.log('  - Proof:', proofResult.proof?.substring(0, 20) + '...');
        console.log('  - Commitment:', proofResult.publicInputs?.initial_commitment.substring(0, 20) + '...');
        console.log('  - Timing:', proofResult.timing);

        // Step 5: Sign initial commitment with ethers
        console.log('📝 Step 5: Signing initial commitment with ethers...');
        const commitmentSignature = await signMessageWithSkRoot(
            proofResult.publicInputs!.initial_commitment
        );

        console.log('✅ Step 5: Commitment signed with ethers!');
        console.log('  - Signature:', commitmentSignature.substring(0, 20) + '...');

        // Step 6: Prepare final payload
        console.log('📦 Step 6: Preparing final payload...');
        const walletId = extractPrivyWalletId(user.id);

        const finalPayload = {
            proof: proofResult.proof!,
            wallet_address: walletAddress,
            signature: commitmentSignature,
            pk_root: keys.pk_root.address,
            blinder: keys.blinder_seed,
            pk_match: keys.pk_match,
            sk_match: keys.sk_match,
            publicInputs: {
                initial_commitment: proofResult.publicInputs!.initial_commitment
            },
            wallet_id: walletId,
            proofTiming: proofResult.timing // Include timing for success message
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

        return finalPayload;
    };

    /**
     * PART 2: Submit payload to backend API
     * Calls the initWalletProof API with the prepared payload
     */
    const initWalletWithPayload = async (payload: any) => {

        const finalResult = await initWalletProof(payload);

        return finalResult;
    };

    /**
     * Main wallet initialization handler
     * Orchestrates the two-part process: generate payload and conditionally submit to API
     *
     * @param is_initialized - Whether user wallet is already initialized (from profile)
     */
    const hdlInitWalletClientSide = async (is_initialized?: boolean) => {
        try {
            // Check if keys already exist in localStorage
            console.log('🔍 [hdlInitWalletClientSide] Checking localStorage for existing keys...');
            const existingPkRoot = localStorage.getItem('pk_root');

            if (existingPkRoot) {
                console.log('✅ [hdlInitWalletClientSide] Keys already exist in localStorage');
                console.log('  - pk_root:', existingPkRoot.substring(0, 20) + '...');
                console.log('ℹ️ [hdlInitWalletClientSide] Skipping key generation - using existing keys');
                return;
            }

            // Part 1: Generate wallet payload (keys + proof) if keys don't exist
            console.log('🔐 [hdlInitWalletClientSide] No existing keys found - starting key generation...');
            const payload = await generateWalletPayload();
            console.log('✅ [hdlInitWalletClientSide] Keys generated and saved to localStorage');
            console.log(payload, 'payload generated');


            if (is_initialized === false) {
                await initWalletWithPayload({
                    proof: payload.proof,
                    wallet_address: payload.wallet_address,
                    signature: payload.signature,
                    pk_root: payload.pk_root,
                    blinder: payload.blinder,
                    pk_match: payload.pk_match,
                    sk_match: payload.sk_match,
                    publicInputs: payload.publicInputs,
                    wallet_id: payload.wallet_id
                });
            }

        } catch (error) {
            console.error('❌ Error in CLIENT-SIDE wallet init:', error);
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

                    <ConnectButton
                        onLoginSuccess={hdlInitWalletClientSide}
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
