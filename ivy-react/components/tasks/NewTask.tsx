import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAssetsStream, type AssetData } from "@/lib/useAssetsStream";

// Match PHP fmt_timestamp function
function formatTimestamp(timestamp: number): string {
    if (!timestamp || timestamp <= 0) {
        return "some time ago";
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = currentTime - timestamp;

    if (timeDifference < 60) {
        const value = timeDifference;
        return `${value} ${value === 1 ? "second" : "seconds"} ago`;
    } else if (timeDifference < 3600) {
        const value = Math.floor(timeDifference / 60);
        return `${value} ${value === 1 ? "minute" : "minutes"} ago`;
    } else if (timeDifference < 86400) {
        const value = Math.floor(timeDifference / 3600);
        return `${value} ${value === 1 ? "hour" : "hours"} ago`;
    } else if (timeDifference < 2592000) {
        // ~30 days
        const value = Math.floor(timeDifference / 86400);
        return `${value} ${value === 1 ? "day" : "days"} ago`;
    } else if (timeDifference < 31536000) {
        // ~365 days
        const value = Math.floor(timeDifference / 2592000);
        return `${value} ${value === 1 ? "month" : "months"} ago`;
    } else {
        const value = Math.floor(timeDifference / 31536000);
        return `${value} ${value === 1 ? "year" : "years"} ago`;
    }
}

// Match PHP fmt_number_short function
function formatNumberShort(number: number, precision: number = 1): string {
    if (!isFinite(number)) {
        return "N/A";
    }

    if (number < 1000) {
        return Math.floor(number).toLocaleString();
    } else if (number < 1000000) {
        const formatted = number / 1000;
        return `${formatted.toFixed(precision)}K`;
    } else if (number < 1000000000) {
        const formatted = number / 1000000;
        return `${formatted.toFixed(precision)}M`;
    } else {
        const formatted = number / 1000000000;
        return `${formatted.toFixed(precision)}B`;
    }
}

function AssetCard({ asset }: { asset: AssetData }) {
    const outerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Apply bubble animation to the hover div (the one with border-2)
        const outer = outerRef.current;
        if (!outer) return;

        const hoverDiv = outer.querySelector(".border-2") as HTMLElement;
        if (!hoverDiv) return;

        hoverDiv.classList.add("game-card-bubble");
        const t = setTimeout(() => {
            hoverDiv.classList.remove("game-card-bubble");
        }, 600);
        return () => clearTimeout(t);
    }, []);

    // Extract and prepare data
    const gameAddress = asset.address || "";
    const gameName = asset.name || "Untitled Game";
    const gameSymbol = (asset.symbol || "???").toUpperCase();
    const description = asset.description || "";
    const imageUrl = asset.iconUrl || "/assets/images/placeholder.png";
    const marketCapUsd = asset.mktCapUsd || 0;
    const createTimestamp = asset.createTimestamp || 0;

    // Cap description to 280 characters
    const shortDesc =
        description.length > 280
            ? description.substring(0, 280) + "..."
            : description;

    // Skip if no address
    if (!gameAddress) {
        return null;
    }

    return (
        <div ref={outerRef} className="group relative">
            <a href={`/game?address=${gameAddress}`} className="block">
                <div className="flex h-fit w-full overflow-hidden border-2 p-3 group-hover:border-emerald-400 border-transparent hover:bg-emerald-950/30 max-h-[300px] gap-3">
                    {/* Image on the left */}
                    <div className="aspect-square relative min-w-[128px] self-start">
                        <img
                            src={imageUrl}
                            alt={gameName}
                            loading="lazy"
                            width="128"
                            height="128"
                            className="h-32 w-32 object-cover bg-zinc-800"
                        />
                    </div>

                    {/* Content on the right */}
                    <div className="flex-1 grid h-fit gap-2">
                        {/* Metadata section (created at and market cap) */}
                        <div className="space-y-1 pb-1">
                            {/* Created info and timestamp */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                created {formatTimestamp(createTimestamp)}
                            </div>

                            {/* Market cap */}
                            <div className="flex gap-1 text-xs text-emerald-400 font-semibold">
                                market cap: ${formatNumberShort(marketCapUsd)}
                            </div>
                        </div>

                        {/* Game name, symbol and description on same line */}
                        <div>
                            <p className="text-sm text-zinc-300">
                                <span className="font-extrabold">
                                    {gameName} ({gameSymbol})
                                    {shortDesc ? ":" : ""}
                                </span>
                                {shortDesc && <> {shortDesc}</>}
                            </p>
                        </div>
                    </div>
                </div>
            </a>
        </div>
    );
}

type Item = {
    key: string;
    asset: AssetData;
    host: HTMLElement;
};

export function NewTask({
    gamesGridElement,
}: {
    gamesGridElement: HTMLElement;
}) {
    const { subscribe } = useAssetsStream();
    const [items, setItems] = useState<Item[]>([]);
    const isActiveRef = useRef(true);

    // Ensure we don't duplicate cards for the same address
    const hasAddress = useCallback(
        (address: string) => {
            // Check for data-address attribute
            if (gamesGridElement.querySelector(`[data-address="${address}"]`)) {
                return true;
            }
            // Check for links with the address (PHP uses ?address= format)
            if (
                gamesGridElement.querySelector(
                    `a[href="/game?address=${address}"]`,
                )
            ) {
                return true;
            }
            return false;
        },
        [gamesGridElement],
    );

    useEffect(() => {
        isActiveRef.current = true;

        const unsub = subscribe((asset) => {
            if (!isActiveRef.current) return;

            const address = asset.address;
            if (!address || hasAddress(address)) return;

            // Create a wrapper host for this single asset so it's a grid child
            const host = document.createElement("div");
            host.setAttribute("data-address", address);

            // Insert at top of grid
            gamesGridElement.insertBefore(host, gamesGridElement.firstChild);

            setItems((prev) => [
                { key: `${address}:${Date.now()}`, asset, host },
                ...prev,
            ]);
        });

        return () => {
            isActiveRef.current = false;
            unsub();
        };
    }, [gamesGridElement, hasAddress, subscribe]);

    // Render portals into each host
    return (
        <>
            {items.map((item) =>
                createPortal(
                    <AssetCard asset={item.asset} />,
                    item.host,
                    item.key,
                ),
            )}
        </>
    );
}
