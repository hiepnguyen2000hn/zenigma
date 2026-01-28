// Token configuration
export const TOTAL_TOKEN = 10; // Số lượng token hỗ trợ trong wallet

// Order configuration
export const MAX_PENDING_ORDER = 4; // Số lượng order tối đa có thể pending

// ============================================
// CONTRACT ADDRESSES
// ============================================

// Permit2 contract address
export const PERMIT2_ADDRESS = process.env.NEXT_PUBLIC_PERMIT2_ADDRESS as `0x${string}`;

// DarkPool Core contract address (Spender/Relayer)
export const DARKPOOL_CORE_ADDRESS = process.env.NEXT_PUBLIC_DARKPOOL_CORE_ADDRESS as `0x${string}`;

// Mock USDC contract address
export const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as `0x${string}`;

// Mock USDT contract address
export const MOCK_USDT_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDT_ADDRESS as `0x${string}`;

export const PERCISION = 10000;

export const BALANCE_PERCISION = PERCISION * PERCISION;
// ============================================
// ERC20 TOKEN CONFIGURATION
// ============================================

export interface ERC20TokenConfig {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  icon?: string;
}

// ERC20 Tokens configuration - Easy to extend for new tokens!
// To add new token: Just add env var and config here, no need to modify other files!
export const ERC20_TOKENS: Record<string, ERC20TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: MOCK_USDC_ADDRESS,
    decimals: 6,
    icon: '💵',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: MOCK_USDT_ADDRESS,
    decimals: 6,
    icon: '💲',
  },
  // Easy to add more tokens:
  // DAI: {
  //   symbol: 'DAI',
  //   name: 'Dai Stablecoin',
  //   address: process.env.NEXT_PUBLIC_MOCK_DAI_ADDRESS as `0x${string}`,
  //   decimals: 18,
  //   icon: '🪙',
  // },
};

// Helper to get token config by symbol
export const getTokenConfig = (symbol: string): ERC20TokenConfig | undefined => {
  return ERC20_TOKENS[symbol.toUpperCase()];
};

// Helper to get all available ERC20 tokens
export const getAvailableERC20Tokens = (): ERC20TokenConfig[] => {
  return Object.values(ERC20_TOKENS);
};

// WETH contract addresses by chain
export const WETH_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // Sepolia
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum Mainnet
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum
  10: '0x4200000000000000000000000000000000000006', // Optimism
};

// ============================================
// API CONFIGURATION
// ============================================

// API prefix
export const API_PREFIX = '/api/v1';

// API Endpoints - Centralized
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    GENERATE_NONCE: `${API_PREFIX}/auth/generate-nonce`,
    LOGIN: `${API_PREFIX}/auth/login`,
    REFRESH: `${API_PREFIX}/auth/refresh`,
    LOGOUT: `${API_PREFIX}/auth/logout`,
  },

  // User
  USER: {
    PROFILE: `${API_PREFIX}/user/:id/profile`,
    BALANCE: `${API_PREFIX}/user/:id/balance`,
    UPDATE_PROFILE: `${API_PREFIX}/user/profile`,
  },

  // Proof
  PROOF: {
    VERIFY: `${API_PREFIX}/proofs/verify`,
    INIT_WALLET: `${API_PREFIX}/proofs/init-wallet`,
    UPDATE_WALLET: `${API_PREFIX}/proofs/update-wallet`,
    TRANSFER: `${API_PREFIX}/balance/transfer`,  // ✅ Fixed typo: blance → balance
    CREATE_ORDER: `${API_PREFIX}/order/create`,
    CANCEL_ORDER: `${API_PREFIX}/order/cancel`,
    GENERATE_WALLET_INIT: '/api/proof/generate-wallet-init',
    GENERATE_WALLET_UPDATE: '/api/proof/generate-wallet-update',
  },

  // Order
  ORDER: {
    LIST: `${API_PREFIX}/order/:wallet_id/list`,
  },

  // Matching History
  MATCHING_HISTORY: {
    LIST: `${API_PREFIX}/matching-history/:wallet_id/list`,
  },

  // Balance
  BALANCE: {
    TRANSFER_HISTORY: `${API_PREFIX}/balance/:wallet_id/transfer-history`,
  },

  // Token
  TOKEN: {
    GET_ALL: `${API_PREFIX}/token/all`,
    GET_BY_ID: `${API_PREFIX}/token/:id`,
    GET_BALANCE: `${API_PREFIX}/token/balance`,
  },

  // Utils
  UTILS: {
    POSEIDON_HASH: '/api/utils/poseidon-hash',
  },
} as const;
