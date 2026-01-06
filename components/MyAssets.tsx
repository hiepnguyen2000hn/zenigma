'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ExternalLink, Circle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { TokenIconBySymbol } from './TokenSelector';
import { useTokenMapping } from '@/hooks/useTokenMapping';
import { getUserProfile, getTransferHistory, type Transfer } from '@/lib/services';
import { extractPrivyWalletId } from '@/lib/wallet-utils';
import Header from './Header';
import WithdrawModal from './WithdrawModal';
import DateTimeRangePicker from './DateTimeRangePicker';
import { useTokens } from '@/hooks/useTokens';

// Transfer direction mapping (from API string to UI display)
const TRANSFER_DIRECTION = {
  DEPOSIT: { label: 'Deposit', color: 'text-green-500' },
  WITHDRAW: { label: 'Withdraw', color: 'text-red-500' },
} as const;

// Transfer status mapping (from API string to UI display)
const TRANSFER_STATUS = {
  queued: { label: 'Queued', color: 'text-yellow-500' },
  completed: { label: 'Completed', color: 'text-green-500' },
  failed: { label: 'Failed', color: 'text-red-500' },
} as const;

/**
 * Shorten transaction hash for display
 * @example shortenHash("0x629a7f88d44377b2c00b5b24fe578ac5af02eab878305424248087db3413f5db")
 * // Returns: "0x629a...5db"
 */
const shortenHash = (hash: string, startLength = 6, endLength = 3): string => {
  if (!hash || hash.length < startLength + endLength) return hash;
  return `${hash.slice(0, startLength)}...${hash.slice(-endLength)}`;
};

interface Asset {
  tokenIndex: number;
  balance: string;
  value: string;
}

// Transfer filter params interface
interface TransferFilters {
  page?: number;
  limit?: number;
  status?: string[];      // ['pending', 'completed', 'failed']
  direction?: string[];   // ['0', '1'] - 0=DEPOSIT, 1=WITHDRAW
  token?: number;
  from_date?: string;
  to_date?: string;
}

