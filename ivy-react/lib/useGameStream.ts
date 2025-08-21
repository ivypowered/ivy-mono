import { useEffect, useState } from "react";
import { ChartInterval } from "@/components/chart/chartTypes";
import { Time } from "lightweight-charts";
import { CommentData } from "./api";
import { API_STREAM_BASE } from "./constants";
import { CandleData, parseCandle, updateCandles } from "./utils";

export interface StreamData {
    // Chart data
    candles: CandleData[];

    // Quote data
    gameBalance: string;
    ivyBalance: string;
    ivySold: string;
    ivyCurveMax: string;
    curveInputScale: number;
    mktCapUsd: number;
    changePct24h: number;
    ivyFeeBps: number;
    gameFeeBps: number;

    // Comments (reverse chronological: newest first)
    comments: CommentData[];
}

// Helper function to handle context event
const handleContextEvent = (
    event: MessageEvent,
    setData: (x: StreamData) => void,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<Error | null>>,
) => {
    try {
        const context = JSON.parse(event.data);

        const initialCandles = (context.candles || []).map(
            (c: {
                open_time: Time;
                open: number;
                high: number;
                low: number;
                close: number;
                volume: number;
            }) => ({
                time: c.open_time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                value: c.volume,
            }),
        );

        setData({
            candles: initialCandles,
            gameBalance: context.game_balance,
            ivyBalance: context.ivy_balance,
            ivySold: context.ivy_sold,
            ivyCurveMax: context.ivy_curve_max,
            curveInputScale: context.curve_input_scale,
            mktCapUsd: context.mktCapUsd,
            changePct24h: context.change_pct_24h,
            comments: context.comments || [],
            ivyFeeBps: context.ivy_fee_bps || 0,
            gameFeeBps: context.game_fee_bps || 0,
        });

        setLoading(false);
    } catch (err) {
        console.error("Failed to parse context:", err);
        setError(new Error("Failed to parse initial data"));
        setLoading(false);
    }
};

// Helper function to handle update event
const handleUpdateEvent = (
    event: MessageEvent,
    setData: (f: (prev: StreamData) => StreamData) => void,
) => {
    try {
        const update = JSON.parse(event.data);

        setData((prev) => {
            const newData = { ...prev };

            switch (update.type) {
                case "balance":
                    newData.gameBalance = update.game_balance;
                    newData.ivyBalance = update.ivy_balance;
                    newData.mktCapUsd = update.mktCapUsd;
                    newData.changePct24h = update.change_pct_24h;
                    break;

                case "comment":
                    // Unshift new comment (reverse chronological)
                    newData.comments = [update.comment, ...prev.comments];
                    break;

                case "candle": {
                    newData.candles = updateCandles(
                        prev.candles,
                        parseCandle(update.candle),
                    );
                    break;
                }

                case "world":
                    newData.ivySold = update.ivy_sold;
                    break;

                default:
                    break;
            }

            return newData;
        });
    } catch (err) {
        console.error("Failed to parse update:", err);
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
    console.error("SSE error:", event);

    if (eventSource?.readyState === EventSource.CLOSED) {
        if (!isActive) return;

        const timeout = setTimeout(() => {
            console.log("Attempting to reconnect...");
            connect();
        }, 5000);

        setReconnectTimeout(timeout);
    }
};

export function useGameStream(gameAddress: string, chartKind: ChartInterval) {
    const [data, setData] = useState<StreamData | null>(null);
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
                const url = `${API_STREAM_BASE}/games/${gameAddress}/stream?${params}`;

                eventSource = new EventSource(url);

                eventSource.addEventListener("context", (event) => {
                    if (!isActive) return;
                    handleContextEvent(event, setData, setLoading, setError);
                });

                eventSource.addEventListener("update", (event) => {
                    if (!isActive) return;
                    handleUpdateEvent(
                        event,
                        (f: (prev: StreamData) => StreamData) => {
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
                console.error("Failed to establish SSE connection:", err);
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
    }, [gameAddress, chartKind]);

    return {
        data,
        loading,
        error,
    };
}
