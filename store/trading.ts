import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// ============================================
// 1. TRADING PAIR STATE
// ============================================

export interface TradingPair {
  base: string;      // e.g., 'BTC', 'ETH'
  quote: string;     // e.g., 'USDT', 'USDC'
  symbol: string;    // e.g., 'btc-usdt'
}

// Current selected pair
export const tradingPairAtom = atom<TradingPair>({
  base: 'BTC',
  quote: 'USDC',
  symbol: 'btc-usdc',
});

// ============================================
// 2. ORDER INPUT STATE
// ============================================

export interface OrderInput {
  amount: string;           // User input amount
  side: 'buy' | 'sell';    // Order side
  orderType: 'market' | 'limit' | 'midpoint'; // Order type
  limitPrice?: string;      // For limit orders
  slippage: number;         // Slippage tolerance %
}

export const orderInputAtom = atom<OrderInput>({
  amount: '',
  side: 'buy',
  orderType: 'midpoint',
  slippage: 0.5,
});

// ============================================
// 3. PRICE & MARKET DATA
// ============================================

export interface PriceData {
  currentPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
  lastUpdate: number;
}

export const priceDataAtom = atom<PriceData>({
  currentPrice: 0,
  open: 0,
  high: 0,
  low: 0,
  close: 0,
  change: 0,
  changePercent: 0,
  volume: 0,
  lastUpdate: Date.now(),
});

// ============================================
// 4. USER BALANCES
// ============================================

export interface TokenBalance {
  token: string;
  balance: number;
  usdValue: number;
}

export const balancesAtom = atom<TokenBalance[]>([]);

// Derived: Get specific token balance
export const tokenBalanceAtom = (token: string) =>
  atom((get) => {
    const balances = get(balancesAtom);
    return balances.find((b) => b.token === token)?.balance || 0;
  });

// ============================================
// 5. ORDER CALCULATION (DERIVED)
// ============================================

export interface OrderCalculation {
  orderValue: number;
  fee: number;
  feePercent: number;
  totalCost: number;
  estimatedReceived: number;
  priceImpact: number;
}

export const orderCalculationAtom = atom<OrderCalculation>((get) => {
  const orderInput = get(orderInputAtom);
  const priceData = get(priceDataAtom);
  const pair = get(tradingPairAtom);

  const amount = parseFloat(orderInput.amount) || 0;
  const price = priceData.currentPrice;

  // Calculate order value
  const orderValue = amount * price;

  // Fee calculation (0.1% default)
  const feePercent = 0.1;
  const fee = (orderValue * feePercent) / 100;

  // Total cost
  const totalCost = orderInput.side === 'buy' ? orderValue + fee : orderValue - fee;

  // Estimated received
  const estimatedReceived = orderInput.side === 'buy' ? amount : orderValue - fee;

  // Price impact (simplified)
  const priceImpact = (amount / priceData.volume) * 100;

  return {
    orderValue,
    fee,
    feePercent,
    totalCost,
    estimatedReceived,
    priceImpact,
  };
});

// ============================================
// 6. ORDERS HISTORY
// ============================================

export interface Order {
  id: string;
  pair: TradingPair;
  side: 'buy' | 'sell';
  type: string;
  amount: number;
  price: number;
  total: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  timestamp: number;
  txHash?: string;
}

export const ordersAtom = atomWithStorage<Order[]>('trading-orders', []);

// Active orders only
export const activeOrdersAtom = atom((get) => {
  const orders = get(ordersAtom);
  return orders.filter((o) => o.status === 'pending');
});

// Order history (completed/cancelled)
export const orderHistoryAtom = atom((get) => {
  const orders = get(ordersAtom);
  return orders.filter((o) => o.status !== 'pending');
});

// ============================================
// 7. UI STATE
// ============================================

export interface UIState {
  isOrderModalOpen: boolean;
  isConfirmingOrder: boolean;
  orderError: string | null;
  isLoadingPrice: boolean;
  isLoadingBalance: boolean;
}

export const uiStateAtom = atom<UIState>({
  isOrderModalOpen: false,
  isConfirmingOrder: false,
  orderError: null,
  isLoadingPrice: false,
  isLoadingBalance: false,
});

// ============================================
// 8. CHART SETTINGS (PERSISTED)
// ============================================

export interface ChartSettings {
  timeframe: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  chartType: 'candlestick' | 'line' | 'area';
  indicators: string[];
}

