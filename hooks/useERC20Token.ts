import { useState, useEffect } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig, useBalance } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseUnits, formatUnits, formatEther } from 'viem';
import { getTokenConfig, type ERC20TokenConfig } from '@/lib/constants';

// ERC20 ABI - Only the functions we need
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

/**
 * Generic ERC20 Token Hook - Works with any ERC20 token!
 *
 * @param tokenSymbol - Token symbol from ERC20_TOKENS config (e.g., 'USDC', 'USDT', 'DAI')
 * @param spenderAddress - Optional spender address for allowance
 *
 * @example
 * const { balance, approve } = useERC20Token('USDC', PERMIT2_ADDRESS);
 * const { balance, approve } = useERC20Token('USDT', PERMIT2_ADDRESS);
 */
export function useERC20Token(tokenSymbol: string, spenderAddress?: `0x${string}`) {
  const { wallets } = useWallets();
  const config = useConfig();
  const [userAddress, setUserAddress] = useState<`0x${string}` | undefined>();

  // Get token config
  const tokenConfig = getTokenConfig(tokenSymbol);
  if (!tokenConfig) {
    throw new Error(`Token ${tokenSymbol} not found in ERC20_TOKENS config`);
  }

  const { address: tokenAddress, decimals } = tokenConfig;

  // Get embedded wallet address
  useEffect(() => {
    const embeddedWallet = wallets.find(wallet => wallet.connectorType === 'embedded');
    if (embeddedWallet?.address) {
      setUserAddress(embeddedWallet.address as `0x${string}`);
    }
  }, [wallets]);

  // Check if wallet is connected
  const isConnected = !!userAddress;

  // Get native token balance (ETH/SepoliaETH)
  const {
    data: nativeBalanceData,
    refetch: refetchNativeBalance,
    isLoading: isLoadingNativeBalance
  } = useBalance({
    address: userAddress,
    query: {
      enabled: !!userAddress,
    }
  });

  // Format native balance
  const nativeBalance = nativeBalanceData
    ? formatEther(nativeBalanceData.value)
    : '0';

  // Get ERC20 token balance
  const {
    data: balanceData,
    refetch: refetchBalance,
    isLoading: isLoadingBalance
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    }
  });

  // Format balance with correct decimals
  const balance = balanceData
    ? formatUnits(balanceData as bigint, decimals)
    : '0';

  // Get allowance for spender (if spenderAddress is provided)
  const {
    data: allowanceData,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && spenderAddress ? [userAddress, spenderAddress] : undefined,
    query: {
      enabled: !!(userAddress && spenderAddress),
    }
  });

  // Format allowance with correct decimals
  const allowance = allowanceData
    ? formatUnits(allowanceData as bigint, decimals)
    : '0';

  // Approve token
  const {
    writeContractAsync: approveWriteAsync,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  // Wait for approve transaction
  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproveSuccess
  } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Approve function - Waits for transaction confirmation
  const approve = async (spender: `0x${string}`, amount: string) => {
    if (!userAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const amountInWei = parseUnits(amount, decimals);

      console.log(`🔐 Approving ${tokenSymbol}...`, amountInWei);
      const txHash = await approveWriteAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amountInWei],
      });

      console.log('⏳ Waiting for transaction confirmation...', txHash);
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });

      console.log('✅ Transaction confirmed!', receipt);

      // Refetch allowance after successful approval
      await refetchAllowance();

      return txHash;
    } catch (error) {
      console.error(`Error approving ${tokenSymbol}:`, error);
      throw error;
    }
  };

  // Approve max amount - Waits for confirmation
  const approveMax = async (spender: `0x${string}`) => {
    if (!userAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      console.log(`🔐 Approving max ${tokenSymbol}...`, maxAmount);
      const txHash = await approveWriteAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, maxAmount],
      });

      console.log('⏳ Waiting for transaction confirmation...', txHash);
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });

      console.log('✅ Transaction confirmed!', receipt);

      // Refetch allowance after successful approval
      await refetchAllowance();

      return txHash;
    } catch (error) {
      console.error(`Error approving max ${tokenSymbol}:`, error);
      throw error;
    }
  };

  // Helper function to get balance for any token or native
  const getBalance = (type: 'native' | 'erc20' = 'native'): string => {
    if (type === 'native') {
      return nativeBalance;
    }
    return balance;
  };

  return {
    // Token config
    tokenConfig,
    tokenSymbol,
    tokenAddress,
    decimals,

    // Connection status
    isConnected,
    userAddress,

    // ERC20 Balance
    balance,
    balanceRaw: balanceData as bigint | undefined,
    isLoadingBalance,
    refetchBalance,

    // Native balance (ETH/SepoliaETH)
    nativeBalance,
    nativeBalanceRaw: nativeBalanceData?.value,
    isLoadingNativeBalance,
    refetchNativeBalance,

    // Helper function to get balance
    getBalance,

    // Allowance
    allowance,
    allowanceRaw: allowanceData as bigint | undefined,
    isLoadingAllowance,
    refetchAllowance,

    // Approve
    approve,
    approveMax,
    isApprovePending,
    isApproveConfirming,
    isApproveSuccess,
    approveError,
    approveTxHash,
  };
}
