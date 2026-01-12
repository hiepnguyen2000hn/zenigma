'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { tradingPairAtom } from '@/store/trading';
import type {
    IChartApi,
    ISeriesApi,
    CandlestickData,
    CandlestickSeriesOptions
} from 'lightweight-charts';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { formatPrice, formatPercent } from '@/lib/formatPrice';

interface ChartProps {
    crypto?: string;
    pair?: string;
}

interface BinanceChartData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// Default pair when the requested pair is not available on Binance
const DEFAULT_PAIR = 'btc-usdt';

/**
 * Normalize wrapped tokens to their native equivalents for Binance API
 * WETH -> ETH, WBNB -> BNB, etc.
 */
const normalizePairForBinance = (pair: string): string => {
    // Split pair (e.g., 'weth-usdc' -> ['weth', 'usdc'])
    const [base, quote] = pair.toLowerCase().split('-');

    // Map wrapped tokens to native tokens
    const tokenMap: Record<string, string> = {
        'weth': 'eth',
        'wbnb': 'bnb',
    };

    // Normalize base token if it's wrapped
    const normalizedBase = tokenMap[base] || base;

    // Return normalized pair
    return `${normalizedBase}-${quote}`;
};

const Chart = ({ crypto = 'BTC', pair = 'btc-usdt' }: ChartProps) => {
    // Read trading pair from store (priority over props)
    const tradingPair = useAtomValue(tradingPairAtom);
    const requestedPair = tradingPair.symbol || pair;
    const effectiveCrypto = tradingPair.base || crypto;

    // Normalize wrapped tokens for Binance API (WETH -> ETH, WBNB -> BNB)
    const normalizedPair = normalizePairForBinance(requestedPair);

    // Actual pair being displayed (may fallback to DEFAULT_PAIR if requested pair not available)
    const [displayedPair, setDisplayedPair] = useState(normalizedPair);

    // Reset displayedPair when normalizedPair changes (will be updated after fetch)
    useEffect(() => {
        setDisplayedPair(normalizedPair);
    }, [normalizedPair]);

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const flashTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const [timeframe, setTimeframe] = useState('1h');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWebSocketReady, setIsWebSocketReady] = useState(false);
    const [priceFlash, setPriceFlash] = useState(false);
    const [priceData, setPriceData] = useState({
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        change: 0,
        changePercent: 0
    });

    // Fetch chart data from Binance API
    const fetchChartData = async (pair: string, interval: string, isRetry = false): Promise<{ data: BinanceChartData[] | null; actualPair: string }> => {
        try {
            setLoading(true);
            setError(null);

            // Use absolute URL for production, relative for development
            const baseUrl = typeof window !== 'undefined' && window.location.origin
                ? window.location.origin
                : '';
            const url = `${baseUrl}/api/binance/chart/${pair}?interval=${interval}&limit=500`;

            console.log('🔄 Fetching chart data from:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                cache: 'no-store'
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error:', errorText);

                // If this is not a retry and the pair failed, fallback to default pair
                if (!isRetry && pair !== DEFAULT_PAIR) {
                    console.log(`⚠️ Pair "${pair}" not available on Binance, falling back to "${DEFAULT_PAIR}"`);
                    return await fetchChartData(DEFAULT_PAIR, interval, true);
                }

                throw new Error(`Failed to fetch chart data: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Chart data received:', result.dataPoints, 'candles for', pair);

            if (!result.success || !result.data) {
                // If invalid response and not a retry, fallback to default pair
                if (!isRetry && pair !== DEFAULT_PAIR) {
                    console.log(`⚠️ Invalid response for "${pair}", falling back to "${DEFAULT_PAIR}"`);
                    return await fetchChartData(DEFAULT_PAIR, interval, true);
                }
                throw new Error('Invalid response from API');
            }

            return { data: result.data, actualPair: pair };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load chart data';

            // If error and not a retry, fallback to default pair
            if (!isRetry && pair !== DEFAULT_PAIR) {
                console.log(`⚠️ Error fetching "${pair}", falling back to "${DEFAULT_PAIR}"`);
                return await fetchChartData(DEFAULT_PAIR, interval, true);
            }

            setError(errorMessage);
            console.error('💥 Error fetching chart data:', err);
            return { data: null, actualPair: pair };
        } finally {
            setLoading(false);
        }
    };

    // Handle WebSocket kline updates
    const handleKlineUpdate = useCallback((kline: BinanceChartData, isClosed: boolean) => {
        if (!seriesRef.current) return;

        const candleData: CandlestickData = {
            time: Math.floor(kline.time / 1000) as any,
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
        };

        // Update the chart with the new candle (synchronous, fast)
        seriesRef.current.update(candleData);

        // Batch state updates together to minimize re-renders
        setPriceData(prev => {
            const hasChanged = prev.close !== candleData.close && prev.close !== 0;

            // Trigger flash effect optimized
            if (hasChanged) {
                // Clear previous timeout
                if (flashTimeoutRef.current) {
                    clearTimeout(flashTimeoutRef.current);
                }

                setPriceFlash(true);
                flashTimeoutRef.current = setTimeout(() => setPriceFlash(false), 200);
            }

            return {
                open: candleData.open,
                high: candleData.high,
                low: candleData.low,
                close: candleData.close,
                change: candleData.close - candleData.open,
                changePercent: candleData.open !== 0 ? ((candleData.close - candleData.open) / candleData.open) * 100 : 0,
            };
        });

        // Log only closed candles (reduce console spam)
        if (isClosed) {
            console.log('🟢 Candle closed:', candleData.close, new Date(kline.time).toLocaleTimeString());
        }
    }, []);

    // Initialize WebSocket connection after initial data load
    // Use displayedPair (which may be fallback) instead of requestedPair
    const { isConnected } = useBinanceWebSocket({
        symbol: displayedPair,
        interval: timeframe,
        onKlineUpdate: handleKlineUpdate,
        enabled: isWebSocketReady,
    });

    useEffect(() => {
        let mounted = true;

        // Dynamic import for lightweight-charts
        const initChart = async () => {
            try {
                // Disable WebSocket when reinitializing
                setIsWebSocketReady(false);

                // Cleanup existing chart first
                if (chartRef.current) {
                    chartRef.current.remove();
                    chartRef.current = null;
                    seriesRef.current = null;
                }

                if (!chartContainerRef.current || !mounted) return;

                const { createChart, ColorType, CandlestickSeries } = await import('lightweight-charts');

                if (!chartContainerRef.current || !mounted) return;

                // Create chart instance
                const chart = createChart(chartContainerRef.current, {
                    layout: {
                        background: { type: ColorType.Solid, color: '#000000' },
                        textColor: '#9CA3AF',
                    },
                    grid: {
                        vertLines: { color: '#1a1a1a' },
                        horzLines: { color: '#1a1a1a' },
                    },
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                    timeScale: {
                        timeVisible: true,
                        secondsVisible: false,
                        borderColor: '#2B2B43',
                    },
                    rightPriceScale: {
                        borderColor: '#2B2B43',
                    },
                    crosshair: {
                        mode: 1,
                    },
                });

                if (!mounted) {
                    chart.remove();
                    return;
                }

                chartRef.current = chart;

                // Add candlestick series using v5 API
                const candlestickSeries = chart.addSeries(CandlestickSeries, {
                    upColor: '#10b981',
                    downColor: '#ef4444',
                    borderVisible: false,
                    wickUpColor: '#10b981',
                    wickDownColor: '#ef4444',
                });

                seriesRef.current = candlestickSeries;

                // Subscribe to crosshair move to show real-time candle data
                chart.subscribeCrosshairMove((param) => {
                    if (param.time && param.seriesData.size > 0) {
                        const data = param.seriesData.get(candlestickSeries) as any;
                        if (data) {
                            setPriceData({
                                open: data.open,
                                high: data.high,
                                low: data.low,
                                close: data.close,
                                change: data.close - data.open,
                                changePercent: ((data.close - data.open) / data.open) * 100,
                            });
                        }
                    }
                });

                // Step 1: Fetch initial data from REST API
                console.log('📊 Step 1: Fetching initial data from REST API...');
                console.log('🔄 Requested pair:', requestedPair, '-> Normalized for Binance:', normalizedPair);
                const { data: chartData, actualPair } = await fetchChartData(normalizedPair, timeframe);

                if (!mounted) {
                    chart.remove();
                    return;
                }

                // Update displayed pair (may be different from requested if fallback occurred)
                setDisplayedPair(actualPair);

                if (chartData && chartData.length > 0) {
                    // Convert Binance data to lightweight-charts format
                    const candleData: CandlestickData[] = chartData.map((item: BinanceChartData) => ({
                        time: Math.floor(item.time / 1000) as any, // Convert ms to seconds
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                    }));

                    candlestickSeries.setData(candleData);

                    // Update price data with last candle
                    const lastCandle = candleData[candleData.length - 1];
                    setPriceData({
                        open: lastCandle.open,
                        high: lastCandle.high,
                        low: lastCandle.low,
                        close: lastCandle.close,
                        change: lastCandle.close - lastCandle.open,
                        changePercent: ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100,
                    });

                    // Fit content
                    chart.timeScale().fitContent();

                    console.log('✅ Initial data loaded. Candles:', candleData.length);

                    // Step 2: Enable WebSocket for real-time updates
                    console.log('🔌 Step 2: Enabling WebSocket for real-time updates...');
                    if (mounted) {
                        setIsWebSocketReady(true);
                    }
                }

                // Handle resize - both window resize and container size changes (sidebar toggle)
                const handleResize = () => {
                    if (chartContainerRef.current && chartRef.current) {
                        const newWidth = chartContainerRef.current.clientWidth;
                        const newHeight = chartContainerRef.current.clientHeight;

                        chartRef.current.applyOptions({
                            width: newWidth,
                            height: newHeight,
                        });

                        // Fit content after resize for better UX
                        chartRef.current.timeScale().fitContent();
                    }
                };

                // Listen to window resize
                window.addEventListener('resize', handleResize);

                // ✅ ResizeObserver to detect container size changes (e.g., sidebar toggle)
                // Use requestAnimationFrame for smooth resize sync with browser paint
                let rafId: number;
                const resizeObserver = new ResizeObserver((entries) => {
                    if (rafId) {
                        cancelAnimationFrame(rafId);
                    }
                    rafId = requestAnimationFrame(() => {
                        for (const entry of entries) {
                            if (entry.target === chartContainerRef.current) {
                                handleResize();
                            }
                        }
                    });
                });

                if (chartContainerRef.current) {
                    resizeObserver.observe(chartContainerRef.current);
                }

                // Cleanup function
                return () => {
                    mounted = false;
                    window.removeEventListener('resize', handleResize);
                    if (rafId) {
                        cancelAnimationFrame(rafId); // ✅ Clear RAF
                    }
                    resizeObserver.disconnect(); // ✅ Cleanup ResizeObserver
                    if (chartRef.current) {
                        chartRef.current.remove();
                        chartRef.current = null;
                        seriesRef.current = null;
                    }
                };
            } catch (error) {
                console.error('Error initializing chart:', error);
                if (mounted) {
                    setError('Failed to initialize chart');
                }
            }
        };

        initChart();

        return () => {
            mounted = false;
            setIsWebSocketReady(false);
            // Cleanup flash timeout
            if (flashTimeoutRef.current) {
                clearTimeout(flashTimeoutRef.current);
            }
        };
    }, [requestedPair, timeframe]);

    const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

    return (
        <div className="flex-1 flex flex-col bg-black border-b border-gray-800">
            {/* Chart container with relative positioning for overlays */}
            <div className="relative flex-1">
                {/* Loading overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
                        <div className="text-white text-lg">Loading chart data...</div>
                    </div>
                )}

                {/* Error overlay */}
                {error && !loading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
                        <div className="text-red-500 text-lg">{error}</div>
                    </div>
                )}

                {/* Header info overlay */}
                <div className="absolute top-4 left-4 z-10 space-y-2">
                    <div className="flex items-center space-x-3">
                        <select
                            className="bg-transparent text-white text-sm border border-gray-700 rounded px-2 py-1 outline-none"
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                        >
                            {timeframes.map((tf) => (
                                <option key={tf} value={tf}>{tf}</option>
                            ))}
                        </select>
                        <div className="flex items-center space-x-2 text-xs">
                            <TrendingUp className="w-4 h-4 text-gray-400" />
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-2">
                            <span className="text-gray-400">{displayedPair.toUpperCase()} • {timeframe} • BINANCE</span>
                            <span className={`w-2 h-2 rounded-full ${
                                loading ? 'bg-yellow-500' :
                                error ? 'bg-red-500' :
                                isConnected ? 'bg-green-500 animate-pulse' :
                                'bg-green-500'
                            }`}></span>
                            {isConnected && !loading && (
                                <span className="text-xs text-green-400">LIVE</span>
                            )}
                        </div>
                        {priceData.close > 0 && (
                            <>
                                <span className={priceData.open >= priceData.close ? 'text-red-500' : 'text-green-500'}>
                                    O {formatPrice(priceData.open)}
                                </span>
                                <span className="text-green-500">H {formatPrice(priceData.high)}</span>
                                <span className="text-red-500">L {formatPrice(priceData.low)}</span>
                                <span className={`${priceData.close >= priceData.open ? 'text-green-500' : 'text-red-500'} font-bold text-base transition-all duration-200 ease-out ${priceFlash ? 'scale-105 brightness-125' : ''}`}>
                                    C {formatPrice(priceData.close)}
                                </span>
                                <span className={`${priceData.change >= 0 ? 'text-green-500' : 'text-red-500'} transition-all duration-200 ease-out ${priceFlash ? 'brightness-110' : ''}`}>
                                    {formatPrice(Math.abs(priceData.change))} ({formatPercent(priceData.changePercent)}%)
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Chart canvas */}
                <div
                    ref={chartContainerRef}
                    className="w-full h-full"
                    style={{ minHeight: '500px' }}
                />
            </div>

            {/* Controls moved below chart in normal flow */}
            <div className="flex items-center justify-between px-4 py-3 bg-black border-t border-gray-800">
                {/* Left side: Timeframe buttons */}
                <div className="flex items-center space-x-2">
                    {timeframes.map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-2 py-1 text-xs rounded ${
                                timeframe === tf ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                            } transition-colors`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Right side: Time and controls */}
                <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span>{new Date().toLocaleTimeString('en-US', { timeZone: 'UTC', hour12: false })} (UTC)</span>
                    <button className="hover:text-white">%</button>
                    <button className="hover:text-white">log</button>
                    <button className="hover:text-white">auto</button>
                </div>
            </div>
        </div>
    );
};

export default Chart;
