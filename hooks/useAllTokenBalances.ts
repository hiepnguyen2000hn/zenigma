import { useMemo } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useReadContracts, useBalance } from 'wagmi';
import { formatUnits, formatEther } from 'viem';
import { getAvailableERC20Tokens } from '@/lib/constants';

// ERC20 ABI - balanceOf only
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

/**
 * Hook to load balances for ALL ERC20 tokens at once
 * Uses Wagmi's useReadContracts (multicall) for better performance
 *
 * @returns Object with token balances: { 'USDC': '100.50', 'USDT': '50.00', native: '1.5' }
 */
export function useAllTokenBalances() {
  const { wallets } = useWallets();

  // Get embedded wallet address
  const userAddress = useMemo(() => {
    const embeddedWallet = wallets.find(wallet => wallet.connectorType === 'embedded');
    return embeddedWallet?.address as `0x${string}` | undefined;
  }, [wallets]);

  // Get all available ERC20 tokens
  const availableTokens = getAvailableERC20Tokens();

  // Get native token balance (ETH/SepoliaETH)
  const {
    data: nativeBalanceData,
    isLoading: isLoadingNative
  } = useBalance({
    address: userAddress,
    query: {
      enabled: !!userAddress,
    }
  });

  // Build contract calls for all ERC20 tokens
  const contracts = useMemo(() => {
    if (!userAddress) return [];

    return availableTokens.map((token) => ({
      address: token.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf' as const,
      args: [userAddress],
    }));
  }, [userAddress, availableTokens]);

  // Multicall: Load all token balances at once
  const {
    data: balancesData,
    isLoading: isLoadingERC20,
  } = useReadContracts({
    contracts,
    query: {
      enabled: !!userAddress && contracts.length > 0,
    }
  });

  // Format balances into object: { symbol: formattedBalance }
  const balances = useMemo(() => {
    const result: Record<string, string> = {};

    // Add native balance
    if (nativeBalanceData) {
      result.native = formatEther(nativeBalanceData.value);
    } else {
      result.native = '0';
    }

    // Add ERC20 balances
    if (balancesData) {
      availableTokens.forEach((token, index) => {
        const balanceResult = balancesData[index];

        if (balanceResult?.status === 'success' && balanceResult.result) {
          result[token.symbol] = formatUnits(balanceResult.result as bigint, token.decimals);
        } else {
          result[token.symbol] = '0';
        }
      });
    } else {
      // Default to '0' if no data
      availableTokens.forEach((token) => {
        result[token.symbol] = '0';
      });
    }

    return result;
  }, [balancesData, nativeBalanceData, availableTokens]);

  return {
    balances,
    isLoading: isLoadingNative || isLoadingERC20,
    isConnected: !!userAddress,
  };
}
