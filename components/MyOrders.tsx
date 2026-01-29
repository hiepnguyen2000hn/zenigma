'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Calendar, X, Circle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { TokenIconBySymbol } from './TokenSelector';
import { useTokenMapping } from '@/hooks/useTokenMapping';
import { getOrderList, getMatchingHistory, getUserProfile, type Order, type MatchingHistory, getErrorMessage } from '@/lib/services';
import { extractPrivyWalletId, getWalletAddressByConnectorType } from '@/lib/wallet-utils';
import { useProof, useWalletUpdateProof } from '@/hooks/useProof';
import { type OrderAction, type WalletState } from '@/hooks/useProof';
import { signMessageWithSkRoot } from '@/lib/ethers-signer';
import { useWallets } from '@privy-io/react-auth';
import toast from 'react-hot-toast';
import { useChainId, useSwitchChain } from 'wagmi';
import { ensureSepoliaChain } from '@/lib/chain-utils';
import Header from './Header';
import { useTokens } from '@/hooks/useTokens';
import DateTimeRangePicker from './DateTimeRangePicker';
import * as Tabs from '@radix-ui/react-tabs';

// Order status mapping (from API string to UI display)
const ORDER_STATUS = {
  'Created': { label: 'Created', color: 'text-cyan-500', dotColor: 'text-cyan-500 fill-cyan-500' },
  'Pending': { label: 'Pending', color: 'text-orange-500', dotColor: 'text-orange-500 fill-orange-500' },
  'Matching': { label: 'Matching', color: 'text-orange-500', dotColor: 'text-orange-500 fill-orange-500' },
  'Filled': { label: 'Filled', color: 'text-blue-500', dotColor: 'text-blue-500 fill-blue-500' },
  'Matched': { label: 'Matched', color: 'text-purple-500', dotColor: 'text-purple-500 fill-purple-500' },
  'Cancelled': { label: 'Cancelled', color: 'text-gray-500', dotColor: 'text-gray-500 fill-gray-500' },
  'Open': { label: 'Open', color: 'text-green-500', dotColor: 'text-green-500 fill-green-500' },
  'Partial': { label: 'Partial', color: 'text-orange-400', dotColor: 'text-orange-400 fill-orange-400' },
  'SettlingMatch': { label: 'Settling', color: 'text-yellow-500', dotColor: 'text-yellow-500 fill-yellow-500' },
} as const;

// Order filter params interface
interface OrderFilters {
  status?: (number | string)[];
  side?: number;
  token?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

const MyOrders = () => {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { getSymbol } = useTokenMapping();
  const { tokens } = useTokens();
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<MatchingHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [cancellingOrders, setCancellingOrders] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState('open');

  // Dropdown refs
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const sideDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  // Proof hooks
  const { calculateNewState, cancelOrder } = useProof();
  const { generateWalletUpdateProofClient } = useWalletUpdateProof();

  // Filter state for Open Orders
  const [filters, setFiltersState] = useState<OrderFilters>({
    status: ['Created', 'Pending', 'SettlingMatch'],
    page: 1,
    limit: 20,
  });

  // Filter state for History Orders (uses timestamps in milliseconds)
  const [historyFilters, setHistoryFiltersState] = useState<{
    page?: number;
    limit?: number;
    from_date?: number;
    to_date?: number;
  }>({
    page: 1,
    limit: 20,
  });

  const [showFilters, setShowFilters] = useState({
    status: false,
    side: false,
    token: false,
  });

  // Date range state for Open Orders
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Date range state for History Orders
  const [historyStartDate, setHistoryStartDate] = useState<Date | null>(null);
  const [historyEndDate, setHistoryEndDate] = useState<Date | null>(null);

  const setFilter = (newFilters: Partial<OrderFilters>) => {
    setFiltersState((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page ?? 1,
    }));
  };