const MyAssets = () => {
  const { authenticated, user } = usePrivy();
  const { getSymbol } = useTokenMapping();
  const { tokens } = useTokens();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Dropdown refs
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const directionDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  const [showFilters, setShowFilters] = useState({
    status: false,
    direction: false,
    token: false,
  });

  // Filter state
  const [filters, setFiltersState] = useState<TransferFilters>({
    page: 1,
    limit: 20,
  });

  // Date range state
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Set filter function
  const setFilter = (newFilters: Partial<TransferFilters>) => {
    setFiltersState((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page ?? 1,
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFiltersState({
      page: 1,
      limit: 20,
    });
    setStartDate(null);
    setEndDate(null);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(prev => ({ ...prev, status: false }));
      }
      if (directionDropdownRef.current && !directionDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(prev => ({ ...prev, direction: false }));
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(prev => ({ ...prev, token: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle date changes - Chỉ gửi khi CẢ HAI from_date và to_date đều có
  useEffect(() => {
    if (startDate && endDate) {
      // Format to ISO 8601 date string (YYYY-MM-DD)
      const from_date = startDate.toISOString().split('T')[0];
      const to_date = endDate.toISOString().split('T')[0];

      setFilter({ from_date, to_date });
      console.log('📅 [MyAssets] Date filter applied:', { from_date, to_date });
    } else {
      // Clear dates if one or both are null
      setFiltersState((prev) => {
        const { from_date, to_date, ...rest } = prev;
        return rest;
      });
      console.log('📅 [MyAssets] Date filter cleared');
    }
  }, [startDate, endDate]);

  // Fetch user profile and calculate assets
  useEffect(() => {
    if (!authenticated || !user?.id) {
      setAssets([]);
      setTransfers([]);
      return;
    }

    const fetchAssets = async () => {
      setLoading(true);
      setError(null);
      try {
        const walletId = extractPrivyWalletId(user.id);
        const profile = await getUserProfile(walletId);

        // Calculate assets from available_balances
        const assetsList: Asset[] = [];
        if (profile.available_balances) {
          profile.available_balances.forEach((balance: string, index: number) => {
            const balanceNum = parseFloat(balance);
            if (balanceNum > 0) {
              assetsList.push({
                tokenIndex: index,
                balance: balance,
                value: (balanceNum * 1).toFixed(2), // Mock value calculation
              });
            }
          });
        }

        setAssets(assetsList);
      } catch (err) {
        console.error('Failed to fetch assets:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch assets');
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [authenticated, user?.id]);

  // Fetch transfer history with filters
  useEffect(() => {
    if (!authenticated || !user?.id) {
      setTransfers([]);
      return;
    }

    const fetchTransfers = async () => {
      try {
        const walletId = extractPrivyWalletId(user.id);
        console.log('🔍 [MyAssets] Fetching transfers with filters:', filters);
        const transferResponse = await getTransferHistory(walletId, filters);
        console.log('✅ [MyAssets] Transfers fetched:', transferResponse.data?.length || 0, 'transfers');
        setTransfers(transferResponse.data || []);
      } catch (err) {
        console.error('❌ [MyAssets] Failed to fetch transfers:', err);
      }
    };

    fetchTransfers();
  }, [authenticated, user?.id, filters]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <div className="px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Assets</h1>
              <p className="text-sm text-gray-400">
                Your deposits inside of DarkPool. Only you and your connected relayer can see your balances.
              </p>
            </div>
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white hover:bg-gray-800 transition-colors"
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* Assets Table */}
        <div className="bg-black border border-gray-800 rounded-lg overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-black divide-y divide-gray-800">
                {!authenticated ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center text-gray-400">
                      Sign in to view your assets.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center text-gray-400">
                      Loading assets...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center text-red-500">
                      Error: {error}
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center text-gray-400">
                      No assets found.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset, index) => {
                    const symbol = getSymbol(asset.tokenIndex);
                    return (
                      <tr key={index} className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <TokenIconBySymbol symbol={symbol} size="sm" />
                            <span className="text-sm font-medium text-white">{symbol}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {parseFloat(asset.balance).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          ${asset.value}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer History Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Transfer History</h2>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 mb-4">
          <div className="p-4 flex items-center gap-3">
            {/* Status Filter */}
            <div ref={statusDropdownRef} className="relative">
              <button
                onClick={() => setShowFilters({ ...showFilters, status: !showFilters.status })}
                className={`flex items-center gap-2 px-4 py-2 bg-black border rounded-lg text-sm transition-colors ${
                  filters.status && filters.status.length > 0
                    ? 'border-gray-600 text-white'
                    : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                <Circle className={`w-3 h-3 ${filters.status && filters.status.length > 0 ? 'text-green-500 fill-green-500' : ''}`} />
                <span>Status</span>
                <ChevronDown size={16} className={`transition-transform ${showFilters.status ? 'rotate-180' : ''}`} />
              </button>

              {showFilters.status && (
                <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[140px]">
                  <button
                    onClick={() => {
                      setFilter({ status: ['pending'] });
                      setShowFilters({ ...showFilters, status: false });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                  >
                    <Circle className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span>Pending</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilter({ status: ['completed'] });
                      setShowFilters({ ...showFilters, status: false });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                  >
                    <Circle className="w-3 h-3 text-green-500 fill-green-500" />
                    <span>Completed</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilter({ status: ['failed'] });
                      setShowFilters({ ...showFilters, status: false });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                  >
                    <Circle className="w-3 h-3 text-red-500 fill-red-500" />
                    <span>Failed</span>
                  </button>
                </div>
              )}
            </div>

            {/* Direction/Type Filter */}
            <div ref={directionDropdownRef} className="relative">
              <button
                onClick={() => setShowFilters({ ...showFilters, direction: !showFilters.direction })}
                className={`flex items-center gap-2 px-4 py-2 bg-black border rounded-lg text-sm transition-colors ${
                  filters.direction && filters.direction.length > 0
                    ? 'border-gray-600 text-white'
                    : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                <Circle className={`w-3 h-3 ${filters.direction && filters.direction.length > 0 ? 'text-blue-500 fill-blue-500' : ''}`} />
                <span>Type</span>
                <ChevronDown size={16} className={`transition-transform ${showFilters.direction ? 'rotate-180' : ''}`} />
              </button>

              {showFilters.direction && (
                <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px]">
                  <button
                    onClick={() => {
                      setFilter({ direction: ['0'] });
                      setShowFilters({ ...showFilters, direction: false });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-gray-800 transition-colors"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => {
                      setFilter({ direction: ['1'] });
                      setShowFilters({ ...showFilters, direction: false });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800 transition-colors"
                  >
                    Withdraw
                  </button>
                </div>
              )}
            </div>

            {/* Token Filter */}
            <div ref={tokenDropdownRef} className="relative">
              <button
                onClick={() => setShowFilters({ ...showFilters, token: !showFilters.token })}
                className={`flex items-center gap-2 px-4 py-2 bg-black border rounded-lg text-sm transition-colors ${
                  filters.token !== undefined
                    ? 'border-gray-600 text-white'
                    : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                <Circle className={`w-3 h-3 ${filters.token !== undefined ? 'text-purple-500 fill-purple-500' : ''}`} />
                <span>Token</span>
                <ChevronDown size={16} className={`transition-transform ${showFilters.token ? 'rotate-180' : ''}`} />
              </button>

              {showFilters.token && (
                <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[160px] max-h-64 overflow-y-auto">
                  {tokens.map((token) => (
                    <button
                      key={token.index}
                      onClick={() => {
                        setFilter({ token: token.index });
                        setShowFilters({ ...showFilters, token: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-800 transition-colors flex items-center space-x-2"
                    >
                      <TokenIconBySymbol symbol={token.symbol} size="sm" />
                      <span>{token.symbol}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* DateTime Range Picker */}
            <DateTimeRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => {
                setStartDate(null);
                setEndDate(null);
              }}
            />

            {/* Clear button */}
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Transfer History Table */}
        <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Hash
                  </th>
                </tr>
              </thead>
              <tbody className="bg-black divide-y divide-gray-800">
                {!authenticated ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                      Sign in to view your transfer history.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                      Loading transfers...
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                      No transfers found.
                    </td>
                  </tr>
                ) : (
                  transfers.map((transfer, index) => {
                    // ✅ Map API response to UI display
                    const symbol = getSymbol(transfer.token);
                    const status = TRANSFER_STATUS[transfer.status as keyof typeof TRANSFER_STATUS] || TRANSFER_STATUS.queued;
                    const direction = TRANSFER_DIRECTION[transfer.direction as keyof typeof TRANSFER_DIRECTION] || TRANSFER_DIRECTION.DEPOSIT;

                    // Format time from ISO string
                    const formattedTime = new Date(transfer.time).toLocaleString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    // Shorten tx hash for display
                    const shortHash = shortenHash(transfer.tx_hash);

                    // Format value with USD
                    const formattedValue = `$${parseFloat(transfer.value).toFixed(2)} USD`;

                    return (
                      <tr key={index} className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <TokenIconBySymbol symbol={symbol} size="sm" />
                            <span className="text-sm font-medium text-white">{symbol}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${direction.color}`}>
                            {direction.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {transfer.amount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {formattedValue}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">
                          {formattedTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <a
                            href={`https://sepolia.etherscan.io/tx/${transfer.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                            title={transfer.tx_hash}
                          >
                            <span className="text-xs">{shortHash}</span>
                            <ExternalLink size={14} />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
      />
    </div>
  );
};

export default MyAssets;
