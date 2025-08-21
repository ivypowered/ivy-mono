import React, { useEffect, useMemo, useRef } from "react";
import { useTradesStream } from "@/lib/useTradesStream";

function formatMcap(value: number) {
    if (!isFinite(value)) return "$0";
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${Math.round(value).toLocaleString()}`;
}

function formatUsd(value: number) {
    if (!isFinite(value)) return "$0";
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
}

const FLASH_MS = 600;

export function TradeTicker({ containerEl }: { containerEl: HTMLElement }) {
    const { data } = useTradesStream();
    const lastIdRef = useRef<string | null>(null);
    const roundRef = useRef(0);

    // Manage visibility based on data presence
    useEffect(() => {
        if (data) {
            containerEl.classList.remove("hidden");
        } else {
            containerEl.classList.add("hidden");
        }
    }, [data, containerEl]);

    // Flash on new trade
    useEffect(() => {
        if (!data) return;

        // Use a simple id from trade content
        const id = `${data.asset}:${data.volumeUsd}:${data.mktCapUsd}:${data.isBuy}`;
        if (id === lastIdRef.current) return;
        lastIdRef.current = id;

        // Increment round for this new trade
        roundRef.current += 1;
        const currentRound = roundRef.current;

        containerEl.classList.add("active");
        const t = setTimeout(() => {
            // Only remove active if we're still on the same round
            if (roundRef.current === currentRound) {
                containerEl.classList.remove("active");
            }
        }, FLASH_MS);
        return () => clearTimeout(t);
    }, [data, containerEl]);

    const content = useMemo(() => {
        if (!data) {
            // don't show the client anything
            return <></>;
        }

        const action = data.isBuy ? "bought" : "sold";
        return (
            <a
                href={`/game?address=${data.asset}`}
                className="flex items-center gap-2 hover:underline"
            >
                <span className="font-bold">{data.user.substring(0, 6)}</span>
                <span>{action}</span>
                <span>{formatUsd(data.volumeUsd)}</span>
                <span>of</span>
                <span className="inline-flex items-center gap-1">
                    <img
                        src={data.iconUrl}
                        alt={`${data.iconUrl} icon`}
                        className="w-4 h-4 rounded-full object-cover"
                    />
                    <span className="font-bold truncate max-w-[120px]">
                        {data.symbol || "UNK"}
                    </span>
                </span>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">
                    mcap: {formatMcap(data.mktCapUsd)}
                </span>
            </a>
        );
    }, [data]);

    return content;
}
