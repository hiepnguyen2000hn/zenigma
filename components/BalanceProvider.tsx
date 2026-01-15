"use client";

import { useBalances } from '@/hooks/useBalances';
import { useEffect } from 'react';

/**
 * BalanceProvider - Component để fetch và update balances vào store
 *
 * Wrap component này ở layout hoặc root component để tự động
 * fetch balances khi user connect wallet
 *
 * Usage:
 * ```tsx
 * // app/layout.tsx
 * export default function Layout({ children }) {
 *   return (
 *     <PrivyProvider>
 *       <WagmiProvider>
 *         <BalanceProvider>
 *           {children}
 *         </BalanceProvider>
 *       </WagmiProvider>
 *     </PrivyProvider>
 *   )
 * }
 * ```
 */
export default function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, refetch, isConnected } = useBalances();


  // Log khi connect/disconnect
  useEffect(() => {
    if (isConnected) {

    } else {

    }
  }, [isConnected]);

  return <>{children}</>;
}
