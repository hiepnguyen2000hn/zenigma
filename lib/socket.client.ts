import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || '';

let socket: Socket | null = null;
let currentWalletId: string | null = null;

export const connectSocket = (token: string, walletId: string): Socket | null => {
  if (socket?.connected && currentWalletId === walletId) {
    return socket;
  }

  // Disconnect existing socket if connecting with different wallet
  if (socket) {
    disconnectSocket();
  }

  currentWalletId = walletId;

  socket = io(`${SOCKET_URL}/zenigma-socket`, {
    // auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
    // Auto subscribe to wallet ID channel
    subscribeChannel(walletId);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
    // Re-subscribe after reconnect
    if (currentWalletId) {
      subscribeChannel(currentWalletId);
    }
  });

  // Debug: Log all incoming events
  socket.onAny((eventName, ...args) => {
    console.log('[Socket] Received event:', eventName, args);
  });

  // Business event listeners
  socket.on('order:status', (data) => {
    console.log('[Socket] order:status:', data);
  });

  socket.on('transfer:status', (data) => {
    console.log('[Socket] transfer:status:', data);
  });

  socket.on('init:wallet', (data) => {
    console.log('[Socket] init:wallet:', data);
  });

  return socket;
};

export const subscribeChannel = (channel: string): void => {
  if (socket?.connected) {
    socket.emit('subscribe', { channel });
    console.log('Subscribed to channel:', channel);
  }
};

export const unsubscribeChannel = (channel: string): void => {
  if (socket?.connected) {
    socket.emit('unsubscribe', { channel });
    console.log('Unsubscribed from channel:', channel);
  }
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentWalletId = null;
    console.log('Socket disconnected and cleaned up');
  }
};

export const getSocket = (): Socket | null => socket;

export const isSocketConnected = (): boolean => socket?.connected ?? false;

// Generic event listener helper
export const onSocketEvent = <T>(event: string, callback: (data: T) => void): void => {
  socket?.on(event, callback);
};

export const offSocketEvent = (event: string): void => {
  socket?.off(event);
};