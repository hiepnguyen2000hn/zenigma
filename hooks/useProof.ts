import { useState } from 'react';
import { TOTAL_TOKEN, MAX_PENDING_ORDER, API_ENDPOINTS } from '@/lib/constants';
import apiClient from '@/lib/api';  // ✅ Import apiClient

// ============================================
// TYPE DEFINITIONS FOR calculateNewState
// ============================================

// Wallet State Structure
export interface WalletState {
  available_balances: string[];  // Array of 10 token balances
  reserved_balances: string[];   // Array of 10 token balances
  orders_list: (OrderInState | null)[];  // Array of 4 orders
  fees: string;
  blinder?: string;  // ✅ Add blinder (optional for backwards compatibility)
}

// Order in state (without id, since id is only for API)
export interface OrderInState {
  price: string;
  qty: string;
  side: number;      // 0=BUY, 1=SELL
  token_in: number;
  token_out: number;
}

// Transfer Action
export interface TransferAction {
  type: 'transfer';
  direction: number;   // 0=DEPOSIT, 1=WITHDRAW
  token_index: number;
  amount: string;
  permit2Nonce?: string;
  permit2Deadline?: string;
  permit2Signature?: string;
}

// Order Action
export interface OrderAction {
  type: 'order';
  operation_type: number;  // 0=CREATE, 1=CANCEL
  order_index: number;
  order_data?: OrderInState;  // Required for CREATE, optional for CANCEL
}

// Combined Action (both transfer and order)
export interface CombinedAction {
  type: 'combined';
  transfer: Omit<TransferAction, 'type'>;
  order: Omit<OrderAction, 'type'>;
}

// Return Type
export interface CalculateNewStateResult {
  newState: WalletState;
  operations: Operations;
}

// ============================================
// EXISTING TYPE DEFINITIONS
// ============================================

interface PublicInputs {
  initial_commitment: string;
}

interface Transfer {
  direction: number;
  token_index: number;
  amount: string;
  permit2Nonce?: string;
  permit2Deadline?: string;
  permit2Signature?: string;
}

interface OrderData {
  id: string;
  price: string;
  qty: string;
  side: number;
  token_in: number;
  token_out: number;
}

interface Order {
  operation_type: number;
  order_index: number;
  order_data: OrderData;
}

interface Operations {
  transfer?: Transfer;
  order?: Order;
}

interface VerifyProofParams {
  proof: string;
  publicInputs: PublicInputs;
  circuitName: string;
  wallet_address: string;
  randomness: string;
  operations?: Operations;
  signature?: string;
}

interface VerifyProofResponse {
  success: boolean;
  verified?: boolean;
  message?: string;
  error?: string;
}

// ============================================
// HELPER FUNCTIONS FOR calculateNewState
// ============================================

/**
 * Deep clone wallet state to avoid mutations
 */
function deepCloneState(state: WalletState): WalletState {
  return {
    available_balances: [...state.available_balances],
    reserved_balances: [...state.reserved_balances],
    orders_list: state.orders_list.map(order =>
      order === null ? null : { ...order }
    ),
    fees: state.fees,
    ...(state.blinder && { blinder: state.blinder })  // ✅ Copy blinder if exists
  };
}

/**
 * Validate wallet state structure
 */
function validateStateStructure(state: WalletState): void {
  if (!state || typeof state !== 'object') {
    throw new Error('[calculateNewState] Invalid state: state must be an object');
  }

  if (!Array.isArray(state.available_balances) ||
      state.available_balances.length !== TOTAL_TOKEN) {
    throw new Error(`[calculateNewState] Invalid state: available_balances must have exactly ${TOTAL_TOKEN} elements`);
  }

  if (!Array.isArray(state.reserved_balances) ||
      state.reserved_balances.length !== TOTAL_TOKEN) {
    throw new Error(`[calculateNewState] Invalid state: reserved_balances must have exactly ${TOTAL_TOKEN} elements`);
  }

  if (!Array.isArray(state.orders_list) ||
      state.orders_list.length !== MAX_PENDING_ORDER) {
    throw new Error(`[calculateNewState] Invalid state: orders_list must have exactly ${MAX_PENDING_ORDER} elements`);
  }

  // Validate all balances are numeric strings
  [...state.available_balances, ...state.reserved_balances, state.fees].forEach((balance, idx) => {
    if (typeof balance !== 'string' || !/^\d+$/.test(balance)) {
      throw new Error(`[calculateNewState] Invalid balance at index ${idx}: must be a numeric string`);
    }
  });
}

