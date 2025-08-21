import { useEffect, useState } from "react";
import { ChartInterval } from "@/components/chart/chartTypes";
import { API_STREAM_BASE } from "./constants";
import { CandleData, parseCandle, updateCandles } from "./utils";

export interface WorldStreamData {
    // Chart data
    candles: CandleData[];

    // World/Ivy data
    ivySold: string;
    ivyCurveMax: string;
    curveInputScale: number;
    mktCapUsd: number;
    changePct24h: number;
}

// Helper function to handle context event
const handleContextEvent = (
    event: MessageEvent,
    setData: (x: WorldStreamData) => void,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<Error | null>>,
) => {
    try {
        const context = JSON.parse(event.data);

        setData({
            candles: context.candles.map(parseCandle),
            ivySold: context.ivy_sold,
            ivyCurveMax: context.ivy_curve_max,
            curveInputScale: context.curve_input_scale,
            mktCapUsd: context.mkt_cap_usd,
            changePct24h: context.change_pct_24h,
        });

        setLoading(false);
    } catch (err) {
        console.error("Failed to parse world context:", err);
        setError(new Error("Failed to parse initial world data"));
        setLoading(false);
    }
};

// Helper function to handle update event
const handleUpdateEvent = (
    event: MessageEvent,
    setData: (f: (prev: WorldStreamData) => WorldStreamData) => void,
) => {
    try {
        const update = JSON.parse(event.data);

        setData((prev) => {
            const newData = { ...prev };

            switch (update.type) {
                case "world":
                    // Update ivy_sold when world state changes
                    newData.ivySold = update.ivy_sold;
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
        console.error("Failed to parse world update:", err);
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
    console.error("World SSE error:", event);

    if (eventSource?.readyState === EventSource.CLOSED) {
        if (!isActive) return;

        const timeout = setTimeout(() => {
            console.log("Attempting to reconnect to world stream...");
            connect();
        }, 5000);

        setReconnectTimeout(timeout);
    }
};

export function useWorldStream(chartKind: ChartInterval) {
    const [data, setData] = useState<WorldStreamData | null>(null);
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
                });
                const url = `${API_STREAM_BASE}/ivy/stream?${params}`;

                eventSource = new EventSource(url);

                eventSource.addEventListener("context", (event) => {
                    if (!isActive) return;
                    handleContextEvent(event, setData, setLoading, setError);
                });

                eventSource.addEventListener("update", (event) => {
                    if (!isActive) return;
                    handleUpdateEvent(
                        event,
                        (f: (prev: WorldStreamData) => WorldStreamData) => {
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
                console.error("Failed to establish World SSE connection:", err);
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
    }, [chartKind]);

    return {
        data,
        loading,
        error,
    };
}
