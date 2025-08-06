"use client";

import {
    CHART_INTERVALS,
    type ChartInterval,
    type ChartToken,
    type ChartTab,
} from "./chartTypes";
import Link from "next/link";

const PlayIconFilled = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="inherit"
        {...props}
    >
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

const EditIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// Utility functions
const formatCurrency = (num: number | undefined): string => {
    if (num == null || isNaN(num)) return "-";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: Math.abs(num) >= 1 ? 2 : 6,
    }).format(num);
};

const fromNow = (date: Date): string => {
    const timestamp = date.getTime();
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 0) {
        return "just now";
    }

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) {
        return years === 1 ? "a year ago" : `${years} years ago`;
    }
    if (months > 0) {
        return months === 1 ? "a month ago" : `${months} months ago`;
    }
    if (days > 0) {
        return days === 1 ? "a day ago" : `${days} days ago`;
    }
    if (hours > 0) {
        return hours === 1 ? "an hour ago" : `${hours} hours ago`;
    }
    if (minutes > 0) {
        return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
    }
    if (seconds > 0) {
        return seconds === 1 ? "a second ago" : `${seconds} seconds ago`;
    }
    return "just now";
};

// Sub-components
const TokenIdentity = ({
    token,
    editHref,
}: {
    token: ChartToken;
    editHref: string;
}) => (
    <div className="flex items-center gap-3">
        <img
            src={token.icon || "/placeholder.svg"}
            alt={token.symbol}
            className="h-10 w-10 border-2 border-emerald-400 bg-zinc-800"
            onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
        />
        <span className="text-xl font-bold">{token.name}</span>
        <span className="bg-emerald-400 text-black px-2 font-bold">
            {token.symbol}
        </span>
        {editHref && (
            <Link
                href={editHref}
                className="p-2 text-emerald-400 border-2 border-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 rounded-none ml-1"
                title="Edit game"
            >
                <EditIcon className="w-4 h-4" />
            </Link>
        )}
    </div>
);

const PriceInfo = ({
    priceUsd,
    changePercentUsd,
}: {
    priceUsd?: number;
    changePercentUsd?: number;
}) => (
    <div>
        <div className="text-2xl font-bold">{formatCurrency(priceUsd)}</div>
        {changePercentUsd != null && (
            <div
                className={`text-sm ${changePercentUsd >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
                {changePercentUsd >= 0 ? "+" : ""}
                {changePercentUsd.toFixed(2)}%
            </div>
        )}
    </div>
);

const MarketData = ({
    marketCap,
    createdAt,
}: {
    marketCap?: number;
    createdAt?: Date;
}) => (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
        {marketCap && (
            <div>
                <span className="text-zinc-500 text-xs uppercase block">
                    MARKET CAP
                </span>
                <div className="font-bold">{formatCurrency(marketCap)}</div>
            </div>
        )}
        {createdAt && (
            <div>
                <span className="text-zinc-500 text-xs uppercase block">
                    CREATED
                </span>
                <div className="font-bold">{fromNow(createdAt)}</div>
            </div>
        )}
    </div>
);

interface ChartHeaderProps {
    token: ChartToken;
    priceUsd?: number;
    changePercentUsd?: number;
    marketCap?: number;
    createdAt?: Date;
    interval: ChartInterval;
    setInterval: (i: ChartInterval) => void;
    activeTab: ChartTab;
    setActiveTab: (tab: ChartTab) => void;
    withPlayButton: boolean;
    editHref?: string;
}

export function ChartHeader({
    token,
    priceUsd,
    changePercentUsd,
    marketCap,
    createdAt,
    interval,
    setInterval,
    activeTab,
    setActiveTab,
    withPlayButton,
    editHref = "",
}: ChartHeaderProps) {
    return (
        <div className="bg-zinc-900 text-white border-b-4 border-emerald-400 relative">
            <div className="p-4 space-y-4">
                {/* Section 1: Token Info and Market Data */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <TokenIdentity token={token} editHref={editHref} />

                    {/* Price Info (Mobile Only) */}
                    <div className="sm:hidden">
                        <PriceInfo
                            priceUsd={priceUsd}
                            changePercentUsd={changePercentUsd}
                        />
                    </div>

                    <MarketData marketCap={marketCap} createdAt={createdAt} />
                </div>

                {/* Section 2: Desktop Price + Interval Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    {/* Price Info (Desktop Only) */}
                    <div className="hidden sm:block">
                        <PriceInfo
                            priceUsd={priceUsd}
                            changePercentUsd={changePercentUsd}
                        />
                    </div>

                    {/* Interval Buttons */}
                    <div className="flex border-2 border-emerald-400 overflow-x-auto w-full sm:w-auto">
                        {withPlayButton && (
                            <button
                                className={`
                                px-3 sm:px-4 h-8 font-bold text-sm whitespace-nowrap flex-1 sm:flex-none items-center justify-center gap-1
                                ${activeTab === "Game" ? "bg-emerald-400 text-emerald-950" : "text-white hover:bg-zinc-800"}
                            `}
                                onClick={() => setActiveTab("Game")}
                            >
                                <PlayIconFilled className="inline-block" />
                            </button>
                        )}

                        {CHART_INTERVALS.map((i) => (
                            <button
                                key={i}
                                className={`
                                    px-3 sm:px-4 h-8 font-bold text-sm whitespace-nowrap flex-1 sm:flex-none
                                    ${activeTab === "Chart" && interval === i ? "bg-emerald-400 text-emerald-950" : "text-white hover:bg-zinc-800"}
                                    border-l-2 border-emerald-400
                                `}
                                onClick={() => {
                                    setInterval(i);
                                    setActiveTab("Chart");
                                }}
                            >
                                {i}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