  const setHistoryFilter = (newFilters: Partial<{
    page?: number;
    limit?: number;
    from_date?: number;
    to_date?: number;
  }>) => {
    setHistoryFiltersState((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page ?? 1,
    }));
  };

  // Handle date changes for Open Orders
  useEffect(() => {
    if (startDate && endDate) {
      const from_date = startDate.toISOString().split('T')[0];
      const to_date = endDate.toISOString().split('T')[0];
      setFilter({ from_date, to_date });
    } else {
      setFiltersState((prev) => {
        const { from_date, to_date, ...rest } = prev;
        return rest;
      });
    }
  }, [startDate, endDate]);

  // Handle date changes for History Orders (convert to Unix timestamp in milliseconds)
  useEffect(() => {
    if (historyStartDate && historyEndDate) {
      const from_date = historyStartDate.getTime();
      const to_date = historyEndDate.getTime();
      setHistoryFilter({ from_date, to_date });
    } else {
      setHistoryFiltersState((prev) => {
        const { from_date, to_date, ...rest } = prev;
        return rest;
      });
    }
  }, [historyStartDate, historyEndDate]);

  // Clear open orders filters
  const clearFilters = () => {
    setFiltersState({
      status: ['Created', 'Pending', 'SettlingMatch'],
      page: 1,
      limit: 20,
    });
    setStartDate(null);
    setEndDate(null);
  };

  // Clear history filters
  const clearHistoryFilters = () => {
    setHistoryFiltersState({
      page: 1,
      limit: 20,
    });
    setHistoryStartDate(null);
    setHistoryEndDate(null);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(prev => ({ ...prev, status: false }));
      }
      if (sideDropdownRef.current && !sideDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(prev => ({ ...prev, side: false }));
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(prev => ({ ...prev, token: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle select/deselect order
  const toggleSelectOrder = (index: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedOrders(newSelected);
  };

  // Handle select all
  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((_, idx) => idx)));
    }
  };

  // Handle cancel multiple orders
  const handleCancelSelectedOrders = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Please select orders to cancel');
      return;
    }

    toast.success(`Cancelling ${selectedOrders.size} orders...`);
    // TODO: Implement batch cancel logic
  };

  // Handle cancel single order
  const handleCancelOrder = async (orderIndex: number) => {
    try {
      setCancellingOrders(prev => new Set(prev).add(orderIndex));
      console.log('🚫 Starting cancel order process...', { orderIndex });

      const walletAddress = getWalletAddressByConnectorType(wallets, 'embedded', user);
      if (!walletAddress) {
        toast.error('Please connect wallet first!');
        setCancellingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderIndex);
          return newSet;
        });
        return;
      }

      if (!user?.id) {
        toast.error('Please authenticate with Privy first!');
        setCancellingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderIndex);
          return newSet;
        });
        return;
      }

      // Check and switch to Sepolia if needed
      const canProceed = await ensureSepoliaChain(chainId, switchChainAsync);
      if (!canProceed) {
        setCancellingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderIndex);
          return newSet;
        });
        return;
      }

      const walletId = extractPrivyWalletId(user.id);
      const profile = await getUserProfile(walletId);

      const oldState: WalletState = {
        available_balances: profile.available_balances || Array(10).fill('0'),
        reserved_balances: profile.reserved_balances || Array(10).fill('0'),
        orders_list: profile.orders_list || Array(4).fill(null),
        fees: profile.fees?.toString() || '0',
        blinder: profile.blinder,
      };

      const action: OrderAction = {
        type: 'order',
        operation_type: 1,
        order_index: orderIndex,
      };

      const { newState, operations } = await calculateNewState(
        oldState,
        action,
        profile.nonce || 0
      );

      const proofData = await generateWalletUpdateProofClient({
        oldNonce: profile.nonce?.toString() || '0',
        oldMerkleRoot: profile.merkle_root,
        oldMerkleIndex: profile.merkle_index,
        oldHashPath: profile.sibling_paths,
        oldState,
        newState,
        operations
      });

      const newCommitment = proofData.publicInputs.new_wallet_commitment;
      const rootSignature = await signMessageWithSkRoot(newCommitment);

      const result = await cancelOrder({
        proof: proofData.proof,
        publicInputs: proofData.publicInputs,
        wallet_address: walletAddress,
        operations,
        signature: rootSignature
      });

      if (result.success && result.verified) {
        toast.success('Your cancel order is queued, please allow a few minutes for it to sync');
        const response = await getOrderList(walletId, filters);
        setOrders(response.data || []);
      } else {
        toast.error(`Cancel order failed: ${result.error}`);
      }

      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderIndex);
        return newSet;
      });
    } catch (error) {
      console.error('❌ Error in cancel order process:', error);
      toast.error(getErrorMessage(error));
      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderIndex);
        return newSet;
      });
    }
  };

  // Fetch open orders
  useEffect(() => {
    if (!authenticated || !user?.id) {
      setOrders([]);
      return;
    }

    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const walletId = extractPrivyWalletId(user.id);
        console.log('🔍 [MyOrders] Fetching open orders with filters:', filters);
        const response = await getOrderList(walletId, filters);
        console.log('✅ [MyOrders] Open orders fetched:', response.data?.length || 0, 'orders');
        setOrders(response.data || []);
      } catch (err) {
        console.error('❌ [MyOrders] Failed to fetch open orders:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [authenticated, user?.id, filters]);

  // Fetch matching history
  useEffect(() => {
    if (!authenticated || !user?.id) {
      setHistoryOrders([]);
      return;
    }

    const fetchMatchingHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const walletId = extractPrivyWalletId(user.id);
        console.log('🔍 [MyOrders] Fetching matching history with filters:', historyFilters);
        const response = await getMatchingHistory(walletId, historyFilters);
        console.log('✅ [MyOrders] Matching history fetched:', response.data?.length || 0, 'records');
        setHistoryOrders(response.data || []);
      } catch (err) {
        console.error('❌ [MyOrders] Failed to fetch matching history:', err);
        setHistoryError(err instanceof Error ? err.message : 'Failed to fetch history');
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchMatchingHistory();
  }, [authenticated, user?.id, historyFilters]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <div className="px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Orders</h1>
          <p className="text-sm text-gray-400">
            Your private orders. Only you and your connected wallet can see these values.
          </p>
        </div>

        {/* Tabs */}
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="w-full">
          <Tabs.List className="flex border-b border-gray-800 mb-6">
            <Tabs.Trigger
              value="open"
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'open'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Open Orders
              {activeTab === 'open' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
              )}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="history"
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'history'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Order History
              {activeTab === 'history' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
              )}
            </Tabs.Trigger>
          </Tabs.List>

          {/* Open Orders Tab */}
          <Tabs.Content value="open">
            {/* Filters */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 mb-4">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
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
                  <span>Status</span>
                  <ChevronDown size={16} className={`transition-transform ${showFilters.status ? 'rotate-180' : ''}`} />
                </button>

                {showFilters.status && (
                  <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[160px]">
                    <button
                      onClick={() => {
                        setFilter({ status: ['Created'] });
                        setShowFilters({ ...showFilters, status: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-cyan-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                    >
                      <Circle className="w-3 h-3 text-cyan-500 fill-cyan-500" />
                      <span>Created</span>
                    </button>
                    <button
                      onClick={() => {
                        setFilter({ status: ['Pending'] });
                        setShowFilters({ ...showFilters, status: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-orange-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                    >
                      <Circle className="w-3 h-3 text-orange-500 fill-orange-500" />
                      <span>Pending</span>
                    </button>
                    <button
                      onClick={() => {
                        setFilter({ status: ['SettlingMatch'] });
                        setShowFilters({ ...showFilters, status: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                    >
                      <Circle className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span>Settling</span>
                    </button>
                    <button
                      onClick={() => {
                        setFilter({ status: ['Filled'] });
                        setShowFilters({ ...showFilters, status: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-blue-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                    >
                      <Circle className="w-3 h-3 text-blue-500 fill-blue-500" />
                      <span>Filled</span>
                    </button>
                    <button
                      onClick={() => {
                        setFilter({ status: ['Cancelled'] });
                        setShowFilters({ ...showFilters, status: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                    >
                      <Circle className="w-3 h-3 text-gray-500 fill-gray-500" />
                      <span>Cancelled</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Side Filter */}
              <div ref={sideDropdownRef} className="relative">
                <button
                  onClick={() => setShowFilters({ ...showFilters, side: !showFilters.side })}
                  className={`flex items-center gap-2 px-4 py-2 bg-black border rounded-lg text-sm transition-colors ${
                    filters.side !== undefined
                      ? 'border-gray-600 text-white'
                      : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  <span>Side</span>
                  <ChevronDown size={16} className={`transition-transform ${showFilters.side ? 'rotate-180' : ''}`} />
                </button>

                {showFilters.side && (
                  <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px]">
                    <button
                      onClick={() => {
                        setFilter({ side: 0 });
                        setShowFilters({ ...showFilters, side: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-gray-800 transition-colors"
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => {
                        setFilter({ side: 1 });
                        setShowFilters({ ...showFilters, side: false });
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800 transition-colors"
                    >
                      Sell
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
                  setFilter({ from_date: undefined, to_date: undefined });
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

            {/* Cancel Selected Button */}
            {/*{selectedOrders.size > 0 && (*/}
            {/*  <button*/}
            {/*    onClick={handleCancelSelectedOrders}*/}
            {/*    className="px-4 py-2 bg-red-600/20 border border-red-600/50 rounded-lg text-sm text-red-500 hover:bg-red-600/30 transition-colors"*/}
            {/*  >*/}
            {/*    Cancel {selectedOrders.size} {selectedOrders.size === 1 ? 'order' : 'orders'}*/}
            {/*  </button>*/}
            {/*)}*/}
          </div>
        </div>

        {/* Table */}
        <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Side
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Price [USDT]
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Order Value
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Filled
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-black divide-y divide-gray-800">
                {!authenticated ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-gray-400">
                      Sign in to view your orders.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-gray-400">
                      Loading orders...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-red-500">
                      Error: {error}
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-gray-400">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order, index) => {
                    // Get symbol from tokens array (from useTokens hook)
                    const tokenInfo = tokens.find(t => t.index === order.asset);
                    const assetSymbol = tokenInfo?.symbol || getSymbol(order.asset);
                    const isBuy = order.side === 0;

                    // Get status from API string, fallback to 'Created' if not found
                    const statusFromAPI = order.status;
                    const statusConfig = ORDER_STATUS[statusFromAPI as keyof typeof ORDER_STATUS] || {
                      label: statusFromAPI || 'Unknown',
                      color: 'text-gray-400',
                      dotColor: 'text-gray-400 fill-gray-400'
                    };

                    const orderTime = new Date(order.time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    return (
                      <tr
                        key={index}
                        className={`hover:bg-gray-900/50 transition-colors ${
                          selectedOrders.has(index) ? 'bg-blue-900/20' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(index)}
                            onChange={() => toggleSelectOrder(index)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                            {isBuy ? 'Buy' : 'Sell'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <TokenIconBySymbol symbol={assetSymbol} size="sm" />
                            <span className="text-sm font-medium text-white">
                              {assetSymbol}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {order.size}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {order.price || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          ${order.order_value?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                          {order.filled}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">
                          {orderTime}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
          </Tabs.Content>

          {/* History Orders Tab */}
          <Tabs.Content value="history">
            {/* History Filters - Only Date Range supported by API */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 mb-4">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* DateTime Range Picker */}
                  <DateTimeRangePicker
                    startDate={historyStartDate}
                    endDate={historyEndDate}
                    onStartDateChange={setHistoryStartDate}
                    onEndDateChange={setHistoryEndDate}
                    onClear={() => {
                      setHistoryStartDate(null);
                      setHistoryEndDate(null);
                    }}
                  />

                  {/* Clear button */}
                  <button
                    onClick={clearHistoryFilters}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Side
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Asset
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Price [USDT]
                      </th>

                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Order Value
                      </th>
                      {/*<th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">*/}
                      {/*  Filled [%]*/}
                      {/*</th>*/}
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-black divide-y divide-gray-800">
                    {!authenticated ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center text-gray-400">
                          Sign in to view your order history.
                        </td>
                      </tr>
                    ) : historyLoading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center text-gray-400">
                          Loading order history...
                        </td>
                      </tr>
                    ) : historyError ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center text-red-500">
                          Error: {historyError}
                        </td>
                      </tr>
                    ) : historyOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center text-gray-400">
                          No order history found.
                        </td>
                      </tr>
                    ) : (
                      historyOrders.map((order, index) => {
                        const tokenInfo = tokens.find(t => t.index === order.asset);
                        const assetSymbol = order.market || 'UNKOWN'
                        const isBuy = order.side === 'buy';

                        const statusFromAPI = order.status;
                        const statusConfig = ORDER_STATUS[statusFromAPI as keyof typeof ORDER_STATUS] || {
                          label: statusFromAPI || 'Unknown',
                          color: 'text-green-400',
                          dotColor: 'text-green-400 fill-green-400'
                        };

                        const orderTime = new Date(order.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        });

                        return (
                          <tr
                            key={index}
                            className="hover:bg-gray-900/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-sm font-medium ${statusConfig.color}`}>
                                Success
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-sm font-medium ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                                {isBuy ? 'Buy' : 'Sell'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">
                                  {assetSymbol}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                              {order?.matched_quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                              {order?.matched_price || '-'}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                              ${ order && order.matched_price && order.matched_quantity ? Number(order.matched_price * order.matched_quantity).toFixed(2) : '0.00' }
                            </td>
                            {/*<td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">*/}
                            {/*  100*/}
                            {/*</td>*/}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">
                              {orderTime}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
};

export default MyOrders;
