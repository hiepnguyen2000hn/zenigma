import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { getUserBalance } from '@/lib/services';
import {
  userBalanceAtom,
  balanceLoadingAtom,
  balanceErrorAtom,
  updateUserBalanceAtom,
  setBalanceLoadingAtom,
  setBalanceErrorAtom,
  clearBalanceAtom,
} from '@/store/profile';

export function useUserBalance() {
  const balance = useAtomValue(userBalanceAtom);
  const loading = useAtomValue(balanceLoadingAtom);
  const error = useAtomValue(balanceErrorAtom);

  const updateBalance = useSetAtom(updateUserBalanceAtom);
  const setLoading = useSetAtom(setBalanceLoadingAtom);
  const setError = useSetAtom(setBalanceErrorAtom);
  const clearBalance = useSetAtom(clearBalanceAtom);

  const fetchBalance = useCallback(async (walletId: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getUserBalance(walletId);
      updateBalance(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateBalance, setLoading, setError]);

  const refetchBalance = useCallback(async (walletId: string) => {
    return await fetchBalance(walletId);
  }, [fetchBalance]);

  return {
    balance,
    loading,
    error,
    fetchBalance,
    refetchBalance,
    clearBalance,
  };
}
