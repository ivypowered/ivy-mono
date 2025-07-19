import { useEffect, useRef } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import {
    ColorType,
    CrosshairMode,
    IChartApi,
    ISeriesApi,
    TickMarkType,
    createChart,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { ChartCandle, ChartInterval } from "./chartTypes";

interface ChartBaseProps {
    data: ChartCandle[];
    height: number;
    isLoading?: boolean;
    interval: ChartInterval;
}

export function ChartBase({
    data,
    height,
    isLoading = false,
    interval,
}: ChartBaseProps) {
    const { theme } = useTheme();
    const chartCtrRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<{
        chart?: IChartApi;
        candle?: ISeriesApi<"Candlestick">;
        volume?: ISeriesApi<"Histogram">;
    }>({});

    useEffect(() => {
        if (!chartCtrRef.current) return;

        const axisColor = "#ecf5ff1a";
        const upColor = "#34d399";
        const downColor = "#ff5000";
        const chartTextColor = theme === "light" ? "#565656" : "#C3C3C3";
        const volumeColor = theme === "light" ? "#9494944d" : "#7E7E7E3e";
        const crosshairColor = theme === "light" ? "#565656" : "#C3C3C3";

        const chart = createChart(chartCtrRef.current, {
            layout: {
                textColor: chartTextColor,
                background: { type: ColorType.Solid, color: "transparent" },
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: "transparent" },
                horzLines: { color: "transparent" },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: crosshairColor },
                horzLine: { color: crosshairColor },
            },
            autoSize: true,
            rightPriceScale: { borderColor: axisColor },
            timeScale: {
                borderColor: axisColor,
                timeVisible: true,
                tickMarkFormatter: (
                    time: number,
                    tickMarkType: TickMarkType,
                ) => {
                    if (tickMarkType === 0)
                        return dayjs(time * 1000)
                            .utc()
                            .format("YYYY/M");
                    if (tickMarkType < 3)
                        return dayjs(time * 1000)
                            .utc()
                            .format("M/D");
                    return dayjs(time * 1000)
                        .utc()
                        .format("H:mm");
                },
            },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor,
            downColor,
            borderVisible: false,
            wickUpColor: upColor,
            wickDownColor: downColor,
            priceLineVisible: true,
            priceFormat: {
                type: "custom",
                formatter: (price: number) => {
                    return price.toFixed(
                        Math.min(
                            8, // Max 8 decimals
                            Math.max(
                                2, // Min 2 decimals
                                price < 1
                                    ? -Math.floor(Math.log10(price)) + 2 // Auto decimals for < 1
                                    : 2, // Default 2 for >= 1
                            ),
                        ),
                    );
                },
                minMove: 1e-8,
            },
        });

        candlestickSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.1, bottom: 0.1 },
            autoScale: true, // Ensure autoScale is enabled
        });

        const volumeSeries = chart.addHistogramSeries({
            color: volumeColor,
            priceFormat: { type: "volume" },
            priceScaleId: "", // Set on bottom scale
            lastValueVisible: false,
            priceLineVisible: false,
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.7, bottom: 0 },
        });

        chartRef.current = {
            chart,
            candle: candlestickSeries,
            volume: volumeSeries,
        };

        return () => {
            chart.remove();
            chartRef.current = {};
        };
        // Theme is handled in separate effect
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!chartRef.current.chart) return;
        // Set data for both series
        chartRef.current.candle?.setData(data);
        chartRef.current.volume?.setData(data);
        // Auto-scale price axis when data changes
        chartRef.current.candle?.priceScale().applyOptions({
            autoScale: true,
        });
    }, [data]);

    useEffect(() => {
        // Reset time scale when interval changes
        chartRef.current.chart?.timeScale().resetTimeScale();
    }, [interval]);

    useEffect(() => {
        // Update colors and styles on theme change
        if (!chartRef.current.chart) return;
        const chartTextColor = theme === "light" ? "#565656" : "#C3C3C3";
        const volumeColor = theme === "light" ? "#9494944d" : "#7E7E7E3e";
        const crosshairColor = theme === "light" ? "#565656" : "#C3C3C3";

        chartRef.current.chart.applyOptions({
            layout: { textColor: chartTextColor },
            crosshair: {
                vertLine: { color: crosshairColor },
                horzLine: { color: crosshairColor },
            },
        });

        chartRef.current.volume?.applyOptions({ color: volumeColor });
    }, [theme]);

    return (
        <div
            className="relative w-full cursor-crosshair"
            style={{ minWidth: 0, height: `${height}px` }}
        >
            {isLoading && (
                <div className="absolute inset-0 flex justify-center items-center bg-zinc-900/50 z-10">
                    <span className="text-xl font-bold text-zinc-400">
                        loading
                    </span>
                </div>
            )}
            {data.length === 0 && !isLoading && (
                <div className="absolute inset-0 grid place-items-center bg-zinc-900/50 z-10">
                    <div className="text-sm text-muted-foreground text-center">
                        <p>No chart data available</p>
                    </div>
                </div>
            )}
            <div
                ref={chartCtrRef}
                style={{
                    width: "100%",
                    height: "100%",
                    // Hide chart element itself if no data, prevents flashing initial state
                    visibility:
                        data.length === 0 && !isLoading ? "hidden" : "visible",
                }}
            />
        </div>
    );
}