/**
 * Process transfer operation and update state
 */
function processTransfer(
  newState: WalletState,
  transfer: Omit<TransferAction, 'type'>,
  operations: Operations
): void {
  // Validate token_index
  if (typeof transfer.token_index !== 'number' ||
      transfer.token_index < 0 ||
      transfer.token_index >= TOTAL_TOKEN) {
    throw new Error(`[calculateNewState] Invalid token_index: must be between 0 and ${TOTAL_TOKEN - 1}`);
  }

  // Validate direction
  if (typeof transfer.direction !== 'number' ||
      (transfer.direction !== 0 && transfer.direction !== 1)) {
    throw new Error('[calculateNewState] Invalid direction: must be 0 (DEPOSIT) or 1 (WITHDRAW)');
  }

  // Validate amount
  const amount = BigInt(transfer.amount);
  // const amount = transfer.amount
  if (amount <= 0n) {
    throw new Error('[calculateNewState] Invalid amount: must be greater than 0');
  }

  // Process DEPOSIT (direction=0)
  if (transfer.direction === 0) {
    const currentBalance = BigInt(newState.available_balances[transfer.token_index]);
    newState.available_balances[transfer.token_index] = (currentBalance + amount).toString();
  }
  // Process WITHDRAW (direction=1)
  else if (transfer.direction === 1) {
    // Validate fees must be 0 for withdrawal
    if (newState.fees !== '0') {
      throw new Error('[calculateNewState] Cannot withdraw: fees must be 0');
    }

    // Check sufficient balance
    const currentBalance = BigInt(newState.available_balances[transfer.token_index]);
    if (currentBalance < amount) {
      throw new Error(
        `[calculateNewState] Insufficient balance: have ${currentBalance}, need ${amount} for token ${transfer.token_index}`
      );
    }

    newState.available_balances[transfer.token_index] = (currentBalance - amount).toString();
  }

  // Build operations.transfer
  operations.transfer = {
    direction: transfer.direction,
    token_index: transfer.token_index,
    amount: transfer.amount,
    ...(transfer.permit2Nonce && { permit2Nonce: transfer.permit2Nonce }),
    ...(transfer.permit2Deadline && { permit2Deadline: transfer.permit2Deadline }),
    ...(transfer.permit2Signature && { permit2Signature: transfer.permit2Signature })
  };
}

/**
 * Process order operation and update state
 */
