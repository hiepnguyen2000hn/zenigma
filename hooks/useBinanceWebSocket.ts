import { useEffect, useRef, useCallback } from 'react';

interface KlineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BinanceKlineEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
    V: string; // Taker buy base asset volume
    Q: string; // Taker buy quote asset volume
    B: string; // Ignore
  };
}

interface UseBinanceWebSocketProps {
  symbol: string; // e.g., 'btcusdt'
  interval: string; // e.g., '1h'
  onKlineUpdate: (kline: KlineData, isClosed: boolean) => void;
  enabled?: boolean;
}

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

export const useBinanceWebSocket = ({
  symbol,
  interval,
  onKlineUpdate,
  enabled = true,
}: UseBinanceWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Format: btcusdt@kline_1h
      const streamName = `${symbol.toLowerCase().replace('-', '')}@kline_${interval}`;
      const wsUrl = `${BINANCE_WS_URL}/${streamName}`;

      console.log(`🔌 Connecting to Binance WebSocket: ${streamName}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const data: BinanceKlineEvent = JSON.parse(event.data);

          if (data.e === 'kline') {
            const kline = data.k;
            const klineData: KlineData = {
              time: kline.t,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v),
            };

            // Log only closed candles (reduce spam)
            if (kline.x) {
              console.log('📡 Candle closed via WebSocket:', klineData.close, new Date(kline.t).toLocaleTimeString());
            }

            // Call the callback with the kline data and whether it's closed
            onKlineUpdate(klineData, kline.x);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        wsRef.current = null;

        // Attempt to reconnect if not manually closed and enabled
        // if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
        //   reconnectAttemptsRef.current += 1;
        //   console.log(
        //     `🔄 Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
        //   );
        //
        //   reconnectTimeoutRef.current = setTimeout(() => {
        //     connect();
        //   }, reconnectDelay);
        // } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        //   console.error('❌ Max reconnection attempts reached');
        // }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }, [symbol, interval, onKlineUpdate, enabled]);

  useEffect(() => {
    connect();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        console.log('🔌 Closing WebSocket connection');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  return {
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};
