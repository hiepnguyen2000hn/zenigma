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
