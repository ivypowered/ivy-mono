import { useEffect, useState } from "react";
import { API_STREAM_BASE } from "./constants";

export interface TradeData {
    user: string;
    asset: string;
    symbol: string;
    iconUrl: string;
    volumeUsd: number;
    mktCapUsd: number;
    isBuy: boolean;
}

// Helper function to handle trade event
const handleTradeEvent = (
    event: MessageEvent,
    setData: (trade: TradeData | null) => void,
) => {
    try {
        const trade = JSON.parse(event.data);

        setData({
            user: trade.user,
            asset: trade.asset,
            symbol: trade.symbol,
            iconUrl: trade.icon_url,
            volumeUsd: trade.volume_usd,
            mktCapUsd: trade.mkt_cap_usd,
            isBuy: trade.is_buy,
        });
    } catch (err) {
        console.error("Failed to parse trade:", err);
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
    console.error("Trades SSE error:", event);

    if (eventSource?.readyState === EventSource.CLOSED) {
        if (!isActive) return;

        const timeout = setTimeout(() => {
            console.log("Attempting to reconnect to trades stream...");
            connect();
        }, 5000);

        setReconnectTimeout(timeout);
    }
};

export function useTradesStream() {
    const [data, setData] = useState<TradeData | null>(null);
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

                const url = `${API_STREAM_BASE}/trades/stream`;

                eventSource = new EventSource(url);

                eventSource.addEventListener("trade", (event) => {
                    if (!isActive) return;

                    // First trade received means we're connected
                    setLoading(false);

                    handleTradeEvent(event, setData);
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

                eventSource.addEventListener("open", () => {
                    console.log("Trades SSE connection established");
                    // Since there's no initial context event for trades,
                    // we set loading to false once connected
                    setLoading(false);
                });
            } catch (err) {
                console.error(
                    "Failed to establish Trades SSE connection:",
                    err,
                );
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
    }, []);

    return {
        data,
        loading,
        error,
    };
}
