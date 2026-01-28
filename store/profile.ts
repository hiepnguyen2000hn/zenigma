import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// ============================================
// USER PROFILE STATE
// ============================================

export interface TokenBalance {
  token_index: number;
  token_address: string;
  token_name: string;
  token_symbol: string;
  token_decimals: number;
  available: string;
  reserved: string;
  total: string;
}

export interface UserBalance {
  balances: TokenBalance[]
}
export interface UserProfile {
  // Backend response fields
  _id?: string;
  wallet_id?: string;                    // Extracted wallet ID (without did:privy: prefix)
  wallet_address: string;
  address?: string;                      // Alias for wallet_address
  available_balances: string[];          // Array of 10 token balances (raw amounts)
  reserved_balances: string[];           // Array of 10 token balances (raw amounts)
  orders_list: any[];                    // Array of 4 orders
  fees: string;
  nonce: number;
  merkle_root: string;
  merkle_index: number;
  sibling_paths: string[];

  // Detailed balance info (from backend)
  balances?: TokenBalance[];             // Array of balances with token details

  // State management fields
  current_commitment?: string;
  current_nullifier?: string;
  pk_root?: string;
  blinder?: string;
  is_initialized?: boolean;              // Whether wallet is initialized
  sync: boolean;
  last_tx_hash?: string;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// Profile atom - store current user profile
export const userProfileAtom = atom<UserProfile | null>(null);
export const userBalanceAtom = atom<UserBalance | null>(null);

// Loading state
export const profileLoadingAtom = atom<boolean>(false);

// Error state
export const profileErrorAtom = atom<string | null>(null);

// Balance loading state
export const balanceLoadingAtom = atom<boolean>(false);

// Balance error state
export const balanceErrorAtom = atom<string | null>(null);

// ============================================
// DERIVED ATOMS
// ============================================

// Get available balance for specific token
export const availableBalanceAtom = (tokenIndex: number) =>
  atom((get) => {
    const profile = get(userProfileAtom);
    if (!profile || tokenIndex < 0 || tokenIndex >= 10) return '0';
    return profile.available_balances[tokenIndex] || '0';
  });

// Get reserved balance for specific token
export const reservedBalanceAtom = (tokenIndex: number) =>
  atom((get) => {
    const profile = get(userProfileAtom);
    if (!profile || tokenIndex < 0 || tokenIndex >= 10) return '0';
    return profile.reserved_balances[tokenIndex] || '0';
  });

// Get total balance (available + reserved) for specific token
export const totalBalanceAtom = (tokenIndex: number) =>
  atom((get) => {
    const profile = get(userProfileAtom);
    if (!profile || tokenIndex < 0 || tokenIndex >= 10) return '0';

    const available = BigInt(profile.available_balances[tokenIndex] || '0');
    const reserved = BigInt(profile.reserved_balances[tokenIndex] || '0');
    return (available + reserved).toString();
  });

// Get active orders count
export const activeOrdersCountAtom = atom((get) => {
  const profile = get(userProfileAtom);
  if (!profile) return 0;
  return profile.orders_list.filter(order => order !== null).length;
});

// Get available order slots count
export const availableOrderSlotsAtom = atom((get) => {
  const profile = get(userProfileAtom);
  if (!profile) return 0;
  return profile.orders_list.filter(order => order === null).length;
});

// Check if profile is loaded
export const isProfileLoadedAtom = atom((get) => {
  return get(userProfileAtom) !== null;
});

// ============================================
// ACTIONS (WRITE ATOMS)
// ============================================

// Update entire profile
export const updateProfileAtom = atom(
  null,
  (get, set, profile: UserProfile) => {
    set(userProfileAtom, profile);
    set(profileErrorAtom, null);
  }
);

// Update loading state
export const setProfileLoadingAtom = atom(
  null,
  (get, set, loading: boolean) => {
    set(profileLoadingAtom, loading);
  }
);

// Update error state
export const setProfileErrorAtom = atom(
  null,
  (get, set, error: string | null) => {
    set(profileErrorAtom, error);
  }
);

// Clear profile (logout)
export const clearProfileAtom = atom(
  null,
  (get, set) => {
    set(userProfileAtom, null);
    set(profileLoadingAtom, false);
    set(profileErrorAtom, null);
  }
);

// Update available balance for specific token
export const updateAvailableBalanceAtom = atom(
  null,
  (get, set, { tokenIndex, balance }: { tokenIndex: number; balance: string }) => {
    const profile = get(userProfileAtom);
    if (!profile || tokenIndex < 0 || tokenIndex >= 10) return;

    const newBalances = [...profile.available_balances];
    newBalances[tokenIndex] = balance;

    set(userProfileAtom, {
      ...profile,
      available_balances: newBalances,
    });
  }
);

// Update reserved balance for specific token
export const updateReservedBalanceAtom = atom(
  null,
  (get, set, { tokenIndex, balance }: { tokenIndex: number; balance: string }) => {
    const profile = get(userProfileAtom);
    if (!profile || tokenIndex < 0 || tokenIndex >= 10) return;

    const newBalances = [...profile.reserved_balances];
    newBalances[tokenIndex] = balance;

    set(userProfileAtom, {
      ...profile,
      reserved_balances: newBalances,
    });
  }
);

// Update order at specific index
export const updateOrderAtom = atom(
  null,
  (get, set, { orderIndex, order }: { orderIndex: number; order: any }) => {
    const profile = get(userProfileAtom);
    if (!profile || orderIndex < 0 || orderIndex >= 4) return;

    const newOrders = [...profile.orders_list];
    newOrders[orderIndex] = order;

    set(userProfileAtom, {
      ...profile,
      orders_list: newOrders,
    });
  }
);

// Update nonce
export const updateNonceAtom = atom(
  null,
  (get, set, nonce: number) => {
    const profile = get(userProfileAtom);
    if (!profile) return;

    set(userProfileAtom, {
      ...profile,
      nonce,
    });
  }
);

// Update blinder
export const updateBlinderAtom = atom(
  null,
  (get, set, blinder: string) => {
    const profile = get(userProfileAtom);
    if (!profile) return;

    set(userProfileAtom, {
      ...profile,
      blinder,
    });
  }
);

// Update merkle data
export const updateMerkleDataAtom = atom(
  null,
  (get, set, data: { merkle_root: string; merkle_index: number; sibling_paths: string[] }) => {
    const profile = get(userProfileAtom);
    if (!profile) return;

    set(userProfileAtom, {
      ...profile,
      ...data,
    });
  }
);

// ============================================
// BALANCE ACTIONS (WRITE ATOMS)
// ============================================

// Update user balance
export const updateUserBalanceAtom = atom(
  null,
  (get, set, balance: UserBalance) => {
    set(userBalanceAtom, balance);
    set(balanceErrorAtom, null);
  }
);

// Set balance loading state
export const setBalanceLoadingAtom = atom(
  null,
  (get, set, loading: boolean) => {
    set(balanceLoadingAtom, loading);
  }
);

// Set balance error state
export const setBalanceErrorAtom = atom(
  null,
  (get, set, error: string | null) => {
    set(balanceErrorAtom, error);
  }
);

// Clear balance (logout)
export const clearBalanceAtom = atom(
  null,
  (get, set) => {
    set(userBalanceAtom, null);
    set(balanceLoadingAtom, false);
    set(balanceErrorAtom, null);
  }
);