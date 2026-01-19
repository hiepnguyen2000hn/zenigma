import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getWalletByConnectorType } from '@/lib/wallet-utils';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { balancesAtom, type TokenBalance } from '@/store/trading';
import { MOCK_USDC_ADDRESS } from '@/lib/constants';

// Token configurations
const TOKENS = [
  {
    symbol: 'USDC',
    address: MOCK_USDC_ADDRESS,
    decimals: 6,
  },
  {
    symbol: 'USDT',
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Replace with actual USDT address
    decimals: 6,
  },
  {
    symbol: 'WBTC',
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Replace with actual WBTC address
    decimals: 8,
  },
  {
    symbol: 'BTC',
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Replace with actual BTC address
    decimals: 8,
  },
] as const;

// ERC20 ABI - balanceOf function
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

// Price feed (mock - sẽ replace bằng real price feed sau)
const MOCK_PRICES: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  WBTC: 106000,
  BTC: 106000,
};

/**
 * Hook để fetch balances của user và update vào balancesAtom
 *
 * Features:
 * - Fetch balance cho tất cả tokens
 * - Tự động update vào Jotai store
 * - Calculate USD value
 * - Support embedded wallet
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { isLoading, refetch } = useBalances();
 *
 *   return <div>Loading: {isLoading}</div>
 * }
 * ```
 */
export function useBalances() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const setBalances = useSetAtom(balancesAtom);

  // Get embedded wallet address
  const embeddedWallet = getWalletByConnectorType(wallets, 'embedded', user);
  const userAddress = embeddedWallet?.address as `0x${string}` | undefined;

  // Fetch USDC balance (token đầu tiên)
  const {
    data: usdcBalanceData,
    isLoading: isLoadingUSDC,
    refetch: refetchUSDC,
  } = useReadContract({
    address: TOKENS[0].address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // TODO: Fetch balance cho các tokens khác (USDT, WBTC, BTC)
  // Hiện tại chỉ fetch USDC, còn lại để 0
  // Có thể dùng multicall để fetch nhiều token 1 lúc

  // Update balances vào store khi có data
  useEffect(() => {
    if (!userAddress) {
      // Nếu chưa connect wallet, clear balances
      setBalances([]);
      return;
    }

    // Format balances
    const balances: TokenBalance[] = TOKENS.map((token, index) => {
      let balance = 0;

      // Chỉ có USDC có real data, còn lại mock = 0
      if (index === 0 && usdcBalanceData) {
        balance = parseFloat(formatUnits(usdcBalanceData as bigint, token.decimals));
      }

      const price = MOCK_PRICES[token.symbol] || 0;
      const usdValue = balance * price;

      return {
        token: token.symbol,
        balance,
        usdValue,
      };
    });

    console.log('📊 Updated balances:', balances);
    setBalances(balances);
  }, [userAddress, usdcBalanceData, setBalances]);

  // Refetch all balances
  const refetch = async () => {
    await refetchUSDC();
    // TODO: Add refetch cho các tokens khác
  };

  return {
    isLoading: isLoadingUSDC,
    refetch,
    userAddress,
    isConnected: !!userAddress,
  };
}
