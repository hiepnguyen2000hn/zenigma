import { NextRequest, NextResponse } from 'next/server';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergSync, Fr } from '@aztec/bb.js';
import path from 'path';
import fs from 'fs/promises';
import { CIRCUITS_DIR } from '@/lib/server-constants';
import { TOTAL_TOKEN, MAX_PENDING_ORDER } from '@/lib/constants';

let barretenberg: any = null;

async function getBarretenberg(): Promise<any> {
  if (!barretenberg) {
    // @ts-ignore - BarretenbergSync.new() works at runtime despite TypeScript errors
    barretenberg = await BarretenbergSync.new();
  }
  return barretenberg;
}

async function poseidon2Hash(inputs: (string | bigint)[]): Promise<string> {
  const bb = await getBarretenberg();

  const fieldInputs = inputs.map(input => {
    const bigintValue = typeof input === 'string' ? BigInt(input) : input;
    return new Fr(bigintValue);
  });

  const result = bb.poseidon2Hash(fieldInputs);
  return result.toString();
}

/**
 * POST /api/proof/generate-wallet-init
 * Generate zero-knowledge proof for wallet initialization
 * Body params:
 *   - userSecret: User's secret key (string)
 */
export async function POST(request: NextRequest) {
  try {
    const { userSecret } = await request.json();

    if (!userSecret) {
      return NextResponse.json(
        { error: 'userSecret is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    console.log('callled generate-wallet-init');
    console.log('Generating proof for wallet_init_state...', CIRCUITS_DIR);

    // Load circuit
    const circuitPath = path.join(CIRCUITS_DIR, 'wallet_init_state.json');

    // Check if circuit file exists
    try {
      await fs.access(circuitPath);
    } catch {
      return NextResponse.json(
        {
          error: 'Circuit file not found',
          message: `Please ensure wallet_init_state.json exists in ${CIRCUITS_DIR}`
        },
        { status: 500 }
      );
    }

    const circuit = JSON.parse(await fs.readFile(circuitPath, 'utf8'));

    // Initialize Noir
    const backend = new BarretenbergBackend(circuit);
    const noir = new Noir(circuit);

    const initialNonce = '0';
    const emptyFees = '0';
    const emptyBalances = Array(TOTAL_TOKEN).fill('0');
    const emptyOrders = Array(MAX_PENDING_ORDER).fill('0');

    const user_secret = BigInt(userSecret);

    // Use Poseidon2 hash (cryptographically secure)
    const emptyAvailableBalancesHash = await poseidon2Hash(emptyBalances);
    const emptyReservedBalancesHash = await poseidon2Hash(emptyBalances);
    const emptyOrdersRoot = await poseidon2Hash(emptyOrders);
    const initialRandomness = await poseidon2Hash([user_secret, initialNonce]);
    const initialCommitment = await poseidon2Hash([
      emptyAvailableBalancesHash,
      emptyReservedBalancesHash,
      emptyOrdersRoot,
      emptyFees,
      initialRandomness,
    ]);

    console.log('Initial Commitment:', initialCommitment);

    // Generate witness
    const witnessStartTime = Date.now();
    const { witness } = await noir.execute({
      user_secret: userSecret,
      initial_commitment: initialCommitment,
    });
    const witnessTime = Date.now() - witnessStartTime;
    console.log(`Witness generation took ${witnessTime}ms`);

    // Generate proof
    const proofGenStartTime = Date.now();
    const proof = await backend.generateProof(witness);
    const proofTime = Date.now() - proofGenStartTime;
    console.log(`Proof generation took ${proofTime}ms`);

    // Verify proof
    const verifyStartTime = Date.now();
    const verified = await backend.verifyProof({
      publicInputs: [initialCommitment],
      proof: proof.proof,
    });
    const verifyTime = Date.now() - verifyStartTime;
    console.log(`Proof verification took ${verifyTime}ms`);
    console.log('Proof verified:', verified);

    const totalTime = Date.now() - startTime;
    console.log(`Total wallet_init_state proof generation: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

    return NextResponse.json({
      success: true,
      verified,
      proof: Array.from(proof.proof), // Convert Uint8Array to array for JSON serialization
      publicInputs: {
        initial_commitment: initialCommitment
      },
      randomness: initialRandomness,
      new_state: {
        available_balances: emptyBalances,
        reserved_balances: emptyBalances,
        orders_list: Array(MAX_PENDING_ORDER).fill(null),
        fees: '0',
        nonce: '0',
      },
      timing: {
        total: totalTime,
        witness: witnessTime,
        proof: proofTime,
        verify: verifyTime,
      },
    });
  } catch (error) {
    console.error('Error generating wallet init proof:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate proof',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
