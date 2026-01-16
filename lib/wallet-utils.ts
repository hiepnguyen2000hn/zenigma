import { createWalletClient, http, parseEther, type Address, type Hash, type SignableMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, arbitrum, base, optimism, sepolia } from 'viem/chains';

// Supported chains configuration
export const SUPPORTED_CHAINS = {
  mainnet,
  arbitrum,
  base,
  optimism,
  sepolia, // Testnet
} as const;

export type ChainName = keyof typeof SUPPORTED_CHAINS;

/**
 * Create a wallet client from a private key
 */
export function createWalletFromPrivateKey(privateKey: `0x${string}`, chainName: ChainName = 'mainnet') {
  const account = privateKeyToAccount(privateKey);
  const chain = SUPPORTED_CHAINS[chainName];

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  return { account, walletClient };
}

/**
 * Sign a message with a private key
 */
export async function signMessageWithPrivateKey(
  privateKey: `0x${string}`,
  message: string | SignableMessage
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  return await account.signMessage({
    message: typeof message === 'string' ? message : message,
  });
}

/**
 * Sign typed data (EIP-712) with a private key
 */
export async function signTypedDataWithPrivateKey(
  privateKey: `0x${string}`,
  typedData: {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  }
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  return await account.signTypedData(typedData);
}

/**
 * Send a transaction with a private key
 */
export async function sendTransactionWithPrivateKey(
  privateKey: `0x${string}`,
  params: {
    to: Address;
    value: string; // ETH amount as string (e.g., "0.01")
    data?: `0x${string}`;
    chainName?: ChainName;
  }
): Promise<Hash> {
  const { to, value, data, chainName = 'mainnet' } = params;

  const { walletClient } = createWalletFromPrivateKey(privateKey, chainName);

  const hash = await walletClient.sendTransaction({
    to,
    value: parseEther(value),
    data,
  });

  return hash;
}

/**
 * Get account address from private key
 */
export function getAddressFromPrivateKey(privateKey: `0x${string}`): Address {
  const account = privateKeyToAccount(privateKey);
  return account.address;
}

/**
 * Verify a signature
 */
