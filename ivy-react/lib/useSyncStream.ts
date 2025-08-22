import { useEffect, useState } from "react";
import { ChartInterval } from "@/components/chart/chartTypes";
import { CommentData } from "./api";
import { API_STREAM_BASE } from "./constants";
import { CandleData, parseCandle, updateCandles } from "./utils";

export interface SyncStreamData {
    // Chart data
    candles: CandleData[];

    // Sync data
    solReserves: number;
    tokenReserves: number;
    isMigrated: boolean;
    pswapPool: string | null;
    mktCapUsd: number;
    changePct24h: number;
    solPrice: number;

    // Comments (reverse chronological: newest first)
    comments: CommentData[];
}

// Helper function to handle context event
const handleContextEvent = (
    event: MessageEvent,
    setData: (x: SyncStreamData) => void,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<Error | null>>,
) => {
    try {
        const context = JSON.parse(event.data);

        setData({
            candles: context.candles.map(parseCandle),
            solReserves: context.sol_reserves,
            tokenReserves: context.token_reserves,
            isMigrated: context.is_migrated,
            pswapPool: context.pswap_pool,
            mktCapUsd: context.mkt_cap_usd,
            changePct24h: context.change_pct_24h,
            solPrice: context.sol_price,
            comments: context.comments || [],
        });

        setLoading(false);
    } catch (err) {
        console.error("Failed to parse sync context:", err);
        setError(new Error("Failed to parse initial sync data"));
        setLoading(false);
    }
};

// Helper function to handle update event
const handleUpdateEvent = (
    event: MessageEvent,
    setData: (f: (prev: SyncStreamData) => SyncStreamData) => void,
) => {
    try {
        const update = JSON.parse(event.data);

        setData((prev) => {
            const newData = { ...prev };

            switch (update.type) {
                case "sync":
                    // Update sync data (reserves, migration status, SOL price, etc.)
                    newData.solReserves = update.sol_reserves;
                    newData.tokenReserves = update.token_reserves;
                    newData.isMigrated = update.is_migrated;
                    newData.pswapPool = update.pswap_pool;
                    newData.mktCapUsd = update.mkt_cap_usd;
                    newData.changePct24h = update.change_pct_24h;
                    newData.solPrice = update.sol_price;
                    break;

                case "comment":
                    // Unshift new comment (reverse chronological)
                    newData.comments = [update.comment, ...prev.comments];
                    break;

                case "candle": {
                    // Update candle data
                    newData.candles = updateCandles(
                        prev.candles,
                        parseCandle(update.candle),
                    );
                    break;
                }

                default:
                    break;
            }

            return newData;
        });
    } catch (err) {
        console.error("Failed to parse sync update:", err);
    }
};

// Helper function to handle error event
const handleErrorEvent = (
    event: Event,
    eventSource: EventSource | null,
    isActive: boolean,
    connect: () => void,
    setReconnectTimeout: (timeout: NodeJS.Timeout) => void,
) => {
    console.error("Sync SSE error:", event);

    if (eventSource?.readyState === EventSource.CLOSED) {
        if (!isActive) return;

        const timeout = setTimeout(() => {
            console.log("Attempting to reconnect to sync stream...");
            connect();
        }, 5000);

        setReconnectTimeout(timeout);
    }
};

export function useSyncStream(syncAddress: string, chartKind: ChartInterval) {
    const [data, setData] = useState<SyncStreamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let isActive = true;

        const setReconnectTimeout = (timeout: NodeJS.Timeout) => {
            reconnectTimeout = timeout;
        };

        const connect = () => {
            if (!isActive) return;

            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams({
                    chart: chartKind,
                    chart_count: "500",
                    comment_count: "1000",
                });
                const url = `${API_STREAM_BASE}/syncs/${syncAddress}/stream?${params}`;

                eventSource = new EventSource(url);

                eventSource.addEventListener("context", (event) => {
                    if (!isActive) return;
                    handleContextEvent(event, setData, setLoading, setError);
                });

                eventSource.addEventListener("update", (event) => {
                    if (!isActive) return;
                    handleUpdateEvent(
                        event,
                        (f: (prev: SyncStreamData) => SyncStreamData) => {
                            setData((prev) => {
                                if (!prev) {
                                    throw new Error(
                                        "received update event before context event",
                                    );
                                }
                                return f(prev);
                            });
                        },
                    );
                });

                eventSource.addEventListener("error", (event) => {
                    handleErrorEvent(
                        event,
                        eventSource,
                        isActive,
                        connect,
                        setReconnectTimeout,
                    );
                });
            } catch (err) {
                console.error("Failed to establish Sync SSE connection:", err);
                setError(
                    err instanceof Error ? err : new Error("Connection failed"),
                );
                setLoading(false);

                if (!isActive) return;

                const timeout = setTimeout(() => {
                    connect();
                }, 5000);

                setReconnectTimeout(timeout);
            }
        };

        connect();

        return () => {
            isActive = false;

            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }

            if (eventSource) {
                eventSource.close();
            }
        };
    }, [syncAddress, chartKind]);

    return {
        data,
        loading,
        error,
    };
}
