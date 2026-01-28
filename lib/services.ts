import apiClient from './api';
import { API_ENDPOINTS } from './constants';

export interface Token {
  name: string;
  symbol: string;
  address: string;
  index: number;
  decimals: number;
}

export interface Order {
  status: string;    // Order status: "Created", "Matching", "Filled", etc.
  order_index: number; // Order index (0-3) - use this for cancel
  side: number;      // 0=buy, 1=sell
  asset: number;     // Token index
  order_value: number;
  price: number;     // Order price
  size: number;
  filled: number;
  time: string;      // ISO 8601 timestamp
}

export interface OrderListResponse {
  data: Order[];
}

export interface MatchingHistory {
  id: string;
  order_id: string;
  side: number;        // 0=buy, 1=sell
  asset: number;       // Token index
  price: number;
  size: number;
  filled: number;
  order_value: number;
  status: string;
  time: string;        // ISO 8601 timestamp
}

export interface MatchingHistoryResponse {
  data: MatchingHistory[];
}

export interface Transfer {
  status: string;    // Transfer status: "queued" | "completed" | "failed"
  token: number;     // Token index
  direction: string; // Transfer direction: "DEPOSIT" | "WITHDRAW"
  amount: string;    // Transfer amount
  value: string;     // USD value (without $ sign)
  tx_hash: string;   // Transaction hash
  time: string;      // ISO 8601 timestamp
}

export interface TransferHistoryResponse {
  data: Transfer[];
}

export interface TokenBalanceItem {
  token_index: number;
  token_address: string;
  token_name: string;
  token_symbol: string;
  token_decimals: number;
  available: string;
  reserved: string;
  total: string;
}

export interface UserBalanceResponse {
  balances: TokenBalanceItem[];
}

export interface UserProfile {
  _id: string;
  wallet_address: string;
  available_balances: string[];
  reserved_balances: string[];
  orders_list: any[];
  fees: string;
  nonce: number;
  merkle_root: string;
  merkle_index: number;
  sibling_paths: string[];
  sync: boolean;
  is_initialized: boolean;  // ✅ Check this to decide if need to init wallet
  blinder?: string;
  pk_root?: string;
  current_commitment?: string;
  current_nullifier?: string;
  last_tx_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface VerifyProofRequest {
  proof: string;
  publicInputs: Record<string, string>;
  circuitName: string;
  wallet_address: string;
  randomness: string;
  operations?: {
    transfer?: {
      direction: number;
      token_index: number;
      amount: string;
      permit2Nonce?: string;
      permit2Deadline?: string;
      permit2Signature?: string;
    };
    order?: {
      operation_type: number;
      order_index: number;
      order_data?: {
        id: string;
        price: string;
        qty: string;
        side: string;
        token_in: string;
        token_out: string;
      };
    };
  };
  signature?: string;
}

export interface InitWalletProofRequest {
  proof: string;
  wallet_address: string;
  signature: string;
  pk_root: string;
  blinder: string;
  pk_match: string;
  sk_match: string;
  publicInputs: {
    initial_commitment: string;
  };
}

export interface UpdateWalletProofRequest {
  proof: string;
  wallet_address: string;
  randomness: string;
  signature: string;
  publicInputs: {
    old_wallet_commitment: string;
    new_wallet_commitment: string;
    nullifier: string;
    old_merkle_root: string;
    transfer_mint: string;
    transfer_amount: string;
    transfer_direction: string;
  };
  operations: {
    transfer: {
      direction: number;
      token_index: number;
      amount: string;
      permit2Nonce: string;
      permit2Deadline: string;
      permit2Signature: string;
    };
    order: {
      operation_type: number;
      order_index: number;
      order_data: {
        price: string;
        qty: string;
        side: number;
        token_in: number;
        token_out: number;
      };
    };
  };
}

export async function generateNonce(address: string): Promise<{ nonce: string }> {
  const response = await apiClient.post(API_ENDPOINTS.AUTH.GENERATE_NONCE, {
    address,
  });
  return response.data;
}

export async function login(address: string, signature: string): Promise<{ access_token: string }> {
  const response = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
    address,
    signature,
  });
  return response.data;
}

export async function getUserProfile(wallet_id: string): Promise<UserProfile> {
  // Replace :id in endpoint with wallet_id
  const endpoint = API_ENDPOINTS.USER.PROFILE.replace(':id', wallet_id);

  const response = await apiClient.get(endpoint);

  return response.data;
}

export async function getUserBalance(wallet_id: string): Promise<UserBalanceResponse> {
  // Replace :id in endpoint with wallet_id
  const endpoint = API_ENDPOINTS.USER.BALANCE.replace(':id', wallet_id);

  const response = await apiClient.get(endpoint);

  return response.data;
}

