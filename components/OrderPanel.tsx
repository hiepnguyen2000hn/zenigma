'use client';

import { Filter, Circle, X, ChevronDown } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { TokenIconBySymbol } from './TokenSelector';
import { useTokenMapping } from '@/hooks/useTokenMapping';
import { useState, useEffect, useRef } from 'react';
import { getOrderList, getUserProfile, type Order } from '@/lib/services';
import { extractPrivyWalletId } from '@/lib/wallet-utils';
import { useProof, useWalletUpdateProof } from '@/hooks/useProof';
import { type OrderAction, type WalletState } from '@/hooks/useProof';
import { signMessageWithSkRoot } from '@/lib/ethers-signer';
import toast from 'react-hot-toast';
import { useTokens } from '@/hooks/useTokens';

// Order status mapping (from API string to UI display)
const ORDER_STATUS = {
    'Created': { label: 'Created', color: 'text-cyan-500', dotColor: 'text-cyan-500 fill-cyan-500' },
    'Matching': { label: 'Matching', color: 'text-yellow-500', dotColor: 'text-yellow-500 fill-yellow-500' },
    'Filled': { label: 'Filled', color: 'text-blue-500', dotColor: 'text-blue-500 fill-blue-500' },
    'Matched': { label: 'Matched', color: 'text-purple-500', dotColor: 'text-purple-500 fill-purple-500' },
    'Cancelled': { label: 'Cancelled', color: 'text-gray-500', dotColor: 'text-gray-500 fill-gray-500' },
    'Open': { label: 'Open', color: 'text-green-500', dotColor: 'text-green-500 fill-green-500' },
    'Partial': { label: 'Partial', color: 'text-yellow-500', dotColor: 'text-yellow-500 fill-yellow-500' },
} as const;

// Order filter params interface
interface OrderFilters {
    status?: (number | string)[];  // ✅ Array of status values
    side?: number;
    token?: number;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
}