export const chartSettingsAtom = atomWithStorage<ChartSettings>('chart-settings', {
  timeframe: '1h',
  chartType: 'candlestick',
  indicators: [],
});

// ============================================
// 9. ACTIONS (WRITE ATOMS)
// ============================================

// Update trading pair
export const updateTradingPairAtom = atom(
  null,
  (get, set, pair: TradingPair) => {
    set(tradingPairAtom, pair);
    // Reset order input when changing pair
    set(orderInputAtom, {
      ...get(orderInputAtom),
      amount: '',
    });
  }
);

// Update order amount
export const updateOrderAmountAtom = atom(
  null,
  (get, set, amount: string) => {
    set(orderInputAtom, {
      ...get(orderInputAtom),
      amount,
    });
  }
);

// Toggle order side (buy/sell)
export const toggleOrderSideAtom = atom(
  null,
  (get, set) => {
    const current = get(orderInputAtom);
    set(orderInputAtom, {
      ...current,
      side: current.side === 'buy' ? 'sell' : 'buy',
    });
  }
);

// Update limit price
export const updateLimitPriceAtom = atom(
  null,
  (get, set, limitPrice: string) => {
    set(orderInputAtom, {
      ...get(orderInputAtom),
      limitPrice,
    });
  }
);

// Set percentage of balance
export const setPercentageAtom = atom(
  null,
  (get, set, percentage: number) => {
    const orderInput = get(orderInputAtom);
    const pair = get(tradingPairAtom);
    const token = orderInput.side === 'buy' ? pair.quote : pair.base;
    const balance = get(tokenBalanceAtom(token));

    const amount = (balance * percentage) / 100;
    set(orderInputAtom, {
      ...orderInput,
      amount: amount.toString(),
    });
  }
);

// Add order to history
export const addOrderAtom = atom(
  null,
  (get, set, order: Omit<Order, 'id' | 'timestamp'>) => {
    const newOrder: Order = {
      ...order,
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set(ordersAtom, [...get(ordersAtom), newOrder]);
  }
);

// Update order status
export const updateOrderStatusAtom = atom(
  null,
  (get, set, { orderId, status, txHash }: { orderId: string; status: Order['status']; txHash?: string }) => {
    const orders = get(ordersAtom);
    set(
      ordersAtom,
      orders.map((o) =>
        o.id === orderId ? { ...o, status, txHash: txHash || o.txHash } : o
      )
    );
  }
);

// ============================================
// 10. USER PROFILE
// ============================================

export interface UserProfile {
  wallet_id: string;
  address: string;
  current_commitment: string;
  current_nullifier: string;
  merkle_index: number;
  merkle_root: string;
  available_balances: string[];
  reserved_balances: string[];
  orders_list: any[];
  fees: string;
  nonce: number;
  is_initialized: boolean;
  sync: boolean;
  sibling_paths: string[];
  pk_root?: string;
  blinder?: string;
  last_tx_hash?: string;
}

// User profile atom
export const userProfileAtom = atom<UserProfile | null>(null);

// Update user profile action
export const updateUserProfileAtom = atom(
  null,
  (get, set, profile: UserProfile) => {
    set(userProfileAtom, profile);

    // ✅ Auto-update balances when profile changes
    const balances: TokenBalance[] = profile.available_balances
      .map((balance, index) => {
        const balanceNum = parseFloat(balance);
        if (balanceNum > 0) {
          return {
            token: `Token${index}`, // Replace with token mapping
            balance: balanceNum,
            usdValue: balanceNum * 1, // Mock USD value
          };
        }
        return null;
      })
      .filter((b): b is TokenBalance => b !== null);

    set(balancesAtom, balances);
  }
);

// ============================================
// 11. DERIVED STATS
// ============================================

// Total portfolio value
export const portfolioValueAtom = atom((get) => {
  const balances = get(balancesAtom);
  return balances.reduce((sum, b) => sum + b.usdValue, 0);
});

// Check if can place order
export const canPlaceOrderAtom = atom((get) => {
  const orderInput = get(orderInputAtom);
  const calculation = get(orderCalculationAtom);
  const pair = get(tradingPairAtom);
  const token = orderInput.side === 'buy' ? pair.quote : pair.base;
  const balance = get(tokenBalanceAtom(token));

  const amount = parseFloat(orderInput.amount);

  if (!amount || amount <= 0) return false;
  if (orderInput.side === 'buy' && calculation.totalCost > balance) return false;
  if (orderInput.side === 'sell' && amount > balance) return false;

  return true;
});
