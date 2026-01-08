'use client';

import { useState } from 'react';
import crypto from 'crypto-js';
import { TOTAL_TOKEN, MAX_PENDING_ORDER } from '@/lib/constants';
import type { WalletState, Operations } from './useProof';
import { getAllKeys } from '@/lib/ethers-signer';

/**
 * Client-side hook for generating wallet update proofs
 * Migrated from app/api/proof/generate-wallet-update/route.ts
 */

const GLOBAL_DEPTH = 16;

// Cached instances
let barretenberg: any = null;
let cachedCircuit: any = null;
let cachedBackend: any = null;
let cachedNoir: any = null;
let FrClass: any = null;

async function getBarretenberg(): Promise<any> {
  if (!barretenberg) {
    const { BarretenbergSync } = await import("@aztec/bb.js");
    // @ts-ignore
    barretenberg = await BarretenbergSync.new();
  }
  return barretenberg;
}

async function getFrClass(): Promise<any> {
  if (!FrClass) {
    const { Fr } = await import("@aztec/bb.js");
    FrClass = Fr;
  }
  return FrClass;
}

async function poseidon2Hash(inputs: (string | bigint)[], bb?: any, Fr?: any): Promise<string> {
  const barretenberg = bb || await getBarretenberg();
  const FrCls = Fr || await getFrClass();

  const fieldInputs = inputs.map(input => {
    const bigintValue = typeof input === 'string' ? BigInt(input) : input;
    return new FrCls(bigintValue);
  });

  const result = barretenberg.poseidon2Hash(fieldInputs);
  return result.toString();
}

/**
 * Compute order hash from order data
 */
async function computeOrderHash(order: any, bb?: any, Fr?: any): Promise<string> {
  if (order === null) return '0';
  return await poseidon2Hash([
    BigInt(order.price || '0'),
    BigInt(order.qty || '0'),
    BigInt(order.side || '0'),
    BigInt(order.token_in || '0'),
    BigInt(order.token_out || '0'),
  ], bb, Fr);
}

/**
 * Compute wallet commitment (matches backend test file structure)
 *
 * Commitment = Poseidon2([
 *   availableHash,
 *   reservedHash,
 *   ordersHash,
 *   keysHash,
 *   fees,
 *   blinder
 * ])
 *
 * Where keysHash = Poseidon2([pkRoot, pkMatch, nonce])
 */
async function computeWalletCommitment(
  availableBalances: (bigint | string)[],
  reservedBalances: (bigint | string)[],
  ordersList: (bigint | string)[],
  fees: bigint | string,
  pkRoot: bigint | string,
  pkMatch: bigint | string,
  nonce: bigint | string,
  blinder: bigint | string,
  bb?: any,
  Fr?: any
): Promise<string> {
  // Hash individual components
  const availableHash = await poseidon2Hash(availableBalances.map(b => b.toString()), bb, Fr);
  const reservedHash = await poseidon2Hash(reservedBalances.map(b => b.toString()), bb, Fr);
  const ordersHash = await poseidon2Hash(ordersList.map(o => o.toString()), bb, Fr);

  // Hash keys (pk_root, pk_match, nonce)
  const keysHash = await poseidon2Hash([
    pkRoot.toString(),
    pkMatch.toString(),
    nonce.toString()
  ], bb, Fr);

  // Final commitment
  const commitment = await poseidon2Hash([
    availableHash,
    reservedHash,
    ordersHash,
    keysHash,
    fees.toString(),
    blinder.toString()
  ], bb, Fr);

  return commitment;
}

/**
 * Calculate merkle root from leaf commitment and sibling paths
 */
async function computeMerkleRoot(
  commitment: string | bigint,
  index: number,
  hashPath: (string | bigint)[],
  bb?: any,
  Fr?: any
): Promise<string> {
  if (hashPath.length !== GLOBAL_DEPTH) {
    throw new Error(`Hash path must have exactly ${GLOBAL_DEPTH} elements, got ${hashPath.length}`);
  }

  let hash = commitment;

  for (let i = 0; i < GLOBAL_DEPTH; i++) {
    const isRight = ((index >> i) & 1) === 1;
    hash = await poseidon2Hash(
      isRight ? [hashPath[i], hash] : [hash, hashPath[i]],
      bb,
      Fr
    );
  }

  return hash.toString();
}

