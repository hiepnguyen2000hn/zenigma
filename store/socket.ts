import { atom } from 'jotai';

// ============================================
// SOCKET STATE
// ============================================

// Socket connection status
export const socketConnectedAtom = atom<boolean>(false);

// Socket error state
export const socketErrorAtom = atom<string | null>(null);

// Subscribed channels
export const subscribedChannelsAtom = atom<string[]>([]);

// ============================================
// ACTIONS (WRITE ATOMS)
// ============================================

// Set socket connected state
export const setSocketConnectedAtom = atom(
  null,
  (get, set, connected: boolean) => {
    set(socketConnectedAtom, connected);
    if (connected) {
      set(socketErrorAtom, null);
    }
  }
);

// Set socket error
export const setSocketErrorAtom = atom(
  null,
  (get, set, error: string | null) => {
    set(socketErrorAtom, error);
  }
);

// Add subscribed channel
export const addSubscribedChannelAtom = atom(
  null,
  (get, set, channel: string) => {
    const channels = get(subscribedChannelsAtom);
    if (!channels.includes(channel)) {
      set(subscribedChannelsAtom, [...channels, channel]);
    }
  }
);

// Remove subscribed channel
export const removeSubscribedChannelAtom = atom(
  null,
  (get, set, channel: string) => {
    const channels = get(subscribedChannelsAtom);
    set(subscribedChannelsAtom, channels.filter((c) => c !== channel));
  }
);

// Clear all socket state (on disconnect/logout)
export const clearSocketStateAtom = atom(
  null,
  (get, set) => {
    set(socketConnectedAtom, false);
    set(socketErrorAtom, null);
    set(subscribedChannelsAtom, []);
  }
);