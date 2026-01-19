import { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  connectSocket,
  disconnectSocket,
  subscribeChannel,
  unsubscribeChannel,
  getSocket,
  isSocketConnected,
  onSocketEvent,
  offSocketEvent,
} from '@/lib/socket.client';
import {
  socketConnectedAtom,
  socketErrorAtom,
  subscribedChannelsAtom,
  setSocketConnectedAtom,
  setSocketErrorAtom,
  addSubscribedChannelAtom,
  removeSubscribedChannelAtom,
  clearSocketStateAtom,
} from '@/store/socket';

/**
 * Custom hook to manage Socket.IO connection and events
 *
 * @example
 * const { isConnected, connect, disconnect, subscribe } = useSocket();
 *
 * // Connect to socket
 * connect(token, walletId);
 *
 * // Subscribe to channel
 * subscribe('orders');
 *
 * // Listen to events
 * onEvent('order_update', (data) => console.log(data));
 */
export function useSocket() {
  const isConnected = useAtomValue(socketConnectedAtom);
  const error = useAtomValue(socketErrorAtom);
  const subscribedChannels = useAtomValue(subscribedChannelsAtom);

  const setConnected = useSetAtom(setSocketConnectedAtom);
  const setError = useSetAtom(setSocketErrorAtom);
  const addChannel = useSetAtom(addSubscribedChannelAtom);
  const removeChannel = useSetAtom(removeSubscribedChannelAtom);
  const clearState = useSetAtom(clearSocketStateAtom);

  /**
   * Connect to socket server
   * @param token - Access token for authentication
   * @param walletId - User's wallet ID for channel subscription
   */
  const connect = useCallback(
    (token: string, walletId: string) => {
      try {
        const socket = connectSocket(token, walletId);

        if (socket) {
          socket.on('connect', () => {
            setConnected(true);
            addChannel(`user:${walletId}`);
          });

          socket.on('disconnect', () => {
            setConnected(false);
          });

          socket.on('connect_error', (err) => {
            setError(err.message);
            setConnected(false);
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect socket';
        setError(errorMessage);
      }
    },
    [setConnected, setError, addChannel]
  );

  /**
   * Disconnect from socket server
   */
  const disconnect = useCallback(() => {
    disconnectSocket();
    clearState();
  }, [clearState]);

  /**
   * Subscribe to a channel
   * @param channel - Channel name to subscribe
   */
  const subscribe = useCallback(
    (channel: string) => {
      subscribeChannel(channel);
      addChannel(channel);
    },
    [addChannel]
  );

  /**
   * Unsubscribe from a channel
   * @param channel - Channel name to unsubscribe
   */
  const unsubscribe = useCallback(
    (channel: string) => {
      unsubscribeChannel(channel);
      removeChannel(channel);
    },
    [removeChannel]
  );

  /**
   * Add event listener
   * @param event - Event name to listen
   * @param callback - Callback function
   */
  const onEvent = useCallback(<T>(event: string, callback: (data: T) => void) => {
    onSocketEvent(event, callback);
  }, []);

  /**
   * Remove event listener
   * @param event - Event name to remove
   */
  const offEvent = useCallback((event: string) => {
    offSocketEvent(event);
  }, []);

  return {
    isConnected,
    error,
    subscribedChannels,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    onEvent,
    offEvent,
    getSocket,
    isSocketConnected,
  };
}