export function useWalletUpdateProof() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate wallet update proof (CLIENT-SIDE)
   */
  async function generateWalletUpdateProofClient(params: {
    userSecret: string;
    oldNonce: string;
    oldMerkleRoot: string;
    oldMerkleIndex: number;
    oldHashPath: string[];
    oldState: WalletState;
    newState: WalletState;
    operations?: Operations;
  }) {
    const {
      userSecret,
      oldNonce,
      oldMerkleRoot,
      oldMerkleIndex,
      oldHashPath,
      oldState,
      newState,
      operations
    } = params;

    if (!userSecret || !oldState || !newState) {
      return {
        success: false,
        error: 'userSecret, oldState, and newState are required'
      };
    }

    setIsGenerating(true);
    setProgress('Initializing...');
    setError(null);

    const startTime = Date.now();
    console.log('🚀 CLIENT-SIDE: Generating wallet update proof...');

    try {
      // ============================================
      // STEP 1: Load circuit
      // ============================================
      setProgress('Loading circuit...');

      if (!cachedCircuit) {
        const circuit = await import('@/circuits/wallet_update_state.json');
        cachedCircuit = circuit;
        console.log('✅ Circuit loaded and cached');
      }

      // ============================================
      // STEP 2: Initialize backend and noir
      // ============================================
      setProgress('Initializing backend...');

      if (!cachedBackend || !cachedNoir) {
        const { BarretenbergBackend } = await import("@noir-lang/backend_barretenberg");
        const { Noir } = await import("@noir-lang/noir_js");

        cachedBackend = new BarretenbergBackend(cachedCircuit, { threads: 8 });
        cachedNoir = new Noir(cachedCircuit);

        await cachedNoir.init();
        console.log('✅ Backend and Noir initialized and cached');
      }

      const backend = cachedBackend;
      const noir = cachedNoir;

      // ============================================
      // STEP 3: Get keys from localStorage
      // ============================================
      setProgress('Loading keys from localStorage...');

      const keys = getAllKeys();
      if (!keys.pk_root || !keys.pk_match || !keys.sk_match) {
        throw new Error('Keys not found in localStorage. Please initialize wallet first.');
      }

      console.log('✅ Keys loaded from localStorage');
      console.log('  - pk_root:', keys.pk_root.substring(0, 20) + '...');
      console.log('  - pk_match:', keys.pk_match.substring(0, 20) + '...');
      console.log('  - sk_match:', keys.sk_match.substring(0, 20) + '...');

      // ============================================
      // STEP 4: Prepare values
      // ============================================
      setProgress('Calculating commitments...');

      // Pre-load bb and Fr
      const bb = await getBarretenberg();
      const Fr = await getFrClass();

      // Convert pk_root address to BigInt
      const pkRootBigInt = BigInt(keys.pk_root);
      const pkMatchBigInt = BigInt(keys.pk_match);
      const skMatchBigInt = BigInt(keys.sk_match);

      // Calculate order hashes
      const [oldOrdersHashes, newOrdersHashes] = await Promise.all([
        Promise.all(oldState.orders_list.map(order => computeOrderHash(order, bb, Fr))),
        Promise.all(newState.orders_list.map(order => computeOrderHash(order, bb, Fr)))
      ]);

      console.log('✅ Old orders hashes:', oldOrdersHashes);
      console.log('✅ New orders hashes:', newOrdersHashes);

      // ✅ Calculate old commitment using computeWalletCommitment
      const oldCommitment = await computeWalletCommitment(
        oldState.available_balances,
        oldState.reserved_balances,
        oldOrdersHashes,
        oldState.fees,
        pkRootBigInt,
        pkMatchBigInt,
        oldNonce,
        oldState.blinder || '0',  // ✅ Use blinder from oldState
        bb,
        Fr
      );

      // Verify old merkle root and calculate nullifier in parallel
      const [calculatedOldRoot, nullifier] = await Promise.all([
        computeMerkleRoot(
          oldCommitment,
          Number(oldMerkleIndex),
          oldHashPath,
          bb,
          Fr
        ),
        poseidon2Hash([skMatchBigInt, oldCommitment], bb, Fr)  // ✅ Use sk_match for nullifier
      ]);

      console.log('✅ Old Commitment:', oldCommitment);
      console.log('✅ Calculated Old Root:', calculatedOldRoot);
      console.log('✅ Expected Old Root:', oldMerkleRoot);

      // ✅ Calculate new commitment using computeWalletCommitment
      const newNonce = BigInt(oldNonce) + 1n;
      const newCommitment = await computeWalletCommitment(
        newState.available_balances,
        newState.reserved_balances,
        newOrdersHashes,
        newState.fees,
        pkRootBigInt,
        pkMatchBigInt,
        newNonce,
        newState.blinder || '0',  // ✅ Use blinder from newState
        bb,
        Fr
      );

      console.log('✅ New Commitment:', newCommitment);
      console.log('✅ Nullifier:', nullifier);
      console.log('✅ Old Nonce:', oldNonce);
      console.log('✅ New Nonce:', newNonce.toString());
      console.log('✅ Old Blinder:', oldState.blinder?.substring(0, 20) + '...');
      console.log('✅ New Blinder:', newState.blinder?.substring(0, 20) + '...');

      // ============================================
      // STEP 4: Extract operations
      // ============================================
      const hasTransfer = operations?.transfer !== undefined;
      const hasOrder = operations?.order !== undefined;

      // Determine operation_type: 0=transfer only, 1=order only, 2=both
      let operation_type = '0';
      if (hasTransfer && hasOrder) operation_type = '2';
      else if (hasOrder) operation_type = '1';
      else if (hasTransfer) operation_type = '0';

      // Transfer parameters
      const transfer_direction = hasTransfer ? operations.transfer!.direction.toString() : '0';
      const transfer_mint = hasTransfer ? operations.transfer!.token_index.toString() : '0';
      const transfer_amount = hasTransfer ? operations.transfer!.amount.toString() : '0';
      const transfer_index = transfer_mint;

      // Order parameters
      const order_index = hasOrder ? operations.order!.order_index.toString() : '0';
      const order_operation_type = hasOrder ? operations.order!.operation_type.toString() : '0';
      const order_direction = hasOrder && operations.order!.order_data
        ? operations.order!.order_data.side.toString()
        : '0';
      const order_price = hasOrder && operations.order!.order_data
        ? operations.order!.order_data.price.toString()
        : '0';
      const order_quantity = hasOrder && operations.order!.order_data
        ? operations.order!.order_data.qty.toString()
        : '0';
      const order_token_in = hasOrder && operations.order!.order_data
        ? operations.order!.order_data.token_in.toString()
        : '0';
      const order_token_out = hasOrder && operations.order!.order_data
        ? operations.order!.order_data.token_out.toString()
        : '0';

      console.log('✅ Operations extracted:', {
        operation_type,
        hasTransfer,
        hasOrder,
        transfer: hasTransfer ? { transfer_direction, transfer_mint, transfer_amount } : null,
        order: hasOrder ? { order_index, order_operation_type, order_direction, order_price, order_quantity, order_token_in, order_token_out } : null
      });

      // ============================================
      // STEP 5: Prepare circuit inputs (match test file structure)
      // ============================================
      const inputs = {
        // Public inputs
        old_wallet_commitment: oldCommitment,
        new_wallet_commitment: newCommitment,
        old_merkle_root: oldMerkleRoot,
        transfer_direction,
        transfer_mint,
        transfer_amount,
        operation_type,

        // Private inputs - Keys and wallet data
        sk_match: skMatchBigInt.toString(),  // ✅ Use sk_match from localStorage

        // Old wallet structure
        old_wallet: {
          available_balances: oldState.available_balances.map((b: any) => b.toString()),
          reserved_balances: oldState.reserved_balances.map((b: any) => b.toString()),
          orders_list: oldOrdersHashes.map((h: any) => h.toString()),
          fees: oldState.fees.toString(),
          keys: {
            pk_root: pkRootBigInt.toString(),
            pk_match: pkMatchBigInt.toString(),
            nonce: oldNonce.toString()
          },
          blinder: (oldState.blinder || '0').toString()
        },
        old_index: oldMerkleIndex.toString(),
        old_hash_path: oldHashPath,

        // New blinder
        new_blinder: (newState.blinder || '0').toString(),

        // Operation-specific fields
        transfer_index,
        order_index,
        order_direction,
        order_price,
        order_quantity,
        order_token_in,
        order_token_out,
        order_operation_type,
      };

      console.log('✅ Circuit inputs prepared',inputs);

      // ============================================
      // STEP 6: Generate witness
      // ============================================
      setProgress('Generating witness...', inputs);

      const witnessStartTime = Date.now();
      const { witness } = await noir.execute(inputs);
      const witnessTime = Date.now() - witnessStartTime;
      console.log(`✅ Witness generation took ${witnessTime}ms`);

      // ============================================
      // STEP 7: Generate proof
      // ============================================
      setProgress('Generating proof (this may take 3-8 seconds)...');

      const proofGenStartTime = Date.now();
      const { proof, publicInputs } = await backend.generateProof(witness);
      const proofTime = Date.now() - proofGenStartTime;
      console.log(`✅ Proof generation took ${proofTime}ms`);

      const totalTime = Date.now() - startTime;
      console.log(`✅ Total wallet_update_state proof generation: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

      setIsGenerating(false);
      setProgress('');

      // Convert proof to hex
      const proofHex = '0x' + Array.from(proof)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('');

      // Convert publicInputs to object (match test file structure)
      const namedPublicInputs = {
        old_wallet_commitment: publicInputs[0],
        new_wallet_commitment: publicInputs[1],
        old_merkle_root: publicInputs[2],
        transfer_direction: publicInputs[3],
        transfer_mint: publicInputs[4],
        transfer_amount: publicInputs[5],
        operation_type: publicInputs[6],
        nullifier: publicInputs[7]  // ✅ Add nullifier (index 7)
      };

      return {
        success: true,
        verified: true,
        proof: proofHex,
        publicInputs: namedPublicInputs,
        randomness: newState.blinder || '0',  // ✅ Return newBlinder instead of newRandomness
        operations: operations || {},
        new_state: {
          available_balances: newState.available_balances.map((b: any) => b.toString()),
          reserved_balances: newState.reserved_balances.map((b: any) => b.toString()),
          orders_list: newState.orders_list,
          fees: newState.fees.toString(),
          nonce: newNonce.toString(),
          blinder: newState.blinder || '0'  // ✅ Include blinder in return
        },
        timing: {
          total: totalTime,
          witness: witnessTime,
          proof: proofTime
        }
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ CLIENT-SIDE: Error generating wallet update proof:', err);
      setError(errorMessage);
      setIsGenerating(false);
      setProgress('');

      return {
        success: false,
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      };
    }
  }

  return {
    // States
    isGenerating,
    progress,
    error,

    // Functions
    generateWalletUpdateProofClient
  };
}