function processOrder(
  newState: WalletState,
  order: Omit<OrderAction, 'type'>,
  operations: Operations
): void {
  // Validate order_index
  if (typeof order.order_index !== 'number' ||
      order.order_index < 0 ||
      order.order_index >= MAX_PENDING_ORDER) {
    throw new Error(`[calculateNewState] Invalid order_index: must be between 0 and ${MAX_PENDING_ORDER - 1}`);
  }

  // Validate operation_type
  if (typeof order.operation_type !== 'number' ||
      (order.operation_type !== 0 && order.operation_type !== 1)) {
    throw new Error('[calculateNewState] Invalid operation_type: must be 0 (CREATE) or 1 (CANCEL)');
  }

  // Process CREATE order (operation_type=0)
  if (order.operation_type === 0) {
    if (!order.order_data) {
      throw new Error('[calculateNewState] order_data is required for CREATE operation');
    }

    // Validate order slot is empty
    if (newState.orders_list[order.order_index] !== null) {
      throw new Error(`[calculateNewState] Order slot ${order.order_index} is already occupied`);
    }

    const { price, qty, side, token_in, token_out } = order.order_data;

    // Validate order data
    const priceBI = BigInt(price);
    const qtyBI = BigInt(qty);

    if (priceBI <= 0n) {
      throw new Error('[calculateNewState] Invalid price: must be greater than 0');
    }
    if (qtyBI <= 0n) {
      throw new Error('[calculateNewState] Invalid qty: must be greater than 0');
    }
    if (token_in < 0 || token_in >= TOTAL_TOKEN) {
      throw new Error(`[calculateNewState] Invalid token_in: must be between 0 and ${TOTAL_TOKEN - 1}`);
    }
    if (token_out < 0 || token_out >= TOTAL_TOKEN) {
      throw new Error(`[calculateNewState] Invalid token_out: must be between 0 and ${TOTAL_TOKEN - 1}`);
    }
    if (token_in === token_out) {
      throw new Error('[calculateNewState] Invalid order: token_in and token_out must be different');
    }
    if (side !== 0 && side !== 1) {
      throw new Error('[calculateNewState] Invalid side: must be 0 (BUY) or 1 (SELL)');
    }

    // Calculate reservation amount based on side
    // NOTE: token_out = token trả (token you pay), token_in = token nhận (token you receive)
    if (side === 0) {
      // BUY: reserve price * qty in token_out (token trả)
      const reserveAmount = priceBI * qtyBI;
      const availableBalance = BigInt(newState.available_balances[token_out]);
      console.log(availableBalance, 'availableBalance token_out', token_out, 'reserveAmount', reserveAmount)
      if (availableBalance < reserveAmount) {
        throw new Error(
          `[calculateNewState] Insufficient balance for BUY order: have ${availableBalance}, need ${reserveAmount} in token ${token_out}`
        );
      }

      // Move from available to reserved
      newState.available_balances[token_out] = (availableBalance - reserveAmount).toString();
      newState.reserved_balances[token_out] = (
        BigInt(newState.reserved_balances[token_out]) + reserveAmount
      ).toString();
    } else {
      // SELL: reserve qty in token_out (token trả/bán)
      const availableBalance = BigInt(newState.available_balances[token_out]);

      if (availableBalance < qtyBI) {
        throw new Error(
          `[calculateNewState] Insufficient balance for SELL order: have ${availableBalance}, need ${qtyBI} in token ${token_out}`
        );
      }

      // Move from available to reserved
      newState.available_balances[token_out] = (availableBalance - qtyBI).toString();
      newState.reserved_balances[token_out] = (
        BigInt(newState.reserved_balances[token_out]) + qtyBI
      ).toString();
    }

    // Add order to orders_list
    newState.orders_list[order.order_index] = { ...order.order_data };

    // Build operations.order for CREATE
    operations.order = {
      operation_type: 0,
      order_index: order.order_index,
      order_data: {
        id: generateOrderId(),
        ...order.order_data
      }
    };
  }
  // Process CANCEL order (operation_type=1)
  else if (order.operation_type === 1) {
    const existingOrder = newState.orders_list[order.order_index];

    if (existingOrder === null) {
      throw new Error(`[calculateNewState] No order found at index ${order.order_index} to cancel`);
    }

    const { price, qty, side, token_in, token_out } = existingOrder;
    const priceBI = BigInt(price);
    const qtyBI = BigInt(qty);

    // Release reserved balance based on side
    // NOTE: token_out = token trả (token you paid), token_in = token nhận (token you received)
    if (side === 0) {
      // BUY: release price * qty from reserved_balances[token_out]
      const releaseAmount = priceBI * qtyBI;
      newState.reserved_balances[token_out] = (
        BigInt(newState.reserved_balances[token_out]) - releaseAmount
      ).toString();
      newState.available_balances[token_out] = (
        BigInt(newState.available_balances[token_out]) + releaseAmount
      ).toString();
    } else {
      // SELL: release qty from reserved_balances[token_out]
      newState.reserved_balances[token_out] = (
        BigInt(newState.reserved_balances[token_out]) - qtyBI
      ).toString();
      newState.available_balances[token_out] = (
        BigInt(newState.available_balances[token_out]) + qtyBI
      ).toString();
    }

    // Remove order from orders_list
    newState.orders_list[order.order_index] = null;

    // Build operations.order for CANCEL
    operations.order = {
      operation_type: 1,
      order_index: order.order_index,
      order_data: {
        id: '0',
        price: existingOrder.price,
        qty: existingOrder.qty,
        side: existingOrder.side,
        token_in: existingOrder.token_in,
        token_out: existingOrder.token_out
      }
    };
  }
}

