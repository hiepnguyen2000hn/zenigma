// Token configuration
export const TOTAL_TOKEN = 10; // Số lượng token hỗ trợ trong wallet

// Order configuration
export const MAX_PENDING_ORDER = 20; // Số lượng order tối đa có thể pending

// API configuration
export const API_ENDPOINTS = {
  PROOF: {
    GENERATE_WALLET_INIT: '/api/proof/generate-wallet-init',
  },
} as const;
