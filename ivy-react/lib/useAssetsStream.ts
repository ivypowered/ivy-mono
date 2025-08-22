import { useEffect, useRef, useCallback } from "react";
import { API_STREAM_BASE } from "./constants";

export interface AssetData {
    name: string;
    symbol: string;
    address: string;
    iconUrl: string;
    description: string;
    createTimestamp: number;
    mktCapUsd: number;
}

export type AssetCallback = (asset: AssetData) => void;
export type UnsubscribeFn = () => void;

export function useAssetsStream() {
    const eventSourceRef = useRef<EventSource | null>(null);
    const listenersRef = useRef<Set<AssetCallback>>(new Set());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isActiveRef = useRef(true);

    const connect = useCallback(() => {
        if (!isActiveRef.current) return;

        try {
            const url = `${API_STREAM_BASE}/assets/stream`;
            eventSourceRef.current = new EventSource(url);

            eventSourceRef.current.addEventListener("asset", (event) => {
                if (!isActiveRef.current) return;

                try {
                    const assetRaw = JSON.parse(event.data);
                    const asset: AssetData = {
                        name: assetRaw.name,
                        symbol: assetRaw.symbol,
                        address: assetRaw.address,
                        iconUrl: assetRaw.icon_url,
                        description: assetRaw.description,
                        createTimestamp: assetRaw.create_timestamp,
                        mktCapUsd: assetRaw.mkt_cap_usd,
                    };

                    // Notify all listeners
                    listenersRef.current.forEach((callback) => {
                        try {
                            callback(asset);
                        } catch (err) {
                            console.error("Error in asset callback:", err);
                        }
                    });
                } catch (err) {
                    console.error("Failed to parse asset:", err);
                }
            });

            eventSourceRef.current.addEventListener("error", (event) => {
                console.error("Assets SSE error:", event);

                if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
                    if (!isActiveRef.current) return;

                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log(
                            "Attempting to reconnect to assets stream...",
                        );
                        connect();
                    }, 5000);
                }
            });
        } catch (err) {
            console.error("Failed to establish Assets SSE connection:", err);

            if (!isActiveRef.current) return;

            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 5000);
        }
    }, []);

    // Subscribe function that users can call
    const subscribe = useCallback(
        (callback: AssetCallback): UnsubscribeFn => {
            // Start connection if this is the first listener
            if (listenersRef.current.size === 0 && !eventSourceRef.current) {
                connect();
            }

            listenersRef.current.add(callback);

            // Return unsubscribe function
            return () => {
                listenersRef.current.delete(callback);

                // Close connection if no more listeners
                if (listenersRef.current.size === 0 && eventSourceRef.current) {
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                }
            };
        },
        [connect],
    );

    // Cleanup on unmount
    useEffect(() => {
        isActiveRef.current = true;

        return () => {
            isActiveRef.current = false;

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }

            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }

            // eslint-disable-next-line react-hooks/exhaustive-deps
            listenersRef.current.clear();
        };
    }, []);

    return { subscribe };
}
