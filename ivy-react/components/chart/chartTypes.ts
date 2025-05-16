import { Time } from "lightweight-charts";

export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

export const CHART_INTERVALS: ChartInterval[] = [
    "1m",
    "5m",
    "15m",
    "1h",
    "1d",
    "1w",
];

export interface ChartCandle {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    value: number;
}

export interface ChartToken {
    symbol: string;
    mint: string;
    icon: string;
    name: string;
}

export type ChartTab = "Game" | "Chart";
export const CHART_TABS: ChartTab[] = ["Game", "Chart"]; // Define available tabs
