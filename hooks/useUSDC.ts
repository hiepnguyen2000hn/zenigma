import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getWalletByConnectorType } from '@/lib/wallet-utils';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig, useBalance } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseUnits, formatUnits, formatEther } from 'viem';
import { MOCK_USDC_ADDRESS } from '@/lib/constants';

// USDC Contract Address
const USDC_ADDRESS = MOCK_USDC_ADDRESS;

// USDC Decimals (hardcoded for Sepolia fake USDC)
const USDC_DECIMALS = 6;

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

export function useUSDC(spenderAddress?: `0x${string}`) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const config = useConfig(); // ✅ Get wagmi config for waitForTransactionReceipt
  const [userAddress, setUserAddress] = useState<`0x${string}` | undefined>();

  // Get embedded wallet address
  useEffect(() => {
    const embeddedWallet = getWalletByConnectorType(wallets, 'embedded', user);
    if (embeddedWallet?.address) {
      setUserAddress(embeddedWallet.address as `0x${string}`);
    }
  }, [wallets, user]);

  // Check if wallet is connected
  const isConnected = !!userAddress;

  // ✅ Get native token balance (ETH/SepoliaETH)
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

  // Get USDC balance
  const {
    data: balanceData,
    refetch: refetchBalance,
    isLoading: isLoadingBalance
  } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    }
  });

  // Format balance
  const balance = balanceData
    ? formatUnits(balanceData as bigint, USDC_DECIMALS)
    : '0';

  // Get allowance for spender (if spenderAddress is provided)
  const {
    data: allowanceData,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance
  } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && spenderAddress ? [userAddress, spenderAddress] : undefined,
    query: {
      enabled: !!(userAddress && spenderAddress),
    }
  });

  // Format allowance
  const allowance = allowanceData
    ? formatUnits(allowanceData as bigint, USDC_DECIMALS)
    : '0';

  // Approve USDC
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

  // Approve function - ✅ Now waits for transaction confirmation
  const approve = async (spender: `0x${string}`, amount: string) => {
    if (!userAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const amountInWei = parseUnits(amount, USDC_DECIMALS);

      console.log('🔐 Sending approve transaction...', amountInWei);
      // ✅ Use writeContractAsync to get transaction hash
      const txHash = await approveWriteAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amountInWei],
      });

      console.log('⏳ Waiting for transaction confirmation...', txHash);
      // ✅ Wait for transaction to be mined
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });

      console.log('✅ Transaction confirmed!', receipt);

      // ✅ Refetch allowance after successful approval
      await refetchAllowance();

      return txHash;
    } catch (error) {
      console.error('Error approving USDC:', error);
      throw error;
    }
  };

  // Approve max amount (useful for DEX interactions) - ✅ Now waits for confirmation
  const approveMax = async (spender: `0x${string}`) => {
    if (!userAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      console.log('🔐 Sending approve max transaction...', maxAmount);
      // ✅ Use writeContractAsync to get transaction hash
      const txHash = await approveWriteAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, maxAmount],
      });

      console.log('⏳ Waiting for transaction confirmation...', txHash);
      // ✅ Wait for transaction to be mined
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      });

      console.log('✅ Transaction confirmed!', receipt);

      // ✅ Refetch allowance after successful approval
      await refetchAllowance();

      return txHash;
    } catch (error) {
      console.error('Error approving max USDC:', error);
      throw error;
    }
  };

  // ✅ Helper function to get balance for any token or native
  const getBalance = (type: 'native' | 'usdc' = 'native'): string => {
    if (type === 'native') {
      return nativeBalance;
    }
    return balance;
  };

  return {
    // Connection status
    isConnected,
    userAddress,

    // Balance
    balance,
    balanceRaw: balanceData as bigint | undefined,
    isLoadingBalance,
    refetchBalance,

    // ✅ Native balance (ETH/SepoliaETH)
    nativeBalance,
    nativeBalanceRaw: nativeBalanceData?.value,
    isLoadingNativeBalance,
    refetchNativeBalance,

    // ✅ Helper function to get balance
    getBalance,

    // Decimals
    decimals: USDC_DECIMALS,

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

    // Contract address
    usdcAddress: USDC_ADDRESS,
  };
}