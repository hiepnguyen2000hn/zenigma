import { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { getAllTokens, type Token } from '@/lib/services';
import {
  tokensAtom,
  tokensLoadingAtom,
  tokensErrorAtom,
  updateTokensAtom,
  setTokensLoadingAtom,
  setTokensErrorAtom,
  clearTokensAtom,
  isTokensLoadedAtom,
} from '@/store/tokens';

// ============================================
// CACHE CONFIGURATION
// ============================================
const CACHE_KEY = 'darkpull_tokens_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 ngày (24 hours)

interface TokensCache {
  data: Token[];
  timestamp: number;
  expiresAt: number;
}

/**
 * Get tokens from localStorage cache
 */
function getTokensFromCache(): Token[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: TokensCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache expired
    if (now > cacheData.expiresAt) {

      localStorage.removeItem(CACHE_KEY);
      return null;
    }


    return cacheData.data;
  } catch (err) {
    console.error('❌ Error reading cache:', err);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Save tokens to localStorage cache
 */
function saveTokensToCache(tokens: Token[]): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const cacheData: TokensCache = {
      data: tokens,
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (err) {
    console.error('❌ Error saving cache:', err);
  }
}

/**
 * Custom hook to fetch and manage tokens list
 *
 * Features:
 * - localStorage cache với expiry 1 ngày
 * - F5 refresh → lấy từ cache, không call API
 * - Auto-fetch on mount nếu chưa có cache
 * - Tự động update Jotai store
 *
 * @example
 * const { tokens, isLoading, error, isLoaded } = useTokens();
 *
 * // Tokens tự động load từ cache hoặc API
 * console.log(tokens);
 */
export function useTokens(autoFetch = true) {
  const tokens = useAtomValue(tokensAtom);
  const loading = useAtomValue(tokensLoadingAtom);
  const error = useAtomValue(tokensErrorAtom);
  const isLoaded = useAtomValue(isTokensLoadedAtom);

  const updateTokens = useSetAtom(updateTokensAtom);
  const setLoading = useSetAtom(setTokensLoadingAtom);
  const setError = useSetAtom(setTokensErrorAtom);
  const clearTokens = useSetAtom(clearTokensAtom);

  /**
   * Fetch tokens from API and update store + cache
   */
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🪙 Fetching tokens from API...');
      const tokensData = await getAllTokens();

      console.log('✅ Tokens fetched from API');
      console.log(`  - Total tokens: ${tokensData.length}`);

      // Update Jotai store
      updateTokens(tokensData);

      // Save to localStorage cache
      saveTokensToCache(tokensData);

      return tokensData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tokens';
      console.error('❌ Error fetching tokens:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateTokens, setLoading, setError]);

  /**
   * Load tokens from cache or fetch from API
   */
  const loadTokens = useCallback(async () => {
    // 1. Check if already loaded in store
    if (isLoaded) {
      console.log('✅ Tokens already in store');
      return tokens;
    }

    // 2. Try to load from localStorage cache
    const cachedTokens = getTokensFromCache();
    if (cachedTokens) {
      updateTokens(cachedTokens);
      return cachedTokens;
    }

    // 3. Cache miss → fetch from API
    console.log('❌ Cache miss, fetching from API...');
    return await fetchTokens();
  }, [isLoaded, tokens, updateTokens, fetchTokens]);

  /**
   * Force refetch tokens (bypass cache)
   */
  const refetchTokens = useCallback(async () => {
    console.log('🔄 Force refetching tokens (bypass cache)...');
    localStorage.removeItem(CACHE_KEY);
    clearTokens();
    return await fetchTokens();
  }, [fetchTokens, clearTokens]);

  /**
   * Clear cache and store
   */
  const clearCache = useCallback(() => {
    console.log('🗑️ Clearing tokens cache...');
    localStorage.removeItem(CACHE_KEY);
    clearTokens();
  }, [clearTokens]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoFetch && !isLoaded && !loading) {
      loadTokens();
    }
  }, [autoFetch, isLoaded, loading, loadTokens]);

  return {
    tokens,
    isLoading: loading,
    error,
    isLoaded,
    refetch: loadTokens,
    refetchTokens,
    clearCache,
  };
}
