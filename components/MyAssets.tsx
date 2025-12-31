'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { TokenIconBySymbol } from './TokenSelector';
import { useTokenMapping } from '@/hooks/useTokenMapping';
import { getUserProfile } from '@/lib/services';
import { extractPrivyWalletId } from '@/lib/wallet-utils';
import Header from './Header';

// Transfer type mapping
const TRANSFER_TYPE = {
  0: { label: 'Deposit', color: 'text-green-500' },
  1: { label: 'Withdraw', color: 'text-red-500' },
} as const;

// Transfer status mapping
const TRANSFER_STATUS = {
  0: { label: 'Queued', color: 'text-yellow-500' },
  1: { label: 'Completed', color: 'text-green-500' },
  2: { label: 'Failed', color: 'text-red-500' },
} as const;

interface Asset {
  tokenIndex: number;
  balance: string;
  value: string;
}

interface Transfer {
  status: number;
  asset: number;
  type: number;
  amount: string;
  value: string;
  time: string;
}

const MyAssets = () => {
  const { authenticated, user } = usePrivy();
  const { getSymbol } = useTokenMapping();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState({
    status: false,
    type: false,
    asset: false,
  });

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

        // Mock transfer history (replace with actual API call when available)
        setTransfers([
          {
            status: 0,
            asset: 0,
            type: 0,
            amount: '360',
            value: '$360',
            time: 'July 21, 2025 12:45:55',
          },
          {
            status: 1,
            asset: 1,
            type: 0,
            amount: '10',
            value: '$1000',
            time: 'July 18, 2025 15:20:01',
          },
          {
            status: 2,
            asset: 2,
            type: 1,
            amount: '900',
            value: '$899',
            time: 'July 18, 2025 15:20:01',
          },
          {
            status: 1,
            asset: 2,
            type: 0,
            amount: '1000',
            value: '$1001',
            time: 'July 18, 2025 13:33:32',
          },
        ]);
      } catch (err) {
        console.error('Failed to fetch assets:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch assets');
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [authenticated, user?.id]);

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
            <button className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white hover:bg-gray-800 transition-colors">
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
            <div className="relative">
              <button
                onClick={() => setShowFilters({ ...showFilters, status: !showFilters.status })}
                className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
              >
                <span>Status</span>
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Type Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilters({ ...showFilters, type: !showFilters.type })}
                className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
              >
                <span>Type</span>
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Asset Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilters({ ...showFilters, asset: !showFilters.asset })}
                className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
              >
                <span>Asset</span>
                <ChevronDown size={16} />
              </button>
            </div>

            {/* From Date */}
            <div className="relative">
              <button className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 hover:text-white transition-colors">
                <span>From date</span>
              </button>
            </div>

            {/* To Date */}
            <div className="relative">
              <button className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 hover:text-white transition-colors">
                <span>To date</span>
              </button>
            </div>
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
                    Action
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
                    const symbol = getSymbol(transfer.asset);
                    const status = TRANSFER_STATUS[transfer.status as keyof typeof TRANSFER_STATUS] || TRANSFER_STATUS[0];
                    const type = TRANSFER_TYPE[transfer.type as keyof typeof TRANSFER_TYPE] || TRANSFER_TYPE[0];

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
                          <span className={`text-sm font-medium ${type.color}`}>
                            {type.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {transfer.amount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {transfer.value}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">
                          {transfer.time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button className="text-gray-400 hover:text-white transition-colors">
                            <ExternalLink size={16} />
                          </button>
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
    </div>
  );
};

export default MyAssets;