const OrderPanel = () => {
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const { getSymbol } = useTokenMapping();
    const { tokens } = useTokens();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cancellingOrderIndex, setCancellingOrderIndex] = useState<number | null>(null);

    // Dropdown states
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isSideDropdownOpen, setIsSideDropdownOpen] = useState(false);
    const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const sideDropdownRef = useRef<HTMLDivElement>(null);
    const tokenDropdownRef = useRef<HTMLDivElement>(null);

    // Proof hooks
    const { calculateNewState, cancelOrder } = useProof();
    const { generateWalletUpdateProofClient } = useWalletUpdateProof();

    // ✅ Filter state với default status=["Created"], limit=4
    const [filters, setFiltersState] = useState<OrderFilters>({
        status: ['Created'],
        page: 1,
        limit: 4,
    });

    /**
     * ✅ Set filter function - update filters và trigger refetch
     */
    const setFilter = (newFilters: Partial<OrderFilters>) => {
        setFiltersState((prev) => ({
            ...prev,
            ...newFilters,
            page: newFilters.page ?? 1,
        }));
    };

    // Clear all filters
    const clearFilters = () => {
        setFiltersState({
            status: ['Created'],
            page: 1,
            limit: 4,
        });
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
            if (sideDropdownRef.current && !sideDropdownRef.current.contains(event.target as Node)) {
                setIsSideDropdownOpen(false);
            }
            if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
                setIsTokenDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle cancel order
    const handleCancelOrder = async (orderIndex: number) => {
        try {
            setCancellingOrderIndex(orderIndex);
            console.log('🚫 Starting cancel order process...', { orderIndex });

            // Get wallet address
            const walletAddress = wallets.find(wallet => wallet.connectorType === 'embedded')?.address;
            if (!walletAddress) {
                toast.error('Please connect wallet first!');
                setCancellingOrderIndex(null);
                return;
            }

            // Get Privy user ID
            if (!user?.id) {
                toast.error('Please authenticate with Privy first!');
                setCancellingOrderIndex(null);
                return;
            }

            // Step 1: Get user profile and old state
            console.log('📊 Step 1: Fetching user profile...');
            const walletId = extractPrivyWalletId(user.id);
            const profile = await getUserProfile(walletId);
            console.log('✅ Profile loaded:', profile);

            const oldState: WalletState = {
                available_balances: profile.available_balances || Array(10).fill('0'),
                reserved_balances: profile.reserved_balances || Array(10).fill('0'),
                orders_list: profile.orders_list || Array(4).fill(null),
                fees: profile.fees?.toString() || '0',
                blinder: profile.blinder,
            };

            // Step 2: Create OrderAction for cancel
            console.log('🔐 Step 2: Creating cancel order action...');
            const action: OrderAction = {
                type: 'order',
                operation_type: 1,  // ✅ 1 = CANCEL
                order_index: orderIndex,  // ✅ Index of order to cancel
            };

            // Step 3: Calculate new state
            console.log('🔐 Step 3: Calculating new state...');
            const { newState, operations } = await calculateNewState(
                oldState,
                action,
                profile.nonce || 0
            );

            console.log('✅ New state calculated:');
            console.log(`  - Orders: ${newState.orders_list.filter((o) => o !== null).length} active orders`);
            console.log('  - Operations:', operations);

            // Step 4: Generate proof
            console.log('🔐 Step 4: Generating wallet update proof...');
            const userSecret = '12312';

            const proofData = await generateWalletUpdateProofClient({
                userSecret,
                oldNonce: profile.nonce?.toString() || '0',
                oldMerkleRoot: profile.merkle_root,
                oldMerkleIndex: profile.merkle_index,
                oldHashPath: profile.sibling_paths,
                oldState,
                newState,
                operations
            });

            console.log('✅ Proof generated successfully:', proofData);

            // Step 5: Sign newCommitment
            console.log('🔍 Step 5: Signing newCommitment...');
            const newCommitment = proofData.publicInputs.new_wallet_commitment;
            const rootSignature = await signMessageWithSkRoot(newCommitment);
            console.log('✅ Signature created!');

            // Step 6: Call cancelOrder API
            console.log('🔍 Step 6: Calling cancelOrder API...');
            const result = await cancelOrder({
                proof: proofData.proof,
                publicInputs: proofData.publicInputs,
                wallet_address: walletAddress,
                operations,
                signature: rootSignature
            });

            if (result.success) {
                console.log('✅ Order cancelled successfully!', result);
                if (result.verified) {
                    toast.success('Order cancelled successfully!');
                    // ✅ Refetch orders to update list
                    const response = await getOrderList(walletId, filters);
                    setOrders(response.data || []);
                } else {
                    toast.error('Order cancellation failed');
                }
            } else {
                console.error('❌ Cancel order failed:', result.error);
                toast.error(`Cancel order failed: ${result.error}`);
            }

            setCancellingOrderIndex(null);
        } catch (error) {
            console.error('❌ Error in cancel order process:', error);
            toast.error(error instanceof Error ? error.message : 'Unknown error occurred');
            setCancellingOrderIndex(null);
        }
    };

    // Fetch orders on mount and when filters/authenticated changes
    useEffect(() => {
        if (!authenticated || !user?.id) {
            setOrders([]);
            return;
        }

        const fetchOrders = async () => {
            setLoading(true);
            setError(null);
            try {
                // ✅ Extract wallet_id from Privy user ID
                const walletId = extractPrivyWalletId(user.id);
                console.log('🔍 [OrderPanel] Fetching orders with filters:', filters);
                console.log('  - Wallet ID:', walletId);

                const response = await getOrderList(walletId, filters);
                console.log('✅ [OrderPanel] Orders fetched:', response.data?.length || 0, 'orders');
                setOrders(response.data || []);
            } catch (err) {
                console.error('❌ [OrderPanel] Failed to fetch orders:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch orders');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [authenticated, user?.id, filters]);

    const hasOrders = orders.length > 0;
    return (
        <div className="bg-black border-t border-gray-800">
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
                <div className="flex items-center space-x-4">
                    <button className="flex items-center space-x-2 text-sm">
                        <Filter className="w-4 h-4" />
                        <span className="text-white">Filters</span>
                    </button>

                    <div className="flex items-center space-x-2">
                        {/* Status dropdown */}
                        <div ref={statusDropdownRef} className="relative">
                            <button
                                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    filters.status && filters.status.length > 0
                                        ? 'bg-gray-900 border border-gray-700 text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <Circle className={`w-3 h-3 ${filters.status && filters.status.length > 0 ? 'text-green-500 fill-green-500' : ''}`} />
                                <span>Status</span>
                                <ChevronDown size={14} className={`transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isStatusDropdownOpen && (
                                <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[140px]">
                                    <button
                                        onClick={() => {
                                            setFilter({ status: ['Created'] });
                                            setIsStatusDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                                    >
                                        <Circle className="w-3 h-3 text-green-500 fill-green-500" />
                                        <span>Open</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFilter({ status: ['Matching'] });
                                            setIsStatusDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                                    >
                                        <Circle className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        <span>Pending</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFilter({ status: ['Cancelled'] });
                                            setIsStatusDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-800 transition-colors flex items-center space-x-2"
                                    >
                                        <Circle className="w-3 h-3 text-gray-500 fill-gray-500" />
                                        <span>Cancelled</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Side dropdown */}
                        <div ref={sideDropdownRef} className="relative">
                            <button
                                onClick={() => setIsSideDropdownOpen(!isSideDropdownOpen)}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    filters.side !== undefined
                                        ? 'bg-gray-900 border border-gray-700 text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <Circle className={`w-3 h-3 ${filters.side !== undefined ? 'text-blue-500 fill-blue-500' : ''}`} />
                                <span>Side</span>
                                <ChevronDown size={14} className={`transition-transform ${isSideDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isSideDropdownOpen && (
                                <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px]">
                                    <button
                                        onClick={() => {
                                            setFilter({ side: 0 });
                                            setIsSideDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-gray-800 transition-colors"
                                    >
                                        Buy
                                    </button>
                                    <button
                                        onClick={() => {
                                            setFilter({ side: 1 });
                                            setIsSideDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800 transition-colors"
                                    >
                                        Sell
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Token dropdown */}
                        <div ref={tokenDropdownRef} className="relative">
                            <button
                                onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    filters.token !== undefined
                                        ? 'bg-gray-900 border border-gray-700 text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <Circle className={`w-3 h-3 ${filters.token !== undefined ? 'text-purple-500 fill-purple-500' : ''}`} />
                                <span>Token</span>
                                <ChevronDown size={14} className={`transition-transform ${isTokenDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isTokenDropdownOpen && (
                                <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[160px] max-h-64 overflow-y-auto">
                                    {tokens.map((token) => (
                                        <button
                                            key={token.index}
                                            onClick={() => {
                                                setFilter({ token: token.index });
                                                setIsTokenDropdownOpen(false);
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

                        {/* Clear button */}
                        <button
                            onClick={clearFilters}
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <button className="text-sm text-gray-400 hover:text-white transition-colors">
                        Cancel all open orders
                    </button>
                    <button className="text-sm text-gray-400 hover:text-white transition-colors">
                        ∞
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-gray-800">
                        <th className="text-left px-3 py-2 text-gray-400 font-normal text-xs">Status</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-normal text-xs">Side</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-normal text-xs">Asset</th>
                        <th className="text-right px-3 py-2 text-gray-400 font-normal text-xs">Price</th>
                        <th className="text-right px-3 py-2 text-gray-400 font-normal text-xs">
                            <div className="flex items-center justify-end space-x-1">
                                <span>Size</span>
                                <span className="text-xs">◇</span>
                            </div>
                        </th>
                        <th className="text-right px-3 py-2 text-gray-400 font-normal text-xs">
                            <div className="flex items-center justify-end space-x-1">
                                <span>Value</span>
                                <span className="text-xs">▲</span>
                            </div>
                        </th>
                        <th className="text-right px-3 py-2 text-gray-400 font-normal text-xs">Filled</th>
                        <th className="text-right px-3 py-2 text-gray-400 font-normal text-xs">
                            <div className="flex items-center justify-end space-x-1">
                                <span>Time</span>
                                <span className="text-xs">▼</span>
                            </div>
                        </th>
                        <th className="text-center px-3 py-2 text-gray-400 font-normal text-xs">Action</th>
                    </tr>
                    </thead>
                    <tbody>
                    {!authenticated ? (
                        <tr>
                            <td colSpan={9} className="text-center py-20 text-gray-400">
                                Sign in to view your orders.
                            </td>
                        </tr>
                    ) : loading ? (
                        <tr>
                            <td colSpan={9} className="text-center py-20 text-gray-400">
                                Loading orders...
                            </td>
                        </tr>
                    ) : error ? (
                        <tr>
                            <td colSpan={9} className="text-center py-20 text-red-500">
                                Error: {error}
                            </td>
                        </tr>
                    ) : !hasOrders ? (
                        <tr>
                            <td colSpan={9} className="text-center py-20 text-gray-400">
                                No open orders.
                            </td>
                        </tr>
                    ) : (
                        orders.map((order, index) => {
                            // ✅ Get token symbol from asset index
                            const assetSymbol = getSymbol(order.asset);

                            const isBuy = order.side === 0;
                            const status = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] || ORDER_STATUS['Created'];

                            // Format time
                            const orderTime = new Date(order.time).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            });

                            // Calculate filled percentage
                            const filledPercent = order.filled > 0 ? ((order.filled / order.size) * 100).toFixed(0) : '0';

                            return (
                                <tr key={index} className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
                                    {/* Status */}
                                    <td className="px-3 py-3">
                                        <div className="flex items-center space-x-1.5">
                                            <Circle className={`w-2.5 h-2.5 ${status.dotColor}`} />
                                            <span className={`${status.color} text-xs`}>{status.label}</span>
                                        </div>
                                    </td>

                                    {/* Side */}
                                    <td className="px-3 py-3">
                                        <span className={`font-medium text-xs ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                                            {isBuy ? 'Buy' : 'Sell'}
                                        </span>
                                    </td>

                                    {/* Asset */}
                                    <td className="px-3 py-3">
                                        <div className="flex items-center space-x-1.5">
                                            <TokenIconBySymbol symbol={assetSymbol} size="sm" />
                                            <span className="text-white font-medium text-xs">
                                                {assetSymbol}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Price */}
                                    <td className="px-3 py-3 text-right text-white text-xs">
                                        {order.price}
                                    </td>

                                    {/* Size */}
                                    <td className="px-3 py-3 text-right text-white text-xs">
                                        {order.size}
                                    </td>

                                    {/* Order Value */}
                                    <td className="px-3 py-3 text-right text-white text-xs">
                                        {order.order_value.toFixed(2)}
                                    </td>

                                    {/* Filled */}
                                    <td className="px-3 py-3 text-right">
                                        <span className={`text-xs ${order.filled > 0 ? 'text-white' : 'text-gray-400'}`}>
                                            {filledPercent}%
                                        </span>
                                    </td>

                                    {/* Time */}
                                    <td className="px-3 py-3 text-right text-gray-400 text-xs">
                                        {orderTime}
                                    </td>

                                    {/* Action - Cancel Button (Only show for Created status) */}
                                    <td className="px-3 py-3 text-center">
                                        {order.status === 'Created' && (
                                            <button
                                                onClick={() => handleCancelOrder(order.order_index)}
                                                disabled={cancellingOrderIndex === order.order_index}
                                                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Cancel Order"
                                            >
                                                {cancellingOrderIndex === order.order_index ? (
                                                    <>
                                                        <div className="w-3 h-3 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                                                        <span>Cancelling...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X size={14} />
                                                        <span>Cancel</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrderPanel;
