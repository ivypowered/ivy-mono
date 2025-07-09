import { Api, ChartKind, ChartResponse } from "@/lib/api";
import { IVY_MINT_B58 } from "@/lib/constants";
import { PublicKey } from "@solana/web3.js";
import { Time } from "lightweight-charts";
import { useState, useRef, useEffect } from "react";
import { ChartInterval, ChartCandle } from "../chart/chartTypes";

const CHART_UPDATE_INTERVAL = 3; // in seconds

export function useChartData(gameAddress: string, interval: ChartInterval) {
    const [data, setData] = useState<ChartCandle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [marketCap, setMarketCap] = useState<number | undefined>(undefined);
    const [changePercent, setChangePercent] = useState<number | undefined>(
        undefined,
    );

    // Use refs to track the latest open_time and prevent stale closures in setInterval
    const lastOpenTimeRef = useRef<number>(0);
    const gameAddressRef = useRef(gameAddress);
    const intervalRef = useRef(interval);

    // Update refs when props change
    useEffect(() => {
        gameAddressRef.current = gameAddress;
        intervalRef.current = interval;
        lastOpenTimeRef.current = 0; // Reset on game/interval change
    }, [gameAddress, interval]);

    useEffect(() => {
        let isMounted = true;

        const fetchAndProcessData = async (isInitialFetch: boolean) => {
            if (!isMounted) return;

            if (isInitialFetch) {
                setLoading(true);
                setError(null);
            }

            try {
                const afterInclusive = isInitialFetch
                    ? 0
                    : lastOpenTimeRef.current;
                const chartResponse = await fetchChartData(afterInclusive);
                if (!isMounted) return;

                processChartData(chartResponse, isInitialFetch);
                if (isInitialFetch) setLoading(false);
            } catch (err) {
                if (!isMounted) return;
                console.error("Error fetching chart data:", err);
                setError(
                    err instanceof Error ? err : new Error("Unknown error"),
                );
                if (isInitialFetch) setLoading(false);
            }
        };

        // Helper to fetch the appropriate chart data
        const fetchChartData = async (afterInclusive: number) => {
            if (gameAddressRef.current === IVY_MINT_B58) {
                return Api.getIvyChart(
                    intervalRef.current as ChartKind,
                    100,
                    afterInclusive,
                );
            }

            const gameMint = new PublicKey(gameAddressRef.current);
            return Api.getGameChart(
                gameMint,
                intervalRef.current as ChartKind,
                100,
                afterInclusive,
            );
        };

        // Helper to process and update chart data
        const processChartData = (
            chartResponse: ChartResponse,
            isInitialFetch: boolean,
        ) => {
            const newCandles = chartResponse.candles.map((candle) => ({
                time: candle.open_time as Time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                value: candle.volume,
            }));

            if (newCandles.length === 0) return;

            // Update the last open time for subsequent fetches
            lastOpenTimeRef.current = newCandles[newCandles.length - 1]
                .time as number;

            if (isInitialFetch) {
                setData(newCandles);
                return;
            }

            setData((prevData) => {
                if (prevData.length === 0) return newCandles;
                // New candles contain the updated last candle, plus any new candles
                return [
                    ...prevData.slice(0, prevData.length - 1),
                    ...newCandles,
                ];
            });

            setMarketCap(chartResponse.mkt_cap_usd);
            setChangePercent(chartResponse.change_24h);
        };

        // Initial fetch
        fetchAndProcessData(true);

        // Set up interval for updates
        const intervalId = setInterval(
            () => fetchAndProcessData(false),
            CHART_UPDATE_INTERVAL * 1000,
        );

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [gameAddress, interval]);

    return { data, marketCap, changePercent, loading, error };
}
