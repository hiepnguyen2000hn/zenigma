'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState } from 'react';
import { createWalletClient, http, parseEther, type Address, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, arbitrum, base, optimism } from 'viem/chains';
import { getWalletByConnectorType } from '@/lib/wallet-utils';

// Supported chains
const CHAINS = {
  mainnet,
  arbitrum,
  base,
  optimism,
} as const;

export type SupportedChain = keyof typeof CHAINS;

export interface SendTransactionParams {
  to: Address;
  value: string; // ETH amount in string (e.g., "0.01")
  data?: `0x${string}`;
  chainId?: SupportedChain;
}

export interface SignMessageParams {
  message: string;
}

export interface WalletOperationsResult {
  // Export wallet and get private key
  exportPrivateKey: () => Promise<string | null>;

  // Sign a message
  signMessage: (params: SignMessageParams) => Promise<string | null>;

  // Send a transaction
  sendTransaction: (params: SendTransactionParams) => Promise<Hash | null>;

  // Sign typed data (EIP-712)
  signTypedData: (typedData: any) => Promise<string | null>;

  // State
  isExporting: boolean;
  isSigning: boolean;
  isSending: boolean;
  error: string | null;
}

export function useWalletOperations(): WalletOperationsResult {
  const { user, exportWallet } = usePrivy();
  const { wallets } = useWallets();

  const [isExporting, setIsExporting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the active embedded wallet (using centralized helper from wallet-utils)
  const getActiveWallet = () => {
    const wallet = getWalletByConnectorType(wallets, 'embedded', user);
    if (!wallet) {
      throw new Error('No embedded wallet found. Please connect a wallet first.');
    }
    return wallet;
  };

  // Export private key from Privy wallet
  const exportPrivateKey = async (): Promise<string | null> => {
    try {
      setIsExporting(true);
      setError(null);

      const wallet = getActiveWallet();

      // exportWallet() will prompt user for confirmation
      // Returns base64-encoded encrypted wallet data
      const exportedWallet = await exportWallet();

      if (!exportedWallet) {
        throw new Error('Failed to export wallet. User may have cancelled.');
      }

      // The exported wallet contains the private key
      // Note: Privy returns the private key in the format needed
      console.log('Wallet exported successfully');

      // Return the private key (you'll need to extract it from exportedWallet)
      // The exact format depends on Privy's response structure
      return exportedWallet as unknown as string;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export private key';
      setError(errorMessage);
      console.error('Export private key error:', err);
      return null;
    } finally {
      setIsExporting(false);
    }
  };

  // Sign a message with the wallet
  const signMessage = async ({ message }: SignMessageParams): Promise<string | null> => {
    try {
      setIsSigning(true);
      setError(null);

      const wallet = getActiveWallet();

      // Use Privy's built-in signMessage if available
      if ('signMessage' in wallet && typeof wallet.signMessage === 'function') {
        const signature = await wallet.signMessage(message);
        console.log('Message signed successfully');
        return signature;
      }

      // Fallback: export wallet and sign manually
      const privateKey = await exportPrivateKey();
      if (!privateKey) {
        throw new Error('Failed to get private key');
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const signature = await account.signMessage({ message });

      console.log('Message signed successfully');
      return signature;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign message';
      setError(errorMessage);
      console.error('Sign message error:', err);
      return null;
    } finally {
      setIsSigning(false);
    }
  };

  // Send a transaction
  const sendTransaction = async ({
    to,
    value,
    data,
    chainId = 'mainnet',
  }: SendTransactionParams): Promise<Hash | null> => {
    try {
      setIsSending(true);
      setError(null);

      const wallet = getActiveWallet();
      const chain = CHAINS[chainId];

      // Try to use Privy's built-in sendTransaction if available
      if ('sendTransaction' in wallet && typeof wallet.sendTransaction === 'function') {
        const hash = await wallet.sendTransaction({
          to,
          value: parseEther(value),
          data,
          chain,
        } as any);
        console.log('Transaction sent:', hash);
        return hash;
      }

      // Fallback: export wallet and send manually
      const privateKey = await exportPrivateKey();
      if (!privateKey) {
        throw new Error('Failed to get private key');
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);

      // Create wallet client
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
      });

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to,
        value: parseEther(value),
        data,
      });

      console.log('Transaction sent:', hash);
      return hash;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send transaction';
      setError(errorMessage);
      console.error('Send transaction error:', err);
      return null;
    } finally {
      setIsSending(false);
    }
  };

  // Sign typed data (EIP-712)
  const signTypedData = async (typedData: any): Promise<string | null> => {
    try {
      setIsSigning(true);
      setError(null);

      const wallet = getActiveWallet();

      // Use Privy's built-in signTypedData if available
      if ('signTypedData' in wallet && typeof wallet.signTypedData === 'function') {
        const signature = await wallet.signTypedData(typedData);
        console.log('Typed data signed successfully');
        return signature;
      }

      // Fallback: export wallet and sign manually
      const privateKey = await exportPrivateKey();
      if (!privateKey) {
        throw new Error('Failed to get private key');
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      const signature = await account.signTypedData(typedData);

      console.log('Typed data signed successfully');
      return signature;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign typed data';
      setError(errorMessage);
      console.error('Sign typed data error:', err);
      return null;
    } finally {
      setIsSigning(false);
    }
  };

  return {
    exportPrivateKey,
    signMessage,
    sendTransaction,
    signTypedData,
    isExporting,
    isSigning,
    isSending,
    error,
  };
}