/**
 * Generate unique order ID
 */
function generateOrderId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Derive new blinder from old blinder and new nonce
 * Uses Poseidon2 hash (matches backend test file)
 */
export async function deriveNewBlinder(oldBlinder: string, newNonce: string): Promise<string> {
  // Import Barretenberg and Fr for Poseidon2 hash
  const { BarretenbergSync } = await import("@aztec/bb.js");
  const { Fr } = await import("@aztec/bb.js");

  // @ts-ignore
  const bb = await BarretenbergSync.new();

  // Hash [oldBlinder, newNonce]
  const inputs = [new Fr(BigInt(oldBlinder)), new Fr(BigInt(newNonce))];
  const result = bb.poseidon2Hash(inputs);

  return result.toString();
}

// ============================================
// MAIN FUNCTION: calculateNewState
// ============================================

/**
 * Calculate new wallet state from an action (transfer/order/both)
 *
 * @param oldState - Current wallet state
 * @param action - Action to apply (transfer, order, or combined)
 * @param oldNonce - Current nonce (required for deriving new blinder)
 * @returns New state and operations object ready for proof verification
 *
 * @throws Error if validation fails or insufficient balance
 *
 * @example
 * // Deposit example
 * const { newState, operations } = await calculateNewState(oldState, {
 *   type: 'transfer',
 *   direction: 0,
 *   token_index: 0,
 *   amount: '100000000'
 * }, oldNonce);
 *
 * @example
 * // Create order example
 * const { newState, operations } = await calculateNewState(oldState, {
 *   type: 'order',
 *   operation_type: 0,
 *   order_index: 0,
 *   order_data: {
 *     price: '1',
 *     qty: '100',
 *     side: 0,
 *     token_in: 1,
 *     token_out: 0
 *   }
 * }, oldNonce);
 */
export async function calculateNewState(
  oldState: WalletState,
  action: TransferAction | OrderAction | CombinedAction,
  oldNonce: number | string
): Promise<CalculateNewStateResult> {
  // Step 1: Validate state structure
  validateStateStructure(oldState);

  // Step 2: Deep clone state to avoid mutations
  const newState = deepCloneState(oldState);

  // Step 3: Initialize operations object
  const operations: Operations = {};

  // Step 4: Process action based on type
  if (action.type === 'transfer') {
    processTransfer(newState, action, operations);
  } else if (action.type === 'order') {
    processOrder(newState, action, operations);
  } else if (action.type === 'combined') {
    processTransfer(newState, action.transfer, operations);
    processOrder(newState, action.order, operations);
  } else {
    throw new Error(`[calculateNewState] Invalid action type: ${(action as any).type}`);
  }

  // Step 5: Derive new blinder (matches backend test file)
  const newNonce = Number(oldNonce) + 1;
  const oldBlinder = oldState.blinder || '0';
  const newBlinder = await deriveNewBlinder(oldBlinder, String(newNonce));
  newState.blinder = newBlinder;  // ✅ Set new blinder

  console.log('✅ [calculateNewState] New blinder derived:');
  console.log(`  - Old Nonce: ${oldNonce}`);
  console.log(`  - New Nonce: ${newNonce}`);
  console.log(`  - Old Blinder: ${oldBlinder.substring(0, 20)}...`);
  console.log(`  - New Blinder: ${newBlinder.substring(0, 20)}...`);

  // Step 6: Return result
  return { newState, operations };
}

