const SSE_URL = process.env.NEXT_PUBLIC_API_URL || '';

let eventSource: EventSource | null = null;
let currentWalletId: string | null = null;

export const connectSSE = (walletId: string): EventSource | null => {
  // Check if already connected with same walletId and connection is active
  if (eventSource && currentWalletId === walletId) {
    const state = eventSource.readyState;
    // CONNECTING = 0, OPEN = 1, CLOSED = 2
    if (state === EventSource.CONNECTING || state === EventSource.OPEN) {
      console.log('[SSE] Already connected, skipping...');
      return eventSource;
    }
  }

  // Disconnect existing connection before creating new one
  disconnectSSE();
  currentWalletId = walletId;

  const url = `${SSE_URL}/sse/events/${walletId}`;
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    console.log('[SSE] Connected:', url);
  };

  eventSource.onerror = (error) => {
    console.error('[SSE] Error:', error);
  };

  // Return EventSource so component can add custom event listeners
  return eventSource;
};

export const disconnectSSE = (): void => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    currentWalletId = null;
    console.log('[SSE] Disconnected');
  }
};

export const getEventSource = (): EventSource | null => eventSource;

export const isSSEConnected = (): boolean => eventSource?.readyState === EventSource.OPEN;