export async function verifySignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: Address
): Promise<boolean> {
  try {
    const { verifyMessage } = await import('viem');
    return await verifyMessage({
      address: expectedAddress,
      message,
      signature,
    });
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Format transaction for signing
 * Useful for preparing transactions before sending
 */
export function formatTransaction(params: {
  to: Address;
  value?: string;
  data?: `0x${string}`;
  gasLimit?: bigint;
}) {
  return {
    to: params.to,
    value: params.value ? parseEther(params.value) : 0n,
    data: params.data,
    gas: params.gasLimit,
  };
}

/**
 * Create a typed data structure for EIP-712 signing
 * Example: For signing a permit or order
 */
export function createTypedData(params: {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, any>;
}) {
  return {
    domain: params.domain,
    types: params.types,
    primaryType: params.primaryType,
    message: params.message,
  };
}

/**
 * Get chain ID from chain name
 */
export function getChainId(chainName: ChainName): number {
  return SUPPORTED_CHAINS[chainName].id;
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): ChainName | null {
  const entry = Object.entries(SUPPORTED_CHAINS).find(([_, chain]) => chain.id === chainId);
  return entry ? (entry[0] as ChainName) : null;
}

/**
 * Parse private key to ensure it has 0x prefix
 */
export function parsePrivateKey(privateKey: string): `0x${string}` {
  if (privateKey.startsWith('0x')) {
    return privateKey as `0x${string}`;
  }
  return `0x${privateKey}` as `0x${string}`;
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  privateKey: `0x${string}`,
  params: {
    to: Address;
    value?: string;
    data?: `0x${string}`;
    chainName?: ChainName;
  }
): Promise<bigint> {
  const { to, value, data, chainName = 'mainnet' } = params;

  const { walletClient } = createWalletFromPrivateKey(privateKey, chainName);

  const gas = await walletClient.estimateGas({
    to,
    value: value ? parseEther(value) : 0n,
    data,
  });

  return gas;
}

/**
 * Convert public inputs array to named object based on circuit type
 */
export function publicInputsToObject(
  circuitName: string,
  publicInputs: string[],
  useNamedKeys: boolean = true
): Record<string, string> {
  const result: Record<string, string> = {};

  // If not using named keys, fallback to indexed keys
  if (!useNamedKeys) {
    publicInputs.forEach((input, index) => {
      result[`input_${index}`] = input;
    });
    return result;
  }

  if (circuitName === 'wallet_init_state') {
    if (publicInputs.length !== 1) {
      throw new Error(`Expected 1 public input for wallet_init_state, got ${publicInputs.length}`);
    }
    result['initial_commitment'] = publicInputs[0];

  } else if (circuitName === 'wallet_balance_update') {
    if (publicInputs.length !== 9) {
      throw new Error(`Expected 9 public inputs for wallet_balance_update, got ${publicInputs.length}`);
    }
    // Public parameters
    result['old_wallet_commitment'] = publicInputs[0];
    result['new_wallet_commitment'] = publicInputs[1];
    result['old_merkle_root'] = publicInputs[2];
    result['transfer_direction'] = publicInputs[3];
    result['transfer_mint'] = publicInputs[4];
    result['transfer_amount'] = publicInputs[5];
    // Return values
    result['nullifier'] = publicInputs[6];
    result['new_wallet_commitment_return'] = publicInputs[7];
    result['new_nonce'] = publicInputs[8];

  } else if (circuitName === 'wallet_order_update') {
    if (publicInputs.length !== 6) {
      throw new Error(`Expected 6 public inputs for wallet_order_update, got ${publicInputs.length}`);
    }
    result['old_wallet_commitment'] = publicInputs[0];
    result['new_wallet_commitment'] = publicInputs[1];
    result['old_merkle_root'] = publicInputs[2];
    result['nullifier'] = publicInputs[3];
    result['new_wallet_commitment_return'] = publicInputs[4];
    result['new_nonce'] = publicInputs[5];

  } else if (circuitName === 'wallet_update_state') {
    if (publicInputs.length !== 10) {
      throw new Error(`Expected 10 public inputs for wallet_update_state, got ${publicInputs.length}`);
    }
    // Public parameters
    result['old_wallet_commitment'] = publicInputs[0];
    result['new_wallet_commitment'] = publicInputs[1];
    result['old_merkle_root'] = publicInputs[2];
    result['transfer_direction'] = publicInputs[3];
    result['transfer_mint'] = publicInputs[4];
    result['transfer_amount'] = publicInputs[5];
    result['operation_type'] = publicInputs[6];
    // Return values
    result['nullifier'] = publicInputs[7];
    result['new_wallet_commitment_return'] = publicInputs[8];
    result['new_nonce'] = publicInputs[9];

  } else {
    // Unknown circuit - fallback to indexed keys
    publicInputs.forEach((input, index) => {
      result[`input_${index}`] = input;
    });
  }

  return result;
}

/**
 * Extract wallet ID from Privy user ID
 *
 * Removes the "did:privy:" prefix from Privy user ID
 *
 * @param privyUserId - Full Privy user ID (e.g., "did:privy:clp5...abc123")
 * @returns Wallet ID without prefix (e.g., "clp5...abc123")
 *
 * @example
 * const walletId = extractPrivyWalletId("did:privy:clp5abc123");
 * console.log(walletId); // "clp5abc123"
 */
export function extractPrivyWalletId(privyUserId: string): string {
  return privyUserId.replace('did:privy:', '');
}

/**
 * Wallet type from Privy useWallets hook
 */
export interface PrivyWallet {
  address: string;
  connectorType?: string;
  walletClientType?: string;
  // ... other privy wallet properties
  [key: string]: any;
}

/**
 * Supported wallet connector types
 */
export type WalletConnectorType = 'embedded' | 'injected' | 'wallet_connect' | 'coinbase_wallet' | 'external';

/**
 * Get wallet by connector type from wallets array
 *
 * Centralized function to get wallet by connectorType
 * Supports: embedded, injected, wallet_connect, coinbase_wallet, external (localStorage)
 *
 * @param wallets - Array of wallets from useWallets hook
 * @param connectorType - Type of connector to find (default: 'embedded')
 * @returns Wallet matching the connector type or undefined if not found
 *
 * @example
 * const { wallets } = useWallets();
 * // Get embedded wallet (Privy)
 * const embeddedWallet = getWalletByConnectorType(wallets, 'embedded');
 * // Get injected wallet (MetaMask, etc.)
 * const injectedWallet = getWalletByConnectorType(wallets, 'injected');
 */
export function getWalletByConnectorType<T extends PrivyWallet>(
  wallets: T[],
  connectorType: WalletConnectorType = 'embedded'
): T | undefined {
  return wallets.find(wallet => wallet.connectorType === connectorType);
}

/**
 * Get wallet address by connector type from wallets array
 *
 * @param wallets - Array of wallets from useWallets hook
 * @param connectorType - Type of connector to find (default: 'embedded')
 * @returns Wallet address or undefined if not found
 *
 * @example
 * const { wallets } = useWallets();
 * const address = getWalletAddressByConnectorType(wallets, 'embedded');
 */
export function getWalletAddressByConnectorType<T extends PrivyWallet>(
  wallets: T[],
  connectorType: WalletConnectorType = 'embedded'
): string | undefined {
  return getWalletByConnectorType(wallets, connectorType)?.address;
}

/**
 * Get embedded wallet from wallets array (shorthand)
 *
 * @deprecated Use getWalletByConnectorType(wallets, 'embedded') instead
 */
export function getEmbeddedWallet<T extends PrivyWallet>(wallets: T[]): T | undefined {
  return getWalletByConnectorType(wallets, 'embedded');
}

/**
 * Get embedded wallet address from wallets array (shorthand)
 *
 * @deprecated Use getWalletAddressByConnectorType(wallets, 'embedded') instead
 */
export function getEmbeddedWalletAddress<T extends PrivyWallet>(wallets: T[]): string | undefined {
  return getWalletAddressByConnectorType(wallets, 'embedded');
}

/**
 * Determine login method type based on wallet connector types
 *
 * Returns 'external' if any wallet is injected, wallet_connect, coinbase_wallet, or external
 * Returns 'embedded' otherwise (Privy embedded wallet from email/google/etc)
 *
 * @param wallets - Array of wallets from useWallets hook
 * @returns 'embedded' | 'external'
 *
 * @example
 * const { wallets } = useWallets();
 * const methodType = determineLoginMethodType(wallets);
 * // methodType = 'external' if MetaMask connected, 'embedded' if email/google login
 */
export function determineLoginMethodType<T extends PrivyWallet>(
  wallets: T[]
): 'embedded' | 'external' {
  const hasExternal = wallets.some(wallet =>
    wallet.connectorType === 'injected' ||
    wallet.connectorType === 'wallet_connect' ||
    wallet.connectorType === 'coinbase_wallet' ||
    wallet.connectorType === 'external'
  );
  return hasExternal ? 'external' : 'embedded';
}