// ============================================
// HOOK: useProof
// ============================================

export function useProof() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyProof = async ({
    proof,
    publicInputs,
    circuitName,
    wallet_address,
    randomness,
    operations = {
      transfer: {
        direction: 0,
        token_index: 0,
        amount: '100'
      },
      order: [

      ],
    },
    signature
  }: VerifyProofParams): Promise<VerifyProofResponse> => {
    setIsVerifying(true);
    setError(null);

    try {
      // ✅ Use apiClient instead of fetch() - automatically adds Authorization token
      const response = await apiClient.post(API_ENDPOINTS.PROOF.TRANSFER, {
        proof,
        wallet_address,
        signature,
        publicInputs,
        // "order_index": operations.order.order_index,
        // "order_data": {
        //   "price": operations.order.order_data.price,
        //   "qty": operations.order.order_data.qty,
        //   "side": operations.order.order_data.side,
        //   "token_in": operations.order.order_data.token_in,
        //   "token_out": operations.order.order_data.token_out,
        // },
        transfer: operations.transfer,
        // "order_indices": [
        //   1
        // ]
      });

      setIsVerifying(false);
      return {
        success: true,
        verified: response.data.verified,
        ...response.data,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsVerifying(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  // ✅ Submit order to CREATE_ORDER endpoint
  const submitOrder = async ({
    proof,
    publicInputs,
    wallet_address,
    operations,
    signature
  }: VerifyProofParams): Promise<VerifyProofResponse> => {
    setIsVerifying(true);
    setError(null);

    try {
      // Extract order data from operations
      if (!operations.order) {
        throw new Error('Order data is required for submitOrder');
      }

      // ✅ Call CREATE_ORDER endpoint with order-specific body
      const response = await apiClient.post(API_ENDPOINTS.PROOF.CREATE_ORDER, {
        proof,
        wallet_address,
        signature,
        publicInputs,
        order_index: operations.order.order_index,
        order_data: {
          price: operations.order.order_data.price,
          qty: operations.order.order_data.qty,
          side: operations.order.order_data.side,
          token_in: operations.order.order_data.token_in,
          token_out: operations.order.order_data.token_out,
        }
      });

      setIsVerifying(false);
      return {
        success: true,
        verified: response.data.verified,
        ...response.data,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsVerifying(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  // ✅ Cancel order to CANCEL_ORDER endpoint
  const cancelOrder = async ({
    proof,
    publicInputs,
    wallet_address,
    operations,
    signature
  }: VerifyProofParams): Promise<VerifyProofResponse> => {
    setIsVerifying(true);
    setError(null);

    try {
      // Extract order index from operations
      if (!operations.order) {
        throw new Error('Order data is required for cancelOrder');
      }

      // ✅ Call CANCEL_ORDER endpoint with order_indices body
      const response = await apiClient.post(API_ENDPOINTS.PROOF.CANCEL_ORDER, {
        proof,
        wallet_address,
        signature,
        publicInputs,
        order_indices: [operations.order.order_index]
      });

      setIsVerifying(false);
      return {
        success: true,
        verified: response.data.verified,
        ...response.data,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsVerifying(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  return {
    verifyProof,
    submitOrder,
    cancelOrder,
    isVerifying,
    error,
    calculateNewState,
  };
}

// ============================================
// RE-EXPORT CLIENT-SIDE WALLET UPDATE PROOF
// ============================================
export { useWalletUpdateProof } from './useWalletUpdateProof';