export async function getAllTokens(): Promise<Token[]> {
  const response = await apiClient.get<Token[]>(API_ENDPOINTS.TOKEN.GET_ALL);
  return response.data;
}

export async function getTokenById(id: string): Promise<Token> {
  const endpoint = API_ENDPOINTS.TOKEN.GET_BY_ID.replace(':id', id);
  const response = await apiClient.get<Token>(endpoint);
  return response.data;
}

export async function getTokenBalance(
  walletAddress: string,
  tokenAddress?: string
): Promise<any> {
  const response = await apiClient.get(API_ENDPOINTS.TOKEN.GET_BALANCE, {
    params: {
      walletAddress,
      ...(tokenAddress && { tokenAddress }),
    },
  });
  return response.data;
}

export async function verifyProof(data: VerifyProofRequest): Promise<any> {
  const response = await apiClient.post(API_ENDPOINTS.PROOF.VERIFY, data);
  return response.data;
}

export async function initWalletProof(data: InitWalletProofRequest): Promise<any> {
  const response = await apiClient.post(API_ENDPOINTS.PROOF.INIT_WALLET, data);
  return response.data;
}

/**
 * Update wallet proof - Verify wallet update proof
 *
 * @param data - Update wallet proof request
 * @returns Verification result
 *
 * @example
 * const result = await updateWalletProof({
 *   proof: "0x1234567890abcdef...",
 *   wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
 *   randomness: "12345678901234567890",
 *   signature: "0x1234567890abcdef...",
 *   publicInputs: {
 *     old_wallet_commitment: "0x123...",
 *     new_wallet_commitment: "0x456...",
 *     nullifier: "0x789...",
 *     old_merkle_root: "0xabc...",
 *     transfer_mint: "0",
 *     transfer_amount: "1000000",
 *     transfer_direction: "0"
 *   },
 *   operations: {
 *     transfer: {
 *       direction: 0,
 *       token_index: 0,
 *       amount: "1000000",
 *       permit2Nonce: "1000000",
 *       permit2Deadline: "1000000",
 *       permit2Signature: "1000000"
 *     },
 *     order: {
 *       operation_type: 0,
 *       order_index: 0,
 *       order_data: {
 *         price: "1000000000000000000",
 *         qty: "5000000000000000000",
 *         side: 0,
 *         token_in: 0,
 *         token_out: 1
 *       }
 *     }
 *   }
 * });
 */
export async function updateWalletProof(data: UpdateWalletProofRequest): Promise<any> {
  const response = await apiClient.post(API_ENDPOINTS.PROOF.UPDATE_WALLET, data);
  return response.data;
}

export async function getOrderList(
  wallet_id: string,
  params?: {
    page?: number;
    limit?: number;
    status?: (number | string)[];  // ✅ Array of status values
    side?: number;
    token?: number;
    from_date?: string;
    to_date?: string;
  }
): Promise<OrderListResponse> {
  const endpoint = API_ENDPOINTS.ORDER.LIST.replace(':wallet_id', wallet_id);
  const response = await apiClient.get(endpoint, { params });
  return response.data;
}

export async function getMatchingHistory(
  wallet_id: string,
  params?: {
    page?: number;
    limit?: number;
    from_date?: number;  // Unix timestamp in milliseconds
    to_date?: number;    // Unix timestamp in milliseconds
  }
): Promise<MatchingHistoryResponse> {
  const endpoint = API_ENDPOINTS.MATCHING_HISTORY.LIST.replace(':wallet_id', wallet_id);
  const response = await apiClient.get(endpoint, { params });
  return response.data;
}

export async function getTransferHistory(
  wallet_id: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string[];
    direction?: string;
    token?: number;
    from_date?: string;
    to_date?: string;
  }
): Promise<TransferHistoryResponse> {
  const endpoint = API_ENDPOINTS.BALANCE.TRANSFER_HISTORY.replace(':wallet_id', wallet_id);
  const response = await apiClient.get(endpoint, { params });
  return response.data;
}

export function buildEndpoint(
  endpoint: string,
  params: Record<string, string | number>
): string {
  let result = endpoint;
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`:${key}`, String(value));
  });
  return result;
}

export function scaleToInt(value: string, precision: number): string {
  const decimals = Math.log10(precision); // e.g. 10000 -> 4, 100000000 -> 8
  const [intPart, fracPart = ''] = value.split('.');
  const padded = fracPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(intPart + padded).toString();
}

export function intToDecimal(value: string, precision: number): string {
  const decimals = Math.round(Math.log10(precision));
  const str = value.padStart(decimals + 1, '0');
  const intPart = str.slice(0, str.length - decimals);
  const fracPart = str.slice(str.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}